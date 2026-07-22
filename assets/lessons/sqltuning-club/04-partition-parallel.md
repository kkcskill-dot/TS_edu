# 4회차: 파티셔닝 전략과 병렬 처리 심화 튜닝

> 💡 **학습 목표**
> 수억 건에서 수십억 건에 달하는 초대용량 테이블을 제어하기 위한 **파티셔닝(Partitioning)** 기술과 **병렬 처리**(Parallel Query)의 핵심 메커니즘을 마스터합니다. Pruning 성공/실패를 실행계획의 `Pstart/Pstop`으로 직접 판독합니다.

---

## 0. 워밍업 — 파티셔닝 3대 유형과 실무 선택 기준

| 유형 | 분할 기준 | 대표 사례 | 핵심 이점 |
|---|---|---|---|
| **Range** | 값의 범위(주로 날짜) | 거래이력, 로그, 정산 (월/일 단위) | 오래된 파티션 Drop = 초고속 데이터 삭제 |
| **List** | 명시된 값 목록 | 지역코드, 법인코드, 채널 | 업무 단위 분리·관리 |
| **Hash** | 해시 함수 | 균등 분산이 목적일 때 (계좌번호 등) | I/O 분산, 핫블록 완화 |

> [!TIP]
> 실무 대세는 **Range(월) + Hash 서브파티션** 조합입니다. "조회는 기간으로, 분산은 키로." 그리고 19c부터는 `INTERVAL` 파티셔닝으로 월 파티션 자동 생성이 가능해 "파티션 추가를 깜빡해서 난 장애"가 사라졌습니다.

---

## 1. 파티션 Pruning과 인덱스 설계 전략

파티셔닝의 가장 큰 목적은 전체 데이터를 뒤지지 않고, 조건에 맞는 파티션 조각만 쏙쏙 골라 읽는 **파티션 프루닝**(Partition Pruning)에 있습니다.

> [!WARNING]
> **파티션 Pruning 실패 대참사**
> 날짜별로 월 파티셔닝 된 테이블에서 쿼리 조건에 `WHERE SUBSTR(reg_date, 1, 6) = '202310'` 처럼 파티션 키 컬럼을 가공해 버리면, 옵티마이저는 어떤 파티션을 읽어야 할지 몰라 모든 파티션을 다 스캔(`PARTITION RANGE ALL`)해버립니다. 파티션 키는 절대 가공해선 안 됩니다.

### Pruning 성공/실패 판독법 — 실행계획의 Pstart / Pstop

파티션 테이블 플랜에는 `Pstart`(읽기 시작 파티션 번호)와 `Pstop`(끝 파티션 번호) 컬럼이 붙습니다. **이 둘의 간격이 좁을수록 Pruning 성공.**

```
| Id | Operation                | Name    | Pstart| Pstop |
|  1 |  PARTITION RANGE SINGLE  |         |    22 |    22 |   ← 성공: 1개만 읽음
|  1 |  PARTITION RANGE ITERATOR|         |    20 |    22 |   ← 성공: 3개만 읽음
|  1 |  PARTITION RANGE ALL     |         |     1 |    36 |   ← 실패: 전 파티션 스캔!
|  1 |  PARTITION RANGE (KEY)   |         |   KEY |   KEY |   ← 바인드 변수: 실행 시점 결정
```

**성공/실패를 A-Rows·Buffers까지 붙여 나란히 보면 차이가 명확합니다** (동일 결과, 완전히 다른 비용):

