# Spharos Design System

> SHINSEGAE I&C **Spharos** 브랜드의 시각 컨셉을 웹(및 문서)에 일관되게 적용하기 위한 디자인 가이드.
> PPT 템플릿(`Spharos_PPT_Template v2.1`)에서 추출·정규화한 토큰을 기준으로 한다.

---

## 1. 브랜드 컨셉

- **키워드**: 신뢰(Trust) · 명료(Clarity) · 선명한 강조(Sharp Accent)
- **무드**: 라이트 배경 + 딥네이비 구조 + 옐로우 포인트의 미니멀리즘
- **시그니처**: 좌하단 **로고 + 카피라이트** 푸터 (※ 옐로우 웨지 모티프는 사용하지 않음)
- **운용 원칙(60·30·10)**: 화이트/그레이 60% · 네이비 30% · 옐로우 10%
  - 옐로우는 "강조/액션/미래"에만. 넓은 면적 배경으로 쓰지 않는다.

---

## 2. 컬러 팔레트

### 2.1 Core

| 역할 | 이름 | HEX | 용도 |
|---|---|---|---|
| Primary | **Navy** | `#002A5B` | 구조색 — 헤더 밴드, 배지, 강조 텍스트, 버튼 |
| Heading | **Ink** | `#121D2A` | 제목·본문 강조(near-black navy) |
| Accent | **Yellow** | `#F9BB00` | 포인트 — 액센트 바, 태그, 하이라이트, 웨지 |

### 2.2 Neutral

| 이름 | HEX | 용도 |
|---|---|---|
| Gray BG | `#EFEFEF` | 밴드/박스 배경(핵심 메시지 등) |
| Card BG | `#F7F8FA` | 카드 배경 |
| Line | `#E3E6EB` | 보더·구분선 |
| Body | `#424A57` | 본문 텍스트 |
| Slate | `#64748B` | 보조 라벨·중립 태그 |
| Muted | `#8A93A3` | 캡션·비활성 |
| White | `#FFFFFF` | 페이지 기본 배경 |

### 2.3 Accent 보조 (데이터 시각화용 블루)

테마에 내장된 블루 계열. 차트/그래프 등 정보 구분이 필요할 때만 사용.

`#094186` · `#0953AC` · `#0061D7` · `#0073FD`

### 2.4 Semantic / Highlight

| 의미 | 배경 | 보더 | 텍스트 |
|---|---|---|---|
| Highlight(사례/신규) | `#FFF6DA` | `#F9BB00` | `#121D2A` |
| Plan/Future(강조) | `#F9BB00` | — | `#121D2A` |
| Neutral/Done(중립) | `#EFEFEF` / `#64748B` | — | `#FFFFFF`(slate 위) |

### 2.5 접근성 규칙 (중요)

- **옐로우(`#F9BB00`) 위 텍스트는 반드시 Ink/Navy** (흰색 금지 — 대비 부족).
- **네이비(`#002A5B`) 위 텍스트는 흰색**.
- 본문 최소 대비 4.5:1 유지 (Body `#424A57` on White = OK).

---

## 3. CSS 토큰 (copy & paste)

```css
:root {
  /* core */
  --sph-navy:   #002A5B;
  --sph-ink:    #121D2A;
  --sph-yellow: #F9BB00;

  /* neutral */
  --sph-bg:        #FFFFFF;
  --sph-gray:      #EFEFEF;
  --sph-card:      #F7F8FA;
  --sph-line:      #E3E6EB;
  --sph-body:      #424A57;
  --sph-slate:     #64748B;
  --sph-muted:     #8A93A3;

  /* highlight */
  --sph-hl-bg:     #FFF6DA;
  --sph-hl-border: #F9BB00;

  /* data-viz blues */
  --sph-blue-1: #094186;
  --sph-blue-2: #0953AC;
  --sph-blue-3: #0061D7;
  --sph-blue-4: #0073FD;

  /* typography */
  --sph-font: "Pretendard", "맑은 고딕", "Malgun Gothic",
              -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif;

  /* radius / spacing */
  --sph-radius: 6px;
  --sph-radius-sm: 4px;
  --sph-gap: 16px;

  /* elevation */
  --sph-shadow: 0 2px 8px rgba(18,29,42,.08);
}
```

---

## 4. 타이포그래피

- **서체**: PPT는 `맑은 고딕`. 웹은 **Pretendard** 권장(한글 가독성·웨이트 다양), 폴백으로 맑은 고딕/시스템.
- **원칙**: 제목 Bold(700) + 본문 Regular(400). 강조는 색(Navy)·하이라이트로, 밑줄 장식 금지.

| 토큰 | 크기 | 두께 | 색 | 용도 |
|---|---|---|---|---|
| Display | 28–32px | 700 | Ink | 페이지/슬라이드 타이틀 |
| H2 / Section | 18–20px | 700 | Ink | 섹션 제목 |
| H3 / Card title | 15–16px | 700 | Navy | 카드 제목 |
| Body | 14–15px | 400 | Body | 본문 |
| Caption | 12–13px | 400 | Muted | 보조·출처 |
| Kicker | 12px | 700 | Navy | 라벨(대문자/자간 +1px) |

