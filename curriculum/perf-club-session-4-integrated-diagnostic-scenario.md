# 성능진단 소모임 4회차 — 10개 지표 통합 진단 시나리오

> **기술 설계안 v1.0 · 2026-07-23** | 연계 문서: `perf-club-session-4-one-page-plan.md` | Oracle 19c
>
> **재현 데이터 팩:** 설치·초기화·실행·복구 절차와 Oracle 적재 스크립트는 [`labs/session-4-oracle-diagnostic/README.md`](labs/session-4-oracle-diagnostic/README.md)를 따른다.

## 1. 시나리오 결론과 교육 의도

**상황:** 09:30 프로모션 정산 배포 후 주문 상태 갱신 배치의 처리량이 평시의 약 8배로 증가한다. 신규 모듈은 테넌트 ID를 리터럴로 조합해 유사 SQL을 대량 생성하고, 대량 `MERGE`를 작은 단위로 반복 커밋한다. 대상 데이터 증가를 통계가 충분히 반영하지 못해 실제 행 수가 예상보다 크며, 해시/정렬 작업이 PGA를 초과해 TEMP로 spill한다.

**관찰되는 인과 흐름:**

`배포·입력량 증가` → `리터럴 SQL 증가 및 Hard Parse` → `파싱 CPU·Shared Pool 경합 증가` + `카디널리티 오차가 있는 대량 MERGE 수행` → `논리/물리 읽기와 PGA 사용 증가` → `TEMP spill 및 I/O 대기 증가` → `DML Redo 증가 + 잦은 COMMIT` → `LGWR 쓰기 및 log file sync 대기 증가` → `ON CPU와 WAITING 세션이 함께 누적` → `AAS·응답시간 상승, 처리량 정체`

이 시나리오의 핵심은 **하나의 높은 지표를 원인으로 단정하지 않고**, 시간 정렬된 지표의 선후관계와 AWR→ASH→SQL_ID/Force Matching Signature→실행계획을 연결하여 다음 결론을 내리게 하는 것이다.

- **기점:** 배포 이후 입력량·SQL 생성 방식·커밋 방식 변화
- **증폭 요인:** 통계/카디널리티 오차, PGA 부족에 따른 TEMP spill
- **직접 자원 병목:** 파싱/실행 CPU, TEMP·데이터 파일 I/O, Redo 동기 쓰기
- **책임 작업:** 정산 모듈의 유사 SQL군과 대량 MERGE SQL

---

## 2. 제공할 10개 지표와 판독 기준

> 지표는 동일한 1분 버킷으로 정렬한다. 정상 기준선은 **동일 요일·동일 시간대·동일 업무 상태의 최근 4주 중앙값(P50)**과 변동 폭(P95 또는 MAD)을 사용한다. 아래 수치는 실습용 데이터 팩의 설계값이며 범용 임계값이 아니다.

