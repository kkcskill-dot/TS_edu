const marked = require('marked');
console.log(marked.parse('<div class="sph-card">\n\n```sql\nSELECT 1;\n```\n\n</div>'));