```css
.sph-kicker { font-size:12px; font-weight:700; color:var(--sph-navy);
  letter-spacing:1px; text-transform:uppercase; }
.sph-title  { font-size:30px; font-weight:700; color:var(--sph-ink); line-height:1.2; }
.sph-h2     { font-size:19px; font-weight:700; color:var(--sph-ink); }
.sph-body   { font-size:15px; color:var(--sph-body); line-height:1.6; }
.sph-caption{ font-size:12px; color:var(--sph-muted); }
```

---

## 5. 로고

- **자산**: `sgnc_logo.png` (적벚꽃 심볼 + `SHINSEGAE I&C` 워드마크, 원본 5562×700, 비율 ≈ 7.95:1)
- **배치**: 페이지/슬라이드 **좌하단**, 옆에 `© SHINSEGAE I&C Inc. All Rights Reserved.`
- **여백(clear space)**: 심볼 높이의 0.5배 이상 여백 확보
- **최소 크기**: 웹 기준 높이 ≥ 20px (가독 유지)
- **금지**: 비율 왜곡, 색상 변경, 그림자/테두리 추가, 저대비 배경 위 배치

---

## 6. 시그니처 모티프 — (옐로우 웨지: 미사용)

> ⛔ **옐로우 웨지 모티프는 사용하지 않는다.** (이전 버전의 우상단 삼각형 모티프는 폐기)
> 강조가 필요하면 9.1의 대체 패턴(태그·배지·면 틴트·아이콘)을 사용한다. 옐로우는 포인트 요소로만.

---

## 7. 컴포넌트

> ⚠️ 모든 컴포넌트는 **색상 띠(한쪽 변만 두꺼운 컬러 보더/상단 바) 없이** 설계한다. 강조는 9.1의 대체 패턴으로.

### 7.1 Section Label (띠 없음 — 굵은 제목 + 선택적 점 마커)
```css
.sph-seclabel > b { font-size:19px; font-weight:700; color:var(--sph-ink); }
/* (선택) 제목 앞 소형 정사각 마커 — 긴 띠가 아닌 점 */
.sph-seclabel--mark > b::before {
  content:"■"; color:var(--sph-yellow); font-size:11px;
  margin-right:8px; vertical-align:2px;
}
```

### 7.2 Key Message Bar (그레이 면 박스 — 좌측 띠 없음)
```css
.sph-keymsg {
  background:var(--sph-gray);
  border-radius:var(--sph-radius-sm);
  padding:12px 16px; color:var(--sph-ink); font-weight:700;
}
.sph-keymsg .label { color:var(--sph-navy); margin-right:8px; } /* 색·굵기로 강조 */
```

### 7.3 Card (전체 보더만 — 한쪽 액센트 띠 없음)
```css
.sph-card {
  background:var(--sph-card);
  border:1px solid var(--sph-line);     /* 전체 1px 보더 OK, 한쪽 띠 금지 */
  border-radius:var(--sph-radius);
  padding:16px;
}
/* 강조 카드: 좌측 띠 대신 면 전체 틴트로 */
.sph-card--accent { background:var(--sph-hl-bg); border-color:var(--sph-hl-border); }
```

### 7.4 Number Badge (네이비 원/사각 + 번호)
```css
.sph-badge {
  display:inline-flex; align-items:center; justify-content:center;
  width:34px; height:34px; border-radius:50%;
  background:var(--sph-navy); color:#fff; font-weight:700;
}
.sph-badge--yellow { background:var(--sph-yellow); color:var(--sph-ink); }
```

### 7.5 Tag / Pill
```css
.sph-tag { display:inline-block; padding:2px 10px; border-radius:999px;
  font-size:12px; font-weight:700; }
.sph-tag--navy   { background:var(--sph-navy);   color:#fff; }
.sph-tag--yellow { background:var(--sph-yellow); color:var(--sph-ink); }   /* 강조/신규/계획 */
.sph-tag--gray   { background:var(--sph-gray);   color:var(--sph-slate); } /* 중립/완료 */
```

### 7.6 Stat / KPI (상단 띠 없음 — 큰 숫자 색으로 강조)
```css
.sph-stat { background:var(--sph-gray); border-radius:var(--sph-radius-sm);
  padding:14px; text-align:center; }
.sph-stat .v { font-size:28px; font-weight:700; color:var(--sph-navy); } /* 강조는 숫자 */
.sph-stat .l { font-size:12px; color:var(--sph-slate); }
```

### 7.7 Step / Flow Node (상단 띠 없음 — 번호 배지로 강조)
```css
.sph-flow { display:flex; align-items:stretch; gap:0; }
.sph-step { flex:1; background:var(--sph-card); border:1px solid var(--sph-line);
  border-radius:var(--sph-radius-sm); padding:14px; text-align:center; }
.sph-step .badge { /* 7.4 .sph-badge 재사용 — 액센트는 배지가 담당 */ }
.sph-step .t { font-weight:700; color:var(--sph-navy); }
.sph-step .o { font-size:12px; color:var(--sph-slate); }
.sph-flow .arrow { align-self:center; color:var(--sph-yellow); font-weight:700;
  font-size:20px; padding:0 8px; }
```

