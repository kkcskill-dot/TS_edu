/* =============================================================
 * sqltuning-club.js — 'SQL튜닝' 소모임 과정
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sqltuning-club/";

  // 과목별 마크다운 파일 매핑
  const SESSIONS = [
    { id: "sqltuning-session1", file: "01-sql-plan-optimizer.md", viewer: "viewer-sqltuning-1" },
    { id: "sqltuning-session2", file: "02-hash-join-memory.md", viewer: "viewer-sqltuning-2" },
    { id: "sqltuning-session3", file: "03-ash-awr-bottleneck.md", viewer: "viewer-sqltuning-3" },
    { id: "sqltuning-session4", file: "04-partition-parallel.md", viewer: "viewer-sqltuning-4" }
  ];

  const cache = {};

  async function renderMarkdown(sessionId) {
    const s = SESSIONS.find(x => x.id === sessionId);
    if (!s) return;
    const viewer = document.getElementById(s.viewer);
    if (!viewer) return;

    if (!cache[s.id]) {
      try {
        const res = await fetch(BASE + s.file, { cache: "no-store" });
        if (!res.ok) throw new Error("자료를 찾을 수 없습니다: " + s.file);
        cache[s.id] = await res.text();
      } catch (err) {
        viewer.innerHTML = `<div style="padding: 20px; color: var(--color-error);">${err.message}<br><br><small>서버에 마크다운 파일이 아직 생성되지 않았습니다.</small></div>`;
        return;
      }
    }

    if (window.marked) {
      viewer.innerHTML = marked.parse(cache[s.id]);
    } else {
      viewer.innerHTML = `<pre>${cache[s.id]}</pre>`;
    }
  }

  function initSqltuningClub() {
    const tabs = document.querySelectorAll("#sqltuning-tabs .ts-tab");
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // Hide all contents
        const contents = document.querySelectorAll("#panel-sqltuning-textbook .ts-tab-content");
        contents.forEach(c => c.classList.remove("active"));

        // Show target content
        const targetId = tab.getAttribute("data-target");
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add("active");
          renderMarkdown(targetId);
        }
      });
    });

    // Initial render for the first tab
    renderMarkdown(SESSIONS[0].id);
  }

  // index.html 또는 partials 주입이 완료된 후 초기화
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById("panel-sqltuning-textbook")) {
      initSqltuningClub();
      obs.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
