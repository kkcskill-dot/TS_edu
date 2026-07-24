# 성능진단 소모임 4회차 강의자료 분석

> 작성: author(m5) · 최초 조사 초안: 시스템 분석가(m0) 태스크 · 검증 재조사 및 문서화: author(m5)
> 대상 워크스페이스: `PerformanceDiagnostics/`
> 목적: 4회차 강의자료(HTML 패널/문서)의 위치·구조·코드 컨벤션, 패널 공유(다중 과정 회귀 위험) 여부, 포함된 AWR/ASH SQL 블록(원문)을 정리한다.

---

## 0. 요약 (TL;DR)

- 4회차 강의자료는 크게 **3계층**으로 구성된다.
  1. **기획/설계 문서** — `curriculum/perf-club-session-4-*.md` 4종 (1페이지 기획서, 통합 진단 시나리오, 학습지원 핸드오프, 실습 데이터 빌더/워크북).
  2. **본문 교재(Markdown)** — `assets/lessons/perf-club/session-4.md`. 사이드바가 아니라 **교재 탭(`tb-session4`)** 을 통해 `markdown-viewer-session4` 영역에 렌더된다.
  3. **인터랙티브 실습 패널(HTML)** — `partials/perf-club.html`의 `#panel-report-lab`(4회차 캡스톤 "종합진단 리포트 실습"). 로직은 `app.js`의 `panel-report-lab` 초기화 코드(약 1308행~).
- **회귀 위험 판정:**
  - `#panel-report-lab`과 `tb-session4`(및 `markdown-viewer-session4`)는 **성능진단 소모임 과정 전용**이며 다른 과정에서 참조되지 않는다 → 수정 시 다중 과정 회귀 위험 **낮음**.
  - 단, 같은 `partials/perf-club.html` 파일 안에는 `#panel-explain`(실행계획 시각화)·`#panel-index`(인덱스 시뮬레이터)처럼 **여러 과정이 공유하는 레거시 랩 패널**이 함께 들어 있다. 4회차 작업 중 이 파일을 편집할 때 공유 패널 영역을 건드리면 SQL 튜닝/데이터 모델링/방문자 통계 등 **여러 과정에 회귀가 전파**되므로 편집 범위를 `#panel-report-lab`/`tb-session4` 블록으로 국한해야 한다.
- AWR/ASH SQL은 4회차 본문(`session-4.md`)의 [실무 스크립트 4-1 ~ 4-10b]에 포함되어 있으며, `DBA_HIST_*`·`V$ACTIVE_SESSION_HISTORY`·`V$SYS_TIME_MODEL` 등 **Oracle 전용 뷰/함수**를 사용한다(§4에 원문 인용).
- 이 SQL들은 **Oracle Diagnostic/Tuning Pack 전용**이며, 본 워크스페이스의 SQL 실습 엔진(jsDelivr CDN sql.js = SQLite WASM)에서는 **실행·자동채점으로 검증되지 않는다**. 4회차 캡스톤 실습(`panel-report-lab`)은 실제 SQL 실행이 아니라 **사전 계산된 지표표를 판독·채점**하는 방식이다(§5).

---

## 1. 파일 위치 및 구조

### 1.1 기획·설계 문서 (`curriculum/`)

| 경로 | 성격 |
|---|---|
| `curriculum/perf-club-session-4-one-page-plan.md` | 4회차 1페이지 기획서(SoT, 확정안 v1.0). 대상·시간(240분)·산출물·일정·담당 정의 |
| `curriculum/perf-club-session-4-integrated-diagnostic-scenario.md` | 10개 지표 통합 진단 시나리오 기술 설계안(기준선·과부하 수치·인과 흐름·임계치) |
| `curriculum/perf-club-session-4-learner-support-handoff.md` | 수강생 오개념·현장 질의응답 운영 핸드오프 |
| `curriculum/labs/session-4-oracle-diagnostic/README.md` | 재현 데이터 팩 설치·초기화·실행·복구 및 Oracle 적재 절차 |
| `curriculum/labs/session-4-oracle-diagnostic/build_workbook_data.py` | 4회차 통합 진단 워크북 데이터 빌더(단일 인스턴스 → 노드별 비교용 파생) |
| `curriculum/labs/session-4-oracle-diagnostic/workbook.html` | "PERFLAB 통합 장애진단 분석 워크북"(4회차 팀 실습) |

### 1.2 본문 교재 (Markdown)

