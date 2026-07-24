# 성능진단 소모임 4회차 개선명세

> 상태: 구현 대기 · 기준일: 2026-07-24 · 기준 DB: Oracle 19c  
> 적용 범위: 4회차 기획/교재/캡스톤만. 이 문서는 구현자가 원문을 다시 찾을 수 있도록 **파일 + 현재 행/앵커 + 교체 방향 + 검수 기준**을 정의한다.

## 1. 결론과 변경 원칙

현재 4회차의 시나리오와 캡스톤 구조는 유지하되, 교재의 AWR/ASH 예제를 운영 쿼리로 오인할 수 있는 정확성 결함을 먼저 수정한다.

핵심 결함은 다음 세 가지다.

1. 디스크 ASH(`DBA_HIST_ACTIVE_SESS_HISTORY`)는 메모리 ASH의 약 1초 표본 전부가 아니라 통상 약 10초 간격으로 일부가 저장된다. `COUNT(*) / elapsed_s`를 그대로 AAS로 쓰면 통상 약 1/10로 과소 계산된다.
2. AWR 누적값 델타는 `SNAP_ID + 1`만으로 연결하면 DBID/인스턴스 혼입, 누락 스냅샷, 재기동에 따른 누적값 초기화를 안전하게 처리하지 못한다. 동일 `DBID / INSTANCE_NUMBER / STARTUP_TIME` 경계에서 `LAG`해야 한다.
3. `DBMS_XPLAN.DISPLAY_AWR`는 AWR에 보존된 **과거 컴파일 계획** 조회다. `ALLSTATS LAST`를 붙여도 마지막 실행의 `A-Rows/Starts/Buffers`가 보장되지 않는다. 실측은 `DISPLAY_CURSOR(..., 'ALLSTATS LAST ...')` 또는 SQL Monitor 증거로 분리해야 한다.

워크스페이스 실행기는 jsDelivr `sql.js`(SQLite WASM)이므로 아래 Oracle/MySQL/PostgreSQL 진단 SQL은 브라우저에서 실행·자동채점하지 않는다. **구문·객체·산식 정적 검수 + 해당 DB 비운영 환경 실행 검수**로 승인한다. 캡스톤은 사전 계산 데이터 판독형을 유지한다.

---

## 2. 파일별 변경명세

행 번호는 2026-07-24 원문 기준이며, 구현 시 행 이동에 대비해 제목/ID/스크립트명 앵커를 함께 사용한다.

