# 개발자들이 흔히 하는 20가지 SQL 실수와 튜닝 팁

개발 과정에서 무심코 작성한 SQL이 운영 환경에서 심각한 성능 저하를 일으키는 경우가 많습니다. 본 문서에서는 실무에서 자주 발견되는 <strong>20가지 대표적인 SQL 안티패턴(실수)</strong>과 이를 올바르게 개선하는 튜닝 팁을 난이도별(초/중/고급)로 분류하여 소개합니다.

---

# 초급 (Beginner): 기본 문법 및 흔한 실수
초급 단계에서는 가장 흔하게 발생하면서도 기본기만 지키면 쉽게 예방할 수 있는 실수들을 다룹니다.

## 1. 불필요한 `SELECT *` 사용
`SELECT *`를 사용하면 현재 필요 없는 컬럼까지 모두 디스크에서 읽어와야 하므로 I/O 부하가 커지며, 애플리케이션 서버로 전송하는 네트워크 트래픽도 낭비됩니다.

<strong>As-Is</strong>
```sql
-- 화면에는 사원이름만 필요한데 전체 컬럼 조회
SELECT * 
FROM EMPLOYEES 
WHERE DEPT_NO = 'D01';
```

<strong>To-Be</strong>
```sql
-- 필요한 컬럼만 명시하여 I/O와 메모리 낭비 방지
SELECT EMP_NO, EMP_NAME 
FROM EMPLOYEES 
WHERE DEPT_NO = 'D01';
```

---

## 2. 습관적인 `DISTINCT` 및 불필요한 `ORDER BY` 사용
`DISTINCT`와 `ORDER BY`는 데이터를 디스크나 메모리(Temp 영역)로 내려서 정렬(Sort)하는 무거운 연산을 수반합니다. 비즈니스 로직상 꼭 필요하지 않은데도 안전을 위해 무작정 추가하면 심각한 성능 저하를 초래합니다.

<strong>As-Is</strong>
```sql
-- PK 컬럼이라 중복이 없는데도 DISTINCT 사용
SELECT DISTINCT EMP_NO, EMP_NAME 
FROM EMPLOYEES 
WHERE DEPT_NO = 'D01'
ORDER BY EMP_NAME; -- 화면에 뿌릴 때 순서가 상관없음에도 정렬 수행
```

<strong>To-Be</strong>
```sql
-- 불필요한 DISTINCT와 ORDER BY 제거
SELECT EMP_NO, EMP_NAME 
FROM EMPLOYEES 
WHERE DEPT_NO = 'D01';
```

---

## 3. 루프(Loop) 내 잦은 커밋 (Commit inside a loop)
애플리케이션(Java 등)이나 PL/SQL에서 대량의 데이터를 UPDATE/INSERT 할 때, 건마다 커밋을 반복하면 트랜잭션 오버헤드, LGWR 부하, 그리고 `ORA-01555 (Snapshot too old)` 오류를 유발합니다.

<strong>As-Is (건별 커밋)</strong>
```java
for (Employee emp : empList) {
    updateSalary(emp); // 내부에서 실행 후 바로 COMMIT
}
```

<strong>To-Be (일괄 커밋 또는 배치 처리)</strong>
```java
for (Employee emp : empList) {
    updateSalary(emp); // 커밋 없이 수행
}
commit(); // 루프 종료 후 한 번에 커밋 (또는 1,000건 단위 주기적 커밋)
```

---

## 4. 조인 조건(Join Condition) 누락에 의한 카티전 곱(Cartesian Product)
FROM 절에 테이블을 여러 개 나열하고 WHERE 절에 조인 조건을 누락하면, 두 테이블의 모든 행이 상호 곱해지는 카티전 곱(Cartesian Product) 연산이 발생합니다. 1,000건짜리 테이블 두 개만 조인 조건이 빠져도 100만 건이 생성되어 DB 서버가 마비될 수 있습니다.

<strong>As-Is (조인 조건 누락)</strong>
```sql
-- EMPLOYEES와 DEPARTMENTS를 연결하는 조건(DEPT_NO) 누락
SELECT E.EMP_NAME, D.DEPT_NAME
FROM EMPLOYEES E, DEPARTMENTS D
WHERE E.SALARY > 5000;
```

<strong>To-Be (명확한 조인 조건 명시)</strong>
```sql
SELECT E.EMP_NAME, D.DEPT_NAME
FROM EMPLOYEES E
INNER JOIN DEPARTMENTS D ON E.DEPT_NO = D.DEPT_NO
WHERE E.SALARY > 5000;
```

---