- 파일: **`assets/lessons/perf-club/session-4.md`** — 제목 「제4장. 성능진단 리포트 작성: 10대 지표 추출·판독과 종합진단」.
- 구성: 4.0 리포트 골격/10대 지표 체계 → 4.1 부하·활동(①~④) → 4.2 메모리(⑤~⑥) → 4.3 I·O·효율(⑦~⑨) → 4.4 원인 SQL(⑩) → 4.5 종합진단 → 4.6 성취도 평가.
- 로딩 경로(`app.js:98`):
  ```js
  'tb-session4': ['markdown-viewer-session4', 'assets/lessons/perf-club/session-4.md']
  ```
  즉 교재 탭 버튼 `data-target="tb-session4"`를 누르면 `session-4.md`를 fetch해 `#markdown-viewer-session4`에 Markdown 렌더한다.

### 1.3 인터랙티브 실습 패널 (HTML/JS)

- 마크업: **`partials/perf-club.html` `#panel-report-lab`**(약 1113행). 헤더 주석 `<!-- 종합진단 리포트 실습 (4회차 캡스톤) -->`(1112행).
  - 패널 소개(1192행): "4회차 캡스톤. PERFLAB 스냅샷(2026-07-15 09:00~10:20)의 **10대 성능 지표**를 정상 기준선과 비교·판독하고, 근본 원인·개선 우선순위를 담은 **종합진단 리포트**를 작성해 즉시 자동 채점".
  - 패널 전용 스타일은 `#panel-report-lab { ... }` 스코프드 CSS로 패널 내부에 인라인 `<style>` 되어 있음(1117~1188행 다수) → 클래스 접두사 `rl-*`.
- 사이드바 진입 버튼: `index.html:501` `<button id="nav-btn-report-lab" class="menu-item" data-target="panel-report-lab">`.
- 채점/렌더 로직: **`app.js` 약 1308행** `종합진단 리포트 실습 (4회차 캡스톤) — panel-report-lab`, `document.getElementById("panel-report-lab")`로 진입.
- 교재 탭 마크업(`partials/perf-club.html`):
  - 2496행: `<button class="tbook-tab" data-target="tb-session4"> ... 4회차 </button>`
  - 2515행: `<div class="textbook-tab-contents" id="tb-session4">`
  - 2517행: `<div id="markdown-viewer-session4" class="markdown-body"></div>`

---

## 2. 코드 컨벤션

- **프레임워크 없음(vanilla JS 정적 SPA).** 사이드바 `.menu-item[data-target]` 클릭 → `app.js`가 해당 `.content-panel`(`#panel-*`)로 전환하는 구조.
- **패널 = `<section id="panel-XXX" class="content-panel">`.** 4회차 캡스톤은 `#panel-report-lab`.
- **교재 = 탭 방식.** `.tbook-tab[data-target="tb-sessionN"]` ↔ `.textbook-tab-contents#tb-sessionN` ↔ 내부 `#markdown-viewer-sessionN`. 실제 텍스트는 별도 `.md` 파일에서 fetch.
- **CSS 네임스페이싱:** 패널 전용 스타일은 `#panel-report-lab .rl-*`처럼 패널 ID로 스코프를 좁혀 다른 패널과 충돌을 피한다. 4회차 캡스톤 클래스 접두사는 `rl-`(report-lab).
- **스타일 위치 혼재:** 전역 `style.css` 외에도 패널별로 인라인 `<style>`(예: `#panel-report-lab`) 및 요소 인라인 `style="..."`가 광범위하게 쓰인다. 편집 시 인라인 스타일과 전역 스타일이 함께 작동함을 유의.
- **콘텐츠/로직 분리:** 교재 본문은 Markdown(`.md`)로, 실습 채점 데이터·로직은 `app.js`에 둔다. 본문 수정은 `.md`만, 채점·표 로직 수정은 `app.js`만 건드리는 것이 안전하다.

---

## 3. 패널 공유(다중 과정 회귀 위험) 판정

### 3.1 4회차 전용 자산 (회귀 위험 낮음)

`grep` 교차 확인 결과, 다음은 **성능진단 소모임(perf-club)에서만** 참조된다.

- `#panel-report-lab` — 참조처: `index.html:501`(perf-club 사이드바), `partials/perf-club.html`(마크업+스타일), `app.js:1308~`(로직). 타 과정 사이드바/문서에서 재사용(`♻️`) 표기 없음.
- `tb-session4` / `markdown-viewer-session4` — `partials/perf-club.html`과 `app.js:98`에서만 참조.

