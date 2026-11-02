import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// BSP (ISO 228-1) diş verileri; tapDrill: diş dibi matkabı
export const BSP = {
  '1 1/2': { major: 47.803, minor: 44.845, pitch: 25.4 / 11, tapDrill: 45.25, gauge: 12.7 },
  '3/4': { major: 26.441, minor: 24.117, pitch: 25.4 / 14, tapDrill: 24.25 },
  '1/2': { major: 20.955, minor: 18.631, pitch: 25.4 / 14, tapDrill: 18.75 },
};
export const sizeOf = (dis) => dis.replace(/^[GR]\s*/, '');

export const Y = new THREE.Vector3(0, 1, 0);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const metin = (n) => String(n).replace('.', ',');

// Yuvarlatılmış Whitworth profili: 0 = diş dibi, 1 = diş tepesi
function profile(u) {
  const tri = 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  return tri * tri * (3 - 2 * tri);
}

// +Y ekseni boyunca s ∈ [0, len], yarıçapı r(θ, s) olan silindirik yüzey
export function radialSurface(len, segs, rows, radius, inward) {
  const pos = new Float32Array((rows + 1) * segs * 3);
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const s = (len * j) / rows;
    for (let i = 0; i < segs; i++) {
      const th = (2 * Math.PI * i) / segs;
      const r = radius(th, s);
      pos[k++] = Math.cos(th) * r;
      pos[k++] = s;
      pos[k++] = -Math.sin(th) * r;
    }
  }
  const index = new Uint32Array(rows * segs * 6);
  k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * segs + i;
      const b = j * segs + ((i + 1) % segs);
      const c = a + segs;
      const d = b + segs;
      index.set(inward ? [a, c, b, b, c, d] : [a, b, c, b, d, c], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  return g;
}

// Sağ el dış diş; serbest uçta 45° pah, gövde tarafında diş çıkışı (diş derinliği sıfıra iner).
// R (ISO 7-1) dişte çap 1:16 koniktir; nominal çap serbest uçtan spec.gauge kadar içeride.
// endR: diş çıkışı bir çeltiğe açılıyorsa çeltik yarıçapı (45° iner).
export function externalThread(spec, len, freeAtStart, { conical = false, rMax = Infinity, endR = Infinity } = {}) {
  const rMaj = spec.major / 2;
  const rMin = spec.minor / 2;
  const rEnd = rMin - 0.3;
  const rows = Math.ceil((len / spec.pitch) * 26);
  return radialSurface(len, 192, rows, (th, s) => {
    const free = freeAtStart ? s : len - s;
    const runout = freeAtStart ? len - s : s;
    const taper = conical ? (free - spec.gauge) / 32 : 0;
    let r = lerp(rMin, rMaj, profile(s / spec.pitch - th / (2 * Math.PI))) + taper;
    r = lerp(rMaj + taper, r, smooth(0.4, 2.6, runout));
    return Math.min(r, rEnd + free, rMax, endR + runout);
  }, false);
}

// İç diş yüzeyi; iki ucunda delik çapına yumuşakça iner
export function internalThread(spec, len) {
  const rMaj = spec.major / 2;
  const rMin = spec.minor / 2;
  const rows = Math.ceil((len / spec.pitch) * 22);
  return radialSurface(len, spec.major > 24 ? 112 : 96, rows, (th, s) => {
    const r = lerp(rMin, rMaj, profile(s / spec.pitch - th / (2 * Math.PI)));
    return lerp(rMaj, r, smooth(0, 0.9, s) * smooth(0, 1.2, len - s));
  }, true);
}

// Dış dişli boru ucu: diş + iç delik + alın halkası
export function threadedEnd(spec, len, y0, freeAtStart, mat, { boreR, ...opts }) {
  const g = new THREE.Group();
  g.position.y = y0;
  g.add(new THREE.Mesh(externalThread(spec, len, freeAtStart, opts), mat));
  g.add(new THREE.Mesh(radialSurface(len, 128, 1, () => boreR, true), mat));
  const cap = new THREE.RingGeometry(boreR, spec.minor / 2 - 0.3, 192, 1);
  cap.rotateX(freeAtStart ? Math.PI / 2 : -Math.PI / 2);
  cap.translate(0, freeAtStart ? 0 : len, 0);
  g.add(new THREE.Mesh(cap, mat));
  return g;
}

// ---------------- teknik çizim katmanı ----------------
const techColor = 0x8ccfff;
const techMat = new THREE.LineBasicMaterial({ color: techColor, transparent: true, opacity: 0.9 });
const dashMat = new THREE.LineDashedMaterial({ color: techColor, dashSize: 5, gapSize: 2.5, transparent: true, opacity: 0.7 });
const arrowGeo = new THREE.ConeGeometry(0.9, 3.4, 12);
const arrowMat = new THREE.MeshBasicMaterial({ color: techColor });
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));

// Ölçü çizgileri ve etiketleri tek gruba toplar
export function makeAnnot() {
  const group = new THREE.Group();
  const labels = [];

  function line(points, mat = techMat) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v3)), mat);
    if (mat.isLineDashedMaterial) l.computeLineDistances();
    group.add(l);
  }

  function arrow(tip, from) {
    const a = v3(tip);
    const dir = a.clone().sub(v3(from)).normalize();
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.quaternion.setFromUnitVectors(Y, dir);
    m.position.copy(a).addScaledVector(dir, -1.7);
    group.add(m);
  }

  function label(html, at, cls = 'tag') {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    const o = new CSS2DObject(el);
    o.position.copy(v3(at));
    group.add(o);
    labels.push(o);
  }

  function dim(x, y0, y1, text) {
    line([[x, y0, 0], [x, y1, 0]]);
    arrow([x, y0, 0], [x, y1, 0]);
    arrow([x, y1, 0], [x, y0, 0]);
    label(text, [x, (y0 + y1) / 2, 0], 'dimtag');
  }

  function ext(y, x0, x1) {
    line([[x0, y, 0], [x1, y, 0]]);
  }

  function ring(y, r) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    line(pts, dashMat);
  }

  function callout(at, to, title, sub) {
    line([at, to]);
    label(`<b>${title}</b><span>${sub}</span>`, to);
  }

  return { group, labels, dashMat, line, arrow, label, dim, ext, ring, callout };
}
