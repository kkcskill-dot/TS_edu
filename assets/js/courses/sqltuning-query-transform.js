/* =============================================================
 * sqltuning-query-transform.js
 *  ── SQL튜닝 소모임 1강: 쿼리 변환 시뮬레이터
 *
 *  옵티마이저의 쿼리 변환(Query Transformation)을 힌트 토글로 체험한다.
 *  실제 DB를 실행하지 않고, 강의자료(01-sql-plan-optimizer.md)에 실린
 *  Before/After 실행계획을 그대로 전환해 보여주는 순수 시뮬레이터.
 *  → 힌트 미호환 문제 없음(옵티마이저를 흉내내지 않고 실제 플랜을 재생).
 * ============================================================= */
(function () {
  "use strict";

  // ── 시나리오 데이터 (강의자료 1강 3대 주제) ───────────────────
  const SCENARIOS = {
    unnest: {
      title: "서브쿼리 Unnesting",
      desc: "IN 서브쿼리를 조인으로 풀지(Unnest) 못하면 FILTER 루프에 빠진다.",
      sql:
`SELECT c.cust_nm, c.grade
  FROM t_customer c
 WHERE c.cust_id IN (
       SELECT /*+ {HINT} */ p.cust_id
         FROM t_payment p
        WHERE p.pay_dt LIKE '202310%'
          AND p.amount > 50000
 );`,
      states: {
        before: {
          hint: "NO_UNNEST",
          label: "NO_UNNEST",
          verdict: "bad",
          headline: "FILTER 루프 — 서브쿼리를 100만 번 반복 실행",
          plan: [
            { id: 0, op: "SELECT STATEMENT",              d: 0, starts: "1",    erows: "",     arows: "11",   buffers: "4103K" },
            { id: 1, op: "FILTER",                        d: 1, starts: "1",    erows: "",     arows: "11",   buffers: "4103K", hot: true },
            { id: 2, op: "TABLE ACCESS FULL",             d: 2, starts: "1",    erows: "1000K",arows: "1000K",buffers: "8214",  name: "T_CUSTOMER" },
            { id: 3, op: "TABLE ACCESS BY INDEX ROWID",   d: 2, starts: "1000K",erows: "1",    arows: "11",   buffers: "4095K", name: "T_PAYMENT", hot: true },
            { id: 4, op: "INDEX RANGE SCAN",              d: 3, starts: "1000K",erows: "1",    arows: "980K", buffers: "3110K", name: "T_PAYMENT_IX", hot: true },
          ],
          metrics: { starts: 1000000, buffers: 4103000, timeSec: 158.44 },
          note: "Id 3~4의 Starts=1,000,000 → 고객 100만 건마다 서브쿼리 재실행. 이것이 FILTER 루프의 정체."
        },
        after: {
          hint: "UNNEST HASH_SJ",
          label: "UNNEST HASH_SJ",
          verdict: "good",
          headline: "HASH JOIN SEMI — 조인 한 번으로 종결",
          plan: [
            { id: 0, op: "SELECT STATEMENT",  d: 0, starts: "1", erows: "",     arows: "11",   buffers: "16428" },
            { id: 1, op: "HASH JOIN SEMI",    d: 1, starts: "1", erows: "11",   arows: "11",   buffers: "16428", hot: true },
            { id: 2, op: "TABLE ACCESS FULL", d: 2, starts: "1", erows: "11",   arows: "11",   buffers: "8214", name: "T_PAYMENT" },
            { id: 3, op: "TABLE ACCESS FULL", d: 2, starts: "1", erows: "1000K",arows: "1000K",buffers: "8214", name: "T_CUSTOMER" },
          ],
          metrics: { starts: 1, buffers: 16428, timeSec: 0.48 },
          note: "Starts가 모두 1로 복귀 → 반복 소멸. Buffers 약 250배 감소, 2분 38초 → 0.48초."
        }
      },
      takeaway: "IN/EXISTS 서브쿼리가 FILTER로 풀리면 <code>UNNEST</code> 힌트로 조인(SEMI)을 유도하라. 판독 열쇠는 <b>Starts</b>."
    },

    merge: {
      title: "View Merging",
      desc: "GROUP BY가 든 인라인 뷰는 병합(Merge)되지 않아 조건절 밀어넣기가 막힌다.",
      sql:
`SELECT a.col1, b.total
  FROM t_main a,
       (SELECT /*+ {HINT} */ col1, SUM(col2) AS total
          FROM t_detail
         GROUP BY col1) b
 WHERE a.col1 = b.col1
   AND a.region = 'SEOUL';`,
      states: {
        before: {
          hint: "NO_MERGE",
          label: "NO_MERGE",
          verdict: "bad",
          headline: "뷰가 통째로 먼저 집계 — 조건절이 안으로 못 들어감",
          plan: [
            { id: 0, op: "SELECT STATEMENT",   d: 0, starts: "1", erows: "",     arows: "20",   buffers: "88240" },
            { id: 1, op: "HASH JOIN",          d: 1, starts: "1", erows: "20",   arows: "20",   buffers: "88240", hot: true },
            { id: 2, op: "TABLE ACCESS FULL",  d: 2, starts: "1", erows: "20",   arows: "20",   buffers: "40",   name: "T_MAIN" },
            { id: 3, op: "VIEW",               d: 2, starts: "1", erows: "5000K",arows: "5000K",buffers: "88200", name: "", hot: true },
            { id: 4, op: "HASH GROUP BY",      d: 3, starts: "1", erows: "5000K",arows: "5000K",buffers: "88200", hot: true },
            { id: 5, op: "TABLE ACCESS FULL",  d: 4, starts: "1", erows: "50M",  arows: "50M",  buffers: "88200", name: "T_DETAIL", hot: true },
          ],
          metrics: { starts: 1, buffers: 88240, timeSec: 41.90 },
          note: "region='SEOUL' 조건이 뷰 밖에 갇혀 T_DETAIL 5,000만 건을 전부 집계한 뒤에야 조인."
        },
        after: {
          hint: "MERGE",
          label: "MERGE",
          verdict: "good",
          headline: "뷰 병합 성공 — 조건절이 안으로 밀려 들어감(Predicate Pushing)",
          plan: [
            { id: 0, op: "SELECT STATEMENT",  d: 0, starts: "1", erows: "",   arows: "20",  buffers: "612" },
            { id: 1, op: "HASH GROUP BY",     d: 1, starts: "1", erows: "20", arows: "20",  buffers: "612" },
            { id: 2, op: "HASH JOIN",         d: 2, starts: "1", erows: "980",arows: "980", buffers: "612", hot: true },
            { id: 3, op: "TABLE ACCESS FULL", d: 3, starts: "1", erows: "20", arows: "20",  buffers: "40",  name: "T_MAIN" },
            { id: 4, op: "TABLE ACCESS BY INDEX ROWID", d: 3, starts: "1", erows: "980",arows: "980", buffers: "572", name: "T_DETAIL" },
            { id: 5, op: "INDEX RANGE SCAN",  d: 4, starts: "1", erows: "980",arows: "980", buffers: "12",  name: "T_DETAIL_IX" },
          ],
          metrics: { starts: 1, buffers: 612, timeSec: 0.09 },
          note: "병합 후 region 조건으로 필요한 980건만 읽음. Buffers 88,240 → 612 (약 144배)."
        }
      },
      takeaway: "집계·DISTINCT가 든 뷰는 병합이 막힌다. 필요하면 <code>MERGE</code>로 병합을 유도해 조건절을 안으로 밀어넣어라."
    },

    transitive: {
      title: "조건절 이행 (Transitive Predicate)",
      desc: "옵티마이저가 스스로 추가한 조건 때문에 조인 순서가 뒤틀리기도 한다.",
      sql:
`SELECT a.col1, b.total
  FROM big_a a, small_b b
 WHERE a.deptno = b.deptno
   AND a.deptno = 10{HINT_LINE}`,
      states: {
        before: {
          hint: "(힌트 없음)",
          label: "옵티마이저 자율",
          verdict: "bad",
          headline: "이행 조건(b.deptno=10)에 낚여 작은 테이블부터 읽음 → NL 폭발",
          plan: [
            { id: 0, op: "SELECT STATEMENT",            d: 0, starts: "1",  erows: "",    arows: "1200",  buffers: "241800" },
            { id: 1, op: "NESTED LOOPS",                d: 1, starts: "1",  erows: "8",   arows: "1200",  buffers: "241800", hot: true },
            { id: 2, op: "TABLE ACCESS FULL",           d: 2, starts: "1",  erows: "8",   arows: "1200",  buffers: "42",   name: "SMALL_B" },
            { id: 3, op: "TABLE ACCESS BY INDEX ROWID", d: 2, starts: "1200",erows: "1",  arows: "1200",  buffers: "241758",name: "BIG_A", hot: true },
            { id: 4, op: "INDEX RANGE SCAN",            d: 3, starts: "1200",erows: "1",  arows: "1200",  buffers: "3600", name: "BIG_A_IX", hot: true },
          ],
          metrics: { starts: 1200, buffers: 241800, timeSec: 12.30 },
          note: "옵티마이저가 b.deptno=10을 자동 생성 → small_b 통계가 좋아 보여 그쪽부터 드라이빙. NL Starts 폭증."
        },
        after: {
          hint: "LEADING(b a) USE_HASH(a)",
          label: "LEADING(b a) USE_HASH(a)",
          verdict: "good",
          headline: "작은 테이블(SMALL_B)로 해시 맵을 만들고 큰 테이블을 스캔",
          plan: [
            { id: 0, op: "SELECT STATEMENT",  d: 0, starts: "1", erows: "",    arows: "1200", buffers: "5820" },
            { id: 1, op: "HASH JOIN",         d: 1, starts: "1", erows: "1200",arows: "1200", buffers: "5820", hot: true },
            { id: 2, op: "TABLE ACCESS FULL", d: 2, starts: "1", erows: "8",   arows: "8",    buffers: "12",  name: "SMALL_B" },
            { id: 3, op: "TABLE ACCESS FULL", d: 2, starts: "1", erows: "1200",arows: "1200", buffers: "5808",name: "BIG_A" },
          ],
          metrics: { starts: 1, buffers: 5820, timeSec: 0.21 },
          note: "LEADING(b a) = 작은 SMALL_B를 Build Input(해시 맵)으로 고정. HASH JOIN 바로 아래 첫 자식이 SMALL_B인 것을 확인하라. NL 반복 소멸, Buffers 241,800 → 5,820."
        }
      },
      takeaway: "해시 조인은 <b>작은 테이블을 먼저(Build Input)</b> 리딩해야 한다. <code>LEADING(작은테이블 큰테이블)</code>으로 순서를 고정하라 — 첫 테이블이 곧 해시 맵을 만드는 쪽이다."
    }
  };

  const ORDER = ["unnest", "merge", "transitive"];

  // ── 유틸 ─────────────────────────────────────────────────────
  function abbr(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M";
    if (n >= 1000)    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
    return String(n);
  }

  // 숫자 카운트업 애니메이션
  function animateNumber(el, from, to, fmt, dur) {
    if (!el) return;
    const start = performance.now();
    const d = dur || 600;
    function step(now) {
      const t = Math.min(1, (now - start) / d);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const val = Math.round(from + (to - from) * eased);
      el.textContent = fmt(val);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = fmt(to);
    }
    requestAnimationFrame(step);
  }

  // 플랜 테이블 HTML (ij-plan-table 재사용)
  function buildPlanTable(state) {
    let html = `<table class="ij-plan-table">
      <thead><tr>
        <th>Id</th><th>Operation</th><th>Name</th>
        <th class="r">Starts</th><th class="r">E-Rows</th>
        <th class="r">A-Rows</th><th class="r">Buffers</th>
      </tr></thead><tbody>`;
    state.plan.forEach(row => {
      const indent = "&nbsp;&nbsp;".repeat(row.d);
      const rowStyle = row.hot
        ? ' style="background:rgba(239,68,68,0.10);"'
        : "";
      html += `<tr${rowStyle}>
        <td class="col-id">${row.id}</td>
        <td class="col-op">${indent}${row.op}</td>
        <td class="col-op" style="color:var(--color-text-muted);">${row.name || ""}</td>
        <td class="r col-starts">${row.starts}</td>
        <td class="r col-erows">${row.erows}</td>
        <td class="r col-arows">${row.arows}</td>
        <td class="r col-buf">${row.buffers}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }

  // ── 렌더 상태 ────────────────────────────────────────────────
  let curScenario = "unnest";
  let curState = "before";
  let prevMetrics = { starts: 0, buffers: 0, timeSec: 0 };

  function render(container) {
    const sc = SCENARIOS[curScenario];

    // 시나리오 탭
    const tabs = ORDER.map(k => {
      const active = k === curScenario;
      return `<button class="qt-scn-tab${active ? " active" : ""}" data-scn="${k}"
        style="padding:8px 14px;border-radius:6px;font-size:0.82rem;cursor:pointer;
        border:1px solid ${active ? "var(--accent-cyan)" : "var(--border-light)"};
        background:${active ? "rgba(6,182,212,0.15)" : "transparent"};
        color:${active ? "var(--accent-cyan)" : "var(--color-text-muted)"};
        font-weight:${active ? "700" : "400"};">${SCENARIOS[k].title}</button>`;
    }).join("");

    container.innerHTML = `
      <div style="padding:18px 20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">${tabs}</div>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 16px;">${sc.desc}</p>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
          <span style="font-size:0.8rem;color:var(--color-text-muted);">힌트 토글:</span>
          <button id="qt-btn-before" class="qt-hint-btn"
            style="padding:7px 14px;border-radius:6px;font-family:var(--font-mono);font-size:0.8rem;cursor:pointer;">
            ${sc.states.before.label}
          </button>
          <span style="color:var(--color-text-muted);">⇄</span>
          <button id="qt-btn-after" class="qt-hint-btn"
            style="padding:7px 14px;border-radius:6px;font-family:var(--font-mono);font-size:0.8rem;cursor:pointer;">
            ${sc.states.after.label}
          </button>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px;">
          <!-- SQL -->
          <pre style="margin:0;background:var(--bg-textbook,rgba(15,23,42,0.03));border:1px solid var(--border-light);
            border-radius:8px;padding:14px;overflow-x:auto;"><code id="qt-sql"
            style="font-family:var(--font-mono);font-size:0.82rem;white-space:pre;"></code></pre>

          <!-- 판정 배너 -->
          <div id="qt-verdict" style="border-radius:8px;padding:12px 16px;font-size:0.9rem;font-weight:700;"></div>

          <!-- 지표 3종 -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            <div class="qt-metric" style="border:1px solid var(--border-light);border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:0.72rem;color:var(--color-text-muted);letter-spacing:0.5px;">STARTS (반복 실행)</div>
              <div id="qt-m-starts" style="font-family:var(--font-mono);font-size:1.6rem;font-weight:800;margin-top:4px;"></div>
            </div>
            <div class="qt-metric" style="border:1px solid var(--border-light);border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:0.72rem;color:var(--color-text-muted);letter-spacing:0.5px;">BUFFERS (논리 I/O)</div>
              <div id="qt-m-buffers" style="font-family:var(--font-mono);font-size:1.6rem;font-weight:800;margin-top:4px;"></div>
            </div>
            <div class="qt-metric" style="border:1px solid var(--border-light);border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:0.72rem;color:var(--color-text-muted);letter-spacing:0.5px;">A-TIME (초)</div>
              <div id="qt-m-time" style="font-family:var(--font-mono);font-size:1.6rem;font-weight:800;margin-top:4px;"></div>
            </div>
          </div>

          <!-- 실행계획 -->
          <div>
            <div id="qt-headline" style="font-size:0.86rem;font-weight:700;margin-bottom:8px;"></div>
            <div id="qt-plan" style="overflow-x:auto;"></div>
          </div>

          <!-- 판독 노트 -->
          <div id="qt-note" style="border-left:4px solid var(--accent-cyan);background:rgba(6,182,212,0.05);
            padding:10px 14px;border-radius:0 6px 6px 0;font-size:0.82rem;line-height:1.6;"></div>

          <!-- 한 줄 정리 -->
          <div style="border:1px dashed var(--border-light);border-radius:8px;padding:12px 14px;font-size:0.83rem;line-height:1.6;">
            💡 <b>한 줄 정리</b> · ${sc.takeaway}
          </div>
        </div>
      </div>`;

    // 이벤트 바인딩
    container.querySelectorAll(".qt-scn-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        curScenario = btn.dataset.scn;
        curState = "before";
        prevMetrics = { starts: 0, buffers: 0, timeSec: 0 };
        render(container);
      });
    });
    const bBefore = container.querySelector("#qt-btn-before");
    const bAfter = container.querySelector("#qt-btn-after");
    if (bBefore) bBefore.addEventListener("click", () => setState(container, "before"));
    if (bAfter) bAfter.addEventListener("click", () => setState(container, "after"));

    paint(container, /*animate*/ false);
  }

  function setState(container, next) {
    if (curState === next) return;
    curState = next;
    paint(container, /*animate*/ true);
  }

  function paint(container, animate) {
    const sc = SCENARIOS[curScenario];
    const st = sc.states[curState];
    const good = st.verdict === "good";
    const accent = good ? "var(--accent-emerald,#10b981)" : "var(--ij-error,#ef4444)";

    // SQL (힌트 치환)
    let sqlText;
    if (curScenario === "transitive") {
      // 힌트가 SELECT 절에 붙는 시나리오
      sqlText = sc.sql.replace("{HINT_LINE}", "").replace(/\s+$/, ";");
      if (good) {
        sqlText = sqlText.replace("SELECT a.col1", "SELECT /*+ " + st.hint + " */ a.col1");
      }
    } else {
      sqlText = sc.sql.replace("{HINT}", st.hint);
    }
    const sqlEl = container.querySelector("#qt-sql");
    if (sqlEl) sqlEl.textContent = sqlText;

    // 토글 버튼 활성 스타일
    const bBefore = container.querySelector("#qt-btn-before");
    const bAfter = container.querySelector("#qt-btn-after");
    styleHintBtn(bBefore, curState === "before", false);
    styleHintBtn(bAfter, curState === "after", true);

    // 판정 배너
    const v = container.querySelector("#qt-verdict");
    if (v) {
      v.style.background = good ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)";
      v.style.color = accent;
      v.style.border = "1px solid " + accent;
      v.textContent = (good ? "✅ " : "🛑 ") + (good ? "튜닝 성공" : "장애 패턴");
    }

    // headline
    const hl = container.querySelector("#qt-headline");
    if (hl) { hl.textContent = st.headline; hl.style.color = accent; }

    // 지표 카운트업
    const mStarts = container.querySelector("#qt-m-starts");
    const mBuf = container.querySelector("#qt-m-buffers");
    const mTime = container.querySelector("#qt-m-time");
    if (mStarts) mStarts.style.color = st.metrics.starts > 1 ? "var(--ij-error,#ef4444)" : accent;
    if (mBuf) mBuf.style.color = accent;
    if (mTime) mTime.style.color = accent;

    if (animate) {
      animateNumber(mStarts, prevMetrics.starts, st.metrics.starts, abbr, 650);
      animateNumber(mBuf, prevMetrics.buffers, st.metrics.buffers, abbr, 650);
      animateNumber(mTime, Math.round(prevMetrics.timeSec * 100), Math.round(st.metrics.timeSec * 100),
        (v) => (v / 100).toFixed(2) + "s", 650);
    } else {
      if (mStarts) mStarts.textContent = abbr(st.metrics.starts);
      if (mBuf) mBuf.textContent = abbr(st.metrics.buffers);
      if (mTime) mTime.textContent = st.metrics.timeSec.toFixed(2) + "s";
    }
    prevMetrics = { starts: st.metrics.starts, buffers: st.metrics.buffers, timeSec: st.metrics.timeSec };

    // 플랜 테이블
    const planEl = container.querySelector("#qt-plan");
    if (planEl) {
      planEl.style.transition = "opacity 0.15s ease";
      planEl.style.opacity = "0.35";
      setTimeout(() => {
        planEl.innerHTML = buildPlanTable(st);
        planEl.style.opacity = "1";
      }, animate ? 120 : 0);
    }

    // 노트
    const noteEl = container.querySelector("#qt-note");
    if (noteEl) noteEl.innerHTML = "🔍 " + st.note;
  }

  function styleHintBtn(btn, active, isAfter) {
    if (!btn) return;
    if (active) {
      const col = isAfter ? "var(--accent-emerald,#10b981)" : "var(--ij-error,#ef4444)";
      btn.style.border = "1px solid " + col;
      btn.style.background = isAfter ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)";
      btn.style.color = col;
      btn.style.fontWeight = "700";
    } else {
      btn.style.border = "1px solid var(--border-light)";
      btn.style.background = "transparent";
      btn.style.color = "var(--color-text-muted)";
      btn.style.fontWeight = "400";
    }
  }

  // ── 초기화 ───────────────────────────────────────────────────
  function init() {
    const container = document.getElementById("sqltuning-qt-container");
    if (!container || container.dataset.initialized === "1") return;
    container.dataset.initialized = "1";
    curScenario = "unnest";
    curState = "before";
    prevMetrics = { starts: 0, buffers: 0, timeSec: 0 };
    render(container);
  }

  if (document.getElementById("sqltuning-qt-container")) {
    init();
  } else {
    const observer = new MutationObserver((mut, obs) => {
      if (document.getElementById("sqltuning-qt-container")) {
        init();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
