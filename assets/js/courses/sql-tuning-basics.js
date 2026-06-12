/* =============================================================
 * sql-tuning-basics.js — 'SQL 튜닝 기본' 과정
 * 학습자료(친절한 SQL 튜닝 7장+부록 골격) + 힌트 실습 랩
 * 대부분 실습은 소모임 패널 재사용, 여기선 힌트 실습만 신규.
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sql-tuning-basics/";
  const CHAPTERS = [
    { id: "c1", title: "1장. SQL 처리·I/O", file: "ch1.md" },
    { id: "c2", title: "2장. 인덱스 기본", file: "ch2.md" },
    { id: "c3", title: "3장. 인덱스 튜닝", file: "ch3.md" },
    { id: "c4", title: "4장. 조인 튜닝", file: "ch4.md" },
    { id: "c5", title: "5장. 소트 튜닝", file: "ch5.md" },
    { id: "c6", title: "6장. DML 튜닝", file: "ch6.md" },
    { id: "c7", title: "7장. 옵티마이저", file: "ch7.md" },
    { id: "ap", title: "부록. 분석 도구", file: "ap.md" }
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
      const OPTS = s.options.slice().sort(() => Math.random() - 0.5); // 보기 셔플
      OPTS.forEach(opt => {
        const btn = document.createElement("button");
        btn.style.cssText = "width:100%;text-align:left;padding:11px 14px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);border-radius:6px;font-size:0.8rem;font-family:var(--font-mono);cursor:pointer;transition:all .15s ease;";
        btn.textContent = opt.label;
        btn.addEventListener("mouseenter", () => { if (!answered) btn.style.borderColor = "var(--accent-cyan)"; });
        btn.addEventListener("mouseleave", () => { if (!answered) btn.style.borderColor = "var(--border-light)"; });
        btn.addEventListener("click", () => {
          if (answered) return; answered = true;
          optsEl.querySelectorAll("button").forEach((b, i) => {
            b.disabled = true; b.style.cursor = "default"; b.style.opacity = "0.55";
            if (OPTS[i].correct) { b.style.borderColor = "var(--accent-emerald)"; b.style.background = "rgba(14,122,83,0.10)"; b.style.color = "var(--accent-emerald)"; b.style.opacity = "1"; }
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

  // ── 클러스터링 팩터 / 손익분기점 시각화 (3장, 신규) ──
  function initCF() {
    const root = document.getElementById("tun-cf-root");
    if (!root) return;
    const TBL_BLK = 10000, RPB = 100, KPL = 400, MBR = 16;
    const sel = (id, opts, val) => `<select id="${id}" style="background:var(--bg-card);border:1px solid var(--border-light);color:var(--color-text-main);padding:6px 10px;border-radius:6px;font-family:var(--font-mono);font-size:0.78rem;">${opts.map(o => `<option value="${o[0]}"${o[0] === val ? " selected" : ""}>${o[1]}</option>`).join("")}</select>`;
    function render() {
      const cf = (document.getElementById("cf-state") || {}).value || "good";
      const rows = parseInt((document.getElementById("cf-rows") || {}).value || "5000");
      const leaf = Math.ceil(rows / KPL);
      const tbl = cf === "good" ? Math.ceil(rows / RPB) : Math.min(rows, TBL_BLK);
      const idxCost = leaf + tbl;
      const fullCost = Math.ceil(TBL_BLK / MBR);
      const win = idxCost < fullCost ? "인덱스 스캔" : "풀스캔";
      const out = document.getElementById("cf-out");
      if (out) out.innerHTML = `<div class="ij-code-wrapper"><div class="ij-code-titlebar"><span class="ij-code-icon">&#128202;</span> 비용 비교 (테이블 ${TBL_BLK.toLocaleString()} 블록 · 100행/블록)</div><div class="ij-result-block">
        <table class="ij-plan-table"><thead><tr><th>접근 경로</th><th class="r">인덱스 리프</th><th class="r">테이블 랜덤</th><th class="r">총 비용</th></tr></thead><tbody>
          <tr><td>인덱스 스캔 (CF ${cf === "good" ? "좋음" : "나쁨"})</td><td class="r">${leaf.toLocaleString()}</td><td class="r">${tbl.toLocaleString()}</td><td class="r" style="font-weight:800;color:${win === "인덱스 스캔" ? "var(--accent-emerald)" : "var(--accent-crimson)"}">${idxCost.toLocaleString()}</td></tr>
          <tr><td>풀스캔 (Multiblock ÷${MBR})</td><td class="r">—</td><td class="r">—</td><td class="r" style="font-weight:800;color:${win === "풀스캔" ? "var(--accent-emerald)" : "var(--color-text-muted)"}">${fullCost.toLocaleString()}</td></tr>
        </tbody></table>
        <div style="margin-top:10px;font-size:0.8rem;color:var(--color-text-main);line-height:1.6;">➡️ 더 빠른 경로: <b style="color:var(--accent-cyan)">${win}</b>. CF가 나쁘면 같은 범위가 여러 블록에 흩어져 <b>테이블 랜덤 액세스가 폭증</b> → 손익분기점이 낮아져 풀스캔이 빨라집니다.</div></div></div>`;
    }
    root.innerHTML = `<div class="bg-glass" style="padding:16px 18px;border-radius:8px;border:1px solid var(--border-light);display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
      <span style="font-size:0.76rem;font-weight:700;color:var(--accent-cyan)">클러스터링 팩터</span> ${sel("cf-state", [["good", "좋음 (모여있음)"], ["bad", "나쁨 (흩어짐)"]], "good")}
      <span style="font-size:0.76rem;font-weight:700;color:var(--accent-cyan)">조회 건수</span> ${sel("cf-rows", [["1000", "1,000"], ["5000", "5,000"], ["20000", "20,000"], ["100000", "100,000"]], "5000")}
    </div><div id="cf-out"></div>`;
    document.getElementById("cf-state").addEventListener("change", render);
    document.getElementById("cf-rows").addEventListener("change", render);
    render();
  }

  // ── 공통 객관식 미니 엔진 (소트 실습·종합 퀴즈 공용) ──
  function mcLab(rootId, QS, title) {
    const root = document.getElementById(rootId);
    if (!root) return;
    let idx = 0, score = 0, answered = false;
    function render() {
      answered = false;
      const q = QS[idx];
      root.innerHTML = `<div class="bg-glass" style="padding:22px;border-radius:8px;border:1px solid var(--border-light);max-width:780px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          ${q.tag ? `<span style="font-size:0.68rem;font-weight:800;color:#fff;background:var(--accent-cyan);padding:3px 9px;border-radius:999px;">${q.tag}</span>` : ""}
          <span style="font-size:0.78rem;color:var(--color-text-muted);">${idx + 1} / ${QS.length}</span>
          <span style="margin-left:auto;font-size:0.78rem;color:var(--color-text-muted);">점수 <b style="color:var(--accent-emerald);">${score}</b></span>
        </div>
        <div style="font-size:0.92rem;font-weight:700;color:var(--color-text-main);margin-bottom:8px;">${q.q}</div>
        ${q.sql ? `<pre class="ij-code-block" style="margin-bottom:10px;"><code>${q.sql.replace(/</g, "&lt;")}</code></pre>` : ""}
        <div id="mc-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div id="mc-ex" style="display:none;margin-top:12px;padding:12px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);font-size:0.8rem;color:var(--color-text-main);line-height:1.6;"></div>
        <button id="mc-next" style="display:none;margin-top:14px;padding:8px 18px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.8rem;cursor:pointer;">${idx + 1 < QS.length ? "다음 →" : "결과 보기"}</button>
      </div>`;
      const opts = root.querySelector("#mc-opts");
      const O = q.o.slice().sort(() => Math.random() - 0.5); // 보기 셔플(정답 위치 분산)
      O.forEach(([t, ok]) => {
        const b = document.createElement("button");
        b.style.cssText = "width:100%;text-align:left;padding:11px 14px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);border-radius:6px;font-size:0.82rem;cursor:pointer;transition:all .15s ease;";
        b.textContent = t;
        b.addEventListener("mouseenter", () => { if (!answered) b.style.borderColor = "var(--accent-cyan)"; });
        b.addEventListener("mouseleave", () => { if (!answered) b.style.borderColor = "var(--border-light)"; });
        b.addEventListener("click", () => {
          if (answered) return; answered = true;
          if (ok) score += Math.round(100 / QS.length);
          opts.querySelectorAll("button").forEach((x, i) => { x.disabled = true; x.style.opacity = "0.55"; if (O[i][1]) { x.style.borderColor = "var(--accent-emerald)"; x.style.background = "rgba(14,122,83,0.10)"; x.style.color = "var(--accent-emerald)"; x.style.opacity = "1"; } });
          if (!ok) { b.style.borderColor = "var(--accent-crimson)"; b.style.background = "rgba(220,38,38,0.07)"; b.style.color = "var(--accent-crimson)"; b.style.opacity = "1"; }
          const ex = root.querySelector("#mc-ex"); ex.innerHTML = (ok ? "✅ 정답! " : "❌ ") + q.e; ex.style.display = "block";
          root.querySelector("#mc-next").style.display = "inline-block";
        });
        opts.appendChild(b);
      });
      root.querySelector("#mc-next").addEventListener("click", () => { if (idx + 1 < QS.length) { idx++; render(); } else finish(); });
    }
    function finish() {
      const pass = score >= 70;
      root.innerHTML = `<div class="bg-glass" style="padding:28px;border-radius:8px;border:1px solid var(--border-light);text-align:center;max-width:780px;">
        <div style="font-size:0.8rem;color:var(--color-text-muted);">${title}</div>
        <div style="font-size:2.2rem;font-weight:800;color:${pass ? "var(--accent-emerald)" : "var(--accent-crimson)"};margin:8px 0;">${score}점</div>
        <div style="font-size:0.95rem;font-weight:700;color:var(--color-text-main);margin-bottom:16px;">${pass ? "통과" : "복습 권장"}</div>
        <button id="mc-retry" style="padding:9px 20px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;">다시 풀기</button></div>`;
      root.querySelector("#mc-retry").addEventListener("click", () => { idx = 0; score = 0; render(); });
    }
    render();
  }

  // 소트 튜닝 실습 (5장, 신규)
  function initSort() {
    mcLab("tun-sort-root", [
      { tag: "5.3 소트 생략", q: "다음 쿼리에서 SORT ORDER BY를 생략하려면?", sql: "SELECT * FROM emp WHERE deptno = 10 ORDER BY sal;", o: [["(deptno, sal) 결합 인덱스를 만든다", true], ["PGA를 늘린다", false], ["UNION ALL을 쓴다", false], ["/*+ FULL */ 힌트를 준다", false]], e: "인덱스가 (deptno, sal) 순서면 정렬된 상태로 읽혀 SORT ORDER BY가 생략됩니다." },
      { tag: "5.2 UNION", q: "중복이 없는 두 결과를 합칠 때 불필요한 소트를 피하려면?", o: [["UNION ALL", true], ["UNION", false], ["INTERSECT", false], ["ORDER BY 추가", false]], e: "UNION은 중복 제거를 위해 SORT UNIQUE를 수행합니다. 중복이 없으면 UNION ALL이 소트 없이 빠릅니다." },
      { tag: "5.4 Top-N", q: "상위 10건만 필요할 때 소트 부하를 줄이는 원리는?", sql: "SELECT * FROM t ORDER BY amt DESC FETCH FIRST 10 ROWS ONLY;", o: [["전체 정렬 대신 상위 10개만 유지한다", true], ["전체를 정렬해야 한다", false], ["인덱스가 있어도 효과 없다", false], ["GROUP BY로 바꿔야 한다", false]], e: "Top-N(FETCH FIRST/ROWNUM)은 전체 정렬이 아니라 상위 n개만 유지하는 방식이라 소트 부하가 작습니다." }
    ], "소트 튜닝 실습");
  }

  // SQL 튜닝 기본 종합 퀴즈 (장별 태그)
  function initTunQuiz() {
    mcLab("tun-quiz-root", [
      { tag: "1장", q: "튜닝의 1차 지표가 되는 것은?", o: [["논리적 I/O(buffer gets)", true], ["네트워크 속도", false], ["폰트 크기", false], ["디스크 용량", false]], e: "논리적 I/O를 줄이는 게 튜닝의 1차 목표입니다." },
      { tag: "1장", q: "바인드 변수를 쓰는 주된 이유는?", o: [["하드 파싱을 줄여 커서를 공유", true], ["결과를 정렬", false], ["인덱스를 강제", false], ["데이터 암호화", false]], e: "리터럴은 매번 다른 SQL→하드파스 폭증. 바인드로 공유합니다." },
      { tag: "2장", q: "인덱스 선두 컬럼을 가공(함수/형변환)하면?", o: [["Range Scan 불가(정렬이 깨짐)", true], ["더 빨라짐", false], ["커버링이 됨", false], ["영향 없음", false]], e: "선두 컬럼 가공/형변환이 인덱스 무력화의 대표 원인입니다." },
      { tag: "3장", q: "클러스터링 팩터가 나쁘면?", o: [["테이블 랜덤 액세스 증가(손익분기점↓)", true], ["인덱스가 항상 유리", false], ["풀스캔 불가", false], ["소트 생략", false]], e: "CF가 나쁘면 같은 범위가 여러 블록에 흩어져 랜덤 액세스가 늘어납니다." },
      { tag: "3장", q: "커버링 인덱스의 효과는?", o: [["테이블 액세스 생략", true], ["정렬 강제", false], ["Lock 감소", false], ["redo 감소", false]], e: "필요 컬럼이 모두 인덱스에 있으면 테이블에 가지 않습니다." },
      { tag: "4장", q: "대량 × 대량 등치 조인에 적합한 방식은?", o: [["해시 조인", true], ["NL 조인", false], ["크로스 조인", false], ["서브쿼리", false]], e: "해시 조인은 양쪽을 한 번씩만 읽어 대량 등치 조인에 유리합니다." },
      { tag: "4장", q: "NL 조인의 구동(선행) 테이블은?", o: [["작은 결과집합을 먼저", true], ["큰 테이블을 먼저", false], ["아무거나", false], ["인덱스 없는 쪽", false]], e: "NL은 구동 건수만큼 후행을 반복하므로 작은 쪽이 구동이어야 합니다." },
      { tag: "5장", q: "UNION과 UNION ALL의 차이는?", o: [["UNION은 중복 제거 위해 정렬한다", true], ["둘 다 동일", false], ["UNION ALL이 더 느림", false], ["UNION은 교집합", false]], e: "UNION=중복제거(소트), UNION ALL=중복유지(빠름)." },
      { tag: "6장", q: "인덱스가 많을수록 DML 성능은?", o: [["느려짐(딸린 인덱스도 함께 갱신)", true], ["빨라짐", false], ["무관", false], ["Lock이 줄어듦", false]], e: "DML 1건마다 모든 인덱스를 갱신하므로 부하가 커집니다." },
      { tag: "6장", q: "대량 적재를 빠르게 하는 힌트는?", o: [["/*+ APPEND */ (Direct Path Insert)", true], ["/*+ INDEX */", false], ["/*+ USE_NL */", false], ["/*+ FULL */", false]], e: "APPEND는 버퍼 캐시를 거치지 않고 HWM 위에 직접 적재합니다." },
      { tag: "7장", q: "카디널리티 추정이 틀리는 주원인은?", o: [["통계 부정확/부족", true], ["네트워크", false], ["디스크 용량", false], ["커밋 주기", false]], e: "통계가 틀리면 카디널리티→비용→플랜이 모두 어긋납니다." },
      { tag: "부록", q: "예상이 아닌 '실측' 행수(A-Rows)를 보려면?", o: [["GATHER_PLAN_STATISTICS + DISPLAY_CURSOR(ALLSTATS LAST)", true], ["EXPLAIN PLAN", false], ["DESC 명령", false], ["USER_TABLES 조회", false]], e: "실측은 DISPLAY_CURSOR(ALLSTATS LAST)로 E-Rows vs A-Rows를 비교합니다." }
    ], "SQL 튜닝 기본 종합 퀴즈");
  }

  function init() { initTextbook(); initHints(); initCF(); initSort(); initTunQuiz(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
