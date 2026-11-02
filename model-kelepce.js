import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { metin } from 'kts/ortak';

// Tüm ölçüler kelepce-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin altıgen sap ucunun merkezi.
// Tek parça: dönel profil tornadan, altıgen yüzeyler ve çatal kanalı frezeden çıkar.
export const SPEC = await fetch(`kelepce-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const BODY_R = M.D / 2;
const SAP_R = M.E / 2;                     // altıgen köşeleri bu çapta kırılır
const BODY_Y = M.L + M.T;                  // geçişin bittiği yer
const SLOT_Y = M.H - M.C;                  // çatal dibi

// Sap, bilye kanalı, geçiş ve gövde
function profile() {
  const { sap, govde } = SPEC.pah;
  const rho = SPEC.kanal.yaricap;
  const cr = M.G / 2 + rho;
  const phi = Math.acos((cr - SAP_R) / rho);
  const kanal = [];
  for (let i = 0; i <= 16; i++) {
    const a = -phi + (2 * phi * i) / 16;
    kanal.push([cr - rho * Math.cos(a), M.K + rho * Math.sin(a)]);
  }
  return [
    [0, 0],
    [SAP_R - sap, 0],
    [SAP_R, sap * 0.8],
    ...kanal,
    [SAP_R, M.L + 1],
    [BODY_R, BODY_Y],
    [BODY_R, M.H - govde],
    [BODY_R - govde, M.H],
    [0, M.H],
  ];
}

// Altıgen dışında kalanı keser; köşeler ±X üzerindedir
function hexCutter() {
  const r = M.S / Math.sqrt(3);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, M.D, 0, 2 * Math.PI);
  shape.holes.push(new THREE.Path(Array.from({ length: 7 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  })));
  return new THREE.ExtrudeGeometry(shape, { depth: M.L + 2, bevelEnabled: false, curveSegments: 32 })
    .rotateX(-Math.PI / 2)
    .translate(0, -2, 0);
}

// Çatal kanalı: X yönünde A kadar açık, Z boyunca boydan boya; ağızda pah, dipte R
function slotCutter() {
  const a = M.A / 2;
  const r = M.R;
  const p = SPEC.pah.agiz + 1;
  const top = M.H + 1;
  const shape = new THREE.Shape();
  shape.moveTo(-a - p, top);
  shape.lineTo(-a, top - p);
  shape.absarc(-a + r, SLOT_Y + r, r, Math.PI, 1.5 * Math.PI);
  shape.absarc(a - r, SLOT_Y + r, r, 1.5 * Math.PI, 2 * Math.PI);
  shape.lineTo(a, top - p);
  shape.lineTo(a + p, top);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: M.D + 4, bevelEnabled: false, curveSegments: 12 })
    .translate(0, 0, -M.D / 2 - 2);
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
  const body = ev.evaluate(brush(lathe), brush(hexCutter()), SUBTRACTION);
  return toCreasedNormals(ev.evaluate(body, brush(slotCutter()), SUBTRACTION).geometry, THREE.MathUtils.degToRad(30));
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
  a.ext(M.H, BODY_R + 1, x1 + 3);
  a.ext(SLOT_Y, M.A / 2 + 1, x0 + 3);
  a.ext(M.L, SAP_R + 1, x0 + 3);
  a.ext(0, SAP_R + 1, x1 + 3);
  dim(x0, SLOT_Y, M.H, 'C');
  dim(x0, 0, M.L, 'L');
  dim(x1, 0, M.H, 'H');

  a.line([[-M.A / 2, M.H, 0], [-M.A / 2, M.H + 8, 0]]);
  a.line([[M.A / 2, M.H, 0], [M.A / 2, M.H + 8, 0]]);
  hdim(M.H + 6, M.A / 2, `A = ${metin(M.A)}`);

  a.callout([-BODY_R, M.H - 7, 0], [-32, M.H + 2, 6], `Çatal ${metin(M.A)} × ${metin(M.C)}`, 'Varsayım · kelepçe ölçülecek');
  a.callout([-BODY_R, BODY_Y + 6, 0], [-36, BODY_Y, 6], `Gövde Ø${metin(M.D)}`, `${SPEC.malzemeKisa} · ${SPEC.sertlik}`);
  a.callout([-SAP_R, M.K, 0], [-30, M.K - 7, 6], '1/4″ altıgen sap', `SW ${metin(M.S)} · E 6.3 kanallı`);
}

export function kur({ celik }) {
  return {
    ad: SPEC.parca,
    alt: `Çelik ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: null,
    cizim: {
      src: 'kelepce-ucu-taslak.svg',
      alt: 'Kelepçe sıkma ucu teknik çizimi: ön ve yan görünüş, çatal ucu, altıgen kesit, işleme sırası',
    },
    parcalar: [{ obj: new THREE.Mesh(buildBit(), celik) }],
    occluder: { r: BODY_R, y0: BODY_Y, y1: M.H },
    golge: 70,
    fit: (tech) => ({ y: M.H / 2, h: tech ? 58 : 54, w: tech ? 66 : 34 }),
    annotate,
  };
}
