# 성능진단 소모임 4회차 — AWR/ASH SQL 개선판

> 기준: Oracle Database 19c, 단일/RAC 공용 작성 · 검토일: 2026-07-24  
> 원본: `assets/lessons/perf-club/session-4.md`의 실무 스크립트 4-1, 4-3, 4-4, 4-10/4-10b

## 0. 실행 전 확인

- `DBA_HIST_*`, `V$ACTIVE_SESSION_HISTORY`/`GV$ACTIVE_SESSION_HISTORY`, AWR 보고서와 `DBMS_XPLAN.DISPLAY_AWR`는 **Oracle Diagnostics Pack 라이선스** 적용 범위다. 운영 실행 전 계약과 `CONTROL_MANAGEMENT_PACK_ACCESS`를 확인한다.
- 이 워크스페이스의 SQL 실행기는 jsDelivr의 `sql.js`(SQLite WASM)다. 아래 Oracle/MySQL/PostgreSQL SQL은 이 SPA에서 실행 검증할 수 없으며, 각 DB의 비운영 검증 환경에서 실행계획과 권한을 확인해야 한다.
- 예시는 바인드 `:begin_ts`, `:end_ts`, `:dbid`, `:inst_id`, `:sql_id`를 사용한다. 시간 조건은 원칙적으로 **반개구간** `[begin, end)`, 즉 `>= :begin_ts AND < :end_ts`로 통일해 인접 구간의 경계 샘플 중복을 막는다.
- RAC에서는 `DBID + INSTANCE_NUMBER/INST_ID`, PDB 분석에서는 지원 버전에 따라 `CON_DBID`/`CON_ID`를 반드시 범위에 포함한다. 아래 `:dbid`, `:inst_id` 조건을 제거하면 인스턴스 합계가 된다.
- **AWR 델타 SQL(AWR-02, AWR-03)의 두 스냅샷 `:begin_snap`, `:end_snap`은 반드시 동일 `DBID` / `INSTANCE_NUMBER` / `STARTUP_TIME`에 속하고 그 사이에 인스턴스 재기동이 없어야** 델타가 유효하다. 재기동이 끼면 누적값이 초기화되어 음수·과대 델타가 발생하므로, 실행 전 `DBA_HIST_SNAPSHOT`에서 두 스냅샷의 `STARTUP_TIME`이 동일한지 확인한다.

---

## 1. 기존 SQL 검토 결과와 AWR 개선판

### 1.1 DB CPU AAS / DB Time AAS — 스냅샷 델타

**실행 목적:** 스냅샷별 누적 시간모델의 델타를 실제 구간 초로 나눠 CPU AAS와 전체 AAS를 계산한다.

**원본 문제점**

1. `e.snap_id = b.snap_id + 1`은 스냅샷 삭제·누락 시 구간을 잃고, DBID가 다른 자료가 섞일 수 있다.
2. `DBA_HIST_SNAPSHOT`을 `SNAP_ID`만으로 조인해 RAC의 다른 인스턴스 또는 다른 DBID와 다대다 조인이 날 수 있다.
3. 경과시간 계산에서 DAY/HOUR를 빠뜨려 1시간 이상 구간이 잘못된다.
4. 인스턴스 재기동으로 누적값이 초기화된 경우 음수 델타를 만들 수 있다.