```text
▶ Pruning 성공 — WHERE sale_dt BETWEEN '20231001' AND '20231031'
------------------------------------------------------------------------------------------
| Id | Operation                | Name    | Pstart| Pstop | Starts | A-Rows | A-Time |Buffers|
------------------------------------------------------------------------------------------
|  1 | SORT AGGREGATE           |         |       |       |      1 |      1 |00:00:00.09|  842 |
|  2 |  PARTITION RANGE SINGLE  |         |    10 |    10 |      1 |    31M |00:00:00.08|  842 |
|  3 |   TABLE ACCESS FULL      | T_SALES |    10 |    10 |      1 |    31M |00:00:00.06|  842 |
------------------------------------------------------------------------------------------
   → 48개 파티션 중 10번 1개만 스캔. Buffers 842.

▶ Pruning 실패 — WHERE TO_CHAR(sale_dt,'YYYYMM') = :ym
------------------------------------------------------------------------------------------
| Id | Operation                | Name    | Pstart| Pstop | Starts | A-Rows | A-Time |Buffers|
------------------------------------------------------------------------------------------
|  1 | SORT AGGREGATE           |         |       |       |      1 |      1 |00:09:41.22| 41360|
|* 2 |  PARTITION RANGE ALL     |         |     1 |    48 |      1 |    31M |00:09:40.10| 41360|
|* 3 |   TABLE ACCESS FULL      | T_SALES |     1 |    48 |     48 |    31M |00:09:31.55| 41360|
------------------------------------------------------------------------------------------
   → Pstart=1/Pstop=48 전 파티션 스캔. Id 3 Starts=48(파티션마다 스캔). Buffers 41360 (약 49배!).
```

> 🔍 결과 건수(A-Rows 31M)는 **동일**한데 `Pstart/Pstop`과 `Buffers`만 폭발했습니다. 파티션 키를 `TO_CHAR()`로 가공한 순간 옵티마이저가 어느 파티션인지 판단 불가 → 전수 스캔. 바로 위 장애 사례(9시간)의 실제 플랜 모습입니다.

### Pruning을 깨뜨리는 4대 패턴 (코드 리뷰 체크리스트)

```sql
-- ① 파티션 키 가공 (최다 빈출)
WHERE SUBSTR(reg_dt, 1, 6) = '202310'          -- ✗
WHERE reg_dt BETWEEN '20231001' AND '20231031' -- ✓

-- ② 묵시적 형변환: reg_dt가 VARCHAR인데 숫자와 비교
WHERE reg_dt = 20231001                        -- ✗ TO_NUMBER(reg_dt)로 변환됨
WHERE reg_dt = '20231001'                      -- ✓

-- ③ 파티션 키에 NVL/함수
WHERE NVL(reg_dt, '99991231') >= '20231001'    -- ✗

-- ④ OR로 묶인 이종 조건 → 경우에 따라 ALL로 풀림
WHERE (reg_dt = :dt OR :dt IS NULL)            -- ✗ 옵션 조건 패턴 주의
```

> [!NOTE]
> **장애 사례: "월말 정산이 원래 20분인데 오늘은 9시간째예요" (유통사 정산 시스템)**
> - **수사**: 실행계획 확인 결과 `PARTITION RANGE ALL (Pstart=1, Pstop=48)`. 4년 치 48개 파티션 전체 풀스캔.
> - **원인**: 전날 배포에서 누군가 편의상 `WHERE TO_CHAR(sale_dt,'YYYYMM') = :ym` 으로 조건을 리팩터링. 문법상 동일한 결과지만 Pruning은 전멸.
> - **해결**: `WHERE sale_dt >= TO_DATE(:ym||'01','YYYYMMDD') AND sale_dt < ADD_MONTHS(TO_DATE(:ym||'01','YYYYMMDD'),1)` 로 원복. 9시간 → **11분**.

### 로컬(Local) 인덱스 vs 글로벌(Global) 인덱스

- **로컬 인덱스**: 테이블 파티션과 1:1로 짝을 이뤄 쪼개진 인덱스. 파티션을 통째로 날리거나(Drop) 교체(Exchange)하는 관리 작업 시 인덱스가 깨지지 않아 운영 안정성이 압도적으로 좋습니다.
- **글로벌 인덱스**: 테이블은 쪼개져 있지만 인덱스는 하나로 통짜인 경우. 파티션 키 외의 컬럼으로 빠르게 단건 조회를 해야 할 때 불가피하게 사용하지만, 파티션 관리 작업 시 인덱스가 언유저블(Unusable) 상태로 떨어지는 치명적 단점이 있습니다.

