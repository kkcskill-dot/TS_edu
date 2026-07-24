# 성능진단 소모임 4회차 최종 검수보고서

> 검수일: 2026-07-24  
> 검수 범위: 개선명세, 교재, 4회차 전용 화면·채점 로직, 변경요약  
> 방식: `list_dir`·`grep`·`read_file` 원문 대조 및 `node --check PerformanceDiagnostics/app.js` 정적 구문 검사

## 1. 종합 판정

**반려(커밋·푸시 금지).**

요청된 산출물과 구현 파일은 모두 실제로 존재한다. 화면·채점 로직에는 세 가지 기술정확성 기준이 반영되어 있으나, 교재 실행환경 안내부에 문서 앞부분이 여러 차례 중복 삽입된 중대 무결성 결함이 실측 확인되었다. 단순 문장 교정으로 해소되지 않았으므로 교재를 정상본과 대조 복구한 뒤 재검수가 필요하다.

다만 현재 검수는 정적 대조 중심이다. 공유 패널의 **현재 존재와 4회차 변경 비대상 선언**은 확인했으나, 기준 커밋과의 diff 및 실제 브라우저에서 다중 과정 패널 전환·재진입을 실행하지 못했다. 따라서 원격 푸시 전 아래 보류 게이트를 통과해야 한다.

## 2. 파일 실존 및 완료 보고 대조

| 경로 (`PerformanceDiagnostics/` 기준) | 상태 | 대조 결과 |
|---|---:|---|
| `curriculum/perf-club-session-4-improvement-spec.md` | 확인 | P0~P2 변경명세, SQL 정확성 기준, 구현·회귀 조건 존재 |
| `assets/lessons/perf-club/session-4.md` | 확인·반려 | Oracle 19c/라이선스/sql.js 한계, AWR·ASH 수정 SQL, MySQL/PG 대응은 존재하나, 4.1 실행환경 안내부에 문서 서두가 반복 삽입되어 구조가 훼손됨 |
| `partials/perf-club.html` | 확인 | `#panel-report-lab`, `tb-session4`, `markdown-viewer-session4`와 정확성 안내 존재 |
| `app.js` | 확인 | 교재 URL 버전값, `initReportLab()`, 필수 정확성 키 3개와 채점 제한 로직 존재 |
| `curriculum/perf-club-session-4-change-summary.md` | 확인·갱신 대상 | 변경 내역은 구현과 일치하며 본 검수보고서 및 보완 내역을 커밋 목록에 추가해야 함 |

이전 reviewer가 생성하지 못한 최종 검수보고서는 본 파일로 확정한다. 별도 `reports/session4_review.md`는 다른 산출물(`reports/session4_*`)에 대한 선행 검수 기록이므로 본 구현 최종 검수의 대체물이 아니다.

## 3. 기술정확성 검증

### 3.1 ASH AAS 표본간격 보정 — 통과

- 교재는 `DBA_HIST_ACTIVE_SESS_HISTORY`의 디스크 표본을 단순 `COUNT(*) / elapsed_s`로 계산하지 않고 `USECS_PER_ROW` 기반 대표시간 가중을 설명한다.
- 화면·JS에는 `ash_sample_weight`가 같은 의미로 연결되어 있다.
- sql.js에서 Oracle 사전 뷰를 실행·자동채점하지 않고 정적 검토 및 비운영 DB 검증 대상으로 한정한다.

### 3.2 재기동 안전 스냅샷 델타 — 통과

- 교재는 동일 `DBID / INSTANCE_NUMBER / STARTUP_TIME` 경계의 `LAG`와 누적값 역전 배제를 사용한다.
- 화면·JS에는 `snapshot_restart_safe`가 같은 기준으로 연결되어 있다.
- `SNAP_ID + 1`만으로 운영 델타를 연결하는 방식을 안전한 예제로 제시하지 않는다.

### 3.3 실행계획과 실측 증거 구분 — 통과

- `DISPLAY_AWR`는 과거 컴파일 계획·예상치, `DISPLAY_CURSOR ALLSTATS LAST`/SQL Monitor는 실측 증거로 구분되어 있다.
- 화면·JS에는 `plan_evidence_type`이 연결되어 있으며 세 필수 항목 중 하나라도 누락하면 기술정확성 만점을 제한한다.

### 3.4 Oracle + MySQL/PostgreSQL 병기 — 통과(정적)