```sql
/* AWR-01: 스냅샷 구간별 DB CPU AAS와 DB Time AAS
   - LAG는 동일 DB/인스턴스/기동 구간 안에서만 수행한다.
   - 값 단위는 microsecond이므로 1e6으로 나눈다. */
WITH tm AS (
    SELECT s.dbid,
           s.instance_number,
           s.snap_id,
           s.startup_time,
           s.begin_interval_time,
           s.end_interval_time,
           t.stat_name,
           t.value,
           LAG(t.value) OVER (
               PARTITION BY s.dbid, s.instance_number, s.startup_time, t.stat_name
               ORDER BY s.snap_id
           ) AS prev_value,
           LAG(s.end_interval_time) OVER (
               PARTITION BY s.dbid, s.instance_number, s.startup_time, t.stat_name
               ORDER BY s.snap_id
           ) AS prev_end_interval_time
    FROM   dba_hist_snapshot s
           JOIN dba_hist_sys_time_model t
             ON t.dbid = s.dbid
            AND t.instance_number = s.instance_number
            AND t.snap_id = s.snap_id
    WHERE  s.dbid = :dbid
      AND  s.instance_number = :inst_id
      AND  t.stat_name IN ('DB CPU', 'DB time')
), delta AS (
    SELECT tm.*,
           EXTRACT(DAY    FROM (end_interval_time - prev_end_interval_time)) * 86400
         + EXTRACT(HOUR   FROM (end_interval_time - prev_end_interval_time)) * 3600
         + EXTRACT(MINUTE FROM (end_interval_time - prev_end_interval_time)) * 60
         + EXTRACT(SECOND FROM (end_interval_time - prev_end_interval_time)) AS elapsed_s
    FROM tm
)
SELECT snap_id,
       begin_interval_time,
       end_interval_time,
       ROUND(MAX(CASE WHEN stat_name = 'DB CPU'
                      THEN (value - prev_value) / 1e6 / NULLIF(elapsed_s, 0) END), 2)
           AS db_cpu_aas,
       ROUND(MAX(CASE WHEN stat_name = 'DB time'
                      THEN (value - prev_value) / 1e6 / NULLIF(elapsed_s, 0) END), 2)
           AS db_time_aas,
       ROUND(MAX(CASE WHEN stat_name = 'DB time'
                      THEN (value - prev_value) / 1e6 / NULLIF(elapsed_s, 0) END)
           - MAX(CASE WHEN stat_name = 'DB CPU'
                      THEN (value - prev_value) / 1e6 / NULLIF(elapsed_s, 0) END), 2)
           AS approx_wait_aas
FROM   delta
WHERE  prev_value IS NOT NULL
  AND  value >= prev_value
  AND  end_interval_time > :begin_ts
  AND  begin_interval_time < :end_ts
GROUP BY snap_id, begin_interval_time, end_interval_time
ORDER BY snap_id;
```

**판독:** `DB time AAS = DB CPU AAS + 비유휴 대기 AAS`는 시간모델 기반의 근사 관계다. CPU AAS가 코어 수에 근접했다는 사실만으로 CPU 증설을 결정하지 말고, OS run queue와 Top SQL을 함께 확인한다. 스냅샷이 누락되면 `LAG`가 직전 보존 스냅샷과 비교하므로 구간 길이가 길어질 수 있다. 반드시 출력된 시작/종료 시간을 함께 보고한다.

- **MySQL 대응:** AWR형 과거 스냅샷이 기본 제공되지 않는다. `performance_schema` 누적값을 외부에서 주기 저장해 두 시점의 `events_statements_summary_*`, `events_waits_summary_*` 델타를 계산한다. Amazon RDS/Aurora에서는 Performance Insights/Database Insights가 관리형 대안이다.
- **PostgreSQL 대응:** 내장 AWR 스냅샷은 없다. `pg_stat_database`와 `pg_stat_statements`를 주기 저장하고 델타를 계산한다. `pg_stat_statements.total_exec_time`은 SQL 실행시간 통계이지 Oracle DB Time과 완전 동치가 아니다.

### 1.2 구간 Top Wait Event — AWR 누적값 델타

**실행 목적:** 재기동 이후 누적치인 `V$SYSTEM_EVENT`를 그대로 정렬하지 않고, 지정 AWR 스냅샷 구간에서 증가한 비유휴 대기시간을 비교한다.