| 비교 항목 | 로컬 인덱스 | 글로벌 인덱스 |
|---|---|---|
| 파티션 Drop/Exchange 시 | 안전 (해당 조각만 소멸) | **UNUSABLE 위험** (`UPDATE INDEXES` 옵션 필요) |
| 파티션 키 조건 없는 단건 조회 | 전 인덱스 파티션 탐색 (비효율) | 한 번에 탐색 (유리) |
| 운영 관리 | 매우 편함 | 리빌드 부담 |
| 권장 용도 | 배치·이력 테이블 기본값 | PK/유니크 제약, 키 외 단건 조회 |

---

## 2. 병렬 처리(Parallel Processing)와 데이터 분배

`/*+ PARALLEL(A 4) */` 힌트 하나 넣었다고 무조건 4배 빨라지지 않습니다. 병렬 처리는 여러 명의 작업자(PX Slave)가 데이터를 어떻게 나눠 가지고 어떻게 합치느냐(**Distribution**)가 성능을 좌우합니다.

### 병렬 실행의 구조 — QC와 두 개의 슬레이브 집합

```
        QC (Query Coordinator: 지휘자, 결과 취합)
          ↑ PX SEND QC (RANDOM)
   [슬레이브 집합 2] ← 조인/정렬 담당 (4명)
          ↑ PX SEND HASH (데이터 재분배 = Table Queue)
   [슬레이브 집합 1] ← 테이블 스캔 담당 (4명)
```
- DOP 4로 실행해도 실제 프로세스는 **최대 4×2+1 = 9개**가 뜹니다. DOP를 함부로 올리면 CPU가 순식간에 바닥나는 이유입니다.

> [!NOTE]
> **"PX Deq" 대기 이벤트의 정체**
> A 테이블을 읽는 4명의 작업자와 B 테이블을 읽는 4명의 작업자가 조인을 위해 서로 데이터를 던지고 받을 때, 네트워크 버퍼(Table Queue)를 통해 통신을 합니다. 이때 데이터 분배가 한쪽으로 쏠리거나(**Skew**), 한 작업자가 너무 느리면 나머지 작업자들은 `PX Deq ...` 이벤트를 띄우며 하염없이 대기하게 됩니다.
> - `PX Deq Credit: send blkd` — 받는 쪽이 느려서 보내는 쪽이 막힘
> - `PX Deq: Execution Msg` — 대체로 무해한 제어 통신 (idle성)

### 병렬 조인 분배 최적화 (PQ_DISTRIBUTE 힌트)

- **Hash-Hash 분배**: 양쪽 테이블 모두 조인 키를 기준으로 해시 함수를 적용해 작업자들에게 골고루 뿌려주는 방식 (대용량 vs 대용량 조인의 정석)
- **Broadcast-None 분배**: 한쪽 테이블이 아주 작을 때, 작은 테이블 전체를 모든 작업자에게 복사해서 던져주는 방식 (통신 비용 최소화)

```sql
-- 대용량 × 대용량: HASH-HASH 분배 강제
SELECT /*+ LEADING(a) USE_HASH(b) PQ_DISTRIBUTE(b HASH HASH) PARALLEL(a 8) PARALLEL(b 8) */ ...

-- 대용량 × 소형 코드테이블: 작은 쪽 BROADCAST
SELECT /*+ LEADING(c) USE_HASH(f) PQ_DISTRIBUTE(f BROADCAST NONE) PARALLEL(f 8) */ ...
```

> [!CAUTION]
> **조인 키 Skew 사례: "8개 슬레이브 중 1개만 일하고 7개는 놀아요" (물류 시스템)**
> 배송 테이블의 조인 키인 `hub_cd` 값 중 수도권 허브 1개가 전체 물량의 60%. HASH 분배 시 그 값이 특정 슬레이브 하나로 몰려 DOP 8이 사실상 DOP 1.3으로 동작. `V$PQ_TQSTAT`으로 슬레이브별 처리 건수를 확인하면 즉시 들통납니다. 해결은 Skew 값 분리 처리(UNION ALL) 또는 12c+의 자동 Skew 처리 활용.

### 병렬 실행 상태 진단 쿼리

