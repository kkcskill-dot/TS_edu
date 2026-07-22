# 2회차: 대용량 해시 조인과 메모리 튜닝

> 💡 **학습 목표**
> 실무에서 가장 많이 마주하는 조인 방식인 **해시 조인(Hash Join)**의 내부 메커니즘을 뜯어보고, 메모리(PGA) 크기가 성능에 미치는 엄청난 영향력을 확인합니다.

---

## 1. 해시 조인의 3가지 모드와 비용 차이

해시 조인은 작은 쪽 테이블(Build Input)을 메모리(PGA)에 올려 해시 맵을 만든 뒤, 큰 쪽 테이블(Probe Input)을 스캔하며 해시 맵을 탐색하는 방식입니다. 이때 **PGA 메모리 여유 공간**에 따라 3단계 운명이 결정됩니다.

### ① In-Memory 해시 조인 (Best)
- Build Input이 PGA 메모리에 한 번에 쏙 들어가는 경우.
- 디스크 I/O가 전혀 발생하지 않아 해시 조인이 낼 수 있는 최고의 성능을 냅니다.

### ② 1-Pass 해시 조인 (Warning)
- Build Input이 메모리보다 커서, 맵을 만들다가 메모리가 꽉 차면 남은 데이터를 디스크(Temp 영역)에 잠시 기록합니다.
- 조인 대상 데이터를 디스크에 딱 **한 번** 썼다가 읽어옵니다. 속도 저하가 체감되지만 야간 배치라면 버틸 만합니다.

### ③ Multipass 해시 조인 (Critical Danger)
- Build Input이 메모리보다 지나치게 커서, Temp 영역을 썼다 지웠다를 **수없이 반복**하는 끔찍한 상황입니다.

> [!NOTE]
> **실행계획에서 메모리 모드를 읽는 3개 컬럼** (`DBMS_XPLAN ... 'ALLSTATS LAST'`)
> 해시 조인 라인 오른쪽 끝에 붙는 이 컬럼들이 In-Memory/1-Pass/Multipass를 그대로 드러냅니다.
> | 컬럼 | 의미 | 판독 |
> |---|---|---|
> | **OMem** | Optimal(In-Memory)로 돌기 위해 **필요한** 메모리 추정치 | 기준선 |
> | **1Mem** | 1-Pass로 처리하는 데 필요한 메모리 | — |
> | **Used-Mem** | 실제 사용 메모리. 뒤에 `(0)` `(1)` `(2)` 표기 | **`(0)`=Optimal, `(1)`=1-Pass, `(2+)`=Multipass** |
> | **Used-Tmp** | 실제로 디스크(Temp)에 쓴 양 | 값이 있으면 디스크로 새어나갔다는 뜻 |

---

> [!CAUTION]
> **장애 사례: "평소 10분 걸리던 야간 배치가 아침 9시가 되도록 안 끝나요!"**
> - **원인**: 통계정보 오차로 인해 옵티마이저가 100만 건짜리 작은 테이블 대신 1억 건짜리 초대형 테이블을 Build Input(해시 맵 생성 대상)으로 덜컥 잡아버렸습니다. 
> - **현상**: 1억 건을 메모리에 구겨 넣으려다 실패하고 끝없는 Multipass 늪에 빠져 디스크 I/O 병목으로 서버가 멈춰버렸습니다.
> - **해결**: `/*+ LEADING(작은테이블 큰테이블) USE_HASH(큰테이블) */` 힌트를 투입해 Build Input을 작은 테이블로 강제 고정합니다.

---

## 2. PGA_AGGREGATE_TARGET 파라미터 제어 전략

`PGA_AGGREGATE_TARGET`은 데이터베이스가 세션들에게 할당할 총 PGA 메모리의 목푯값입니다. 

> [!TIP]
> **세션 단위 PGA 한도 해제 기법**
> 수억 건의 데이터를 집계하는 강력한 월마감 쿼리 하나를 돌릴 때, 1-Pass나 Multipass로 떨어지는 것을 막고 억지로 In-Memory로 끌어올리고 싶다면 아래 스크립트로 현재 세션의 메모리 한도를 일시적으로 풀어줄 수 있습니다.
> ```sql
> ALTER SESSION SET WORKAREA_SIZE_POLICY = MANUAL;
> ALTER SESSION SET HASH_AREA_SIZE = 1073741824; -- 1GB 할당
> ```
> *(주의: 동시 접속자가 많은 주간 OLTP 환경에서 사용하면 DB 메모리 고갈로 서버가 즉시 다운될 수 있습니다!)*

---

## 3. 🧪 실습 Lab — 해시 조인 메모리 추적기

### Step 1. V$SQL_WORKAREA로 쿼리의 Temp 사용량 훔쳐보기
현재 돌고 있는, 혹은 방금 끝난 해시 조인 쿼리가 In-Memory로 돌았는지, Temp로 쫓겨났는지 확인하는 진단 쿼리입니다.

