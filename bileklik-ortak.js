import * as THREE from 'three';
import { silindirMarka, markaEni } from 'kts/ortak';

// İki bilekliğin (kapalı halka ve ayarlı) ortak ön yüzü: kimlik modülü (gömme QR plakası + NFC inlay),
// gömme tipay logosu ve dokun işareti. Açı φ: 0 = +Z, π/2 = +X; bileklik ekseni +Y.

const TAU = Math.PI * 2;
export const KAMERA = THREE.MathUtils.degToRad(-50);   // app.js izometrik görünüm açısı
const ustte = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 };

export const silikonMat = () => new THREE.MeshStandardMaterial({ color: 0x313338, metalness: 0, roughness: 0.82 });
export const nokta = (phi, r, y) => [Math.sin(phi) * r, y, Math.cos(phi) * r];
export const radyal = (phi) => new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));

// İzometrik kameraya göre etiket yerleşimi: sağ (k), yukarı (dy), kameraya doğru (dc)
export const ek = (k, dy, dc = 0, p = [0, 0, 0]) => [
  p[0] + Math.cos(KAMERA) * k + Math.sin(KAMERA) * dc,
  p[1] + dy,
  p[2] - Math.sin(KAMERA) * k + Math.cos(KAMERA) * dc,
];

// ---------------- dokular ----------------
// Örnek QR deseni: gerçek bir adrese çözülmez (her ürünün kodu üretimde tekil basılır). Koyu modül, açık zemin.
function qrDokusu(QR) {
  const n = QR.modul;
  const N = n + 2 * QR.sessiz;
  const px = 16;
  const c = document.createElement('canvas');
  c.width = c.height = N * px;
  const g = c.getContext('2d');
  g.fillStyle = '#eeebe4';
  g.fillRect(0, 0, c.width, c.height);
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
  c.width = Math.ceil(m.actualBoundingBoxRight + m.actualBoundingBoxLeft) + 4;
  c.height = Math.ceil(asc + m.actualBoundingBoxDescent) + 4;
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
  [95, 150, 205, 260].forEach((r) => {
    g.beginPath();
    g.arc(-40, H / 2, r, -a, a);
    g.stroke();
  });
  return c;
}

// ---------------- ön yüz ----------------
// POD: modül açısı, R: kayışın dış yarıçapı (modül bölgesinde), YC: kayış orta yüksekliği.
// Döner: halkaya eklenecek izler (cep ağzı, logo, işaret), ayrı parçalar (plaka, nfc) ve açılar.
export function onYuz(SPEC, { POD, R, YC }) {
  const { modul: MOD, qr: QR, yerlesim: YER } = SPEC;
  const Q = SPEC.olculer.Q.deger;
  const CEP = MOD.cep.en;
  const pk = MOD.plaka.kalinlik;
  const R_NFC = R - pk - 0.05 - MOD.nfc.kalinlik / 2;

  const cepMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0, roughness: 0.9, ...ustte });
  const plakaKenar = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0, roughness: 0.35, side: THREE.DoubleSide });
  const plakaYuz = new THREE.MeshStandardMaterial({ map: qrDokusu(QR), metalness: 0, roughness: 0.2, ...ustte, polygonOffsetUnits: -8 });
  const nfcMat = new THREE.MeshStandardMaterial({ map: nfcDokusu(), metalness: 0.2, roughness: 0.5, transparent: true });

  const izler = [];
  // Cep ağzı: plaka çıkınca görünür
  izler.push(new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.004, R + 0.004, CEP, 48, 1, true, POD - CEP / R / 2, CEP / R).translate(0, YC, 0),
    cepMat,
  ));
  // Gömme logo ve dokun işareti: yüzeyde koyu, hafif parlak iz
  const iz = { renk: 0x08090a, metalness: 0, roughness: 0.6 };
  const logo = logoMaskesi(SPEC.logo.metin);
  const hL = SPEC.logo.yukseklik;
  const LOGO_PHI = POD - (Q / 2 + YER.logoBosluk + markaEni(logo, hL) / 2) / R;
  izler.push(silindirMarka(logo, { r: R, y0: YC - hL / 2, h: hL, aci: LOGO_PHI, ...iz }));
  const isaret = nfcIsareti();
  const hN = SPEC.nfcIsareti.yukseklik;
  const NFC_PHI = POD + (Q / 2 + YER.nfcBosluk + markaEni(isaret, hN) / 2) / R;
  izler.push(silindirMarka(isaret, { r: R, y0: YC - hN / 2, h: hN, aci: NFC_PHI, ...iz }));

  // Plaka: kayış eğrisine uyan ince kabuk; üst yüzü kayış yüzüyle aynı hizada
  const qa = Q / R;
  const plaka = new THREE.Group();
  const kabuk = [[R - pk, YC - Q / 2], [R, YC - Q / 2], [R, YC + Q / 2], [R - pk, YC + Q / 2], [R - pk, YC - Q / 2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  plaka.add(new THREE.Mesh(new THREE.LatheGeometry(kabuk, 32, POD - qa / 2, qa), plakaKenar));
  plaka.add(new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.012, R + 0.012, Q, 48, 1, true, POD - qa / 2, qa).translate(0, YC, 0),
    plakaYuz,
  ));

  // NFC inlay: esnek, cep tabanında (düz disk olarak gösterilir; kenarları plakanın altında kalır)
  const d = MOD.nfc.cap;
  const inlay = new THREE.Group();
  inlay.add(new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, MOD.nfc.kalinlik, 64).rotateX(Math.PI / 2), nfcMat));
  inlay.add(new THREE.Mesh(new THREE.CircleGeometry(d / 2, 64).translate(0, 0, MOD.nfc.kalinlik / 2 + 0.01), nfcMat));
  inlay.position.set(0, YC, R_NFC - 0.4);
  const pivot = new THREE.Group();
  pivot.rotation.y = POD;
  pivot.add(inlay);
  const nfc = new THREE.Group();
  nfc.add(pivot);

  const yon = radyal(POD);
  const AY = SPEC.ayrik;
  const ayrikla = (e, smooth) => {
    const a = smooth(0, 0.65, e);
    const b = smooth(0.35, 1, e);
    plaka.position.copy(yon).multiplyScalar(AY.plaka * a).setY(AY.plakaY * a);
    nfc.position.copy(yon).multiplyScalar(AY.nfc * b).setY(AY.nfcY * b);
  };

  return { izler, plaka, nfc, ayrikla, LOGO_PHI, NFC_PHI, R_NFC };
}
