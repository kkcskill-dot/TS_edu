# 세션 3 · 조인 & 집합 연산

## 1. 조인의 개념
여러 테이블을 **연결 조건(보통 PK=FK)** 으로 묶어 한 결과로 만듭니다.

```sql
SELECT e.emp_name, d.dept_name
FROM   employees e
JOIN   departments d ON e.dept_id = d.dept_id;   -- ANSI 표준
```

## 2. 조인 종류
| 종류 | 의미 |
|---|---|
| `INNER JOIN` | 양쪽에 **다 있는** 행만 |
| `LEFT [OUTER] JOIN` | 왼쪽 전부 + 매칭되는 오른쪽(없으면 NULL) |
| `RIGHT JOIN` | 오른쪽 전부 + 매칭되는 왼쪽 |
| `FULL JOIN` | 양쪽 전부 |
| `CROSS JOIN` | 카티전 곱(모든 조합) |

```sql
-- 부서가 없는 직원도 보고 싶다 → LEFT
SELECT e.emp_name, d.dept_name
FROM   employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id;
```

> ⚠️ OUTER 조인에서 **NULL 매칭 행 수**에 주의: LEFT면 왼쪽 행은 절대 사라지지 않습니다.

## 3. SELF JOIN — 같은 테이블끼리
```sql
-- 직원과 그 관리자(같은 employees)
SELECT e.emp_name AS 사원, m.emp_name AS 관리자
FROM   employees e
LEFT JOIN employees m ON e.mgr_id = m.emp_id;
```

## 4. 집합 연산
세로로(행) 합치기. **컬럼 개수·타입이 같아야** 합니다.

| 연산 | 의미 |
|---|---|
| `UNION` | 합집합(중복 제거, 정렬 비용) |
| `UNION ALL` | 합집합(중복 유지, 빠름) |
| `INTERSECT` | 교집합 |
| `MINUS` | 차집합 |

```sql
SELECT emp_id FROM employees_2024
UNION ALL
SELECT emp_id FROM employees_2025;   -- 단순 누적은 ALL 권장
```

> ✅ 핵심: 조인=가로 결합(조건 매칭), 집합=세로 결합(컬럼 구조 일치). 중복 제거가 불필요하면 `UNION ALL`.
