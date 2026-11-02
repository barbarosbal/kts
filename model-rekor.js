import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { BSP, sizeOf, internalThread, threadedEnd, metin } from 'kts/ortak';

// Tüm ölçüler rekor-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin bilezik alt alnının merkezi.
export const SPEC = await fetch(`rekor-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const UST = BSP[sizeOf(SPEC.uclar.ust.dis)];
const ALT = BSP[sizeOf(SPEC.uclar.alt.dis)];
const CONTA = SPEC.conta;
const BORE_R = M.E / 2;
const NECK_R = M.N / 2;
const BACK_R = NECK_R + 0.1;               // bilezik sırt deliği: boyunda serbest döner
const RELIEF_R = 24.5;                     // bilezik iç diş boşaltma çeltiği
const WIRE_R = M.T / 2;
const HEX_R = M.S / 2;
const FACE_Y = M.C + CONTA.kalinlik;       // gövde conta alnı
const NECK_TOP = M.H - M.L;                // diş başlangıcı
const WIRE_Y = M.B - M.W;

export const HEIGHT = M.H;
export const SEAT_Y = M.C;                 // conta alt yüzü: Parça 1'in üst alnı buraya gelir

// Yarım daire çeltik: (r, y) merkezli, a0'dan a1'e (derece)
function arc(r, y, a0, a1, n = 8) {
  const pts = [];
  for (let i = 1; i < n; i++) {
    const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / n);
    pts.push([r + WIRE_R * Math.cos(a), y + WIRE_R * Math.sin(a)]);
  }
  return pts;
}

const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 192);
const creased = (geo) => toCreasedNormals(geo, THREE.MathUtils.degToRad(30));

function evaluator() {
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  return ev;
}

// Gövde (diş hariç): conta alnı + boyun + tel çeltiği − iki anahtar yüzü
function buildBody() {
  const ev = evaluator();
  let body = new Brush(lathe([
    [BORE_R, FACE_Y],
    [NECK_R - 0.5, FACE_Y],
    [NECK_R, FACE_Y + 0.5],
    [NECK_R, WIRE_Y - WIRE_R],
    ...arc(NECK_R, WIRE_Y, -90, -270),
    [NECK_R, WIRE_Y + WIRE_R],
    [NECK_R, NECK_TOP],
    [BORE_R, NECK_TOP],
    [BORE_R, FACE_Y],
  ]));
  body.updateMatrixWorld();
  for (const s of [1, -1]) {
    const box = new Brush(new THREE.BoxGeometry(10, M.A, 60));
    box.position.set(s * (M.K / 2 + 5), M.B + M.U / 2, 0);
    box.updateMatrixWorld();
    body = ev.evaluate(body, box, SUBTRACTION);
  }
  return creased(body.geometry);
}

// Bilezik: pahlı halka ∩ altıgen − tel deliği (çeltiğe teğet girer)
function buildNut() {
  const ev = evaluator();
  const rFace = HEX_R - 0.4;
  const rOut = HEX_R / Math.cos(Math.PI / 6) + 1;
  const ch = (rOut - rFace) * Math.tan(Math.PI / 6);
  const rT = ALT.major / 2;
  const ring = new Brush(lathe([
    [rT + 0.8, 0],
    [rFace, 0],
    [rOut, ch],
    [rOut, M.B - ch],
    [rFace, M.B],
    [BACK_R + 0.4, M.B],
    [BACK_R, M.B - 0.4],
    [BACK_R, WIRE_Y + WIRE_R],
    ...arc(BACK_R, WIRE_Y, 90, -90),
    [BACK_R, WIRE_Y - WIRE_R],
    [BACK_R, M.C + 4],
    [RELIEF_R, M.C + 4],
    [RELIEF_R, M.C],
    [rT, M.C],
    [rT, 0.8],
    [rT + 0.8, 0],
  ]));
  ring.updateMatrixWorld();
  const corner = HEX_R / Math.cos(Math.PI / 6);
  const hex = new Brush(new THREE.CylinderGeometry(corner, corner, M.B + 2, 6).translate(0, M.B / 2, 0));
  hex.updateMatrixWorld();
  let nut = ev.evaluate(ring, hex, INTERSECTION);
  const hole = new Brush(new THREE.CylinderGeometry(WIRE_R + 0.1, WIRE_R + 0.1, 50, 24)
    .rotateZ(Math.PI / 2)
    .translate(-25, WIRE_Y, NECK_R + 0.05));
  hole.updateMatrixWorld();
  nut = ev.evaluate(nut, hole, SUBTRACTION);
  return creased(nut.geometry);
}

export function parcaEtiketleri(a, ofset, tasima = 0) {
  const y = (v, k) => tasima + v + ofset[k];
  a.callout([0, y(M.H - 8, 'govde'), UST.major / 2], [-14, y(M.H + 4, 'govde'), 46], 'Gövde', `${SPEC.uclar.ust.dis} · ${SPEC.malzemeKisa}`);
  a.callout([NECK_R, y(WIRE_Y, 'tel'), 0], [46, y(WIRE_Y + 4, 'tel'), 10], `Tel kilit Ø${M.T}`, SPEC.tel.malzeme);
  a.callout([0, y(M.B - 6, 'bilezik'), HEX_R], [-14, y(M.B - 2, 'bilezik'), 50], `Bilezik SW ${M.S}`, `${SPEC.uclar.alt.dis} iç diş`);
  a.callout([CONTA.dis / 2, y(M.C + 1, 'conta'), 0], [48, y(M.C - 2, 'conta'), 10], 'Klingerit conta', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`);
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
  a.callout([-M.K / 2, M.B + M.U / 2, 0], [-58, M.B + M.U / 2 + 2, 8], `SW ${M.K} anahtar yüzü`, 'Gövdeyi tutar');
  a.callout([-HEX_R, M.B / 2, 0], [-62, M.B / 2 - 8, 8], `Bilezik SW ${M.S}`, 'Boşta döner');
  a.callout([0, 1, ALT.major / 2 + 3], [-10, -16, 46], `${alt.dis} iç diş`, `Alt uç · ${alt.sizdirmazlik}`);
}

