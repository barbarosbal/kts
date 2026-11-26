import * as THREE from 'three';
import { metin, smooth } from 'kts/ortak';
import { onYuz, silikonMat, nokta, ek } from 'kts/bileklik-ortak';

// Tüm ölçüler bileklik-ayarli-olculer.json'dan gelir (mm). Kapalı halkayla (model-bileklik.js) aynı ön yüz;
// tek parça silikon kayış, toka bileğin arkasında: baştaki mantar pim kuyruktaki deliğe girer, artan kuyruk
// tutucu halkanın altından geçer. Bileklik ekseni +Y; açı φ: 0 = +Z, π/2 = +X.
export const SPEC = await fetch(`bileklik-ayarli-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { pim: PIM, tutucu: TUT, modul: MOD, ayrik: AY } = SPEC;

const TAU = Math.PI * 2;
const R0 = O.C / TAU;                      // iç yarıçap, gösterilen takılı hal
const T = O.T;
const W = O.W;
const Q = O.Q;
const YC = W / 2;
const P = [0, YC, 0];
const KAT = T + 0.15;                      // kuyruk, baş ucunun üstünden bu kadar kalkar
const R_DIS = R0 + T;
const POD = THREE.MathUtils.degToRad(SPEC.yerlesim.modulAci);
const DS = 0.4;
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------- kayış yolu ----------------
// Baş ucundan (s = 0) kuyruk ucuna (s = L) sarmal: ilk turda R0, tur kapanırken baş ucunun üstüne KAT kadar kalkar.
const YOL = (() => {
  const s = [0];
  const rel = [0];
  const rin = [];
  const bitis = TAU + SPEC.kuyruk.uc / (R0 + T / 2);
  for (let i = 0; ; i++) {
    rin[i] = R0 + KAT * smooth(TAU - 0.32, TAU - 0.03, rel[i]);
    if (rel[i] >= bitis) break;
    rel.push(rel[i] + DS / (rin[i] + T / 2));
    s.push(s[i] + DS);
  }
  return { s, rel, rin, L: s[s.length - 1] };
})();
const L = YOL.L;

const ara = (arr, sx) => {
  const f = Math.min(Math.max(sx / DS, 0), arr.length - 1);
  const i = Math.min(Math.floor(f), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};
function sBul(hedef) {
  let lo = 0;
  let hi = YOL.rel.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (YOL.rel[m] < hedef) lo = m; else hi = m;
  }
  return (lo + (hedef - YOL.rel[lo]) / (YOL.rel[hi] - YOL.rel[lo])) * DS;
}

// Toka modülün tam karşısında
const OFS = POD + Math.PI - ara(YOL.rel, PIM.konum);
const phiAt = (sx) => ara(YOL.rel, sx) + OFS;
const rinAt = (sx) => ara(YOL.rin, sx);
const PIM_PHI = POD + Math.PI;
const TUT_PHI = phiAt(TUT.konum);
const S_TAKILI = sBul(ara(YOL.rel, PIM.konum) + TAU);
const DELIKLER = Array.from({ length: O.n }, (_, k) => S_TAKILI + (k - SPEC.ayar.takili) * O.p);
const ARALIK = [O.C - (O.n - 1 - SPEC.ayar.takili) * O.p, O.C + SPEC.ayar.takili * O.p];

// Sabit en, iki uç yarım daire
function en(sx) {
  const uc = Math.min(sx, L - sx);
  const r = W / 2;
  return uc < r ? 2 * Math.sqrt(Math.max(0, r * r - (r - uc) ** 2)) : W;
}

// Yuvarlatılmış dikdörtgen kesit, (y, t) düzleminde saat yönünün tersi; t = 0 bilek tarafı
const KOSE_N = 6;
function kesit(w) {
  const rc = Math.max(0, Math.min(O.c ?? 1.2, w / 2 - 1e-3, T / 2));
  const merkez = [
    [w / 2 - rc, rc, -Math.PI / 2],
    [w / 2 - rc, T - rc, 0],
    [-w / 2 + rc, T - rc, Math.PI / 2],
    [-w / 2 + rc, rc, Math.PI],
  ];
  const pts = [];
  for (const [cy, ct, a0] of merkez) {
    for (let k = 0; k <= KOSE_N; k++) {
      const a = a0 + (Math.PI / 2) * (k / KOSE_N);
      pts.push([cy + rc * Math.cos(a), ct + rc * Math.sin(a)]);
    }
  }
  return pts;
}

function kayisGeometrisi() {
  const N = YOL.s.length;
  const K = 4 * (KOSE_N + 1);
  const pos = new Float32Array(N * K * 3);
  let k = 0;
  for (let i = 0; i < N; i++) {
    const phi = YOL.rel[i] + OFS;
    const nx = Math.sin(phi);
    const nz = Math.cos(phi);
    for (const [y, t] of kesit(en(YOL.s[i]))) {
      const r = YOL.rin[i] + t;
      pos[k++] = nx * r;
      pos[k++] = YC + y;
      pos[k++] = nz * r;
    }
  }
  const index = new Uint32Array((N - 1) * K * 6);
  k = 0;
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < K; j++) {
      const a = i * K + j;
      const b = i * K + ((j + 1) % K);
      index.set([a, b, a + K, b, b + K, a + K], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  return g;
}

// ---------------- pim, tutucu ----------------
function pimGeometrisi() {
  const r = PIM.sapCap / 2;
  const R = PIM.basCap / 2;
  const h0 = R_DIS - 0.3;
  const h1 = R0 + KAT + T;                 // kuyruk dış yüzü
  const pts = [
    [0, h0], [r, h0], [r, h1], [R - 0.4, h1], [R, h1 + 0.35], [R - 0.15, h1 + PIM.basBoy * 0.75],
    [R * 0.55, h1 + PIM.basBoy], [0, h1 + PIM.basBoy],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 48).rotateX(Math.PI / 2).translate(0, YC, 0);
}

function tutucuGeometrisi() {
  const et = TUT.et;
  const kalin = T + KAT;
  const ic = { y: W / 2 + 0.15, t: kalin / 2 + 0.1 };
  const dis = { y: ic.y + et, t: ic.t + et };
  const kare = (yy, tt, rr) => {
    const s = new THREE.Shape();
    s.moveTo(-yy + rr, -tt);
    s.lineTo(yy - rr, -tt);
    s.quadraticCurveTo(yy, -tt, yy, -tt + rr);
    s.lineTo(yy, tt - rr);
    s.quadraticCurveTo(yy, tt, yy - rr, tt);
    s.lineTo(-yy + rr, tt);
    s.quadraticCurveTo(-yy, tt, -yy, tt - rr);
    s.lineTo(-yy, -tt + rr);
    s.quadraticCurveTo(-yy, -tt, -yy + rr, -tt);
    return s;
  };
  const sh = kare(dis.y, dis.t, 1.6);
  sh.holes.push(kare(ic.y, ic.t, 0.6));
  const g = new THREE.ExtrudeGeometry(sh, { depth: TUT.en, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 3 });
  // şekil x → dünya Y, şekil y → radyal, uzatma → teğet
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  return g.translate(-TUT.en / 2, YC, R0 + kalin / 2);
}

// ---------------- teknik katman ----------------
let ON = null;

function annotate(a) {
  const x0 = R_DIS + 9;
  a.ext(0, R_DIS + 1, x0 + 3);
  a.ext(W, R_DIS + 1, x0 + 3);
  a.dim(x0, 0, W, `W = ${metin(W)}`);

  const yd = W + 3;
  a.line([[-R0, yd, 0], [R0, yd, 0]]);
  a.arrow([-R0, yd, 0], [R0, yd, 0]);
  a.arrow([R0, yd, 0], [-R0, yd, 0]);
  a.label(`iç çevre ${O.C} (orta delik)`, [0, yd, 0], 'dimtag');

  a.callout(nokta(POD, R_DIS, YC - Q / 2 + 1), ek(-24, -34, 20, P),
    `Kimlik modülü ${metin(Q)} × ${metin(Q)}`, 'gömme, yüzeyle aynı hizada · NFC + QR');
  a.callout(nokta(ON.LOGO_PHI, R_DIS, YC + 5), ek(-34, 42, -6, P),
    'tipay logosu', `kalıpta gömme · h ${metin(SPEC.logo.yukseklik)}`);
  a.callout(nokta(ON.NFC_PHI, R_DIS, YC + 3), ek(32, 38, 0, P),
    'Dokun işareti', 'NFC inlay plakanın altında');
  const hk = DELIKLER[SPEC.ayar.takili + 1];
  a.callout(nokta(phiAt(hk), rinAt(hk) + T + 0.5), ek(30, -34, 10, P),
    `Mantar pim + ${O.n} delik · ${metin(O.p)} mm adım`, `bilek çevresi ≈ ${ARALIK[0]}–${ARALIK[1]} mm · toka arkada`);
  a.callout(nokta(TUT_PHI, R0 + KAT + T + TUT.et, W), ek(2, 58, 0, P), 'Tutucu halka', 'kuyruk ucunu tutar');
}

function annotateAyrik(a) {
  const pl = nokta(POD, R_DIS + AY.plaka, YC + AY.plakaY + Q / 2 - 2);
  a.callout(ek(-Q / 2, 0, 0, pl), ek(-30, 12, 0, pl), '3 · QR plakası', `${MOD.plaka.malzeme} · tekil QR`);
  const nf = nokta(POD, ON.R_NFC + AY.nfc, YC + AY.nfcY);
  a.callout(ek(MOD.nfc.cap / 2, 0, 0, nf), ek(30, 4, 0, nf), '2 · NFC inlay', `Ø${metin(MOD.nfc.cap)} · ${MOD.nfc.cip}`);
  const ky = nokta(POD + 1.1, R_DIS, 2);
  a.callout(ky, ek(24, -18, 0, ky), '1 · Silikon kayış', `${SPEC.malzemeKisa} · ayarlı, tek parça`);
}

// ---------------- kurulum ----------------
export function kur() {
  const silikon = silikonMat();
  const delikMat = new THREE.MeshBasicMaterial({ color: 0x060607 });

  const kayis = new THREE.Group();
  kayis.add(new THREE.Mesh(kayisGeometrisi(), silikon));
  const pim = new THREE.Mesh(pimGeometrisi(), silikon);
  pim.rotation.y = PIM_PHI;
  const tutucu = new THREE.Mesh(tutucuGeometrisi(), silikon);
  tutucu.rotation.y = TUT_PHI;
  kayis.add(pim, tutucu);

  // Delik izleri: kuyruk dış yüzünde; takılı delik pimin altında, tutucunun altındakiler görünmez
  const tutYari = (TUT.en / 2 + O.d) / (R0 + KAT + T);
  DELIKLER.forEach((sx, k) => {
    if (k === SPEC.ayar.takili) return;
    const phi = phiAt(sx);
    if (Math.abs(sar(phi - TUT_PHI)) < tutYari) return;
    const m = new THREE.Mesh(new THREE.CircleGeometry(O.d / 2, 32).translate(0, YC, rinAt(sx) + T + 0.03), delikMat);
    m.rotation.y = phi;
    kayis.add(m);
  });

  ON = onYuz(SPEC, { POD, R: R_DIS, YC });
  kayis.add(...ON.izler);

  const parts = { kayis, nfc: ON.nfc, plaka: ON.plaka };
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} ayarlı kayış · tek beden ${ARALIK[0]}–${ARALIK[1]} · gömme NFC + QR · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    cizim: {
      src: 'bileklik-ayarli-taslak.svg',
      alt: 'tipay ayarlı bileklik teknik çizimi: açılmış kayış, kimlik modülü kesiti, QR plakası, parça listesi',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (e) => ON.ayrikla(e, smooth),
    occluder: { r: R_DIS, y0: 0, y1: W },
    golge: 120,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 10, h: tech ? 104 : 84, w: tech ? 150 : 96 }
      : { y: YC + (tech ? 8 : 0), h: tech ? 124 : 64, w: tech ? 150 : 80 }),
    annotate,
    annotateAyrik,
  };
}
