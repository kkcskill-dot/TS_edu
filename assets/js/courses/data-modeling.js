/* =============================================================
 * data-modeling.js — '데이터 모델링'(트랙 B · L2) 과정
 *  - 학습자료: assets/lessons/design/data-modeling/ch1~ch5.md (fetch + marked)
 *  - 신규 랩: ERD 뷰어 · 정규화 변환기
 *  - 재사용 랩(메뉴 data-target): 인덱스 시뮬레이터(panel-index) · 플랜 진단(panel-plan-diag)
 *  - 퀴즈: 데이터 모델링 종합 퀴즈
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/design/data-modeling/";
  const CHAPTERS = [
    { id: "c1", title: "1. 모델링 이론", file: "ch1.md" },
    { id: "c2", title: "2. 개념 모델링", file: "ch2.md" },
    { id: "c3", title: "3. 논리 모델링", file: "ch3.md" },
    { id: "c4", title: "4. 물리 모델링", file: "ch4.md" },
    { id: "c5", title: "5. 모델링 이야기", file: "ch5.md" }
  ];

  // ── 학습자료 (탭 + 마크다운 렌더) ──
  function initTextbook() {
    const tabbar = document.getElementById("dm-tb-tabs");
    const viewer = document.getElementById("dm-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};
    tabbar.innerHTML = CHAPTERS.map((c, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${c.id}"
        style="padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--sph-slate);white-space:nowrap;">${c.title}</button>`
    ).join("");

    async function show(id) {
      const c = CHAPTERS.find(x => x.id === id);
      if (!c) return;
      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));
      if (cache[id] === undefined) {
        viewer.innerHTML = '<div style="padding:24px;color:var(--sph-muted);">불러오는 중…</div>';
        try {
          const r = await fetch(BASE + c.file, { cache: "no-store" });
          cache[id] = r.ok ? await r.text() : "# 불러오기 실패\n`" + BASE + c.file + "`";
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
    show("c1");
  }

  // ── ERD 뷰어 (신규) — 샘플 스키마로 ER 구성요소 해부 ──
  const ENTITIES = [
    { id: "customer", name: "고객", code: "CUSTOMER", role: "상품을 주문하는 주체",
      attrs: [{ n: "cust_id", t: "NUMBER", key: "PK" }, { n: "cust_nm", t: "VARCHAR2(50)" }, { n: "grade", t: "CHAR(1)" }, { n: "join_dt", t: "DATE" }],
      rel: "고객 1 : N 주문" },
    { id: "orders", name: "주문", code: "ORDERS", role: "고객의 주문 1건(행위/이벤트)",
      attrs: [{ n: "order_id", t: "NUMBER", key: "PK" }, { n: "cust_id", t: "NUMBER", key: "FK", ref: "고객" }, { n: "order_dt", t: "DATE" }, { n: "status", t: "VARCHAR2(10)" }],
      rel: "주문 N : 1 고객 · 주문 1 : N 주문상품" },
    { id: "order_item", name: "주문상품", code: "ORDER_ITEM", role: "주문↔상품 교차(M:N 해소)",
      attrs: [{ n: "order_id", t: "NUMBER", key: "PK·FK", ref: "주문" }, { n: "prod_id", t: "NUMBER", key: "PK·FK", ref: "상품" }, { n: "qty", t: "NUMBER" }, { n: "price", t: "NUMBER" }],
      rel: "식별관계: PK = (order_id + prod_id)" },
    { id: "product", name: "상품", code: "PRODUCT", role: "판매 대상",
      attrs: [{ n: "prod_id", t: "NUMBER", key: "PK" }, { n: "prod_nm", t: "VARCHAR2(100)" }, { n: "price", t: "NUMBER" }, { n: "cat_cd", t: "VARCHAR2(8)" }],
      rel: "상품 1 : N 주문상품" }
  ];
  const CONCEPTS = [
    { id: "entity", label: "엔티티", desc: "업무에서 관리할 대상(명사). 박스 하나가 엔티티이며 테이블로 구현됩니다. 여기선 고객·주문·주문상품·상품 4개.", match: () => false },
    { id: "attr", label: "속성", desc: "엔티티가 가진 성질(컬럼). 박스 안의 각 행이 속성입니다. 한 속성에는 한 값(원자성)이 원칙입니다.", match: () => true },
    { id: "pk", label: "식별자(PK)", desc: "인스턴스를 유일하게 구분하는 주식별자. PK 배지가 붙은 속성으로, 개체 무결성(NOT NULL·유일)을 보장합니다.", match: a => a.key && a.key.indexOf("PK") >= 0 },
    { id: "fk", label: "관계(FK)", desc: "다른 엔티티의 키를 참조해 관계를 구현. FK 배지 속성입니다(참조 무결성). 주문.cust_id → 고객, 주문상품.order_id/prod_id → 주문/상품.", match: a => a.key && a.key.indexOf("FK") >= 0 },
    { id: "card", label: "카디널리티", desc: "관계 참여 수. 고객 1:N 주문, 주문 M:N 상품 → 교차 엔티티 '주문상품'으로 해소(주문 1:N 주문상품 N:1 상품).", match: () => false },
    { id: "ident", label: "식별/비식별", desc: "주문상품은 부모 키(order_id+prod_id)가 자신의 PK가 되는 '식별관계'(PK·FK 배지). 주문의 cust_id는 PK가 아닌 일반 FK = '비식별관계'.", match: a => a.key === "PK·FK" }
  ];

  function initErdViewer() {
    const root = document.getElementById("dm-erd-root");
    if (!root) return;
    let concept = "pk";

    function badge(key) {
      if (!key) return "";
      const navy = key.indexOf("PK") >= 0;
      const col = navy ? "var(--sph-navy)" : "#7a5b00";
      const bg = navy ? "rgba(0,42,91,0.10)" : "rgba(249,187,0,0.18)";
      return `<span style="font-size:0.6rem;font-weight:800;color:${col};background:${bg};padding:1px 6px;border-radius:4px;margin-left:6px;letter-spacing:.3px;">${key}</span>`;
    }
    function card(e) {
      const c = CONCEPTS.find(x => x.id === concept);
      const rows = e.attrs.map(a => {
        const on = c && c.match(a);
        return `<div style="display:flex;align-items:center;padding:5px 10px;font-size:0.78rem;font-family:var(--font-mono);border-top:1px solid var(--border-light);${on ? "background:rgba(249,187,0,0.16);" : ""}">
          <span style="color:var(--color-text-main);font-weight:${a.key ? 700 : 400};">${a.n}</span>
          ${badge(a.key)}
          <span style="margin-left:auto;color:var(--color-text-muted);font-size:0.72rem;">${a.t}</span>
        </div>`;
      }).join("");
      const hlHead = concept === "entity";
      return `<div data-ent="${e.id}" style="border:1px solid ${hlHead ? "var(--sph-yellow)" : "var(--border-light)"};border-radius:8px;overflow:hidden;background:var(--bg-card);cursor:pointer;transition:box-shadow .15s;">
        <div style="padding:8px 10px;background:${hlHead ? "rgba(249,187,0,0.16)" : "var(--sph-navy)"};">
          <span style="font-weight:800;font-size:0.85rem;color:${hlHead ? "var(--sph-navy)" : "#fff"};">${e.name}</span>
          <span style="font-size:0.66rem;font-family:var(--font-mono);color:${hlHead ? "var(--sph-slate)" : "rgba(255,255,255,0.7)"};margin-left:6px;">${e.code}</span>
        </div>
        ${rows}
      </div>`;
    }
    function render() {
      const c = CONCEPTS.find(x => x.id === concept);
      root.innerHTML = `
        <div class="bg-glass" style="padding:18px 20px;border-radius:8px;border:1px solid var(--border-light);">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
            ${CONCEPTS.map(x => `<button data-c="${x.id}" style="padding:6px 12px;border-radius:999px;border:1px solid ${x.id === concept ? "var(--sph-navy)" : "var(--border-light)"};background:${x.id === concept ? "var(--sph-navy)" : "var(--bg-card)"};color:${x.id === concept ? "#fff" : "var(--color-text-main)"};font-size:0.76rem;font-weight:700;cursor:pointer;">${x.label}</button>`).join("")}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">
            ${ENTITIES.map(card).join("")}
          </div>
          <div style="margin-top:8px;font-size:0.72rem;color:var(--color-text-muted);text-align:center;">고객 1:N 주문 · 주문 1:N 주문상품 N:1 상품 (주문↔상품 M:N을 '주문상품'으로 해소)</div>
          <div style="margin-top:14px;padding:12px 14px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);font-size:0.82rem;color:var(--color-text-main);line-height:1.6;">
            <b style="color:var(--sph-navy);">${c.label}</b> — ${c.desc}
          </div>
          <div id="dm-erd-ent" style="margin-top:10px;"></div>
        </div>`;
      root.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { concept = b.dataset.c; render(); }));
      root.querySelectorAll("[data-ent]").forEach(b => b.addEventListener("click", () => {
        const e = ENTITIES.find(x => x.id === b.dataset.ent);
        root.querySelector("#dm-erd-ent").innerHTML =
          `<div style="padding:11px 14px;border-radius:6px;border:1px dashed var(--sph-navy);background:rgba(0,42,91,0.04);font-size:0.8rem;line-height:1.6;">
            <b style="color:var(--sph-navy);">${e.name} (${e.code})</b> · ${e.role}<br>
            <span style="color:var(--color-text-muted);">관계: ${e.rel}</span></div>`;
      }));
    }
    render();
  }

  // ── 정규화 변환기 (신규) — 비정규 → 1NF → 2NF → 3NF 단계 분해 ──
  const STAGES = [
    {
      title: "0. 비정규 (Unnormalized)",
      anomaly: "삽입/갱신/삭제 이상 모두 발생",
      desc: "한 행에 반복 그룹(상품 여러 개)과 중복(고객명·상품명)이 섞여 있습니다. 상품명을 바꾸면 여러 행을 모두 고쳐야 하고(갱신 이상), 주문 없이는 상품을 등록할 수 없습니다(삽입 이상).",
      tables: [{ name: "주문 (비정규)", pk: ["order_id"], cols: ["order_id", "order_dt", "cust_id", "cust_nm", "(prod_id, prod_nm, qty) ⟳ 반복그룹"] }]
    },
    {
      title: "1NF — 반복 그룹 제거",
      anomaly: "부분·이행 종속 잔존",
      desc: "반복 그룹을 행으로 펼쳐 모든 속성을 원자값으로 만듭니다. 기본키는 복합키 (order_id + prod_id). 아직 한 테이블이라 중복이 많습니다.",
      tables: [{ name: "주문상품 (1NF)", pk: ["order_id", "prod_id"], cols: ["order_id", "prod_id", "order_dt", "cust_id", "cust_nm", "prod_nm", "qty"] }]
    },
    {
      title: "2NF — 부분 함수 종속 제거",
      anomaly: "이행 종속 잔존 (cust_id → cust_nm)",
      desc: "복합키의 '일부'에만 종속된 속성을 분리합니다. order_dt·cust_id·cust_nm은 order_id에만, prod_nm은 prod_id에만 종속 → 각각 떼어냅니다.",
      tables: [
        { name: "주문 (2NF)", pk: ["order_id"], cols: ["order_id", "order_dt", "cust_id", "cust_nm"] },
        { name: "상품", pk: ["prod_id"], cols: ["prod_id", "prod_nm"] },
        { name: "주문상품", pk: ["order_id", "prod_id"], cols: ["order_id", "prod_id", "qty"] }
      ]
    },
    {
      title: "3NF — 이행 함수 종속 제거",
      anomaly: "이상현상 해소 ✓",
      desc: "키가 아닌 속성 간 종속(order_id → cust_id → cust_nm)을 분리합니다. 고객명은 고객 테이블로 이동 → 한 사실은 한 곳에만 저장됩니다.",
      tables: [
        { name: "주문 (3NF)", pk: ["order_id"], cols: ["order_id", "order_dt", "cust_id"] },
        { name: "고객", pk: ["cust_id"], cols: ["cust_id", "cust_nm"] },
        { name: "상품", pk: ["prod_id"], cols: ["prod_id", "prod_nm"] },
        { name: "주문상품", pk: ["order_id", "prod_id"], cols: ["order_id", "prod_id", "qty"] }
      ]
    }
  ];

  function initNormalizer() {
    const root = document.getElementById("dm-normalize-root");
    if (!root) return;
    let step = 0;

    // 단계별 색상(레벨업) — 이상현상이 사라질수록 정화: 비정규(red)→1NF(orange)→2NF(amber)→3NF(green)
    const LV = [
      { c: "#DC2626", fg: "#fff", ink: "#B91C1C" },   // 0. 비정규
      { c: "#EA580C", fg: "#fff", ink: "#C2410C" },   // 1. 1NF
      { c: "#F9BB00", fg: "#002A5B", ink: "#8A6300" },// 2. 2NF (네이비 글씨)
      { c: "#10B981", fg: "#fff", ink: "#0E7A53" }    // 3. 3NF
    ];
    function tableCard(t, headBg, headFg) {
      const cols = t.cols.map(c => {
        const isPk = t.pk.some(k => c === k);
        return `<div style="padding:4px 10px;font-size:0.76rem;font-family:var(--font-mono);border-top:1px solid var(--border-light);${isPk ? "font-weight:800;color:var(--sph-navy);background:rgba(0,42,91,0.06);" : "color:var(--color-text-main);"}">${c}${isPk ? ' <span style="font-size:0.6rem;color:var(--sph-navy);">PK</span>' : ""}</div>`;
      }).join("");
      return `<div style="border:1px solid var(--border-light);border-radius:8px;overflow:hidden;background:var(--bg-card);min-width:170px;">
        <div style="padding:7px 10px;background:${headBg};color:${headFg};font-weight:800;font-size:0.8rem;">${t.name}</div>${cols}</div>`;
    }
    function render() {
      const s = STAGES[step];
      const ok = step === STAGES.length - 1;
      const lv = LV[step] || { c: "var(--sph-navy)", fg: "#fff", ink: "var(--sph-navy)" };
      const nx = LV[step + 1] || lv;
      root.innerHTML = `
        <div class="bg-glass" style="padding:20px;border-radius:8px;border:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            ${STAGES.map((x, i) => `<div title="${x.title}" style="flex:1;min-width:60px;height:8px;border-radius:4px;background:${i <= step ? LV[i].c : "var(--border-light)"};transition:background .25s;"></div>`).join("")}
          </div>
          <div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 4px;">
            <span style="font-size:1.02rem;font-weight:800;color:${lv.ink};">${s.title}</span>
            <span style="font-size:0.7rem;font-weight:800;padding:2px 9px;border-radius:999px;color:${lv.fg};background:${lv.c};">${s.anomaly}</span>
          </div>
          <div style="font-size:0.82rem;color:var(--color-text-main);line-height:1.6;margin-bottom:14px;">${s.desc}</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">${s.tables.map(t => tableCard(t, lv.c, lv.fg)).join("")}</div>
          <div style="display:flex;gap:8px;margin-top:18px;">
            <button id="dm-nf-prev" ${step === 0 ? "disabled" : ""} style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-light);background:var(--bg-card);color:var(--color-text-main);font-weight:700;font-size:0.8rem;cursor:${step === 0 ? "default" : "pointer"};opacity:${step === 0 ? 0.45 : 1};">← 이전</button>
            <button id="dm-nf-next" ${ok ? "disabled" : ""} style="padding:8px 16px;border-radius:6px;border:none;background:${ok ? "var(--border-light)" : nx.c};color:${ok ? "var(--color-text-muted)" : nx.fg};font-weight:700;font-size:0.8rem;cursor:${ok ? "default" : "pointer"};">다음 단계 →</button>
            <span style="margin-left:auto;align-self:center;font-size:0.74rem;color:var(--color-text-muted);">${step + 1} / ${STAGES.length}</span>
          </div>
        </div>`;
      const p = root.querySelector("#dm-nf-prev"), n = root.querySelector("#dm-nf-next");
      if (p) p.addEventListener("click", () => { if (step > 0) { step--; render(); } });
      if (n) n.addEventListener("click", () => { if (step < STAGES.length - 1) { step++; render(); } });
    }
    render();
  }

  // ── 객관식 퀴즈 엔진 (sql-tuning-basics와 동일 패턴) ──
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

  function initDmQuiz() {
    mcLab("dm-quiz-root", [
      { tag: "1장", q: "데이터 모델 추상화 3수준을 순서대로 나열하면?", o: [["개념 → 논리 → 물리", true], ["물리 → 논리 → 개념", false], ["논리 → 개념 → 물리", false], ["개념 → 물리 → 논리", false]], e: "무엇을(개념) → 어떻게 구조화(논리) → 어떻게 저장(물리) 순으로 정밀해집니다." },
      { tag: "1장", q: "개체 무결성(Entity Integrity)이 보장하는 것은?", o: [["기본키는 NULL이 아니고 유일하다", true], ["외래키는 참조 대상이 있다", false], ["컬럼 값이 도메인 범위 안", false], ["테이블에 인덱스가 있다", false]], e: "개체 무결성=PK는 NOT NULL+유일. 참조 무결성은 FK 쪽 규칙입니다." },
      { tag: "2장", q: "M:N 관계를 관계형 모델로 구현하려면?", o: [["교차(연관) 엔티티로 분해한다", true], ["그대로 둔다", false], ["한쪽을 삭제한다", false], ["FK를 두 개 만든다", false]], e: "관계형은 M:N을 직접 표현 못 해, 교차 엔티티(예: 주문상품)로 1:N + N:1로 분해합니다." },
      { tag: "2장", q: "개념 모델링 단계의 목표로 가장 적절한 것은?", o: [["핵심 엔티티·관계(뼈대) 합의", true], ["인덱스 설계", false], ["데이터 타입 확정", false], ["파티션 키 결정", false]], e: "개념 단계는 상세 속성 이전에 업무 뼈대를 합의하는 단계입니다." },
      { tag: "3장", q: "부모의 키가 자식의 '기본키 일부'가 되는 관계는?", o: [["식별 관계", true], ["비식별 관계", false], ["순환 관계", false], ["선택 관계", false]], e: "식별 관계는 부모 키가 자식 PK에 포함(자식이 부모 없이 존재 불가). 일반 FK면 비식별." },
      { tag: "3장", q: "이행 함수 종속을 제거하는 정규형은?", o: [["3NF", true], ["1NF", false], ["2NF", false], ["BCNF", false]], e: "1NF=원자값, 2NF=부분종속 제거, 3NF=이행종속 제거, BCNF=결정자=후보키." },
      { tag: "3장", q: "갱신 이상(Update Anomaly)이 생기는 근본 원인은?", o: [["같은 사실이 여러 곳에 중복 저장", true], ["인덱스가 없어서", false], ["NULL이 많아서", false], ["파티션이 없어서", false]], e: "중복이 있으면 일부만 갱신되어 불일치가 생깁니다(One Fact, One Place 위반)." },
      { tag: "3장", q: "반정규화에 대한 올바른 설명은?", o: [["측정된 병목에 한해 의도적으로 중복 허용", true], ["정규화를 하지 않는 것", false], ["항상 빠르므로 우선 적용", false], ["1NF 이전 상태", false]], e: "먼저 정규화로 올바른 구조를 만든 뒤, 검증된 성능 문제에 한해 반정규화합니다." },
      { tag: "4장", q: "숫자 값을 VARCHAR2(문자)로 저장하면 생기는 대표 문제는?", o: [["조인·비교 시 암묵적 형변환으로 인덱스 무력화", true], ["저장 공간이 항상 작아짐", false], ["정렬이 빨라짐", false], ["문제 없음", false]], e: "타입 불일치는 암묵적 형변환을 유발해 인덱스를 못 타게 만드는 대표 안티패턴입니다." },
      { tag: "4장", q: "인덱스를 많이 만들수록 나타나는 현상은?", o: [["DML(INSERT/UPDATE/DELETE)이 느려진다", true], ["DML이 빨라진다", false], ["조회는 항상 느려진다", false], ["무결성이 깨진다", false]], e: "DML 1건마다 딸린 인덱스를 모두 갱신하므로 과다 인덱스는 쓰기 성능을 떨어뜨립니다." },
      { tag: "5장", q: "특정일의 상태 조회를 BETWEEN 한 줄로 단순화하는 이력 방식은?", o: [["선분 이력(시작일~종료일)", true], ["점 이력(변경일시만)", false], ["이력을 두지 않음", false], ["반복 그룹", false]], e: "선분 이력은 유효구간을 저장해 조회가 단순합니다. 대신 변경 시 이전 행 종료일 갱신이 필요." },
      { tag: "5장", q: "인조(대리)키를 사용할 때 함께 반드시 둬야 하는 것은?", o: [["자연키 UNIQUE 제약", true], ["추가 인덱스 금지", false], ["FK 제거", false], ["NULL 허용", false]], e: "대리키는 무의미 키라, 업무적 중복을 막으려면 자연키에 UNIQUE 제약을 별도로 둬야 합니다." }
    ], "데이터 모델링 종합 퀴즈");
  }

  function init() {
    try { initTextbook(); } catch (e) { console.error("dm textbook", e); }
    try { initErdViewer(); } catch (e) { console.error("dm erd", e); }
    try { initNormalizer(); } catch (e) { console.error("dm normalize", e); }
    try { initDmQuiz(); } catch (e) { console.error("dm quiz", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
