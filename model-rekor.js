import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { BSP, sizeOf, internalThread, threadedEnd, metin } from 'kts/ortak';

// Tüm ölçüler rekor-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin bilezik alt alnının merkezi.
// Bilezik ağzı düz yuvarlaktır, yakanın iki yanı kesiktir. Parça 1 sökülünce bilezik yana kayar,
// eğilir ve yaka ağızdan sıyrılır; bu yol olculer'deki sokme.yol, tools/rekor.mjs ile denetlenir.
export const SPEC = await fetch(`rekor-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const UST = BSP[sizeOf(SPEC.uclar.ust.dis)];
const ALT = BSP[sizeOf(SPEC.uclar.alt.dis)];
const CONTA = SPEC.conta;
const BORE_R = M.E / 2;
const NECK_R = M.N / 2;
const COLLAR_R = M.D / 2;
const HEX_R = M.S / 2;
const SPIGOT_R = SPEC.merkezleme.cap / 2;
const SEAT_Y_ = M.C + M.K;                 // Parça 1 üst alnı
const SPIGOT_Y = SEAT_Y_ - SPEC.merkezleme.giris;
const FACE_Y = SEAT_Y_ + CONTA.kalinlik;   // gövde conta alnı
const COLLAR_TOP = FACE_Y + M.T;           // bilezik tırnağı buraya basar
const NECK_TOP = M.H - M.L;                // diş başlangıcı

export const HEIGHT = M.H;
export const SEAT_Y = SEAT_Y_;

const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 192);
const creased = (geo) => toCreasedNormals(geo, THREE.MathUtils.degToRad(30));

function evaluator() {
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  return ev;
}

// Yaka dış çizgisi (üstten): daire, iki düz kesik (Z), köşeler yuvarlatılmış
function collarOutline() {
  const R = COLLAR_R;
  const hf = M.F / 2;
  const rc = M.R;
  const ang = Math.asin((hf - rc) / (R - rc));
  const cx = (R - rc) * Math.cos(ang);
  const quarter = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * ang;
    quarter.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  for (let i = 1; i <= 14; i++) {
    const a = ang + (i / 14) * (Math.PI / 2 - ang);
    quarter.push([cx + rc * Math.cos(a), hf - rc + rc * Math.sin(a)]);
  }
  const mirrored = (sx, sz, list) => list.map(([x, z]) => [sx * x, sz * z]);
  return [
    ...quarter,
    ...mirrored(-1, 1, quarter).reverse(),
    ...mirrored(-1, -1, quarter),
    ...mirrored(1, -1, quarter).reverse(),
  ].map(([x, z]) => new THREE.Vector2(x, z));
}

// Gövde (diş hariç): merkezleme + conta alnı + yaka + boyun ∩ yaka dış çizgisi
function buildBody() {
  const ev = evaluator();
  const { yakaUst, yakaAlt } = SPEC.pah;
  const ring = new Brush(lathe([
    [BORE_R, SPIGOT_Y],
    [SPIGOT_R - 0.5, SPIGOT_Y],
    [SPIGOT_R, SPIGOT_Y + 0.5],
    [SPIGOT_R, FACE_Y],
    [COLLAR_R - yakaAlt, FACE_Y],
    [COLLAR_R, FACE_Y + yakaAlt],
    [COLLAR_R, COLLAR_TOP - yakaUst],
    [COLLAR_R - yakaUst, COLLAR_TOP],
    [NECK_R, COLLAR_TOP],
    [NECK_R, NECK_TOP],
    [BORE_R, NECK_TOP],
    [BORE_R, SPIGOT_Y],
  ]));
  ring.updateMatrixWorld();
  const prism = new THREE.ExtrudeGeometry(new THREE.Shape(collarOutline()), { depth: M.H + 4, bevelEnabled: false, curveSegments: 1 })
    .rotateX(-Math.PI / 2)
    .translate(0, -2, 0);
  prism.deleteAttribute('uv');
  const cut = new Brush(prism);
  cut.updateMatrixWorld();
  return creased(ev.evaluate(ring, cut, INTERSECTION).geometry);
}

// Bilezik: düz yuvarlak ağızlı pahlı halka ∩ altıgen
function buildNut() {
  const ev = evaluator();
  const corner = HEX_R / Math.cos(Math.PI / 6);
  const rFace = HEX_R - 0.4;
  const rOut = corner + 1;
  const ch = (rOut - rFace) * Math.tan(Math.PI / 6);
  const rT = ALT.major / 2;
  const rW = M.W / 2;
  const ring = new Brush(lathe([
    [rT + 0.8, 0],
    [rFace, 0],
    [rOut, ch],
    [rOut, M.B - ch],
    [rFace, M.B],
    [rW + SPEC.pah.agiz, M.B],
    [rW, M.B - SPEC.pah.agiz],
    [rW, COLLAR_TOP],
    [M.G / 2, COLLAR_TOP],
    [M.G / 2, M.C],
    [rT, M.C],
    [rT, 0.8],
    [rT + 0.8, 0],
  ]));
  ring.updateMatrixWorld();
  const hex = new Brush(new THREE.CylinderGeometry(corner, corner, M.B + 2, 6).translate(0, M.B / 2, 0));
  hex.updateMatrixWorld();
  return creased(ev.evaluate(ring, hex, INTERSECTION).geometry);
}

// Sökme yolu boyunca poz; t ∈ [0, 1], yol uzunluğuna göre eşit hızda
const YOL = SPEC.sokme.yol;
const YOL_BOY = YOL.slice(1).reduce((list, p, i) => {
  const q = YOL[i];
  list.push(list[i] + Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) * 0.4);
  return list;
}, [0]);

function yolPozu(t) {
  const s = t * YOL_BOY.at(-1);
  let i = 0;
  while (i < YOL.length - 2 && s > YOL_BOY[i + 1]) i++;
  const u = (s - YOL_BOY[i]) / (YOL_BOY[i + 1] - YOL_BOY[i]);
  return YOL[i].map((v, k) => v + (YOL[i + 1][k] - v) * u);
}

// Bileziği gövdeye göre poza koyar; eğim tırnak hizasından, Z ekseni çevresinde
function bilezikKoy(nut, [sx, dy, th], taban, spin = 0) {
  const a = THREE.MathUtils.degToRad(th);
  nut.rotation.set(0, spin, a, 'ZYX');
  nut.position.set(sx + Math.sin(a) * COLLAR_TOP, taban + dy + COLLAR_TOP * (1 - Math.cos(a)), 0);
}

const clamp = (x) => Math.min(1, Math.max(0, x));

export function montajPozu({ govde, bilezik, conta }, e, taban, opt) {
  const { gomulu = 0, kaldir = 0, ayir, contaKay, tur = 0, baslangic = 0.25 } = opt;
  const a = clamp(e / baslangic);
  const u = clamp((e - baslangic) / (1 - baslangic));
  const lift = kaldir * a;
  conta.position.y = taban + contaKay * a;
  govde.position.y = taban + lift + ayir * u + gomulu;
  bilezikKoy(bilezik, yolPozu(u), taban + lift + ayir * u + gomulu, tur * 2 * Math.PI * a);
}

export function parcaEtiketleri(a, konum) {
  const { ust, alt } = SPEC.uclar;
  const g = konum.govde;
  a.callout([0, g + M.H - 8, UST.major / 2], [-14, g + M.H + 4, 50], 'Gövde', `${ust.dis} · ${SPEC.malzemeKisa}`);
  a.callout([COLLAR_R, g + FACE_Y + M.T / 2, 0], [58, g + FACE_Y + 4, 8], `Yaka Ø${M.D}`, `Kesik ${M.F} · anahtar yeri`);
  a.callout([0, konum.bilezik + M.B - 6, HEX_R], [-14, konum.bilezik + M.B - 2, 60], `Bilezik SW ${M.S}`, `${alt.dis} iç diş · ağız Ø${M.W}`);
  a.callout([CONTA.dis / 2, konum.conta + M.C + 1, 0], [56, konum.conta + M.C - 10, 8], 'Klingerit conta', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`);
}

