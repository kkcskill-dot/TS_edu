# 1회차: SQL기본, 플랜기본 + 옵티마이저의 착각과 쿼리 변환 제어

> 💡 **학습 목표**
> 옵티마이저가 쿼리를 어떻게 변환하는지(Query Transformation) 이해하고, 변환이 실패했을 때 벌어지는 실무적인 대참사와 그 우회 기법을 습득합니다.

---

## 0. 실행계획 읽는 법 — 이 컬럼부터 봅니다 (모든 회차 공통)

앞으로 나오는 모든 실행계획은 아래 스크립트로 뽑은 **실제 수행 통계(Actual Statistics)**입니다.

```sql
ALTER SESSION SET statistics_level = ALL;
-- 또는 쿼리에 /*+ GATHER_PLAN_STATISTICS */ 힌트

-- 쿼리 실행 후 곧바로:
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));
```

이렇게 뽑으면 옵티마이저의 **예측(E-Rows)**과 실제 **결과(A-Rows)**를 한눈에 비교할 수 있습니다. 튜너는 아래 4개 컬럼만 봐도 90%를 진단합니다.

| 컬럼 | 의미 | 이렇게 읽는다 |
|---|---|---|
| **Starts** | 이 오퍼레이션이 **몇 번 반복 실행**됐는지 | `1`이 정상. 수천·수만이면 루프(NL/FILTER)에 걸린 것 |
| **E-Rows** | 옵티마이저의 **예상** 반환 건수 | 아래 A-Rows와 자릿수가 다르면 **통계 오류** |
| **A-Rows** | **실제** 반환 건수 | `E-Rows`와 크게 벌어지면 옵티마이저가 착각 중 |
| **A-Time** | 실제 누적 소요 시간 | 어느 오퍼레이션에서 시간이 튀는지 = **범인** |
| **Buffers** | 읽은 블록(논리 I/O) 수 | 성능의 절대 지표. 튜닝 = **Buffers 줄이기** |

> [!TIP]
> **판독 3원칙**
> 1. **E-Rows ≠ A-Rows** (자릿수 차이) → 통계정보/카디널리티 오류를 의심하라.
> 2. **Starts가 크다** → 그 오퍼레이션이 상위 루프에 걸려 반복 실행 중이다(FILTER/NESTED LOOPS 폭발).
> 3. **Buffers·A-Time이 튀는 라인** → 거기가 병목이다. 그 라인부터 튜닝하라.

---

## 1. 서브쿼리 Unnesting과 FILTER 루프의 공포

옵티마이저는 서브쿼리를 보면 본능적으로 메인 쿼리와 합쳐서 조인(Join) 형태로 풀어내려 합니다. 이를 **서브쿼리 Unnesting**이라고 합니다. 조인으로 풀려야 해시 조인이나 소트 머지 조인 등 대용량 처리에 유리한 알고리즘을 탈 수 있기 때문입니다.

> [!CAUTION]
> **장애 사례: "어제까지 잘 돌던 결제 내역 조회가 갑자기 타임아웃 났어요!"**
> - **현상**: 서브쿼리 Unnesting이 모종의 이유로 실패하면서, 실행계획에 `FILTER` 오퍼레이션이 등장했습니다. 메인 테이블(100만 건)을 읽으면서 100만 번 동안 서브쿼리를 반복 실행(루프)하는 대참사가 발생했습니다.

### 쿼리 재작성 (Query Rewrite) 실전

**(Before) Unnesting 실패 → FILTER 루프 발생**

```sql
SELECT /*+ GATHER_PLAN_STATISTICS */ c.cust_nm, c.grade
  FROM t_customer c
 WHERE c.cust_id IN (
       SELECT /*+ NO_UNNEST */ p.cust_id
         FROM t_payment p
        WHERE p.pay_dt LIKE '202310%'
          AND p.amount > 50000
 );
```

```text
------------------------------------------------------------------------------------------------------
| Id | Operation                     | Name         | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------
|  0 | SELECT STATEMENT              |              |      1 |        |     11 |00:02:38.44 |    4103K|
|* 1 |  FILTER                       |              |      1 |        |     11 |00:02:38.44 |    4103K|
|  2 |   TABLE ACCESS FULL           | T_CUSTOMER   |      1 |   1000K|   1000K|00:00:00.31 |    8214 |
|* 3 |   TABLE ACCESS BY INDEX ROWID | T_PAYMENT    |   1000K|      1 |     11 |00:02:37.90 |    4095K|
|* 4 |    INDEX RANGE SCAN           | T_PAYMENT_IX |   1000K|      1 |    980K|00:00:41.22 |    3110K|
------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   1 - filter( IS NOT NULL)
   3 - filter("P"."AMOUNT">50000)
   4 - access("P"."CUST_ID"=:B1 AND "P"."PAY_DT" LIKE '202310%')
```

