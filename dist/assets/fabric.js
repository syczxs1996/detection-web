/* 程序化布面纹理 + 瑕疵绘制。宣传页的动画、瑕疵卡片、软件界面示意共用这一份。
   纹理三种：twill 2/1 斜纹、knit 针织线圈、felt 无纺纤维。
   瓦片边长 240 = 6、4、3 的公倍数，felt 的噪声网格也按 240 回绕，平铺无接缝。 */
(function (global) {
  const SIZE = 240;
  const cache = {};

  // 无纺布：可回绕的值噪声，两层叠加出絮状纤维感
  function feltNoise(rnd) {
    const grids = [12, 40].map(n => ({ n, v: Array.from({ length: n * n }, rnd) }));
    return (x, y) => grids.reduce((acc, { n, v }, gi) => {
      const fx = x / SIZE * n, fy = y / SIZE * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const at = (i, j) => v[((j % n) * n) + (i % n)];
      const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx, b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      return acc + (a * (1 - ty) + b * ty - 0.5) * (gi ? 0.14 : 0.2);
    }, 1);
  }

  function weave(pattern, x, y, rnd, felt) {
    if (pattern === 'knit') {
      // 纵行宽 4 px，线圈呈 V 形；圈与圈之间留暗缝
      const c = x % 4, row = (y + (c < 2 ? c : 3 - c)) % 4;
      return (c === 0 ? 0.78 : 1) * (row === 0 ? 0.8 : 1) * (0.94 + rnd() * 0.1);
    }
    if (pattern === 'felt') return felt(x, y) * (0.95 + rnd() * 0.08);
    const bar = 1 + 0.035 * Math.sin((y / SIZE) * Math.PI * 4);
    return ((x + y) % 6 < 4 ? 1 : 0.8) * (x % 3 === 0 ? 0.88 : 1) * bar * (0.92 + rnd() * 0.16);
  }

  function makeFabricTile(key, rgb, pattern) {
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const img = g.createImageData(SIZE, SIZE);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const felt = pattern === 'felt' ? feltNoise(rnd) : null;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const k = weave(pattern, x, y, rnd, felt);
        const i = (y * SIZE + x) * 4;
        img.data[i] = rgb[0] * k; img.data[i + 1] = rgb[1] * k; img.data[i + 2] = rgb[2] * k; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return (cache[key] = c);
  }

  // 用纹理铺满 (0,0,w,h)，offY 让布面向下滚动
  function paintFabric(ctx, w, h, offY, scale, rgb, key, pattern) {
    const tile = makeFabricTile(key || rgb.join(',') + (pattern || ''), rgb, pattern);
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(0, ((offY / scale) % SIZE) - SIZE);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w / scale + SIZE, h / scale + SIZE * 2);
    ctx.restore();
  }

  function seeded(n) { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

  // 瑕疵外观。返回检测框 [x, y, w, h]（相对中心点）
  const DEFECTS = {
    hole:  { cn: '破洞', color: '#ff5b5b' },
    stain: { cn: '污渍', color: '#f0a53c' },
    warp:  { cn: '断经', color: '#9b8cff' },
    weft:  { cn: '断纬', color: '#ef6bb0' },
    knot:  { cn: '粗结', color: '#4fc3d9' },
    fly:   { cn: '飞花', color: '#7bd389' },
    oil:   { cn: '油污', color: '#d8b04a' },
    spot:  { cn: '白点', color: '#e6e6e6' },
    // 以下名称与配色取自检测软件的出厂类别池（core/class_scheme.py）
    foreign:     { cn: '异物',     color: '#5bd9c0' },
    weave:       { cn: '织疵',     color: '#37bccf' },
    crease:      { cn: '折痕',     color: '#d9c74a' },
    drop_stitch: { cn: '脱圈',     color: '#3ab0ff' },
    needle_line: { cn: '针路',     color: '#7ddb6e' },
    course_mark: { cn: '横路',     color: '#ff8f5b' },
    cloud:       { cn: '云斑',     color: '#8fa8ff' },
    uneven:      { cn: '厚薄不匀', color: '#ffd25b' },
    // 用户自定义类别示例
    hair:        { cn: '毛发',     color: '#c98bff' },
    tint:        { cn: '色彩异常', color: '#ff6b9d' },
  };

  function drawDefect(ctx, type, x, y, s, n) {
    const r = seeded(n || 1);
    ctx.save();
    ctx.translate(x, y);
    let box;
    if (type === 'hole') {
      ctx.fillStyle = 'rgba(210,214,220,.85)';
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, d = s * (0.55 + r() * 0.35);
        ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d * 0.8, 1.2, 1.2 + r() * 3);
      }
      ctx.fillStyle = '#07090c';
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2, d = s * (0.45 + r() * 0.18);
        i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.8) : ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d * 0.8);
      }
      ctx.fill();
      box = [-s, -s * 0.85, s * 2, s * 1.7];
    } else if (type === 'stain' || type === 'oil') {
      const col = type === 'stain' ? '150,110,60' : '20,22,18';
      for (let i = 0; i < 7; i++) {
        const ox = (r() - 0.5) * s * 0.9, oy = (r() - 0.5) * s * 0.7, rr = s * (0.35 + r() * 0.45);
        const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
        gr.addColorStop(0, `rgba(${col},${type === 'stain' ? 0.55 : 0.6})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.fill();
      }
      box = [-s * 1.1, -s * 0.95, s * 2.2, s * 1.9];
    } else if (type === 'warp') {
      const len = s * 5;
      ctx.fillStyle = 'rgba(225,232,240,.38)';
      ctx.fillRect(-1.5, -len / 2, 3, len);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(1.5, -len / 2, 1.5, len);
      box = [-s * 0.45, -len / 2 - 4, s * 0.9, len + 8];
    } else if (type === 'weft') {
      const len = s * 6;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(-len / 2, -1.5, len, 3);
      ctx.fillStyle = 'rgba(225,232,240,.22)';
      ctx.fillRect(-len / 2, 1.5, len, 1.5);
      box = [-len / 2 - 4, -s * 0.4, len + 8, s * 0.8];
    } else if (type === 'knot') {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
      gr.addColorStop(0, 'rgba(235,240,245,.9)'); gr.addColorStop(1, 'rgba(235,240,245,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.32, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(225,232,240,.35)';
      ctx.fillRect(-s * 1.2, -1, s * 2.4, 2);
      box = [-s * 1.3, -s * 0.55, s * 2.6, s * 1.1];
    } else if (type === 'fly') {
      ctx.strokeStyle = 'rgba(240,244,248,.85)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.2);
      ctx.bezierCurveTo(-s * 0.2, -s * 0.8, s * 0.2, s * 0.7, s * 0.7, -s * 0.3); ctx.stroke();
      box = [-s * 0.9, -s * 0.7, s * 1.8, s * 1.4];
    } else if (type === 'spot') {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.35);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.fill();
      box = [-s * 0.6, -s * 0.6, s * 1.2, s * 1.2];
    } else if (type === 'foreign') {
      ctx.fillStyle = 'rgba(20,16,12,.9)';
      ctx.beginPath();
      for (let i = 0; i <= 9; i++) {
        const a = (i / 9) * Math.PI * 2, d = s * (0.18 + r() * 0.14);
        i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,16,12,.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s * .2, 0); ctx.lineTo(s * .55, s * .2); ctx.stroke();
      box = [-s * 0.6, -s * 0.5, s * 1.3, s * 1.0];
    } else if (type === 'crease') {
      const len = s * 6;
      ctx.rotate(-0.5);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-len / 2, -2, len, 2);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-len / 2, 0, len, 2.5);
      ctx.rotate(0.5);
      box = [-len * 0.45, -len * 0.26, len * 0.9, len * 0.52];
    } else if (type === 'drop_stitch') {
      const len = s * 5;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-2, -len / 2, 4, len);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let yy = -len / 2; yy < len / 2; yy += 6) ctx.fillRect(-4, yy, 8, 1.5);
      box = [-s * 0.45, -len / 2 - 4, s * 0.9, len + 8];
    } else if (type === 'needle_line') {
      const len = s * 7;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-1, -len / 2, 2, len);
      box = [-s * 0.35, -len / 2 - 4, s * 0.7, len + 8];
    } else if (type === 'course_mark') {
      const len = s * 8;
      const gr = ctx.createLinearGradient(0, -s * .4, 0, s * .4);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(-len / 2, -s * .4, len, s * .8);
      box = [-len / 2 - 4, -s * 0.5, len + 8, s * 1.0];
    } else if (type === 'cloud' || type === 'tint') {
      const col = type === 'cloud' ? '0,0,0' : '210,40,90';
      for (let i = 0; i < 6; i++) {
        const ox = (r() - 0.5) * s * 1.4, oy = (r() - 0.5) * s, rr = s * (0.5 + r() * 0.5);
        const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
        gr.addColorStop(0, `rgba(${col},${type === 'cloud' ? .11 : .3})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.fill();
      }
      box = [-s * 1.4, -s * 1.1, s * 2.8, s * 2.2];
    } else if (type === 'hair') {
      ctx.strokeStyle = 'rgba(18,14,10,.85)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-s * .8, s * .3);
      ctx.bezierCurveTo(-s * .3, -s * .9, s * .1, s * .9, s * .5, -s * .1);
      ctx.bezierCurveTo(s * .7, -s * .5, s * .9, -s * .1, s * .8, s * .2); ctx.stroke();
      box = [-s * 0.95, -s * 0.6, s * 1.9, s * 1.2];
    }
    ctx.restore();
    return box;
  }

  function drawBox(ctx, type, x, y, box, conf, showLabel) {
    const d = DEFECTS[type];
    ctx.save();
    ctx.strokeStyle = d.color; ctx.lineWidth = 2;
    ctx.strokeRect(x + box[0], y + box[1], box[2], box[3]);
    if (showLabel !== false) {
      const label = `${d.cn} ${conf.toFixed(2)}`;
      ctx.font = '600 12px "Microsoft YaHei",system-ui,sans-serif';
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = d.color;
      ctx.fillRect(x + box[0] - 1, y + box[1] - 18, tw, 18);
      ctx.fillStyle = '#0b1117';
      ctx.fillText(label, x + box[0] + 4, y + box[1] - 5);
    }
    ctx.restore();
  }

  function fitCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  global.Fabric = { paintFabric, drawDefect, drawBox, fitCanvas, DEFECTS, seeded };
})(window);