```sql
-- ① 병렬로 도는 세션과 QC 확인
SELECT qcsid, sid, degree, req_degree FROM v$px_session ORDER BY qcsid, sid;
-- → degree < req_degree 이면 DOP 다운그레이드 발생! (자원 부족)

-- ② 직전 병렬 쿼리의 슬레이브별 처리량 (Skew 진단의 핵심)
SELECT dfo_number, tq_id, server_type, process, num_rows
  FROM v$pq_tqstat
 ORDER BY dfo_number, tq_id, server_type, process;
-- → 같은 tq_id 안에서 process별 num_rows 편차가 크면 Skew

-- ③ 시스템 병렬 통계: 다운그레이드가 얼마나 잦은가
SELECT name, value FROM v$sysstat
 WHERE name LIKE 'Parallel operations%';
```

---

## 3. 구조적 재작성 (Query Rewrite) 실전 사례

때로는 힌트로도 도저히 옵티마이저를 제어할 수 없는 막장 쿼리들이 있습니다. 이런 경우 쿼리의 뼈대 자체를 뜯어고쳐야 합니다.

> [!CAUTION]
> **스칼라 서브쿼리(Scalar Subquery)의 함정**
> SELECT 절에 들어간 스칼라 서브쿼리는 메인 쿼리에서 출력되는 건수만큼 반복 실행됩니다. (캐싱이 되긴 하지만 입력 값 종류가 많으면 무력화됩니다.) 만약 출력 건수가 천만 건이라면 천만 번 루프를 도는 재앙이 발생합니다.

```sql
-- (Before) 스칼라 서브쿼리: 출력 건수만큼 반복
SELECT o.order_no, o.order_amt,
       (SELECT c.cust_nm FROM t_cust c WHERE c.cust_id = o.cust_id) AS cust_nm,
       (SELECT MAX(t.txn_amt) FROM t_txn t WHERE t.order_no = o.order_no) AS max_txn
  FROM t_order o
 WHERE o.order_dt LIKE '202310%';

-- (After) 인라인 뷰로 내려 해시 조인 1회로 종결
SELECT o.order_no, o.order_amt, c.cust_nm, t.max_txn
  FROM t_order o,
       t_cust  c,
       (SELECT order_no, MAX(txn_amt) AS max_txn
          FROM t_txn GROUP BY order_no) t
 WHERE o.order_dt LIKE '202310%'
   AND c.cust_id  = o.cust_id
   AND t.order_no(+) = o.order_no;
```

> 스칼라 서브쿼리를 과감히 빼내어 `FROM` 절의 인라인 뷰로 내린 뒤, 메인 테이블과 단 한 번의 해시 조인으로 끝나도록 쿼리 구조를 완전히 엎어버리는 것이 실무 튜닝의 꽃입니다.

### 초대용량 배치의 정석 — 파티션 Exchange 로드

```sql
-- 월 마감 데이터를 무중단으로 교체하는 실무 패턴
-- ① 스테이징 테이블에 병렬 + Direct Path로 적재
INSERT /*+ APPEND PARALLEL(4) */ INTO stg_sales_202310
SELECT /*+ PARALLEL(s 4) */ ... FROM src_sales s WHERE ...;

-- ② 로컬 인덱스 생성 후 통계 수집
CREATE INDEX stg_ix01 ON stg_sales_202310(cust_id) PARALLEL 4;

-- ③ 순식간에(딕셔너리 조작만으로) 파티션과 맞교환
ALTER TABLE sales EXCHANGE PARTITION p202310
  WITH TABLE stg_sales_202310 INCLUDING INDEXES WITHOUT VALIDATION;
```

---

## 4. 🧪 실습 Lab — Pruning과 병렬 분배 체험

### Step 1. 파티션 테이블 생성 (1~3회차 t_order 데이터 재활용)

```sql
CREATE TABLE t_order_p
PARTITION BY RANGE (order_dt)
( PARTITION p2301 VALUES LESS THAN ('20230201'),
  PARTITION p2302 VALUES LESS THAN ('20230301'),
  PARTITION p2303 VALUES LESS THAN ('20230401'),
  PARTITION p2304 VALUES LESS THAN ('20230501'),
  PARTITION p2305 VALUES LESS THAN ('20230601'),
  PARTITION p2306 VALUES LESS THAN ('20230701'),
  PARTITION p2307 VALUES LESS THAN ('20230801'),
  PARTITION p2308 VALUES LESS THAN ('20230901'),
  PARTITION p2309 VALUES LESS THAN ('20231001'),
  PARTITION p2310 VALUES LESS THAN ('20231101'),
  PARTITION p2311 VALUES LESS THAN ('20231201'),
  PARTITION pmax  VALUES LESS THAN (MAXVALUE) )
AS SELECT * FROM t_order;

CREATE INDEX t_order_p_ix01 ON t_order_p(cust_id) LOCAL;
EXEC DBMS_STATS.GATHER_TABLE_STATS(USER, 'T_ORDER_P');
```

