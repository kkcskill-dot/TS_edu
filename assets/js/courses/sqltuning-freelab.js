/* =============================================================
 * sqltuning-freelab.js — SQL 튜닝 소모임 자유 실습 & 플랜 분석기
 * ============================================================= */

(function () {
  const VER = "1.12.0";
  const BASE = "https://cdn.jsdelivr.net/npm/sql.js@" + VER + "/dist/";

  const SCHEMA = `
    CREATE TABLE dept (
      deptno INTEGER PRIMARY KEY,
      dname TEXT,
      loc TEXT
    );
    INSERT INTO dept VALUES (10, 'ACCOUNTING', 'NEW YORK');
    INSERT INTO dept VALUES (20, 'RESEARCH', 'DALLAS');
    INSERT INTO dept VALUES (30, 'SALES', 'CHICAGO');
    INSERT INTO dept VALUES (40, 'OPERATIONS', 'BOSTON');

    CREATE TABLE emp (
      empno INTEGER PRIMARY KEY,
      ename TEXT,
      job TEXT,
      mgr INTEGER,
      hiredate TEXT,
      sal REAL,
      comm REAL,
      deptno INTEGER,
      FOREIGN KEY(deptno) REFERENCES dept(deptno)
    );
    INSERT INTO emp VALUES (7369, 'SMITH', 'CLERK', 7902, '1980-12-17', 800, NULL, 20);
    INSERT INTO emp VALUES (7499, 'ALLEN', 'SALESMAN', 7698, '1981-02-20', 1600, 300, 30);
    INSERT INTO emp VALUES (7521, 'WARD', 'SALESMAN', 7698, '1981-02-22', 1250, 500, 30);
    INSERT INTO emp VALUES (7566, 'JONES', 'MANAGER', 7839, '1981-04-02', 2975, NULL, 20);
    INSERT INTO emp VALUES (7654, 'MARTIN', 'SALESMAN', 7698, '1981-09-28', 1250, 1400, 30);
    INSERT INTO emp VALUES (7698, 'BLAKE', 'MANAGER', 7839, '1981-05-01', 2850, NULL, 30);
    INSERT INTO emp VALUES (7782, 'CLARK', 'MANAGER', 7839, '1981-06-09', 2450, NULL, 10);
    INSERT INTO emp VALUES (7788, 'SCOTT', 'ANALYST', 7566, '1987-04-19', 3000, NULL, 20);
    INSERT INTO emp VALUES (7839, 'KING', 'PRESIDENT', NULL, '1981-11-17', 5000, NULL, 10);
    INSERT INTO emp VALUES (7844, 'TURNER', 'SALESMAN', 7698, '1981-09-08', 1500, 0, 30);
    INSERT INTO emp VALUES (7876, 'ADAMS', 'CLERK', 7788, '1987-05-23', 1100, NULL, 20);
    INSERT INTO emp VALUES (7900, 'JAMES', 'CLERK', 7698, '1981-12-03', 950, NULL, 30);
    INSERT INTO emp VALUES (7902, 'FORD', 'ANALYST', 7566, '1981-12-03', 3000, NULL, 20);
    INSERT INTO emp VALUES (7934, 'MILLER', 'CLERK', 7782, '1982-01-23', 1300, NULL, 10);

    CREATE TABLE salgrade (
      grade INTEGER PRIMARY KEY,
      losal REAL,
      hisal REAL
    );
    INSERT INTO salgrade VALUES (1, 700, 1200);
    INSERT INTO salgrade VALUES (2, 1201, 1400);
    INSERT INTO salgrade VALUES (3, 1401, 2000);
    INSERT INTO salgrade VALUES (4, 2001, 3000);
    INSERT INTO salgrade VALUES (5, 3001, 9999);
    
    CREATE INDEX idx_emp_deptno ON emp(deptno);
    CREATE INDEX idx_emp_sal ON emp(sal);
  `;

  let SQL = null, db = null, loadingPromise = null;

  function loadSqlJs() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const start = () => window.initSqlJs({ locateFile: f => BASE + f }).then(s => { 
        SQL = s; 
        db = new SQL.Database(); 
        db.run(SCHEMA); 
        resolve(); 
      }).catch(reject);
      if (window.initSqlJs) return start();
      const sc = document.createElement("script");
      sc.src = BASE + "sql-wasm.js"; 
      sc.onload = start;
      sc.onerror = () => reject(new Error("sql.js 로드 실패"));
      document.head.appendChild(sc);
    });
    return loadingPromise;
  }

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function cellNull(v) {
    if (v === null) return `<span style="color:#aaa;font-style:italic;">NULL</span>`;
    return esc(v);
  }

  function resultTable(r) {
    if (!r || !r.cols) return "";
    const head = r.cols.map(c => `<th>${esc(c)}</th>`).join("");
    const body = r.vals.map(row => "<tr>" + row.map(v => `<td>${cellNull(v)}</td>`).join("") + "</tr>").join("");
    return `<div style="overflow:auto;border:1px solid var(--border-light);border-radius:6px;margin-top:12px;">
              <table class="ij-plan-table" style="margin:0;width:100%;">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
              </table>
            </div>`;
  }

  function formatExplainPlan(r) {
    if (!r || !r.cols) return "";
    let html = `<div style="font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; margin-top: 12px; font-size: 0.9rem; line-height: 1.5;">`;
    html += `<div style="color: #569cd6; font-weight: bold; margin-bottom: 10px;">SQLite EXPLAIN QUERY PLAN (Execution Tree)</div>`;
    
    r.vals.forEach(row => {
      // row: [id, parent, notused, detail]
      const id = row[0];
      const parent = row[1];
      const detail = row[3];
      
      // Calculate basic indentation based on id/parent heuristic for SQLite
      // SQLite's EXPLAIN QUERY PLAN produces a flat list, but 'detail' strings give hints or we can just print it sequentially
      // For simplicity in SQLite, we just print the detail with a bullet, as it's already structured well enough
      html += `<div><span style="color:#ce9178;">[ID:${id} P:${parent}]</span> <span style="color:#4ec9b0;">${esc(detail)}</span></div>`;
    });
    html += `</div>`;
    return html;
  }

  function init() {
    const container = document.getElementById("sqltuning-freelab-container");
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div style="padding: 16px; background: var(--bg-nav); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 0.9rem; font-weight: 700; color: var(--color-text);">
            <span style="color: var(--accent-cyan);">💡 내장 샘플 스키마:</span> <code>emp</code>, <code>dept</code>, <code>salgrade</code>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-freelab-run" class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;">▶️ SQL 실행</button>
            <button id="btn-freelab-plan" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">🔍 실행계획 분석</button>
          </div>
        </div>
        <div style="padding: 16px; flex-shrink: 0;">
          <textarea id="freelab-sql-input" style="width: 100%; height: 120px; font-family: monospace; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; background: var(--bg-textbook); color: var(--color-text); font-size: 14px; resize: vertical;" placeholder="여기에 SQL을 입력하세요. (예: SELECT * FROM emp a JOIN dept b ON a.deptno = b.deptno)"></textarea>
        </div>
        <div id="freelab-result-area" style="padding: 0 16px 16px 16px; flex-grow: 1; overflow-y: auto;">
          <div style="text-align:center; padding: 40px; color: var(--color-text-muted);">
            위 에디터에 쿼리를 작성하고 [SQL 실행] 또는 [실행계획 분석] 버튼을 클릭하세요.
          </div>
        </div>
      </div>
    `;

    loadSqlJs().then(() => {
      console.log("SQL Tuning Free Lab: SQLite WASM loaded.");
      
      const btnRun = document.getElementById("btn-freelab-run");
      const btnPlan = document.getElementById("btn-freelab-plan");
      const input = document.getElementById("freelab-sql-input");
      const resArea = document.getElementById("freelab-result-area");

      function executeSql(mode) {
        if (!db) return;
        const query = input.value.trim();
        if (!query) {
          resArea.innerHTML = `<div style="color: var(--accent-crimson); padding: 16px; font-weight: bold;">쿼리를 입력해주세요.</div>`;
          return;
        }

        try {
          if (mode === 'plan') {
            const planQuery = "EXPLAIN QUERY PLAN " + query;
            const res = db.exec(planQuery);
            if (res.length > 0) {
              const r = { cols: res[0].columns, vals: res[0].values };
              resArea.innerHTML = formatExplainPlan(r);
            } else {
              resArea.innerHTML = `<div style="color: var(--color-text-muted); padding: 16px;">실행계획 결과가 없습니다.</div>`;
            }
          } else {
            const startTime = performance.now();
            const res = db.exec(query);
            const ms = (performance.now() - startTime).toFixed(1);

            if (res.length > 0) {
              const r = { cols: res[0].columns, vals: res[0].values };
              resArea.innerHTML = `
                <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 8px;">
                  조회 완료: <b>${r.vals.length}</b> rows (${ms} ms)
                </div>
                ${resultTable(r)}
              `;
            } else {
              resArea.innerHTML = `<div style="font-size: 0.85rem; color: var(--color-text-muted); padding: 16px;">조회된 데이터가 없거나 쿼리가 성공적으로 수행되었습니다. (${ms} ms)</div>`;
            }
          }
        } catch (e) {
          resArea.innerHTML = `<div style="color: var(--accent-crimson); background: rgba(255,59,48,0.1); padding: 16px; border-radius: 6px; font-family: monospace; white-space: pre-wrap;">${esc(e.message)}</div>`;
        }
      }

      btnRun.addEventListener("click", () => executeSql('run'));
      btnPlan.addEventListener("click", () => executeSql('plan'));

    }).catch(err => {
      const resArea = document.getElementById("freelab-result-area");
      if (resArea) {
        resArea.innerHTML = `<div style="color: var(--accent-crimson); padding: 20px;">SQL 실습 모듈을 불러오지 못했습니다. (${esc(err.message)})</div>`;
      }
    });
  }

  // DOMContentLoaded 시 자동 초기화
  document.addEventListener("DOMContentLoaded", init);
})();
