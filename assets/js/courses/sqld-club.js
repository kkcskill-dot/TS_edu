/* =============================================================
 * sqld-club.js — 'SQLD 취득!' 과정
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sqld-club/";
  const DECK_VER = "8.3";
  // 강좌별 학습자료(.md) + 강의 슬라이드 덱(.html) 매핑
  const SESSIONS = [
    { id: "s1", title: "1.1 데이터 모델링", file: "01-data-modeling.md", deck: "ch1.html", deckTitle: "1과목 · 데이터 모델링" },
    { id: "s2", title: "1.2 데이터 모델과 성능", file: "02-model-and-sql.md", deck: "ch2.html", deckTitle: "1과목 · 데이터 모델과 성능" },
    { id: "s3", title: "2.1 SQL 기본", file: "03-sql-basics.md", deck: "ch3.html", deckTitle: "2과목 · SQL 기본" },
    { id: "s4", title: "2.2 SQL 활용", file: "04-sql-utilization.md", deck: "ch4.html", deckTitle: "2과목 · SQL 활용" },
    { id: "s5", title: "2.3 관리 구문", file: "05-management-statements.md", deck: "ch5.html", deckTitle: "2과목 · 관리 구문" }
  ];

  // ── 학습자료 (탭 + 마크다운 렌더) ──
  function initTextbook() {
    const tabbar = document.getElementById("sqld-tb-tabs");
    const viewer = document.getElementById("sqld-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};

    tabbar.innerHTML = SESSIONS.map((s, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${s.id}"
        style="padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--sph-slate);">${s.title}</button>`
    ).join("");

    async function show(id) {
      const s = SESSIONS.find(x => x.id === id);
      if (!s) return;

      // active 클래스만 토글 → CSS(.tbook-tab.active, !important)가 강조 처리(다른 과정과 동일 표준)
      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));

      // '강의자료 보기' 버튼을 현재 강좌의 슬라이드 덱으로 재타겟(개요 버튼과 구분 위해 id로 선택)
      const slideBtn = tabbar.querySelector("#sqld-chapter-deck");
      if (slideBtn && s.deck) {
        slideBtn.setAttribute("data-deck-file", "assets/slides/sqld-club/" + s.deck + "?v=" + DECK_VER);
        slideBtn.setAttribute("data-deck-title", s.deckTitle || s.title);
      }

      viewer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted);">
        <div class="loader" style="margin:0 auto 10px;width:24px;height:24px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>
        불러오는 중...
      </div>`;

      try {
        if (!cache[id]) {
          const res = await fetch(BASE + s.file, { cache: "no-store" });
          if (!res.ok) throw new Error("문서를 찾을 수 없습니다.");
          cache[id] = await res.text();
        }
        if (window.marked) {
          let mdText = cache[id];
          // GitHub alert style fallback
          mdText = mdText.replace(/>\s*\[!TIP\]/g, '> 💡 **TIP:**');
          mdText = mdText.replace(/>\s*\[!NOTE\]/g, '> ℹ️ **NOTE:**');
          mdText = mdText.replace(/>\s*\[!WARNING\]/g, '> ⚠️ **WARNING:**');
          mdText = mdText.replace(/>\s*\[!CAUTION\]/g, '> 🛑 **CAUTION:**');
          mdText = mdText.replace(/>\s*\[!IMPORTANT\]/g, '> ❗ **IMPORTANT:**');
          
          viewer.innerHTML = `<div class="markdown-body" style="animation: fade-in 0.3s ease;">${window.marked.parse(mdText)}</div>`;
        } else {
          viewer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${cache[id]}</pre>`;
        }
        // Mermaid가 있다면 렌더링
        if (window.mermaid && viewer.querySelector(".mermaid")) {
          try {
            mermaid.init(undefined, viewer.querySelectorAll(".mermaid"));
          } catch (e) {
            console.error("Mermaid error:", e);
          }
        }
      } catch (err) {
        viewer.innerHTML = `<div style="padding:20px;color:var(--accent-crimson);background:rgba(239,68,68,0.1);border-radius:6px;">
          ${err.message}<br><small>아직 작성되지 않은 챕터입니다.</small>
        </div>`;
      }
    }

    // 탭바 우측에 '강의자료 보기'(PPT 슬라이드) 버튼 — slides.js가 위임 처리
    tabbar.insertAdjacentHTML("beforeend",
      '<button class="btn-open-slides" type="button" data-deck-title="SQLD 시험 안내" data-deck-file="assets/slides/sqld-club/overview.html?v=' + DECK_VER + '">📋 시험 안내</button>' +
      '<button class="btn-open-slides" id="sqld-chapter-deck" type="button" data-deck-title="1과목 · 데이터 모델링" data-deck-file="assets/slides/sqld-club/ch1.html?v=' + DECK_VER + '">🖥️ 강의자료 보기</button>');

    tabbar.addEventListener("click", e => {
      const btn = e.target.closest(".tbook-tab");
      if (btn) show(btn.dataset.id);
    });

    // 지연 로드: 페이지 로드가 아니라 '강의자료' 메뉴 첫 진입에 첫 장 fetch
    let started = false;
    const loadFirst = () => { if (!started && SESSIONS.length) { started = true; show(SESSIONS[0].id); } };
    const entry = document.getElementById("nav-btn-sqld-textbook");
    if (entry) entry.addEventListener("click", loadFirst);
    const panel = document.getElementById("panel-sqld-textbook");
    if (panel && panel.classList.contains("active")) loadFirst();
  }

  // DOMContentLoaded 이벤트 후에 초기화 (또는 패널 진입 시 호출)
  document.addEventListener("DOMContentLoaded", () => {
    initTextbook();
  });

})();
