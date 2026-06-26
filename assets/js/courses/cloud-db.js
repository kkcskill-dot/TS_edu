/* =============================================================
 * cloud-db.js — '클라우드 DB 전환' 과정
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/cloud-db/";
  const SESSIONS = [
    { id: "s1", title: "1. 오라클 vs Aurora MySQL", file: "session-1.md" },
    { id: "s2", title: "2. 스토리지와 컴퓨팅 분리", file: "session-2.md" },
    { id: "s3", title: "3. 모니터링 및 성능 진단", file: "session-3.md" },
    { id: "s4", title: "4. Oracle vs MySQL 운영 차이", file: "session-4.md" },
    { id: "s5", title: "5. AWS 클라우드 환경 이해", file: "session-5.md" }
  ];

  // ── 학습자료 (탭 + 마크다운 렌더) ──
  function initTextbook() {
    const tabbar = document.getElementById("cloud-tb-tabs");
    const viewer = document.getElementById("cloud-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};

    tabbar.innerHTML = SESSIONS.map((s, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${s.id}"
        style="padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--sph-slate);">${s.title}</button>`
    ).join("");

    async function show(id) {
      const s = SESSIONS.find(x => x.id === id);
      if (!s) return;

      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));

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
          mdText = mdText.replace(/>\s*\[!TIP\]/g, '> 💡 **TIP:**');
          mdText = mdText.replace(/>\s*\[!NOTE\]/g, '> ℹ️ **NOTE:**');
          mdText = mdText.replace(/>\s*\[!WARNING\]/g, '> ⚠️ **WARNING:**');
          mdText = mdText.replace(/>\s*\[!CAUTION\]/g, '> 🛑 **CAUTION:**');
          mdText = mdText.replace(/>\s*\[!IMPORTANT\]/g, '> ❗ **IMPORTANT:**');
          
          viewer.innerHTML = `<div class="markdown-body" style="animation: fade-in 0.3s ease;">${window.marked.parse(mdText)}</div>`;
        } else {
          viewer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${cache[id]}</pre>`;
        }
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

    let started = false;
    const loadFirst = () => { if (!started && SESSIONS.length) { started = true; show(SESSIONS[0].id); } };
    const entry = document.getElementById("nav-btn-cloud-textbook");
    if (entry) entry.addEventListener("click", loadFirst);
    const panel = document.getElementById("panel-cloud-textbook");
    if (panel && panel.classList.contains("active")) loadFirst();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTextbook();
  });

})();
