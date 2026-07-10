/* =============================================================
 * academy.js — 홈 교육 로드맵 (2-트랙, 행 정렬 그리드)
 * 데이터 원천: curriculum/ROADMAP.md 와 항상 일치시킬 것.
 *
 * status: 'live'  = 운영 중(클릭 시 과정 진입)
 *         'ready' = 기획 완료(구현 대기)
 *         'plan'  = 기획(개요)
 * enter: 'live' 과정 진입 시 클릭할 사이드바 nav 버튼 id
 * 두 트랙의 levels 길이는 동일해야 같은 줄에 정렬된다.
 * ============================================================= */
(function () {
  const ACADEMY = {
    tracks: [
      {
        id: "tuning",
        goal: "DB 튜닝 전문가",
        goalSub: "SQL을 빠르게 만드는 역량",
        levels: [ // 난이도 오름차순(아래→위)
          { name: "SQL 튜닝 기본", sub: "친절한 SQL 튜닝 골격", status: "live", enter: "nav-btn-tun-textbook", course: "sql-tuning-basics" },
          { name: "SQL 전문가", book: "SQL 튜닝 심화 노트", status: "plan" },
          { name: "DB 튜닝 전문가", sub: "성능진단 · 튜닝", book: "오라클 성능 고도화", status: "plan" }
        ]
      },
      {
        id: "design",
        goal: "DB 운영 전문가",
        goalSub: "안정적인 DB 운영 역량",
        levels: [
          { name: "데이터 모델링", sub: "개념→논리→물리 + 정규화", status: "live", enter: "nav-btn-dm-textbook", course: "data-modeling" },
          { name: "고성능 DB 설계", sub: "DBA 설계 · 운영", status: "plan" },
          { name: "DB 운영 전문가", sub: "DBA", status: "plan" }
        ]
      }
    ],
    foundation: { name: "SQL 기초", sub: "공통 베이스", items: "실무 SQL 입문 · 데이터 분석 · 집계/조인/서브쿼리", status: "live", enter: "nav-btn-sql-textbook", course: "sql-foundation" },
    // 정규 교육과정과 별개로 운영하는 스터디들(우측 영역). 추후 테마 추가 가능.
    studies: [
      {
        name: "성능진단 소모임",
        sub: "기술서비스팀 사내 스터디",
        desc: "성능진단 및 튜닝 실습(기초~심화) 사내 스터디",
        enter: "nav-btn-textbook",
        course: "perf-club"
      },
      {
        name: "SQLD 취득!",
        sub: "자격증 취득 스터디",
        desc: "핵심 개념과 기출문제를 분석하는 자격증 대비반",
        enter: "nav-btn-sqld-textbook",
        course: "sqld-club"
      },
      {
        name: "클라우드 DB (MySQL)",
        sub: "Aurora MySQL",
        desc: "온프레미스 DBA를 위한 클라우드 환경 및 성능진단 기초",
        enter: "nav-btn-cloud-textbook",
        course: "cloud-db"
      }
    ]
  };

  const STATUS_LABEL = { live: "운영 중", ready: "기획 완료", plan: "준비 중" };
  // '준비 중'(plan)만 뱃지 표시 — 운영 중·기획 완료는 뱃지 없이(콘텐츠 이용은 그대로)
  const badgeHtml = (status) => status === "plan" ? `<span class="ts-badge ${status}">${STATUS_LABEL[status]}</span>` : "";

  // ── 홈 ↔ 과정 뷰 전환 ──
  async function enterCourse(name, enterBtnId, courseId) {
    // 소모임 패널 partial 주입이 끝난 뒤 입장 (패널이 DOM에 있어야 라우터가 표시)
    if (window.__panelsReady) { try { await window.__panelsReady; } catch (e) {} }
    const ac = document.querySelector(".app-container");
    if (ac) {
      ac.classList.remove("is-home");
      if (courseId) ac.setAttribute("data-course", courseId);
    }
    const ci = document.getElementById("ci-course-name");
    if (ci && name) ci.textContent = name;
    const btn = enterBtnId && document.getElementById(enterBtnId);
    if (btn) btn.click();
    window.scrollTo(0, 0);
  }
  function goHome() {
    const ac = document.querySelector(".app-container");
    if (ac) ac.classList.add("is-home");
    document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
    const w = document.getElementById("panel-welcome");
    if (w) w.classList.add("active");
    document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));
    window.scrollTo(0, 0);
  }
  // ── 준비중 토스트 — 상단에서 스르륵 나타났다 자동으로 사라지는 안내 팝업 ──
  let _toastTimer = null;
  function toast(name, label) {
    let el = document.getElementById("ts-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ts-toast";
      el.className = "ts-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<svg class="ts-toast-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
      `<span><b>${name}</b> · ${label} 과정입니다. 순차 공개 예정!</span>`;
    void el.offsetWidth; // 리플로우 → 슬라이드인 트랜지션 재생
    el.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  window.TSAcademy = { enterCourse, goHome };

  function arrowCell() {
    return `<div class="ts-arrow">&#9650;</div>`;
  }

  // 단계(티어) 색 — 기초(1)→L2(2)→L3(3)→정점(4): 네이비 농도 상승 + 정점 골드.
  // 인라인 CSS 변수(--tc-*)로 주입 → academy.css가 상태(채움/외곽선)에 맞춰 사용.
  const TIERS = {
    1: { n: 1, bg: "#EEF3F9", border: "#A9BFD8", ink: "#46617E" },
    2: { n: 2, bg: "#DCEAF8", border: "#4E86C4", ink: "#1C5A95" },
    3: { n: 3, bg: "#CADCF1", border: "#134B86", ink: "#0A3A66" },
    4: { n: 4, bg: "#FFF3CC", border: "#EAB000", ink: "#845F00" }
  };
  const tierVars = (t) => `--tc-bg:${t.bg};--tc-border:${t.border};--tc-ink:${t.ink};`;
  const lvBadge = (t) => `<span class="ts-lv" style="color:${t.ink};border-color:${t.border};">Lv.${t.n}</span>`;

  function levelCell(lv, tier) {
    if (!lv) return `<div></div>`;
    const interactive = lv.status === "live";
    const cls = ["ts-level", lv.status, interactive ? "" : "dimmed clickable"].join(" ").replace(/\s+/g, " ").trim();
    return `
      <div class="${cls}" style="${tierVars(tier)}" data-status="${lv.status}" data-name="${lv.name}"${lv.enter ? ` data-enter="${lv.enter}"` : ""}${lv.course ? ` data-course="${lv.course}"` : ""}>
        ${lvBadge(tier)}
        ${badgeHtml(lv.status)}
        <div class="ts-level-name">${lv.name}</div>
        ${lv.sub ? `<div class="ts-level-sub">${lv.sub}</div>` : ""}
      </div>`;
  }

  function render() {
    const mount = document.getElementById("academy-roadmap");
    if (!mount) return;
    const tracks = ACADEMY.tracks;
    const depth = Math.max.apply(null, tracks.map(t => t.levels.length));

    // 정점(목표) 박스 없이, 최상위 '전문가' 레벨 카드가 맨 위 캡스톤이 된다.
    let cells = "";
    for (let i = depth - 1; i >= 0; i--) {
      if (i < depth - 1) cells += tracks.map(arrowCell).join(""); // 레벨 사이에만 화살표
      const tier = TIERS[i + 2] || TIERS[1]; // levels[0]=Lv.2 … levels[2]=Lv.4
      cells += tracks.map(t => levelCell(t.levels[i], tier)).join("");
    }

    const f = ACADEMY.foundation;
    mount.innerHTML = `
      <div class="ts-home">
        <div class="ts-home-main">
          <div class="ts-roadmap-head">
            <h3>교육 로드맵 </h3>
            <p>공통 베이스(SQL 기초) 위에 <strong>DB 튜닝</strong>과 <strong>DB 운영</strong> 두 트랙으로 구성합니다. 아래 과정들은 순차적으로 준비 중입니다.</p>
          </div>
          <div class="ts-grid">
            ${cells}
            <div class="ts-cell-full ts-merge">&#8598;&nbsp;&nbsp;<b>공통 선수과정</b>&nbsp;&nbsp;&#8599;</div>
            <div class="ts-cell-full ts-foundation clickable" style="${tierVars(TIERS[1])}" data-status="${f.status}" data-name="${f.name}"${f.enter ? ` data-enter="${f.enter}"` : ""}${f.course ? ` data-course="${f.course}"` : ""}>
              ${lvBadge(TIERS[1])}
              ${badgeHtml(f.status)}
              <div class="ts-level-name">${f.name} <span style="font-weight:400;color:var(--sph-slate);font-size:0.82rem;">— ${f.sub}</span></div>
              <div class="ts-found-items">${f.items}</div>
            </div>
          </div>
        </div>
        <aside class="ts-home-side">
          <div class="ts-side-title">운영 스터디</div>
          <div class="ts-study-grid">
            ${ACADEMY.studies.map(s => `
            <div class="ts-study" data-name="${s.name}" data-enter="${s.enter}" data-course="${s.course}">
              <div class="ts-study-name">${s.name}</div>
              <div class="ts-study-sub">${s.sub}</div>
              <div class="ts-study-desc">${s.desc}</div>
            </div>`).join("")}
          </div>

          <div class="ts-side-title" style="margin-top:24px;">평가 시스템</div>
          <div class="ts-study" style="border: 1px dashed var(--accent-yellow); background: rgba(251, 192, 45, 0.02);" data-name="CBT 평가 센터" data-enter="nav-btn-cbt-week3" data-course="cbt">
            <div class="ts-study-name" style="color: var(--accent-yellow);">CBT 평가 센터</div>
            <div class="ts-study-sub">TS CBT System</div>
            <div class="ts-study-desc">핵심 이론 및 실전 튜닝 지식을 테스트하고 모니터링합니다.</div>
          </div>

          <div class="ts-side-title" style="margin-top:24px;">기술서비스</div>
          <div class="ts-study" style="border: 1px dashed var(--accent-emerald); background: rgba(16, 185, 129, 0.02);" data-name="찾아가는 기술서비스" data-enter="nav-btn-visit-service" data-course="visit-service">
            <div class="ts-study-name" style="color: var(--accent-emerald);">찾아가는 기술서비스</div>
            <div class="ts-study-sub">Visiting Tech Service</div>
            <div class="ts-study-desc">현업 부서로 직접 찾아가 DB 성능 및 아키텍처 관련 기술적 애로사항을 해결합니다.</div>
          </div>
        </aside>
      </div>`;

    mount.querySelectorAll("[data-status]").forEach(card => {
      card.addEventListener("click", () => {
        const status = card.dataset.status;
        const name = card.dataset.name;
        if (status === "live") {
          enterCourse(name, card.dataset.enter, card.dataset.course);
          return;
        }
        const label = status === "ready" ? "기획 완료 · 구현 대기 중" : "준비 중";
        toast(name, label);
      });
    });

    mount.querySelectorAll(".ts-study").forEach(card => {
      card.addEventListener("click", () => enterCourse(card.dataset.name, card.dataset.enter, card.dataset.course));
    });

    // 과정 → 홈 복귀: 인디케이터의 "아카데미" 버튼 + 사이드바 브랜드 로고
    const ciHome = document.getElementById("ci-home-btn");
    if (ciHome) ciHome.addEventListener("click", goHome);
    const brand = document.getElementById("brand-home-btn");
    if (brand) brand.addEventListener("click", goHome);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
