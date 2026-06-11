# 세션 2 · 집계 & 그룹화 (GROUP BY / HAVING)

## 1. 집계 함수
여러 행을 **하나의 값으로** 요약합니다.

```sql
SELECT COUNT(*)      AS 전체행수,
       COUNT(comm)   AS 커미션있는행,   -- NULL 제외!
       SUM(salary)   AS 급여합,
       AVG(salary)   AS 평균,
       MIN(salary), MAX(salary)
FROM   employees;
```

> ⚠️ `COUNT(*)`는 NULL 포함 전체 행, `COUNT(컬럼)`은 **그 컬럼이 NULL이 아닌 행**만 셉니다. `AVG`도 NULL을 제외하고 평균냅니다.

## 2. GROUP BY — 그룹별 집계
```sql
SELECT dept_id, COUNT(*) AS 인원, ROUND(AVG(salary)) AS 평균급여
FROM   employees
GROUP  BY dept_id
ORDER  BY 평균급여 DESC;
```

**규칙**: `SELECT`에 온 컬럼 중 집계함수가 아닌 것은 **모두 `GROUP BY`에 있어야** 합니다.
```sql
-- 오류: dept_id 가 GROUP BY 에 없음
SELECT dept_id, AVG(salary) FROM employees;   -- ORA-00937
```

## 3. WHERE vs HAVING
| | 시점 | 대상 |
|---|---|---|
| `WHERE` | 그룹화 **전** | 개별 행 |
| `HAVING` | 그룹화 **후** | 그룹(집계 결과) |

```sql
SELECT dept_id, AVG(salary) avg_sal
FROM   employees
WHERE  job <> 'INTERN'        -- 행 필터 (그룹화 전)
GROUP  BY dept_id
HAVING AVG(salary) >= 5000;   -- 그룹 필터 (집계 결과)
```

## 4. 다중 컬럼 그룹 & 조건부 집계
```sql
SELECT dept_id, job, COUNT(*)
FROM   employees
GROUP  BY dept_id, job;

-- 조건부 집계 (피벗의 기초)
SELECT dept_id,
       COUNT(CASE WHEN salary >= 5000 THEN 1 END) AS 고액자,
       COUNT(CASE WHEN salary <  5000 THEN 1 END) AS 일반
FROM   employees
GROUP  BY dept_id;
```

> ✅ 핵심: 행 필터=WHERE, 그룹 필터=HAVING. 집계 아닌 SELECT 컬럼은 GROUP BY에 필수.