## 5. `UNION` vs `UNION ALL` 오남용
두 개 이상의 쿼리 결과를 합칠 때, `UNION`은 전체 데이터를 모은 뒤 중복을 제거하기 위해 정렬(Sort Unique) 연산을 수행하므로 시스템 부하가 매우 큽니다. 중복 데이터가 없거나 중복되어도 상관없는 경우에는 반드시 `UNION ALL`을 사용해야 합니다.

<strong>As-Is (불필요한 중복 제거 연산 발생)</strong>
```sql
-- 2025년 데이터와 2026년 데이터는 겹치지 않음에도 UNION 사용
SELECT * FROM SALES_2025
UNION
SELECT * FROM SALES_2026;
```

<strong>To-Be (단순 집합 결합)</strong>
```sql
SELECT * FROM SALES_2025
UNION ALL
SELECT * FROM SALES_2026;
```

---

## 6. `LIKE` 검색 시 와일드카드(`%`)를 앞에 두는 실수
인덱스는 전화번호부처럼 앞 글자부터 정렬되어 있습니다. `LIKE` 검색 시 조건값 앞에 `%`를 붙이면 시작 단어를 알 수 없으므로 인덱스를 타지 못하고 테이블 풀 스캔이 발생합니다.

<strong>As-Is (인덱스 레인지 스캔 불가)</strong>
```sql
-- 이름이 '홍길동'으로 끝나는 사람 검색 (풀 스캔)
SELECT * 
FROM EMPLOYEES 
WHERE EMP_NAME LIKE '%홍길동';
```

<strong>To-Be (인덱스 활용 가능)</strong>
```sql
-- 이름이 '홍'으로 시작하는 사람 검색 (인덱스 스캔 가능)
SELECT * 
FROM EMPLOYEES 
WHERE EMP_NAME LIKE '홍%';
```
*(참고: 뒷부분 일치 검색이 빈번하다면 Reverse Index나 Full Text Search 도입을 고려해야 합니다.)*

---

## 7. 커밋/롤백 누락 (Dangling Transactions)
애플리케이션 코드 내에서 예외(Exception)가 발생하여 비즈니스 로직이 중단되었을 때, `catch` 구문에서 DB 커넥션을 반환하기 전 `ROLLBACK`이나 `COMMIT`을 잊어버리면, 해당 트랜잭션이 물고 있던 행 락(Row Lock)이 풀리지 않아 후행 트랜잭션들이 줄줄이 대기(Hang) 상태에 빠집니다.

<strong>As-Is (트랜잭션 미아 방치)</strong>
```java
try {
    updateA();
    updateB(); // 여기서 에러 발생!
    commit();
} catch (Exception e) {
    log.error(e);
    // ROLLBACK 처리 누락! Lock이 계속 유지됨
}
```

<strong>To-Be (명시적인 자원 및 트랜잭션 반환)</strong>
```java
try {
    updateA();
    updateB();
    commit();
} catch (Exception e) {
    log.error(e);
    rollback(); // 에러 발생 시 즉시 롤백하여 락 해제
} finally {
    closeConnection();
}
```

---

# 중급 (Intermediate): 조인, 인덱스 기초, 함수
중급 단계에서는 데이터 타입, NULL 처리, 조인 방식, 그리고 옵티마이저가 인덱스를 타지 못하게 만드는 쿼리 작성 습관들을 짚어봅니다.

## 8. 인덱스 컬럼 가공 (Function on Indexed Column)
인덱스가 생성된 컬럼을 조건절에서 SQL 함수나 연산자로 가공하면, DB는 인덱스를 정상적으로 타지 못하고 테이블 풀 스캔(Table Full Scan)을 수행하게 됩니다.

<strong>As-Is (인덱스 사용 불가)</strong>
```sql
-- REG_DATE 컬럼에 인덱스가 있음에도 인덱스를 타지 못함
SELECT * 
FROM EMPLOYEES 
WHERE TO_CHAR(REG_DATE, 'YYYYMMDD') = '20260720';
```

<strong>To-Be (인덱스 정상 스캔)</strong>
```sql
-- 가공 대상 컬럼을 그대로 두고 우변 값을 가공하여 비교
SELECT * 
FROM EMPLOYEES 
WHERE REG_DATE >= TO_DATE('20260720', 'YYYYMMDD')
  AND REG_DATE <  TO_DATE('20260721', 'YYYYMMDD');
```

---

## 9. 암시적 형변환 (Implicit Data Type Conversion)
비교 대상 컬럼과 상수의 데이터 타입이 다를 경우, 옵티마이저가 내부적으로 데이터 타입을 변환합니다. 이때 인덱스 컬럼의 타입이 변환되면 인덱스 스캔을 할 수 없습니다.

