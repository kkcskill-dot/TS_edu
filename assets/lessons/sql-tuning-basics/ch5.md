# 5장. 소트 튜닝

정렬(Sort)은 비싸다. **소트를 없애거나, 줄이거나, 메모리 안에서** 끝내는 게 목표다.

## 5.1 소트 연산의 이해
- 정렬은 **PGA의 Sort Area**에서 수행. 데이터가 크면 디스크(TEMP)로 넘쳐(Disk Sort) 급격히 느려진다.
- 실행계획의 `SORT ORDER BY`, `SORT GROUP BY`, `SORT UNIQUE`, `WINDOW SORT` 가 소트 발생 신호.

## 5.2 소트가 발생하지 않도록 SQL 작성
```sql
-- UNION 은 중복 제거 위해 정렬 → 중복이 없으면 UNION ALL
SELECT ... UNION ALL SELECT ...
-- 존재 여부만 필요하면 DISTINCT/집계 대신 EXISTS
WHERE EXISTS (SELECT 1 FROM ...)
```

## 5.3 인덱스를 이용한 소트 연산 생략
인덱스는 정렬돼 있으므로, **ORDER BY가 인덱스 순서와 일치**하면 `SORT ORDER BY`를 생략한다.
```sql
-- (deptno, sal) 인덱스 → 정렬 없이 순서대로
SELECT * FROM emp WHERE deptno = 10 ORDER BY sal;
```
- **Top-N 쿼리**: `ORDER BY ... FETCH FIRST n` 도 인덱스로 앞부분만 읽어 소트 생략.
- **최소/최대값**: `MIN/MAX`는 인덱스 양 끝만 보면 됨(`INDEX FULL SCAN (MIN/MAX)`).
- **이력 조회**: `(키, 일자 DESC)` 인덱스로 최신 1건을 소트 없이.
- **Sort Group By 생략**: 인덱스 순서로 그룹핑되면 정렬 생략.

## 5.4 Sort Area를 적게 사용하도록
정렬이 불가피하면 **정렬 대상 데이터량을 줄인다.**
```sql
-- 필요한 컬럼만, 필터를 먼저 → 정렬 입력 최소화
-- Top-N 은 전체 정렬이 아니라 'n개 유지' 방식이라 소트 부하가 작다
SELECT * FROM (SELECT ... ORDER BY x) WHERE ROWNUM <= 10;  -- Top-N
```
- Top-N이 **아닌** 전체 정렬은 부하가 크다.
- **분석함수**의 `ROW_NUMBER() OVER(ORDER BY ...) <= n` 도 Top-N 소트로 최적화 가능.

> ✅ **5장 핵심**: 최고의 소트 튜닝은 **소트를 안 하는 것**(인덱스로 생략·UNION ALL). 불가피하면 입력량을 줄이고 Top-N으로. (실습: **소트 튜닝 실습** 🆕 · 실행 계획 시각화 ♻️)