```sql
/* AWR-02: :begin_snap ~ :end_snap 사이 Top non-idle wait
   두 스냅샷은 같은 DBID/instance/startup에 속해야 한다. */
WITH w AS (
    SELECT event_name,
           wait_class,
           MAX(CASE WHEN snap_id = :begin_snap THEN total_waits END) AS b_waits,
           MAX(CASE WHEN snap_id = :end_snap   THEN total_waits END) AS e_waits,
           MAX(CASE WHEN snap_id = :begin_snap THEN time_waited_micro END) AS b_us,
           MAX(CASE WHEN snap_id = :end_snap   THEN time_waited_micro END) AS e_us
    FROM   dba_hist_system_event
    WHERE  dbid = :dbid
      AND  instance_number = :inst_id
      AND  snap_id IN (:begin_snap, :end_snap)
      AND  wait_class <> 'Idle'
    GROUP BY event_name, wait_class
), d AS (
    SELECT event_name,
           wait_class,
           e_waits - b_waits AS waits,
           e_us - b_us AS wait_us
    FROM w
    WHERE b_waits IS NOT NULL AND e_waits IS NOT NULL
      AND e_waits >= b_waits AND e_us >= b_us
)
SELECT event_name,
       wait_class,
       waits,
       ROUND(wait_us / 1e6, 1) AS wait_s,
       ROUND(wait_us / NULLIF(waits, 0) / 1000, 2) AS avg_wait_ms,
       ROUND(100 * wait_us / NULLIF(SUM(wait_us) OVER (), 0), 1) AS wait_pct
FROM   d
ORDER BY wait_us DESC
FETCH FIRST 10 ROWS ONLY;
```

**교정 포인트:** 원본 `V$SYSTEM_EVENT`는 인스턴스 기동 후 누적값이라 장애 구간만 나타내지 않는다. 또한 `wait_pct`는 **비유휴 대기시간 내부 비율**이지 `% DB time`이 아니다. 실제 `% DB time`을 얻으려면 이 쿼리의 `wait_us`(마이크로초) 델타를, **같은 구간의 `DB time` 델타를 분모로** 나눠야 한다. 즉 `100 * wait_us / (AWR-01에서 계산한 DB time 델타 마이크로초)` 형태로 별도 계산한다. 두 지표(비유휴 대기 내부 비율 vs `% DB time`)를 혼동하지 않는다.

- **MySQL 대응:** `performance_schema.events_waits_summary_global_by_event_name`의 두 시점 `SUM_TIMER_WAIT`, `COUNT_STAR` 델타. 자체 이력은 없으므로 수집기가 필요하다.
- **PostgreSQL 대응:** wait event별 누적 시간의 내장 이력이 없어 직접 대응하지 않는다. `pg_stat_activity.wait_event_type/wait_event`를 고주기로 샘플링하거나 `pg_wait_sampling` 확장을 사용한다.

### 1.3 과거 부하 상위 SQL — AWR 델타

**실행 목적:** 현재 캐시 `V$SQL`의 기동 후 누적치 대신 AWR 구간 델타로 SQL별 DB 소비시간·CPU·읽기·실행당 비용을 비교한다.

```sql
/* AWR-03: 스냅샷 구간 Top SQL
   DBA_HIST_SQLSTAT의 *_DELTA 컬럼은 해당 스냅샷 구간 증가량이다. */
SELECT st.sql_id,
       st.plan_hash_value,
       SUM(st.executions_delta) AS executions,
       ROUND(SUM(st.elapsed_time_delta) / 1e6, 1) AS elapsed_s,
       ROUND(SUM(st.cpu_time_delta) / 1e6, 1) AS cpu_s,
       SUM(st.buffer_gets_delta) AS buffer_gets,
       SUM(st.disk_reads_delta) AS disk_reads,
       ROUND(SUM(st.elapsed_time_delta)
             / NULLIF(SUM(st.executions_delta), 0) / 1000, 2) AS elapsed_ms_per_exec
FROM   dba_hist_sqlstat st
WHERE  st.dbid = :dbid
  AND  st.instance_number = :inst_id
  AND  st.snap_id > :begin_snap
  AND  st.snap_id <= :end_snap
GROUP BY st.sql_id, st.plan_hash_value
HAVING SUM(st.elapsed_time_delta) > 0
ORDER BY elapsed_s DESC
FETCH FIRST 15 ROWS ONLY;
```

**교정 포인트:** `ELAPSED_TIME`을 정렬한 원본 `V$SQL`은 현재 shared pool 잔존 SQL만 보며 분석 구간과 맞지 않는다. `elapsed_s` 합은 병렬 실행에서 wall-clock과 다를 수 있고 SQL별 elapsed 합은 DB Time과 정확히 일치하지 않을 수 있다. 리터럴 파편화 분석은 `DBA_HIST_SQLSTAT.FORCE_MATCHING_SIGNATURE`를 추가 집계하되 `0`은 제외한다.