<strong>As-Is (암시적 형변환 발생)</strong>
```sql
-- EMP_NO는 VARCHAR2 타입인데, 숫자형(Number)으로 비교
SELECT * 
FROM EMPLOYEES 
WHERE EMP_NO = 1004; 
-- 내부적으로 TO_NUMBER(EMP_NO) = 1004 로 변환됨
```

<strong>To-Be (명시적 타입 일치)</strong>
```sql
-- 컬럼의 타입에 맞춰 상수값을 문자열로 감싸서 비교
SELECT * 
FROM EMPLOYEES 
WHERE EMP_NO = '1004';
```

---

## 10. `NOT IN` 연산자 사용 시 NULL 처리 누락
`NOT IN` 서브쿼리 내에 `NULL` 값이 단 하나라도 포함되어 있으면, 메인 쿼리는 항상 결과가 0건으로 리턴되는 심각한 논리적 오류(버그)를 발생시킬 수 있으며 성능에도 악영향을 줍니다.

<strong>As-Is (논리 오류 발생 위험)</strong>
```sql
-- MANAGER_ID 중 NULL이 존재하면 아무 데이터도 조회되지 않음
SELECT * 
FROM EMPLOYEES
WHERE EMP_NO NOT IN (SELECT MANAGER_ID FROM DEPARTMENTS);
```

<strong>To-Be (IS NOT NULL 명시 또는 NOT EXISTS 활용)</strong>
```sql
-- IS NOT NULL 구문을 통해 NULL 값을 배제
SELECT * 
FROM EMPLOYEES
WHERE EMP_NO NOT IN (SELECT MANAGER_ID FROM DEPARTMENTS WHERE MANAGER_ID IS NOT NULL);

-- 또는 NOT EXISTS 구문을 사용하는 것이 더 안전하고 빠름
SELECT * 
FROM EMPLOYEES E
WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTMENTS D WHERE D.MANAGER_ID = E.EMP_NO
);
```

---

## 11. 과도하거나 불필요한 `OUTER JOIN` 남발
두 테이블 간의 관계상 매칭되는 데이터가 반드시 존재하거나(예: 자식 테이블에서 부모 테이블 조인), 조건절에 의해 `INNER JOIN`으로 동작할 수밖에 없는 상황임에도 무조건 `LEFT OUTER JOIN`을 사용하는 습관입니다. 이는 옵티마이저의 조인 순서(Driving Table) 선택의 자유도를 박탈하여 비효율적인 실행계획을 유발합니다.

<strong>As-Is (무분별한 OUTER JOIN)</strong>
```sql
-- 부서번호가 반드시 존재하는 사원임에도 LEFT JOIN 사용
SELECT E.EMP_NAME, D.DEPT_NAME
FROM EMPLOYEES E
LEFT OUTER JOIN DEPARTMENTS D ON E.DEPT_NO = D.DEPT_NO
WHERE D.DEPT_NAME = 'SALES'; -- 이 조건 때문에 OUTER JOIN의 의미가 상실됨
```

<strong>To-Be (INNER JOIN으로 변경)</strong>
```sql
SELECT E.EMP_NAME, D.DEPT_NAME
FROM EMPLOYEES E
INNER JOIN DEPARTMENTS D ON E.DEPT_NO = D.DEPT_NO
WHERE D.DEPT_NAME = 'SALES';
```

---

## 12. `IN` 조건에 너무 많은 값 할당 (Huge IN Lists)
`WHERE COL IN (1, 2, ... , 1000)` 형식으로 수백~수천 개의 값을 나열하면, 쿼리 파싱 시간이 기하급수적으로 늘어나고 메모리 초과(Shared Pool) 문제나 최대 길이 제한(Oracle의 경우 1000개) 오류가 발생합니다.

<strong>As-Is (하드 파싱 부하 및 길이 제한 오류)</strong>
```sql
SELECT * 
FROM EMPLOYEES 
WHERE EMP_NO IN (1001, 1002, 1003, ... /* 1000개 이상 나열 */);
```

<strong>To-Be (조인 또는 임시 테이블 활용)</strong>
```sql
-- 대상 번호들을 임시 테이블(또는 GTT)에 INSERT 한 뒤 JOIN으로 처리
SELECT E.* 
FROM EMPLOYEES E
INNER JOIN TARGET_EMP_TEMP T ON E.EMP_NO = T.EMP_NO;
```

---