| No. | 지표 | 정상 기준선(09:00~09:29) | 과부하 구간(09:30~10:10) | 진단 역할·연계 포인트 |
|---:|---|---:|---:|---|
| 1 | **AAS** (`DB Time/elapsed`) | 2.1, P95 3.4 | 14~19 | 총 동시 활동량. 8 CPU 환경에서 AAS가 8을 넘더라도 CPU 병목으로 즉시 단정하지 않고 ON CPU/WAITING으로 분해한다. |
| 2 | **DB CPU / Host CPU** | DB CPU 1.3 AAS, Host 28% | DB CPU 6.7 AAS, Host 92% | CPU 포화 확인. Host의 다른 프로세스 사용량, run queue도 함께 확인한다. Hard Parse와 Top SQL CPU 증가가 선행하는지 본다. |
| 3 | **비유휴 대기 AAS 및 Top Wait 구성** | 0.8; I/O 소량 | 8~12; `direct path read/write temp`, `db file sequential read`, `log file sync` | 대기명보다 **대기 AAS·총시간·평균 단일 대기시간**을 함께 본다. ASH에서 SQL_ID, session state, event로 책임 작업을 좁힌다. |
| 4 | **Physical Reads/s** | 1.8K blocks/s | 24K blocks/s | 읽기 양 증가. 실행 횟수 증가인지 실행당 읽기 증가인지 분해하고 `SQL ordered by Physical Reads` 및 플랜의 Reads/Buffers와 연결한다. |
| 5 | **I/O latency** (single-block, TEMP) | 4 ms / 6 ms | 17 ms / 31 ms | 저장장치 지연인지 I/O 요청량 폭증인지 구분한다. OS/storage 지표와 대조하며, reads/s 증가가 먼저라면 SQL 유발 부하 가능성이 높다. |
| 6 | **메모리 압력** (PGA cache hit 또는 one-pass/multipass·TEMP 사용량) | cache hit 97%, spill 0.2 GB/h | cache hit 68%, TEMP 46 GB/h | PGA 작업 영역 부족의 증거. `workarea executions - onepass/multipass`, ASH의 TEMP wait, 실행계획의 `OMem/1Mem/Used-Mem`을 연결한다. |
| 7 | **Buffer Cache 지표** (Buffer Hit% + logical reads/s) | 98.7%, 42K/s | 91.5%, 310K/s | Hit% 단독 사용 금지. 대량 스캔/캐시 교란 여부를 logical·physical reads와 함께 확인한다. 낮은 Hit%가 메모리 증설을 곧바로 의미하지 않는다. |
| 8 | **파싱 지표** (Hard Parses/s + Soft Parse%) | 1.2/s, 99.7% | 165/s, 71% | 리터럴 SQL/커서 미재사용 증거. CPU 상승 및 `library cache` 계열 경합과 시간상 일치하는지 확인하고 `force_matching_signature`, `version_count`로 유사 SQL군을 묶는다. |
| 9 | **Redo 지표** (Redo size/s + commit/s + 평균 `log file sync`) | 3 MB/s, 90/s, 2.1 ms | 54 MB/s, 2.4K/s, 18 ms | Redo 생성량은 작업량, commit/s는 커밋 빈도, sync latency는 사용자 체감 지연을 설명한다. `log file parallel write`와 스토리지 지연도 함께 본다. |
| 10 | **TOP SQL 기여도** (DB Time·CPU·Reads·Executions) | 1위 SQL DB Time 12% | MERGE SQL군 58%, 파싱 SQL군 포함 74% | 시스템 지표를 실행 주체에 귀속한다. SQL_ID 하나만 보지 말고 SQL군, module/action, plan hash value, 실행당 자원량을 비교한다. |

### 필수 파생값

- `Wait AAS = AAS - DB CPU AAS` (동일 정의·동일 구간일 때 근사)
- `CPU 포화도 = DB CPU AAS / CPU core 수`; Host CPU와 함께 검증
- `실행당 Reads = delta physical reads / delta executions`
- `실행당 Redo = delta redo size / 업무 트랜잭션 수`
- `평균 commit 대기 = log file sync time / waits`
- `SQL 기여율 = SQL DB Time / 전체 DB Time`
- 카디널리티 오차: `A-Rows / (E-Rows × Starts)`; 0 나눗셈과 누적/회당 정의에 주의

---

## 3. 정상→과부하→회복 타임라인