- 교재에 Oracle 19c 기준과 MySQL 8.0/PostgreSQL 대응 및 비동치 한계가 병기되어 있다.
- AWR/ASH와 동일 기능이 없는 제품에 기계적 1:1 대응을 주장하지 않는다.
- 실제 Oracle/MySQL/PostgreSQL 서버 실행 검증은 수행하지 않았으므로 운영 적용 전 각 DB 비운영 환경에서 별도 검증해야 한다.

## 4. 화면·채점 및 회귀 경계

- `partials/perf-club.html`에서 4회차 전용 `#panel-report-lab`과 `tb-session4`/`markdown-viewer-session4`를 확인했다.
- 화면에 합성·사전 계산 증거, Oracle SQL 미실행, sql.js 자동채점 비대상 안내가 표시된다.
- `app.js`의 교재 매핑은 `assets/lessons/perf-club/session-4.md?v=20260724`이며 `initReportLab()`에 필수 키 3개가 존재한다.
- 공유 레거시 패널 `#panel-explain`, `#panel-index`, `#panel-index-efficiency`의 현재 존재를 확인했다. 다만 기준 커밋 diff를 확보하지 못했으므로 “바이트 단위 미변경”은 푸시 전 diff로 최종 확인해야 한다.
- `node --check PerformanceDiagnostics/app.js`는 오류 없이 통과했다.

## 5. 상충 문구 및 플랫폼 경계

- 실제 구현·교재에서 특정 API를 “유일한 백엔드”로 단정하는 상충 문구는 발견되지 않았다. 검색 결과 해당 표현은 검수 지침/설명 문맥에만 존재한다.
- 변경요약은 백엔드 3종 `server/cbt_api.py`, `tssurvey/server/tssurvey_api.py`, `tsclub/server/tsclub_api.py`를 모두 명시하며 이번 변경 대상에서 제외한다.
- sql.js는 jsDelivr CDN에 의존하는 코드가 있으므로 폐쇄망 배포 전 JS/WASM 로컬 제공 여부를 별도 확인해야 한다.

## 6. 발견 미흡 항목과 조치

| 등급 | 항목 | 조치/상태 |
|---|---|---|
| P0 | `session-4.md` 4.1 실행환경 안내부에 문서 제목·학습목표·4.0~4.1 서두가 여러 차례 재삽입되어 중복·문장 훼손 발생 | 정상본/변경 diff를 기준으로 중복 블록 제거 후 제목 1회, 4.0 1회, 4.1 1회인지 확인해야 함 — **미해소·반려** |
| P1 | 공유 패널 비변경을 기준 커밋 diff로 증명하지 못함 | 커밋 전 `git diff`에서 세 공유 패널 블록 비변경 확인 필요 — 보류 |
| P1 | 브라우저 최초 진입·재진입, 리셋, 필수 근거 누락 시 만점 제한을 실제 클릭 검증하지 못함 | 로컬 브라우저 스모크 테스트 필요 — 보류 |
| P2 | Oracle/MySQL/PostgreSQL 실서버 실행 검증 미수행 | 운영 반영 전 각 DB 비운영 환경에서 검증 — 문서화된 제한 |

## 7. 최종 승인 게이트

**재검수 전 필수**

1. `session-4.md`를 정상본/변경 diff와 대조해 4.1 안내부에 삽입된 중복 서두를 제거한다. 제목·학습목표·4.0·4.1 앵커가 의도한 횟수만 존재하는지 검색한다.
2. 교재의 Oracle/MySQL/PostgreSQL 병기와 세 정확성 SQL이 복구 과정에서 유실되지 않았는지 다시 대조한다.
3. diff에서 `#panel-explain`, `#panel-index`, `#panel-index-efficiency` 변경이 없음을 확인한다.
4. `tb-session4` 최초 진입·재진입 시 개정 교재가 정상 순서로 렌더되는지 확인한다.
5. 캡스톤 리셋 후 필수 근거 3개가 초기화되고, 누락 시 기술정확성 만점 제한 피드백이 표시되는지 확인한다.
6. SQL튜닝·데이터모델링·방문자통계 등 공유 패널 참조 과정의 전환을 스모크 테스트한다.

위 항목을 모두 통과하고 재검수 승인을 받기 전에는 커밋·푸시하지 않는다.