- **MySQL 대응:** `performance_schema.events_statements_summary_by_digest`의 `SUM_TIMER_WAIT`, `COUNT_STAR`, rows examined를 두 시점 델타로 집계한다. digest가 Oracle FMS와 유사한 정규화 지문 역할을 한다.
- **PostgreSQL 대응:** `pg_stat_statements`의 `total_exec_time`, `calls`, shared/local block 통계를 두 시점 델타로 집계한다. 기본 데이터는 재시작/리셋 이후 누적이며 외부 스냅샷이 필요하다.

### 1.4 과거 실행계획 표시

**실행 목적:** AWR에 보존된 특정 SQL_ID/plan hash의 컴파일 실행계획을 복원한다.

```sql
/* AWR-04: 가능한 경우 plan_hash_value를 지정해 플랜 변경을 구분한다. */
SELECT *
FROM TABLE(
    dbms_xplan.display_awr(
        sql_id          => :sql_id,
        plan_hash_value => :plan_hash_value,
        db_id           => :dbid,
        format          => 'TYPICAL +PREDICATE +ALIAS +OUTLINE'
    )
);
```

**원본 오류:** `DISPLAY_AWR(..., 'ALLSTATS LAST ...')`는 과거 커서의 실제 row-source 실행통계(`A-Rows`, `Starts`, `Buffers`, `OMem/1Mem`)를 보장하지 않는다. `ALLSTATS LAST`는 주로 `DISPLAY_CURSOR`에서 `statistics_level=ALL` 또는 `gather_plan_statistics`로 수집된 마지막 실행 통계를 볼 때 사용한다. 따라서 AWR 플랜만으로 “620배 카디널리티 오차”나 “TempSpc 38GB 실제 spill”을 단정하지 말고, 장애 당시 SQL Monitor/ASH 또는 재현 환경의 아래 결과와 교차 검증한다.

```sql
SELECT *
FROM TABLE(dbms_xplan.display_cursor(
    sql_id => :sql_id,
    cursor_child_no => :child_no,
    format => 'ALLSTATS LAST +IOSTATS +MEMSTATS +PREDICATE +ALIAS'
));
```

- **MySQL 대응:** 과거 실행계획 저장소는 기본 제공되지 않는다. 현재 쿼리는 `EXPLAIN ANALYZE`(실제 실행 주의) 또는 `EXPLAIN FORMAT=JSON`; 과거 비교는 외부 수집이 필요하다.
- **PostgreSQL 대응:** 과거 실행계획 저장소는 기본 제공되지 않는다. 현재 쿼리는 `EXPLAIN (ANALYZE, BUFFERS, WAL)`이지만 실제 SQL을 실행하므로 운영 DML에는 사용하지 않는다. 과거 계획은 `auto_explain` 로그 등 사전 수집이 필요하다.

---

## 2. ASH 실전 쿼리

> 아래 실시간 예시는 RAC를 고려해 `GV$ACTIVE_SESSION_HISTORY`를 사용한다. 단일 인스턴스면 `V$ACTIVE_SESSION_HISTORY`로 바꿀 수 있다. 메모리 ASH는 통상 활성 세션을 약 1초 간격으로 샘플링하므로 `samples / 구간 초 ≈ AAS`다. 샘플은 정확한 실행 횟수나 대기 횟수가 아니며 짧은 활동은 누락될 수 있다. 더 오래된 구간은 `DBA_HIST_ACTIVE_SESS_HISTORY`로 바꾸되 디스크 ASH는 더 성긴 표본이므로 메모리 ASH의 sample 수와 직접 비교하지 않는다.
>
> **⚠ 디스크 ASH로 AAS를 계산할 때의 표본 보정:** 아래 AAS 계산은 모두 `COUNT(*) / 구간 초`로, **메모리 ASH(약 1초당 1표본) 기준**이다. `GV$ACTIVE_SESSION_HISTORY`를 `DBA_HIST_ACTIVE_SESS_HISTORY`로 바꾸면 MMNL이 약 10초 중 1건만 디스크로 flush하므로 표본 수가 약 1/10로 줄어 **AAS가 그만큼 과소 계산된다**. 따라서 디스크 ASH로 AAS를 낼 때는 `COUNT(*) * 표본간격(초, 통상 10) / 구간 초` 형태로 표본 간격을 곱해 보정하거나, 최소한 "디스크 ASH 기준 AAS는 하한 근사"임을 보고서에 명시한다. 정확한 표본 간격은 사이트 설정에 따라 다르므로 실제 값으로 확인한다.

