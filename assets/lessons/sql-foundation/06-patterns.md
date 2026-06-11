# 세션 6 · 실전 패턴 (→ 튜닝 트랙 연결)

## 1. Top-N & 페이지네이션
```sql
-- 급여 상위 5명 (12c+ 표준)
SELECT emp_name, salary
FROM   employees
ORDER  BY salary DESC
FETCH  FIRST 5 ROWS ONLY;

-- 페이지네이션 (11번째~20번째)
SELECT *
FROM   employees
ORDER  BY emp_id
OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;
```
> 구버전 패턴: `ROWNUM`을 인라인 뷰로 한 번 감싸 정렬 후 잘라야 합니다.
```sql
SELECT * FROM (SELECT e.*, ROWNUM rn FROM (SELECT * FROM employees ORDER BY salary DESC) e)
WHERE rn BETWEEN 1 AND 5;
```

## 2. 피벗 (행 → 열)
```sql
SELECT * FROM (SELECT dept_id, job, salary FROM employees)
PIVOT (SUM(salary) FOR job IN ('SALES' AS 영업, 'IT' AS 전산));
```
또는 조건부 집계로: `SUM(CASE WHEN job='SALES' THEN salary END)`.

## 3. CASE — 분기
```sql
SELECT emp_name,
       CASE WHEN salary >= 7000 THEN 'A'
            WHEN salary >= 4000 THEN 'B'
            ELSE 'C' END AS 등급
FROM   employees;
```

## 4. 실행계획 살짝 보기 (튜닝의 시작)
"이 쿼리가 어떻게 처리되는가"를 보는 도구.
```sql
EXPLAIN PLAN FOR
SELECT * FROM employees WHERE dept_id = 10;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
- `TABLE ACCESS FULL` = 전체 스캔, `INDEX RANGE SCAN` = 인덱스 사용
- 여기서부터는 **DB 튜닝 트랙**에서 깊게 다룹니다.

> ✅ 핵심: Top-N/페이지네이션은 `FETCH FIRST`/`OFFSET`, 분기는 `CASE`. 느리면 실행계획부터 확인 → 튜닝 트랙으로.