## 13. `GROUP BY` 절에 불필요한 텍스트 컬럼 남발
그룹핑할 필요가 없는 장문의 설명 컬럼이나 다수의 컬럼을 `GROUP BY`에 무의미하게 포함시키면, 해시 연산 공간 및 정렬 부하가 크게 증가합니다.

<strong>As-Is (불필요한 컬럼까지 해시/정렬 연산)</strong>
```sql
SELECT DEPT_NO, DEPT_NAME, DEPT_DESC, COUNT(*)
FROM DEPARTMENTS
GROUP BY DEPT_NO, DEPT_NAME, DEPT_DESC; -- DEPT_DESC(긴 텍스트)까지 포함됨
```

<strong>To-Be (조인을 통한 최소화)</strong>
```sql
-- 식별자(DEPT_NO)로만 그룹핑한 후 나중에 필요한 텍스트를 조인해서 가져옴
SELECT D.DEPT_NO, D.DEPT_NAME, D.DEPT_DESC, G.EMP_COUNT
FROM DEPARTMENTS D
INNER JOIN (
    SELECT DEPT_NO, COUNT(*) AS EMP_COUNT
    FROM EMPLOYEES
    GROUP BY DEPT_NO
) G ON D.DEPT_NO = G.DEPT_NO;
```

---

## 14. `NVL` / `COALESCE` 오용에 의한 인덱스 무력화
조회 조건을 작성할 때 NULL 데이터를 특정 값으로 치환하여 비교하려고 `NVL`이나 `ISNULL` 함수를 사용하면(8번 항목과 동일한 원리로) 인덱스 컬럼이 가공되어 인덱스를 무력화시킵니다.

<strong>As-Is (가공으로 인한 스캔 불가)</strong>
```sql
-- STATUS 컬럼에 인덱스가 있어도 사용 불가
SELECT * 
FROM ORDERS
WHERE NVL(STATUS, 'N') = 'Y';
```

<strong>To-Be (조건 분리 또는 디폴트 값 활용)</strong>
```sql
-- 인덱스를 그대로 활용하도록 조건 변경
SELECT * 
FROM ORDERS
WHERE STATUS = 'Y';
-- (애초에 테이블 설계 시 STATUS 컬럼에 DEFAULT 'N' NOT NULL 제약을 거는 것이 최선입니다.)
```

---

# 고급 (Advanced): 아키텍처, 힌트, 옵티마이저
고급 단계에서는 데이터베이스 내부 아키텍처나 옵티마이저의 동작 원리를 이해하지 못해 겪게 되는 성능 저하와 튜닝 포인트를 다룹니다.

## 15. 잘못된 페이징(Paging) 처리 기법
게시판이나 목록 조회 시 인라인 뷰(Inline View) 구조를 잘못 짜면, 조건에 맞는 데이터 수만건을 전부 정렬(Sort)한 뒤에 10건만 잘라내는 최악의 성능을 보입니다.

<strong>As-Is (전체 데이터 정렬 후 ROWNUM 체크)</strong>
```sql
-- ORDER BY 보다 ROWNUM < 10 조건이 먼저 적용되어 원하지 않는 데이터가 조회될 수 있음
SELECT *
FROM BOARD
WHERE ROWNUM <= 10
ORDER BY REG_DATE DESC;
```

<strong>To-Be (올바른 인라인 뷰 사용 및 부분범위 처리 유도)</strong>
```sql
-- 정렬을 먼저 수행한 뒤, 인라인 뷰 밖에서 ROWNUM을 자름
SELECT *
FROM (
    SELECT TITLE, REG_DATE
    FROM BOARD
    ORDER BY REG_DATE DESC
)
WHERE ROWNUM <= 10;
```

---

## 16. 스칼라 서브쿼리(Scalar Subquery) 오남용
SELECT 절 안에서 괄호로 묶여서 단일 값만 반환하는 스칼라 서브쿼리는 매우 편리하지만, 조회되는 메인 건수만큼 반복해서 쿼리가 수행(함수처럼 동작)되므로 대량 조회 시 CPU를 엄청나게 소모합니다.

<strong>As-Is (대량 건수에 스칼라 서브쿼리 사용)</strong>
```sql
-- 사원 수가 100만 명이라면 부서명을 찾기 위해 100만 번의 서브쿼리 수행 발생
SELECT E.EMP_NAME,
       (SELECT D.DEPT_NAME FROM DEPARTMENTS D WHERE D.DEPT_NO = E.DEPT_NO) AS DEPT_NAME
FROM EMPLOYEES E;
```