| 구간 | 관찰 사실 | 판단과 다음 드릴다운 |
|---|---|---|
| **B0 정상 기준선** 09:00~09:29 | AAS 2.1, Host CPU 28%, 대기 분산, Hard Parse 1.2/s, TEMP spill 미미 | 같은 업무 시간대의 비교 기준을 고정한다. 이 구간의 SQL별 실행 횟수·실행당 자원·플랜 해시를 보존한다. |
| **T1 변화 기점** 09:30~09:34 | 배포/배치 시작과 동시에 Hard Parse가 먼저 165/s로 상승, SQL 실행 수 증가 | CPU 상승보다 파싱 급증이 같거나 먼저 발생했는지 확인한다. 유사 리터럴 SQL을 Force Matching Signature로 군집화한다. |
| **T2 CPU 과부하** 09:35~09:42 | DB CPU 6.7 AAS, Host CPU 92%, AAS 11; library cache 계열 대기 동반 | AAS 11 전체를 CPU로 해석하지 않는다. 약 6.7은 CPU, 나머지는 대기다. Top SQL CPU와 Parse Calls/Executions를 비교한다. |
| **T3 I/O·메모리 증폭** 09:43~09:54 | Physical Reads와 logical reads 증가, PGA cache hit 하락, TEMP 46 GB/h, TEMP wait 상위 진입 | 실행계획의 E/A-Rows 오차와 hash/sort spill을 입증한다. I/O latency 상승이 요청량 증가 뒤에 나타나는지 확인하여 원인/결과를 구분한다. |
| **T4 Redo·커밋 병목** 09:55~10:10 | Redo 54 MB/s, commit 2.4K/s, `log file sync` 18 ms; AAS 19이나 처리량은 정체 | DML량 증가와 과도한 작은 커밋을 분리한다. `log file parallel write`가 함께 상승하면 LGWR 경로를, sync만 높으면 스케줄링·commit 패턴도 조사한다. |
| **R1 즉시조치** 10:11~10:20 | 배치 동시도 8→2, commit batch 100→5,000; AAS 7, sync 5 ms, 처리량 회복 | 조치 전후 동일 길이 구간을 비교한다. 효과가 있어도 근본 원인이 해결되었다고 단정하지 않는다. |
| **R2 근본조치 검증** 익일 동일 시간 | 바인드 적용, 통계 보정, 플랜 검증 후 Hard Parse 2/s, spill 제거, SQL DB Time 비중 18% | 업무 처리량이 동일하거나 더 높은 조건에서 실행당 CPU/Reads/Redo와 응답시간을 기준선과 비교한다. |

---

## 4. Observe → Narrow → Prove → Act 진단 흐름

### 4.1 Observe — 문제 구간과 병목 축 분류

1. 사용자 응답시간/업무 처리량 저하 시각을 먼저 고정한다.
2. 10개 지표를 1분 버킷으로 정렬하여 B0, T1~T4, R1을 표시한다.
3. AAS를 DB CPU와 대기 AAS로 분해한다.
4. 정상 대비 **배수**, 기준선 P95 초과 지속시간, 변화의 선후관계를 기록한다.

**관문 O:** “09:30 이후 CPU와 대기가 함께 증가한 복합 병목이며, 파싱 증가가 최초 기술 징후”라고 분류할 수 있어야 한다.

### 4.2 Narrow — 대기와 SQL로 책임 범위 축소

1. AWR Top Timed Events에서 CPU, TEMP I/O, single-block I/O, commit 대기의 비중을 확인한다.
2. ASH를 `sample_time, session_state, event, sql_id, module, action`으로 집계한다.
3. SQL_ID별 집계와 Force Matching Signature별 집계를 병행해 리터럴 SQL 파편화를 놓치지 않는다.
4. TOP SQL을 DB Time 하나로만 정렬하지 않고 CPU, reads, executions, parse calls, gets/execution, reads/execution으로 재정렬한다.

**관문 N:** 정산 모듈의 MERGE SQL과 유사 리터럴 SQL군이 전체 DB Time의 74%를 설명해야 한다.

### 4.3 Prove — 실행계획과 자원 경로로 인과 입증

1. 정상/장애 구간의 `PLAN_HASH_VALUE`와 실행당 자원량을 비교한다.
2. `DBMS_XPLAN.DISPLAY_AWR` 또는 `DISPLAY_CURSOR(..., 'ALLSTATS LAST +MEMSTATS +IOSTATS')`로 다음을 확인한다.
   - 최초 `E-Rows × Starts` 대비 `A-Rows` 오차 노드
   - 최대 `Buffers/Reads` 노드
   - hash/sort의 one-pass 또는 multipass와 TEMP 사용
3. Redo는 SQL별 DML량·실행 수·commit 횟수와 대조한다. Redo size 상승만으로 LGWR 병목을 확정하지 않는다.
4. OS CPU run queue 및 스토리지 latency를 대조해 DB 내부 수요 증가와 외부 자원 장애를 구분한다.

**최소 증거 체인:**

