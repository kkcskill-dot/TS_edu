# 참고자료: Oracle AWR/ASH ↔ MySQL/PostgreSQL 진단 대응

> 원 작성: 클라우드/멀티DB 리서처(m8) · 저장/문서화: author(m5)
> 용도: 성능진단 소모임 4회차 강의자료(`session4_analysis.md`)의 AWR/ASH SQL을 타 DBMS로 대응·확장할 때의 근거 자료.
> 조사 범위: `V$ACTIVE_SESSION_HISTORY`, `DBA_HIST_ACTIVE_SESS_HISTORY`, `DBA_HIST_SNAPSHOT` 등 Oracle AWR/ASH 계열과, MySQL `performance_schema`, PostgreSQL `pg_stat_activity`/`pg_stat_statements`의 기능 대응·미지원 여부.

---

## 0. 조사 방법 및 전제

- 워크스페이스 내 관련 소스를 확인: `PerformanceDiagnostics/session_1_architecture_overview.md`, `session_2_history_analysis.md`, `assets/lessons/perf-club/session-4.md`, ASH/AWR 슬라이드·교재, `docs/handover/02_multidb_reference.md`, `04_queries_and_performance.md`.
- 이 프로젝트에는 **Oracle 실접속이 없으며**(SQL 실습 엔진은 sql.js/SQLite), AWR/ASH는 **교육 콘텐츠에서 개념·쿼리 예시로만 존재**한다(팀 컨텍스트와 일치).
- MySQL/PostgreSQL 대응 부분은 **공식 레퍼런스 매뉴얼상 잘 알려진 사실**을 기반으로 작성했으며 출처를 문서명으로 명기한다(§7). 폐쇄망/버전 편차가 있을 수 있으므로 실제 운영 반영 전 해당 버전 매뉴얼 재확인을 권고한다.

**전제 요약**
- 본 워크스페이스의 운영 DB는 SQLite 3종(CBT `server/cbt_api.py`, 설문 `tssurvey/server/tssurvey_api.py`, 동아리 `tsclub/server/tsclub_api.py`)이며, 실습 SQL 엔진은 jsDelivr CDN sql.js(SQLite WASM)다.
- 따라서 아래 Oracle AWR/ASH·MySQL performance_schema·PostgreSQL 진단 쿼리는 **본 워크스페이스에서 실행·검증되지 않는다**. 교재·핸드오프의 개념 대응 근거로만 사용한다.

---

## 1. Oracle AWR/ASH 핵심 개념 요약

- **ASH(Active Session History):** SGA 순환 버퍼에 1초 주기로 **활성 세션(ON CPU/WAITING)** 만 샘플링. 뷰 `V$ACTIVE_SESSION_HISTORY`(실시간, 메모리). 디스크 영구화본은 `DBA_HIST_ACTIVE_SESS_HISTORY`(MMNL이 약 10초당 1건 수준으로 샘플의 일부만 flush).
- **AWR(Automatic Workload Repository):** 기본 1시간 주기 스냅샷으로 누적 통계를 디스크에 영구 보존. 스냅샷 경계는 `DBA_HIST_SNAPSHOT`, 시간모델 누적은 `DBA_HIST_SYS_TIME_MODEL`, 과거 실행계획은 `DBA_HIST_SQL_PLAN` 등 `DBA_HIST_*` 계열.
- **핵심 진단 패턴(4회차 SQL과 연결):**
  - 시간모델 델타로 **DB CPU AAS** 계산(`DBA_HIST_SYS_TIME_MODEL` + `DBA_HIST_SNAPSHOT`) → 4-1
  - 특정 구간 **대기 상위**를 ASH 샘플 카운트로 집계(`V$ACTIVE_SESSION_HISTORY WHERE session_state='WAITING'`) → 4-3
  - **부하 귀속**(module/action/state/event별 샘플 수)으로 원인 SQL·노드 편중 추적 → 4-4
  - 과거 실행계획 복원 `DBMS_XPLAN.DISPLAY_AWR(sql_id, ...)` → 4-10b
- **라이선스 유의:** AWR/ASH(`DBA_HIST_*`, `V$ACTIVE_SESSION_HISTORY`)는 Oracle **Diagnostic Pack** 유상 옵션이다. 라이선스 없는 사이트는 Statspack 등 대체를 써야 한다.

