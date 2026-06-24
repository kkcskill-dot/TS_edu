# 실전 문제: SQL 활용

> [!TIP]
> **출제 포인트**
> 2과목 2장 'SQL 활용'에서는 난이도가 높은 **조인(Join)**, **서브쿼리**, **윈도우 함수**, **집합 연산자**, **계층형 질의**가 출제됩니다. 합격을 가르는 핵심 단원입니다.

---

## 1. 조인 (JOIN)

### 📝 문제 1
**부서 테이블(DEPT)에는 있으나 사원 테이블(EMP)에는 소속된 사원이 단 한 명도 없는 빈 부서를 포함하여 모든 부서 정보를 출력하고자 할 때, 가장 적절한 조인 기법은?**
1. INNER JOIN
2. CROSS JOIN
3. RIGHT OUTER JOIN (사원 RIGHT OUTER JOIN 부서)
4. NATURAL JOIN

> [!NOTE]
> **정답 및 해설: 3번**
> 조건에 만족하지 않더라도 한쪽 테이블의 데이터를 모두 출력해야 할 때는 OUTER JOIN을 사용합니다. 부서(우측) 데이터를 모두 살려야 하므로 RIGHT OUTER JOIN이 적절합니다.

---

## 2. 윈도우 함수 (Window Function)

### 📝 문제 2
**윈도우 순위 함수 중 중복 순위가 존재해도 다음 순위 값을 건너뛰지 않고 빽빽하게 순차적으로 부여하는 함수는?**
1. RANK()
2. ROW_NUMBER()
3. PERCENT_RANK()
4. DENSE_RANK()

> [!NOTE]
> **정답 및 해설: 4번**
> 동점자가 2명일 때 `RANK()`는 1, 1, 3으로 2를 건너뛰지만, `DENSE_RANK()`는 1, 1, 2와 같이 다음 순위를 건너뛰지 않고 빽빽하게(Dense) 순위를 매깁니다.

---

## 3. 서브쿼리 (Subquery)

### 📝 문제 3
**다중 컬럼/다중 행 서브쿼리 문법 중 에러가 발생하는 구문을 고르시오.**
1. WHERE (A, B) IN (SELECT A, B FROM ...)
2. WHERE A >= (SELECT MAX(A) FROM ... GROUP BY B)
3. WHERE EXISTS (SELECT 1 FROM ...)
4. WHERE A > ALL (SELECT A FROM ...)

> [!NOTE]
> **정답 및 해설: 2번**
> 서브쿼리에 `GROUP BY`가 포함되어 있으면 결과가 여러 행(Multi-Row)으로 반환될 수 있습니다. 이를 단일행 비교 연산자(`>=`, `=`)와 함께 사용하면 'single-row subquery returns more than one row' 에러가 발생합니다. `IN`, `ANY`, `ALL` 등의 다중행 연산자를 사용해야 합니다.

---

## 4. 집합 연산자

### 📝 문제 4
**집합 연산자에 대한 설명으로 가장 적절한 것은?**
1. UNION ALL 은 두 집합의 중복을 제거하기 위해 내부적으로 정렬(SORT) 작업을 수행한다.
2. UNION 은 상호 배타적인 조건일 때 주로 사용되며 두 집합을 그대로 합친다.
3. INTERSECT 는 두 결과 집합의 합집합을 구한다.
4. UNION 은 두 결과 집합의 합집합이며 중복된 행은 하나의 행으로 취급하여 제거한다.

> [!NOTE]
> **정답 및 해설: 4번**
> `UNION`은 중복을 제거하기 위해 정렬을 수행하며, `UNION ALL`은 정렬 없이 단순히 두 결과를 이어 붙이므로 성능상 훨씬 유리합니다.
