# 3회차: ASH와 AWR 기반 시계열 병목 역추적

> 💡 **학습 목표**
> "방금 전까지 느렸는데 지금은 괜찮아요" 같은 귀신 곡할 노릇의 장애를 만났을 때, 오라클의 블랙박스인 **ASH(Active Session History)**와 **AWR(Automatic Workload Repository)**을 활용하여 범인을 색출하는 DBA의 과학 수사 기법을 배웁니다.

---

## 1. 실시간 CPU 스파이크 범인 검거 (ASH)

ASH는 1초마다 DB에서 활동 중인 세션들의 상태(무엇을 기다리는지, 어떤 SQL을 실행 중인지)를 스냅샷으로 찍어 메모리에 기록하는 실시간 감시 카메라입니다.

> [!NOTE]
> **장애 사례: "오후 2시 10분경에 갑자기 CPU가 100%를 치고 장애가 났었어요!"**
> - **접근법**: 장애가 발생했던 정확한 시간대(14시 10분 ~ 15분)의 ASH 데이터를 긁어와 `ON CPU` 상태로 머물렀던 SQL들을 찾아내 비중을 계산합니다.
> - **결과**: 특정 `sql_id` 하나가 전체 CPU 타임의 95%를 독식하고 있었다면 그 놈이 바로 진범입니다.

### 🕵️ DBA의 실전 ASH 진단 쿼리

```sql
-- 과거 특정 시간대의 CPU 스파이크 원인 SQL 찾기
SELECT sql_id, 
       COUNT(*) AS active_seconds,
       ROUND(COUNT(*) / SUM(COUNT(*)) OVER() * 100, 1) AS cpu_pct_share
  FROM v$active_session_history
 WHERE sample_time BETWEEN TO_DATE('2023-10-25 14:10:00', 'YYYY-MM-DD HH24:MI:SS') 
                       AND TO_DATE('2023-10-25 14:15:00', 'YYYY-MM-DD HH24:MI:SS')
   AND session_state = 'ON CPU'
 GROUP BY sql_id
 ORDER BY active_seconds DESC;
```

> **실제 출력 예시 — 5분(300초) 구간의 CPU 점유 SQL:**
> ```text
> SQL_ID          ACTIVE_SECONDS   CPU_PCT_SHARE
> -------------   --------------   -------------
> 8x22kf9d3n1a2            2,400            95.2   ← 범인! 5분 창에서 2400초의 세션-초 독식
> 3ghd82kfl0092              78             3.1
> 9slw01ncmz84a              43             1.7
> ```
> `active_seconds`는 "샘플 수 × 세션 수"라 벽시계 300초를 넘을 수 있습니다(여러 세션 동시 실행). **비중(cpu_pct_share) 95%면 나머지는 볼 것도 없이 첫 줄이 진범.**

---

## 2. AWR 기반 실행계획(Plan) 변동 이력 추적

잘 돌던 쿼리가 하루아침에 느려지는 가장 흔한 원인은 **"실행계획(Plan Hash Value)의 갑작스러운 변경"**입니다. AWR은 과거의 악성 SQL들의 수행 통계와 실행계획 변동 이력을 며칠 단위로 디스크에 꼬박꼬박 보관합니다.

> [!WARNING]
> **Plan Hash Value의 배신**
> "어제까지는 PLAN_A(인덱스 스캔)로 0.1초 만에 끝났는데, 오늘 새벽 통계정보 수집 직후 갑자기 PLAN_B(풀 스캔)로 바뀌면서 100배 느려졌다"는 식의 인과관계를 밝혀내야 합니다.

### 🕵️ DBA의 실전 AWR 추적 쿼리

```sql
-- 특정 SQL_ID의 과거 실행계획(Plan) 변동 히스토리와 소요시간 비교
SELECT plan_hash_value, 
       COUNT(*) AS exec_count,
       ROUND(SUM(elapsed_time_delta)/1000000, 2) AS total_sec,
       ROUND((SUM(elapsed_time_delta)/1000000) / NULLIF(SUM(executions_delta),0), 2) AS avg_sec_per_exec
  FROM dba_hist_sqlstat
 WHERE sql_id = '8x22kf...'
 GROUP BY plan_hash_value
 ORDER BY avg_sec_per_exec ASC;
```

> **위 쿼리의 실제 출력 예시 — 한 SQL이 두 개의 Plan으로 갈라진 순간:**
> ```text
> PLAN_HASH_VALUE   EXEC_COUNT   TOTAL_SEC   AVG_SEC_PER_EXEC
> ---------------   ----------   ---------   ----------------
>     2938451077        18,420      184.20              0.01   ← 어제까지 (PLAN_A, 빠름)
>     1044852213           612    58,140.00             95.00   ← 오늘 새벽부터 (PLAN_B, 100배 느림!)
> ```
> `avg_sec_per_exec`가 **0.01초 → 95초**로 폭증. `plan_hash_value`가 바뀐 정확한 시점이 곧 장애 발생 시점입니다.

### 두 Plan을 실제로 꺼내 비교하기

