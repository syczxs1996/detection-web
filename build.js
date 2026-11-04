// 生成可部署的静态站点，包括产线规划及流程演示。
// 用法：node build.js
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.join(SRC, 'dist');
const PAGES = ['index.html', 'configurator.html', 'layout.html'];
const HIDDEN = []; // 后续未上线页面可在此列出

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const p of PAGES) {
  let html = fs.readFileSync(path.join(SRC, p), 'utf8');
  for (const h of HIDDEN) html = html.replace(new RegExp(`<a href="${h}"[^>]*>[^<]*</a>`, 'g'), '');
  if (HIDDEN.some(h => html.includes(h))) throw new Error(`${p} 里还有指向 ${HIDDEN} 的链接`);
  // 内容指纹让更新后的脚本立即生效，同时保留静态资源缓存。
  html = html.replace(/(src|href)="(assets\/[^"?]+\.(?:js|css))"/g, (all, attr, rel) => {
    const hash = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(SRC, rel))).digest('hex').slice(0, 12);
    return attr + '="' + rel + '?v=' + hash + '"';
  });
  fs.writeFileSync(path.join(OUT, p), html);
}
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'deploy', 'nginx.conf'), path.join(OUT, 'nginx.conf.example'));
console.log('dist/ 已生成：', PAGES.join('、'), '+ assets/');