// Ayrık görünümde her parçanın eksen boyunca kayması
const AYRIK = { govde: 50, tel: 34, bilezik: 16, conta: -13 };

export function kur({ brass, steel, conta }) {
  const govde = new THREE.Group();
  govde.add(new THREE.Mesh(buildBody(), brass));
  govde.add(threadedEnd(UST, M.L, NECK_TOP, false, brass, { boreR: BORE_R, conical: /^R/.test(SPEC.uclar.ust.dis), endR: NECK_R }));

  const bilezik = new THREE.Group();
  bilezik.add(new THREE.Mesh(buildNut(), brass));
  const dis = new THREE.Mesh(internalThread(ALT, M.C - 0.8), brass);
  dis.position.y = 0.8;
  bilezik.add(dis);

  const tel = new THREE.Mesh(
    new THREE.TorusGeometry(NECK_R + 0.05, WIRE_R, 16, 240, Math.PI * 2 * 0.97).rotateX(Math.PI / 2).translate(0, WIRE_Y, 0),
    steel,
  );

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
      alt: 'Oynar rekor teknik çizimi: kesit, üstten görünüm, parça listesi, notlar',
    },
    parcalar: [
      { ad: 'govde', obj: govde, ayrik: AYRIK.govde },
      { ad: 'tel', obj: tel, ayrik: AYRIK.tel },
      { ad: 'bilezik', obj: bilezik, ayrik: AYRIK.bilezik },
      { ad: 'conta', obj: contaMesh, ayrik: AYRIK.conta },
    ],
    occluder: { r: HEX_R, y0: 0, y1: M.B },
    golge: 110,
    fit: (tech, ayrik) => (ayrik
      ? { y: 55, h: tech ? 90 : 82, w: tech ? 104 : 62 }
      : { y: M.H / 2, h: tech ? 66 : 52, w: tech ? 104 : 58 }),
    annotate,
    annotateAyrik: (a) => parcaEtiketleri(a, AYRIK),
  };
}
