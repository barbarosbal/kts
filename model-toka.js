import * as THREE from 'three';
import { metin, smooth } from 'kts/ortak';
import { qrDokusu, nfcDokusu, ek } from 'kts/bileklik-ortak';

// PA12 bileklik tokası: STEP ile aynı OpenCascade katısının ağı (tools/toka.mjs) + elastik bant, baskılı plaka, NFC.
// CAD ekseni: X bant boyunca, Y bant eni, Z dışa. Sahnede toka, rotation.y = POD olan çerçevede durur
// (yerel +X teğet, +Y yukarı, +Z dışa); bileklik ekseni +Y.
const V = new URL(import.meta.url).search;
async function json(p) {
  const r = await fetch(`${p}${V}`);
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
}
export const SPEC = await json('toka-olculer.json');
const { mesh } = await json('uretim/toka/toka-mesh.json');
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { cep: CEP, plaka: PL, nfc: NFC, ayrik: AY } = SPEC;

const TAU = Math.PI * 2;
const H = Math.round((M.Kw + 2 * M.Yn) * 100) / 100;
const Z1 = M.Kh + M.On;                    // tokanın ön yüzü (CAD)
const YC = H / 2;                          // toka alt kenarı zeminde
const POD = THREE.MathUtils.degToRad(-50); // izometrik kameraya bakar
const BOSLUK = 0.25;                       // bant ile kanal tabanı arası

// ---------------- bant yolu ----------------
// Bilek tarafı çizgisi: çevresi bant çevresi olan daire, toka altında düzleşir (D biçimi, köşeler yumuşatılmış).
const A = M.L / 2 + 4;                     // düz bölümün yarı boyu
function cevre(R) {
  const th = Math.asin(Math.min(1, A / R));
  return 2 * A + R * (TAU - 2 * th);
}
let R = 20;
for (let i = 0; i < 60; i++) R += (SPEC.bant.cevre - cevre(R)) / TAU;
const D = R * Math.cos(Math.asin(A / R));  // düz bölümün eksene uzaklığı
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function yaricap(phi) {
  const c = Math.max(0.02, Math.cos(sar(phi - POD)));
  const k = 1.6;
  return -k * Math.log(Math.exp(-R / k) + Math.exp(-(D / c) / k));
}
const Z_KANAL = D + 0.02 - BOSLUK;          // kanal tabanının eksene uzaklığı (bant iç yüzü D)