→ **판정: 이 자산들을 수정해도 다른 과정으로의 회귀 전파 위험은 낮다.**

### 3.2 같은 파일에 공존하는 공유 레거시 패널 (회귀 위험 높음)

`partials/perf-club.html` **한 파일 안에** 여러 과정이 공유하는 랩 패널이 함께 정의되어 있다.

| 패널 | 정의 위치 | 공유 과정(진입 버튼/문서) |
|---|---|---|
| `#panel-explain`(실행계획 시각화) | `partials/perf-club.html:119` | 성능진단(`index.html:389`), SQL튜닝(`index.html:867`, `curriculum/tuning/01-sql-tuning-basics.md`), 방문자통계(`index.html:984`), `BACKLOG.md` |
| `#panel-index`(인덱스 시뮬레이터) | `partials/perf-club.html:278` | 성능진단(`index.html:398`), SQL튜닝(`index.html:871`), 데이터모델링(`index.html:931`, `curriculum/design/01-data-modeling.md`, `courses/data-modeling.js`), 방문자통계(`index.html:998`) |
| `#panel-index-efficiency` | `partials/perf-club.html:2523` | 성능진단·SQLD·SQL튜닝 사이드바에서 공통 참조(`index.html` 다수) |

→ **판정: 4회차 작업으로 `partials/perf-club.html`을 편집할 때 위 공유 패널 영역(및 그 스타일)을 건드리면 SQL 튜닝·데이터 모델링·방문자 통계 등 다수 과정에 동시 회귀가 발생한다.** 편집은 반드시 `#panel-report-lab`·`tb-session4` 블록으로 한정하고, 변경 후 공유 패널이 열리는 다른 과정에서도 회귀 여부를 육안 점검할 것.

---

## 4. 포함된 AWR/ASH SQL 블록 (원문 인용)

아래는 `assets/lessons/perf-club/session-4.md`에 포함된 [실무 스크립트]의 **원문 그대로**이다. 모두 Oracle 동적 성능 뷰(`V$*`) 및 AWR 이력 뷰(`DBA_HIST_*`)를 사용한다.

### [실무 스크립트 4-1] DB CPU 시간과 CPU AAS

```sql
-- [실무 스크립트 4-1] DB CPU 시간과 CPU AAS (실시간: V$SYS_TIME_MODEL)
SELECT stat_name, ROUND(value/1e6, 1) AS seconds
FROM   v$sys_time_model
WHERE  stat_name IN ('DB CPU', 'DB time', 'background cpu time');

-- 이력 구간 델타로 DB CPU AAS 계산 (DBA_HIST_SYS_TIME_MODEL)
SELECT sn.begin_interval_time,
       ROUND( (e.value - b.value) / 1e6
              / (EXTRACT(SECOND FROM (sn.end_interval_time - sn.begin_interval_time))
                 + EXTRACT(MINUTE FROM (sn.end_interval_time - sn.begin_interval_time))*60), 2)
       AS db_cpu_aas
FROM   dba_hist_sys_time_model b, dba_hist_sys_time_model e, dba_hist_snapshot sn
WHERE  b.stat_name = 'DB CPU' AND e.stat_name = 'DB CPU'
AND    e.snap_id = b.snap_id + 1 AND sn.snap_id = e.snap_id
AND    b.instance_number = e.instance_number
ORDER  BY sn.begin_interval_time;
```

### [실무 스크립트 4-2] AAS와 CPU/Wait 분해

```sql
-- [실무 스크립트 4-2] AAS와 CPU/Wait 분해
SELECT ROUND(dbt.value/1e6,1)  AS db_time_s,
       ROUND(cpu.value/1e6,1)  AS db_cpu_s,
       ROUND((dbt.value-cpu.value)/1e6,1) AS wait_time_s
FROM   v$sys_time_model dbt, v$sys_time_model cpu
WHERE  dbt.stat_name = 'DB time' AND cpu.stat_name = 'DB CPU';
```

### [실무 스크립트 4-3] TOP 대기 이벤트 + ASH 기반 대체 추출

