# 성능진단 소모임 4회차 산출물 기술 검수 결과

> 검수 대상: `session4_sql_improved.md`, `session4_analysis.md`, `references.md`
> 원 검수: 기술 검수자(m9) · 저장/보완 반영: author(m5)
> 검수일: 2026-07-24 · 보완 반영일: 2026-07-24
> 검수 방식: 워크스페이스 원문과 보고서 간 정적 대조. Oracle/MySQL/PostgreSQL 서버에서의 실실행 검증은 수행하지 못함(본 워크스페이스 실행 엔진은 sql.js/SQLite).

---

## 1. 종합 판정

**조건부 승인 → 보완 반영으로 승인.** 필수 요건은 모두 충족했으며, SQL 정확성 관련 보완 권고 3건을 `session4_sql_improved.md`에 반영 완료했다.

- 세 산출물 모두 실제 존재하며 내용이 비어 있지 않다.
- Oracle AWR 개선 SQL 4종과 ASH SQL 4종이 수록되어 **ASH 3종 이상** 요건을 충족한다.
- 각 주요 SQL에 MySQL/PostgreSQL 대응 또는 미지원 범위가 병기되어 있다.
- 4회차 전용 패널과 다중 과정 공유 패널을 구분한 회귀 위험 분석은 실제 참조 관계와 일치한다.
- 보완 전에는 `DBA_HIST_ACTIVE_SESS_HISTORY`로 단순 교체 시 AAS가 과소 계산될 수 있는 문제와 AWR 스냅샷 구간 표기·재기동 검증 안내가 부족했으나, 보완 반영으로 해소했다(§6 반영 로그).

---

## 2. 파일 존재 및 내용 대조

| 파일 | 실제 존재 | 내용 검수 결과 |
|---|---:|---|
| `PerformanceDiagnostics/reports/session4_sql_improved.md` | 확인 | AWR 개선 4종, ASH 4종, 판독 주의사항, MySQL/PG 대응, 라이선스 및 sql.js 한계 포함 |
| `PerformanceDiagnostics/reports/session4_analysis.md` | 확인 | 자료 위치·구조, 원문 SQL 인용, 패널 참조 관계, 공유 패널 회귀 위험 및 검수 체크리스트 포함 |
| `PerformanceDiagnostics/reports/references.md` | 확인 | Oracle AWR/ASH와 MySQL/PostgreSQL 대응·미지원 비교, 공식 문서명 수준의 출처 포함 |

완료 보고와 실제 파일 존재 사이의 불일치는 발견되지 않았다.

`references.md`에는 백엔드를 다음 3종으로 명시해 "유일한 백엔드" 식의 상충 문구도 피하고 있다.

- `server/cbt_api.py`
- `tssurvey/server/tssurvey_api.py`
- `tsclub/server/tsclub_api.py`

`session4_analysis.md`, `references.md` 어디에도 특정 백엔드를 "유일한 백엔드"로 단정하는 문구는 없다. 문서 간 상충 문구 교차 점검 통과.

---

## 3. AWR SQL 검수

### 3.1 확인된 개선 사항 (원본 대비 적정)

- **AWR-01(DB CPU/DB Time AAS):** 원본 `e.snap_id = b.snap_id + 1` 방식의 스냅샷 누락·DBID 혼입·다대다 조인 위험을 `DBID+INSTANCE_NUMBER+STARTUP_TIME` PARTITION 기반 `LAG`로 교정한 것은 정확하다. DAY/HOUR/MINUTE/SECOND를 모두 포함한 경과초 계산도 옳다. `value >= prev_value` 조건으로 재기동 시 음수 델타를 차단한 것도 타당하다.
- **AWR-02(Top Wait):** 누적 `V$SYSTEM_EVENT` 대신 두 스냅샷 델타를 쓰고, `wait_pct`가 `% DB time`이 아니라 "비유휴 대기시간 내부 비율"임을 명시한 판독 주의는 정확하다.
- **AWR-03(Top SQL):** `V$SQL` 누적 대신 `DBA_HIST_SQLSTAT.*_DELTA`를 반개구간 `snap_id > :begin_snap AND snap_id <= :end_snap`으로 집계한 것은 옳다. 병렬 실행 시 elapsed 합과 wall-clock 차이 경고도 적절하다.
- **AWR-04(DISPLAY_AWR):** `ALLSTATS LAST`가 AWR 컴파일 계획에서 실측 row-source 통계를 보장하지 않으며 `DISPLAY_CURSOR`/SQL Monitor로 교차검증해야 한다는 지적은 원본의 대표적 오류를 정확히 교정한 것이다.

### 3.2 보완 권고 3건 (→ 반영 완료, §6 참조)