| 우선순위 | 파일과 현재 위치 | 현재 문제 | 변경 내용 | 완료 조건 |
|---|---|---|---|---|
| P0 | `assets/lessons/perf-club/session-4.md:77` `[실무 스크립트 4-1]` | `e.snap_id=b.snap_id+1`, snapshot을 `snap_id` 위주로 연결하고 경과시간에서 DAY/HOUR가 빠져 RAC·재기동·장구간에 취약 | §3.1의 `DBID+INSTANCE_NUMBER+STARTUP_TIME` 파티션 `LAG` 쿼리로 교체. 출력에 실제 시작/종료시각과 elapsed_s 포함 | 재기동 전후 값이 한 델타로 계산되지 않고, 1시간 초과 구간도 초 환산이 정확함 |
| P0 | 같은 파일 `:134` `[실무 스크립트 4-3]` | `V$SYSTEM_EVENT` 기동 후 누적치를 장애 구간 Top wait처럼 보일 수 있음. ASH 분모가 WAITING만 포함 | 실시간 누적 예제에는 “두 시점 델타 필요” 경고. 과거 구간은 `DBA_HIST_SYSTEM_EVENT` 두 스냅샷 델타로 교체. ASH 예제는 ON CPU와 non-idle WAIT를 같은 분모로 집계 | `wait_pct`가 “비유휴 wait 내부 비율”임을 명시하고 `% DB time`과 구분 |
| P0 | 같은 파일 `:162` `[실무 스크립트 4-4]` | ASH `COUNT(*)`를 활동시간/횟수로 오독 가능. 메모리와 디스크 ASH 표본 밀도 차이 설명 없음 | §3.2의 반개구간 조건과 가중 AAS 산식을 추가. sample count는 실행·대기 횟수가 아님을 SQL 바로 아래 표기 | 메모리/디스크 ASH의 AAS 산식과 한계가 각각 표시됨 |
| P0 | 같은 파일 `:299~322` `[실무 스크립트 4-10/4-10b]` | `V$SQL.ELAPSED_TIME`은 현재 캐시 누적값. `DISPLAY_AWR(...,'ALLSTATS LAST')`를 “실측”이라고 표기 | 과거 Top SQL은 `DBA_HIST_SQLSTAT.*_DELTA`로 변경. 4-10b를 “AWR 보존 컴파일 계획”으로 개명하고 `TYPICAL +PREDICATE +ALIAS +OUTLINE` 사용. 별도 `DISPLAY_CURSOR ALLSTATS LAST +IOSTATS +MEMSTATS` 예제 추가 | AWR 계획에서 A-Rows/Starts/실제 spill을 단정하는 문장 0건 |
| P0 | 같은 파일, 첫 Oracle 진단 SQL 앞(4.1 시작부) | 라이선스·실행환경 고지가 스크립트마다 일관되지 않음 | 공통 경고 박스 추가: Oracle Diagnostics Pack 적용 범위, sql.js 실행 불가, 비운영 DB 검증 필요, 시간조건 `[begin,end)` 원칙 | 학습자가 “실행” 버튼 또는 SQLite 채점을 기대하지 않음 |
| P1 | `partials/perf-club.html:1112~1350`, `#panel-report-lab` | 사전 계산 데이터라는 사실과 AAS/플랜 증거 한계가 화면에서 충분히 드러나지 않음 | 소개문(`:1192`) 아래에 “합성/사전 계산 증거, Oracle SQL 미실행” 배지 추가. 지표 표에 `수집원·표본간격·단위` 열/툴팁 추가. 증거 선택 영역(`rl-evi-list`)에 `DISPLAY_AWR=계획`, `DISPLAY_CURSOR/SQL Monitor=실측` 구분 문항 추가 | 화면만 보고도 데이터 출처와 검증 한계를 설명 가능 |
| P1 | `app.js:1311~1610`, `function initReportLab()` | 채점이 결론/키워드 중심이며 세 함정의 판별 여부를 직접 평가하지 않음 | 기존 `ALL_METRICS`, 증거 목록 생성(`:1493~`) 및 채점(`:1529~`) 범위에 3개 필수 근거 키 추가: `ash_sample_weight`, `snapshot_restart_safe`, `plan_evidence_type`. 세 항목 중 하나라도 틀리면 기술정확성 만점 금지 | 리셋(`:1605~`) 후 새 항목도 초기화되며 재진입 시 이벤트 중복 없음 |
| P1 | `partials/perf-club.html:2496~2518`, `tb-session4`/`markdown-viewer-session4`; `app.js:98` | 경로 자체는 정상이나 교재 개정 후 캐시된 렌더가 남을 수 있음 | ID/라우팅은 변경하지 않는다. 필요 시 Markdown URL에 명시적 버전 쿼리만 추가하고 교재 수정과 함께 버전 상승 | 4회차 탭 최초/재진입 렌더 정상, 1~3회차 탭 영향 없음 |
| P1 | `curriculum/perf-club-session-4-one-page-plan.md`, “범위 통제/완료기준” | SQL 산식·증거 유형 정확성의 평가 기준이 약함 | 완료기준에 “ASH 표본 보정, 재기동 안전 델타, 계획/실측 구분 3개 필수” 추가 | 팀 보고서 80점이어도 필수 3개 오류 시 통과 불가 |
| P1 | `curriculum/perf-club-session-4-integrated-diagnostic-scenario.md:90` 부근 | `DISPLAY_AWR 또는 DISPLAY_CURSOR`가 동일 종류의 근거처럼 읽힘 | 증거 체인을 `AWR 구간 통계 → ASH 귀속 → DISPLAY_AWR 계획 이력 → DISPLAY_CURSOR/SQL Monitor 실측`으로 명시. 실측 자료가 없으면 “가설”로 등급 하향 | “620배 오차/38GB 실제 spill” 단정에는 실측 증거 ID가 붙음 |
| P2 | `curriculum/perf-club-session-4-learner-support-handoff.md`, AAS/실행계획 오개념 표 | 세 정확성 함정에 대한 강사 질문이 분산됨 | 필수 Q&A 3개와 오답 피드백 문구를 추가 | 강사 답안과 캡스톤 채점 문구가 동일 용어 사용 |
| P2 | `curriculum/labs/session-4-oracle-diagnostic/README.md` 및 `workbook.html` | 합성 `LAB_%` 자료와 실제 AWR/ASH의 수집 특성이 혼동될 수 있음 | 합성 데이터임을 각 화면에 반복 표기하고, `sample_interval_s`/`evidence_type` 메타데이터를 데이터셋에 추가 | 원천이 `SYNTHETIC`, `MEMORY_ASH`, `DISK_ASH`, `AWR_PLAN`, `CURSOR_ACTUAL` 중 하나로 식별됨 |

