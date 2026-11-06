import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

// Kelepçe sıkma uçlarının (v1, v2) ortak mili: 8 mm altıgen sap (akülü vidalama mandreni), iki tırnak.
// Parça ekseni +Y, orijin sap ucunun merkezi. Dönel profil her modelin kendisinden gelir.
export const olculer = (SPEC) => Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const prism = (pts, depth) => new THREE.ExtrudeGeometry(shape(pts), { depth, bevelEnabled: false });

// profil: [r, y] dönel profil; sap ucundan başlar, alın cebinden eksene döner
export function milGeometrisi(SPEC, profil) {
  const M = olculer(SPEC);
  const SAP_R = M.S / 2;
  const FACE_Y = M.H - M.C;                // kafa alnı, tırnaklar buradan uzar
  const MOUTH_X = M.A / 2;                 // tırnak iç yüzü
  const OUTER_X = MOUTH_X + M.U;           // tırnak dış yüzü
  const GROOVE_Y = FACE_Y - SPEC.onKanal.konum;

  // Altıgen sap: sap ucundan boyun pahının sonuna; mandren çeneleri bu yüzlere oturur, köşeler ±X üzerinde, sap çapında
  function gripCutter() {
    const { sw } = SPEC.kavrama;
    const [bas, son] = [-1, M.L + (M.S - M.N) / 2];
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

  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  const brush = (geo) => {
    geo.deleteAttribute('uv');
    const b = new Brush(geo);
    b.updateMatrixWorld();
    return b;
  };
  const lathe = new THREE.LatheGeometry(profil.map(([r, y]) => new THREE.Vector2(r, y)), 192);
  let body = brush(lathe);
  body = ev.evaluate(body, brush(gripCutter()), SUBTRACTION);
  for (const angle of [0, Math.PI]) {
    const [thick, wide] = toothProfiles(angle);
    body = ev.evaluate(body, ev.evaluate(brush(thick), brush(wide), INTERSECTION), ADDITION);
    body = ev.evaluate(body, brush(flatCutter(angle)), SUBTRACTION);
  }
  return toCreasedNormals(body.geometry, THREE.MathUtils.degToRad(30));
}