1. **디스크 ASH 교체 시 표본 밀도 보정.** 실시간 메모리 ASH(약 1초 표본)를 `DBA_HIST_ACTIVE_SESS_HISTORY`(MMNL이 약 10초 중 1건만 flush)로 바꾸면 `COUNT(*) / elapsed_s`로 계산한 AAS가 약 1/10로 **과소 계산**된다. 디스크 ASH로 AAS를 낼 때는 표본 간격(보통 10초)을 곱하는 보정이 필요함을 ASH 쿼리 서두에 명시하도록 권고 → 반영.
2. **AWR 스냅샷 구간 표기 일관화.** AWR-02/AWR-03에서 `:begin_snap`, `:end_snap`을 쓰는데, 두 스냅샷이 **동일 DBID/instance/startup_time**에 속하고 그 사이 재기동이 없어야 델타가 유효하다는 전제가 AWR-02에만 주석으로 있고 AWR-03에는 없었다. 재기동 검증 안내를 실행 전 확인 항목으로 승격하도록 권고 → 반영.
3. **`% DB time` 산출 근거 명시.** AWR-02의 `wait_pct`가 `% DB time`과 다르다는 경고는 있으나, 실제 `% DB time`을 얻으려면 같은 구간 `DB time` 델타(AWR-01의 분자)를 분모로 써야 한다는 연결 안내를 강화하도록 권고 → 반영.

---

## 4. ASH SQL 검수

- **ASH-01(Top state/event):** `ON CPU`와 비유휴 대기를 한 분모로 비교해 원본 4-3이 `WAITING`만 집계해 CPU 부하를 숨기던 문제를 교정한 것은 정확하다.
- **ASH-02(세션별 대기):** `SESSION_ID + SESSION_SERIAL#`로 SID 재사용을 방지한 점, `session_wait_pct` 분모가 해당 세션의 비유휴 WAITING 표본뿐임을 명시한 점 적정.
- **ASH-03(시간대 Top SQL):** `sql_id + sql_plan_hash_value` 귀속, 병렬(PX) 표본 과대 경고, 대형 CLOB(SQL text) Top-N 전 선조인 금지 안내 적정.
- **ASH-04(blocker→waiter):** `blocking_inst_id/blocking_session/blocking_session_serial#`로 blocker를 정확히 귀속. 동시성 장애 분석용으로 유효한 추가 쿼리.

**ASH 3종 이상 요건:** 4종 수록으로 충족.

**공통 검수 의견:** 반개구간 `>= :begin_ts AND < :end_ts` 통일, 메모리 ASH의 `samples ≈ AAS` 전제, 디스크 ASH와 메모리 ASH sample 수 직접 비교 금지 경고가 §2 서두에 있어 표본 해석 오류를 방지한다. 보완 권고 1(디스크 ASH AAS 보정)을 각 AAS 계산 쿼리 인접부에도 명시하도록 반영했다.

---

## 5. Oracle+MySQL/PG 병기 및 다중 과정 회귀 검수

- **병기 여부:** AWR-01~04, ASH-01~04 전 항목에 MySQL(`performance_schema`)·PostgreSQL(`pg_stat_activity`/`pg_stat_statements`) 대응 또는 미지원이 병기됨. `references.md` §4 대응표와 상호 모순 없음.
- **미지원 표현의 정확성:** "MySQL/PostgreSQL 코어에는 1초 주기 과거 ASH·AWR형 구간 diff 리포트가 없다"는 서술은 정확하다. 상용/서드파티(PMM, Performance Insights, pgSentinel, PoWA) 보완 안내도 적정.
- **다중 과정 회귀:** `session4_analysis.md` §3의 판정(`#panel-report-lab`·`tb-session4`는 perf-club 전용 → 회귀 낮음 / `#panel-explain`·`#panel-index`·`#panel-index-efficiency`는 다중 과정 공유 → 편집 범위 국한 필요)은 참조 관계와 일치한다. 편집 체크리스트(§6)도 이 원칙을 반영한다. **문서 산출물 자체는 코드를 편집하지 않으므로 회귀 위험 없음**이나, 향후 4회차 코드 반영 작업 시 이 경계를 반드시 지켜야 한다.
- **sql.js/폐쇄망:** 세 문서 모두 Oracle/MySQL/PG SQL이 sql.js(SQLite)에서 실행·검증되지 않음과 jsDelivr CDN 폐쇄망 의존 확인 필요를 명시. 팀 표준과 일치.

---

## 6. 보완 반영 로그 (author m5 처리)

`session4_sql_improved.md`에 다음 보완을 반영했다.

1. **§0 실행 전 확인**에 "AWR 델타 SQL(AWR-02/03)의 두 스냅샷은 동일 DBID/INSTANCE_NUMBER/STARTUP_TIME에 속하고 그 사이 재기동이 없어야 한다"는 재기동 검증 항목을 승격.
2. **§2 서두**에 디스크 ASH(`DBA_HIST_ACTIVE_SESS_HISTORY`) 교체 시 AAS 과소 계산 및 표본 간격 보정(≈×10) 안내를 명시.
3. **AWR-02 판독**에 실제 `% DB time`을 얻으려면 같은 구간 `DB time` 델타(AWR-01 분자)를 분모로 써야 함을 명시.

반영 후 세 산출 파일의 실제 존재를 재확인했다(§2 표 참조).

---

## 7. 최종 결론

- 필수 요건(파일 존재·비어있지 않음, ASH 3종 이상, Oracle+MySQL/PG 병기, 다중 과정 회귀 점검, 문서 간 상충 문구 없음) **모두 충족.**
- 보완 권고 3건 **반영 완료.**
- 잔여 한계: 실제 Oracle/MySQL/PostgreSQL 서버 실실행 검증은 본 워크스페이스(sql.js/SQLite)에서 불가하므로, 운영 반영 전 대상 DB 버전 비운영 환경에서 실행계획·권한·라이선스(Diagnostic Pack)를 재확인해야 한다.
