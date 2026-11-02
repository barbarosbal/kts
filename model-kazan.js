import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import { BSP, sizeOf, Y, internalThread, threadedEnd, metin } from 'kts/ortak';

// Tüm ölçüler olculer.json'dan gelir (mm). Parça ekseni +Y, orijin alt ucun merkezi.
export const SPEC = await fetch(`olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const BODY_R = M.D / 2;
const BORE_R = M.E / 2;
const L1 = M.L1;
const L2 = M.L2;
const TOP = M.H;
const BODY_Y = [L2, TOP - L1];             // dişsiz gövde bölümü (alt / üst diş arası)
const LEVEL = { 1: TOP - M.H1, 2: TOP - M.H2 };   // seviyeler üst alından ölçülür
const LEVEL1 = LEVEL[1];
const LEVEL2 = LEVEL[2];
const TOP_THREAD = BSP[sizeOf(SPEC.uclar.ust.dis)];
const BOTTOM_THREAD = BSP[sizeOf(SPEC.uclar.alt.dis)];

// Açı üstten görünümde: 0° = P1 yönü (-Z), 90° = sol (-X). face: eksenden port alnına (A, B).
// Diş dibi matkabı Ø, diş bitiminden gövde deliğine kadar devam eder.
const PORTS = SPEC.portlar.map((p) => {
  const a = THREE.MathUtils.degToRad(p.aci);
  const size = sizeOf(p.dis);
  return {
    id: p.id,
    size,
    bossR: p.bossCap / 2,
    face: M[p.alin],
    depth: p.disDerinligi,
    passR: BSP[size].tapDrill / 2,
    y: LEVEL[p.seviye],
    level: p.seviye,
    dir: new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)),
  };
});

// Nesnenin yerel +Y eksenini port yönüne çevirip eksenden `dist` uzağa koyar
function place(obj, p, dist) {
  obj.quaternion.setFromUnitVectors(Y, p.dir);
  obj.position.copy(p.dir).multiplyScalar(dist).setY(p.y);
  obj.updateMatrixWorld();
}

// Gövde: dolu silindir + eksenden başlayan port bossları − delik (ince ette boss içi delikte kalır)
// − diş delikleri, kanallar, havşalar
function buildBody() {
  const [y0, y1] = BODY_Y;
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  const cyl = (rTop, rBottom, h, segs) => new Brush(new THREE.CylinderGeometry(rTop, rBottom, h, segs));
  // CSG sonucu ilk operandın yerel koordinatında döner: eksendeki silindirlerin kaydırması geometriye işlenir
  const onAxis = (r, h, segs) => {
    const brush = new Brush(new THREE.CylinderGeometry(r, r, h, segs).translate(0, (y0 + y1) / 2, 0));
    brush.updateMatrixWorld();
    return brush;
  };

  let body = onAxis(BODY_R, y1 - y0, 160);
  for (const p of PORTS) {
    // Boss, en geniş yeri gövde yüzeyine değdiği yerden başlar: tabanı dolu gövdenin içinde kalır,
    // aynı seviyedeki diğer bosslarla kesişmez
    const from = Math.sqrt(Math.max(0, BODY_R ** 2 - p.bossR ** 2)) - 0.5;
    const boss = cyl(p.bossR, p.bossR, p.face - from, 72);
    place(boss, p, (p.face + from) / 2);
    body = ev.evaluate(body, boss, ADDITION);
  }
  body = ev.evaluate(body, onAxis(BORE_R, y1 - y0 + 2, 128), SUBTRACTION);

  for (const p of PORTS) {
    const rh = BSP[p.size].major / 2;
    const bottom = p.face - p.depth;
    const cuts = [
      [cyl(rh, rh, p.depth + 1, 64), p.face - p.depth / 2 + 0.5],
      [cyl(p.passR, p.passR, bottom + 0.5 - 10, 48), (bottom + 0.5 + 10) / 2],
      [cyl(rh + 1.6, rh - 0.2, 1.8, 64), p.face - 0.3],
    ];
    for (const [brush, dist] of cuts) {
      place(brush, p, dist);
      body = ev.evaluate(body, brush, SUBTRACTION);
    }
  }

  return toCreasedNormals(body.geometry, THREE.MathUtils.degToRad(30));
}

function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const rT = TOP_THREAD.major / 2;
  const d45 = Math.SQRT1_2;

  // eksenler
  a.line([[0, -14, 0], [0, TOP + 16, 0]], a.dashMat);
  for (const p of PORTS) {
    a.line([[0, p.y, 0], p.dir.clone().multiplyScalar(p.face + 16).setY(p.y)], a.dashMat);
  }

  // seviyeler
  for (const [y, n] of [[LEVEL1, 1], [LEVEL2, 2]]) {
    a.ring(y, BODY_R + 5);
    a.label(`SEVİYE ${n}`, [(BODY_R + 10) * d45, y, (BODY_R + 10) * d45], 'lvl');
  }

  // yükseklik ölçüleri (boş olan +X tarafında)
  const [x0, x1, x2, x3] = [15, 28, 40, 54].map((d) => BODY_R + d);
  a.ext(TOP, rT + 1, x3 + 4);
  a.ext(BODY_Y[1], BODY_R + 1, x0 + 4);
  a.ext(LEVEL1, BODY_R + 1, x1 + 4);
  a.ext(LEVEL2, BODY_R + 1, x2 + 4);
  a.ext(BODY_Y[0], BODY_R + 1, x0 + 4);
  a.ext(0, rT + 1, x3 + 4);
  dim(x0, BODY_Y[1], TOP, 'L1');
  dim(x0, 0, BODY_Y[0], 'L2');
  dim(x1, LEVEL1, TOP, 'H1');
  dim(x2, LEVEL2, TOP, 'H2');
  dim(x3, 0, TOP, 'H');

  // açıklamalar: seviye 1 etiketleri yukarı, seviye 2 aşağı
  for (const p of PORTS) {
    const up = p.level === 1 ? 1 : -1;
    const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x).multiplyScalar(12 * up);
    const at = p.dir.clone().multiplyScalar(p.face).setY(p.y + up * p.bossR);
    const to = p.dir.clone().multiplyScalar(p.face + 20).add(side).setY(p.y + up * 32);
    a.callout(at, to, `${p.id} · ${p.size}″ iç diş`, `Seviye ${p.level}`);
  }
  const { ust, alt } = SPEC.uclar;
  a.callout([0, TOP - 6, rT], [10, TOP + 18, 44], `${ust.dis} dış diş`, `Üst uç · ${ust.sizdirmazlik}`);
  a.callout([0, 8, rT], [24, -24, 44], `${alt.dis} dış diş`, `Alt uç · ${alt.sizdirmazlik}`);
}

export const HEIGHT = TOP;

export function kur({ brass }) {
  const part = new THREE.Group();
  part.add(new THREE.Mesh(buildBody(), brass));
  part.add(threadedEnd(TOP_THREAD, L1, BODY_Y[1], false, brass, { boreR: BORE_R, rMax: BODY_R }));
  part.add(threadedEnd(BOTTOM_THREAD, L2, 0, true, brass, { boreR: BORE_R, rMax: BODY_R, conical: /^R/.test(SPEC.uclar.alt.dis) }));
  for (const p of PORTS) {
    const m = new THREE.Mesh(internalThread(BSP[p.size], p.depth - 1.6), brass);
    m.quaternion.setFromUnitVectors(Y, p.dir.clone().negate());
    m.position.copy(p.dir).multiplyScalar(p.face - 1).setY(p.y);
    part.add(m);
  }

  return {
    ad: SPEC.parca,
    alt: `Pirinç ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: 'uretim/',
    cizim: {
      src: 'kazan-alti-parcasi-taslak.svg',
      alt: 'Kazan altı parçası teknik çizimi: üstten ve yan görünüm, port listesi, notlar',
    },
    parcalar: [{ obj: part, ayrik: 0 }],
    occluder: { r: BODY_R, y0: 0, y1: TOP },
    fit: (tech) => ({ y: TOP / 2, h: (tech ? 0.78 : 0.6) * TOP, w: (tech ? 0.9 : 0.56) * TOP }),
    annotate,
  };
}
