# 성능진단 소모임 4회차 개선 변경 요약

> 기준일: 2026-07-24  
> 대상: 4회차 기획·교재·캡스톤 화면 및 채점 로직  
> 기준 DB: Oracle 19c. MySQL 8.0/PostgreSQL은 대응 차이를 병기하며, 브라우저 SQL 실행기는 sql.js(SQLite WASM)이다.

## 1. 변경 목적

4회차의 기존 학습 흐름인 **10대 지표 판독 → 증거 연결 → 원인 진단 → 조치·검증 보고서 작성**은 유지했다. 다만 학습자가 Oracle AWR/ASH SQL의 표본·누적값·실행계획을 잘못 해석하지 않도록 다음 세 가지 기술정확성을 필수 기준으로 강화했다.

1. 디스크 ASH의 표본 수를 실행 횟수나 1초 표본으로 오인하지 않고 `USECS_PER_ROW` 등 표본 대표시간으로 AAS를 보정한다.
2. AWR 누적값 델타는 동일 `DBID / INSTANCE_NUMBER / STARTUP_TIME` 경계에서 `LAG`로 계산하여 RAC 혼입·스냅샷 누락·재기동을 안전하게 처리한다.
3. `DISPLAY_AWR`의 과거 컴파일 계획과 `DISPLAY_CURSOR ALLSTATS LAST`/SQL Monitor의 실측 증거를 구분한다.

또한 Oracle 전용 진단 SQL이 sql.js(SQLite)에서 실행·자동채점되는 것처럼 보이지 않도록 실행환경과 검증 범위를 명시했다.

## 2. 수정·추가 파일

| 상대경로 (`PerformanceDiagnostics/` 기준) | 구분 | 무엇을 고쳤는가 | 왜 고쳤는가 |
|---|---|---|---|
| `curriculum/perf-club-session-4-improvement-spec.md` | 추가 | 파일·블록별 P0~P2 변경명세, Oracle SQL 수정안, MySQL/PostgreSQL 차이, sql.js 정적 검증 범위, 구현·회귀·승인 체크리스트를 작성했다. | 교재·화면·채점 로직이 같은 정확성 기준을 따르게 하고 구현자와 검수자의 완료 조건을 단일 문서로 고정하기 위해서다. |
| `assets/lessons/perf-club/session-4.md` | 수정 | Oracle 19c 및 라이선스 고지, sql.js 실행 한계, 반개구간 시간 조건을 추가했다. AWR 시간모델·대기·Top SQL을 안전한 구간 델타로 보완하고, 디스크 ASH AAS에 표본시간 가중을 반영했다. `DISPLAY_AWR`와 `DISPLAY_CURSOR ALLSTATS LAST`를 계획/실측 증거로 분리했으며, MySQL 8.0·PostgreSQL 대응표와 비동치 한계를 추가했다. 마지막에 SQL 정확성 필수 3개 체크를 넣었다. | 운영 SQL로 오용할 수 있는 산식과 증거 해석 오류를 막고, 실제 엔진이 SQLite인 학습환경에서 실행 가능 범위를 정확히 안내하기 위해서다. |
| `partials/perf-club.html` | 수정 | 4회차 전용 `#panel-report-lab`에 합성·사전 계산 증거를 판독하는 캡스톤이며 Oracle AWR/ASH SQL 및 sql.js 자동채점 대상이 아니라는 범위 배지를 추가했다. 기술정확성 필수 근거 영역과 관련 안내를 보강했다. `tb-session4`/`markdown-viewer-session4`의 기존 탭 구조는 유지했다. | 화면만 보아도 데이터 출처·실행 한계·증거 등급을 판단하고, 교재의 필수 정확성 기준을 캡스톤에서도 적용하게 하기 위해서다. |
| `app.js` | 수정 | `tb-session4`의 Markdown URL에 버전 쿼리(`?v=20260724`)를 부여했다. `initReportLab()`에 `ash_sample_weight`, `snapshot_restart_safe`, `plan_evidence_type` 근거를 추가하고, 하나라도 누락하면 기술정확성 만점을 제한하는 피드백을 넣었다. | 개정 교재의 브라우저 캐시 잔존을 줄이고, 결론·키워드만 맞춘 답안이 세 가지 핵심 오개념을 놓친 채 만점 처리되지 않게 하기 위해서다. |
| `curriculum/perf-club-session-4-change-summary.md` | 추가·갱신 | 본 변경 목록, 수정 이유, 커밋·푸시 범위와 검수 게이트를 기록하고 최종 검수 결과를 반영했다. | 완료 보고와 실제 파일 내용의 불일치를 방지하고 리뷰·배포 인수인계를 명확히 하기 위해서다. |
| `curriculum/perf-club-session-4-review.md` | 추가 | 원문 실측 대조 결과, 기술정확성 판정, 미흡 항목과 보완 조치, 푸시 전 승인 게이트를 확정했다. | 파일 생성이 불가능했던 read reviewer의 결과를 write 산출물로 남기고 조건부 승인 범위를 명확히 하기 위해서다. |