### 수정 금지 경계

`partials/perf-club.html`에는 다중 과정 공유 패널이 공존한다. 이번 변경은 `#panel-report-lab`과 `tb-session4` 블록에만 한정한다.

- 수정 금지: `#panel-explain`(현재 약 119행), `#panel-index`(약 278행), `#panel-index-efficiency`(약 2523행)
- 이유: SQL 튜닝·데이터 모델링·방문자 통계 등 여러 과정에서 재사용한다.
- 공유 CSS/일반 `.tbook-tab` 규칙을 바꾸지 말고 `#panel-report-lab .rl-*`로 스코프한다.

---

## 3. SQL 정확성 수정안

전체 구현본은 검수 완료된 `reports/session4_sql_improved.md`를 기준으로 옮기되, 교재에는 아래 핵심 산식과 판독문을 반드시 유지한다.

### 3.1 Oracle — 재기동 안전 AWR 시간모델 델타

```sql
WITH x AS (
  SELECT s.dbid, s.instance_number, s.startup_time, s.snap_id,
         s.begin_interval_time, s.end_interval_time,
         t.stat_name, t.value,
         LAG(t.value) OVER (
           PARTITION BY s.dbid, s.instance_number, s.startup_time, t.stat_name
           ORDER BY s.snap_id
         ) prev_value,
         LAG(s.end_interval_time) OVER (
           PARTITION BY s.dbid, s.instance_number, s.startup_time, t.stat_name
           ORDER BY s.snap_id
         ) prev_end_time
  FROM dba_hist_snapshot s
  JOIN dba_hist_sys_time_model t
    ON t.dbid=s.dbid
   AND t.instance_number=s.instance_number
   AND t.snap_id=s.snap_id
  WHERE s.dbid=:dbid
    AND s.instance_number=:inst_id
    AND t.stat_name IN ('DB CPU','DB time')
), d AS (
  SELECT x.*,
         EXTRACT(DAY FROM end_interval_time-prev_end_time)*86400
       + EXTRACT(HOUR FROM end_interval_time-prev_end_time)*3600
       + EXTRACT(MINUTE FROM end_interval_time-prev_end_time)*60
       + EXTRACT(SECOND FROM end_interval_time-prev_end_time) elapsed_s
  FROM x
)
SELECT snap_id, begin_interval_time, end_interval_time, stat_name,
       ROUND((value-prev_value)/1e6/NULLIF(elapsed_s,0),2) AS aas
FROM d
WHERE prev_value IS NOT NULL
  AND value >= prev_value
  AND elapsed_s > 0
  AND end_interval_time > :begin_ts
  AND begin_interval_time < :end_ts
ORDER BY snap_id, stat_name;
```

필수 판독:

- `DBID`, `INSTANCE_NUMBER`, `STARTUP_TIME`가 모두 같은 구간에서만 누적값을 차감한다. RAC 합계는 인스턴스별 델타를 먼저 계산한 뒤 합산한다.
- 스냅샷 누락 시 `LAG`는 직전 보존 스냅샷을 사용하므로 출력된 실제 구간 길이를 보고한다.
- PDB 범위가 필요하면 버전/뷰가 제공하는 `CON_DBID/CON_ID`도 키와 필터에 포함한다.

### 3.2 Oracle — ASH AAS와 표본간격 보정

메모리 ASH(`GV$ACTIVE_SESSION_HISTORY`)는 통상 약 1초 표본이므로 다음 근사가 가능하다.

```sql
-- 메모리 ASH: 반개구간 [begin_ts, end_ts)
SELECT COUNT(*) AS samples,
       ROUND(COUNT(*) / NULLIF(:elapsed_s,0), 2) AS aas
FROM gv$active_session_history
WHERE sample_time >= :begin_ts
  AND sample_time <  :end_ts
  AND session_type = 'FOREGROUND';
```

디스크 ASH는 단순 `COUNT(*)/:elapsed_s`를 금지한다. `USECS_PER_ROW`가 유효하면 행별 대표시간을 합산하는 방식을 우선한다.

```sql
-- 디스크 ASH: 각 저장 표본이 대표하는 시간으로 가중
SELECT COUNT(*) AS stored_samples,
       ROUND(SUM(NVL(usecs_per_row, :fallback_interval_s*1e6))
             / 1e6 / NULLIF(:elapsed_s,0), 2) AS weighted_aas
FROM dba_hist_active_sess_history
WHERE dbid = :dbid
  AND instance_number = :inst_id
  AND sample_time >= :begin_ts
  AND sample_time <  :end_ts
  AND session_type = 'FOREGROUND';
```

