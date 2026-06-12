/* =============================================================
 * sql-foundation-labs.js — 'SQL 기초' 인터랙티브 실습 5종 + 퀴즈
 * 공통 데이터셋을 조작하면 결과/표가 즉시 바뀌는 플레이그라운드형.
 * ============================================================= */
(function () {
  // ── 공통 데이터셋 ──
  const EMP = [
    { id: 1, name: "김철수", dept: 10, job: "SALES", sal: 5200, comm: 300 },
    { id: 2, name: "이영희", dept: 20, job: "IT", sal: 6100, comm: null },
    { id: 3, name: "박민수", dept: 10, job: "SALES", sal: 4800, comm: 150 },
    { id: 4, name: "최지은", dept: 30, job: "HR", sal: 4200, comm: null },
    { id: 5, name: "정현우", dept: null, job: "IT", sal: 7000, comm: null },
    { id: 6, name: "한서연", dept: 20, job: "IT", sal: 5500, comm: 200 }
  ];
  const DEPT = [
    { dept: 10, dname: "영업", loc: "서울" },
    { dept: 20, dname: "전산", loc: "판교" },
    { dept: 30, dname: "인사", loc: "서울" },
    { dept: 40, dname: "기획", loc: "부산" }
  ];

  // ── 헬퍼 ──
  function tbl(headers, rows) {
    const td = v => {
      const s = (v === null || v === undefined) ? "NULL" : String(v);
      return `<td${s === "NULL" ? ' style="color:var(--accent-crimson);font-style:italic;"' : ""}>${s}</td>`;
    };
    return '<table class="ij-plan-table"><thead><tr>' +
      headers.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
      rows.map(r => "<tr>" + r.map(td).join("") + "</tr>").join("") + "</tbody></table>";
  }
  function wrap(title, inner) {
    return `<div class="ij-code-wrapper" style="margin-bottom:12px;"><div class="ij-code-titlebar"><span class="ij-code-icon">&#9881;</span> ${title}</div><div class="ij-plan-container">${inner}</div></div>`;
  }
  function sqlBox(sql) {
    return `<div class="ij-code-wrapper" style="margin-bottom:12px;"><div class="ij-code-titlebar"><span class="ij-code-icon">&#128196;</span> SQL</div><pre class="ij-code-block"><code>${sql.replace(/</g, "&lt;")}</code></pre></div>`;
  }
  const sel = (id, opts, val) =>
    `<select id="${id}" style="background:var(--bg-card);border:1px solid var(--border-light);color:var(--color-text-main);padding:6px 10px;border-radius:6px;font-family:var(--font-mono);font-size:0.78rem;">` +
    opts.map(o => `<option value="${o[0]}"${o[0] === val ? " selected" : ""}>${o[1]}</option>`).join("") + "</select>";
  const lbl = t => `<span style="font-size:0.76rem;font-weight:700;color:var(--accent-cyan);">${t}</span>`;
  const bar = inner => `<div class="bg-glass" style="padding:14px 18px;border-radius:8px;border:1px solid var(--border-light);display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">${inner}</div>`;
  const note = t => `<div style="font-size:0.78rem;color:var(--color-text-muted);line-height:1.6;margin-top:4px;">${t}</div>`;

  // ── WHERE 필터 플레이그라운드 ──
  function initWhere() {
    const root = document.getElementById("sql-where-root");
    if (!root) return;
    const CONDS = [
      { id: "c1", label: "sal >= 5000", fn: e => e.sal >= 5000 },
      { id: "c2", label: "job = 'IT'", fn: e => e.job === "IT" },
      { id: "c3", label: "comm IS NULL", fn: e => e.comm === null },
      { id: "c4", label: "dept IN (10,20)", fn: e => e.dept === 10 || e.dept === 20 }
    ];
    const active = {};
    function render() {
      const ops = CONDS.filter(c => active[c.id]);
      const useOr = (document.getElementById("where-andor") || {}).value === "OR";
      const rows = EMP.filter(e => ops.length === 0 ? true : (useOr ? ops.some(c => c.fn(e)) : ops.every(c => c.fn(e))));
      const where = ops.length ? ops.map(c => c.label).join(useOr ? " OR " : " AND ") : "(조건 없음)";
      const out = document.getElementById("where-out");
      if (out) out.innerHTML =
        sqlBox(`SELECT * FROM emp\nWHERE  ${where};`) +
        wrap(`결과 (${rows.length}행)`, tbl(["id", "name", "job", "dept", "sal", "comm"], rows.map(e => [e.id, e.name, e.job, e.dept, e.sal, e.comm]))) +
        note("💡 <b>comm IS NULL</b>은 = 로는 못 잡습니다. AND/OR를 바꿔 결과 행 변화를 보세요.");
    }
    root.innerHTML =
      bar(
        `${lbl("조건(클릭 토글)")} <div id="where-chips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>` +
        `${lbl("결합")} ${sel("where-andor", [["AND", "AND"], ["OR", "OR"]], "AND")}`
      ) + `<div id="where-out"></div>`;
    const chips = document.getElementById("where-chips");
    CONDS.forEach(c => {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.style.cssText = "padding:5px 11px;border-radius:999px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-muted);font-family:var(--font-mono);font-size:0.74rem;cursor:pointer;";
      b.addEventListener("click", () => {
        active[c.id] = !active[c.id];
        b.style.background = active[c.id] ? "var(--accent-cyan)" : "var(--bg-card)";
        b.style.color = active[c.id] ? "#fff" : "var(--color-text-muted)";
        b.style.borderColor = active[c.id] ? "var(--accent-cyan)" : "var(--border-light)";
        render();
      });
      chips.appendChild(b);
    });
    document.getElementById("where-andor").addEventListener("change", render);
    render();
  }

  // ── 3. GROUP BY 집계 ──
  function initGroupBy() {
    const root = document.getElementById("sql-groupby-root");
    if (!root) return;
    function render() {
      const g = (document.getElementById("gb-col") || {}).value || "dept";
      const a = (document.getElementById("gb-agg") || {}).value || "COUNT";
      const groups = {};
      EMP.forEach(e => {
        const k = e[g] === null ? "NULL" : e[g];
        (groups[k] = groups[k] || []).push(e);
      });
      const aggFn = {
        COUNT: arr => arr.length,
        SUM: arr => arr.reduce((s, e) => s + e.sal, 0),
        AVG: arr => Math.round(arr.reduce((s, e) => s + e.sal, 0) / arr.length),
        MAX: arr => Math.max.apply(null, arr.map(e => e.sal))
      }[a];
      const aggSql = a === "COUNT" ? "COUNT(*)" : `${a}(sal)`;
      const rows = Object.keys(groups).map(k => [k, aggFn(groups[k])]);
      const out = document.getElementById("gb-out");
      if (out) out.innerHTML =
        sqlBox(`SELECT ${g}, ${aggSql}\nFROM   emp\nGROUP  BY ${g};`) +
        wrap(`결과 (${rows.length} 그룹)`, tbl([g, aggSql], rows)) +
        note(`💡 그룹 수 = ${g}의 서로 다른 값 개수. ${g}=dept면 NULL(정현우)도 하나의 그룹이 됩니다.`);
    }
    root.innerHTML =
      bar(`${lbl("GROUP BY")} ${sel("gb-col", [["dept", "dept"], ["job", "job"]], "dept")} ${lbl("집계")} ${sel("gb-agg", [["COUNT", "COUNT(*)"], ["SUM", "SUM(sal)"], ["AVG", "AVG(sal)"], ["MAX", "MAX(sal)"]], "COUNT")}`) +
      `<div id="gb-out"></div>`;
    document.getElementById("gb-col").addEventListener("change", render);
    document.getElementById("gb-agg").addEventListener("change", render);
    render();
  }

  // ── 4. 정렬 & Top-N ──
  function initOrder() {
    const root = document.getElementById("sql-order-root");
    if (!root) return;
    function render() {
      const col = (document.getElementById("ord-col") || {}).value || "sal";
      const dir = (document.getElementById("ord-dir") || {}).value || "DESC";
      const n = (document.getElementById("ord-n") || {}).value || "0";
      let rows = EMP.slice().sort((a, b) => {
        let r = a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0;
        return dir === "DESC" ? -r : r;
      });
      if (n !== "0") rows = rows.slice(0, parseInt(n));
      const fetchSql = n === "0" ? "" : `\nFETCH FIRST ${n} ROWS ONLY`;
      const out = document.getElementById("ord-out");
      if (out) out.innerHTML =
        sqlBox(`SELECT id, name, sal\nFROM   emp\nORDER  BY ${col} ${dir}${fetchSql};`) +
        wrap(`결과 (${rows.length}행)`, tbl(["id", "name", col], rows.map(e => [e.id, e.name, e[col]]))) +
        note("💡 페이지네이션/Top-N은 <b>ORDER BY 먼저 → FETCH FIRST</b> 순서. 정렬 없는 Top-N은 의미가 없습니다.");
    }
    root.innerHTML =
      bar(`${lbl("ORDER BY")} ${sel("ord-col", [["sal", "sal"], ["name", "name"], ["id", "id"]], "sal")} ${sel("ord-dir", [["ASC", "ASC"], ["DESC", "DESC"]], "DESC")} ${lbl("FETCH FIRST")} ${sel("ord-n", [["0", "전체"], ["3", "3행"], ["5", "5행"]], "0")}`) +
      `<div id="ord-out"></div>`;
    ["ord-col", "ord-dir", "ord-n"].forEach(id => document.getElementById(id).addEventListener("change", render));
    render();
  }

  // ── 5. 집합 연산 ──
  function initSetops() {
    const root = document.getElementById("sql-setops-root");
    if (!root) return;
    const A = [1, 2, 3, 4], B = [3, 4, 5, 6]; // 2024 / 2025 직원 id
    function render() {
      const op = (document.getElementById("set-op") || {}).value || "UNION";
      let res;
      if (op === "UNION") res = Array.from(new Set([...A, ...B])).sort((x, y) => x - y);
      else if (op === "UNION ALL") res = [...A, ...B];
      else if (op === "INTERSECT") res = A.filter(x => B.includes(x));
      else res = A.filter(x => !B.includes(x)); // MINUS
      const out = document.getElementById("set-out");
      if (out) out.innerHTML =
        sqlBox(`SELECT id FROM emp_2024   -- A = {${A.join(",")}}\n${op}\nSELECT id FROM emp_2025;  -- B = {${B.join(",")}}`) +
        wrap(`결과 (${res.length}행)`, tbl(["id"], res.map(x => [x]))) +
        note("💡 <b>UNION</b>은 중복 제거+정렬, <b>UNION ALL</b>은 중복 유지(빠름). INTERSECT=교집합, MINUS=차집합(A-B).");
    }
    root.innerHTML =
      bar(`${lbl("집합 연산")} ${sel("set-op", [["UNION", "UNION"], ["UNION ALL", "UNION ALL"], ["INTERSECT", "INTERSECT"], ["MINUS", "MINUS"]], "UNION")}`) +
      `<div id="set-out"></div>`;
    document.getElementById("set-op").addEventListener("change", render);
    render();
  }

  // ── 6. SQL 기초 퀴즈 ──
  const QUIZ = [
    { q: "논리적으로 가장 먼저 실행되는 절은?", o: [["FROM", true], ["SELECT", false], ["ORDER BY", false], ["WHERE", false]], e: "FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY 순. 그래서 WHERE에선 SELECT 별칭을 못 씁니다." },
    { q: "NULL을 찾는 올바른 조건은?", o: [["comm = NULL", false], ["comm IS NULL", true], ["comm == NULL", false], ["comm <> NULL", false]], e: "NULL은 비교 연산으로 잡히지 않아 IS NULL / IS NOT NULL 만 사용합니다." },
    { q: "그룹화 결과에 조건을 거는 절은?", o: [["WHERE", false], ["HAVING", true], ["FILTER", false], ["GROUP", false]], e: "WHERE=그룹화 전 행 필터, HAVING=그룹화 후 집계 결과 필터." },
    { q: "왼쪽 테이블 행을 모두 유지하는 조인은?", o: [["INNER JOIN", false], ["LEFT JOIN", true], ["CROSS JOIN", false], ["INTERSECT", false]], e: "LEFT OUTER JOIN은 왼쪽 행을 버리지 않고, 매칭 없으면 오른쪽을 NULL로 채웁니다." },
    { q: "COUNT(comm)이 COUNT(*)보다 작을 수 있는 이유는?", o: [["comm에 NULL이 있어서", true], ["comm이 숫자라서", false], ["정렬 때문에", false], ["항상 같다", false]], e: "COUNT(컬럼)은 그 컬럼이 NULL이 아닌 행만 셉니다." },
    { q: "동순위 다음 순위를 건너뛰지 않는 함수는?", o: [["RANK", false], ["DENSE_RANK", true], ["ROW_NUMBER", false], ["NTILE", false]], e: "RANK=1,2,2,4 / DENSE_RANK=1,2,2,3 / ROW_NUMBER=항상 유일." },
    { q: "중복 제거 없이 두 결과를 빠르게 누적하려면?", o: [["UNION", false], ["UNION ALL", true], ["INTERSECT", false], ["MINUS", false]], e: "UNION은 중복 제거+정렬 비용이 있어, 중복 제거가 불필요하면 UNION ALL이 빠릅니다." },
    { q: "WHERE 없이 UPDATE를 실행하면?", o: [["문법 오류", false], ["아무 일도 없음", false], ["테이블 전체 행이 갱신됨", true], ["첫 행만 갱신", false]], e: "WHERE가 없으면 전체 행이 대상입니다. 실행 전 SELECT COUNT(*)로 영향 행수 확인이 안전." }
  ];
  function initQuiz() {
    const root = document.getElementById("sql-quiz-root");
    if (!root) return;
    let idx = 0, score = 0, answered = false;
    function render() {
      answered = false;
      const item = QUIZ[idx];
      root.innerHTML = `
        <div class="bg-glass" style="padding:24px;border-radius:8px;border:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <span style="font-size:0.78rem;color:var(--color-text-muted);">문항 ${idx + 1} / ${QUIZ.length}</span>
            <span style="margin-left:auto;font-size:0.78rem;color:var(--color-text-muted);">점수 <b style="color:var(--accent-emerald);">${score}</b></span>
          </div>
          <div style="font-size:0.95rem;font-weight:700;color:var(--color-text-main);margin-bottom:14px;">${item.q}</div>
          <div id="quiz-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
          <div id="quiz-ex" style="display:none;margin-top:12px;padding:12px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);font-size:0.8rem;color:var(--color-text-main);line-height:1.6;"></div>
          <button id="quiz-next" style="display:none;margin-top:14px;padding:8px 18px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.8rem;cursor:pointer;">${idx + 1 < QUIZ.length ? "다음 →" : "결과 보기"}</button>
        </div>`;
      const optsEl = root.querySelector("#quiz-opts");
      const O = item.o.slice().sort(() => Math.random() - 0.5); // 보기 셔플
      O.forEach(([text, correct]) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.style.cssText = "width:100%;text-align:left;padding:11px 14px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);border-radius:6px;font-size:0.82rem;cursor:pointer;transition:all .15s ease;";
        b.addEventListener("mouseenter", () => { if (!answered) b.style.borderColor = "var(--accent-cyan)"; });
        b.addEventListener("mouseleave", () => { if (!answered) b.style.borderColor = "var(--border-light)"; });
        b.addEventListener("click", () => {
          if (answered) return; answered = true;
          if (correct) score += Math.round(100 / QUIZ.length);
          optsEl.querySelectorAll("button").forEach((x, i) => {
            x.disabled = true; x.style.cursor = "default"; x.style.opacity = "0.55";
            if (O[i][1]) { x.style.borderColor = "var(--accent-emerald)"; x.style.background = "rgba(14,122,83,0.10)"; x.style.color = "var(--accent-emerald)"; x.style.opacity = "1"; }
          });
          if (!correct) { b.style.borderColor = "var(--accent-crimson)"; b.style.background = "rgba(220,38,38,0.07)"; b.style.color = "var(--accent-crimson)"; b.style.opacity = "1"; }
          const ex = root.querySelector("#quiz-ex");
          ex.innerHTML = (correct ? "✅ 정답! " : "❌ ") + item.e;
          ex.style.display = "block";
          root.querySelector("#quiz-next").style.display = "inline-block";
        });
        optsEl.appendChild(b);
      });
      root.querySelector("#quiz-next").addEventListener("click", () => {
        if (idx + 1 < QUIZ.length) { idx++; render(); } else finish();
      });
    }
    function finish() {
      const pass = score >= 70;
      root.innerHTML = `
        <div class="bg-glass" style="padding:30px;border-radius:8px;border:1px solid var(--border-light);text-align:center;">
          <div style="font-size:0.8rem;color:var(--color-text-muted);">SQL 기초 퀴즈</div>
          <div style="font-size:2.4rem;font-weight:800;color:${pass ? "var(--accent-emerald)" : "var(--accent-crimson)"};margin:8px 0;">${score}점</div>
          <div style="font-size:0.95rem;font-weight:700;color:var(--color-text-main);margin-bottom:18px;">${pass ? "통과! 다음 과정으로 진행하세요." : "복습 후 재도전 권장"}</div>
          <button id="quiz-retry" style="padding:9px 20px;border:none;border-radius:6px;background:var(--accent-cyan);color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;">다시 풀기</button>
        </div>`;
      root.querySelector("#quiz-retry").addEventListener("click", () => { idx = 0; score = 0; render(); });
    }
    render();
  }

  function init() { initWhere(); initGroupBy(); initOrder(); initSetops(); initQuiz(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
