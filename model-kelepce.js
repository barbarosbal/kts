import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { metin } from 'kts/ortak';

// Tüm ölçüler kelepce-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin SDS-Plus sap ucunun merkezi.
// Tek parça: dönel profil tornadan; sap kanalları, iki tırnak ve dış düz yüzeyler frezeden çıkar.
export const SPEC = await fetch(`kelepce-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const BODY_R = M.D / 2;
const SAP_R = M.S / 2;
const NECK_R = M.N / 2;
const BODY_Y = M.L + M.T;                  // gövde arka yüzü
const FACE_Y = M.H - M.C;                  // gövde alnı, tırnaklar buradan uzar
const MOUTH_X = M.A / 2;                   // tırnak iç yüzü
const OUTER_X = MOUTH_X + M.U;             // tırnak dış yüzü
const GROOVE_Y = FACE_Y - SPEC.onKanal.konum;

const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const prism = (pts, depth) => new THREE.ExtrudeGeometry(shape(pts), { depth, bevelEnabled: false });

// Sap, boyun, halka, gövde, ön kanal, alın yuvası, orta cep ve delik
function profile() {
  const { sap, govde, alin, halka } = SPEC.pah;
  const ringR = M.Z / 2;
  const ring0 = M.L + SPEC.halka.konum;
  const ring1 = ring0 + SPEC.halka.kalinlik;
  const g = SPEC.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0],
    [SAP_R - sap, 0],
    [SAP_R, sap * 0.8],
    [SAP_R, M.L],
    [NECK_R, M.L + SAP_R - NECK_R],
    [NECK_R, ring0],
    [ringR - halka, ring0],
    [ringR, ring0 + halka],
    [ringR, ring1 - halka],
    [ringR - halka, ring1],
    [NECK_R, ring1],
    [NECK_R, BODY_Y],
    [BODY_R - govde, BODY_Y],
    [BODY_R, BODY_Y + govde],
    [BODY_R, GROOVE_Y - g],
    [BODY_R - g, GROOVE_Y],
    [BODY_R, GROOVE_Y + g],
    [BODY_R, FACE_Y - alin],
    [BODY_R - alin, FACE_Y],
    [M.W / 2, FACE_Y],
    [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y],
    [M.P / 2, cep],
    [M.J / 2, cep],
    [M.J / 2, cep - 3],
    [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}

// Açık kanal (±Z): sap ucundan başlar, diskli freze çıkışı ile biter
function openSlot(angle) {
  const { en, derinlik, boy, cikisR } = SPEC.sds.acik;
  const floor = SAP_R - derinlik;
  const run = Math.sqrt(cikisR ** 2 - (cikisR - derinlik) ** 2);
  const [cx, cy] = [floor + cikisR, boy - run];
  const arc = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.acos((cx - SAP_R - 1) / cikisR);
    arc.push([cx - cikisR * Math.cos(t), cy + cikisR * Math.sin(t)]);
  }
  return prism([[floor, -2], [SAP_R + 3, -2], [SAP_R + 3, arc.at(-1)[1]], ...arc.reverse()], en)
    .rotateY(-Math.PI / 2)
    .translate(en / 2, 0, 0)
    .rotateY(angle);
}

// Kilit kanalı (±X): kapalı, bilye yatağı; yüzeyde en × (son − bas) boyunda oval bırakır
function lockSlot(side) {
  const { en, derinlik, bas, son } = SPEC.sds.kilit;
  const floor = SAP_R - derinlik;
  const x = Math.sqrt(SAP_R ** 2 - (en / 2) ** 2) - floor;
  const rho = (x ** 2 + (en / 2) ** 2) / (2 * x);
  const cx = floor + rho;
  const lift = Math.sqrt(rho ** 2 - (cx - SAP_R) ** 2);
  return new THREE.CapsuleGeometry(rho, son - bas - 2 * lift, 12, 40)
    .translate(side * cx, (bas + son) / 2, 0);
}

// Kavrama altıgeni: üç ayaklı mandrenin çeneleri bu yüzlere oturur; köşeler ±X üzerinde, sap çapında kalır
function gripCutter() {
  const { sw, bas, son } = SPEC.kavrama;
  const r = sw / Math.sqrt(3);
  const outer = new THREE.Shape();
  outer.absarc(0, 0, M.D, 0, 2 * Math.PI);
  outer.holes.push(new THREE.Path(Array.from({ length: 7 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  })));
  return new THREE.ExtrudeGeometry(outer, { depth: son - bas, bevelEnabled: false, curveSegments: 32 })
    .rotateX(-Math.PI / 2)
    .translate(0, bas, 0);
}

// Tırnak iki profilin kesişimidir: kalınlıkta ağız pahı, ende yan pahlar. Dış yüzü sonradan düz kesilir.
function toothProfiles(angle) {
  const { ic, yan } = SPEC.pah.uc;
  const y0 = FACE_Y - 1;
  const hv = M.V / 2;
  const thick = prism([
    [MOUTH_X, y0],
    [OUTER_X + 2, y0],
    [OUTER_X + 2, M.H],
    [MOUTH_X + ic, M.H],
    [MOUTH_X, M.H - ic],
  ], M.V + 2).translate(0, 0, -hv - 1).rotateY(angle);
  const wide = prism([
    [-hv, y0],
    [hv, y0],
    [hv, M.H - yan],
    [hv - yan, M.H],
    [-hv + yan, M.H],
    [-hv, M.H - yan],
  ], M.U + 6).rotateY(-Math.PI / 2).translate(OUTER_X + 3, 0, 0).rotateY(angle);
  return [thick, wide];
}

// Tırnak dış yüzü: ön halkada da devam eder, ucunda dış pah kalır
function flatCutter(angle) {
  const { dis } = SPEC.pah.uc;
  return prism([
    [OUTER_X, GROOVE_Y + 0.2],
    [OUTER_X + 6, GROOVE_Y + 0.2],
    [OUTER_X + 6, M.H + 2],
    [OUTER_X - dis - 2, M.H + 2],
    [OUTER_X, M.H - dis],
  ], M.D + 4).translate(0, 0, -M.D / 2 - 2).rotateY(angle);
}

function buildBit() {
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  const brush = (geo) => {
    geo.deleteAttribute('uv');
    const b = new Brush(geo);
    b.updateMatrixWorld();
    return b;
  };
  const lathe = new THREE.LatheGeometry(profile().map(([r, y]) => new THREE.Vector2(r, y)), 192);
  let body = brush(lathe);
  for (const cutter of [openSlot(0), openSlot(Math.PI), lockSlot(1), lockSlot(-1), gripCutter()]) {
    body = ev.evaluate(body, brush(cutter), SUBTRACTION);
  }
  for (const angle of [0, Math.PI]) {
    const [thick, wide] = toothProfiles(angle);
    body = ev.evaluate(body, ev.evaluate(brush(thick), brush(wide), INTERSECTION), ADDITION);
    body = ev.evaluate(body, brush(flatCutter(angle)), SUBTRACTION);
  }
  return toCreasedNormals(body.geometry, THREE.MathUtils.degToRad(30));
}

function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const hdim = (y, r, text) => {
    a.line([[-r, y, 0], [r, y, 0]]);
    a.arrow([-r, y, 0], [r, y, 0]);
    a.arrow([r, y, 0], [-r, y, 0]);
    a.label(text, [0, y, 0], 'dimtag');
  };

  a.line([[0, -8, 0], [0, M.H + 8, 0]], a.dashMat);

  const [x0, x1] = [BODY_R + 8, BODY_R + 20];
  a.ext(M.H, OUTER_X + 1, x1 + 3);
  a.ext(FACE_Y, BODY_R + 1, x0 + 3);
  a.ext(M.L, NECK_R + 1, x0 + 3);
  a.ext(0, SAP_R + 1, x1 + 3);
  dim(x0, FACE_Y, M.H, 'C');
  dim(x0, 0, M.L, 'L');
  dim(x1, 0, M.H, 'H');

  a.line([[-MOUTH_X, M.H, 0], [-MOUTH_X, M.H + 9, 0]]);
  a.line([[MOUTH_X, M.H, 0], [MOUTH_X, M.H + 9, 0]]);
  hdim(M.H + 7, MOUTH_X, `A ≥ ${metin(M.A)}`);

  a.callout([-OUTER_X, M.H - 6, 0], [-40, M.H + 2, 6], `Tırnak ${metin(M.V)} × ${metin(M.U)}`, 'En ve boy varsayım');
  a.callout([-BODY_R, BODY_Y + 8, 0], [-42, BODY_Y - 2, 6], `Gövde Ø${metin(M.D)}`, `${SPEC.malzemeKisa} · ${SPEC.sertlik}`);
  const { sw, bas, son } = SPEC.kavrama;
  a.callout([-SAP_R, 32, 0], [-34, 28, 6], 'Altıgen kavrama', `SW ${metin(sw)} × ${metin(son - bas)} · mandren çeneleri`);
  a.callout([-SAP_R, 12, 0], [-30, 9, 6], 'SDS-Plus sap', `Ø${metin(M.S)} × ${metin(M.L)} · 2 açık + 2 kilit kanalı`);
}

export function kur({ celik }) {
  return {
    ad: SPEC.parca,
    alt: `Çelik ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: null,
    cizim: {
      src: 'kelepce-ucu-taslak.svg',
      alt: 'Kelepçe sıkma ucu teknik çizimi: yarım kesit ve yan görünüş, ağız görünüşü, SDS-Plus sap kesiti, işleme sırası',
    },
    parcalar: [{ obj: new THREE.Mesh(buildBit(), celik) }],
    occluder: { r: BODY_R, y0: BODY_Y, y1: FACE_Y },
    golge: 90,
    fit: (tech) => ({ y: M.H / 2, h: tech ? 70 : 64, w: tech ? 80 : 40 }),
    annotate,
  };
}