```sql
-- [실무 스크립트 4-3] TOP 대기 이벤트 (실시간: V$SYSTEM_EVENT)
SELECT event, wait_class, total_waits, time_waited_micro/1e6 AS time_s,
       ROUND(RATIO_TO_REPORT(time_waited_micro) OVER () * 100, 1) AS pct
FROM   v$system_event
WHERE  wait_class <> 'Idle'
ORDER  BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;

-- ASH 기반 대체 추출 (Diagnostic Pack): 부하 구간의 대기 상위
SELECT event, COUNT(*) AS samples,
       ROUND(COUNT(*) * 100 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM   v$active_session_history
WHERE  sample_time BETWEEN TIMESTAMP '2026-07-15 09:55:00'
                       AND TIMESTAMP '2026-07-15 10:10:00'
AND    session_state = 'WAITING'
GROUP  BY event ORDER BY samples DESC FETCH FIRST 10 ROWS ONLY;
```

### [실무 스크립트 4-4] ASH로 부하 귀속 파악

```sql
-- [실무 스크립트 4-4] ASH로 부하 귀속 파악 (module/action/state/event)
SELECT module, action, session_state, event, COUNT(*) AS samples
FROM   v$active_session_history
WHERE  sample_time BETWEEN TIMESTAMP '2026-07-15 09:30:00'
                       AND TIMESTAMP '2026-07-15 10:10:00'
GROUP  BY module, action, session_state, event
ORDER  BY samples DESC FETCH FIRST 15 ROWS ONLY;
```

### [실무 스크립트 4-5] SGA 구성과 버퍼 캐시 advisory

```sql
-- [실무 스크립트 4-5] SGA 구성과 버퍼 캐시 advisory
SELECT pool, name, ROUND(bytes/1024/1024,1) AS mb FROM v$sgastat
WHERE  bytes > 50*1024*1024 ORDER BY bytes DESC;

-- 버퍼 캐시 크기별 예상 물리읽기 (V$DB_CACHE_ADVICE)
SELECT size_for_estimate AS cache_mb, estd_physical_read_factor AS pr_factor,
       estd_physical_reads
FROM   v$db_cache_advice
WHERE  name = 'DEFAULT' AND block_size = 8192 ORDER BY size_for_estimate;
```

### [실무 스크립트 4-6] 작업영역 histogram과 TEMP 사용

```sql
-- [실무 스크립트 4-6] 작업영역 histogram과 TEMP 사용
SELECT optimal_executions, onepass_executions, multipasses_executions
FROM   v$sql_workarea_histogram;   -- multipass > 0 이면 심각한 PGA 부족

SELECT s.sid, s.sql_id, ROUND(t.blocks*8192/1024/1024,1) AS temp_mb
FROM   v$tempseg_usage t JOIN v$session s ON s.saddr = t.session_addr
ORDER  BY t.blocks DESC FETCH FIRST 10 ROWS ONLY;

SELECT name, value FROM v$pgastat
WHERE  name IN ('aggregate PGA target parameter','total PGA allocated',
                'cache hit percentage','over allocation count');
```

### [실무 스크립트 4-7] 논리/물리 읽기율

```sql
-- [실무 스크립트 4-7] 논리/물리 읽기율 (V$SYSSTAT)
SELECT name, value FROM v$sysstat
WHERE  name IN ('session logical reads','physical reads',
                'physical reads direct','db block gets','consistent gets');
```

### [실무 스크립트 4-8] Hard Parse 비율과 Soft Parse %

```sql
-- [실무 스크립트 4-8] Hard Parse 비율과 Soft Parse %
SELECT name, value FROM v$sysstat
WHERE  name IN ('parse count (total)','parse count (hard)','execute count');
-- Soft Parse % = (1 - hard/total) * 100
```

### [실무 스크립트 4-9] Redo/commit과 커밋 동기 대기

```sql
-- [실무 스크립트 4-9] Redo/commit과 커밋 동기 대기
SELECT name, value FROM v$sysstat
WHERE  name IN ('redo size','user commits','redo writes');

SELECT event, total_waits, ROUND(time_waited_micro/1e6,1) AS time_s,
       ROUND(time_waited_micro/NULLIF(total_waits,0)/1000,2) AS avg_ms
FROM   v$system_event
WHERE  event IN ('log file sync','log file parallel write');
```

### [실무 스크립트 4-10] DB time 기여 상위 SQL + FMS 그룹 집계

