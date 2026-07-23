# Oracle 19c 통합 장애진단 실습 데이터 팩

> 재현 가능한 **비운영 스냅샷 데이터셋**. Oracle Diagnostic Pack 라이선스나 실제 AWR import 없이 Oracle 19c 테이블 또는 CSV로 분석한다.

## 1. 범위와 안전 원칙

이 팩은 2026-07-15 09:00~10:20, 단일 인스턴스/`PERFLAB` PDB/8 CPU의 81분을 1분 버킷으로 고정 재현한다.

`B0 정상(30분) → T1 파싱(5분) → T2 CPU(8분) → T3 PGA/TEMP·I/O(12분) → T4 Redo/commit(16분) → R1 완화(10분)`

교육 환경에서 장애를 실제로 유발하지 않는다. CPU burn, 대량 TEMP, redo 폭증을 운영 DB에서 실행하는 방식은 제외했다. 실제 `DBA_HIST_%`, `V$ACTIVE_SESSION_HISTORY`, AWR 보고서 사용은 별도 Diagnostic Pack 라이선스를 확인해야 한다. 생성된 `LAB_%` 테이블은 합성 자료다.

## 2. 데이터와 인과 연결

- 배포 로그의 리터럴 테넌트 조건 → 동일 Force Matching Signature의 SQL_ID 3개 → Hard Parse와 CPU/Concurrency 대기 상승
- 통계 오차가 있는 `MERGE` → XPLAN의 620배 카디널리티 오차 → logical/physical reads와 PGA one/multipass 증가 → 38GB TEMP spill 및 TEMP I/O 대기
- 100건 commit → Redo 54MB/s, commit 2.4K/s → `log file sync` 18ms
- SQL군 DB Time 기여: T1~T4에서 MERGE 34~58%, 리터럴군 16~31%. 단계별로 합계 65~74%; 단일 SQL_ID만 보면 파싱 원인을 과소평가한다.
- R1에서 동시도 8→2, commit batch 100→5,000으로 AAS·commit 대기가 줄고 처리량은 유지/회복된다.

`evidence/system-context.csv`의 storage latency는 DB wait보다 낮게 유지되어 “스토리지 자체 장애” 가설을 반박한다.

## 3. 디렉터리

```text
generate_dataset.py       결정론적 CSV/Oracle INSERT 생성기
sql/00_create_user.sql    전용 사용자 생성(SYS/SYSTEM)
sql/01_schema.sql         LAB 스냅샷 스키마
sql/02_queries.sql        Observe/Narrow/정합성 질의
sql/03_reset.sql          데이터 초기화
sql/99_drop_user.sql      완전 철거
evidence/                 배포 로그, 시스템 맥락, SQL text, 정상/과부하 XPLAN
generated/                아래 절차로 생성되는 CSV, load_data.sql, SHA256SUMS
```

## 4. 설치

### A. DB 없이 CSV로 사용(권장, 1분)

Python 3.9+만 필요하다.

```bash
cd curriculum/labs/session-4-oracle-diagnostic
python3 generate_dataset.py
python3 generate_dataset.py --check
cd generated && shasum -a 256 -c SHA256SUMS
```

`metrics_1m.csv`, `ash_1m.csv`, `top_sql_by_phase.csv`, `awr_top_events.csv`를 스프레드시트/분석 도구로 연다. 재실행하면 동일 파일이 덮어써진다.

### B. Oracle 19c에 적재

전제: 교육용 PDB, SQL*Plus, USERS/TEMP tablespace. CDB root나 운영 PDB에 만들지 않는다. `00_create_user.sql`의 기본 암호는 실행 전 교체한다.

```bash
python3 generate_dataset.py
sqlplus system@//dbhost:1521/PERFLAB @sql/00_create_user.sql
sqlplus PERF_LAB/'교체한암호'@//dbhost:1521/PERFLAB @sql/01_schema.sql
sqlplus PERF_LAB/'교체한암호'@//dbhost:1521/PERFLAB @generated/load_data.sql
```

