/* =============================================================
 * sql-foundation.js — 'SQL 기초' 과정 (학습자료 + 쿼리 결과 예측 랩)
 * 학습자료는 assets/lessons/sql-foundation/*.md 를 fetch + marked 로 렌더.
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sql-foundation/";
  const SESSIONS = [
    { id: "s1", title: "1. SQL 기본", file: "01-select.md" },
    { id: "s2", title: "2. 집계·그룹화", file: "02-aggregate.md" },
    { id: "s3", title: "3. 조인·집합", file: "03-join.md" },
    { id: "s4", title: "4. 서브쿼리·분석함수", file: "04-subquery.md" },
    { id: "s5", title: "5. DML·트랜잭션", file: "05-dml.md" },
    { id: "s6", title: "6. 실전 패턴", file: "06-patterns.md" }
  ];

  // ── 학습자료 (탭 + 마크다운 렌더) ──
  function initTextbook() {
    const tabbar = document.getElementById("sql-tb-tabs");
    const viewer = document.getElementById("sql-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};

    tabbar.innerHTML = SESSIONS.map((s, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${s.id}"
        style="padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--sph-slate);">${s.title}</button>`
    ).join("");

    async function show(id) {
      const s = SESSIONS.find(x => x.id === id);
      if (!s) return;
      // active 클래스 토글 → CSS(.tbook-tab.active / :hover)가 강조·호버 처리
      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));
      if (cache[id] === undefined) {
        viewer.innerHTML = '<div style="padding:24px;color:var(--sph-muted);">불러오는 중…</div>';
        try {
          const r = await fetch(BASE + s.file, { cache: "no-store" });
          cache[id] = r.ok ? await r.text() : "# 불러오기 실패\n`" + BASE + s.file + "`";
        } catch (e) {
          cache[id] = "# 불러오기 실패\n로컬에서 직접 열면 fetch가 막힙니다. http 서버로 확인하세요.";
        }
      }
      viewer.innerHTML = '<div class="markdown-body">' +
        (window.marked ? marked.parse(cache[id]) : cache[id]) + "</div>";
    }

    tabbar.addEventListener("click", e => {
      const b = e.target.closest(".tbook-tab");
      if (b) show(b.dataset.id);
    });
    show("s1");
  }

  // ── 쿼리 결과 예측 랩 ──
  const QUESTIONS = [
    {
      tag: "집계 · NULL",
      data: "<b>EMP</b> (comm 중 2건은 NULL)<br><code>id:1 comm:100 / id:2 comm:NULL / id:3 comm:200 / id:4 comm:NULL / id:5 comm:50</code>",
      sql: "SELECT COUNT(*), COUNT(comm) FROM emp;",
      options: [
        { t: "5, 5", correct: false },
        { t: "5, 3", correct: true },
        { t: "3, 3", correct: false },
        { t: "5, 0", correct: false }
      ],
      explain: "COUNT(*)는 전체 행(5), COUNT(comm)은 comm이 NULL이 아닌 행만(3) 셉니다."
    },
    {
      tag: "NULL 비교",
      data: "위와 동일한 EMP",
      sql: "SELECT COUNT(*) FROM emp WHERE comm = NULL;",
      options: [
        { t: "2", correct: false },
        { t: "3", correct: false },
        { t: "0", correct: true },
        { t: "5", correct: false }
      ],
      explain: "NULL은 = 로 비교되지 않아 항상 거짓 → 0행. NULL을 찾으려면 WHERE comm IS NULL."
    },
    {
      tag: "OUTER JOIN 행수",
      data: "<b>EMP</b> 5행 중 1명은 dept_id가 NULL(부서 없음). <b>DEPT</b>에는 모든 부서 존재.",
      sql: "SELECT COUNT(*) FROM emp e\nLEFT JOIN dept d ON e.dept_id = d.dept_id;",
      options: [
        { t: "4 (부서 있는 사람만)", correct: false },
        { t: "5 (전체 직원 유지)", correct: true },
        { t: "0", correct: false },
        { t: "DEPT 행수", correct: false }
      ],
      explain: "LEFT JOIN은 왼쪽(EMP) 행을 절대 버리지 않습니다. 매칭 없는 행은 오른쪽이 NULL로 채워져 총 5행."
    },
    {
      tag: "GROUP BY · HAVING",
      data: "부서별 인원: 10번=3명, 20번=1명, 30번=2명",
      sql: "SELECT dept_id, COUNT(*) FROM emp\nGROUP BY dept_id\nHAVING COUNT(*) >= 2;",
      options: [
        { t: "3개 그룹", correct: false },
        { t: "2개 그룹 (10, 30)", correct: true },
        { t: "1개 그룹", correct: false },
        { t: "6행", correct: false }
      ],
      explain: "그룹화 후 HAVING COUNT(*)>=2 로 20번(1명)은 제외 → 10·30번 2개 그룹."
    },
    {
      tag: "분석함수 RANK",
      data: "한 부서 급여: 9000, 7000, 7000, 5000",
      sql: "RANK() OVER (ORDER BY salary DESC)",
      options: [
        { t: "1, 2, 2, 3", correct: false },
        { t: "1, 2, 2, 4", correct: true },
        { t: "1, 2, 3, 4", correct: false },
        { t: "1, 1, 2, 3", correct: false }
      ],
      explain: "RANK는 동순위(7000,7000=공동 2위) 다음 순위를 건너뜁니다 → 1,2,2,4. (건너뛰지 않는 건 DENSE_RANK: 1,2,2,3)"
    }
  ];

  function initPredict() {
    const root = document.getElementById("sql-predict-root");
    if (!root) return;
    let idx = 0, score = 0, answered = false;

    function render() {
      answered = false;
      const q = QUESTIONS[idx];
      root.innerHTML = `
        <div class="bg-glass" style="padding:22px;border-radius:8px;border:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="font-size:0.7rem;font-weight:800;color:#fff;background:var(--accent-cyan);padding:3px 10px;border-radius:999px;">${q.tag}</span>
            <span style="font-size:0.78rem;color:var(--color-text-muted);">문제 ${idx + 1} / ${QUESTIONS.length}</span>
            <span style="margin-left:auto;font-size:0.78rem;color:var(--color-text-muted);">점수 <b style="color:var(--accent-emerald);">${score}</b></span>
          </div>
          <div style="font-size:0.82rem;color:var(--color-text-muted);line-height:1.6;margin-bottom:10px;">${q.data}</div>
          <div class="ij-code-wrapper" style="margin-bottom:14px;">
            <div class="ij-code-titlebar"><span class="ij-code-icon">&#128196;</span> SQL</div>
            <pre class="ij-code-block"><code>${q.sql.replace(/</g, "&lt;")}</code></pre>
          </div>
          <div style="font-size:0.8rem;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">결과를 예측하세요:</div>
          <div id="sql-pred-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
          <div id="sql-pred-explain" style="display:none;margin-top:12px;padding:12px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);font-size:0.8rem;color:var(--color-text-main);line-height:1.6;"></div>
          <button id="sql-pred-next" style="display:none;margin-top:14px;padding:8px 18px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.8rem;cursor:pointer;">${idx + 1 < QUESTIONS.length ? "다음 문제 →" : "결과 보기"}</button>
        </div>`;

      const optsEl = root.querySelector("#sql-pred-opts");
      const OPTS = q.options.slice().sort(() => Math.random() - 0.5); // 보기 셔플
      OPTS.forEach(opt => {
        const btn = document.createElement("button");
        btn.style.cssText = "width:100%;text-align:left;padding:11px 14px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);border-radius:6px;font-size:0.82rem;font-family:var(--font-mono);cursor:pointer;transition:all .15s ease;";
        btn.textContent = opt.t;
        btn.addEventListener("mouseenter", () => { if (!answered) btn.style.borderColor = "var(--accent-cyan)"; });
        btn.addEventListener("mouseleave", () => { if (!answered) btn.style.borderColor = "var(--border-light)"; });
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          if (opt.correct) score += 20;
          optsEl.querySelectorAll("button").forEach((b, i) => {
            b.disabled = true; b.style.cursor = "default"; b.style.opacity = "0.55";
            if (OPTS[i].correct) { b.style.borderColor = "var(--accent-emerald)"; b.style.background = "rgba(14,122,83,0.10)"; b.style.color = "var(--accent-emerald)"; b.style.opacity = "1"; }
          });
          if (!opt.correct) { btn.style.borderColor = "var(--accent-crimson)"; btn.style.background = "rgba(220,38,38,0.07)"; btn.style.color = "var(--accent-crimson)"; btn.style.opacity = "1"; }
          const ex = root.querySelector("#sql-pred-explain");
          ex.innerHTML = (opt.correct ? "✅ 정답! " : "❌ ") + q.explain;
          ex.style.display = "block";
          root.querySelector("#sql-pred-next").style.display = "inline-block";
        });
        optsEl.appendChild(btn);
      });

      root.querySelector("#sql-pred-next").addEventListener("click", () => {
        if (idx + 1 < QUESTIONS.length) { idx++; render(); }
        else finish();
      });
    }

    function finish() {
      const grade = score >= 80 ? "훌륭합니다" : score >= 50 ? "통과" : "복습 권장";
      const color = score >= 50 ? "var(--accent-emerald)" : "var(--accent-crimson)";
      root.innerHTML = `
        <div class="bg-glass" style="padding:28px;border-radius:8px;border:1px solid var(--border-light);text-align:center;">
          <div style="font-size:0.8rem;color:var(--color-text-muted);">SQL 기초 · 쿼리 결과 예측</div>
          <div style="font-size:2.2rem;font-weight:800;color:${color};margin:8px 0;">${score} / ${QUESTIONS.length * 20}</div>
          <div style="font-size:0.95rem;font-weight:700;color:var(--color-text-main);margin-bottom:16px;">${grade}</div>
          <button id="sql-pred-retry" style="padding:9px 20px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;">다시 풀기</button>
        </div>`;
      root.querySelector("#sql-pred-retry").addEventListener("click", () => { idx = 0; score = 0; render(); });
    }

    render();
  }

  function init() { initTextbook(); initPredict(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