필수 판독:

- `:fallback_interval_s`는 무조건 10으로 하드코딩하지 말고 실제 표본시각 차이/환경에서 확인한다. 확인 불가 시 “통상 10초를 사용한 추정치”라고 표시한다.
- `COUNT(*)`는 실행 횟수도 wait 발생 횟수도 아니다.
- Top event 비중은 ON CPU와 non-idle WAIT를 같은 활성 표본 분모로 보여준다. WAITING만 집계한 비율은 “대기 내부 구성비”로 명명한다.

### 3.3 Oracle — AWR 계획과 커서 실측 분리

```sql
-- 과거 계획 이력: 컴파일 계획, 실측 row-source 통계로 표현 금지
SELECT *
FROM TABLE(dbms_xplan.display_awr(
  sql_id          => :sql_id,
  plan_hash_value => :plan_hash_value,
  db_id           => :dbid,
  format          => 'TYPICAL +PREDICATE +ALIAS +OUTLINE'
));

-- 현재 shared pool의 마지막 실행 실측: 사전 통계 수집이 전제
SELECT *
FROM TABLE(dbms_xplan.display_cursor(
  sql_id          => :sql_id,
  cursor_child_no => :child_no,
  format          => 'ALLSTATS LAST +IOSTATS +MEMSTATS +PREDICATE +ALIAS'
));
```

`DISPLAY_CURSOR`의 실측 열도 `statistics_level=ALL` 또는 `/*+ gather_plan_statistics */` 등으로 통계가 수집되고 커서가 남아 있어야 한다. 장시간/병렬 SQL은 라이선스 범위 내 SQL Monitor가 더 적절할 수 있다. 운영 DML을 실측 목적으로 재실행하지 않는다.

### 3.4 MySQL 8.0 / PostgreSQL 병기안

| 진단 목적 | Oracle | MySQL 8.0 | PostgreSQL | 동일성 한계 |
|---|---|---|---|---|
| 구간 AWR/DB Time | `DBA_HIST_SYS_TIME_MODEL` 델타 | 내장 AWR 없음. `performance_schema` summary를 외부 주기 저장 후 두 시점 델타 | 내장 AWR 없음. `pg_stat_database`, `pg_stat_statements`를 외부 저장 후 델타 | MySQL/PG 수치는 Oracle DB Time과 완전 동치 아님 |
| Top wait 이력 | `DBA_HIST_SYSTEM_EVENT`, ASH | `events_waits_summary_global_by_event_name` 두 시점 델타; ASH형 고정주기 이력 없음 | `pg_stat_activity` 샘플링 또는 `pg_wait_sampling` 확장 | 현재 상태/이벤트 ring buffer를 ASH라고 부르지 않음 |
| Top SQL | `DBA_HIST_SQLSTAT.*_DELTA` | `events_statements_summary_by_digest` 두 시점 델타 | `pg_stat_statements` 두 시점 델타 | digest/queryid는 SQL_ID/FMS와 동일하지 않음 |
| 현재 실제 계획 | `DISPLAY_CURSOR ALLSTATS LAST` | `EXPLAIN ANALYZE` | `EXPLAIN (ANALYZE, BUFFERS, WAL)` | MySQL/PG ANALYZE는 실제 실행하므로 운영 DML에 금지 |
| 과거 계획 | `DISPLAY_AWR` | 기본 저장소 없음 | 기본 저장소 없음; `auto_explain` 등 사전 로그 | 외부 수집 없이는 사후 복원 불가 |
| 현재 blocker | ASH/GV$SESSION | `performance_schema.data_lock_waits`, `data_locks` | `pg_locks`, `pg_blocking_pids()` | 과거 blocker 이력은 별도 수집 필요 |

관리형 서비스에서는 AWS Performance Insights/Database Insights, PMM, PoWA, pgSentinel 같은 보완재를 쓸 수 있으나 코어 DB 기능과 혼동하지 않는다.

---

## 4. sql.js 정적 검증 범위