- **시간 증거:** 09:30 배포 직후 Hard Parse 선행 상승
- **세션 증거:** ASH 활성 샘플의 74%가 정산 모듈/SQL군에 귀속
- **플랜 증거:** A/E Rows 오차와 TEMP spill, 장애 시 실행당 Reads 증가
- **트랜잭션 증거:** commit/s 26배 및 log file sync latency 상승

### 4.4 Act — 즉시조치와 근본조치 분리

| 우선순위 | 조치 | 기대효과 | 위험·롤백 조건 |
|---|---|---|---|
| 즉시 1 | 배치 동시도 제한 및 큐잉 | CPU·I/O 동시 수요 감소 | SLA 내 배치 완료 불가 시 단계적으로 동시도 복구 |
| 즉시 2 | 커밋 단위 100→5,000건으로 확대 | commit/s와 `log file sync` 감소 | 실패 시 롤백량·Undo·락 유지시간 증가. Undo 여유/락 대기 악화 시 1,000건으로 롤백 |
| 즉시 3 | 검증된 양호 플랜을 임시 SPM으로 적용 | 실행당 Reads/TEMP 감소 | 데이터 분포별 성능 검증 실패 또는 실행당 자원 증가 시 disable |
| 근본 1 | 리터럴 제거·바인드 적용, module/action 표준화 | Hard Parse·Shared Pool 경합 감소, 추적성 향상 | 바인드 민감 SQL은 ACS/히스토그램 검증 후 배포 |
| 근본 2 | 대표 데이터로 통계·히스토그램/확장 통계 검증 | 카디널리티 및 조인/작업영역 선택 개선 | 운영 통계 즉시 덮어쓰기 금지. pending stats와 복원 가능한 백업 사용 |
| 근본 3 | SQL/배치 단위 축소 및 PGA sizing 검토 | spill·TEMP I/O 감소 | PGA 증설은 OS 메모리·`PGA_AGGREGATE_LIMIT` 검증 후 시행; SQL 비효율을 메모리로 은폐하지 않음 |

---

## 5. 고정 임계치 적용 시 주의사항

1. **AAS와 CPU Core의 단순 비교 금지:** AAS에는 CPU와 비유휴 대기가 모두 포함된다. AAS가 코어 수보다 커도 I/O/Lock 중심일 수 있으며, CPU 포화는 DB CPU AAS·Host CPU·run queue로 확인한다.
2. **비율의 분모 효과:** Buffer Hit%, Soft Parse%는 분모가 작거나 특정 대량 작업이 섞이면 급변한다. 절대량(logical/physical reads, parse count)과 실행당 수치를 같이 제시한다.
3. **보편적 Hit Ratio 금지:** 낮은 Buffer Hit%는 대량 순차 스캔이 정상인 DW/배치에서는 결함이 아닐 수 있고, 99%여도 막대한 logical I/O로 CPU 병목이 날 수 있다. “95% 미만=메모리 증설” 규칙은 사용하지 않는다.
4. **Hard Parse 절대 건수의 업무 의존성:** 100/s 같은 값은 경고 참고치일 뿐이다. CPU 수, SQL 복잡도, 동시성, parse time CPU, library cache 경합, 기준선 대비 배수를 함께 본다.
5. **Redo 양과 Redo 병목 구분:** Redo size/s가 높아도 LGWR가 감당하고 sync latency가 낮으면 병목이 아닐 수 있다. 반대로 Redo 양이 보통이어도 매우 잦은 commit이나 느린 로그 장치 때문에 `log file sync`가 클 수 있다.
6. **Wait Event 순위만으로 원인 확정 금지:** 대기는 느린 작업의 결과 또는 정상 동작일 수 있다. DB Time 비중, AAS, wait count, 평균/분위 latency, SQL_ID와 함께 해석한다. `CPU time`은 대기 이벤트가 아니라 소비 시간이다.
7. **I/O latency의 계층 차이:** DB wait latency에는 큐잉과 스케줄링이 포함될 수 있고 스토리지 장비 latency와 정의가 다르다. 블록 크기·읽기 유형·캐시·동시 요청 수가 같은 조건에서 비교한다.
8. **PGA 지표의 인스턴스 합계 함정:** 총 PGA 사용량이 target 이하여도 개별 workarea가 spill할 수 있다. one-pass/multipass, SQL plan MEMSTATS, TEMP 사용을 확인한다.
9. **스냅샷 평균의 희석:** 1시간 AWR 평균은 5분 급증을 숨긴다. 장애 창을 짧은 스냅샷/ASH 1분 버킷으로 재구성하고, 서로 다른 길이 구간의 총량을 직접 비교하지 않는다.
10. **TOP SQL의 귀속 편향:** SQL_ID 파편화, 병렬 실행, 재귀 SQL, PL/SQL 내부 SQL 때문에 원인이 분산될 수 있다. Force Matching Signature·module/action·plan hash로 묶고, DB Time과 elapsed를 중복 합산하지 않는다.
11. **RAC/PDB/하드웨어 차이:** 인스턴스·PDB·서비스 범위를 섞지 않는다. 코어 수, Resource Manager 제한, RAC의 노드별 편차와 interconnect wait를 반영해 기준선을 별도로 둔다.
12. **경고선은 조치선이 아님:** 임계치 초과는 조사 시작 신호다. 조치는 최소 두 개 이상의 독립 증거(예: ASH 귀속 + 실행계획 자원량)와 조치 전후 검증 조건을 확보한 뒤 시행한다.