> 🔍 **어디를 봐야 하나?**
> - `Id 3~4`의 **Starts=1000K** — 메인 고객 100만 건만큼 서브쿼리를 **100만 번 반복** 실행했다는 증거(FILTER 루프의 정체).
> - `Id 4` Predicate의 `:B1` — 바인드 값으로 매번 서브쿼리가 재실행됨을 의미.
> - `Buffers 4103K`, `A-Time 2분 38초` — 논리 I/O 400만 블록. **타임아웃의 직접 원인**.

**(After) UNNEST 힌트로 조인(HASH SEMI) 유도**

```sql
SELECT /*+ GATHER_PLAN_STATISTICS */ c.cust_nm, c.grade
  FROM t_customer c
 WHERE c.cust_id IN (
       SELECT /*+ UNNEST HASH_SJ */ p.cust_id
         FROM t_payment p
        WHERE p.pay_dt LIKE '202310%'
          AND p.amount > 50000
 );
```

```text
--------------------------------------------------------------------------------------------------
| Id | Operation             | Name       | Starts | E-Rows | A-Rows |   A-Time   | Buffers | OMem |
--------------------------------------------------------------------------------------------------
|  0 | SELECT STATEMENT      |            |      1 |        |     11 |00:00:00.48 |   16428 |      |
|* 1 |  HASH JOIN SEMI       |            |      1 |     11 |     11 |00:00:00.48 |   16428 | 1517K|
|* 2 |   TABLE ACCESS FULL   | T_PAYMENT  |      1 |     11 |     11 |00:00:00.16 |    8214 |      |
|  3 |   TABLE ACCESS FULL   | T_CUSTOMER |      1 |   1000K|   1000K|00:00:00.09 |    8214 |      |
--------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   1 - access("C"."CUST_ID"="P"."CUST_ID")
   2 - filter("P"."AMOUNT">50000 AND "P"."PAY_DT" LIKE '202310%')
```

> ✅ **무엇이 달라졌나?**
> - `HASH JOIN SEMI`의 **Starts=1** — 반복이 사라짐. 서브쿼리를 조인으로 한 번에 풀었다.
> - `Buffers 4103K → 16K` (**약 250배 감소**), `A-Time 2분 38초 → 0.48초`.
> - `OMem 1517K` — 해시 영역을 메모리에서만 처리(디스크 안 씀). 2회차 해시 조인의 예고편.

---

## 2. View Merging 실패와 조건절 이행(Transitive Predicate)의 역습

### View Merging 방해꾼들
인라인 뷰 내부에 `GROUP BY`, `DISTINCT`, `ROWNUM`, `UNION` 등이 포함되어 있으면 옵티마이저는 뷰를 병합하지 못하고 별도의 View 블록으로 남겨둡니다 (No Merge). 
뷰가 병합되지 않으면 바깥쪽의 조건절이 안쪽으로 밀고 들어가는 **Predicate Pushing**이 차단되어 풀 스캔이 발생할 수 있습니다.

### 조건절 이행(Transitive Predicate)의 착각
`A.deptno = B.deptno` 이고 `A.deptno = 10` 이면, 옵티마이저는 `B.deptno = 10` 이라는 조건을 자동으로 추가합니다.

> [!WARNING]
> **조건절 이행의 역효과**
> 옵티마이저가 스스로 추가한 조건(`B.deptno = 10`) 때문에 B 테이블의 인덱스 통계가 더 좋아 보인다고 착각하여, 원래 A 테이블부터 읽어야 할 쿼리가 B 테이블부터 읽는 방향으로 **조인 순서가 뒤틀리는 현상**이 빈번하게 발생합니다.

### 뷰 병합과 조인 순서 강제 제어

