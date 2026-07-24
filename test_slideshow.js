const JSDOM = require("jsdom").JSDOM;
const dom = new JSDOM(`<body><div id="viewer">
<div class="markdown-body">
  <h1>타이틀</h1>
  <p>인트로</p>
  <h2>1. 첫 번째 팁</h2>
  <p>내용1</p>
  <div class="sph-card">As-Is</div>
  <h2>2. 두 번째 팁</h2>
  <p>내용2</p>
  <hr>
</div>
</div></body>`);
const document = dom.window.document;
const viewer = document.getElementById('viewer');

const slides = [];
let currentSlide = null;
Array.from(viewer.querySelector('.markdown-body').children).forEach(node => {
  if (node.tagName === 'H2') {
    if (currentSlide) slides.push(currentSlide);
    // Strip the h2 tags but keep the text? No, keep it as it's styled by css
    currentSlide = { title: node.innerHTML, content: [] };
  } else if (currentSlide && node.tagName !== 'HR') {
    currentSlide.content.push(node.outerHTML);
  }
});
if (currentSlide) slides.push(currentSlide);

console.log(slides);
