import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { BSP, sizeOf, internalThread, threadedEnd, metin } from 'kts/ortak';

// Tüm ölçüler rekor-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin bilezik alt alnının merkezi.
// Yakanın iki yanı kesiktir (Z), bileziğin ağzı aynı biçimdedir: kesikler hizalıyken yaka ağızdan
// geçer, bilezik 90° çevrilince tırnaklar (X) yakanın üstüne basar. Model kilitli konumda kurulur.
export const SPEC = await fetch(`rekor-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const UST = BSP[sizeOf(SPEC.uclar.ust.dis)];
const ALT = BSP[sizeOf(SPEC.uclar.alt.dis)];
const CONTA = SPEC.conta;
const BORE_R = M.E / 2;
const NECK_R = M.N / 2;
const COLLAR_R = M.D / 2;
const HEX_R = M.S / 2;
const SPIGOT_Y = M.C + 1;                  // conta merkezleme çıkıntısı
const FACE_Y = M.C + CONTA.kalinlik;       // gövde conta alnı
const COLLAR_TOP = FACE_Y + M.T;           // bilezik tırnağı buraya basar
const NECK_TOP = M.H - M.L;                // diş başlangıcı

export const HEIGHT = M.H;
export const SEAT_Y = M.C;                 // conta alt yüzü: Parça 1'in üst alnı buraya gelir

const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 192);
const creased = (geo) => toCreasedNormals(geo, THREE.MathUtils.degToRad(30));

function evaluator() {
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  return ev;
}

// Gövde (diş hariç): conta alnı + yaka + boyun çeltiği − yakanın iki yanı
function buildBody() {
  const ev = evaluator();
  const spigot = CONTA.ic / 2 - 0.25;
  let body = new Brush(lathe([
    [BORE_R, SPIGOT_Y],
    [spigot, SPIGOT_Y],
    [spigot, FACE_Y],
    [COLLAR_R - 0.5, FACE_Y],
    [COLLAR_R, FACE_Y + 0.5],
    [COLLAR_R, COLLAR_TOP - 0.5],
    [COLLAR_R - 0.5, COLLAR_TOP],
    [NECK_R, COLLAR_TOP],
    [NECK_R, NECK_TOP],
    [BORE_R, NECK_TOP],
    [BORE_R, SPIGOT_Y],
  ]));
  body.updateMatrixWorld();
  for (const s of [1, -1]) {
    const box = new Brush(new THREE.BoxGeometry(80, M.T + 2, 20));
    box.position.set(0, FACE_Y + M.T / 2, s * (M.F / 2 + 10));
    box.updateMatrixWorld();
    body = ev.evaluate(body, box, SUBTRACTION);
  }
  return creased(body.geometry);
}

// Bilezik: pahlı halka ∩ altıgen − ağzın iki yanı (kalanlar tırnak)
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
    [rW + 0.4, M.B],
    [rW, M.B - 0.4],
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
  let nut = ev.evaluate(ring, hex, INTERSECTION);

  const h = M.B - COLLAR_TOP + 2;
  const disk = new Brush(new THREE.CylinderGeometry(M.A / 2, M.A / 2, h, 128).translate(0, COLLAR_TOP - 1 + h / 2, 0));
  disk.updateMatrixWorld();
  const band = new Brush(new THREE.BoxGeometry(M.W, h + 2, 80).translate(0, COLLAR_TOP - 1 + h / 2, 0));
  band.updateMatrixWorld();
  nut = ev.evaluate(nut, ev.evaluate(disk, band, INTERSECTION), SUBTRACTION);
  return creased(nut.geometry);
}

export function parcaEtiketleri(a, ofset, tasima = 0) {
  const y = (v, k) => tasima + v + ofset[k];
  a.callout([0, y(M.H - 8, 'govde'), UST.major / 2], [-14, y(M.H + 4, 'govde'), 50], 'Gövde', `${SPEC.uclar.ust.dis} · ${SPEC.malzemeKisa}`);
  a.callout([COLLAR_R, y(FACE_Y + M.T / 2, 'govde'), 0], [56, y(FACE_Y + 4, 'govde'), 8], `Yaka Ø${M.D}`, `Kesik ${M.F} · anahtar yeri`);
  a.callout([0, y(M.B - 6, 'bilezik'), HEX_R], [-14, y(M.B - 2, 'bilezik'), 56], `Bilezik SW ${M.S}`, `${SPEC.uclar.alt.dis} iç diş`);
  a.callout([CONTA.dis / 2, y(M.C + 1, 'conta'), 0], [52, y(M.C - 12, 'conta'), 8], 'Klingerit conta', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`);
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
  a.callout([-HEX_R, M.B / 2, 0], [-66, M.B / 2 + 6, 8], `Bilezik SW ${M.S}`, 'Kesik ağız · 90° çevrilip çıkar');
  a.callout([0, 1, ALT.major / 2 + 3], [-10, -16, 50], `${alt.dis} iç diş`, `Alt uç · ${alt.sizdirmazlik}`);
}

// Ayrık görünümde her parçanın eksen boyunca kayması
const AYRIK = { govde: 40, bilezik: 16, conta: -13 };

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
    [CONTA.ic / 2, M.C],
    [CONTA.dis / 2, M.C],
    [CONTA.dis / 2, FACE_Y],
    [CONTA.ic / 2, FACE_Y],
    [CONTA.ic / 2, M.C],
  ])), conta);

  return {
    ad: SPEC.parca,
    alt: `Pirinç ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: null,
    cizim: {
      src: 'oynar-rekor-taslak.svg',
      alt: 'Oynar rekor teknik çizimi: kesit, bilezik ağzı ve yaka görünüşleri, parça listesi, notlar',
    },
    parcalar: [
      { ad: 'govde', obj: govde, ayrik: AYRIK.govde },
      { ad: 'bilezik', obj: bilezik, ayrik: AYRIK.bilezik, donus: 0.25 },
      { ad: 'conta', obj: contaMesh, ayrik: AYRIK.conta },
    ],
    gecikme: 0.35,
    occluder: { r: HEX_R, y0: 0, y1: M.B },
    golge: 120,
    fit: (tech, ayrik) => (ayrik
      ? { y: 47, h: tech ? 84 : 76, w: tech ? 110 : 66 }
      : { y: M.H / 2, h: tech ? 66 : 52, w: tech ? 112 : 66 }),
    annotate,
    annotateAyrik: (a) => parcaEtiketleri(a, AYRIK),
  };
}
