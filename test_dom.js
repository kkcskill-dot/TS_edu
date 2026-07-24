const JSDOM = require("jsdom").JSDOM;
const dom = new JSDOM(`<div id="viewer">
<p><strong>As-Is (건별 커밋)</strong></p>
<pre><code>as-is code</code></pre>
<p><strong>To-Be (일괄 커밋)</strong></p>
<pre><code>to-be code</code></pre>
</div>`);
const viewer = dom.window.document.getElementById('viewer');

const blocks = viewer.querySelectorAll('p');
blocks.forEach(p => {
  const text = p.textContent.trim();
  if (text.startsWith('As-Is')) {
    const pre = p.nextElementSibling;
    if (pre && pre.tagName === 'PRE') {
      const card = dom.window.document.createElement('div');
      card.className = 'sph-card';
      card.style.marginBottom = '16px';
      
      const extraText = text.replace('As-Is', '').trim();
      let headerText = 'As-Is';
      if (extraText) {
          headerText = `As-Is <span style="font-size:12px;color:var(--sph-muted);font-weight:normal;margin-left:8px;">${extraText}</span>`;
      }

      card.innerHTML = `<div style="margin-bottom:12px;"><span class="sph-tag sph-tag--gray" style="margin-right:8px;">As-Is</span> <span style="font-size:14px;font-weight:700;color:var(--sph-ink);">${extraText}</span></div>${pre.outerHTML}`;
      p.parentNode.insertBefore(card, p);
      p.remove();
      pre.remove();
    }
  } else if (text.startsWith('To-Be')) {
    const pre = p.nextElementSibling;
    if (pre && pre.tagName === 'PRE') {
      const card = dom.window.document.createElement('div');
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
console.log(viewer.innerHTML);