### Step 2. Pruning 성공 vs 실패 비교

```sql
ALTER SESSION SET statistics_level = ALL;

-- ① 성공: 범위 조건
SELECT /*+ GATHER_PLAN_STATISTICS */ COUNT(*), SUM(order_amt)
  FROM t_order_p
 WHERE order_dt BETWEEN '20231001' AND '20231031';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST PARTITION'));
-- → PARTITION RANGE SINGLE, Pstart=Pstop=10 확인

-- ② 실패: 파티션 키 가공
SELECT /*+ GATHER_PLAN_STATISTICS */ COUNT(*), SUM(order_amt)
  FROM t_order_p
 WHERE SUBSTR(order_dt, 1, 6) = '202310';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST PARTITION'));
-- → PARTITION RANGE ALL, Buffers가 몇 배로 뛰는지 기록!
```

### Step 3. 병렬 조인과 분배 방식 관찰

```sql
-- HASH-HASH 분배로 병렬 조인 수행
SELECT /*+ GATHER_PLAN_STATISTICS LEADING(o) USE_HASH(t)
           PQ_DISTRIBUTE(t HASH HASH) PARALLEL(o 4) PARALLEL(t 4) FULL(o) FULL(t) */
       COUNT(*), SUM(t.txn_amt)
  FROM t_order_p o, t_txn t
 WHERE o.order_no = t.order_no;

-- 플랜에서 PX SEND HASH / PX RECEIVE / IN-OUT 컬럼(P->P, P->S) 확인
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));

-- 방금 쿼리의 슬레이브별 처리 건수로 Skew 여부 판독 (같은 세션에서 즉시!)
SELECT dfo_number, tq_id, server_type, process, num_rows
  FROM v$pq_tqstat
 ORDER BY dfo_number, tq_id, server_type, process;
```

**③ 병렬 조인 플랜은 이렇게 생겼습니다 — TQ와 IN-OUT 컬럼 읽기:**

```text
-------------------------------------------------------------------------------------------------
| Id | Operation                | Name    | Pstart| Pstop |    TQ  |IN-OUT| PQ Distrib | A-Rows |
-------------------------------------------------------------------------------------------------
|  0 | SELECT STATEMENT         |         |       |       |        |      |            |      1 |
|  1 |  SORT AGGREGATE          |         |       |       |        |      |            |      1 |
|  2 |   PX COORDINATOR         |         |       |       |        |      |            |      4 |
|  3 |    PX SEND QC (RANDOM)   | :TQ10002|       |       | Q1,02  | P->S | QC (RAND)  |      4 |
|  4 |     SORT AGGREGATE       |         |       |       | Q1,02  | PCWP |            |      4 |
|* 5 |      HASH JOIN BUFFERED  |         |       |       | Q1,02  | PCWP |            |    12M |
|  6 |       PX RECEIVE         |         |       |       | Q1,02  | PCWP |            |    12M |
|  7 |        PX SEND HASH      | :TQ10000|       |       | Q1,00  | P->P | HASH       |    12M |
|  8 |         PX BLOCK ITERATOR|         |     1 |    12 | Q1,00  | PCWC |            |    12M |
|  9 |          TABLE ACCESS FULL| T_ORDER_P|   1 |    12 | Q1,00  | PCWP |            |    12M |
| 10 |       PX RECEIVE         |         |       |       | Q1,02  | PCWP |            |    12M |
| 11 |        PX SEND HASH      | :TQ10001|       |       | Q1,01  | P->P | HASH       |    12M |
| 12 |         PX BLOCK ITERATOR|         |       |       | Q1,01  | PCWC |            |    12M |
| 13 |          TABLE ACCESS FULL| T_TXN  |       |       | Q1,01  | PCWP |            |    12M |
-------------------------------------------------------------------------------------------------
```

