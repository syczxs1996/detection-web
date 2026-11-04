// 厂内展示用的静态网页服务器：不用装任何东西，有 Node.js 就能跑。
// 同一个 WiFi / 局域网里的手机、平板、电视都能打开。
// 用法：node deploy/serve.js [目录] [端口]   默认目录 dist，端口 8080
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const PORT = +process.argv[3] || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`在 ${ROOT} 里没找到 index.html。先运行 node build.js 生成 dist/。`);
  process.exit(1);
}

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }   // 不允许访问目录外的文件
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('没有这个页面'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`\n网站已启动（目录：${ROOT}）\n`);
  console.log(`  本机打开：  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  同一 WiFi： http://${ip}:${PORT}`));
  console.log('\n关闭这个窗口，网站就停止。\n');
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `端口 ${PORT} 被占用了，换一个：node deploy/serve.js dist 8081` : e.message);
  process.exit(1);
});
