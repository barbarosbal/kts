import * as THREE from 'three';
import { metin, smooth } from 'kts/ortak';
import { qrDokusu, nfcDokusu, ek } from 'kts/bileklik-ortak';

// PA12 bileklik tokası Rev B: STEP ile aynı OpenCascade katısının ağı (tools/toka.mjs) + elastik bant, esnek etiket, NFC.
// CAD ekseni: X bant boyunca, Y bant eni, Z dışa; kavis merkezi (0, 0, -Rb), bilek yüzü tepesi Z = 0.
// Sahnede toka, rotation.y = POD olan çerçevede durur (yerel +X teğet, +Y yukarı, +Z dışa); bileklik ekseni +Y.
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
const yuvarla = (n) => Math.round(n * 100) / 100;
const H = yuvarla(M.Kw + 2 * M.Yn);
const TOP = yuvarla(M.Ar + M.Kh + M.On);
const RF = M.Rb + TOP;                     // ön yüz yarıçapı (kavis merkezinden)
const YC = H / 2;                          // toka alt kenarı zeminde
const POD = THREE.MathUtils.degToRad(-50); // izometrik kameraya bakar
const BOSLUK = 0.25;                       // bant ile kanal tabanı arası

// ---------------- bant yolu ----------------
// Bilek tarafı çizgisi: arkada daire (bant çevresi), önde tokanın kavsini izleyen geniş yay; geçiş yumuşatılmış.
const R = SPEC.bant.cevre / TAU;
const RHO = M.Rb + M.Ar + BOSLUK;          // bandın toka içindeki yarıçapı (toka kavis merkezinden)
const A0 = M.L / 2 + 3;
const ZA = Math.sqrt(R * R - A0 * A0) + RHO - Math.sqrt(RHO * RHO - A0 * A0);
const ZM = ZA - RHO;                       // toka kavis merkezinin eksene uzaklığı (yerel Z)
const ZB = ZM + M.Rb;                      // tokanın bilek yüzü tepesi (yerel Z)
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function yaricap(phi) {
  const d = sar(phi - POD);
  const uc = Math.cos(d) * ZM;
  const t = uc + Math.sqrt(Math.max(0, uc * uc - ZM * ZM + RHO * RHO));
  const k = 1.2;
  return -k * Math.log(Math.exp(-R / k) + Math.exp(-t / k));
}

function bantGeometrisi() {
  const N = 720;
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

// Etiket yüzü: siyah zemin, solda marka, sağda QR alanı (koyu modül, açık zemin)
function etiketDokusu() {
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

// Toka kavsine oturan silindir yaması (yerel çerçevede kavis merkezi (0, YC, ZM)); merkez yay uzunluğu x0
const yama = (r, boy, en, x0 = 0) => new THREE.CylinderGeometry(r, r, en, 64, 1, true, (x0 - boy / 2) / r, boy / r)
  .translate(0, YC, ZM);

// ---------------- teknik katman ----------------
const yerel = (x, y, z) => {
  const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), POD);
  return [v.x, v.y, v.z];
};
const P = [0, YC, 0];
const QR_X = PL.boy / 2 - PL.qrAlan / 2;
const ON = ZB + TOP;

function annotate(a) {
  a.callout(yerel(-M.L / 2 + 3, YC + H / 2 - 2, ON - 1.5), ek(-34, 40, 0, P),
    `Toka ${metin(M.L)} × ${metin(H)} × ${metin(TOP)}`, `${SPEC.malzemeKisa} · bilek yüzü R${metin(M.Rb)}`);
  a.callout(yerel(-4, YC - PL.en / 2 + 2, ON), ek(-26, -34, 16, P),
    `Etiket ${metin(PL.boy)} × ${metin(PL.en)}`, `marka + QR ${metin(PL.qrAlan)} × ${metin(PL.qrAlan)} · gömme, aynı hizada`);
  a.callout(yerel(QR_X, YC + 4, ON), ek(34, 38, 0, P),
    `NFC Ø${metin(NFC.cap)} QR altında`, 'plastik toka: ferrit gerekmez');
  a.callout(yerel(M.L / 2, YC - M.Kw / 2 + 2, ZB + M.Ar + M.Kh / 2), ek(34, -32, 6, P),
    `Kapalı kanal ${metin(M.Kw)} × ${metin(M.Kh)}`, `arka duvar ${metin(M.Ar)} · ${metin(M.Wb)} mm bant, dikiş içeride`);
}

function annotateAyrik(a) {
  const pl = yerel(-PL.boy / 2, YC + AY.toka + AY.plaka + PL.en / 2, ON + 4);
  a.callout(pl, ek(-26, 10, 0, pl), '3 · Esnek etiket', `${PL.malzeme}`);
  const nf = yerel(QR_X + NFC.cap / 2, YC + AY.toka + AY.nfc, ON + 2);
  a.callout(nf, ek(28, 4, 0, nf), '2 · NFC inlay', `Ø${metin(NFC.cap)} · ${NFC.cip}`);
  const tk = yerel(M.L / 2, YC + AY.toka - H / 2 + 2, ON - 2);
  a.callout(tk, ek(26, -14, 0, tk), '1 · PA12 toka', 'endüstriyel 3D baskı, arkası kapalı');
}

// ---------------- kurulum ----------------
export function kur() {
  const pa12 = new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0, roughness: 0.86 });
  const bantMat = new THREE.MeshStandardMaterial({ map: dokumaDokusu(), metalness: 0, roughness: 0.95 });
  const etiketMat = new THREE.MeshStandardMaterial({ map: etiketDokusu(), metalness: 0, roughness: 0.3, side: THREE.DoubleSide });
  const nfcMat = new THREE.MeshStandardMaterial({ map: nfcDokusu(), metalness: 0.2, roughness: 0.5, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });

  const bant = new THREE.Group();
  bant.add(new THREE.Mesh(bantGeometrisi(), bantMat));

  // Toka: CAD ağı, bilek yüzü tepesi yerel ZB'de
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geo.setIndex(mesh.triangles);
  geo.translate(0, YC, ZB);
  const tokaGovde = new THREE.Mesh(geo, pa12);

  // Etiket ve NFC: cebe oturan kavisli yamalar (etiket üstü ön yüzle aynı hizada)
  const etiket = new THREE.Mesh(yama(RF - 0.04, PL.boy, PL.en), etiketMat);
  const rNfc = RF - CEP.derinlik + NFC.kalinlik;
  const nfc = new THREE.Mesh(yama(rNfc, NFC.cap, NFC.cap, QR_X * (rNfc / RF)), nfcMat);

  const toka = new THREE.Group();
  toka.rotation.y = POD;
  toka.add(tokaGovde, etiket, nfc);

  const parts = { bant, toka };
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} 3D baskı · ${metin(M.L)} × ${metin(H)} × ${metin(TOP)} mm · arkası kapalı, R${metin(M.Rb)} kavis · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' numune adayı'}`,
    rev: SPEC.rev,
    paket: 'uretim/toka/',
    cizim: {
      src: `uretim/toka/${SPEC.kod}-rev${SPEC.rev}-teknik-resim.svg`,
      alt: 'PA12 bileklik tokası teknik resmi: önden, yandan (kavis), A–A kesit, etiket',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (e) => {
      const a = smooth(0, 0.5, e);
      const b = smooth(0.4, 1, e);
      tokaGovde.position.y = AY.toka * a;
      etiket.position.set(0, AY.toka * a + AY.plaka * b, 4 * b);
      nfc.position.set(0, AY.toka * a + AY.nfc * b, 2 * b);
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
