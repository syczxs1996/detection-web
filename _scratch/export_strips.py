# 从项目的 production 数据集导出首页瀑布流用的真实条带：固定横向窗口裁剪 + 标注框换算
import cv2, glob, os, json, sys
src, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(src, '*/images/*.jpg')))
data = []
for f in fs:
    im = cv2.imread(f, cv2.IMREAD_GRAYSCALE); h, w = im.shape
    lb = f.replace('images', 'labels').rsplit('.', 1)[0] + '.txt'
    boxes = [list(map(float, l.split())) for l in open(lb) if l.strip()]
    data.append((f, im, boxes))
CW = 1200
best = max(range(0, 4096 - CW, 50), key=lambda x0: sum(
    1 for _, im, bs in data if im.shape[0] == 512 and any(x0 + 40 < b[1]*4096 < x0 + CW - 40 for b in bs)))
print('window x0 =', best)
OUTW = 1060; k = OUTW / CW
man = []
for f, im, bs in data:
    if im.shape[0] != 512: continue
    keep = [b for b in bs if best + 40 < b[1]*4096 < best + CW - 40]
    if not keep: continue
    crop = cv2.resize(im[:, best:best+CW], (OUTW, int(512*k)), interpolation=cv2.INTER_AREA)
    name = 'strip_%02d.jpg' % len(man)
    cv2.imwrite(os.path.join(out, name), crop, [cv2.IMWRITE_JPEG_QUALITY, 82])
    man.append({'src': 'assets/real/' + name, 'h': crop.shape[0], 'boxes': [
        [int(b[0]), round((b[1]*4096-best)*k), round(b[2]*512*k), round(max(b[3]*4096*k, 14)), round(max(b[4]*512*k, 14))] for b in keep]})
open(os.path.join(out, 'strips.js'), 'w', encoding='utf-8').write(
    '// 真实线阵采集图（production 数据集裁剪），框为人工标注。由 _scratch/export_strips.py 生成\nwindow.REAL_STRIPS = ' + json.dumps(man) + ';\n')
print(len(man), 'strips', sum(len(m['boxes']) for m in man), 'boxes')
