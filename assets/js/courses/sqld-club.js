/* =============================================================
 * sqld-club.js — 'SQLD 취득!' 과정
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sqld-club/";
  // TODO: 이후 사용자가 제공하는 목차로 SESSIONS 업데이트
  const SESSIONS = [
    { id: "s1", title: "1.1 데이터 모델링", file: "01-data-modeling.md" },
    { id: "s2", title: "1.2 데이터 모델과 SQL", file: "02-model-and-sql.md" },
    { id: "s3", title: "2.1 SQL 기본", file: "03-sql-basics.md" },
    { id: "s4", title: "2.2 SQL 활용", file: "04-sql-utilization.md" },
    { id: "s5", title: "2.3 관리 구문", file: "05-management-statements.md" }
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

      document.querySelectorAll("#sqld-tb-tabs .tbook-tab").forEach(b => {
        b.classList.toggle("active", b.dataset.id === id);
        b.style.borderBottomColor = b.dataset.id === id ? "var(--accent-cyan)" : "transparent";
        b.style.color = b.dataset.id === id ? "var(--color-text-main)" : "var(--sph-slate)";
      });

      viewer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted);">
        <div class="loader" style="margin:0 auto 10px;width:24px;height:24px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>
        불러오는 중...
      </div>`;

      try {
        if (!cache[id]) {
          const res = await fetch(BASE + s.file);
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

    tabbar.addEventListener("click", e => {
      const btn = e.target.closest(".tbook-tab");
      if (btn) show(btn.dataset.id);
    });

    if (SESSIONS.length > 0) show(SESSIONS[0].id);
  }

  // DOMContentLoaded 이벤트 후에 초기화 (또는 패널 진입 시 호출)
  document.addEventListener("DOMContentLoaded", () => {
    initTextbook();
  });

})();