<strong>To-Be (일반 조인으로 변경)</strong>
```sql
-- 조인을 사용하여 한 번의 해시 조인 등으로 대량 처리를 최적화
SELECT E.EMP_NAME, D.DEPT_NAME
FROM EMPLOYEES E
LEFT OUTER JOIN DEPARTMENTS D ON E.DEPT_NO = D.DEPT_NO;
```

---

## 17. 과도하거나 잘못된 인덱스 힌트(Hint) 방치
`/*+ INDEX(...) */` 힌트는 옵티마이저의 선택을 강제합니다. 과거에는 A 인덱스를 타는 것이 최적이었으나 시간이 흘러 데이터 양과 분포가 달라졌음에도 힌트가 방치되어 더 좋은 실행계획(예: 풀 스캔이나 해시 조인이 유리한 상황)을 막아버리는 실수가 잦습니다.

<strong>As-Is (악성 힌트 방치)</strong>
```sql
-- 전체 데이터의 80%를 조회하는데도 힌트 때문에 인덱스를 강제 스캔하여 I/O 폭발
SELECT /*+ INDEX(E EMP_DEPT_IDX) */ * 
FROM EMPLOYEES E
WHERE DEPT_NO = 'D01';
```

<strong>To-Be (힌트 제거 또는 유연한 통계정보 활용)</strong>
```sql
-- 옵티마이저가 통계정보를 바탕으로 최적의 경로를 선택하도록 힌트 제거
SELECT * 
FROM EMPLOYEES 
WHERE DEPT_NO = 'D01';
```

---

## 18. Sequence Cache 미사용으로 인한 딕셔너리 락
시퀀스(Sequence) 생성 시 `NOCACHE`로 설정하면, 번호를 하나 딸 때마다 딕셔너리 테이블을 업데이트하고 커밋해야 하므로 대량의 데이터가 동시 INSERT 될 때 극심한 성능 저하(Row Cache Enqueue)가 발생합니다.

<strong>As-Is (성능 병목 유발)</strong>
```sql
CREATE SEQUENCE ORDER_SEQ
START WITH 1 INCREMENT BY 1 NOCACHE;
```

<strong>To-Be (적절한 캐시 크기 설정)</strong>
```sql
-- 메모리에 1000개의 번호를 미리 올려두어 채번 속도 극대화
CREATE SEQUENCE ORDER_SEQ
START WITH 1 INCREMENT BY 1 CACHE 1000;
```
*(참고: RAC 환경에서는 `ORDER` 옵션 사용에 주의가 필요합니다.)*

---

## 19. 과도한 뷰(View) 중첩 연산 (Nested Views)
뷰 내부에 뷰를 호출하고 그 뷰가 또 다른 뷰를 호출하는 등 복잡하게 얽히면, 옵티마이저가 쿼리 변환(View Merging)을 포기하게 되어 인덱스를 제대로 타지 못하고 무거운 풀 스캔 조인을 수행하게 됩니다.

<strong>As-Is (중첩 뷰 남발)</strong>
```sql
SELECT * 
FROM V_SALES_REPORT_LEVEL3 -- 내부적으로 LEVEL2, LEVEL1 뷰를 복잡하게 조인함
WHERE REG_DATE = '20260720';
```

<strong>To-Be (쿼리 평탄화 - Flattening)</strong>
뷰를 재사용하기 위해 억지로 끼워 맞추기보다, 성능이 중요한 쿼리는 뷰를 벗겨내고(Unnesting) 직접 필요한 베이스 테이블들만 명시하여 최적화된 SQL을 작성해야 합니다.

---

## 20. 데이터 보관주기 없는 무한 로그 테이블 조회
애플리케이션 로그나 접속 이력 등 무한히 쌓이는 데이터를 파티셔닝(Partitioning)이나 주기적인 아카이빙(삭제/이관) 없이 방치하면, 테이블 크기가 기하급수적으로 커져 단순 조회조차 시스템 리소스를 모두 고갈시킵니다.

<strong>As-Is</strong>
단일 테이블에 수억 건의 로그가 10년 치 쌓여 있고, 화면에서는 "최근 1주일" 데이터를 인덱스 레인지 스캔으로 조회하려 하지만 데이터 파편화와 클러스터링 팩터 악화로 점점 느려짐.

<strong>To-Be</strong>
- <strong>파티셔닝(Partitioning):</strong> 월별/일별로 테이블을 분할(Range Partition)하여 오래된 파티션만 쉽게 Drop
- <strong>아카이빙(Archiving):</strong> 3개월이 지난 데이터는 백업용 아카이브 테이블로 옮기고 메인 테이블에서 삭제 (주기적 Job 구성)
