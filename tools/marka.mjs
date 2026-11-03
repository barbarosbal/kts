// Marka ve logo SVG'lerini çizimlere ve DXF'e taşır.
// Logo dosyası (brand/*.svg) yalnız mutlak M, L, H, V, C, Q, Z komutlu <path> öğeleri içermelidir.
// Yollar parçalara bölünür, verilen izdüşüm işleviyle (silindire sarma, düz yüz) çizime aktarılır.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// { LW, LH: viewBox ölçüsü, yollar: d dizgeleri }
export async function markaOku(dosya) {
  const svg = await readFile(path.join(ROOT, dosya), 'utf8');
  const [, , LW, LH] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  const yollar = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  return { LW, LH, yollar };
}

// Ramer–Douglas–Peucker: çizimde görünmeyecek kadar küçük kırılmalar atılır
function sadelestir(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1e-9;
  let iMax = 0;
  let dMax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > dMax) [iMax, dMax] = [i, d];
  }
  if (dMax <= tol) return [pts[0], pts.at(-1)];
  return [...sadelestir(pts.slice(0, iMax + 1), tol).slice(0, -1), ...sadelestir(pts.slice(iMax), tol)];
}

// Kapalı halkada uçlar çakışır: en uzak noktadan ikiye bölünüp ayrı ayrı sadeleştirilir
function halkaSadelestir(h, tol) {
  const [x0, y0] = h[0];
  let k = 1;
  h.forEach(([x, y], i) => { if (Math.hypot(x - x0, y - y0) > Math.hypot(h[k][0] - x0, h[k][1] - y0)) k = i; });
  return [...sadelestir(h.slice(0, k + 1), tol).slice(0, -1), ...sadelestir(h.slice(k), tol)];
}

// Bir yolun halkaları; her nokta nokta(u, v) ile izdüşürülür (u sağa, v aşağı, logo biriminde)
function yolHalkalari(d, nokta, adim) {
  const tok = d.match(/[MLHVCQZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const halkalar = [];
  let cur = null;
  let p = [0, 0];
  let cmd = null;
  const egri = (pts) => {
    for (let s = 1; s <= adim; s++) {
      const t = s / adim;
      const k = 1 - t;
      const w = pts.length === 3 ? [k * k, 2 * k * t, t * t] : [k ** 3, 3 * k * k * t, 3 * k * t * t, t ** 3];
      cur.push(nokta(...[0, 1].map((j) => w.reduce((sum, wi, i) => sum + wi * pts[i][j], 0))));
    }
  };
  for (let i = 0; i < tok.length;) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    const n = () => +tok[i++];
    if (cmd === 'M') {
      p = [n(), n()];
      cur = [nokta(...p)];
      halkalar.push(cur);
      cmd = 'L';
    } else if (cmd === 'L' || cmd === 'H' || cmd === 'V') {
      p = cmd === 'L' ? [n(), n()] : cmd === 'H' ? [n(), p[1]] : [p[0], n()];
      cur.push(nokta(...p));
    } else if (cmd === 'C') {
      const q = [[n(), n()], [n(), n()], [n(), n()]];
      egri([p, ...q]);
      p = q[2];
    } else if (cmd === 'Q') {
      const q = [[n(), n()], [n(), n()]];
      egri([p, ...q]);
      p = q[1];
    } else {
      i++;
    }
  }
  return halkalar;
}

// Logo halkaları: [[ [x, y], ... ], ...] — tol izdüşüm biriminde
export function markaHalkalari(marka, nokta, { tol = 0.12, adim = 3 } = {}) {
  return marka.yollar.map((d) => yolHalkalari(d, nokta, adim)
    .map((h) => halkaSadelestir(h, tol))
    .filter((h) => h.length > 2));
}

// SVG çizimi: kaynaktaki her yol için bir <path>, çift-tek doldurma
export function markaCiz(marka, nokta, { tol = 0.12, adim = 3, sinif = 'mark' } = {}) {
  return markaHalkalari(marka, nokta, { tol, adim })
    .map((halkalar) => `<path class="${sinif}" fill-rule="evenodd" d="${halkalar
      .map((h) => `M${h.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')}Z`)
      .join('')}"/>`)
    .join('\n    ');
}

// DXF'e 1:1 kapalı çoklu çizgiler: yükseklik h (mm), alt orta noktası [x0, y0]
export function markaDxf(dxf, katman, marka, h, [x0, y0] = [0, 0]) {
  const k = h / marka.LH;
  const nokta = (u, v) => [x0 + (u - marka.LW / 2) * k, y0 + (marka.LH - v) * k];
  for (const halkalar of markaHalkalari(marka, nokta, { tol: 0.005, adim: 8 })) {
    for (const h of halkalar) dxf.polyline(katman, h, true);
  }
}
