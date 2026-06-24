# 실전 문제: SQL 기본

> [!TIP]
> **출제 포인트**
> 2과목 1장 'SQL 기본'에서는 **문자열 함수**, **NULL 함수 처리**, **GROUP BY와 HAVING**, **SQL 실행 순서**가 집중 출제됩니다. 특히 `NULL`이 포함된 집계함수의 동작 방식을 정확히 이해해야 합니다.

---

## 1. SELECT 문의 논리적 실행 순서

### 📝 문제 1
**다음 중 SELECT 구문의 논리적 실행 순서로 올바르게 나열된 것은?**
1. SELECT -> FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY
2. FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY
3. FROM -> SELECT -> WHERE -> GROUP BY -> HAVING -> ORDER BY
4. FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> SELECT

> [!NOTE]
> **정답 및 해설: 2번**
> SQL의 실행 순서는 대상을 가져오고(FROM), 필터링(WHERE), 그룹화(GROUP BY), 그룹필터(HAVING), 조회 컬럼 추출(SELECT), 마지막으로 정렬(ORDER BY)입니다.

---

## 2. 내장 함수 (문자열)

### 📝 문제 2
**아래 SQL의 수행 결과로 올바른 것은?**
```sql
SELECT SUBSTR('abcdefg', 7-3) FROM DUAL;
```
1. cdef
2. defg
3. efg
4. fg

> [!NOTE]
> **정답 및 해설: 2번**
> 7-3은 4입니다. `SUBSTR('abcdefg', 4)`는 4번째 문자 'd'부터 문자열의 끝까지 추출하므로 'defg'를 반환합니다.

---

## 3. NULL 함수와 집계 함수

### 📝 문제 3
**아래 SQL의 수행 결과로 올바른 것은?**
```sql
SELECT NVL(COUNT(*), 9999) FROM TAB1 WHERE 1=2;
```
1. 0
2. 9999
3. 1
4. ERROR

> [!NOTE]
> **정답 및 해설: 1번**
> `COUNT(*)`는 조건에 만족하는 행이 없어도 에러나 NULL이 아닌 **0**을 반환합니다. 값이 0이므로 `NVL` 함수의 두 번째 인자인 9999로 치환되지 않고 그대로 0이 출력됩니다.

### 📝 문제 4
**데이터베이스에서 NOT NULL 조건이 없는 컬럼에 대해 집계 함수를 수행했을 때 처리 방법으로 알맞은 것은?**
1. AVG(컬럼)은 전체 행의 수(NULL 포함)를 분모로 하여 평균을 계산한다.
2. SUM(컬럼) + 10 의 결과는 NULL 값이 있을 경우 에러를 발생시킨다.
3. COUNT(*)와 COUNT(컬럼)은 항상 100% 동일한 결과를 반환한다.
4. AVG(컬럼)은 NULL인 데이터 행을 분모(건수)에서 완전히 제외하고 평균을 계산한다.

> [!NOTE]
> **정답 및 해설: 4번**
> 특정 컬럼명을 명시한 집계함수(AVG, SUM, MAX 등)는 NULL 값을 가진 행을 연산에서 완전히 배제합니다.
