# 강의자료(PPT 슬라이드) 제작 지침

다른 메뉴/과정/회차에도 **"🖥️ 강의자료 보기"** 슬라이드를 일관되게 추가하기 위한 표준 절차·디자인·컴포넌트 가이드.

> 한 줄 요약: **HTML 덱 파일 1개 + 버튼 1개** = 완성. JS 수정 불필요.

---

## 1. 구성 파일

| 파일 | 역할 |
|---|---|
| `assets/js/slides.js` | 뷰어(오버레이·네비게이션). **수정 불필요** |
| `assets/css/slides.css` | 슬라이드 디자인(Spharos). 컴포넌트 클래스 제공 |
| `assets/slides/<영역>/<이름>.html` | **덱 콘텐츠**(여기를 만든다) |
| 메뉴/패널의 `.btn-open-slides` 버튼 | 덱을 여는 진입점 |

뷰어는 **세로 스크롤 덱**: 클릭 · ↓·→·Space · 스크롤 = 다음 장, ↑·← = 이전, Esc/✕ = 닫기. 상단 진행바·`n/N` 카운터 자동.

---

## 2. 다른 메뉴에 추가하는 법 (2단계)

### ① 덱 HTML 작성
`assets/slides/<영역>/<이름>.html` 생성. **슬라이드 = `<section class="ts-slide">`** 의 나열. 첫 장은 `cover`.

```html
<section class="ts-slide cover">
  <div class="inner">
    <div class="s-kicker">과정 · 1강</div>
    <div class="s-title">강의 제목</div>
    <p class="s-lead">한 줄 소개</p>
  </div>
</section>

<section class="ts-slide">
  <div class="inner">
    <div class="s-kicker">분류</div>
    <div class="s-title">슬라이드 제목</div>
    <div class="s-cols">
      <div class="main"> … 본문(카드/표/코드/수식) … </div>
      <aside class="s-aside">
        <div class="h">부가자료</div>
        <ul><li>심화/팁/수치 …</li></ul>
      </aside>
    </div>
  </div>
</section>
```

### ② 버튼 추가
대상 메뉴(예: 학습자료 탭바)에 버튼 한 개. `data-deck-file`만 주면 끝:

```html
<button class="btn-open-slides" type="button"
        data-deck-title="SQL 기초 — 1강"
        data-deck-file="assets/slides/sql-foundation/lesson-1.html?v=8.1">
  🖥️ 강의자료 보기
</button>
```
- 탭바 안에 두면 `margin-left:auto`로 **우측 정렬**됨.
- `?v=` 캐시 버전을 붙이면 안전(없어도 `no-store`로 매번 최신).
- 한 버튼이 한 덱을 연다. 회차가 여러 개면 회차별 버튼 또는 회차별 `data-deck-file`.

> 그게 전부입니다. `slides.js`의 레지스트리를 건드릴 필요 없음.
> (소모임처럼 "활성 탭 따라 회차 전환"이 필요하면 `slides.js`의 `DECKS`/`activeSession` 패턴 참고.)

---

## 3. 슬라이드 구조 규칙

- 한 장 = `<section class="ts-slide"><div class="inner"> … </div></section>`.
- 표지 = `<section class="ts-slide cover">`(네이비 면).
- 내용 슬라이드는 **여백 없이 채운다** → 거의 항상 `s-cols`(본문 + 부가자료) 2단.
- 제목 영역(`s-kicker`+`s-title`)은 컬럼 위에 풀폭으로.
- 좌하단 시그니처 푸터는 CSS가 자동(텍스트는 `slides.css`에서 수정).

---

## 4. 디자인 규칙 (Spharos — 필수 준수)

`spharos_design.md` 기준. 어기면 브랜드 깨짐.

- 🎨 **팔레트**: 네이비 `#002A5B`(구조) 30 / 옐로 `#F9BB00`(강조) 10 / 라이트·틴트 60.
- ⛔ **한쪽 띠(`border-left` 등) 금지** — 강조는 **전체 보더 · 배경 틴트 · 노란 사각 불릿 · 채운 배지**로.
- ⛔ **옐로 위 흰 글씨 금지** — 옐로/골드 면 위 텍스트는 **네이비/잉크**. 네이비 면 위는 흰색.
- 🔠 폰트: 본문 **Pretendard**, 코드/수식 **D2Coding**.
- 📐 16:9 지향(내용 많으면 세로로 늘어남). 제목 700 + 본문 400, 밑줄 장식 지양.

