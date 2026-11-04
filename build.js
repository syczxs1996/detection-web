// 打包上线用的 dist/：只包含第一版要展示的页面，并去掉指向未上线页面的导航链接。
// 用法：node build.js
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.join(SRC, 'dist');
const PAGES = ['index.html', 'configurator.html'];
const HIDDEN = ['layout.html'];   // 本版不上线的页面，链接一并去掉

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const p of PAGES) {
  let html = fs.readFileSync(path.join(SRC, p), 'utf8');
  for (const h of HIDDEN) html = html.replace(new RegExp(`<a href="${h}"[^>]*>[^<]*</a>`, 'g'), '');
  if (HIDDEN.some(h => html.includes(h))) throw new Error(`${p} 里还有指向 ${HIDDEN} 的链接`);
  fs.writeFileSync(path.join(OUT, p), html);
}
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'deploy', 'nginx.conf'), path.join(OUT, 'nginx.conf.example'));
console.log('dist/ 已生成：', PAGES.join('、'), '+ assets/');