function bantGeometrisi() {
  const N = 720;
  const K = 28;
  const { Wb: W, Tb: T } = M;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const phi = (TAU * i) / N;
    const r = yaricap(phi);
    pts.push(new THREE.Vector2(Math.sin(phi) * r, Math.cos(phi) * r));
  }
  const kesit = [];
  const rc = 0.6;
  const kose = (cy, ct, a0) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (Math.PI / 2) * (k / 6);
      kesit.push([cy + rc * Math.cos(a), ct + rc * Math.sin(a)]);
    }
  };
  kose(W / 2 - rc, rc, -Math.PI / 2);
  kose(W / 2 - rc, T - rc, 0);
  kose(-W / 2 + rc, T - rc, Math.PI / 2);
  kose(-W / 2 + rc, rc, Math.PI);
  const n = kesit.length;
  const pos = new Float32Array(N * n * 3);
  const uv = new Float32Array(N * n * 2);
  let s = 0;
  let k = 0;
  let q = 0;
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const a = pts[(i + N - 1) % N];
    const b = pts[(i + 1) % N];
    const t = b.clone().sub(a).normalize();
    let nrm = new THREE.Vector2(t.y, -t.x);
    if (nrm.dot(p) < 0) nrm = nrm.negate();
    if (i > 0) s += p.distanceTo(pts[i - 1]);
    kesit.forEach(([y, tt], j) => {
      pos[k++] = p.x + nrm.x * tt;
      pos[k++] = YC + y;
      pos[k++] = p.y + nrm.y * tt;
      uv[q++] = s / 6;
      uv[q++] = j / (n - 1);
    });
  }
  const index = [];
  for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j1;
      const c = i1 * n + j;
      const d = i1 * n + j1;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function dokumaDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#141518';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    g.fillStyle = y % 8 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.35)';
    g.fillRect(0, y, 128, 2);
  }
  for (let x = 0; x < 128; x += 4) {
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fillRect(x, 0, 1, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Baskılı plaka yüzü: siyah zemin, solda marka, sağda QR alanı (koyu modül, açık zemin)
function plakaDokusu() {
  const px = 40;
  const c = document.createElement('canvas');
  c.width = PL.boy * px;
  c.height = PL.en * px;
  const g = c.getContext('2d');
  g.fillStyle = '#101113';
  g.fillRect(0, 0, c.width, c.height);
  const qr = qrDokusu(SPEC.qr).image;
  const q = PL.qrAlan * px;
  g.drawImage(qr, c.width - q, 0, q, q);
  const alan = c.width - q;
  g.fillStyle = '#f2eee5';
  g.font = `600 ${Math.round(7.2 * px)}px Inter, "Segoe UI", Roboto, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(PL.marka, alan / 2, c.height / 2 - 0.4 * px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------- teknik katman ----------------
const yerel = (x, y, z) => {
  const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), POD);
  return [v.x, v.y, v.z];
};
const P = [0, YC, 0];
const QR_X = PL.boy / 2 - PL.qrAlan / 2;

function annotate(a) {
  const on = Z_KANAL + Z1;
  a.callout(yerel(-M.L / 2 + 2, YC + H / 2 - 2, on - 0.5), ek(-34, 40, 0, P),
    `Toka ${metin(M.L)} × ${metin(H)} × ${metin(Z1 + M.Ar)}`, `${SPEC.malzeme}`);
  a.callout(yerel(-4, YC - PL.en / 2 + 2, on), ek(-26, -34, 16, P),
    `Baskılı plaka ${metin(PL.boy)} × ${metin(PL.en)}`, `marka + QR ${metin(PL.qrAlan)} × ${metin(PL.qrAlan)} · gömme, aynı hizada`);
  a.callout(yerel(QR_X, YC + 4, on), ek(34, 38, 0, P),
    `NFC Ø${metin(NFC.cap)} QR altında`, 'plastik toka: ferrit gerekmez');
  a.callout(yerel(M.L / 2, YC - M.Kw / 2 + 2, Z_KANAL + M.Kh / 2), ek(34, -32, 6, P),
    `Kanal ${metin(M.Kw)} × ${metin(M.Kh)}`, `${metin(M.Wb)} mm elastik bant · dikiş tokanın altında`);
}

function annotateAyrik(a) {
  const on = Z_KANAL + Z1;
  const pl = yerel(-PL.boy / 2, YC + AY.toka + AY.plaka + PL.en / 2, on + 4);
  a.callout(pl, ek(-26, 10, 0, pl), '3 · Baskılı plaka', `${PL.malzeme}`);
  const nf = yerel(QR_X + NFC.cap / 2, YC + AY.toka + AY.nfc, on + 2);
  a.callout(nf, ek(28, 4, 0, nf), '2 · NFC inlay', `Ø${metin(NFC.cap)} · ${NFC.cip}`);
  const tk = yerel(M.L / 2, YC + AY.toka - H / 2 + 2, on - 2);
  a.callout(tk, ek(26, -14, 0, tk), '1 · PA12 toka', 'endüstriyel 3D baskı, mat siyah');
}

// ---------------- kurulum ----------------
export function kur() {
  const pa12 = new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0, roughness: 0.86 });
  const bantMat = new THREE.MeshStandardMaterial({ map: dokumaDokusu(), metalness: 0, roughness: 0.95 });
  const plakaKenar = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0, roughness: 0.3 });
  const plakaYuz = new THREE.MeshStandardMaterial({ map: plakaDokusu(), metalness: 0, roughness: 0.22 });
  const nfcMat = new THREE.MeshStandardMaterial({ map: nfcDokusu(), metalness: 0.2, roughness: 0.5, transparent: true });

  const bant = new THREE.Group();
  bant.add(new THREE.Mesh(bantGeometrisi(), bantMat));

  // Toka: CAD ağı, yerel çerçevede kanal tabanı Z_KANAL'da
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geo.setIndex(mesh.triangles);
  geo.translate(0, YC, Z_KANAL);
  const tokaGovde = new THREE.Mesh(geo, pa12);

  const plaka = new THREE.Group();
  plaka.add(new THREE.Mesh(new THREE.BoxGeometry(PL.boy, PL.en, PL.kalinlik), plakaKenar));
  plaka.add(new THREE.Mesh(new THREE.PlaneGeometry(PL.boy - 0.2, PL.en - 0.2).translate(0, 0, PL.kalinlik / 2 + 0.01), plakaYuz));
  const zPlaka = Z_KANAL + Z1 - PL.kalinlik / 2 - 0.02;
  plaka.position.set(0, YC, zPlaka);

  const nfc = new THREE.Group();
  nfc.add(new THREE.Mesh(new THREE.CylinderGeometry(NFC.cap / 2, NFC.cap / 2, NFC.kalinlik, 64).rotateX(Math.PI / 2), nfcMat));
  nfc.add(new THREE.Mesh(new THREE.CircleGeometry(NFC.cap / 2, 64).translate(0, 0, NFC.kalinlik / 2 + 0.01), nfcMat));
  const zNfc = Z_KANAL + Z1 - CEP.derinlik + NFC.kalinlik / 2;
  nfc.position.set(QR_X, YC, zNfc);

  const toka = new THREE.Group();
  toka.rotation.y = POD;
  toka.add(tokaGovde, plaka, nfc);

  const parts = { bant, toka };
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} 3D baskı · ${metin(M.L)} × ${metin(H)} × ${metin(Z1 + M.Ar)} mm · baskılı plaka + NFC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' numune adayı'}`,
    rev: SPEC.rev,
    paket: 'uretim/toka/',
    cizim: {
      src: `uretim/toka/${SPEC.kod}-rev${SPEC.rev}-teknik-resim.svg`,
      alt: 'PA12 bileklik tokası teknik resmi: önden görünüş, A–A kesit, üstten görünüş, baskılı plaka',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (e) => {
      const a = smooth(0, 0.5, e);
      const b = smooth(0.4, 1, e);
      tokaGovde.position.y = AY.toka * a;
      plaka.position.set(0, YC + AY.toka * a + AY.plaka * b, zPlaka + 4 * b);
      nfc.position.set(QR_X, YC + AY.toka * a + AY.nfc * b, zNfc + 2 * b);
    },
    occluder: { r: R, y0: YC - M.Wb / 2, y1: YC + M.Wb / 2 },
    golge: 110,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 18, h: tech ? 110 : 90, w: tech ? 150 : 92 }
      : { y: YC + (tech ? 6 : 0), h: tech ? 110 : 62, w: tech ? 150 : 76 }),
    annotate,
    annotateAyrik,
  };
}
