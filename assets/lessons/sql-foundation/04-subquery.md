# 세션 4 · 서브쿼리 & 분석 함수

## 1. 서브쿼리 위치별 분류
```sql
-- ① 스칼라 서브쿼리 (SELECT 절, 1행1열 반환)
SELECT e.emp_name,
       (SELECT d.dept_name FROM departments d
        WHERE d.dept_id = e.dept_id) AS 부서
FROM   employees e;

-- ② 인라인 뷰 (FROM 절, 테이블처럼)
SELECT *
FROM  (SELECT dept_id, AVG(salary) avg_sal
       FROM employees GROUP BY dept_id) v
WHERE v.avg_sal >= 5000;

-- ③ 중첩/상관 서브쿼리 (WHERE 절)
SELECT * FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees);          -- 비상관
```

## 2. 비상관 vs 상관 서브쿼리
- **비상관**: 서브쿼리가 혼자 실행됨(한 번).
- **상관(correlated)**: 바깥 행을 참조 → 행마다 반복 실행(성능 주의).

```sql
-- 상관: 부서 평균보다 많이 받는 사람
SELECT * FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees x
                WHERE x.dept_id = e.dept_id);   -- e.dept_id 참조
```

## 3. EXISTS / IN
```sql
SELECT * FROM departments d
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id);
```
> NULL이 포함될 수 있는 컬럼엔 `NOT IN`보다 `NOT EXISTS`가 안전합니다(`NOT IN`은 NULL이 섞이면 결과가 비어버림).

## 4. 분석(윈도우) 함수 — 그룹을 유지한 채 계산
집계와 달리 **행을 줄이지 않고** 각 행 옆에 계산값을 붙입니다.

```sql
SELECT emp_name, dept_id, salary,
       RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC) AS 부서내순위,
       SUM(salary)  OVER (PARTITION BY dept_id) AS 부서급여합,
       salary - AVG(salary) OVER (PARTITION BY dept_id) AS 평균차
FROM   employees;
```
- `PARTITION BY` = 그룹, `ORDER BY` = 그룹 내 순서
- 순위: `RANK`(동순위 후 건너뜀) · `DENSE_RANK`(안 건너뜀) · `ROW_NUMBER`(유일 번호)

> ✅ 핵심: 인라인 뷰로 단계를 쪼개고, "순위/누적/그룹대비" 계산은 분석 함수로.