## 3. 변경하지 않는 범위

- `partials/perf-club.html`의 공유 레거시 패널 `#panel-explain`, `#panel-index`, `#panel-index-efficiency`는 이번 커밋의 수정 대상이 아니다. 이 패널들은 SQL튜닝·데이터모델링·방문자통계 등 여러 과정이 공유하므로 4회차 변경과 함께 수정하지 않는다.
- `tb-session1`~`tb-session3` 및 다른 과정의 탭·라우팅은 변경 대상이 아니다.
- 백엔드 3종 `server/cbt_api.py`, `tssurvey/server/tssurvey_api.py`, `tsclub/server/tsclub_api.py`와 SQLite 스키마는 변경하지 않는다. 이번 개선은 정적 교재와 프런트엔드 판독형 캡스톤에 한정된다.
- Oracle/MySQL/PostgreSQL 전용 진단 SQL을 sql.js(SQLite WASM) 자동채점 대상으로 전환하지 않는다. 해당 SQL의 승인은 정적 정확성 검토와 각 DB의 비운영 환경 검증으로 수행한다.

## 4. 커밋·푸시 대상

다음 6개 파일만 하나의 4회차 개선 커밋에 포함한다.

```text
curriculum/perf-club-session-4-improvement-spec.md
curriculum/perf-club-session-4-change-summary.md
curriculum/perf-club-session-4-review.md
assets/lessons/perf-club/session-4.md
partials/perf-club.html
app.js
```

권장 커밋 메시지:

```text
feat(perf-club): harden session 4 AWR/ASH diagnostics
```

이 문서 작성 단계에서는 커밋이나 원격 푸시를 수행하지 않았다. 최종 검수는 교재 중복 삽입 결함으로 **반려**되었다. `curriculum/perf-club-session-4-review.md`의 교재 정상본 복구, 공유 패널 diff 확인과 브라우저 스모크 테스트를 모두 통과해 재승인된 후 위 파일만 스테이징하여 현재 작업 브랜치에 커밋하고 팀이 지정한 원격 브랜치로 푸시한다. 로그·IDE 설정·운영 데이터와 무관한 파일 및 별도 선행 조사 산출물 `reports/session4_*`는 이번 커밋에 포함하지 않는다.

## 5. 커밋 전 검수 게이트

1. **파일 실존:** 위 6개 경로가 실제로 존재하고 비어 있지 않은지 확인한다.
2. **교재 정확성:** `session-4.md`에서 ASH 표본시간 보정, 재기동 안전 델타, 계획/실측 구분 및 MySQL/PostgreSQL 비동치 설명을 대조한다.
3. **화면·채점 연결:** `#panel-report-lab`의 필수 근거 3개가 `app.js:initReportLab()`의 동일 키와 연결되고, 누락 시 만점 제한 피드백이 표시되는지 확인한다.
4. **교재 탭:** `tb-session4` 최초 진입·재진입 시 `markdown-viewer-session4`에 개정 교재가 렌더되는지 확인한다.
5. **공유 패널 회귀:** 커밋 diff에서 `#panel-explain`, `#panel-index`, `#panel-index-efficiency` 블록의 변경이 없는지 확인하고, 관련 다중 과정의 패널 전환을 스모크 테스트한다.
6. **상충 문구:** “유일한 백엔드”처럼 3종 SQLite API 구조와 충돌하는 표현이 없는지 검색한다.
7. **배포 경계:** 폐쇄망 배포 시 jsDelivr의 sql.js/WASM CDN 의존성을 별도 확인한다.

## 6. 최종 검수 반영 상태

- 원문 실측 검수 결과는 `curriculum/perf-club-session-4-review.md`에 확정 저장했다.
- 교재 4.1 실행환경 안내부에 문서 제목·학습목표·4.0~4.1 서두가 여러 차례 삽입된 중대 무결성 결함을 발견했다. 단순 문장 교정으로 해소되지 않아 현재 상태는 **반려**다.
- `node --check PerformanceDiagnostics/app.js`는 통과했다.
- **재검수 게이트:** 정상본/diff 기준 교재 중복 제거와 구조 복구, Oracle/MySQL/PostgreSQL 및 세 정확성 SQL 보존 확인, 공유 레거시 패널 비변경 확인, 브라우저에서 교재 최초 진입·재진입/리셋/만점 제한, 다중 과정 패널 전환 스모크 테스트.

재검수 게이트가 모두 통과하고 승인된 뒤에만 커밋·원격 푸시한다.
