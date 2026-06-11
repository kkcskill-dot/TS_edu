# 세션 1 · SQL 기본 (SELECT / WHERE / ORDER BY)

## 1. SELECT의 구조
SQL은 "무엇을(SELECT) · 어디서(FROM) · 어떤 조건으로(WHERE) · 어떻게 정렬(ORDER BY)" 가져올지 선언합니다.

```sql
SELECT emp_id, emp_name, salary
FROM   employees
WHERE  dept_id = 10
ORDER  BY salary DESC;
```

**논리적 실행 순서**(작성 순서와 다름): `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`
> 그래서 `WHERE`에서는 `SELECT`의 별칭(alias)을 쓸 수 없고, `ORDER BY`에서는 쓸 수 있습니다.

## 2. WHERE 조건
| 종류 | 예시 |
|---|---|
| 비교 | `salary >= 5000`, `dept_id <> 10` |
| 범위 | `salary BETWEEN 3000 AND 5000` |
| 목록 | `dept_id IN (10, 20, 30)` |
| 패턴 | `emp_name LIKE '김%'` (`%`=0+글자, `_`=1글자) |
| 논리 | `AND`, `OR`, `NOT` (AND가 OR보다 우선 → 괄호로 명확히) |

## 3. NULL 다루기
NULL은 "값 없음"이라 **비교 연산으로 잡히지 않습니다.**

```sql
-- 잘못: comm = NULL  (항상 거짓)
WHERE comm IS NULL          -- 올바름
WHERE comm IS NOT NULL
SELECT NVL(comm, 0)         -- NULL이면 0으로 대체
SELECT COALESCE(comm, bonus, 0)  -- 첫 비-NULL 반환
```

## 4. 자주 쓰는 함수
```sql
-- 문자
UPPER('abc'), LOWER('ABC'), SUBSTR('ABCDE',2,3) -- 'BCD'
LENGTH('홍길동')           -- 3
TRIM('  x  '), REPLACE('A-B','-','/')
-- 숫자
ROUND(123.456, 1)  -- 123.5     TRUNC(123.456,1) -- 123.4
MOD(10,3)          -- 1
-- 날짜
SYSDATE, ADD_MONTHS(SYSDATE, 1)
TO_CHAR(SYSDATE,'YYYY-MM-DD'), TO_DATE('2026-06-01','YYYY-MM-DD')
```

## 5. 정렬
```sql
ORDER BY dept_id ASC, salary DESC    -- 다중 정렬
ORDER BY salary DESC NULLS LAST       -- NULL을 뒤로
```

> ✅ 핵심: WHERE는 행을 **걸러내고**, ORDER BY는 결과를 **줄세웁니다**. NULL은 `IS NULL`로만 비교.
