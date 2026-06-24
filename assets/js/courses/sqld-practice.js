/* =============================================================
 * sqld-practice.js — 'SQLD 취득! 소모임' 과정 실전 문제 이해하기
 * 마크다운 문서 로딩 및 인터랙티브 랩(Lab) 기능 제공
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/sqld-club/";

  // --- 가상 데이터셋 (Lab 용) ---
  const EMP = [
    { empno: 1001, ename: "김철수", sal: 5000, comm: 500 },
    { empno: 1002, ename: "이영희", sal: 6000, comm: null },
    { empno: 1003, ename: "박민수", sal: 4000, comm: null },
    { empno: 1004, ename: "최지은", sal: 5000, comm: 200 }
  ];

  const SCORE = [
    { id: 1, name: "A", score: 90 },
    { id: 2, name: "B", score: 90 },
    { id: 3, name: "C", score: 85 },
    { id: 4, name: "D", score: 80 }
  ];

  const TAB_A = [ { val: 1 }, { val: 2 }, { val: 3 } ];
  const TAB_B = [ { val: 2 }, { val: 3 }, { val: 4 }, { val: 4 } ];

  // --- 유틸 함수 ---
  function renderTable(headers, rows) {
    const td = v => {
      const s = (v === null || v === undefined) ? "NULL" : String(v);
      return `<td${s === "NULL" ? ' style="color:var(--accent-crimson);font-style:italic;"' : ""}>${s}</td>`;
    };
    return '<table class="ij-plan-table"><thead><tr>' +
      headers.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
      rows.map(r => "<tr>" + r.map(td).join("") + "</tr>").join("") + "</tbody></table>";
  }

  function sqlBox(sql) {
    return `<div class="ij-code-wrapper" style="margin-bottom:12px;"><div class="ij-code-titlebar"><span class="ij-code-icon">&#128196;</span> SQL</div><pre class="ij-code-block"><code>${sql.replace(/</g, "&lt;")}</code></pre></div>`;
  }

  function wrapResult(title, inner) {
    return `<div class="ij-code-wrapper" style="margin-bottom:12px; border:1px solid var(--accent-cyan);"><div class="ij-code-titlebar" style="background:var(--accent-cyan); color:#000;"><span class="ij-code-icon">&#9881;</span> ${title}</div><div class="ij-plan-container">${inner}</div></div>`;
  }

  // --- Lab 1: NULL 처리와 집계함수 ---
  function renderLab1() {
    const root = document.getElementById("sqld-lab1-root");
    if (!root) return;

    const dataHtml = renderTable(["empno", "ename", "sal", "comm"], EMP.map(e => [e.empno, e.ename, e.sal, e.comm]));

    const render = () => {
      const sel = document.getElementById("lab1-select").value;
      let sql = "";
      let resHeaders = [];
      let resRows = [];

      if (sel === "c1") {
        sql = "SELECT COUNT(*), COUNT(comm) FROM EMP;";
        resHeaders = ["COUNT(*)", "COUNT(comm)"];
        const c1 = EMP.length;
        const c2 = EMP.filter(e => e.comm !== null).length;
        resRows = [[c1, c2]];
      } else if (sel === "c2") {
        sql = "SELECT SUM(sal), SUM(comm) FROM EMP;";
        resHeaders = ["SUM(sal)", "SUM(comm)"];
        const s1 = EMP.reduce((acc, e) => acc + (e.sal || 0), 0);
        const s2 = EMP.reduce((acc, e) => acc + (e.comm || 0), 0);
        resRows = [[s1, s2]];
      } else if (sel === "c3") {
        sql = "SELECT AVG(sal), AVG(comm) FROM EMP;";
        resHeaders = ["AVG(sal)", "AVG(comm)"];
        const s1 = EMP.reduce((acc, e) => acc + (e.sal || 0), 0);
        const s2 = EMP.reduce((acc, e) => acc + (e.comm || 0), 0);
        const countComm = EMP.filter(e => e.comm !== null).length;
        resRows = [[s1 / EMP.length, countComm > 0 ? (s2 / countComm) : null]];
      } else if (sel === "c4") {
        sql = "SELECT SUM(sal + comm) FROM EMP;";
        resHeaders = ["SUM(sal + comm)"];
        const s1 = EMP.reduce((acc, e) => acc + ((e.sal !== null && e.comm !== null) ? e.sal + e.comm : 0), 0);
        resRows = [[s1]];
      }

      document.getElementById("lab1-res").innerHTML = sqlBox(sql) + wrapResult("실행 결과", renderTable(resHeaders, resRows));
    };

    root.innerHTML = `
      <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px;">
        <div style="flex:1; min-width:250px;">
          <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">원본 테이블 (EMP)</h4>
          ${dataHtml}
        </div>
        <div style="flex:1; min-width:300px;">
          <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">SQL 선택</h4>
          <select id="lab1-select" style="width:100%; padding:8px; margin-bottom:15px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-card); color:var(--color-text-main);">
            <option value="c1">COUNT(*) vs COUNT(컬럼)</option>
            <option value="c2">SUM(컬럼)</option>
            <option value="c3">AVG(컬럼) - 분모는 몇일까?</option>
            <option value="c4">사칙연산 (sal + comm)의 SUM</option>
          </select>
          <div id="lab1-res"></div>
        </div>
      </div>
      <p style="font-size:0.85rem; color:var(--color-text-muted); margin:0;">
        💡 <strong>TIP:</strong> 집계함수(SUM, AVG, COUNT(컬럼))는 <code>NULL</code> 데이터를 완전히 배제하고 계산합니다. 하지만 <code>COUNT(*)</code>는 <code>NULL</code> 여부와 상관없이 모든 행의 수를 셉니다.
        또한, <code>NULL</code> 값과 사칙연산(+,-,*,/)을 수행하면 결과는 무조건 <code>NULL</code>이 되어버린다는 점을 주의하세요!
      </p>
    `;

    document.getElementById("lab1-select").addEventListener("change", render);
    render();
  }

  // --- Lab 2: 윈도우 함수 순위 매기기 ---
  function renderLab2() {
    const root = document.getElementById("sqld-lab2-root");
    if (!root) return;

    const sorted = [...SCORE].sort((a,b) => b.score - a.score);
    const dataHtml = renderTable(["id", "name", "score"], sorted.map(e => [e.id, e.name, e.score]));

    const render = () => {
      const sel = document.getElementById("lab2-select").value;
      let sql = "";
      let resHeaders = ["name", "score", "순위"];
      let resRows = [];

      if (sel === "rank") {
        sql = "SELECT name, score, RANK() OVER (ORDER BY score DESC) AS 순위 FROM SCORE;";
        // 1, 1, 3, 4
        resRows = sorted.map((e, i, arr) => {
          let rank = i + 1;
          if (i > 0 && e.score === arr[i-1].score) {
             rank = arr.findIndex(x => x.score === e.score) + 1;
          }
          return [e.name, e.score, rank];
        });
      } else if (sel === "dense") {
        sql = "SELECT name, score, DENSE_RANK() OVER (ORDER BY score DESC) AS 순위 FROM SCORE;";
        // 1, 1, 2, 3
        let currentRank = 1;
        resRows = sorted.map((e, i, arr) => {
          if (i > 0 && e.score < arr[i-1].score) currentRank++;
          return [e.name, e.score, currentRank];
        });
      } else if (sel === "row") {
        sql = "SELECT name, score, ROW_NUMBER() OVER (ORDER BY score DESC) AS 순위 FROM SCORE;";
        // 1, 2, 3, 4
        resRows = sorted.map((e, i) => [e.name, e.score, i + 1]);
      }

      document.getElementById("lab2-res").innerHTML = sqlBox(sql) + wrapResult("실행 결과", renderTable(resHeaders, resRows));
    };

    root.innerHTML = `
      <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px;">
        <div style="flex:1; min-width:200px;">
          <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">원본 테이블 (SCORE)</h4>
          ${dataHtml}
        </div>
        <div style="flex:1; min-width:300px;">
          <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">순위 함수 선택</h4>
          <select id="lab2-select" style="width:100%; padding:8px; margin-bottom:15px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-card); color:var(--color-text-main);">
            <option value="rank">RANK()</option>
            <option value="dense">DENSE_RANK()</option>
            <option value="row">ROW_NUMBER()</option>
          </select>
          <div id="lab2-res"></div>
        </div>
      </div>
      <p style="font-size:0.85rem; color:var(--color-text-muted); margin:0;">
        💡 <strong>TIP:</strong> 동점자(score가 90인 A와 B)를 어떻게 처리하는지 주목하세요.<br>
        - <code>RANK()</code>: 동점자는 같은 순위로 묶고 그 다음 순위를 건너뜁니다. (1등, 1등, 3등)<br>
        - <code>DENSE_RANK()</code>: 동점자를 같은 순위로 묶되 다음 순위를 건너뛰지 않습니다. 빽빽하게(dense) 채웁니다. (1등, 1등, 2등)<br>
        - <code>ROW_NUMBER()</code>: 동점자 상관없이 고유한 행 번호를 부여합니다. (1등, 2등, 3등)
      </p>
    `;

    document.getElementById("lab2-select").addEventListener("change", render);
    render();
  }

  // --- Lab 3: 집합 연산자 ---
  function renderLab3() {
    const root = document.getElementById("sqld-lab3-root");
    if (!root) return;

    const dataHtml1 = renderTable(["val"], TAB_A.map(e => [e.val]));
    const dataHtml2 = renderTable(["val"], TAB_B.map(e => [e.val]));

    const render = () => {
      const sel = document.getElementById("lab3-select").value;
      let sql = "";
      let resHeaders = ["val"];
      let resRows = [];

      if (sel === "union") {
        sql = "SELECT val FROM TAB_A\nUNION\nSELECT val FROM TAB_B;";
        const merged = [...TAB_A.map(x=>x.val), ...TAB_B.map(x=>x.val)];
        const unique = [...new Set(merged)].sort();
        resRows = unique.map(x => [x]);
      } else if (sel === "unionall") {
        sql = "SELECT val FROM TAB_A\nUNION ALL\nSELECT val FROM TAB_B;";
        const merged = [...TAB_A.map(x=>x.val), ...TAB_B.map(x=>x.val)];
        resRows = merged.map(x => [x]);
      } else if (sel === "intersect") {
        sql = "SELECT val FROM TAB_A\nINTERSECT\nSELECT val FROM TAB_B;";
        const aVals = TAB_A.map(x=>x.val);
        const bVals = TAB_B.map(x=>x.val);
        const inter = [...new Set(aVals.filter(x => bVals.includes(x)))].sort();
        resRows = inter.map(x => [x]);
      } else if (sel === "minus") {
        sql = "SELECT val FROM TAB_A\nMINUS\nSELECT val FROM TAB_B;";
        const aVals = TAB_A.map(x=>x.val);
        const bVals = TAB_B.map(x=>x.val);
        const minus = [...new Set(aVals.filter(x => !bVals.includes(x)))].sort();
        resRows = minus.map(x => [x]);
      }

      document.getElementById("lab3-res").innerHTML = sqlBox(sql) + wrapResult("실행 결과", renderTable(resHeaders, resRows));
    };

    root.innerHTML = `
      <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px;">
        <div style="display:flex; gap:10px;">
          <div>
            <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">TAB_A</h4>
            ${dataHtml1}
          </div>
          <div>
            <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">TAB_B</h4>
            ${dataHtml2}
          </div>
        </div>
        <div style="flex:1; min-width:300px;">
          <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--color-text-main);">집합 연산자 선택</h4>
          <select id="lab3-select" style="width:100%; padding:8px; margin-bottom:15px; border-radius:6px; border:1px solid var(--border-light); background:var(--bg-card); color:var(--color-text-main);">
            <option value="union">UNION (합집합 - 중복 제거 O, 정렬 O)</option>
            <option value="unionall">UNION ALL (합집합 - 중복 제거 X, 정렬 X)</option>
            <option value="intersect">INTERSECT (교집합)</option>
            <option value="minus">MINUS (차집합 - A에서 B를 뺌)</option>
          </select>
          <div id="lab3-res"></div>
        </div>
      </div>
      <p style="font-size:0.85rem; color:var(--color-text-muted); margin:0;">
        💡 <strong>TIP:</strong> <code>UNION ALL</code>을 제외한 모든 집합 연산자(UNION, INTERSECT, MINUS)는 내부적으로 중복을 제거하기 위해 <strong>정렬(SORT) 작업</strong>을 동반합니다.
        따라서 중복이 없거나 허용되는 상황이라면 성능이 가장 우수한 <code>UNION ALL</code>을 사용하는 것이 좋습니다.
      </p>
    `;

    document.getElementById("lab3-select").addEventListener("change", render);
    render();
  }

  function renderLabsOnly(viewer) {
    const labHtml = `
      <div style="margin-bottom: 40px; animation: fade-in 0.3s ease;">
        <h2 style="margin-bottom: 20px; color:var(--color-text-main); font-size:1.4rem;">🧪 SQLD 실전 인터랙티브 랩(Lab)</h2>
        <p style="color:var(--color-text-muted); margin-bottom: 20px;">SQLD 시험에 자주 출제되는 핵심 함정들을 직접 쿼리 결과를 변경해가며 체험해 보세요.</p>
        
        <div class="bg-glass" style="border:1px solid var(--border-light); border-radius:8px; overflow:hidden;">
          <!-- Lab Tabs -->
          <div style="display:flex; border-bottom:1px solid var(--border-light); background:var(--bg-card);">
            <button id="btn-lab1" class="lab-tab-btn active" style="flex:1; padding:12px; border:none; background:transparent; cursor:pointer; font-weight:600; color:var(--accent-cyan); border-bottom:2px solid var(--accent-cyan);">Lab 1. NULL 집계함수</button>
            <button id="btn-lab2" class="lab-tab-btn" style="flex:1; padding:12px; border:none; background:transparent; cursor:pointer; font-weight:600; color:var(--color-text-main);">Lab 2. 윈도우 순위</button>
            <button id="btn-lab3" class="lab-tab-btn" style="flex:1; padding:12px; border:none; background:transparent; cursor:pointer; font-weight:600; color:var(--color-text-main);">Lab 3. 집합 연산자</button>
          </div>
          
          <!-- Lab Content -->
          <div style="padding:24px;">
            <div id="sqld-lab1-root" class="lab-pane"></div>
            <div id="sqld-lab2-root" class="lab-pane" style="display:none;"></div>
            <div id="sqld-lab3-root" class="lab-pane" style="display:none;"></div>
          </div>
        </div>
      </div>
    `;

    viewer.innerHTML = labHtml;

    // Initialize Labs
    renderLab1();
    renderLab2();
    renderLab3();

    // Tab Logic
    const tabs = [
      { btn: "btn-lab1", pane: "sqld-lab1-root" },
      { btn: "btn-lab2", pane: "sqld-lab2-root" },
      { btn: "btn-lab3", pane: "sqld-lab3-root" }
    ];

    tabs.forEach(t => {
      document.getElementById(t.btn).addEventListener("click", (e) => {
        tabs.forEach(x => {
          document.getElementById(x.btn).style.color = "var(--color-text-main)";
          document.getElementById(x.btn).style.borderBottom = "none";
          document.getElementById(x.pane).style.display = "none";
        });
        e.target.style.color = "var(--accent-cyan)";
        e.target.style.borderBottom = "2px solid var(--accent-cyan)";
        document.getElementById(t.pane).style.display = "block";
      });
    });
  }

  async function loadPracticeChapter(chapter) {
    const viewer = document.getElementById("sqld-practice-viewer");
    if (!viewer) return;

    if (chapter === "lab") {
      renderLabsOnly(viewer);
      return;
    }

    viewer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted);">
        <div class="loader" style="margin:0 auto 10px;width:24px;height:24px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>
        문제 불러오는 중...
      </div>`;

    const fileName = `0${chapter}-practice.md`;

    try {
      const res = await fetch(BASE + fileName, { cache: "no-store" });
      if (!res.ok) throw new Error("파일을 불러오지 못했습니다. HTTP " + res.status);
      let mdText = await res.text();

      if (window.marked) {
        // GitHub alert style fallback
        mdText = mdText.replace(/>\s*\[!TIP\]/g, '> 💡 **TIP:**');
        mdText = mdText.replace(/>\s*\[!NOTE\]/g, '> ℹ️ **NOTE:**');
        mdText = mdText.replace(/>\s*\[!WARNING\]/g, '> ⚠️ **WARNING:**');
        mdText = mdText.replace(/>\s*\[!CAUTION\]/g, '> 🛑 **CAUTION:**');
        mdText = mdText.replace(/>\s*\[!IMPORTANT\]/g, '> ❗ **IMPORTANT:**');
        
        viewer.innerHTML = `<div class="markdown-body" style="animation: fade-in 0.3s ease;">${window.marked.parse(mdText)}</div>`;
      } else {
        viewer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${mdText}</pre>`;
      }
    } catch (err) {
      viewer.innerHTML = `<div style="padding:20px;color:var(--accent-crimson);background:rgba(239,68,68,0.1);border-radius:6px;">
        ${err.message}<br><small>실전 문제 파일을 불러올 수 없습니다. (${fileName})</small>
      </div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // 챕터 버튼 클릭 리스너 등록
    document.querySelectorAll('.menu-item[data-practice-chapter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const chapter = btn.getAttribute('data-practice-chapter');
        loadPracticeChapter(chapter);
      });
    });

    // 기본적으로 1장 로드 (sqld-practice 패널 진입 시 첫 화면 용도)
    setTimeout(() => {
      // url hash나 다른 상태가 없다면 1장을 띄웁니다.
      loadPracticeChapter("1");
    }, 100);
  });

})();