---

## 2. MySQL(Performance Schema) 대응

- **실시간 활성 세션(≈ ASH now):** `performance_schema.threads`(+`events_waits_current`)로 현재 세션의 상태·대기를 조회. `sys.session`(sys 스키마 뷰)이 사람이 보기 좋은 형태를 제공.
- **누적 대기/이벤트 통계(≈ AWR wait class):** `events_waits_summary_global_by_event_name`, `events_stages_summary_*` 등 `*_summary_*` 테이블.
- **문장 단위 통계(≈ Oracle V$SQL / SQL ordered by):** `events_statements_summary_by_digest`(digest = Oracle의 force_matching_signature와 유사한 "정규화된 SQL 지문"). 리터럴 파편화를 digest로 묶어 보는 개념이 4회차 FMS 집계(4-10)와 직접 대응.
- **과거 이력 샘플링(≈ ASH 순환버퍼):** MySQL 기본은 **연속 이력 샘플러가 없다**. `events_statements_history` / `events_waits_history`는 스레드당 최근 N건만 보관(짧은 링버퍼). 상용 도구(PMM의 QAN, Enterprise Monitor) 또는 커스텀 폴링으로 보완.
- **AWR 스냅샷 리포트(1시간 단위 diff 리포트) 직접 대응은 없음.** performance_schema는 "현재 누적값"을 주므로, 구간 diff는 사용자가 두 시점을 떠서 빼야 한다(4-1의 델타 계산과 개념 유사).

---

## 3. PostgreSQL(pg_stat_*) 대응

- **실시간 활성 세션(≈ ASH now):** `pg_stat_activity` — 세션별 `state`(active/idle 등), `wait_event_type`/`wait_event`, `query` 조회. 단 **1초 샘플 이력이 아니라 현재 시점 스냅샷**이다.
- **문장 단위 통계(≈ V$SQL / SQL ordered by):** contrib 확장 `pg_stat_statements`(정규화된 쿼리별 `calls`, `total_exec_time`, `rows`, `shared_blks_*` 등). Oracle의 buffer_gets/elapsed 상위 SQL 추출과 대응. 정규화 쿼리 = digest/FMS와 유사.
- **누적 I/O·블록 통계:** `pg_stat_database`, `pg_statio_*`(blks_hit/blks_read → Buffer Hit% 유사 계산).
- **과거 이력 샘플링(≈ ASH 순환버퍼):** PostgreSQL **코어에는 ASH가 없다**. `pg_stat_activity`는 현재값뿐이라 과거 특정 시각 재구성이 불가. 대안:
  - 확장 `pg_stat_statements`는 이력이 아닌 누적값 → 두 시점 diff 필요.
  - 서드파티/상용: **pgSentinel**(`pg_active_session_history` 뷰로 ASH 유사 1초 샘플 제공, 확장), PASH/pg_wait_sampling, Amazon RDS/Aurora **Performance Insights**(관리형 ASH 유사).
- **AWR 리포트 직접 대응 없음.** 커뮤니티 대안으로 **PoWA**(pg_stat_statements 스냅샷 축적), **pgBadger**(로그 기반 리포트) 등이 AWR형 리포트에 근접.

---

## 4. 지표·객체 대응표 (Oracle → MySQL → PostgreSQL)

| 진단 목적 | Oracle | MySQL | PostgreSQL |
|---|---|---|---|
| 현재 활성 세션·대기 | `V$ACTIVE_SESSION_HISTORY`(1초 이력)·`V$SESSION` | `performance_schema.threads` + `events_waits_current`, `sys.session` | `pg_stat_activity`(현재값) |
| 과거 시점 ASH 재구성 | `V$ACTIVE_SESSION_HISTORY`/`DBA_HIST_ACTIVE_SESS_HISTORY` | **코어 미지원**(짧은 history 링버퍼만) | **코어 미지원**(pgSentinel/PI 등 확장 필요) |
| 대기 이벤트 누적 | `V$SYSTEM_EVENT` | `events_waits_summary_global_by_event_name` | `pg_stat_activity` 집계(누적 뷰 제한적) |
| 시간모델(DB time/CPU) | `V$SYS_TIME_MODEL`·`DBA_HIST_SYS_TIME_MODEL` | 부분(`events_stages_*`, statement latency 합산) | 직접 등가 없음(문장 time 합산으로 근사) |
| 문장별 부하 상위 | `V$SQL`(+`FORCE_MATCHING_SIGNATURE`) | `events_statements_summary_by_digest` | `pg_stat_statements`(정규화 query) |
| 버퍼 적중률 | `V$SYSSTAT`/`V$DB_CACHE_ADVICE` | `performance_schema`/`SHOW GLOBAL STATUS`(Innodb_buffer_pool_*) | `pg_statio_*`(blks_hit/blks_read) |
| 스냅샷/구간 리포트 | AWR(`DBA_HIST_SNAPSHOT` 기반 리포트) | **직접 없음**(PMM QAN, Enterprise Monitor) | **직접 없음**(PoWA, pgBadger) |
| 과거 실행계획 복원 | `DBMS_XPLAN.DISPLAY_AWR()` | 없음(`EXPLAIN`은 현재만) | 없음(`EXPLAIN (ANALYZE)`은 현재만; auto_explain 로그) |

