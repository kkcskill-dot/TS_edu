/* =============================================================
 * cloud-db-playground.js — 클라우드 DB 실습 샌드박스 (SQL 변환 & AWS 시나리오)
 * ============================================================= */
(function () {
  const VER = "1.12.0";
  const BASE = "https://cdn.jsdelivr.net/npm/sql.js@" + VER + "/dist/";

  const SCHEMA = `
CREATE TABLE emp (empno INTEGER PRIMARY KEY, ename TEXT, job TEXT, mgr INTEGER, hiredate TEXT, sal INTEGER, comm INTEGER, deptno INTEGER);
INSERT INTO emp VALUES
 (7369,'SMITH','CLERK',7902,'1980-12-17',800,NULL,20),(7499,'ALLEN','SALESMAN',7698,'1981-02-20',1600,300,30),
 (7521,'WARD','SALESMAN',7698,'1981-02-22',1250,500,30),(7566,'JONES','MANAGER',7839,'1981-04-02',2975,NULL,20);
`;

  const SETS = {
    sql: {
      label: "문법 변환", missions: [
        { 
          type: "sql", t: "NVL 변환", 
          desc: "Oracle에서는 <code>NVL(comm, 0)</code>을 사용하여 NULL 값을 치환합니다. MySQL 환경에서 동일한 결과를 내도록 사원 이름(ename)과 커미션(NULL이면 0)을 조회하세요.", 
          hint: "MySQL에서는 IFNULL() 함수를 사용합니다.", 
          ans: "SELECT ename, IFNULL(comm, 0) FROM emp;" 
        },
        { 
          type: "sql", t: "ROWNUM 변환", 
          desc: "Oracle의 <code>WHERE ROWNUM <= 2</code>를 MySQL 스타일로 변환하여, 사원 테이블에서 최상단 2건만 조회하세요.", 
          hint: "MySQL에서는 LIMIT 절을 쿼리 맨 끝에 사용합니다.", 
          ans: "SELECT * FROM emp LIMIT 2;" 
        },
        { 
          type: "sql", t: "문자열 결합", 
          desc: "Oracle에서는 <code>ename || '님'</code> 기호를 씁니다. MySQL 스타일로 이름 뒤에 '님'을 붙여 조회하세요.", 
          hint: "SQLite 호환 샌드박스이므로 ||가 동작하지만, MySQL 표준인 CONCAT() 함수를 사용해 보세요.", 
          ans: "SELECT CONCAT(ename, '님') FROM emp;" 
        },
        { 
          type: "sql", t: "SYSDATE 변환", 
          desc: "Oracle의 <code>SYSDATE</code>를 MySQL 스타일로 변환하여, 현재 날짜와 시간을 조회하세요.", 
          hint: "MySQL에서는 NOW() 함수를 사용합니다. (SQLite 샌드박스 내부적으로 NOW()를 에뮬레이트합니다)", 
          ans: "SELECT NOW();" 
        },
        { 
          type: "sql", t: "외부 조인 (Outer Join)", 
          desc: "Oracle의 구형 외부 조인 문법 <code>WHERE e.deptno = d.deptno(+)</code> 대신, ANSI 표준 조인을 사용하여 부서가 없는 사원도 포함해 조회하는 쿼리 구조를 고민해 보세요. (실습: 사원 테이블 전체 건수 카운트)", 
          hint: "LEFT OUTER JOIN을 사용하는 것이 MySQL의 표준 방식입니다. (여기서는 간단히 COUNT(*)만 확인)", 
          ans: "SELECT COUNT(*) FROM emp;" 
        }
      ]
    },
    aws: {
      label: "인프라 시나리오", missions: [
        {
          type: "quiz", t: "접속 지연 트러블슈팅",
          desc: "새로 생성한 프라이빗 서브넷의 Aurora MySQL에 EC2 웹 서버에서 접근하려 하나 타임아웃(Timeout)이 발생합니다. 가장 먼저 확인해야 할 인프라 설정은 무엇일까요?",
          options: [
            "A. Aurora 인스턴스의 메모리 사용률 (CloudWatch)",
            "B. Aurora 보안 그룹(Security Group)의 인바운드 규칙",
            "C. 파라미터 그룹의 max_connections 수치",
            "D. Route 53의 DNS 레포트"
          ],
          ans: "B",
          hint: "클라우드 네트워크 환경에서 포트 접근이 아예 막히는 것은 방화벽 역할의 인프라 설정 문제일 확률이 높습니다.",
          explain: "VPC 내에서 리소스 간 네트워크 연결이 막힌 경우, 가장 먼저 Security Group의 포트(3306) 허용 여부를 점검해야 합니다."
        },
        {
          type: "quiz", t: "장기 트랜잭션 장애 대응",
          desc: "갑자기 DB 인스턴스의 성능이 크게 저하되고, 모니터링 툴에서 History List Length(Undo Log 지표)가 수십만 단위로 급증한 것을 발견했습니다. 가장 적절한 조치는 무엇입니까?",
          options: [
            "A. 인스턴스 스펙(Scale-up)을 즉시 올린다.",
            "B. 버퍼 풀 크기(innodb_buffer_pool_size) 파라미터를 늘리고 재시작한다.",
            "C. SHOW PROCESSLIST로 수 시간째 활성 상태인(또는 Sleep 상태의) 장기 트랜잭션 세션을 찾아 KILL 한다.",
            "D. Undo Log를 물리적으로 삭제한다."
          ],
          ans: "C",
          hint: "MySQL의 MVCC 구조상, 커밋되지 않은 트랜잭션이 하나라도 있으면 Undo Log 정리가 불가능해 전체 DB가 느려집니다.",
          explain: "MySQL(InnoDB)에서는 가장 오래된 트랜잭션이 종료될 때까지 이전 버전(Undo) 데이터가 삭제되지 않고 쌓이므로, 원인이 되는 세션을 식별하고 종료(KILL)해야 시스템이 정상화됩니다."
        },
        {
          type: "quiz", t: "가용성과 페일오버",
          desc: "3개의 AZ(가용 영역)에 Primary 1대와 Replica 2대를 배치한 Aurora 클러스터를 운영 중입니다. Primary 인스턴스가 위치한 AZ-A 데이터센터에 화재가 발생했습니다. 서비스는 어떻게 되나요?",
          options: [
            "A. 서비스가 즉각 중단되며, 데이터가 일부 유실될 수 있다.",
            "B. 접속 지연 없이 100% 무중단으로 동작한다.",
            "C. 수십 초의 페일오버(Failover) 시간을 거쳐 다른 AZ의 Replica가 Primary로 승격되며 서비스가 복구된다.",
            "D. 관리자가 콘솔에 접속해 수동으로 복구 명령을 내려야만 한다."
          ],
          ans: "C",
          hint: "AWS 클라우드의 Multi-AZ 구성은 장애 시 '자동' 복구를 지향합니다.",
          explain: "Aurora는 장애 감지 시 DNS 엔드포인트를 변경하여 Replica 중 하나를 수십 초 이내에 Primary로 자동 승격(Failover)시킵니다."
        },
        {
          type: "quiz", t: "데이터베이스 파라미터 변경",
          desc: "MySQL의 max_connections 값을 늘리고 싶습니다. 온프레미스에서는 my.cnf 파일을 직접 수정했지만, AWS RDS/Aurora 환경에서는 어떻게 해야 합니까?",
          options: [
            "A. SSH로 DB 인스턴스에 접속하여 my.cnf 파일을 vim으로 수정한다.",
            "B. AWS 콘솔에서 해당 DB 클러스터에 연결된 '파라미터 그룹(Parameter Group)'을 수정하고 반영한다.",
            "C. CloudWatch에서 max_connections 알람을 생성한다.",
            "D. 파라미터는 AWS가 자동 관리하므로 사용자가 변경할 수 없다."
          ],
          ans: "B",
          hint: "완전 관리형(Managed) 서비스에서는 OS 레벨의 접근을 차단하고 콘솔/API를 통한 관리 환경을 제공합니다.",
          explain: "AWS의 관리형 DB 서비스(RDS, Aurora)는 OS 권한을 제공하지 않으므로, 모든 DB 엔진 설정은 '파라미터 그룹'을 통해 중앙에서 관리하고 적용해야 합니다."
        },
        {
          type: "quiz", t: "성능 병목 분석 도구",
          desc: "과거 특정 시점(예: 어제 오후 2시)에 DB에 어떤 SQL이 가장 많은 부하를 일으켰는지 분석해야 합니다. 오라클의 AWR을 대체할 수 있는 AWS의 가장 적절한 모니터링 도구는 무엇입니까?",
          options: [
            "A. Performance Insights (PI)",
            "B. AWS CloudTrail",
            "C. Amazon GuardDuty",
            "D. VPC Flow Logs"
          ],
          ans: "A",
          hint: "DB 내부의 세션 활동, 대기 이벤트(Wait Events), 상위 SQL을 시각적으로 보여주는 도구입니다.",
          explain: "Performance Insights(PI)는 오라클의 ASH/AWR과 유사하게 DB 부하를 모니터링하고 분석할 수 있는 AWS의 강력한 기본 성능 진단 도구입니다."
        }
      ]
    }
  };
  const LEVELS = ["sql", "aws"];

  let SQL = null, db = null, loadingPromise = null;
  const solved = { sql: new Set(), aws: new Set() };
  let level = "sql", cur = 0;

  function shim(sql) { 
    // SQLite shim
    return sql.replace(/\bSYSDATE\b/gi, "date('now')")
              .replace(/\bCONCAT\((.*?),\s*(.*?)\)/gi, "($1 || $2)");
  }
  function esc(v) { if (v === null || v === undefined) return "∅"; return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function cellNull(v) { if (v === null || v === undefined) return '<span style="color:var(--accent-crimson);font-style:italic;">NULL</span>'; return esc(v); }
  function execSql(sql) { return db.exec(shim(sql)); }
  function rowsOf(res) { const r = res && res.length ? res[res.length - 1] : null; return r ? { cols: r.columns, vals: r.values } : null; }

  function norm(vals) {
    const rows = vals.map(r => JSON.stringify(r));
    rows.sort();
    return JSON.stringify(rows);
  }
  function gradeSql(userSql, m) {
    let u, a;
    try { u = rowsOf(execSql(userSql)); } catch (e) { return { err: e.message }; }
    if (!u) return { no: true };
    try { a = rowsOf(execSql(m.ans)); } catch (e) { return { err: "채점 오류: " + e.message }; }
    const ok = u.vals.length === a.vals.length && u.cols.length === a.cols.length && norm(u.vals) === norm(a.vals);
    return { ok: ok, u: u, a: a };
  }

  function resultTable(r) {
    const head = r.cols.map(c => `<th>${esc(c)}</th>`).join("");
    const body = r.vals.map(row => "<tr>" + row.map(v => `<td>${cellNull(v)}</td>`).join("") + "</tr>").join("");
    return `<div style="overflow:auto;border:1px solid var(--border-light);border-radius:0 0 6px 6px;border-top:none;"><table class="ij-plan-table" style="margin:0;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function resultHeader(label, n) { return `<div style="display:flex;align-items:center;gap:8px;background:#002A5B;color:#fff;padding:7px 12px;border-radius:6px 6px 0 0;font-size:0.82rem;font-weight:700;"><span>${label}</span><span style="margin-left:auto;font-weight:400;opacity:.85;">${n} rows</span></div>`; }

  function loadSqlJs() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const start = () => window.initSqlJs({ locateFile: f => BASE + f }).then(s => { SQL = s; db = new SQL.Database(); db.run(SCHEMA); resolve(); }).catch(reject);
      if (window.initSqlJs) return start();
      const sc = document.createElement("script");
      sc.src = BASE + "sql-wasm.js"; sc.onload = start;
      sc.onerror = () => reject(new Error("sql.js 로드 실패"));
      document.head.appendChild(sc);
    });
    return loadingPromise;
  }

  function render(viewer) {
    const set = SETS[level], MIS = set.missions, m = MIS[cur];
    const levelTabs = LEVELS.map(lv =>
      `<button class="pg-lv" data-lv="${lv}" style="padding:6px 16px;border:1px solid ${lv === level ? "#002A5B" : "var(--border-light)"};background:${lv === level ? "#002A5B" : "var(--bg-card)"};color:${lv === level ? "#fff" : "var(--color-text-main)"};font-weight:700;font-size:0.82rem;cursor:pointer;border-radius:6px;">${SETS[lv].label} <span style="opacity:.75;font-weight:400;">${solved[lv].size}/${SETS[lv].missions.length}</span></button>`).join("");

    viewer.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <h2 style="margin:0;font-size:1.3rem;color:var(--color-text-main);">클라우드 DB 훈련장</h2>
        <div style="display:flex;gap:6px;margin-left:6px;">${levelTabs}</div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
        <div style="flex:0 0 240px;min-width:200px;">
          <div style="font-size:0.74rem;font-weight:800;color:#002A5B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">${set.label} 미션</div>
          <div id="pg-list"></div>
        </div>
        <div style="flex:1;min-width:330px;"><div id="pg-main"></div></div>
      </div>`;

    viewer.querySelectorAll(".pg-lv").forEach(el => el.addEventListener("click", () => { level = el.dataset.lv; cur = 0; render(viewer); }));

    const list = viewer.querySelector("#pg-list");
    list.innerHTML = MIS.map((x, i) =>
      `<div class="pg-m" data-i="${i}" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid ${i === cur ? "#002A5B" : "var(--border-light)"};border-radius:6px;margin-bottom:6px;cursor:pointer;background:${i === cur ? "#E6EDF7" : "var(--bg-card)"};">
        <span style="width:18px;height:18px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.66rem;font-weight:800;${solved[level].has(i) ? "background:var(--accent-emerald);color:#fff;" : "background:#EFEFEF;color:#64748B;"}">${solved[level].has(i) ? "✓" : i + 1}</span>
        <span style="font-size:0.82rem;font-weight:600;color:var(--color-text-main);">${x.t}</span></div>`).join("");
    list.querySelectorAll(".pg-m").forEach(el => el.addEventListener("click", () => { cur = +el.dataset.i; render(viewer); }));

    const main = viewer.querySelector("#pg-main");

    main.innerHTML = `
      <div style="background:#E6EDF7;border:1px solid #BBD0F2;border-radius:8px;padding:14px 18px;margin-bottom:12px;">
        <div style="font-size:0.74rem;font-weight:800;color:#002A5B;letter-spacing:.5px;margin-bottom:6px;">${set.label} · 미션 ${cur + 1} · ${m.t} ${solved[level].has(cur) ? "✅" : ""}</div>
        <div style="font-size:0.98rem;color:#121D2A;line-height:1.6;">${m.desc}</div>
      </div>
      <div id="pg-workspace"></div>
      <div id="pg-fb" style="margin-top:12px;"></div>
    `;

    const ws = main.querySelector("#pg-workspace");
    const fb = main.querySelector("#pg-fb");

    if (m.type === "sql") {
      ws.innerHTML = `
        <div style="font-size:0.78rem;color:var(--color-text-muted);margin-bottom:8px;"><b>스키마</b>: <code>emp</code>(empno, ename, job, mgr, hiredate, sal, comm, deptno)</div>
        <textarea id="pg-sql" spellcheck="false" placeholder="MySQL 포맷의 쿼리를 작성하세요…" style="width:100%;height:120px;box-sizing:border-box;padding:12px 14px;border-radius:6px;border:1px solid var(--border-light);background:#121D2A;color:#e6edf6;font-family:var(--font-mono);font-size:0.88rem;line-height:1.6;resize:vertical;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin:8px 0 12px;flex-wrap:wrap;">
          <button id="pg-check" style="padding:8px 20px;border:none;border-radius:6px;background:#F9BB00;color:#002A5B;font-weight:800;font-size:0.85rem;cursor:pointer;">▶ 실행 · 채점 (Ctrl+Enter)</button>
          <button id="pg-hint" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-size:0.8rem;cursor:pointer;">💡 힌트</button>
          <button id="pg-ans" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-size:0.8rem;cursor:pointer;">정답 보기</button>
        </div>
        <div id="pg-out"></div>
      `;

      const ta = ws.querySelector("#pg-sql"), out = ws.querySelector("#pg-out");
      const check = () => {
        const sql = ta.value.trim();
        if (!sql) { fb.innerHTML = ""; out.innerHTML = ""; return; }
        const g = gradeSql(sql, m);
        if (g.err) { fb.innerHTML = ""; out.innerHTML = `<div style="padding:12px 14px;border-radius:6px;background:#FDECEC;border:1px solid #E9A3A3;color:#8A1F1F;font-family:var(--font-mono);font-size:0.84rem;">⚠ ${esc(g.err)}</div>`; return; }
        if (g.no) { fb.innerHTML = '<div style="padding:10px 14px;border-radius:6px;background:#FFF6DA;border:1px solid #F9BB00;color:#121D2A;font-size:0.85rem;margin-bottom:10px;">결과가 없습니다. 조회 쿼리를 작성하세요.</div>'; out.innerHTML = ""; return; }
        if (g.ok) {
          solved[level].add(cur);
          fb.innerHTML = `<div style="padding:12px 16px;border-radius:6px;background:rgba(14,122,83,0.10);border:1px solid var(--accent-emerald);color:var(--accent-emerald);font-weight:700;font-size:0.9rem;margin-bottom:10px;">✅ 정답입니다!</div>`;
          const badge = viewer.querySelector('.pg-m[data-i="' + cur + '"] span');
          if (badge) { badge.textContent = "✓"; badge.style.background = "var(--accent-emerald)"; badge.style.color = "#fff"; }
          const lvBtn = viewer.querySelector('.pg-lv[data-lv="' + level + '"] span');
          if (lvBtn) lvBtn.textContent = solved[level].size + "/" + MIS.length;
        } else {
          fb.innerHTML = `<div style="padding:12px 16px;border-radius:6px;background:#FDECEC;border:1px solid #E9A3A3;color:#8A1F1F;font-weight:700;font-size:0.9rem;margin-bottom:10px;">❌ 결과가 기대와 다릅니다. (행 ${g.u.vals.length} vs 정답 ${g.a.vals.length}) 힌트를 참고하세요.</div>`;
        }
        out.innerHTML = resultHeader(g.ok ? "내 결과 (정답)" : "내 결과", g.u.vals.length) + resultTable(g.u);
      };

      ws.querySelector("#pg-check").addEventListener("click", check);
      ta.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); check(); } });
      ws.querySelector("#pg-hint").addEventListener("click", () => { fb.innerHTML = `<div style="padding:10px 14px;border-radius:6px;background:#FFF6DA;border:1px solid #F9BB00;color:#121D2A;font-size:0.88rem;margin-bottom:10px;">💡 ${m.hint}</div>`; });
      ws.querySelector("#pg-ans").addEventListener("click", () => { ta.value = m.ans; fb.innerHTML = `<div style="padding:10px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);color:var(--color-text-muted);font-size:0.82rem;margin-bottom:10px;">정답 SQL을 넣었습니다. 실행·채점으로 확인하세요.</div>`; });

    } else if (m.type === "quiz") {
      ws.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${m.options.map((opt, idx) => {
            const val = String.fromCharCode(65 + idx);
            return `
              <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border:1px solid var(--border-light);border-radius:8px;cursor:pointer;background:var(--bg-card);transition:all 0.2s;">
                <input type="radio" name="pg-quiz-opt" value="${val}" style="margin-top:4px;">
                <span style="font-size:0.95rem;color:var(--color-text-main);line-height:1.5;">${opt}</span>
              </label>
            `;
          }).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin:16px 0 12px;flex-wrap:wrap;">
          <button id="pg-quiz-check" style="padding:8px 20px;border:none;border-radius:6px;background:#F9BB00;color:#002A5B;font-weight:800;font-size:0.85rem;cursor:pointer;">✔ 제출하기</button>
          <button id="pg-quiz-hint" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-size:0.8rem;cursor:pointer;">💡 힌트</button>
        </div>
      `;

      ws.querySelectorAll("label").forEach(lbl => {
        lbl.addEventListener("click", () => {
          ws.querySelectorAll("label").forEach(l => { l.style.borderColor = "var(--border-light)"; l.style.background = "var(--bg-card)"; });
          lbl.style.borderColor = "#002A5B"; lbl.style.background = "#E6EDF7";
          lbl.querySelector("input").checked = true;
        });
      });

      ws.querySelector("#pg-quiz-check").addEventListener("click", () => {
        const checked = ws.querySelector("input[name='pg-quiz-opt']:checked");
        if (!checked) {
          fb.innerHTML = `<div style="padding:10px 14px;border-radius:6px;background:#FFF6DA;border:1px solid #F9BB00;color:#121D2A;font-size:0.85rem;">옵션을 선택해 주세요.</div>`;
          return;
        }
        if (checked.value === m.ans) {
          solved[level].add(cur);
          fb.innerHTML = `
            <div style="padding:14px 18px;border-radius:8px;background:rgba(14,122,83,0.10);border:1px solid var(--accent-emerald);">
              <div style="color:var(--accent-emerald);font-weight:800;font-size:1rem;margin-bottom:6px;">✅ 정답입니다!</div>
              <div style="font-size:0.9rem;color:var(--color-text-main);line-height:1.5;">${m.explain}</div>
            </div>`;
          const badge = viewer.querySelector('.pg-m[data-i="' + cur + '"] span');
          if (badge) { badge.textContent = "✓"; badge.style.background = "var(--accent-emerald)"; badge.style.color = "#fff"; }
          const lvBtn = viewer.querySelector('.pg-lv[data-lv="' + level + '"] span');
          if (lvBtn) lvBtn.textContent = solved[level].size + "/" + MIS.length;
        } else {
          fb.innerHTML = `<div style="padding:12px 16px;border-radius:6px;background:#FDECEC;border:1px solid #E9A3A3;color:#8A1F1F;font-weight:700;font-size:0.9rem;">❌ 틀렸습니다. 다시 고민해 보세요.</div>`;
        }
      });
      ws.querySelector("#pg-quiz-hint").addEventListener("click", () => { fb.innerHTML = `<div style="padding:10px 14px;border-radius:6px;background:#FFF6DA;border:1px solid #F9BB00;color:#121D2A;font-size:0.88rem;margin-bottom:10px;">💡 ${m.hint}</div>`; });
    }
  }

  function mount(viewer, lv) {
    if (!viewer) return;
    if (lv && SETS[lv]) { level = lv; cur = 0; }
    viewer.innerHTML = `<div style="text-align:center;padding:48px;color:var(--color-text-muted);"><div class="loader" style="margin:0 auto 12px;width:26px;height:26px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>환경 준비 중…</div>`;
    loadSqlJs().then(() => render(viewer)).catch(err => { viewer.innerHTML = `<div style="padding:20px;color:var(--accent-crimson);background:rgba(239,68,68,0.1);border-radius:6px;">로딩 실패<br><small>${esc(err.message)}</small></div>`; });
  }

  // index.html에서 버튼 클릭 시 mount
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("nav-btn-cloud-playground");
    if (btn) {
      btn.addEventListener("click", () => {
        mount(document.getElementById("cloud-playground-viewer"), "sql");
      });
    }
  });

})();
