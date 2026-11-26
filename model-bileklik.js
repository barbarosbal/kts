import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { metin, smooth, silindirMarka } from 'kts/ortak';

// Tüm ölçüler bileklik-olculer.json'dan gelir (mm). Bileklik ekseni +Y; kayış XZ düzleminde sarılır.
// Açı φ: 0 = +Z, π/2 = +X. Yerel çerçeve: rotation.y = φ olan nesnede +Z radyal dışa, +X artan φ yönü.
// Gövde (silikon kayış) ile kimlik modülü (NFC inlay + QR plakası) ayrı parçalardır.
export const SPEC = await fetch(`bileklik-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { pim: PIM, tutucu: TUT, modul: MOD, qr: QR, ayrik: AY } = SPEC;

const TAU = Math.PI * 2;
const R0 = O.R;                            // iç yarıçap, takılı hal
const T = O.T;
const W = O.W;
const WP = O.Wp;
const YC = WP / 2;                         // kayış orta düzlemi (modül alt kenarı zemine değer)
const KAT = T + 0.15;                      // kuyruk, baş ucunun üstünden bu kadar kalkar
const POD = THREE.MathUtils.degToRad(SPEC.yerlesim.modulAci);
const LOGO_PHI = POD + THREE.MathUtils.degToRad(SPEC.yerlesim.logoAci);
const R_DIS = R0 + T;                      // tek kat dış yüzey
const R_UST = R_DIS + O.h;                 // modül yuvası üst yüzü
const R_ZEMIN = R_UST - MOD.yuva.derinlik; // yuva tabanı
const POD_YARI = WP / 2 / R_DIS;           // yuvanın açısal yarı eni
const DS = 0.4;

const nokta = (phi, r, y = YC) => [Math.sin(phi) * r, y, Math.cos(phi) * r];
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------- kayış yolu ----------------
// Baş ucundan (s = 0) kuyruk ucuna (s = L) sarmal: ilk turda R0, tur kapanırken baş ucunun üstüne KAT kadar kalkar.
function yolHesapla() {
  const s = [0];
  const rel = [0];                         // baş ucuna göre açı
  const rin = [];
  const bitis = TAU + SPEC.kuyruk.uc / (R0 + T / 2);
  for (let i = 0; ; i++) {
    rin[i] = R0 + KAT * smooth(TAU - 0.32, TAU - 0.03, rel[i]);
    if (rel[i] >= bitis) break;
    rel.push(rel[i] + DS / (rin[i] + T / 2));
    s.push(s[i] + DS);
  }
  return { s, rel, rin, L: s[s.length - 1] };
}
const YOL = yolHesapla();
const L = YOL.L;

// Düzgün adımlı s dizisinde doğrusal ara değer
const ara = (arr, sx) => {
  const f = Math.min(Math.max(sx / DS, 0), arr.length - 1);
  const i = Math.min(Math.floor(f), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};
// rel → s (rel monoton artar)
function sBul(relHedef) {
  let lo = 0;
  let hi = YOL.rel.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (YOL.rel[m] < relHedef) lo = m; else hi = m;
  }
  const t = (relHedef - YOL.rel[lo]) / (YOL.rel[hi] - YOL.rel[lo]);
  return (lo + t) * DS;
}

// Pim tokanın merkezinde, modülün tam karşısında
const OFS = POD + Math.PI - ara(YOL.rel, PIM.konum);
const phiAt = (sx) => ara(YOL.rel, sx) + OFS;
const rinAt = (sx) => ara(YOL.rin, sx);
const PIM_PHI = POD + Math.PI;
const TUT_PHI = phiAt(TUT.konum);

// Delikler kuyrukta; takılı delik pimle aynı açıda
const S_TAKILI = sBul(ara(YOL.rel, PIM.konum) + TAU);
const DELIKLER = Array.from({ length: O.n }, (_, k) => S_TAKILI + (k - SPEC.ayar.takili) * O.p);
const CEVRE = TAU * R0;
const ARALIK = [CEVRE - (O.n - 1 - SPEC.ayar.takili) * O.p, CEVRE + SPEC.ayar.takili * O.p];

// Kayış eni: modül altında WP'ye yaklaşır, iki uç yarım daire
function en(sx, phi, rel) {
  let w = W;
  if (rel < TAU) {
    const d = Math.abs(sar(phi - POD));
    w += (WP - 1.5 - W) * (1 - smooth(POD_YARI, POD_YARI + 0.4, d));
  }
  const uc = Math.min(sx, L - sx);
  const r = w / 2;
  if (uc < r) w = 2 * Math.sqrt(Math.max(0, r * r - (r - uc) ** 2));
  return w;
}

// Yuvarlatılmış dikdörtgen kesit, (y, t) düzleminde saat yönünün tersi; t = 0 bilek tarafı
const KOSE_N = 6;
function kesit(w) {
  const rc = Math.max(0, Math.min(1.1, w / 2 - 1e-3, T / 2));
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
    for (const [y, t] of kesit(en(YOL.s[i], phi, YOL.rel[i]))) {
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

// ---------------- kimlik modülü yuvası ----------------
// Üstten yuvarlatılmış kare, radyal yönde uzatılır; alt taraf bilek silindiriyle, üst taraf cep kutusuyla kesilir.
function yuvaGeometrisi() {
  const pah = 0.9;
  const a = WP / 2 - pah;
  const rk = 3 - pah;
  const sh = new THREE.Shape();
  sh.moveTo(-a + rk, -a);
  sh.lineTo(a - rk, -a);
  sh.quadraticCurveTo(a, -a, a, -a + rk);
  sh.lineTo(a, a - rk);
  sh.quadraticCurveTo(a, a, a - rk, a);
  sh.lineTo(-a + rk, a);
  sh.quadraticCurveTo(-a, a, -a, a - rk);
  sh.lineTo(-a, -a + rk);
  sh.quadraticCurveTo(-a, -a, -a + rk, -a);
  const alt = R0 - 5;
  const derinlik = R_UST - alt - 2 * pah;
  const govde = new THREE.ExtrudeGeometry(sh, {
    depth: derinlik, bevelEnabled: true, bevelThickness: pah, bevelSize: pah, bevelSegments: 4, curveSegments: 10,
  }).translate(0, YC, alt + pah);

  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  const temizle = (g) => {
    g.deleteAttribute('uv');
    return g;
  };
  let b = new Brush(temizle(govde));
  const bilek = new Brush(temizle(new THREE.CylinderGeometry(R0 + 0.35, R0 + 0.35, WP + 12, 160).translate(0, YC, 0)));
  b = ev.evaluate(b, bilek, SUBTRACTION);
  const y = MOD.yuva.en;
  const cep = new Brush(temizle(new THREE.BoxGeometry(y, y, 6).translate(0, YC, R_ZEMIN + 3)));
  b = ev.evaluate(b, cep, SUBTRACTION);
  return b.geometry;
}

// ---------------- pim, tutucu, delik izleri ----------------
function pimGeometrisi() {
  const r = PIM.sapCap / 2;
  const R = PIM.basCap / 2;
  const h0 = R_DIS - 0.3;                  // baş ucunun dış yüzünden çıkar
  const h1 = R0 + KAT + T;                 // kuyruk dış yüzü
  const pts = [
    [0, h0], [r, h0], [r, h1], [R - 0.4, h1], [R, h1 + 0.35], [R - 0.15, h1 + PIM.basBoy * 0.75],
    [R * 0.55, h1 + PIM.basBoy], [0, h1 + PIM.basBoy],
  ].map(([x, yy]) => new THREE.Vector2(x, yy));
  return new THREE.LatheGeometry(pts, 48).rotateX(Math.PI / 2).translate(0, YC, 0);
}

function tutucuGeometrisi() {
  const et = TUT.et;
  const kalin = T + KAT;                   // iki kat
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

// ---------------- dokular ----------------
function qrDokusu() {
  const n = QR.modul;
  const N = n + 2 * QR.sessiz;
  const px = 14;
  const c = document.createElement('canvas');
  c.width = c.height = N * px;
  const g = c.getContext('2d');
  g.fillStyle = '#f2eee5';
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
  g.fillStyle = '#111214';
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
  g.lineWidth = 7;
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(S / 2, S / 2, S * (0.46 - i * 0.022), 0, TAU);
    g.stroke();
  }
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.06);
  g.lineTo(S * 0.5, S * 0.42);
  g.stroke();
  g.fillStyle = '#1a1b1e';
  g.fillRect(S * 0.46, S * 0.42, S * 0.08, S * 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function logoMaskesi(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 220px Inter, "Segoe UI", Roboto, Arial, sans-serif';
  g.font = font;
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  c.width = Math.ceil(m.actualBoundingBoxRight + m.actualBoundingBoxLeft) + 8;
  c.height = Math.ceil(asc + desc) + 8;
  g.font = font;
  g.fillStyle = '#fff';
  g.fillText(text, m.actualBoundingBoxLeft + 4, asc + 4);
  return c;
}

// ---------------- teknik katman ----------------
const Z_NFC = R_ZEMIN + MOD.nfc.kalinlik / 2;
const Z_PLAKA = R_ZEMIN + MOD.nfc.kalinlik + 0.05 + MOD.plaka.kalinlik / 2;

// İzometrik kameraya göre yerleşim: sağ (k), yukarı (dy), kameraya doğru (dc). Modül bu kameraya bakar.
const ek = (k, dy, dc = 0, p = [0, YC, 0]) => [
  p[0] + Math.cos(POD) * k + Math.sin(POD) * dc,
  p[1] + dy,
  p[2] - Math.sin(POD) * k + Math.cos(POD) * dc,
];

function annotate(a) {
  const x0 = R_DIS + 9;
  const y0 = YC - W / 2;
  const y1 = YC + W / 2;
  a.ext(y0, R_DIS + 1, x0 + 3);
  a.ext(y1, R_DIS + 1, x0 + 3);
  a.dim(x0, y0, y1, `W = ${metin(W)}`);

  const yd = YC + WP / 2 + 3;
  a.line([[-R0, yd, 0], [R0, yd, 0]]);
  a.arrow([-R0, yd, 0], [R0, yd, 0]);
  a.arrow([R0, yd, 0], [-R0, yd, 0]);
  a.label(`İç Ø${metin(2 * R0)} · çevre ${Math.round(CEVRE)}`, [0, yd, 0], 'dimtag');

  a.callout(nokta(POD, R_UST, YC + 6), ek(-28, -36, 20),
    `Kimlik modülü ${metin(MOD.plaka.en)} × ${metin(MOD.plaka.en)}`, "NFC inlay + QR plakası · tipay'de takılır");
  const hk = DELIKLER[SPEC.ayar.takili + 2];
  a.callout(nokta(phiAt(hk), rinAt(hk) + T + 0.5), ek(30, 56),
    `${O.n} delik · ${metin(O.p)} mm adım`, `bilek çevresi ≈ ${Math.round(ARALIK[0])}–${Math.round(ARALIK[1])} mm`);
  a.callout(nokta(PIM_PHI, R0 + KAT + T + PIM.basBoy), ek(32, 38),
    'Mantar pim', `Ø${metin(PIM.basCap)} baş · kalıpla tek parça`);
  a.callout(nokta(TUT_PHI, R0 + KAT + T + TUT.et, YC + W / 2), ek(-32, 48, -10),
    'Tutucu halka', 'kuyruk ucunu tutar');
  a.callout(nokta(LOGO_PHI, R_DIS, YC - 2), ek(30, -36, 14),
    'tipay logosu', `kalıpta gömme · h ${metin(SPEC.logo.yukseklik)}`);
}

function annotateAyrik(a) {
  // İzometrik kameranın sağ yönü (modül bu kameraya bakar)
  const sag = (p, k, dy = 0) => [p[0] + Math.cos(POD) * k, p[1] + dy, p[2] - Math.sin(POD) * k];
  const e = MOD.plaka.en;
  const pl = nokta(POD, Z_PLAKA + AY.plaka, YC + AY.plakaY + e / 2 - 3);
  a.callout(sag(pl, -e / 2), sag(pl, -34, 12), '3 · Kimlik plakası', `${MOD.plaka.malzeme} · tekil QR`);
  const nf = nokta(POD, Z_NFC + AY.nfc, YC + AY.nfcY);
  a.callout(sag(nf, MOD.nfc.cap / 2), sag(nf, 34, 4), '2 · NFC inlay', `Ø${metin(MOD.nfc.cap)} · ${MOD.nfc.cip}`);
  const ky = nokta(POD + 0.95, R_DIS, YC - W / 2 + 2);
  a.callout(ky, sag(ky, 26, -18), '1 · Silikon kayış', `${SPEC.malzemeKisa} · ayarlı, tek parça`);
}

// ---------------- kurulum ----------------
export function kur() {
  const silikon = new THREE.MeshStandardMaterial({ color: 0x1d1f23, metalness: 0, roughness: 0.8 });
  const delikMat = new THREE.MeshBasicMaterial({ color: 0x060607 });
  const plakaKenar = new THREE.MeshStandardMaterial({ color: 0x191b1f, metalness: 0, roughness: 0.3 });
  const plakaYuz = new THREE.MeshStandardMaterial({ map: qrDokusu(), metalness: 0, roughness: 0.16 });
  const nfcMat = new THREE.MeshStandardMaterial({ map: nfcDokusu(), metalness: 0.2, roughness: 0.5, transparent: true });

  const kayis = new THREE.Group();
  kayis.add(new THREE.Mesh(kayisGeometrisi(), silikon));

  const yuva = new THREE.Mesh(yuvaGeometrisi(), silikon);
  yuva.rotation.y = POD;
  kayis.add(yuva);

  const pim = new THREE.Mesh(pimGeometrisi(), silikon);
  pim.rotation.y = PIM_PHI;
  kayis.add(pim);

  const tutucu = new THREE.Mesh(tutucuGeometrisi(), silikon);
  tutucu.rotation.y = TUT_PHI;
  kayis.add(tutucu);

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

  const maske = logoMaskesi(SPEC.logo.metin);
  const h = SPEC.logo.yukseklik;
  kayis.add(silindirMarka(maske, { r: R_DIS, y0: YC - h / 2, h, aci: LOGO_PHI, renk: 0x34373e, metalness: 0, roughness: 0.42 }));

  // Kimlik modülü: yerel +Z radyal
  const modul = new THREE.Group();
  modul.rotation.y = POD;
  const nfc = new THREE.Group();
  nfc.add(new THREE.Mesh(new THREE.CylinderGeometry(MOD.nfc.cap / 2, MOD.nfc.cap / 2, MOD.nfc.kalinlik, 64).rotateX(Math.PI / 2), nfcMat));
  nfc.add(new THREE.Mesh(new THREE.CircleGeometry(MOD.nfc.cap / 2, 64).translate(0, 0, MOD.nfc.kalinlik / 2 + 0.01), nfcMat));
  const plaka = new THREE.Group();
  const e = MOD.plaka.en;
  plaka.add(new THREE.Mesh(new THREE.BoxGeometry(e, e, MOD.plaka.kalinlik), plakaKenar));
  plaka.add(new THREE.Mesh(new THREE.PlaneGeometry(e - 0.4, e - 0.4).translate(0, 0, MOD.plaka.kalinlik / 2 + 0.01), plakaYuz));
  nfc.position.set(0, YC, Z_NFC);
  plaka.position.set(0, YC, Z_PLAKA);
  modul.add(nfc, plaka);

  const parts = { kayis, modul };
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} ayarlı kayış · kimlik modülü NFC + QR · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    cizim: {
      src: 'bileklik-taslak.svg',
      alt: 'tipay bileklik teknik çizimi: açılmış kayış, kimlik modülü kesiti, QR plakası, parça listesi',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (t) => {
      const a = smooth(0, 0.65, t);
      const b = smooth(0.35, 1, t);
      plaka.position.set(0, YC + AY.plakaY * a, Z_PLAKA + AY.plaka * a);
      nfc.position.set(0, YC + AY.nfcY * b, Z_NFC + AY.nfc * b);
    },
    occluder: { r: R_DIS, y0: YC - W / 2, y1: YC + W / 2 },
    golge: 120,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 12, h: tech ? 110 : 84, w: tech ? 150 : 92 }
      : { y: YC + (tech ? 10 : 0), h: tech ? 120 : 62, w: tech ? 150 : 76 }),
    annotate,
    annotateAyrik,
  };
}
