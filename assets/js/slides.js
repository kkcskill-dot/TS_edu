/* =============================================================
 * slides.js — 강의자료 슬라이드 뷰어(세로 스크롤 덱) · 범용
 *  버튼: <button class="btn-open-slides"
 *          data-deck-title="제목" data-deck-file="assets/slides/.../x.html?v=N">
 *  → 어떤 메뉴/패널에서도 버튼 하나 + HTML 한 개로 슬라이드 추가 가능.
 *  (레거시: 소모임은 data-session/활성탭 기반으로도 동작)
 *  조작: 클릭 / ↓·→·Space / 스크롤로 다음, ↑·← 이전, Esc 닫기.
 *  작성 지침: assets/slides/README.md
 * ============================================================= */
(function () {
  // 소모임(perf-club) 레거시 덱 — 활성 회차 탭으로 진입
  const DECKS = {
    1: { title: "1회차 — 오라클 아키텍처 & 세션 기초", file: "assets/slides/perf-club/session-1.html?v=8.1" },
    2: { title: "2회차 — 대기 이벤트 · ASH/AWR", file: "assets/slides/perf-club/session-2.html?v=8.1" },
    3: { title: "3회차 — 실행계획 · 조인 · 카디널리티", file: "assets/slides/perf-club/session-3.html?v=8.1" }
  };

  let overlay, scrollEl, titleEl, countEl, progEl;
  let slides = [], idx = 0, io = null;

  function ensure() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "ts-slides";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="ts-slides-bar">' +
        '<span class="ts-slides-title"></span>' +
        '<span class="ts-slides-spacer"></span>' +
        '<span class="ts-slides-count"></span>' +
        '<button class="ts-slides-close" aria-label="닫기">✕</button>' +
      '</div>' +
      '<div class="ts-slides-prog"><i></i></div>' +
      '<div class="ts-slides-scroll"></div>' +
      '<div class="ts-slides-hint">클릭 · ↓ · 스크롤로 다음 장 · Esc 닫기</div>';
    document.body.appendChild(overlay);
    scrollEl = overlay.querySelector(".ts-slides-scroll");
    titleEl = overlay.querySelector(".ts-slides-title");
    countEl = overlay.querySelector(".ts-slides-count");
    progEl = overlay.querySelector(".ts-slides-prog > i");
    overlay.querySelector(".ts-slides-close").addEventListener("click", close);
    scrollEl.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  }

  function onClick(e) {
    if (e.target.closest("a,button,input,textarea,select")) return;
    next();
  }
  function onKey(e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") { close(); return; }
    if (["ArrowDown", "ArrowRight", " ", "PageDown"].indexOf(e.key) >= 0) { e.preventDefault(); next(); }
    else if (["ArrowUp", "ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); prev(); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(slides.length - 1); }
  }
  function go(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    if (slides[idx]) slides[idx].scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function next() { if (idx < slides.length - 1) go(idx + 1); }
  function prev() { if (idx > 0) go(idx - 1); }

  function setActive(i) {
    idx = i;
    if (countEl) countEl.textContent = (i + 1) + " / " + slides.length;
    if (progEl) progEl.style.width = ((i + 1) / Math.max(1, slides.length) * 100) + "%";
  }

  function slideMsg(kicker, title, lead) {
    return '<section class="ts-slide"><div class="inner"><div class="s-kicker">' + kicker +
      '</div><div class="s-title">' + title + '</div>' + (lead ? '<p class="s-lead">' + lead + '</p>' : '') +
      '</div></section>';
  }

  function afterInject() {
    slides = Array.prototype.slice.call(scrollEl.querySelectorAll(".ts-slide"));
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    scrollEl.scrollTop = 0;
    setActive(0);
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          const i = slides.indexOf(en.target);
          if (i >= 0) setActive(i);
        }
      });
    }, { root: scrollEl, threshold: 0.6 });
    slides.forEach(function (s) { io.observe(s); });
  }

  // 범용 진입점: 제목 + HTML 파일 경로
  async function openFile(title, file) {
    ensure();
    titleEl.textContent = title || "강의자료";
    scrollEl.innerHTML = slideMsg("로딩", "불러오는 중…", "");
    try {
      const r = await fetch(file, { cache: "no-store" });
      scrollEl.innerHTML = r.ok ? await r.text() : slideMsg("오류", "불러오기 실패", file);
    } catch (e) {
      scrollEl.innerHTML = slideMsg("오류", "불러오기 실패", "http 서버에서 열어야 슬라이드가 로드됩니다.");
    }
    afterInject();
  }

  // 레거시 진입점: 소모임 회차 번호
  function open(n) {
    ensure();
    const deck = DECKS[n];
    if (!deck) {
      titleEl.textContent = n + "회차 강의자료";
      scrollEl.innerHTML = slideMsg("준비 중", n + "회차 강의자료는 준비 중입니다", "곧 제공될 예정입니다.");
      afterInject();
      return;
    }
    return openFile(deck.title, deck.file);
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (io) { io.disconnect(); io = null; }
  }

  // 소모임 현재 활성 회차(panel-textbook 의 active 탭)
  function activeSession() {
    const tab = document.querySelector("#panel-textbook .tbook-tab.active");
    const m = tab && /tb-session(\d)/.exec(tab.getAttribute("data-target") || "");
    return m ? parseInt(m[1], 10) : 1;
  }

  // 이벤트 위임 → partial 주입 타이밍과 무관하게 동작
  document.addEventListener("click", function (e) {
    const btn = e.target.closest && e.target.closest(".btn-open-slides");
    if (!btn) return;
    e.preventDefault();
    const file = btn.getAttribute("data-deck-file");
    if (file) { openFile(btn.getAttribute("data-deck-title") || "강의자료", file); return; }
    // 레거시(소모임): 회차 지정 or 활성 탭
    const ses = parseInt(btn.getAttribute("data-session"), 10) || activeSession();
    open(ses);
  });

  // 외부에서 직접 열기: TSSlides.open("제목", "경로")
  window.TSSlides = { open: openFile, openSession: open, close: close };
})();
