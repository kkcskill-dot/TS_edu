# 부록. SQL 분석 도구

튜닝은 **측정**에서 시작한다. 실행계획과 실측 지표를 확인하는 도구들.

## 1. 실행계획 확인 (EXPLAIN PLAN)
```sql
EXPLAIN PLAN FOR SELECT * FROM emp WHERE deptno = 10;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
> 주의: EXPLAIN PLAN은 **예상** 계획이라 실제 실행과 다를 수 있다(바인드 타입 등).

## 2. AutoTrace (SQL*Plus)
```sql
SET AUTOTRACE ON
SELECT ...;   -- 실행 + 계획 + 통계(논리/물리 읽기 등) 한 번에
```

## 3. SQL 트레이스 (10046) + TKPROF
실제 실행을 추적해 **Parse/Execute/Fetch**별 횟수·CPU·elapsed·논리/물리 I/O를 본다.
```sql
ALTER SESSION SET SQL_TRACE = TRUE;   -- 또는 DBMS_MONITOR
-- 생성된 trace 파일을 TKPROF로 정리
-- $ tkprof ora_1234.trc out.txt
```
> 진단의 정석: `Parse count ≈ Execute`면 하드파싱, `query ≫ rows`면 비효율 스캔, `Fetch ≈ rows`면 배열 페치 미사용. (실습: SQL Trace / TKPROF ♻️)

## 4. DBMS_XPLAN 패키지 (실측 A-Rows)
```sql
SELECT /*+ GATHER_PLAN_STATISTICS */ ... ;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(format=>'ALLSTATS LAST'));
```
- **E-Rows(예상) vs A-Rows(실측)** 비교로 카디널리티 오류를 잡는다.
- `format=>'+ADAPTIVE'`로 적응형 플랜(비활성 라인 `-`) 확인.

## 5. 실시간 SQL 모니터링
장시간/병렬 SQL의 실행 상황을 실시간으로:
```sql
SELECT DBMS_SQLTUNE.REPORT_SQL_MONITOR(sql_id=>'...') FROM dual;
```

## 6. V$SQL (라이브러리 캐시)
공유된 SQL의 통계를 조회.
```sql
SELECT sql_id, executions, buffer_gets, disk_reads, rows_processed, is_reoptimizable
FROM   v$sql
WHERE  sql_text LIKE 'SELECT%emp%';
```
- `buffer_gets/executions`(실행당 논리 읽기)로 비효율 SQL을 찾는다.
- `is_reoptimizable='Y'`면 통계 피드백 대상.

> ✅ **부록 핵심**: 예상은 `DBMS_XPLAN.DISPLAY`, 실측은 `DISPLAY_CURSOR(ALLSTATS LAST)`·TKPROF·V$SQL. **예상 vs 실측의 차이**가 모든 튜닝의 출발점. (실습: SQL Trace/TKPROF ♻️ · 실행 계획 시각화 ♻️)