### 2.1 활성 세션 Top state/event — CPU와 대기를 한 분모로 비교

**실행 목적:** 지정 시간대 전체 DB 부하를 `ON CPU`와 비유휴 대기 이벤트로 분해하고 각 항목의 AAS와 활성 샘플 비중을 구한다.

```sql
/* ASH-01: Top active state/event */
WITH p AS (
    SELECT (EXTRACT(DAY    FROM (:end_ts - :begin_ts)) * 86400
          + EXTRACT(HOUR   FROM (:end_ts - :begin_ts)) * 3600
          + EXTRACT(MINUTE FROM (:end_ts - :begin_ts)) * 60
          + EXTRACT(SECOND FROM (:end_ts - :begin_ts))) AS elapsed_s
    FROM dual
), a AS (
    SELECT CASE
             WHEN ash.session_state = 'ON CPU' THEN 'ON CPU'
             ELSE NVL(ash.event, 'WAITING: UNKNOWN')
           END AS activity,
           CASE
             WHEN ash.session_state = 'ON CPU' THEN 'CPU'
             ELSE NVL(ash.wait_class, 'Other')
           END AS wait_class
    FROM   gv$active_session_history ash
    WHERE  ash.sample_time >= :begin_ts
      AND  ash.sample_time <  :end_ts
      AND  (:inst_id IS NULL OR ash.inst_id = :inst_id)
      AND  ash.session_type = 'FOREGROUND'
)
SELECT activity,
       wait_class,
       COUNT(*) AS samples,
       ROUND(COUNT(*) / NULLIF(MAX(p.elapsed_s), 0), 2) AS aas,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS active_pct
FROM a CROSS JOIN p
GROUP BY activity, wait_class
ORDER BY samples DESC
FETCH FIRST 10 ROWS ONLY;
```

**주의:** 원본 4-3 ASH SQL은 `WAITING`만 분모에 넣어 CPU 부하를 숨기고, 그 `pct`를 전체 DB Time 비율처럼 오해할 여지가 있었다. 개선판은 CPU와 대기를 함께 표시한다.

- **MySQL 대응:** 기본 `performance_schema`에는 Oracle ASH 같은 고정 주기 활성 세션 표본 이력이 없다. `events_waits_current/history(_long)`은 이벤트 이력이지 동등한 ASH가 아니다. Performance Insights 또는 별도 sampler가 필요하다.
- **PostgreSQL 대응:** `pg_stat_activity`는 현재 상태 스냅샷뿐이다. 주기 샘플러 또는 `pg_wait_sampling`이 필요하며, CPU 상태는 `state='active' AND wait_event IS NULL`로 **추정**할 뿐 실제 CPU 사용을 보장하지 않는다.

### 2.2 세션별 대기 분석

**실행 목적:** 어느 세션이 어떤 비유휴 이벤트에서 가장 오래 관측됐는지 찾고 SQL/module에 귀속한다. SID 재사용을 피하려고 `SESSION_SERIAL#`까지 키에 포함한다.

```sql
/* ASH-02: 세션별 non-idle wait profile */
SELECT ash.inst_id,
       ash.session_id AS sid,
       ash.session_serial# AS serial#,
       ash.user_id,
       ash.module,
       ash.sql_id,
       ash.event,
       ash.wait_class,
       COUNT(*) AS wait_samples,
       ROUND(100 * COUNT(*)
             / SUM(COUNT(*)) OVER (
                   PARTITION BY ash.inst_id, ash.session_id, ash.session_serial#
               ), 1) AS session_wait_pct
FROM   gv$active_session_history ash
WHERE  ash.sample_time >= :begin_ts
  AND  ash.sample_time <  :end_ts
  AND  (:inst_id IS NULL OR ash.inst_id = :inst_id)
  AND  ash.session_type = 'FOREGROUND'
  AND  ash.session_state = 'WAITING'
  AND  ash.wait_class <> 'Idle'
GROUP BY ash.inst_id, ash.session_id, ash.session_serial#,
         ash.user_id, ash.module, ash.sql_id, ash.event, ash.wait_class
ORDER BY wait_samples DESC
FETCH FIRST 30 ROWS ONLY;
```

