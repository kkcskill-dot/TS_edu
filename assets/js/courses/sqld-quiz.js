/* =============================================================
 * sqld-quiz.js — SQLD 문제은행 (4지선다, 도식 중심 + 오답노트)
 *  - 데이터: assets/data/sqld-quiz/<set>.json (문제 배열)
 *  - 도식(diagram)·SQL(code)·결과표(result)를 함께 렌더
 *  - 즉시 채점 → 도식 해설 → 틀리면 오답노트(localStorage) 자동 저장
 *  - '오답노트' 세트로 틀린 문제만 모아 다시 풀기(맞히면 제거)
 *  사용: 메뉴버튼 data-target="panel-sqld-quiz" data-quiz-set="..."
 * ============================================================= */
(function () {
  const BASE = "assets/data/sqld-quiz/";
  const WRONG_KEY = "sqld_quiz_wrong_v1";
  const SETS = {
    "m1":      { label: "1과목 · 데이터 모델링/성능", file: "m1.json" },
    "s-basic": { label: "2과목 · SQL 기본",          file: "s-basic.json" },
    "s-adv":   { label: "2과목 · SQL 활용",          file: "s-adv.json" },
    "mgmt":    { label: "2과목 · 관리 구문",          file: "mgmt.json" },
    "random":  { label: "🎲 랜덤 출제 (전체)",        file: null },
    "wrong":   { label: "오답노트",                  file: null }
  };
  const ALL_SETS = ["m1", "s-basic", "s-adv", "mgmt"];
  const cache = {};
  const MARK = ["①", "②", "③", "④", "⑤"];

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ── 오답노트 저장소 ──
  function loadWrong() { try { return JSON.parse(localStorage.getItem(WRONG_KEY) || "{}"); } catch (e) { return {}; } }
  function saveWrong(o) { localStorage.setItem(WRONG_KEY, JSON.stringify(o)); }
  function markWrong(q) { const w = loadWrong(); w[q.id] = q; saveWrong(w); }
  function unmarkWrong(id) { const w = loadWrong(); if (w[id]) { delete w[id]; saveWrong(w); } }
  function wrongCount() { return Object.keys(loadWrong()).length; }

  async function getQuestions(setKey) {
    if (setKey === "wrong") return Object.values(loadWrong());
    if (setKey === "random") {
      const all = await Promise.all(ALL_SETS.map(k => getQuestions(k)));
      return shuffle([].concat.apply([], all));   // 전체 합쳐 무작위 순서
    }
    if (cache[setKey]) return cache[setKey];
    const res = await fetch(BASE + SETS[setKey].file, { cache: "no-store" });
    if (!res.ok) throw new Error("문제 파일을 불러오지 못했습니다. (HTTP " + res.status + ")");
    const data = await res.json();
    cache[setKey] = data;
    return data;
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function resultTable(r) {
    if (!r) return "";
    const head = "<tr>" + r.headers.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr>";
    const body = r.rows.map(row => "<tr>" + row.map(c => {
      const v = (c === null) ? "NULL" : String(c);
      return "<td" + (v === "NULL" ? ' class="qz-null"' : "") + ">" + esc(v) + "</td>";
    }).join("") + "</tr>").join("");
    return '<div class="qz-result"><div class="qz-result-h">⚙ ' + esc(r.title || "실행 결과") + "</div>" +
      '<table class="qz-table">' + head + body + "</table></div>";
  }

  function mountInner(viewer, st) {
    const q = st.qs[st.i];
    const picked = st.answered[st.i];            // 선택한 보기 index (없으면 undefined)
    const done = picked !== undefined;
    const total = st.qs.length;
    const prog = Math.round((st.i + 1) / total * 100);

    // 보기 순서 셔플(문제마다 1회 고정) → 위치만 바뀌고 data-idx는 원본 유지(채점 영향 없음)
    if (!st.order) st.order = {};
    if (!st.order[st.i]) st.order[st.i] = shuffle(q.choices.map((_, k) => k));
    const order = st.order[st.i];

    const choices = order.map((origIdx, pos) => {
      let cls = "qz-choice";
      if (done) {
        if (origIdx === q.answer) cls += " correct";
        else if (origIdx === picked) cls += " wrong";
        else cls += " dim";
      }
      return '<button class="' + cls + '" data-idx="' + origIdx + '"' + (done ? " disabled" : "") +
        '><span class="qz-mark">' + MARK[pos] + "</span><span>" + q.choices[origIdx] + "</span></button>";
    }).join("");

    let explain = "";
    if (done) {
      const ok = picked === q.answer;
      explain =
        '<div class="qz-explain">' +
          '<div class="qz-verdict ' + (ok ? "ok" : "no") + '">' + (ok ? "✅ 정답입니다" : "❌ 오답 — 정답은 " + MARK[order.indexOf(q.answer)]) + "</div>" +
          (q.result ? resultTable(q.result) : "") +
          '<div class="qz-explain-body">' + (q.explain || "") + "</div>" +
        "</div>";
    }

    viewer.innerHTML =
      '<div class="qz-wrap">' +
        '<div class="qz-head">' +
          '<div class="qz-title">🏦 문제은행 · ' + esc(SETS[st.setKey].label) + "</div>" +
          '<div class="qz-meta">' + (st.i + 1) + " / " + total +
            ' · 맞힘 <b>' + st.correct + "</b>" +
            ' · 오답노트 <b>' + wrongCount() + "</b>" + "</div>" +
          '<div class="qz-prog"><i style="width:' + prog + '%"></i></div>' +
        "</div>" +
        '<div class="qz-card">' +
          '<span class="qz-badge">' + esc(q.type || "개념") + "</span>" +
          '<div class="qz-q">' + q.q + "</div>" +
          (q.diagram ? '<div class="qz-figure">' + q.diagram + "</div>" : "") +
          (q.code ? '<pre class="qz-code">' + esc(q.code) + "</pre>" : "") +
          '<div class="qz-choices">' + choices + "</div>" +
          explain +
        "</div>" +
        '<div class="qz-nav">' +
          '<button class="qz-btn" data-act="prev"' + (st.i === 0 ? " disabled" : "") + ">← 이전</button>" +
          (st.setKey === "wrong" && done && picked === q.answer ?
            '<button class="qz-btn ghost" data-act="drop">오답노트에서 제거</button>' : "") +
          (st.i >= total - 1 && st.setKey === "random"
            ? '<button class="qz-btn primary" data-act="reshuffle">🎲 새로 섞기</button>'
            : '<button class="qz-btn primary" data-act="next"' + (st.i >= total - 1 ? " disabled" : "") + ">다음 →</button>") +
        "</div>" +
      "</div>";

    // 보기 클릭 = 채점
    viewer.querySelectorAll(".qz-choice").forEach(b => b.addEventListener("click", () => {
      if (st.answered[st.i] !== undefined) return;
      const idx = parseInt(b.getAttribute("data-idx"), 10);
      st.answered[st.i] = idx;
      if (idx === q.answer) { st.correct++; if (st.setKey === "wrong") unmarkWrong(q.id); }
      else { markWrong(q); }
      mountInner(viewer, st);
    }));
    viewer.querySelectorAll(".qz-nav [data-act]").forEach(b => b.addEventListener("click", () => {
      const act = b.getAttribute("data-act");
      if (act === "reshuffle") { mount(viewer, "random"); return; }
      if (act === "prev" && st.i > 0) st.i--;
      else if (act === "next" && st.i < total - 1) st.i++;
      else if (act === "drop") { unmarkWrong(q.id); }
      mountInner(viewer, st);
    }));
  }

  async function mount(viewer, setKey) {
    if (!SETS[setKey]) { viewer.innerHTML = '<div class="qz-msg">알 수 없는 문제 세트입니다.</div>'; return; }
    viewer.innerHTML = '<div class="qz-msg"><div class="qz-spin"></div>문제 불러오는 중…</div>';
    let qs;
    try { qs = await getQuestions(setKey); }
    catch (e) { viewer.innerHTML = '<div class="qz-msg err">' + esc(e.message) + "</div>"; return; }
    if (!qs.length) {
      viewer.innerHTML = setKey === "wrong"
        ? '<div class="qz-msg">🎉 오답노트가 비어 있습니다. 문제를 풀다 틀리면 여기에 모입니다.</div>'
        : '<div class="qz-msg">아직 등록된 문제가 없습니다.</div>';
      return;
    }
    mountInner(viewer, { i: 0, qs, setKey, answered: {}, correct: 0 });
  }

  function injectStyles() {
    if (document.getElementById("qz-style")) return;
    const css = document.createElement("style");
    css.id = "qz-style";
    css.textContent =
      ".qz-wrap{max-width:880px;margin:0 auto;}" +
      ".qz-head{margin-bottom:18px;}" +
      ".qz-title{font-weight:800;color:var(--color-text-main,#002A5B);font-size:1.05rem;}" +
      ".qz-meta{font-size:.82rem;color:var(--color-text-muted,#64748b);margin:4px 0 8px;}" +
      ".qz-meta b{color:#0061D7;}" +
      ".qz-prog{height:6px;background:#EFEFEF;border-radius:4px;overflow:hidden;}" +
      ".qz-prog i{display:block;height:100%;background:#002A5B;border-radius:4px;transition:width .25s;}" +
      ".qz-card{background:var(--bg-card,#fff);border:1px solid var(--border-light,#E3E6EB);border-radius:10px;padding:22px 24px;}" +
      ".qz-badge{display:inline-block;background:#002A5B;color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:12px;}" +
      ".qz-q{font-size:1.08rem;font-weight:700;color:var(--color-text-main,#1f2937);line-height:1.6;margin-bottom:14px;}" +
      ".qz-q b{color:#0061D7;}" +
      ".qz-figure{margin:6px 0 16px;}" +
      ".qz-figure svg{max-width:100%;height:auto;display:block;margin:0 auto;}" +
      ".qz-code{background:#0B2239;color:#E6EDF3;font-family:'D2Coding','Courier New',monospace;font-size:.9rem;padding:14px 16px;border-radius:8px;white-space:pre-wrap;line-height:1.55;margin:0 0 16px;overflow-x:auto;}" +
      ".qz-choices{display:flex;flex-direction:column;gap:10px;}" +
      ".qz-choice{display:flex;align-items:center;gap:12px;text-align:left;padding:13px 16px;border:1.5px solid var(--border-light,#E3E6EB);background:var(--bg-card,#fff);border-radius:8px;cursor:pointer;font-size:.98rem;color:var(--color-text-main,#1f2937);transition:.12s;}" +
      ".qz-choice:hover:not(:disabled){border-color:#0061D7;background:#F4F8FF;}" +
      ".qz-choice .qz-mark{font-weight:800;color:#64748b;flex:0 0 auto;}" +
      ".qz-choice.correct{border-color:#0E7A53;background:#E9F7F0;color:#0E7A53;font-weight:700;}" +
      ".qz-choice.correct .qz-mark{color:#0E7A53;}" +
      ".qz-choice.wrong{border-color:#DC2626;background:#FDECEC;color:#DC2626;font-weight:700;}" +
      ".qz-choice.wrong .qz-mark{color:#DC2626;}" +
      ".qz-choice.dim{opacity:.55;}" +
      ".qz-choice:disabled{cursor:default;}" +
      ".qz-explain{margin-top:18px;border-top:1px dashed var(--border-light,#E3E6EB);padding-top:16px;}" +
      ".qz-verdict{font-weight:800;font-size:1rem;margin-bottom:12px;}" +
      ".qz-verdict.ok{color:#0E7A53;}" +
      ".qz-verdict.no{color:#DC2626;}" +
      ".qz-explain-body{font-size:.95rem;color:var(--color-text-main,#374151);line-height:1.7;}" +
      ".qz-explain-body p{margin:0 0 8px;}" +
      ".qz-explain-body code{background:#F1F5F9;padding:1px 6px;border-radius:4px;font-family:'D2Coding',monospace;font-size:.88rem;}" +
      ".qz-result{margin:0 0 14px;}" +
      ".qz-result-h{font-size:.8rem;font-weight:700;color:#fff;background:#0061D7;padding:6px 12px;border-radius:6px 6px 0 0;}" +
      ".qz-table{border-collapse:collapse;width:100%;font-size:.9rem;border:1px solid #cfe0f5;border-top:none;}" +
      ".qz-table th,.qz-table td{border:1px solid #E3E6EB;padding:7px 12px;text-align:left;}" +
      ".qz-table th{background:#EEF3F9;color:#002A5B;font-weight:700;}" +
      ".qz-table td.qz-null{color:#DC2626;font-style:italic;}" +
      ".qz-nav{display:flex;justify-content:space-between;gap:10px;margin-top:18px;}" +
      ".qz-btn{padding:10px 18px;border:1px solid var(--border-light,#E3E6EB);background:var(--bg-card,#fff);border-radius:8px;cursor:pointer;font-weight:700;font-size:.9rem;color:var(--color-text-main,#1f2937);}" +
      ".qz-btn:disabled{opacity:.4;cursor:default;}" +
      ".qz-btn.primary{background:#002A5B;color:#fff;border-color:#002A5B;margin-left:auto;}" +
      ".qz-btn.ghost{background:#FFF6DA;border-color:#F9BB00;color:#845F00;}" +
      ".qz-msg{text-align:center;padding:48px 20px;color:var(--color-text-muted,#64748b);}" +
      ".qz-msg.err{color:#DC2626;}" +
      ".qz-spin{width:24px;height:24px;border:3px solid #E3E6EB;border-top-color:#0061D7;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px;}";
    document.head.appendChild(css);
  }

  injectStyles();

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('.menu-item[data-quiz-set]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        const viewer = document.getElementById("sqld-quiz-viewer");
        if (viewer) mount(viewer, btn.getAttribute("data-quiz-set"));
      });
    });
  });

  window.SqldQuiz = { mount: mount };
})();