과거 Plan은 AWR에 보관되므로 `DBMS_XPLAN.DISPLAY_AWR`로 직접 뽑아 무엇이 바뀌었는지 눈으로 확인합니다.

```sql
-- 빨랐던 PLAN_A 
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR('8x22kf...', 2938451077, NULL, 'BASIC'));
-- 느려진 PLAN_B
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR('8x22kf...', 1044852213, NULL, 'BASIC'));
```

```text
▶ PLAN_A (hash=2938451077) — 인덱스로 정조준, 0.01초
-------------------------------------------------------------
| Id | Operation                    | Name         | Rows |
-------------------------------------------------------------
|  0 | SELECT STATEMENT             |              |      |
|  1 |  SORT AGGREGATE              |              |    1 |
|  2 |   TABLE ACCESS BY INDEX ROWID| T_SALES      |   38 |
|  3 |    INDEX RANGE SCAN          | T_SALES_IX01 |   38 |   ← 필요한 38건만 인덱스로 콕
-------------------------------------------------------------

▶ PLAN_B (hash=1044852213) — 통계 수집 후 풀스캔으로 변질, 95초
-------------------------------------------------------------
| Id | Operation           | Name    | Rows |
-------------------------------------------------------------
|  0 | SELECT STATEMENT    |         |      |
|  1 |  SORT AGGREGATE     |         |    1 |
|  2 |   TABLE ACCESS FULL | T_SALES |  120M|   ← 1.2억 건 전수 스캔으로 돌변
-------------------------------------------------------------
```

> 🔍 **핵심 판독**: 같은 SQL인데 `Id 2~3`가 **`INDEX RANGE SCAN` → `TABLE ACCESS FULL`**로 바뀐 것이 100배 저하의 정체. 새벽 통계 수집으로 카디널리티 추정이 틀어져 옵티마이저가 "풀스캔이 더 싸다"고 오판한 전형적 케이스입니다.

> **해결책**: AWR 분석을 통해 과거의 `plan_hash_value` 중 가장 빨랐던 놈(여기선 `2938451077`)을 찾았다면, `DBMS_SPM` 패키지로 SQL Plan Baseline을 심거나 SQL Profile을 떠서 현재 쿼리가 무조건 그 과거의 Plan을 타도록 강제(Pinning) 해버리면 즉시 장애가 복구됩니다.

---

## 3. 대기 이벤트(Wait Event) 딥다이브

튜너는 맹목적으로 SQL 텍스트만 뚫어져라 쳐다보는 사람이 아닙니다. 시스템의 어떤 자원(CPU, 디스크 I/O, Lock)이 경합하고 있는지를 대기 이벤트로 먼저 파악하는 **Top-Down 접근법**이 핵심입니다.

- 📖 `db file sequential read`: 인덱스를 통해 테이블을 한 건씩 찔러 읽느라 디스크를 기다리는 중 (수치가 비정상적으로 높으면 인덱스 설계 불량 의심)
- 📖 `db file scattered read`: 테이블 전체를 무식하게 풀스캔(Full Scan) 하느라 디스크 뭉텅이를 기다리는 중
- 📖 `enq: TX - row lock contention`: 누군가 업데이트 중인 행(Row)을 나도 업데이트하려고 번호표 뽑고 줄 서서 멈춰있는 중 (보통 애플리케이션 트랜잭션 커밋 누락 로직 문제)

---

## 4. 🧪 실습 Lab — 락(Lock) 경합 실시간 추적

가장 골치 아픈 "화면이 멈췄어요" (Lock 경합) 상황을 1초 만에 파악하는 쿼리입니다.

```sql
-- 현재 락을 물고 있는 세션(Blocker)과 기다리는 세션(Waiter) 계층 구조 보기
SELECT LEVEL,
       LPAD(' ', (LEVEL-1)*2) || sid AS sid,
       serial#,
       username,
       osuser,
       event,
       sql_id,
       blocking_session
  FROM v$session
 WHERE (blocking_session IS NOT NULL OR sid IN (SELECT blocking_session FROM v$session))
 START WITH blocking_session IS NULL
CONNECT BY PRIOR sid = blocking_session;

-- [과제] 위 쿼리에서 최상위 LEVEL 1에 있는 SID가 
-- 모든 장애의 근원(Blocker)입니다. 해당 세션의 SQL_ID를 찾아내세요!
```

---

## 5. 한 장 정리

- "느려졌다"는 막연한 장애 보고를 받으면, **ASH**를 뒤져서 정확히 그 시간대에 CPU나 디스크를 독식한 `SQL_ID`를 뽑아내는 것이 수사의 첫 단추다.
- 범인 SQL을 찾았다면, **AWR**을 뒤져서 며칠 전에는 어떤 실행계획(`Plan Hash Value`)으로 돌았는지 비교하라.
- 튜닝은 SQL을 예쁘게 고치는 것이 아니라, **대기 이벤트(Wait Event)**를 보고 시스템 자원의 병목 지점을 뚫어주는 행위다.