**판독:** `session_wait_pct`의 분모는 해당 세션의 **비유휴 WAITING 샘플만**이다. ON CPU를 포함한 세션 활동 비율이 필요하면 `session_state` 조건을 제거하고 ON CPU용 가상 이벤트를 만든다. `COUNT(*)`는 대기 발생 횟수가 아니다.

- **MySQL 대응:** 현재 세션은 `performance_schema.threads`와 `events_waits_current`를 조인할 수 있으나 과거 세션별 표본 집계는 직접 지원하지 않는다. `events_waits_history_long`도 크기가 제한된 이벤트 ring buffer이므로 ASH 동치가 아니다.
- **PostgreSQL 대응:** 현재 세션은 `pg_stat_activity`의 pid/wait_event로 확인 가능하지만 과거 세션별 대기 비율은 미지원이다. sampler/`pg_wait_sampling`이 필요하다.

### 2.3 특정 시간대 부하 상위 SQL

**실행 목적:** 장애 시간대의 활성 샘플을 SQL_ID와 plan hash에 귀속하고 CPU/대기 구성 및 AAS를 비교한다.

```sql
/* ASH-03: 시간대 Top SQL (RAC 합산, 필요하면 inst_id를 GROUP BY에 추가) */
WITH p AS (
    SELECT (EXTRACT(DAY    FROM (:end_ts - :begin_ts)) * 86400
          + EXTRACT(HOUR   FROM (:end_ts - :begin_ts)) * 3600
          + EXTRACT(MINUTE FROM (:end_ts - :begin_ts)) * 60
          + EXTRACT(SECOND FROM (:end_ts - :begin_ts))) AS elapsed_s
    FROM dual
)
SELECT ash.sql_id,
       ash.sql_plan_hash_value AS plan_hash_value,
       COUNT(*) AS active_samples,
       SUM(CASE WHEN ash.session_state = 'ON CPU'  THEN 1 ELSE 0 END) AS cpu_samples,
       SUM(CASE WHEN ash.session_state = 'WAITING'
                 AND ash.wait_class <> 'Idle' THEN 1 ELSE 0 END) AS wait_samples,
       ROUND(COUNT(*) / NULLIF(MAX(p.elapsed_s), 0), 2) AS aas,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS active_pct
FROM   gv$active_session_history ash
       CROSS JOIN p
WHERE  ash.sample_time >= :begin_ts
  AND  ash.sample_time <  :end_ts
  AND  (:inst_id IS NULL OR ash.inst_id = :inst_id)
  AND  ash.session_type = 'FOREGROUND'
  AND  ash.sql_id IS NOT NULL
GROUP BY ash.sql_id, ash.sql_plan_hash_value
ORDER BY active_samples DESC
FETCH FIRST 20 ROWS ONLY;
```

**판독:** ASH Top SQL은 “활성 상태로 관측된 부하” 순위이며 실행 횟수/평균 응답시간 순위가 아니다. 병렬 SQL은 여러 PX 세션이 동시에 표본화되어 AAS가 크게 보일 수 있으므로 `QC_SESSION_ID`, `SQL_EXEC_ID`까지 확인한다. SQL text는 `DBA_HIST_SQLTEXT` 또는 현재 `GV$SQL`과 별도 조인하되 대형 CLOB를 Top-N 이전에 조인하지 않는다.

- **MySQL 대응:** `events_statements_summary_by_digest`로 누적 Top digest는 가능하지만 임의 과거 시간창은 불가능하다. 시간창 분석은 두 시점 델타 또는 Performance Insights가 필요하다.
- **PostgreSQL 대응:** `pg_stat_statements`로 누적 Top query는 가능하지만 임의 과거 시간창은 불가능하다. 두 시점 델타/외부 모니터링이 필요하며 queryid는 Oracle SQL_ID와 동일 개념이 아니다.