### 7.8 Highlight / Case Box
```css
.sph-callout { background:var(--sph-hl-bg); border:1px solid var(--sph-hl-border);
  border-radius:var(--sph-radius-sm); padding:12px 14px; color:var(--sph-ink); }
.sph-callout .label { /* "사례"/"신규" */
  display:inline-block; background:var(--sph-yellow); color:var(--sph-ink);
  font-size:12px; font-weight:700; padding:2px 8px; margin-bottom:6px; }
```

### 7.9 Button
```css
.sph-btn { display:inline-flex; align-items:center; gap:6px;
  padding:10px 18px; border-radius:var(--sph-radius); font-weight:700;
  border:1px solid transparent; cursor:pointer; }
.sph-btn--primary { background:var(--sph-navy); color:#fff; }
.sph-btn--primary:hover { background:#063a73; }
.sph-btn--accent  { background:var(--sph-yellow); color:var(--sph-ink); } /* CTA */
.sph-btn--ghost   { background:#fff; color:var(--sph-navy);
  border-color:var(--sph-line); }
```

### 7.10 Footer
```css
.sph-footer { display:flex; align-items:center; gap:12px;
  padding:12px 24px; border-top:1px solid var(--sph-line); }
.sph-footer img { height:22px; }
.sph-footer .copy { font-size:11px; color:var(--sph-muted); }
.sph-footer .page { margin-left:auto; font-weight:700; color:var(--sph-navy); }
```

---

## 8. 레이아웃 & 스페이싱

- **그리드**: 12컬럼, gutter 24px, 최대 콘텐츠 폭 1200px
- **스페이싱 스케일**: 4 · 8 · 12 · 16 · 24 · 32 · 48 (px)
- **여백**: 섹션 간 32–48px, 카드 내부 16px, 요소 간 최소 8px
- **라운드**: 기본 6px, 소형 4px (브랜드는 각진 편 — 과한 라운드 지양)
- **그림자**: `--sph-shadow` 정도로 절제

---

## 9. Do / Don't

**Do**
- 옐로우는 강조·액션·"미래/신규/계획"에만 (포인트로 소량)
- 네이비=구조, 옐로우=포인트 역할 분리 유지
- 강조는 **텍스트 색·굵기, 채워진 태그/배지, 배경 틴트 박스**로 (아래 9.1 참고)
- 데이터·수치는 Stat 컴포넌트로 또렷하게

**Don't**
- ⛔ **항목 위/옆 색상 띠 금지** — 좌측 액센트 바, 상단 컬러 바, 측면 리본/스트라이프 등
  카드·라벨·밴드·스텝 어디에도 **막대형 색 띠를 두르지 않는다.** (이 시스템의 1순위 금지)
- 옐로우 넓은 면적 배경, 옐로우 위 흰 글씨
- 제목 밑줄 장식, 무지개색 남발, 과한 그림자/그라데이션
- 로고 변형(색·비율·효과), 저대비 텍스트
- ⛔ 옐로우 웨지(삼각) 모티프 사용 금지 (폐기됨)

### 9.1 색상 띠 없이 강조하기 (대체 패턴)

띠(긴 막대형 색 면)를 쓰지 않고 강조하는 **허용 패턴**:

| 대신 이렇게 | 설명 |
|---|---|
| **텍스트 색·굵기** | 키워드를 Navy Bold, 수치를 Navy/Yellow로 |
| **채워진 태그·배지** | 필(pill) 태그, 원형 번호 배지 (면이 아닌 객체) |
| **배경 틴트 박스** | 박스 전체를 옅은 톤으로(예: 사례 박스 `#FFF6DA`) — 띠가 아닌 면 |
| **전체 보더(1px)** | 항목 전체를 감싸는 가는 보더는 허용 (한쪽만 두꺼운 띠는 금지) |
| **소형 정사각 마커** | 제목 앞 8px `■` 같은 점 마커는 허용 (긴 띠는 불가) |
| **아이콘** | 의미 전달용 아이콘으로 포인트 |

> 핵심: **"한쪽 변만 두껍게/색으로" = 금지**, **"객체(태그·배지·아이콘)" 또는 "면 전체 틴트" = 허용**.

---

## 10. 자산 위치

- 로고: `./하반기_보고_assets/sgnc_logo.png`
- 참고 PPT: `Spharos_PPT_Template v2.1`

---

## 11. 최소 페이지 마크업 예시

```html
<header class="sph-hero">
  <p class="sph-kicker">SPHAROS · TECH</p>
  <h1 class="sph-title">제목이 들어갑니다</h1>
  <div class="sph-keymsg"><span class="label">핵심 메시지</span>한 줄 요약 문장</div>
</header>

<section>
  <div class="sph-seclabel"><b>섹션 제목</b></div>
  <div class="sph-card">
    <span class="sph-tag sph-tag--yellow">신규</span>
    <h3 class="sph-h3">카드 제목</h3>
    <p class="sph-body">본문 내용…</p>
  </div>
</section>

```