```sql
-- [실무 스크립트 4-10] DB time 기여 상위 SQL + FMS 그룹 집계
SELECT sql_id, force_matching_signature AS fms, plan_hash_value,
       ROUND(elapsed_time/1e6,1) AS elapsed_s, executions, parse_calls,
       buffer_gets, disk_reads
FROM   v$sql
ORDER  BY elapsed_time DESC FETCH FIRST 15 ROWS ONLY;

-- 리터럴 파편화 진단: 같은 FMS로 묶으면 파싱 부하가 드러난다
SELECT force_matching_signature AS fms, COUNT(DISTINCT sql_id) AS sql_ids,
       SUM(parse_calls) AS parse_calls, ROUND(SUM(elapsed_time)/1e6,1) AS elapsed_s
FROM   v$sql
GROUP  BY force_matching_signature
HAVING COUNT(DISTINCT sql_id) > 1
ORDER  BY elapsed_s DESC;
```

### [실무 스크립트 4-10b] 과부하 SQL의 실행계획 실측 (DBMS_XPLAN)

```sql
-- [실무 스크립트 4-10b] 과부하 SQL의 실행계획 실측 (DBMS_XPLAN)
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR('9u1m3rg3a0b1x', NULL, NULL,
       'ALLSTATS LAST +COST +BYTES'));
```

> 참고: 3회차 본문(`session-3.md`)에도 AWR 계열 SQL이 있다 — `DBMS_XPLAN.DISPLAY_AWR('[TARGET_SQL_ID]')`, `DBA_HIST_SQL_PLAN` 조회 등. 4회차는 이를 전제로 확장한다.

---

## 5. sql.js(SQLite WASM) 실행 환경에서의 검증 가능성

- 본 워크스페이스의 SQL 실습·채점 엔진은 **jsDelivr CDN의 sql.js(SQLite WASM)** 이다.
- 위 §4의 SQL은 모두 **Oracle 전용**이다. 사용 객체가 SQLite에 존재하지 않는다:
  - 동적 성능 뷰: `v$sys_time_model`, `v$system_event`, `v$active_session_history`, `v$sysstat`, `v$sgastat`, `v$db_cache_advice`, `v$sql_workarea_histogram`, `v$tempseg_usage`, `v$pgastat`, `v$sql`
  - AWR 이력 뷰: `dba_hist_sys_time_model`, `dba_hist_snapshot`
  - Oracle 함수/구문: `DBMS_XPLAN.DISPLAY_AWR(...)`, `RATIO_TO_REPORT() OVER ()`, `FETCH FIRST n ROWS ONLY`, `EXTRACT(... FROM interval)`, `TIMESTAMP '...'` 리터럴 등
- 따라서 4회차 AWR/ASH SQL은 **sql.js에서 실행·자동채점되지 않으며**, 교재에서 "실무 절차를 학습하는 예시"로만 제시된다.
- 실제 4회차 캡스톤 실습(`panel-report-lab`)은 SQL을 실행하지 않는다. 대신 **사전 계산된 PERFLAB 스냅샷 지표표를 기준선과 비교·판독하고 리포트를 구성하면 즉시 자동 채점**하는 방식이다(§1.3, 패널 소개 문구). 즉 SQL 실행 엔진과 채점 엔진이 분리되어 있어 Oracle 전용 SQL의 미검증 문제를 우회한다.
- **폐쇄망 배포 유의:** 실습·채점의 렌더 자체는 sql.js CDN 로드에 의존하는 다른 패널과 배포 환경을 공유하므로, 오프라인 배포 시 jsDelivr CDN 접근 가능 여부(또는 로컬 번들 대체)를 반드시 확인해야 한다. 데이터 팩(§1.1 `labs/session-4-oracle-diagnostic/`)의 Oracle 적재 스크립트는 실제 Oracle 19c 환경에서만 재현 가능하다.

---

## 6. 편집 시 체크리스트 (author/후속 제작자용)

- [ ] 교재 본문 수정은 `assets/lessons/perf-club/session-4.md`만 편집한다(HTML 불필요).
- [ ] 실습 표/채점 로직 수정은 `app.js`의 `panel-report-lab` 블록(약 1308행~)만 편집한다.
- [ ] `partials/perf-club.html` 편집 시 범위를 `#panel-report-lab`·`tb-session4` 블록으로 한정한다. `#panel-explain`·`#panel-index`·`#panel-index-efficiency`는 다중 과정 공유 자산이므로 건드리지 않는다.
- [ ] AWR/ASH SQL을 인용/수정할 때 Oracle 전용 문법임을 명시하고, sql.js에서 실행되지 않음을 함께 표기한다.
- [ ] 변경 후 성능진단 소모임 외에 SQL 튜닝·데이터 모델링·방문자 통계 과정에서 공유 패널이 정상 동작하는지 육안 회귀 점검한다.