### 권장 동적 경고 규칙

- **Warning:** 동일 업무 기준선 P95 초과가 3개 버킷(3분) 지속
- **Critical:** 기준선 중앙값의 3배 이상이면서 사용자 영향 지표 악화, 또는 자원 포화가 5분 지속
- **Anomaly:** `median + 3 × MAD` 초과. 계절성이 크면 요일·시간·배치 상태별 모델 분리
- 임계치에는 반드시 **범위(instance/PDB/service), 단위, 집계 간격, 기준선 기간, 업무 캘린더, 버전**을 기록한다.

---

## 6. 학습자에게 요구할 최종 진단 문장

> “09:30 정산 배포 이후 정산 모듈의 리터럴 SQL 증가로 Hard Parse가 1.2/s에서 165/s로 먼저 상승했고, 대량 MERGE의 카디널리티 오차와 PGA spill이 실행당 읽기 및 TEMP I/O를 증폭했다. 동시에 100건 단위 커밋이 commit/s를 2.4K까지 높여 `log file sync`를 18ms로 악화시켰다. 그 결과 8 CPU 환경에서 DB CPU 6.7 AAS와 대기 8~12 AAS가 겹쳐 총 AAS가 최대 19에 도달했다. ASH 샘플 74%와 DB Time 74%가 해당 SQL군에 귀속되고 실행계획의 A/E Rows 오차·TEMP 사용으로 원인을 입증했다. 즉시 동시도와 커밋 단위를 조정하고 검증된 플랜으로 안정화한 뒤, 바인드 적용·통계/플랜 교정·배치 재설계를 근본조치로 시행한다.”

## 7. 데이터 팩 기술검수 체크

- 모든 지표의 단위와 집계 간격이 명시되어 있는가?
- B0/T1/T2/T3/T4/R1 경계가 AWR·ASH·배포 로그에서 동일한가?
- AAS가 DB CPU AAS + 비유휴 Wait AAS와 허용 오차 내에서 정합하는가?
- Top SQL 자원 합계가 인스턴스 총량을 초과하지 않는가?
- SQL_ID 파편화 버전과 Force Matching Signature 집계 버전이 함께 제공되는가?
- XPLAN의 Starts, E-Rows, A-Rows, Buffers, Reads, OMem/1Mem/Used-Mem이 시나리오 결론을 재현하는가?
- Redo size, user commits, `log file sync`, `log file parallel write`의 수치 관계가 모순되지 않는가?
- 즉시조치 후 업무 처리량이 유지되며 단순히 부하만 숨긴 결과가 아닌가?
- 정답이 고정 임계치 하나가 아니라 최소 3개 독립 수치 근거로 입증되는가?