function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const rT = UST.major / 2;
  const { ust, alt } = SPEC.uclar;

  a.line([[0, -12, 0], [0, M.H + 12, 0]], a.dashMat);

  const [x0, x1] = [HEX_R + 12, HEX_R + 36];
  a.ext(M.H, rT + 1, x1 + 3);
  a.ext(NECK_TOP, NECK_R + 2, x0 + 3);
  a.ext(M.B, HEX_R + 1, x0 + 3);
  a.ext(0, HEX_R + 1, x1 + 3);
  dim(x0, NECK_TOP, M.H, 'L');
  dim(x0, M.B, NECK_TOP, 'U');
  dim(x0, 0, M.B, 'B');
  dim(x1, 0, M.H, 'H');

  a.callout([-rT * 0.7, M.H - 8, rT * 0.7], [-46, M.H + 10, 12], `${ust.dis} dış diş`, `Üst uç · ${ust.sizdirmazlik}`);
  a.callout([-HEX_R, M.B / 2, 0], [-70, M.B / 2 + 6, 8], `Bilezik SW ${M.S}`, `Ağız düz yuvarlak Ø${M.W}`);
  a.callout([0, 1, ALT.major / 2 + 3], [-10, -16, 54], `${alt.dis} iç diş`, `Alt uç · ${alt.sizdirmazlik}`);
}