### 2.4 블로킹 세션/피해 세션 귀속 — 추가 권장

**실행 목적:** row lock 등 동시성 장애에서 blocker와 피해 세션, SQL, 이벤트를 시간대별로 연결한다.

```sql
/* ASH-04: blocker -> waiter 표본 Top */
SELECT ash.inst_id AS waiter_inst,
       ash.session_id AS waiter_sid,
       ash.session_serial# AS waiter_serial#,
       ash.blocking_inst_id AS blocker_inst,
       ash.blocking_session AS blocker_sid,
       ash.blocking_session_serial# AS blocker_serial#,
       ash.event,
       ash.sql_id AS waiter_sql_id,
       COUNT(*) AS blocked_samples,
       MIN(ash.sample_time) AS first_seen,
       MAX(ash.sample_time) AS last_seen
FROM   gv$active_session_history ash
WHERE  ash.sample_time >= :begin_ts
  AND  ash.sample_time <  :end_ts
  AND  ash.blocking_session IS NOT NULL
GROUP BY ash.inst_id, ash.session_id, ash.session_serial#,
         ash.blocking_inst_id, ash.blocking_session,
         ash.blocking_session_serial#, ash.event, ash.sql_id
ORDER BY blocked_samples DESC
FETCH FIRST 30 ROWS ONLY;
```

- **MySQL 대응:** 현재 잠금은 MySQL 8.0 `performance_schema.data_lock_waits`/`data_locks`로 blocker-waiter를 연결할 수 있으나 ASH형 과거 표본은 없다.
- **PostgreSQL 대응:** 현재 잠금은 `pg_locks`와 `pg_blocking_pids(pid)`로 연결 가능하나 ASH형 과거 표본은 없다. 지속 이력은 외부 샘플링/로그가 필요하다.

---

## 3. 운영 적용 체크리스트

1. **범위 고정:** DBID, 인스턴스, PDB/서비스, 시작·종료 시간과 타임존을 보고서에 기록한다.
2. **Wide → Narrow:** AWR 구간 AAS/Top wait → ASH event/session/SQL → 실행계획 순으로 좁힌다.
3. **누적값은 델타로:** `V$SYSSTAT`, `V$SYSTEM_EVENT`, `V$SQL` 누적값을 임의 시간대 통계처럼 쓰지 않는다.
4. **샘플의 한계 명시:** ASH sample 수를 실행 횟수나 wait count로 표현하지 않는다. 메모리 ASH와 AWR 저장 ASH의 sample 수를 직접 비교하지 않는다.
5. **플랜 근거 구분:** `DISPLAY_AWR`의 컴파일 계획과 `DISPLAY_CURSOR ALLSTATS LAST`/SQL Monitor의 실행 실측치를 구분한다.
6. **성능 안전:** 먼저 시간 범위를 짧게 하고 Top-N 전 집계를 수행한다. `DBA_HIST_ACTIVE_SESS_HISTORY`에 SQL text CLOB를 선조인하지 않는다.
7. **조치 후 동일 조건 재측정:** AAS, Top event AAS, Top SQL active%, 실행당 elapsed/buffer gets를 같은 길이 구간으로 비교한다.

## 4. 근거 문서

- Oracle Database 19c Reference: `V$ACTIVE_SESSION_HISTORY`, `DBA_HIST_ACTIVE_SESS_HISTORY`, `DBA_HIST_SNAPSHOT`, `DBA_HIST_SYS_TIME_MODEL`, `DBA_HIST_SYSTEM_EVENT`, `DBA_HIST_SQLSTAT`
- Oracle Database 19c PL/SQL Packages and Types Reference: `DBMS_XPLAN.DISPLAY_AWR`, `DBMS_XPLAN.DISPLAY_CURSOR`
- Oracle Database Licensing Information User Manual: Oracle Diagnostics Pack 기능 목록
- MySQL 8.0 Reference Manual: Performance Schema statement/wait summary tables, `data_locks`, `data_lock_waits`, `EXPLAIN ANALYZE`
- PostgreSQL Documentation: `pg_stat_activity`, `pg_stat_statements`, `pg_locks`, `pg_blocking_pids`, `EXPLAIN`
- 워크스페이스 교차 참고: `reports/references.md`
