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
          { name: "데이터 모델링", book: "핵심 데이터 모델링", status: "plan" },
          { name: "고성능 DB 설계", sub: "DBA 설계 · 운영", status: "ready" },
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
        desc: "현재 운영 중인 성능진단·튜닝 실습(기초~심화)을 모아둔 사내 스터디입니다.",
        enter: "nav-btn-textbook",
        course: "perf-club"
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
  window.TSAcademy = { enterCourse, goHome };

  function goalCell(track) {
    return `<div class="ts-goal">${track.goal}<small>${track.goalSub}</small></div>`;
  }

  function arrowCell() {
    return `<div class="ts-arrow">&#9650;</div>`;
  }

  function levelCell(lv) {
    if (!lv) return `<div></div>`;
    const interactive = lv.status === "live";
    const cls = ["ts-level", lv.status, interactive ? "" : "dimmed clickable"].join(" ").replace(/\s+/g, " ").trim();
    return `
      <div class="${cls}" data-status="${lv.status}" data-name="${lv.name}"${lv.enter ? ` data-enter="${lv.enter}"` : ""}${lv.course ? ` data-course="${lv.course}"` : ""}>
        ${badgeHtml(lv.status)}
        <div class="ts-level-name">${lv.name}</div>
        ${lv.sub ? `<div class="ts-level-sub">${lv.sub}</div>` : ""}
        ${interactive ? `<div class="ts-enter">과정 입장 ➔</div>` : ""}
      </div>`;
  }

  function render() {
    const mount = document.getElementById("academy-roadmap");
    if (!mount) return;
    const tracks = ACADEMY.tracks;
    const depth = Math.max.apply(null, tracks.map(t => t.levels.length));

    let cells = tracks.map(goalCell).join("");
    for (let i = depth - 1; i >= 0; i--) {
      cells += tracks.map(arrowCell).join("");
      cells += tracks.map(t => levelCell(t.levels[i])).join("");
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
            <div class="ts-cell-full ts-foundation clickable" data-status="${f.status}" data-name="${f.name}"${f.enter ? ` data-enter="${f.enter}"` : ""}${f.course ? ` data-course="${f.course}"` : ""}>
              ${badgeHtml(f.status)}
              <div class="ts-level-name">${f.name} <span style="font-weight:400;color:var(--sph-slate);font-size:0.82rem;">— ${f.sub}</span></div>
              <div class="ts-found-items">${f.items}</div>
              ${f.status === "live" ? '<div class="ts-enter" style="margin-top:8px;color:var(--sph-navy);font-weight:700;font-size:0.76rem;">과정 입장 ➔</div>' : ""}
            </div>
          </div>
          <div class="ts-notice" id="ts-notice"></div>
        </div>
        <aside class="ts-home-side">
          <div class="ts-side-title">운영 스터디</div>
          ${ACADEMY.studies.map(s => `
          <div class="ts-study" data-name="${s.name}" data-enter="${s.enter}" data-course="${s.course}">
            <div class="ts-study-name">${s.name}</div>
            <div class="ts-study-sub">${s.sub}</div>
            <div class="ts-study-desc">${s.desc}</div>
            <div class="ts-study-cta">스터디 입장 ➔</div>
          </div>`).join("")}
        </aside>
      </div>`;

    const notice = mount.querySelector("#ts-notice");
    mount.querySelectorAll("[data-status]").forEach(card => {
      card.addEventListener("click", () => {
        const status = card.dataset.status;
        const name = card.dataset.name;
        if (status === "live") {
          enterCourse(name, card.dataset.enter, card.dataset.course);
          return;
        }
        const label = status === "ready" ? "기획이 완료되어 구현 대기 중인" : "준비 중인";
        notice.innerHTML = `<strong>${name}</strong> 과정은 ${label} 과정입니다. 순차적으로 준비 중입니다.`;
        notice.classList.add("show");
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