| 항목 | sql.js 실행 | 정적 검증 | 실제 DB 검증 |
|---|---:|---:|---:|
| `V$/GV$/DBA_HIST_*`, `DBMS_XPLAN` 객체 존재·권한 | 불가 | 객체명/컬럼명 리뷰 | Oracle 19c 비운영 환경 필수 |
| Oracle interval/TIMESTAMP, `FETCH FIRST`, 패키지 named argument | 불가 | 파서가 아닌 동료검토 | Oracle에서 parse/execute 필수 |
| MySQL `performance_schema`, `EXPLAIN ANALYZE` | 불가 | 버전·문서 대조 | MySQL 8.0 비운영 환경 |
| PG `pg_stat_*`, `EXPLAIN (ANALYZE...)` | 불가 | extension/버전 대조 | PostgreSQL 비운영 환경 |
| 캡스톤 사전 계산 지표와 채점 JS | SQL 실행 불필요 | 가능 | 브라우저 UI 테스트 |
| 합성 CSV/`LAB_%` 단순 집계 | SQLite 호환 SQL로 별도 작성 시 가능 | 가능 | Oracle 전용 예제와 코드블록 분리 |

교재 코드블록에는 `dialect-oracle`, `dialect-mysql`, `dialect-postgresql`, `sqlite-compatible` 배지를 붙인다. Oracle 예제를 SQLite 문법으로 억지 변환해 “검증 완료” 처리하지 않는다. 폐쇄망 배포 전에는 `assets/js/courses/cloud-db-playground.js`, `sqld-playground.js`의 jsDelivr 의존을 로컬 번들로 대체하거나 네트워크 요구사항을 명시한다.

---

## 5. 구현·검수 순서와 승인 게이트

1. **교재 P0 반영:** `session-4.md`만 수정하고 SQL diff를 DBA가 검수한다.
2. **기획 정합화:** 1페이지 기획서·통합 시나리오·학습지원 문구를 같은 용어로 맞춘다.
3. **캡스톤 반영:** `#panel-report-lab`과 `initReportLab()` 범위만 수정한다.
4. **정적 검수:** Oracle 객체/컬럼, 바인드, 반개구간, 분모 단위, 라이선스 문구를 점검한다.
5. **실DB 검수:** 가능한 경우 Oracle 19c 비운영 환경에서 parse/권한/결과 단위를 검증한다. MySQL/PG 예제도 대상 버전에서 별도 검증한다.
6. **회귀 검수:** 4회차 교재 탭과 캡스톤 외에 공유 `panel-explain`, `panel-index`, `panel-index-efficiency`를 각 참조 과정에서 연다.
7. **실존 게이트:** reviewer가 아래 파일의 존재와 실제 반영 문구를 `list_dir`/검색으로 대조한 뒤에만 완료 처리한다.

### 필수 테스트 케이스

- AWR 델타: 동일 인스턴스 정상 구간, 스냅샷 누락 구간, 재기동 경계, RAC 2인스턴스 자료를 각각 테스트한다.
- ASH: 60초/600초 구간에서 메모리 AAS와 디스크 가중 AAS의 단위가 일치하는지 확인한다. 디스크 단순 count AAS가 정답으로 채점되지 않아야 한다.
- 플랜: `DISPLAY_AWR` 선택만으로 `A-Rows/Starts/실제 TEMP`를 확정하면 오답 처리한다. `DISPLAY_CURSOR` 통계수집 전제까지 선택해야 만점이다.
- UI: 최초 진입, 재진입, 초기화, 채점 2회 실행에서 리스너/항목 중복이 없어야 한다.
- 탭: `tb-session1~4` 모두 렌더되고 4회차 Markdown fetch 실패 시 오류 메시지가 표시돼야 한다.
- 공유 패널: 성능진단·SQL튜닝·데이터모델링·방문자통계의 공유 진입점에서 콘솔 오류 0건.

### 최종 승인 기준

- [ ] `session-4.md`에서 `DISPLAY_AWR(... 'ALLSTATS LAST')` 0건
- [ ] 디스크 ASH `COUNT(*)/elapsed_s` 무보정 AAS 0건
- [ ] AWR 누적 델타에 `DBID + INSTANCE_NUMBER + STARTUP_TIME` 경계 명시
- [ ] 모든 진단 SQL에 Oracle/MySQL/PG 대응 또는 “코어 미지원” 표기
- [ ] sql.js 실행 불가와 합성 데이터 여부가 교재·캡스톤 양쪽에 표기
- [ ] 공유 레거시 패널 변경 diff 0건 또는 별도 다과정 회귀 승인
- [ ] 변경 파일의 실제 존재·내용을 reviewer가 재확인

## 6. 구현 참고 원문

- 원문 구조/SQL 실사: `reports/session4_analysis.md`
- 검수된 SQL 상세본: `reports/session4_sql_improved.md`
- 기술 검수 결과: `reports/session4_review.md`
- DB별 근거 목록: `reports/references.md`
- 합성 데이터 운영 절차: `curriculum/labs/session-4-oracle-diagnostic/README.md`
