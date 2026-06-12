/* =============================================================
 * sql-tuning-basics.js — 'SQL 튜닝 기본' 과정
 * 학습자료(친절한 SQL 튜닝 7장+부록 골격) + 힌트 실습 랩
 * 대부분 실습은 소모임 패널 재사용, 여기선 힌트 실습만 신규.
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sql-tuning-basics/";
  const CHAPTERS = [
    { id: "c1", title: "1장. SQL 처리·I/O", file: "ch1.md" },
    { id: "c2", title: "2장. 인덱스 기본", file: null },
    { id: "c3", title: "3장. 인덱스 튜닝", file: null },
    { id: "c4", title: "4장. 조인 튜닝", file: null },
    { id: "c5", title: "5장. 소트 튜닝", file: null },
    { id: "c6", title: "6장. DML 튜닝", file: null },
    { id: "c7", title: "7장. 옵티마이저", file: null },
    { id: "ap", title: "부록. 분석 도구", file: null }
  ];

  // ── 학습자료 (장 탭 + 마크다운) ──
  function initTextbook() {
    const tabbar = document.getElementById("tun-tb-tabs");
    const viewer = document.getElementById("tun-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};

    tabbar.innerHTML = CHAPTERS.map((c, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${c.id}"
        style="padding:9px 14px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.8rem;color:var(--sph-slate);white-space:nowrap;">${c.title}</button>`
    ).join("");

    async function show(id) {
      const c = CHAPTERS.find(x => x.id === id);
      if (!c) return;
      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));
      if (cache[id] === undefined) {
        if (!c.file) {
          cache[id] = "# " + c.title + "\n\n> 🛠️ 이 장은 **준비 중**입니다. 1장부터 순차적으로 공개됩니다.";
        } else {
          viewer.innerHTML = '<div style="padding:24px;color:var(--sph-muted);">불러오는 중…</div>';
          try {
            const r = await fetch(BASE + c.file, { cache: "no-store" });
            cache[id] = r.ok ? await r.text() : "# 불러오기 실패\n`" + BASE + c.file + "`";
          } catch (e) {
            cache[id] = "# 불러오기 실패\nhttp 서버에서 열어야 학습자료가 로드됩니다.";
          }
        }
      }
      viewer.innerHTML = '<div class="markdown-body">' +
        (window.marked ? marked.parse(cache[id]) : cache[id]) + "</div>";
    }

    tabbar.addEventListener("click", e => {
      const b = e.target.closest(".tbook-tab");
      if (b) show(b.dataset.id);
    });
    show("c1");
  }

  // ── 힌트 실습 랩 ──
  function planTable(rows) {
    const td = v => `<td>${v == null ? "" : v}</td>`;
    return '<table class="ij-plan-table"><thead><tr><th>Id</th><th>Operation</th><th class="r">Rows</th><th class="r">Cost</th></tr></thead><tbody>' +
      rows.map(r => `<tr><td class="col-id">${r.id}</td><td class="col-op">${r.op}${r.note ? ' <span style="color:var(--ij-text-dim);font-size:0.7rem;">(' + r.note + ')</span>' : ''}</td>${td(r.rows)}${td(r.cost)}</tr>`).join("") +
      "</tbody></table>";
  }

  const SCENARIOS = {
    no_index: {
      title: "인덱스 미사용 (풀스캔)",
      sql: "SELECT * FROM orders\nWHERE cust_id = 1001;   -- cust_id 인덱스 존재, 결과 소량",
      before: [
        { id: 0, op: "SELECT STATEMENT", rows: "12", cost: "9,800" },
        { id: 1, op: " TABLE ACCESS FULL", rows: "12", cost: "9,800", note: "ORDERS" }
      ],
      options: [
        { label: "/*+ INDEX(orders ix_orders_cust) */", correct: true },
        { label: "/*+ FULL(orders) */", correct: false },
        { label: "/*+ USE_HASH(orders) */", correct: false },
        { label: "/*+ PARALLEL(orders 4) */", correct: false }
      ],
      after: [
        { id: 0, op: "SELECT STATEMENT", rows: "12", cost: "5" },
        { id: 1, op: " TABLE ACCESS BY INDEX ROWID", rows: "12", cost: "5", note: "ORDERS" },
        { id: 2, op: "  INDEX RANGE SCAN", rows: "12", cost: "3", note: "IX_ORDERS_CUST" }
      ],
      explain: "소량 조회인데 풀스캔 → 인덱스를 강제(`INDEX`)하면 Cost 9,800→5. <b>다만 근본 원인은 통계 노후화</b>일 가능성이 큽니다. <code>DBMS_STATS</code>로 통계를 갱신하면 힌트 없이도 옵티마이저가 인덱스를 선택합니다. 힌트는 임시 교정.",
      wrong: "FULL은 현 상태 유지, USE_HASH/PARALLEL은 단건 조회에 부적합합니다."
    },
    bad_nl: {
      title: "부적절한 NL 조인 (대량)",
      sql: "SELECT *\nFROM orders o JOIN customers c ON c.cust_id = o.cust_id\nWHERE o.order_date >= DATE '2026-01-01';   -- 양쪽 대량",
      before: [
        { id: 0, op: "SELECT STATEMENT", rows: "800K", cost: "1,250,000" },
        { id: 1, op: " NESTED LOOPS", rows: "800K", cost: "1,250,000" },
        { id: 2, op: "  TABLE ACCESS FULL", rows: "800K", cost: "40,000", note: "ORDERS" },
        { id: 3, op: "  TABLE ACCESS BY INDEX ROWID", rows: "1", cost: "2", note: "CUSTOMERS (×800K)" }
      ],
      options: [
        { label: "/*+ USE_HASH(c) */", correct: true },
        { label: "/*+ USE_NL(c) */", correct: false },
        { label: "/*+ INDEX(o) */", correct: false },
        { label: "/*+ ORDERED USE_NL(c) */", correct: false }
      ],
      after: [
        { id: 0, op: "SELECT STATEMENT", rows: "800K", cost: "95,000" },
        { id: 1, op: " HASH JOIN", rows: "800K", cost: "95,000" },
        { id: 2, op: "  TABLE ACCESS FULL", rows: "800K", cost: "40,000", note: "ORDERS" },
        { id: 3, op: "  TABLE ACCESS FULL", rows: "90K", cost: "1,200", note: "CUSTOMERS" }
      ],
      explain: "대량 × 대량을 NL로 처리하면 내부 테이블을 80만 번 반복 액세스합니다. <code>USE_HASH</code>로 해시 조인 유도 → 양쪽을 한 번씩만 읽어 Cost 급감. 대량 조인엔 해시가 정석.",
      wrong: "USE_NL은 현 비효율 유지, INDEX(o)/ORDERED USE_NL은 NL을 못 벗어납니다."
    },
    wrong_order: {
      title: "잘못된 조인 순서",
      sql: "SELECT *\nFROM big_sales s JOIN small_dept d ON d.dept_id = s.dept_id\nWHERE d.region = 'SEOUL';   -- 서울 부서는 소수",
      before: [
        { id: 0, op: "SELECT STATEMENT", rows: "300", cost: "85,000" },
        { id: 1, op: " NESTED LOOPS", rows: "300", cost: "85,000" },
        { id: 2, op: "  TABLE ACCESS FULL", rows: "5M", cost: "80,000", note: "BIG_SALES (구동=대량!)" },
        { id: 3, op: "  TABLE ACCESS BY INDEX ROWID", rows: "1", cost: "1", note: "SMALL_DEPT" }
      ],
      options: [
        { label: "/*+ LEADING(d s) */", correct: true },
        { label: "/*+ LEADING(s d) */", correct: false },
        { label: "/*+ FULL(d) */", correct: false },
        { label: "/*+ USE_NL(s) */", correct: false }
      ],
      after: [
        { id: 0, op: "SELECT STATEMENT", rows: "300", cost: "320" },
        { id: 1, op: " NESTED LOOPS", rows: "300", cost: "320" },
        { id: 2, op: "  TABLE ACCESS BY INDEX ROWID", rows: "3", cost: "2", note: "SMALL_DEPT (구동=소량)" },
        { id: 3, op: "  TABLE ACCESS BY INDEX ROWID", rows: "100", cost: "318", note: "BIG_SALES (인덱스 경유)" }
      ],
      explain: "NL 조인은 <b>작은 결과집합을 먼저(구동 테이블)</b> 두는 게 핵심입니다. `LEADING(d s)`로 소량인 부서를 먼저 → 대량 테이블은 인덱스로 필요한 만큼만. Cost 85,000→320.",
      wrong: "LEADING(s d)는 현 상태(대량 구동) 유지, FULL/USE_NL은 순서를 못 바꿉니다."
    }
  };

  function initHints() {
    const root = document.getElementById("tun-hints-root");
    if (!root) return;
    let key = "no_index", answered = false;

    function render() {
      answered = false;
      const s = SCENARIOS[key];
      const btns = Object.keys(SCENARIOS).map(k =>
        `<button class="btn-hint-scn" data-k="${k}" style="padding:8px 14px;border:1px solid ${k === key ? "var(--accent-cyan)" : "var(--border-light)"};background:${k === key ? "rgba(8,42,91,0.08)" : "transparent"};color:${k === key ? "var(--accent-cyan)" : "var(--color-text-muted)"};border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;">${SCENARIOS[k].title}</button>`
      ).join("");
      root.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">${btns}</div>
        <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;">
          <div class="bg-glass" style="padding:18px;border-radius:8px;border:1px solid var(--border-light);">
            <div class="ij-code-wrapper" style="margin-bottom:12px;"><div class="ij-code-titlebar"><span class="ij-code-icon">&#128196;</span> SQL</div><pre class="ij-code-block"><code>${s.sql.replace(/</g, "&lt;")}</code></pre></div>
            <div class="ij-code-wrapper"><div class="ij-code-titlebar"><span class="ij-code-icon">&#9881;</span> 현재 실행계획</div><div class="ij-plan-container">${planTable(s.before)}</div></div>
            <div class="ij-code-wrapper" id="hint-after" style="display:none;margin-top:12px;border-color:var(--accent-emerald);"><div class="ij-code-titlebar" style="color:var(--accent-emerald);">&#9989; 힌트 적용 후</div><div class="ij-plan-container">${planTable(s.after)}</div></div>
          </div>
          <div class="bg-glass" style="padding:18px;border-radius:8px;border:1px solid var(--border-light);">
            <div style="font-size:0.8rem;font-weight:700;color:var(--accent-cyan);margin-bottom:10px;">이 플랜을 고칠 올바른 힌트는?</div>
            <div id="hint-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
            <div id="hint-explain" style="display:none;margin-top:12px;padding:12px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);font-size:0.8rem;color:var(--color-text-main);line-height:1.6;"></div>
          </div>
        </div>`;

      root.querySelectorAll(".btn-hint-scn").forEach(b => b.addEventListener("click", () => { key = b.dataset.k; render(); }));

      const optsEl = root.querySelector("#hint-opts");
      s.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.style.cssText = "width:100%;text-align:left;padding:11px 14px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);border-radius:6px;font-size:0.8rem;font-family:var(--font-mono);cursor:pointer;transition:all .15s ease;";
        btn.textContent = opt.label;
        btn.addEventListener("mouseenter", () => { if (!answered) btn.style.borderColor = "var(--accent-cyan)"; });
        btn.addEventListener("mouseleave", () => { if (!answered) btn.style.borderColor = "var(--border-light)"; });
        btn.addEventListener("click", () => {
          if (answered) return; answered = true;
          optsEl.querySelectorAll("button").forEach((b, i) => {
            b.disabled = true; b.style.cursor = "default"; b.style.opacity = "0.55";
            if (s.options[i].correct) { b.style.borderColor = "var(--accent-emerald)"; b.style.background = "rgba(14,122,83,0.10)"; b.style.color = "var(--accent-emerald)"; b.style.opacity = "1"; }
          });
          if (!opt.correct) { btn.style.borderColor = "var(--accent-crimson)"; btn.style.background = "rgba(220,38,38,0.07)"; btn.style.color = "var(--accent-crimson)"; btn.style.opacity = "1"; }
          if (opt.correct) root.querySelector("#hint-after").style.display = "block";
          const ex = root.querySelector("#hint-explain");
          ex.innerHTML = (opt.correct ? "✅ 정답! " + s.explain : "❌ " + s.wrong);
          ex.style.display = "block";
        });
        optsEl.appendChild(btn);
      });
    }
    render();
  }

  function init() { initTextbook(); initHints(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