---

## 5. 비주얼 컴포넌트 레퍼런스

| 클래스 | 용도 |
|---|---|
| `s-kicker` / `s-title` / `s-lead` | 분류 라벨 / 제목 / 도입 문장 |
| `s-sub` | 슬라이드 내 소제목(섹션 구분) |
| `s-cols` > `.main` + `aside.s-aside` | **본문 + 부가자료 2단** (부가자료엔 `.h` 헤더 + `ul`) |
| `s-grid` > `s-card` | 카드 그리드. 색: `.r`(빨강) `.g`(초록) `.c`(블루) `.y`(옐로) `.hl`(골드 강조面) — 불릿 색만 바뀜(띠 아님) |
| `s-formula` ( `.hl` 강조, `small` 부연) | 네이비 수식 카드 |
| `s-table` | 표(네이비 헤더 · 틴트 줄무늬). 셀 안 `code` 가능 |
| `s-code` ( `.k` 키워드 `.c` 주석) | 코드/SQL 블록(잉크 면) |
| `s-arch` > `.box`(`.navy`) , `.plus` | 아키텍처 박스 |
| `s-bars` > `s-bar`(`.lab`/`.track`>`.fill`(`.y`)/`.val`) | 분포 막대 |
| `s-flow` > `.step` + `.arrow` | 흐름(장애 시나리오 등) |
| `s-note` | 강조 콜아웃(골드 틴트, 잉크 글씨) |
| `s-err` | 에러/주의 콜아웃(레드 보더) — ORA 에러 등 |
| `s-keys` | 핵심 정리 리스트(노란 사각 불릿) |

> 새 컴포넌트가 필요하면 `slides.css`에 **띠 없이**(전체 보더/틴트/배지) 추가하고 이 표에 등록.

---

## 6. 콘텐츠 깊이 기준 (중요)

- **원본 학습자료(.md) 전체를 담는다.** 요약이 아니라 강의가 되도록.
- 회차/강당 **약 15~20장**, 각 장은 **본문 + 부가자료**로 **여백 없이**.
- **부가자료(`s-aside`)** = 다음 중 골라 채움:
  - 심화 개념 · 실무 팁 · **관련 V$/뷰·파라미터** · 수치/임계값 · 주의사항 · 미니 예시 · 다음 회차 예고.
- 수식·코드·표·다이어그램을 적극 사용(텍스트 나열 지양).
- 마지막 장은 **"한 장 정리"**(`s-keys`) + 부가자료에 평가 포인트/예고.

---

## 7. 캐시 / 버전

- 덱 HTML은 뷰어가 `cache: no-store`로 가져와 **항상 최신**(버튼 `?v=` 생략 가능).
- `slides.css`/`slides.js`를 고치면 `index.html`의 `?v=`를 올린다.
- 소모임 `DECKS`의 파일 경로 `?v=`는 css/js 버전과 맞춰두면 깔끔.

---

## 8. 체크리스트

- [ ] `assets/slides/<영역>/<이름>.html` 작성 (첫 장 `cover`, 내용은 `s-cols` 2단)
- [ ] Spharos 준수: **띠 0개**, 옐로 위 네이비, 노란 사각 불릿
- [ ] 원본 자료 깊이 반영 + 부가자료로 여백 채움
- [ ] 대상 메뉴에 `.btn-open-slides` + `data-deck-file`(+`data-deck-title`) 버튼
- [ ] 로컬 http 서버로 열어 클릭/스크롤/Esc 동작·여백·대비 확인
- [ ] (css/js 변경 시) `index.html` `?v=` 상향

---

## 9. 현황(참고 구현)

- `assets/slides/perf-club/session-1·2·3.html` — 성능진단 소모임 1~3회차(본문+부가자료 2단, 회차당 17~23장).
- 진입: `partials/perf-club.html`의 학습자료 탭바 우측 `🖥️ 강의자료 보기`(활성 회차 기준).