> 🔍 **PX 플랜 판독 포인트**
> - **IN-OUT 컬럼**: `P->P`(슬레이브→슬레이브, 재분배 발생) / `P->S`(슬레이브→QC, 결과 취합) / `PCWP`(한 슬레이브 안에서 병렬) / `PCWC`(자식과 병렬). `P->P`가 보이면 **Table Queue를 통한 데이터 재분배**가 일어나는 지점.
> - **TQ 컬럼(`Q1,00` 등)**: 같은 TQ 번호끼리 한 슬레이브 집합. `:TQ10000`/`:TQ10001`이 각자 테이블을 읽어 `HASH`로 뿌리고(`Id 7·11`), `:TQ10002`가 조인.
> - **PQ Distrib = `HASH`**: 양쪽을 조인 키 해시로 재분배(대용량×대용량 정석). 여기를 `BROADCAST`로 바꾸면 `Id 7`이 `PX SEND BROADCAST`로 바뀌고 작은 쪽이 슬레이브 수만큼 복제됩니다.
> - **`HASH JOIN BUFFERED`**: 병렬 해시 조인 특유의 오퍼레이션(Probe 결과를 버퍼링). 순수 `HASH JOIN`과 구분해서 볼 것.

> **`V$PQ_TQSTAT` 출력으로 Skew 판독** — 같은 tq_id 안에서 process별 num_rows 편차를 봅니다:
> ```text
> DFO   TQ_ID  SERVER_TYPE  PROCESS  NUM_ROWS
> ---   -----  -----------  -------  --------
>   1     0    Producer     P002      3,001K   ← 균등 (정상 HASH 분배)
>   1     0    Producer     P003      2,998K
>   1     0    Consumer     P000      7,201K   ← 한 슬레이브에 60% 몰림 = Skew!
>   1     0    Consumer     P001      1,799K
> ```
> Consumer 쪽 편차가 크면 조인 키 Skew. 위 [물류 시스템 사례](#)처럼 특정 값(수도권 허브)이 한 슬레이브로 쏠린 것입니다.

| 관찰 항목 | ① Pruning 성공 | ② Pruning 실패 | ③ 병렬 조인 |
|---|---|---|---|
| Pstart / Pstop | 10 / 10 | 1 / 12 | - |
| Buffers | (기록) | (기록) | - |
| 슬레이브별 num_rows 편차 | - | - | (기록) |

> [!IMPORTANT]
> **실습 과제**: ③의 힌트를 `PQ_DISTRIBUTE(t BROADCAST NONE)`으로 바꿔 재실행하고, `V$PQ_TQSTAT`의 num_rows 합계가 어떻게 달라지는지(작은 쪽이 슬레이브 수만큼 복제되는 현상) 확인해 오세요. "언제 BROADCAST가 이득인가"를 수치로 설명할 수 있으면 이번 소모임 과정 수료입니다. 🎓

---

## 5. 한 장 정리

- 파티셔닝의 존재 이유는 **Pruning** — 실행계획의 `Pstart/Pstop`으로 반드시 검증한다.
- 파티션 키 가공·묵시적 형변환은 Pruning 전멸의 주범. 코드 리뷰에서 걸러라.
- 이력·배치 테이블 인덱스는 **로컬이 기본값**, 글로벌은 꼭 필요할 때만 + `UPDATE INDEXES`.
- 병렬은 DOP보다 **분배(Distribution)와 Skew**가 성능을 결정한다 — `V$PQ_TQSTAT`으로 검증.
- 힌트로 안 되는 쿼리는 구조를 엎어라: 스칼라 서브쿼리 → 인라인 뷰 조인, 대량 적재 → Exchange Partition.

> [!TIP]
> **과정 마무리**: 4회차까지의 흐름 — ①옵티마이저 통제 → ②조인·메모리 → ③사후 역추적 → ④초대용량 설계 — 는 실무 튜닝 프로젝트의 표준 수순과 같습니다. 실제 운영 시스템의 악성 SQL 하나를 골라 이 4단계 관점으로 분석 리포트를 작성해 보는 것을 최종 과제로 추천합니다.
