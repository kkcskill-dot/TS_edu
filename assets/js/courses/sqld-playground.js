/* =============================================================
 * sqld-playground.js — 실전문제 内 인터랙티브 SQL 실습 환경
 *  sql.js(SQLite WebAssembly)로 브라우저에서 진짜 SQL을 실행.
 *  - 샘플 스키마: SCOTT(EMP/DEPT/SALGRADE) — SQLD 단골
 *  - 자유 입력 SQL → 실행 → 결과 테이블, 백엔드 불필요(지연 로드)
 *  - Oracle 습관 일부 치환(NVL→IFNULL, MINUS→EXCEPT, SYSDATE→date('now')) + dual 제공
 *  사용: SqldPlayground.mount(viewerElement)
 * ============================================================= */
(function () {
  const VER = "1.12.0";
  const BASE = "https://cdn.jsdelivr.net/npm/sql.js@" + VER + "/dist/";

  const SCHEMA = `
CREATE TABLE dept (deptno INTEGER PRIMARY KEY, dname TEXT, loc TEXT);
INSERT INTO dept VALUES (10,'ACCOUNTING','NEW YORK'),(20,'RESEARCH','DALLAS'),
 (30,'SALES','CHICAGO'),(40,'OPERATIONS','BOSTON');

CREATE TABLE emp (
  empno INTEGER PRIMARY KEY, ename TEXT, job TEXT, mgr INTEGER,
  hiredate TEXT, sal INTEGER, comm INTEGER, deptno INTEGER);
INSERT INTO emp VALUES
 (7369,'SMITH','CLERK',7902,'1980-12-17',800,NULL,20),
 (7499,'ALLEN','SALESMAN',7698,'1981-02-20',1600,300,30),
 (7521,'WARD','SALESMAN',7698,'1981-02-22',1250,500,30),
 (7566,'JONES','MANAGER',7839,'1981-04-02',2975,NULL,20),
 (7654,'MARTIN','SALESMAN',7698,'1981-09-28',1250,1400,30),
 (7698,'BLAKE','MANAGER',7839,'1981-05-01',2850,NULL,30),
 (7782,'CLARK','MANAGER',7839,'1981-06-09',2450,NULL,10),
 (7788,'SCOTT','ANALYST',7566,'1987-04-19',3000,NULL,20),
 (7839,'KING','PRESIDENT',NULL,'1981-11-17',5000,NULL,10),
 (7844,'TURNER','SALESMAN',7698,'1981-09-08',1500,0,30),
 (7876,'ADAMS','CLERK',7788,'1987-05-23',1100,NULL,20),
 (7900,'JAMES','CLERK',7698,'1981-12-03',950,NULL,30),
 (7902,'FORD','ANALYST',7566,'1981-12-03',3000,NULL,20),
 (7934,'MILLER','CLERK',7782,'1982-01-23',1300,NULL,10);

CREATE TABLE salgrade (grade INTEGER, losal INTEGER, hisal INTEGER);
INSERT INTO salgrade VALUES (1,700,1200),(2,1201,1400),(3,1401,2000),(4,2001,3000),(5,3001,9999);

CREATE TABLE dual (dummy TEXT);
INSERT INTO dual VALUES ('X');
`;

  const SAMPLES = [
    { t: "조인 (EMP × DEPT)", q: "SELECT e.ename, e.job, d.dname, d.loc\nFROM emp e JOIN dept d ON e.deptno = d.deptno\nORDER BY d.dname;" },
    { t: "집계 + GROUP BY/HAVING", q: "SELECT deptno, COUNT(*) cnt, ROUND(AVG(sal)) avg_sal\nFROM emp\nGROUP BY deptno\nHAVING COUNT(*) >= 3;" },
    { t: "NULL 집계 함정", q: "SELECT COUNT(*) AS rows_all, COUNT(comm) AS cnt_comm,\n       SUM(comm) AS sum_comm, AVG(comm) AS avg_comm\nFROM emp;" },
    { t: "서브쿼리(평균 이상)", q: "SELECT ename, sal\nFROM emp\nWHERE sal > (SELECT AVG(sal) FROM emp)\nORDER BY sal DESC;" },
    { t: "윈도우 순위 함수", q: "SELECT ename, sal,\n       RANK()       OVER (ORDER BY sal DESC) rk,\n       DENSE_RANK() OVER (ORDER BY sal DESC) drk,\n       ROW_NUMBER() OVER (ORDER BY sal DESC) rn\nFROM emp;" },
    { t: "집합 연산자(INTERSECT)", q: "SELECT deptno FROM emp\nINTERSECT\nSELECT deptno FROM dept;" },
    { t: "급여 등급(범위 조인)", q: "SELECT e.ename, e.sal, s.grade\nFROM emp e JOIN salgrade s ON e.sal BETWEEN s.losal AND s.hisal\nORDER BY s.grade;" }
  ];

  let SQL = null, db = null, loadingPromise = null;

  function shim(sql) {
    return sql
      .replace(/\bNVL\s*\(/gi, "IFNULL(")
      .replace(/\bMINUS\b/gi, "EXCEPT")
      .replace(/\bSYSDATE\b/gi, "date('now')");
  }

  function loadSqlJs() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const start = () => window.initSqlJs({ locateFile: f => BASE + f })
        .then(s => { SQL = s; db = new SQL.Database(); db.run(SCHEMA); resolve(); })
        .catch(reject);
      if (window.initSqlJs) return start();
      const sc = document.createElement("script");
      sc.src = BASE + "sql-wasm.js";
      sc.onload = start;
      sc.onerror = () => reject(new Error("sql.js 로드 실패(네트워크/CDN 확인)"));
      document.head.appendChild(sc);
    });
    return loadingPromise;
  }

  function esc(v) {
    if (v === null || v === undefined) return '<span style="color:var(--accent-crimson);font-style:italic;">NULL</span>';
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  function renderResult(rootResEl, sql) {
    let res;
    try {
      res = db.exec(shim(sql));
    } catch (e) {
      rootResEl.innerHTML = `<div style="padding:14px 16px;border-radius:6px;background:#FDECEC;border:1px solid #E9A3A3;color:#8A1F1F;font-family:var(--font-mono);font-size:0.85rem;">
        ⚠ ${esc(e.message)}</div>`;
      return;
    }
    const last = res.length ? res[res.length - 1] : null;
    if (!last) {
      const n = db.getRowsModified();
      rootResEl.innerHTML = `<div style="padding:12px 16px;border-radius:6px;background:rgba(14,122,83,0.08);border:1px solid var(--accent-emerald);color:var(--accent-emerald);font-size:0.85rem;">✔ 실행 완료 — 영향받은 행: ${n}</div>`;
      return;
    }
    const head = last.columns.map(c => `<th>${esc(c)}</th>`).join("");
    const body = last.values.map(r => "<tr>" + r.map(v => `<td>${esc(v)}</td>`).join("") + "</tr>").join("");
    rootResEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:#002A5B;color:#fff;padding:7px 12px;border-radius:6px 6px 0 0;font-size:0.82rem;font-weight:700;">
        <span>실행 결과</span><span style="margin-left:auto;font-weight:400;opacity:.85;">${last.values.length} rows</span>
      </div>
      <div style="overflow:auto;border:1px solid var(--border-light);border-top:none;border-radius:0 0 6px 6px;">
        <table class="ij-plan-table" style="margin:0;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </div>`;
  }

  function mount(viewer) {
    if (!viewer) return;
    viewer.innerHTML = `<div style="text-align:center;padding:48px;color:var(--color-text-muted);">
      <div class="loader" style="margin:0 auto 12px;width:26px;height:26px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>
      SQL 엔진(SQLite) 불러오는 중…</div>`;

    loadSqlJs().then(() => {
      viewer.innerHTML = `
        <div style="margin-bottom:14px;">
          <h2 style="margin:0 0 6px;font-size:1.3rem;color:var(--color-text-main);">🧪 SQL 실습 환경</h2>
          <p style="margin:0;color:var(--color-text-muted);font-size:0.86rem;">브라우저 내장 SQLite로 <strong>직접 SQL을 작성·실행</strong>해 보세요. (SCOTT 샘플 스키마)</p>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          <div style="flex:0 0 200px;min-width:180px;">
            <div style="font-size:0.78rem;font-weight:800;color:var(--sph-navy,#002A5B);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">스키마</div>
            <div id="pg-schema"></div>
            <div style="margin-top:12px;font-size:0.72rem;color:var(--color-text-muted);line-height:1.5;">
              <b>Oracle 차이</b>: <code>NVL/MINUS/SYSDATE</code>는 자동 치환. <code>DECODE·CONNECT BY·(+)</code>는 미지원(SQLite).
            </div>
          </div>
          <div style="flex:1;min-width:320px;">
            <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
              <select id="pg-sample" style="flex:1;min-width:180px;padding:7px 10px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-size:0.82rem;">
                <option value="">💡 샘플 쿼리 선택…</option>
                ${SAMPLES.map((s, i) => `<option value="${i}">${s.t}</option>`).join("")}
              </select>
              <button id="pg-reset" style="padding:7px 12px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-size:0.8rem;cursor:pointer;">DB 초기화</button>
            </div>
            <textarea id="pg-sql" spellcheck="false" style="width:100%;height:150px;box-sizing:border-box;padding:12px 14px;border-radius:6px;border:1px solid var(--border-light);background:#121D2A;color:#e6edf6;font-family:var(--font-mono);font-size:0.88rem;line-height:1.6;resize:vertical;">SELECT * FROM emp;</textarea>
            <div style="display:flex;align-items:center;gap:10px;margin:8px 0 12px;">
              <button id="pg-run" style="padding:8px 20px;border:none;border-radius:6px;background:#F9BB00;color:#002A5B;font-weight:800;font-size:0.85rem;cursor:pointer;">▶ 실행 (Ctrl+Enter)</button>
              <span style="font-size:0.74rem;color:var(--color-text-muted);">여러 문장 가능 · 마지막 SELECT 결과 표시</span>
            </div>
            <div id="pg-res"></div>
          </div>
        </div>`;

      const schemaEl = viewer.querySelector("#pg-schema");
      const TABLES = { dept: ["deptno", "dname", "loc"], emp: ["empno", "ename", "job", "mgr", "hiredate", "sal", "comm", "deptno"], salgrade: ["grade", "losal", "hisal"] };
      schemaEl.innerHTML = Object.keys(TABLES).map(t =>
        `<div class="pg-tbl" data-tbl="${t}" style="border:1px solid var(--border-light);border-radius:6px;margin-bottom:8px;overflow:hidden;cursor:pointer;background:var(--bg-card);">
          <div style="background:var(--bg-card);padding:6px 10px;font-weight:700;font-size:0.82rem;color:var(--sph-navy,#002A5B);border-bottom:1px solid var(--border-light);">${t}</div>
          <div style="padding:6px 10px;font-size:0.72rem;color:var(--color-text-muted);font-family:var(--font-mono);">${TABLES[t].join(", ")}</div>
        </div>`).join("");

      const ta = viewer.querySelector("#pg-sql");
      const resEl = viewer.querySelector("#pg-res");
      const runIt = () => renderResult(resEl, ta.value);

      viewer.querySelector("#pg-run").addEventListener("click", runIt);
      ta.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runIt(); } });
      viewer.querySelector("#pg-sample").addEventListener("change", e => {
        const i = e.target.value;
        if (i !== "") { ta.value = SAMPLES[+i].q; runIt(); }
      });
      schemaEl.querySelectorAll(".pg-tbl").forEach(el => el.addEventListener("click", () => {
        ta.value = "SELECT * FROM " + el.dataset.tbl + ";"; runIt();
      }));
      viewer.querySelector("#pg-reset").addEventListener("click", () => {
        try { db.run("DROP TABLE IF EXISTS emp;DROP TABLE IF EXISTS dept;DROP TABLE IF EXISTS salgrade;DROP TABLE IF EXISTS dual;"); db.run(SCHEMA); } catch (e) {}
        resEl.innerHTML = `<div style="padding:10px 14px;border-radius:6px;background:rgba(14,122,83,0.08);border:1px solid var(--accent-emerald);color:var(--accent-emerald);font-size:0.83rem;">✔ 샘플 DB를 초기 상태로 되돌렸습니다.</div>`;
      });

      runIt(); // 첫 화면: SELECT * FROM emp
    }).catch(err => {
      viewer.innerHTML = `<div style="padding:20px;color:var(--accent-crimson);background:rgba(239,68,68,0.1);border-radius:6px;">
        SQL 엔진을 불러오지 못했습니다.<br><small>${esc(err.message)}</small></div>`;
    });
  }

  window.SqldPlayground = { mount: mount };
})();
