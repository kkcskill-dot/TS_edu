/* =============================================================
 * visit-service.js — '찾아가는 기술서비스' 가이드 로더
 * ============================================================= */
(function () {
  const BASE = "assets/lessons/visit-service/";
  const SESSIONS = [
    { id: "guide", title: "실전 SQL 튜닝 핵심 가이드", file: "guide.md" },
    { id: "plan", title: "실행계획", file: "execution_plan.md" },
    { id: "join", title: "조인", file: "join.md" },
    { id: "architecture", title: "오라클 아키텍처", file: "architecture.md" },
    { id: "partitioning", title: "파티셔닝", file: "partitioning.md" },
    { id: "execution_flow", title: "아키텍쳐 순서도", file: "sql_execution_flow.md" },
    { id: "sqltips", title: "SQL 팁", file: "sql_tips.md" }
  ];

  // ── 학습자료 (탭 + 마크다운 렌더) ──
  function initTextbook() {
    const tabbar = document.getElementById("visit-tb-tabs");
    const viewer = document.getElementById("visit-md-viewer");
    if (!tabbar || !viewer) return;
    const cache = {};

    tabbar.innerHTML = SESSIONS.map((s, i) =>
      `<button class="tbook-tab${i === 0 ? " active" : ""}" data-id="${s.id}"
        style="padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--sph-slate);">${s.title}</button>`
    ).join("");

    async function show(id) {
      const s = SESSIONS.find(x => x.id === id);
      if (!s) return;

      tabbar.querySelectorAll(".tbook-tab").forEach(b => b.classList.toggle("active", b.dataset.id === id));

      viewer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted);">
        <div class="loader" style="margin:0 auto 10px;width:24px;height:24px;border:3px solid var(--border-light);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 1s linear infinite;"></div>
        불러오는 중...
      </div>`;

      try {
        if (!cache[id]) {
          const res = await fetch(BASE + s.file, { cache: "no-store" });
          if (!res.ok) throw new Error("문서를 찾을 수 없습니다.");
          cache[id] = await res.text();
        }
        if (window.marked) {
          let mdText = cache[id];
          mdText = mdText.replace(/>\s*\[!TIP\]/g, '> **TIP:**');
          mdText = mdText.replace(/>\s*\[!NOTE\]/g, '> **NOTE:**');
          mdText = mdText.replace(/>\s*\[!WARNING\]/g, '> **WARNING:**');
          mdText = mdText.replace(/>\s*\[!CAUTION\]/g, '> **CAUTION:**');
          mdText = mdText.replace(/>\s*\[!IMPORTANT\]/g, '> **IMPORTANT:**');
          
          viewer.innerHTML = `<div class="markdown-body" style="animation: fade-in 0.3s ease;">${window.marked.parse(mdText)}</div>`;
          
          // Spharos Design Card formatting for As-Is / To-Be
          const blocks = viewer.querySelectorAll('p');
          blocks.forEach(p => {
            const text = p.textContent.trim();
            if (text.startsWith('As-Is')) {
              const pre = p.nextElementSibling;
              if (pre && pre.tagName === 'PRE') {
                const card = document.createElement('div');
                card.className = 'sph-card';
                card.style.marginBottom = '16px';
                
                const extraText = text.replace('As-Is', '').trim();
                card.innerHTML = `<div style="margin-bottom:12px;"><span class="sph-tag sph-tag--gray" style="margin-right:8px;">As-Is</span> <span style="font-size:14px;font-weight:700;color:var(--sph-ink);">${extraText}</span></div>${pre.outerHTML}`;
                p.parentNode.insertBefore(card, p);
                p.remove();
                pre.remove();
              }
            } else if (text.startsWith('To-Be')) {
              const pre = p.nextElementSibling;
              if (pre && pre.tagName === 'PRE') {
                const card = document.createElement('div');
                card.className = 'sph-card sph-card--accent';
                card.style.marginBottom = '24px';
                
                const extraText = text.replace('To-Be', '').trim();
                card.innerHTML = `<div style="margin-bottom:12px;"><span class="sph-tag sph-tag--navy" style="margin-right:8px;">To-Be</span> <span style="font-size:14px;font-weight:700;color:var(--sph-ink);">${extraText}</span></div>${pre.outerHTML}`;
                p.parentNode.insertBefore(card, p);
                p.remove();
                pre.remove();
              }
            }
          });

          // Add Slideshow Button for SQL Tips
          if (id === 'sqltips') {
            const btn = document.createElement('button');
            btn.className = 'sph-btn sph-btn--primary';
            btn.style.cssText = 'float:right; margin: 10px 0 20px 20px; box-shadow: 0 4px 12px rgba(0,42,91,0.2); border: none; font-size:14px; position:relative; z-index:10;';
            btn.innerHTML = '▶ 슬라이드쇼 뷰';
            btn.onclick = () => window.startSlideshow(viewer);
            viewer.insertBefore(btn, viewer.firstChild);
          }

          const mermaidBlocks = viewer.querySelectorAll('pre code.language-mermaid');
          if (mermaidBlocks.length > 0 && window.mermaid) {
            mermaidBlocks.forEach((block) => {
              const pre = block.parentElement;
              const div = document.createElement('div');
              div.className = 'mermaid';
              div.textContent = block.textContent;
              pre.parentNode.replaceChild(div, pre);
            });
            const isLight = document.body.classList.contains('light-theme');
            mermaid.initialize({ startOnLoad: false, theme: isLight ? 'default' : 'dark' });
            try { mermaid.run({ nodes: viewer.querySelectorAll('.mermaid') }); } catch(e) { console.error(e); }
          }
        } else {
          viewer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${cache[id]}</pre>`;
        }
      } catch (err) {
        viewer.innerHTML = `<div style="padding:20px;color:var(--accent-crimson);background:rgba(239,68,68,0.1);border-radius:6px;">
          ${err.message}<br><small>아직 작성되지 않은 챕터입니다.</small>
        </div>`;
      }
    }

    tabbar.addEventListener("click", e => {
      const btn = e.target.closest(".tbook-tab");
      if (btn) show(btn.dataset.id);
    });

    const initHash = new URLSearchParams(window.location.search).get("lesson");
    if (initHash) {
      show(initHash);
    } else if (SESSIONS.length > 0) {
      show(SESSIONS[0].id);
    }
  }

  window.startSlideshow = function(container) {
    const slides = [];
    let currentSlide = null;
    const mdBody = container.querySelector('.markdown-body');
    if (!mdBody) return;
    
    Array.from(mdBody.children).forEach(node => {
      if (node.tagName === 'H2') {
        if (currentSlide) slides.push(currentSlide);
        currentSlide = { title: node.innerHTML, content: [] };
      } else if (currentSlide && node.tagName !== 'HR') {
        currentSlide.content.push(node.outerHTML);
      }
    });
    if (currentSlide) slides.push(currentSlide);

    if (slides.length === 0) return alert('슬라이드를 찾을 수 없습니다.');

    let currentIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'sph-slideshow-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center; animation: fade-in 0.3s ease;';

    const box = document.createElement('div');
    box.className = 'sph-slide-container';
    box.style.cssText = 'width:1200px;max-width:95vw;height:750px;max-height:95vh;background:#fff;position:relative;border-radius:12px;overflow:hidden;font-family:var(--sph-font);box-shadow:0 20px 50px rgba(0,0,0,0.5);display:flex;flex-direction:column;';

    let keydownHandler;

    const renderSlide = (idx) => {
      currentIndex = idx;
      const slide = slides[idx];
      box.innerHTML = `
        <header style="padding: 40px 60px 20px 60px;">
          <p class="sph-kicker" style="font-size:12px;font-weight:700;color:var(--sph-navy);letter-spacing:1px;text-transform:uppercase;margin:0;">SPHAROS · TECH</p>
          <div style="margin-top:8px;font-size:28px;font-weight:700;color:var(--sph-ink);">${slide.title}</div>
        </header>
        <main class="markdown-body" style="padding: 0 60px; flex:1; overflow-y:auto; font-size:16px; color:var(--sph-body); line-height:1.6;">
          ${slide.content.join('\n')}
        </main>
        <footer style="display:flex;align-items:center;justify-content:space-between;padding:16px 60px;background:#f7f8fa;border-top:1px solid var(--sph-line);">
          <div style="font-size:14px;color:var(--sph-slate);font-weight:700;">${idx + 1} / ${slides.length}</div>
          <div style="display:flex;gap:12px;">
            <button id="sph-prev" class="sph-btn sph-btn--ghost" ${idx === 0 ? 'disabled style="opacity:0.5;"' : ''}>이전 (←)</button>
            <button id="sph-next" class="sph-btn sph-btn--primary" ${idx === slides.length - 1 ? 'disabled style="opacity:0.5;"' : ''}>다음 (→)</button>
            <button id="sph-close" class="sph-btn sph-btn--ghost" style="margin-left:20px;border-color:transparent;color:var(--sph-slate);">닫기 (ESC)</button>
          </div>
        </footer>
      `;

      box.querySelector('#sph-prev').onclick = () => { if(idx > 0) renderSlide(idx - 1); };
      box.querySelector('#sph-next').onclick = () => { if(idx < slides.length - 1) renderSlide(idx + 1); };
      box.querySelector('#sph-close').onclick = () => {
        overlay.remove();
        document.removeEventListener('keydown', keydownHandler);
      };
    };

    renderSlide(0);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    keydownHandler = (e) => {
      if (e.key === 'ArrowRight') {
        if (currentIndex < slides.length - 1) renderSlide(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) renderSlide(currentIndex - 1);
      } else if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', keydownHandler);
      }
    };
    document.addEventListener('keydown', keydownHandler);
  };

  document.addEventListener("DOMContentLoaded", () => {
    initTextbook();
  });

})();
