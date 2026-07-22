# 1회차: SQL기본, 플랜기본 + 옵티마이저의 착각과 쿼리 변환 제어

> 💡 **학습 목표**
> 옵티마이저가 쿼리를 어떻게 변환하는지(Query Transformation) 이해하고, 변환이 실패했을 때 벌어지는 실무적인 대참사와 그 우회 기법을 습득합니다.

---

## 1. 서브쿼리 Unnesting과 FILTER 루프의 공포

옵티마이저는 서브쿼리를 보면 본능적으로 메인 쿼리와 합쳐서 조인(Join) 형태로 풀어내려 합니다. 이를 **서브쿼리 Unnesting**이라고 합니다. 조인으로 풀려야 해시 조인이나 소트 머지 조인 등 대용량 처리에 유리한 알고리즘을 탈 수 있기 때문입니다.

> [!CAUTION]
> **장애 사례: "어제까지 잘 돌던 결제 내역 조회가 갑자기 타임아웃 났어요!"**
> - **현상**: 서브쿼리 Unnesting이 모종의 이유로 실패하면서, 실행계획에 `FILTER` 오퍼레이션이 등장했습니다. 메인 테이블(100만 건)을 읽으면서 100만 번 동안 서브쿼리를 반복 실행(루프)하는 대참사가 발생했습니다.

### 쿼리 재작성 (Query Rewrite) 실전

```sql
-- (Before) Unnesting 실패로 인한 FILTER 루프 발생
SELECT c.cust_nm, c.grade
  FROM t_customer c
 WHERE c.cust_id IN (
       SELECT /*+ NO_UNNEST */ p.cust_id
         FROM t_payment p
        WHERE p.pay_dt LIKE '202310%'
          AND p.amount > 50000
 );
-- 실행계획: 
-- FILTER
--   TABLE ACCESS FULL T_CUSTOMER
--   TABLE ACCESS BY INDEX ROWID T_PAYMENT (100만 번 반복)
```

```sql
-- (After) UNNEST 힌트를 통한 조인 유도
SELECT c.cust_nm, c.grade
  FROM t_customer c
 WHERE c.cust_id IN (
       SELECT /*+ UNNEST HASH_SJ */ p.cust_id
         FROM t_payment p
        WHERE p.pay_dt LIKE '202310%'
          AND p.amount > 50000
 );
-- 실행계획:
-- HASH JOIN (SEMI)
--   TABLE ACCESS FULL T_PAYMENT
--   TABLE ACCESS FULL T_CUSTOMER
```

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

---

## 4. 한 장 정리

- 옵티마이저의 가장 중요한 목표 중 하나는 서브쿼리와 뷰를 조인 형태로 풀어내는 것(**Query Transformation**)이다.
- 서브쿼리 **Unnesting**이 실패하고 **FILTER**로 풀리면 대형 타임아웃 장애의 주범이 된다. `UNNEST` 힌트를 기억하자.
- 집계(GROUP BY)나 ROWNUM이 섞인 뷰는 **View Merging**이 실패한다. 이를 역이용해 옵티마이저의 개입을 막는 것이 대용량 배치 튜닝의 핵심이다.
- 조인 순서가 제멋대로 꼬일 때는 통계정보 갱신보다 `LEADING` 힌트로 멱살을 잡고 끌고 가는 것이 가장 빠르고 안전한 장애 조치다.