**핵심 결론:** 실시간 세션/대기·문장 단위 부하 지표는 세 DBMS가 대체로 대응된다. 그러나 **① 1초 주기 과거 이력 샘플링(ASH)** 과 **② 스냅샷 기반 구간 diff 리포트(AWR)** 는 MySQL/PostgreSQL 코어에서 **직접 대응되지 않으며**, 상용/서드파티(PMM, Performance Insights, pgSentinel, PoWA 등)로 보완해야 한다.

---

## 5. 본 워크스페이스(sql.js/SQLite) 관점 유의

- 위 Oracle/MySQL/PostgreSQL 진단 뷰는 **전부 sql.js(SQLite WASM)에서 실행되지 않는다.** SQLite에는 성능 스키마·시간모델·ASH가 없다.
- 따라서 4회차 교재의 AWR/ASH SQL과 본 문서의 대응표는 **개념 설명·실무 절차 학습용**이며, 실습 자동채점은 사전 계산된 지표표 판독으로 처리된다(→ `session4_analysis.md` §5 참조).
- 하위 앱(설문 tssurvey, 동아리 tsclub) 문서를 함께 다룰 때 명명 표준 차이에 유의: CBT/tssurvey는 대문자 `TB_` 접두, tsclub은 소문자 복수형. 이는 진단 SQL 예시를 앱별로 커스터마이즈할 때 테이블명이 달라짐을 의미한다.

---

## 6. 폐쇄망/버전 편차 권고

- MySQL/PostgreSQL 대응은 공식 매뉴얼의 일반 사실 기준이며 **버전별 뷰/컬럼 편차**가 있다(예: `pg_stat_statements`의 `total_time` vs `total_exec_time`는 PG13 전후로 명칭 상이). 운영 반영 전 대상 버전 매뉴얼로 재확인 필요.
- pgSentinel·PoWA·PMM 등은 별도 설치·확장이며 **폐쇄망에서는 패키지 반입·라이선스 확인**이 선행되어야 한다.
- Oracle AWR/ASH는 Diagnostic Pack 라이선스가 필요하다.

---

## 7. 출처 (문서명 기준)

- Oracle® Database — Database Reference (동적 성능 뷰 `V$` 및 `DBA_HIST_*` 딕셔너리)
- Oracle® Database — Database Performance Tuning Guide (AWR/ASH, DB time/시간모델, DBMS_XPLAN.DISPLAY_AWR)
- Oracle® Database — Licensing Information User Manual (Diagnostic/Tuning Pack 옵션)
- MySQL Reference Manual — Performance Schema / sys schema (`threads`, `events_*_summary_*`, `events_statements_summary_by_digest`)
- PostgreSQL Documentation — The Statistics Collector / `pg_stat_activity`
- PostgreSQL Documentation — contrib `pg_stat_statements`
- (보완 도구, 서드파티) pgSentinel, PoWA, pgBadger, Percona PMM(Query Analytics), Amazon RDS/Aurora Performance Insights 각 프로젝트/제품 문서

> 주: 본 워크스페이스는 오프라인이며 위 매뉴얼은 직접 재확인하지 못했다. 잘 알려진 매뉴얼상 사실을 정리한 것으로, 정확한 버전별 컬럼·동작은 배포 대상 버전 매뉴얼로 검증할 것.