```sql
-- 대용량 데이터 로드 시 옵티마이저의 개입을 차단하는 기법
SELECT /*+ LEADING(A B) USE_HASH(B) */ 
       A.col1, B.total
  FROM TABLE_A A,
       (SELECT /*+ NO_MERGE */ col1, SUM(col2) as total 
          FROM TABLE_B 
         GROUP BY col1
         -- ROWNUM > 0 을 추가하면 옵티마이저가 뷰를 절대 깨지 못함 (실무 팁)
        ) B
 WHERE A.col1 = B.col1;
```

---

## 3. 🧪 실습 Lab — 실행계획 제어와 모니터링

### Step 1. FILTER 오퍼레이션 눈으로 확인하기
먼저 의도적으로 힌트를 주어 풀스캔 + FILTER 루프 최악의 실행계획을 만들어봅니다.

```sql
ALTER SESSION SET statistics_level = ALL;

SELECT /*+ GATHER_PLAN_STATISTICS */ c.cust_nm
  FROM t_cust c
 WHERE c.cust_id IN (
       SELECT /*+ NO_UNNEST */ p.cust_id
         FROM t_order p
        WHERE p.order_dt = '20231001'
 );

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));
-- [과제] 출력된 실행계획에서 'FILTER' 오퍼레이션과 
-- Starts 컬럼(루프를 돈 횟수)이 메인 쿼리 건수만큼 치솟은 것을 확인하세요.
```

> **이렇게 보이면 정상적으로 재현된 것입니다** (T_ORDER의 order_dt='20231001' 건수만큼 Starts가 치솟음):
> ```text
> --------------------------------------------------------------------------
> | Id | Operation           | Name    | Starts | E-Rows | A-Rows | Buffers |
> --------------------------------------------------------------------------
> |* 1 |  FILTER             |         |      1 |        |      7 |   1204K |
> |  2 |   TABLE ACCESS FULL | T_CUST  |      1 |    500K|    500K|    4107 |
> |* 3 |   TABLE ACCESS FULL | T_ORDER |    500K|      1 |      7 |   1200K |
> --------------------------------------------------------------------------
> ```
> `Id 3`의 **Starts가 T_CUST 건수(500K)와 같다** = FILTER가 500K번 루프를 돌았다는 결정적 증거.

### Step 2. UNNEST와 HASH_SJ로 구원하기
동일한 쿼리를 조인으로 풀리도록 유도하여 Starts 컬럼이 어떻게 변하는지 확인합니다.

```sql
SELECT /*+ GATHER_PLAN_STATISTICS */ c.cust_nm
  FROM t_cust c
 WHERE c.cust_id IN (
       SELECT /*+ UNNEST HASH_SJ */ p.cust_id
         FROM t_order p
        WHERE p.order_dt = '20231001'
 );

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));
-- [과제] HASH JOIN (SEMI) 오퍼레이션으로 변경되고, 
-- A-Time과 Buffers 수치가 획기적으로 줄어든 것을 확인하세요.
```

> **After 플랜 (Starts가 모두 1로 돌아옴 = 루프 소멸):**
> ```text
> ---------------------------------------------------------------------------
> | Id | Operation           | Name    | Starts | E-Rows | A-Rows | Buffers |
> ---------------------------------------------------------------------------
> |* 1 |  HASH JOIN SEMI     |         |      1 |      7 |      7 |    8214 |
> |* 2 |   TABLE ACCESS FULL | T_ORDER |      1 |      7 |      7 |    4107 |
> |  3 |   TABLE ACCESS FULL | T_CUST  |      1 |    500K|    500K|    4107 |
> ---------------------------------------------------------------------------
> ```
> Buffers `1204K → 8K`. **Starts가 1로 바뀌었는지**를 Before/After에서 눈으로 대조하는 것이 이번 실습의 핵심입니다.

---

## 4. 한 장 정리

- 옵티마이저의 가장 중요한 목표 중 하나는 서브쿼리와 뷰를 조인 형태로 풀어내는 것(**Query Transformation**)이다.
- 서브쿼리 **Unnesting**이 실패하고 **FILTER**로 풀리면 대형 타임아웃 장애의 주범이 된다. `UNNEST` 힌트를 기억하자.
- 집계(GROUP BY)나 ROWNUM이 섞인 뷰는 **View Merging**이 실패한다. 이를 역이용해 옵티마이저의 개입을 막는 것이 대용량 배치 튜닝의 핵심이다.
- 조인 순서가 제멋대로 꼬일 때는 통계정보 갱신보다 `LEADING` 힌트로 멱살을 잡고 끌고 가는 것이 가장 빠르고 안전한 장애 조치다.
