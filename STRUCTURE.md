# 사이트 구조 & 파일 분리 가이드

TS Academy(다중 교육과정 플랫폼)의 디렉터리 구조와 파일 분리 원칙입니다. **한 파일이 비대해지지 않도록** 신규 작업은 아래 규칙을 따릅니다.

## 디렉터리 구조
```
/
├── index.html              # 셸(레이아웃·사이드바·패널 컨테이너). 점진적으로 경량화.
├── style.css               # 공통 테마/컴포넌트 CSS
├── app.js                  # 현재 과정(DB 튜닝 마스터) 랩 로직 — 추후 모듈 분리 예정
├── challenges.js, visualizers.js
├── assets/
│   ├── css/                # 기능별 CSS (academy.css = 홈 로드맵)
│   └── js/                 # 기능별 JS  (academy.js = 홈 로드맵 렌더)
├── curriculum/             # ★ 교육 로드맵·커리큘럼의 단일 원천(SoT, md)
│   ├── ROADMAP.md          # 2-트랙 마스터 로드맵
│   ├── foundation/         # 공통 베이스(SQL 기초)
│   ├── tuning/             # 트랙 A: DB 튜닝 (01~03)
│   └── design/             # 트랙 B: DB 설계 (01~03)
└── session_*.md            # 현재 과정 학습자료 원문
```

## 핵심 원칙
1. **커리큘럼은 `curriculum/`의 md가 원천**이다. 홈 로드맵(`assets/js/academy.js`의 `ACADEMY` 데이터)과 항상 일치시킨다.
2. **신규 코드는 파일 분리**: 새 기능/과정은 `assets/css/*.css`, `assets/js/*.js`로 추가하고 `index.html`에서 링크한다. `app.js`/`index.html`에 계속 쌓지 않는다.
3. **자격증 표현 금지**: 단계 명칭은 역량 기준(예: "SQL 전문가")으로만. SQLD/SQLP 등 자격증명은 쓰지 않는다.
4. **캐시 버스팅**: 정적 파일 변경 시 `?v=x.y`를 함께 올린다(현재 `2.9`).

## 교육 로드맵(2-트랙) 매핑
| 화면 노드 | 상태 | 구현 위치 |
|---|---|---|
| DB 튜닝 마스터 (트랙 A·L4) | 운영 중 | 현재 `index.html` 패널 + `app.js` |
| 고성능 DB 설계 (트랙 B·L3) | 기획 완료 | `curriculum/design/02-highperf-db-design.md` |
| 그 외 노드 | 기획 | `curriculum/**` |

## 점진적 분리 로드맵(향후)
현재 과정은 동작 유지를 위해 한 번에 쪼개지 않고 **단계적으로** 분리한다.
1. **(완료)** 홈 로드맵을 `assets/`로 분리, 커리큘럼을 `curriculum/`로 외부화.
2. 신규 과정(고성능 DB 설계)은 처음부터 `assets/js/courses/design/*.js` + 패널 partial로 **과정 단위 분리** 구현.
3. `app.js`의 랩 함수군을 주제별 파일(`assets/js/labs-*.js`)로 분리하고 순서대로 로드.
4. `index.html`의 패널 HTML을 과정별 partial로 분리하고 **과정 진입 시 fetch 지연 로딩**(페이지 로딩 최적화).
5. 학습자료 인라인 마크다운(`<script type="text/markdown">`)을 `session_*.md` fetch로 외부화.

> 2~5단계는 동작 검증을 동반해 한 단계씩 진행한다(대규모 일괄 변경 지양).