// Ayrık görünüm: conta aşağı iner, gövde yükselirken bilezik sökme yolunu izler
const POZ = { taban: 0, ayir: 56, contaKay: -M.C - M.K + 1 };

export function kur({ brass, conta }) {
  const govde = new THREE.Group();
  govde.add(new THREE.Mesh(buildBody(), brass));
  govde.add(threadedEnd(UST, M.L, NECK_TOP, false, brass, { boreR: BORE_R, conical: /^R/.test(SPEC.uclar.ust.dis), endR: NECK_R }));

  const bilezik = new THREE.Group();
  bilezik.add(new THREE.Mesh(buildNut(), brass));
  const dis = new THREE.Mesh(internalThread(ALT, M.C - 0.8), brass);
  dis.position.y = 0.8;
  bilezik.add(dis);

  const contaMesh = new THREE.Mesh(creased(lathe([
    [CONTA.ic / 2, SEAT_Y_],
    [CONTA.dis / 2, SEAT_Y_],
    [CONTA.dis / 2, FACE_Y],
    [CONTA.ic / 2, FACE_Y],
    [CONTA.ic / 2, SEAT_Y_],
  ])), conta);

  const parts = { govde, bilezik, conta: contaMesh };
  const son = YOL.at(-1)[1] + POZ.ayir;

  return {
    ad: SPEC.parca,
    alt: `Pirinç ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: 'uretim/rekor/',
    cizim: {
      src: 'oynar-rekor-taslak.svg',
      alt: 'Oynar rekor teknik çizimi: kesit, bilezik ve yaka görünüşleri, parça listesi, sökme sırası',
    },
    parts,
    parcalar: [{ obj: govde }, { obj: bilezik }, { obj: contaMesh }],
    ayrikla: (e) => montajPozu(parts, e, POZ.taban, POZ),
    occluder: { r: HEX_R, y0: 0, y1: M.B },
    golge: 130,
    fit: (tech, ayrik) => (ayrik
      ? { y: 57, h: tech ? 92 : 84, w: tech ? 114 : 70 }
      : { y: M.H / 2, h: tech ? 70 : 56, w: tech ? 118 : 72 }),
    annotate,
    annotateAyrik: (a) => parcaEtiketleri(a, { govde: POZ.ayir, bilezik: son, conta: POZ.contaKay }),
  };
}