검증:

```bash
sqlplus PERF_LAB/'교체한암호'@//dbhost:1521/PERFLAB @sql/02_queries.sql
```

기대값: `LAB_METRICS_1M=81`, B0 AAS 약 2.1/T4 약 19, T4 commit 약 2,400/s, 마지막 정합성 질의 결과 0행.

```sql
SELECT 'metrics' n,COUNT(*) c FROM lab_metrics_1m UNION ALL
SELECT 'ash',COUNT(*) FROM lab_ash_1m UNION ALL
SELECT 'top_sql',COUNT(*) FROM lab_top_sql UNION ALL
SELECT 'events',COUNT(*) FROM lab_awr_events;
```

## 5. 실행(실습 공개 순서)

1. **Observe:** `generated/metrics_1m.csv`만 공개해 최초 변화와 B0/T1~T4/R1을 표시한다.
2. **Narrow:** `awr_top_events.csv`, `ash_1m.csv`, `top_sql_by_phase.csv`를 공개한다. SQL_ID 집계와 Force Matching Signature 집계를 비교한다.
3. **Prove:** `evidence/xplan-normal.txt`, `xplan-overload.txt`, `sql-texts.sql`을 공개한다. `A-Rows/(E-Rows×Starts)`, Reads, OMem/1Mem, TempSpc를 확인한다.
4. **Act:** `system-context.csv`, `deployment.log`를 공개해 즉시조치의 효과와 스토리지 장애 대안 가설을 검증한다.

Oracle 적재형에서는 `sql/02_queries.sql`의 네 블록을 같은 순서로 실행한다. 이 데이터는 누적 카운터가 아니라 명시된 구간의 rate/phase rollup이므로 서로 다른 길이의 총량을 직접 비교하지 않는다.

## 6. 초기화·복구·철거

- **초기화 후 재실행:**
  ```bash
  sqlplus PERF_LAB/'암호'@//dbhost:1521/PERFLAB @sql/03_reset.sql
  sqlplus PERF_LAB/'암호'@//dbhost:1521/PERFLAB @generated/load_data.sql
  ```
- 적재 도중 실패해도 `load_data.sql`은 마지막에만 commit한다. 실패 시 `ROLLBACK;` 후 초기화한다.
- CSV 손상 시 `python3 generate_dataset.py`로 재생성하고 checksum을 검증한다.
- **완전 복구(철거):** SYS/SYSTEM으로 대상 PDB를 재확인한 뒤 `sql/99_drop_user.sql` 실행. `DROP USER ... CASCADE`이므로 전용 교육 사용자에서만 사용한다.

## 7. 기술 QA 체크

```bash
python3 generate_dataset.py --check
```

검사는 81분 경계, `AAS = DB CPU AAS + Wait AAS`(반올림 허용), ASH sample 합계, SQL 기여율 100%, T4 목표 범위, 동일 FMS의 SQL_ID 3개를 확인한다. 추가 수동 확인:

- 과부하 XPLAN: Id 6 최초 620배 오차, hash workarea spill 38G
- T1 Hard Parse가 T2 CPU/T3 I/O/T4 commit보다 먼저 시작
- AAS가 코어보다 높다는 이유만으로 CPU 단독 병목으로 결론내지 않음
- `system-context.csv`의 스토리지 지표와 DB wait의 정의를 혼합하지 않음

## 8. 제한사항

합성 스냅샷은 교육용 증거 연결을 재현하며 실제 SQL_ID 해시, Oracle 내부 AWR dump, 초단위 세션 원본을 모사하지 않는다. 수치 임계치는 이 시나리오의 기준선에만 적용한다. 라이브 부하 재현이 필요하면 격리된 disposable DB에서 별도 승인·자원 상한·모니터링을 갖춘 후 확장한다.
