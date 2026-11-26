import * as THREE from 'three';
import { metin, smooth, silindirMarka, markaEni } from 'kts/ortak';

// Tüm ölçüler bileklik-olculer.json'dan gelir (mm). Bileklik ekseni +Y; kapalı halka XZ düzleminde.
// Açı φ: 0 = +Z, π/2 = +X (dışarıdan bakınca sağa doğru artar).
// Gövde (silikon halka) ile kimlik modülü (NFC inlay + QR plakası) ayrı parçalardır; modül halkanın
// cebine gömülür, üst yüzü halka yüzüyle aynı hizadadır (çıkıntı yok).
export const SPEC = await fetch(`bileklik-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { modul: MOD, qr: QR, ayrik: AY, yerlesim: YER } = SPEC;

const TAU = Math.PI * 2;
const BOY = SPEC.boylar.liste.find((b) => b.ad === SPEC.boylar.gosterilen);
const R0 = BOY.cevre / TAU;               // iç yarıçap
const T = O.T;
const W = O.W;
const Q = O.Q;
const YC = W / 2;                          // halka orta düzlemi, alt kenar zeminde
const R_DIS = R0 + T;
const POD = THREE.MathUtils.degToRad(YER.modulAci);
const CEP = MOD.cep.en;
const CEP_ACI = CEP / R_DIS;
const Q_ACI = Q / R_DIS;
const R_NFC = R_DIS - MOD.plaka.kalinlik - 0.05 - MOD.nfc.kalinlik / 2;

const nokta = (phi, r, y = YC) => [Math.sin(phi) * r, y, Math.cos(phi) * r];
const radyal = (phi) => new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
const ustte = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 };

// Yuvarlatılmış dikdörtgen kesit (r, y), saat yönünün tersi; torna ile döndürülür
function kesit(r0, r1, y0, y1, c, n = 8) {
  const pts = [];
  const kose = (cr, cy, a0) => {
    for (let k = 0; k <= n; k++) {
      const a = a0 + (Math.PI / 2) * (k / n);
      pts.push(new THREE.Vector2(cr + c * Math.cos(a), cy + c * Math.sin(a)));
    }
  };
  kose(r0 + c, y0 + c, Math.PI);
  kose(r1 - c, y0 + c, -Math.PI / 2);
  kose(r1 - c, y1 - c, 0);
  kose(r0 + c, y1 - c, Math.PI / 2);
  pts.push(pts[0].clone());
  return pts;
}

// ---------------- dokular ----------------
function qrDokusu() {
  const n = QR.modul;
  const N = n + 2 * QR.sessiz;
  const px = 16;
  const c = document.createElement('canvas');
  c.width = c.height = N * px;
  const g = c.getContext('2d');
  g.fillStyle = '#eeebe4';
  g.fillRect(0, 0, c.width, c.height);
  // Örnek desen: gerçek bir adrese çözülmez (her ürünün kodu üretimde tekil basılır)
  let seed = 0x2f6e2b1;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const bulucu = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let q = -1; q <= 7; q++) {
        const rr = r0 + r;
        const cc = c0 + q;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const icte = r >= 0 && r <= 6 && q >= 0 && q <= 6;
        m[rr][cc] = icte && (r === 0 || r === 6 || q === 0 || q === 6 || (r >= 2 && r <= 4 && q >= 2 && q <= 4));
      }
    }
  };
  bulucu(0, 0);
  bulucu(0, n - 7);
  bulucu(n - 7, 0);
  const hz = n - 7;
  for (let r = -2; r <= 2; r++) for (let q = -2; q <= 2; q++) m[hz + r][hz + q] = Math.max(Math.abs(r), Math.abs(q)) !== 1;
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }
  g.fillStyle = '#121315';
  for (let r = 0; r < n; r++) {
    for (let q = 0; q < n; q++) {
      if (m[r][q] === null) m[r][q] = rnd() < 0.48;
      if (m[r][q]) g.fillRect((q + QR.sessiz) * px, (r + QR.sessiz) * px, px, px);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function nfcDokusu() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#dfe3e8';
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, TAU);
  g.fill();
  g.strokeStyle = '#b9733a';
  g.lineWidth = 8;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(S / 2, S / 2, S * (0.45 - i * 0.026), 0, TAU);
    g.stroke();
  }
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.07);
  g.lineTo(S * 0.5, S * 0.42);
  g.stroke();
  g.fillStyle = '#1a1b1e';
  g.fillRect(S * 0.45, S * 0.42, S * 0.1, S * 0.07);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Logo yazısı: alt uzantılar dahil sıkı kırpılmış beyaz maske
function logoMaskesi(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 260px Inter, "Segoe UI", Roboto, Arial, sans-serif';
  g.font = font;
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  c.width = Math.ceil(m.actualBoundingBoxRight + m.actualBoundingBoxLeft) + 4;
  c.height = Math.ceil(asc + desc) + 4;
  g.font = font;
  g.fillStyle = '#fff';
  g.fillText(text, m.actualBoundingBoxLeft + 2, asc + 2);
  return c;
}

// Dokun işareti: ortak merkezli dört yay, sağa açılır
function nfcIsareti() {
  const H = 400;
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = H;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 24;
  const a = 0.72;
  const cx = -40;
  [95, 150, 205, 260].forEach((r) => {
    g.beginPath();
    g.arc(cx, H / 2, r, -a, a);
    g.stroke();
  });
  return c;
}

// ---------------- teknik katman ----------------
// İzometrik kameraya göre yerleşim: sağ (k), yukarı (dy), kameraya doğru (dc). Modül bu kameraya bakar.
const KAMERA = THREE.MathUtils.degToRad(-50);   // app.js izometrik görünüm açısı
const ek = (k, dy, dc = 0, p = [0, YC, 0]) => [
  p[0] + Math.cos(KAMERA) * k + Math.sin(KAMERA) * dc,
  p[1] + dy,
  p[2] - Math.sin(KAMERA) * k + Math.cos(KAMERA) * dc,
];

let LOGO_PHI = POD;
let NFC_PHI = POD;
const boyMetni = SPEC.boylar.liste.map((b) => `${b.ad} ${b.cevre}`).join(' · ');

function annotate(a) {
  const x0 = R_DIS + 9;
  a.ext(0, R_DIS + 1, x0 + 3);
  a.ext(W, R_DIS + 1, x0 + 3);
  a.dim(x0, 0, W, `W = ${metin(W)}`);

  const yd = W + 3;
  a.line([[-R0, yd, 0], [R0, yd, 0]]);
  a.arrow([-R0, yd, 0], [R0, yd, 0]);
  a.arrow([R0, yd, 0], [-R0, yd, 0]);
  a.label(`${BOY.ad} · iç çevre ${BOY.cevre}`, [0, yd, 0], 'dimtag');

  a.callout(nokta(POD, R_DIS, YC - Q / 2 + 1), ek(-24, -34, 20),
    `Kimlik modülü ${metin(Q)} × ${metin(Q)}`, 'gömme, yüzeyle aynı hizada · NFC + QR');
  a.callout(nokta(LOGO_PHI, R_DIS, YC + 5), ek(-34, 42, -6),
    'tipay logosu', `kalıpta gömme · h ${metin(SPEC.logo.yukseklik)}`);
  a.callout(nokta(NFC_PHI, R_DIS, YC + 3), ek(32, 38),
    'Dokun işareti', 'NFC inlay plakanın altında');
  a.callout(nokta(POD + 1.6, R_DIS, 2), ek(30, -34, 10),
    `Boylar ${boyMetni}`, `kapalı halka · T ${metin(T)} · ${SPEC.malzemeKisa}`);
}

function annotateAyrik(a) {
  const sag = (p, k, dy = 0) => [p[0] + Math.cos(KAMERA) * k, p[1] + dy, p[2] - Math.sin(KAMERA) * k];
  const pl = nokta(POD, R_DIS + AY.plaka, YC + AY.plakaY + Q / 2 - 2);
  a.callout(sag(pl, -Q / 2), sag(pl, -30, 12), '3 · QR plakası', `${MOD.plaka.malzeme} · tekil QR`);
  const nf = nokta(POD, R_NFC + AY.nfc, YC + AY.nfcY);
  a.callout(sag(nf, MOD.nfc.cap / 2), sag(nf, 30, 4), '2 · NFC inlay', `Ø${metin(MOD.nfc.cap)} · ${MOD.nfc.cip}`);
  const ky = nokta(POD + 1.1, R_DIS, 2);
  a.callout(ky, sag(ky, 24, -18), '1 · Silikon halka', `${SPEC.malzemeKisa} · cep ${metin(CEP)} × ${metin(MOD.cep.derinlik)}`);
}

// ---------------- kurulum ----------------
export function kur() {
  const silikon = new THREE.MeshStandardMaterial({ color: 0x313338, metalness: 0, roughness: 0.82 });
  const cepMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0, roughness: 0.9, ...ustte });
  const plakaKenar = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0, roughness: 0.35, side: THREE.DoubleSide });
  const plakaYuz = new THREE.MeshStandardMaterial({ map: qrDokusu(), metalness: 0, roughness: 0.2, ...ustte, polygonOffsetUnits: -8 });
  const nfcMat = new THREE.MeshStandardMaterial({ map: nfcDokusu(), metalness: 0.2, roughness: 0.5, transparent: true });

  const halka = new THREE.Group();
  halka.add(new THREE.Mesh(new THREE.LatheGeometry(kesit(R0, R_DIS, 0, W, O.c), 256), silikon));

  // Cep ağzı: plaka çıkınca görünür; birleşik halde plakanın altında kalır
  const cep = new THREE.CylinderGeometry(R_DIS + 0.004, R_DIS + 0.004, CEP, 48, 1, true, POD - CEP_ACI / 2, CEP_ACI)
    .translate(0, YC, 0);
  halka.add(new THREE.Mesh(cep, cepMat));

  // Gömme logo ve dokun işareti: yüzeyde koyu, hafif parlak iz
  const iz = { renk: 0x08090a, metalness: 0, roughness: 0.6 };
  const logo = logoMaskesi(SPEC.logo.metin);
  const hL = SPEC.logo.yukseklik;
  LOGO_PHI = POD - (Q / 2 + YER.logoBosluk + markaEni(logo, hL) / 2) / R_DIS;
  halka.add(silindirMarka(logo, { r: R_DIS, y0: YC - hL / 2, h: hL, aci: LOGO_PHI, ...iz }));
  const isaret = nfcIsareti();
  const hN = SPEC.nfcIsareti.yukseklik;
  NFC_PHI = POD + (Q / 2 + YER.nfcBosluk + markaEni(isaret, hN) / 2) / R_DIS;
  halka.add(silindirMarka(isaret, { r: R_DIS, y0: YC - hN / 2, h: hN, aci: NFC_PHI, ...iz }));

  // Plaka: halka eğrisine uyan ince kabuk; üst yüzü halka yüzüyle aynı hizada
  const plaka = new THREE.Group();
  const pk = MOD.plaka.kalinlik;
  const kabuk = [
    [R_DIS - pk, YC - Q / 2], [R_DIS, YC - Q / 2], [R_DIS, YC + Q / 2], [R_DIS - pk, YC + Q / 2], [R_DIS - pk, YC - Q / 2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  plaka.add(new THREE.Mesh(new THREE.LatheGeometry(kabuk, 32, POD - Q_ACI / 2, Q_ACI), plakaKenar));
  const yuz = new THREE.CylinderGeometry(R_DIS + 0.012, R_DIS + 0.012, Q, 48, 1, true, POD - Q_ACI / 2, Q_ACI).translate(0, YC, 0);
  plaka.add(new THREE.Mesh(yuz, plakaYuz));

  // NFC inlay: esnek, cep tabanında (düz disk olarak gösterilir; kenarları plakanın altında kalır)
  const nfc = new THREE.Group();
  const d = MOD.nfc.cap;
  const inlay = new THREE.Group();
  inlay.add(new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, MOD.nfc.kalinlik, 64).rotateX(Math.PI / 2), nfcMat));
  inlay.add(new THREE.Mesh(new THREE.CircleGeometry(d / 2, 64).translate(0, 0, MOD.nfc.kalinlik / 2 + 0.01), nfcMat));
  inlay.position.set(0, YC, R_NFC - 0.4);
  const nfcPivot = new THREE.Group();
  nfcPivot.rotation.y = POD;
  nfcPivot.add(inlay);
  nfc.add(nfcPivot);

  const yon = radyal(POD);
  const parts = { halka, nfc, plaka };
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} kapalı halka · boy ${SPEC.boylar.liste.map((b) => b.ad).join(' / ')} · gömme NFC + QR · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    cizim: {
      src: 'bileklik-taslak.svg',
      alt: 'tipay bileklik teknik çizimi: açılmış halka, kimlik modülü kesiti, QR plakası, boylar, parça listesi',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (t) => {
      const a = smooth(0, 0.65, t);
      const b = smooth(0.35, 1, t);
      plaka.position.copy(yon).multiplyScalar(AY.plaka * a).setY(AY.plakaY * a);
      nfc.position.copy(yon).multiplyScalar(AY.nfc * b).setY(AY.nfcY * b);
    },
    occluder: { r: R_DIS, y0: 0, y1: W },
    golge: 120,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 10, h: tech ? 104 : 84, w: tech ? 150 : 96 }
      : { y: YC + (tech ? 8 : 0), h: tech ? 120 : 64, w: tech ? 150 : 80 }),
    annotate,
    annotateAyrik,
  };
}