```sql
SELECT sql_id, 
       operation_type, 
       estimated_optimal_size / 1024 / 1024 AS est_opt_mb, -- In-Memory에 필요한 최소 MB
       last_memory_used / 1024 / 1024 AS last_mem_mb,     -- 실제 사용한 메모리 MB
       last_execution,                                    -- 'OPTIMAL', 'ONE PASS', 'MULTI-PASS'
       max_tempseg_size / 1024 / 1024 AS max_temp_mb      -- 디스크를 얼마나 썼는지
  FROM v$sql_workarea
 WHERE sql_id = '여기에_조회할_SQL_ID입력'
 ORDER BY estimated_optimal_size DESC;
```

### Step 2. 조인 순서 뒤집기 (Before / After)

**(Before) 통계 오류로 T_LARGE(1억건)가 Build Input이 된 비극의 쿼리**

```sql
SELECT /*+ GATHER_PLAN_STATISTICS LEADING(l s) USE_HASH(s) */ 
       s.code_nm, SUM(l.amount)
  FROM t_large l, t_small s
 WHERE l.code = s.code
 GROUP BY s.code_nm;
```

```text
------------------------------------------------------------------------------------------------------------
| Id | Operation           | Name    | Starts | A-Rows |   A-Time   | Buffers | Reads | OMem | 1Mem |Used-Tmp|
------------------------------------------------------------------------------------------------------------
|  1 | HASH GROUP BY       |         |      1 |     50 |00:14:20.11 |    2101K|  1840K|      |      |        |
|* 2 |  HASH JOIN          |         |      1 |    100M|00:12:55.03 |    2101K|  1840K| 1116M| 8M   | 14GB(2)|
|  3 |   TABLE ACCESS FULL | T_LARGE |      1 |    100M|00:01:10.55 |    1120K|       |      |      |        |  ← Build
|  4 |   TABLE ACCESS FULL | T_SMALL |      1 |     50 |00:00:00.01 |      12 |       |      |      |        |  ← Probe
------------------------------------------------------------------------------------------------------------
```

> 🔴 **여기가 재앙의 증거**
> - `Id 2` HASH JOIN의 **`Used-Tmp = 14GB(2)`** — 끝의 **`(2)`가 Multipass**. 디스크에 14GB를 썼다 지웠다 반복.
> - `Reads 1840K` — 논리 I/O가 아니라 **물리 디스크 읽기**가 184만 블록 터짐(Temp 왕복).
> - `Id 3`이 먼저(Build) 나오는데 **A-Rows=100M** — 1억 건으로 해시 맵을 만들려다 참사. `OMem=1116M`(1GB 넘게 필요)인데 PGA가 부족.

**(After) 작은 테이블을 Build Input으로 강제 → In-Memory(Optimal)**

```sql
SELECT /*+ GATHER_PLAN_STATISTICS LEADING(s l) USE_HASH(l) */ 
       s.code_nm, SUM(l.amount)
  FROM t_small s, t_large l
 WHERE l.code = s.code
 GROUP BY s.code_nm;
```

```text
------------------------------------------------------------------------------------------------------------
| Id | Operation           | Name    | Starts | A-Rows |   A-Time   | Buffers | Reads | OMem | 1Mem |Used-Mem|
------------------------------------------------------------------------------------------------------------
|  1 | HASH GROUP BY       |         |      1 |     50 |00:00:52.14 |    1120K|     0 |      |      |        |
|* 2 |  HASH JOIN          |         |      1 |    100M|00:00:49.30 |    1120K|     0 | 2048K| 2048K|1832K(0)|
|  3 |   TABLE ACCESS FULL | T_SMALL |      1 |     50 |00:00:00.01 |      12 |       |      |      |        |  ← Build
|  4 |   TABLE ACCESS FULL | T_LARGE |      1 |    100M|00:00:41.02 |    1120K|       |      |      |        |  ← Probe
------------------------------------------------------------------------------------------------------------
```

> ✅ **무엇이 달라졌나?**
> - `Used-Mem = 1832K(0)` — 끝의 **`(0)`이 Optimal(In-Memory)**. `Reads=0`, `Used-Tmp` 사라짐 = 디스크 접근 0.
> - Build가 T_SMALL(50건)로 바뀜 → 해시 맵이 2MB면 충분(`OMem=2048K`).
> - `A-Time 14분 20초 → 52초`. **논리·물리 계획을 바꾸지 않고 Build 방향만 뒤집어** 얻은 성과.

> 💡 위 플랜의 `Used-Tmp / Used-Mem` 값이 곧 아래 `V$SQL_WORKAREA`의 `last_execution`(OPTIMAL/ONE PASS/MULTI-PASS)과 일대일로 대응합니다. **플랜에서 먼저 의심하고, V$SQL_WORKAREA로 확진**하는 흐름을 익히세요.

---

## 4. 한 장 정리

- 해시 조인의 성능은 **"어느 테이블로 해시 맵을 만들 것인가(Build Input)"**가 99%를 결정한다.
- 옵티마이저가 헛발질하여 대형 테이블을 Build Input으로 잡으면 **Multipass Hash Join**이라는 대참사가 벌어진다.
- 배치 프로그램에서 해시 조인을 쓸 때는 통계정보 변화에 휘둘리지 않도록 가급적 `LEADING(작은것 큰것)` 힌트를 박아두는 것이 방어적 프로그래밍의 기본이다.
- 내 쿼리가 왜 느린지 궁금하다면 디스크 I/O를 의심하고, `V$SQL_WORKAREA`에서 Temp 사용 이력을 반드시 조회하라.
