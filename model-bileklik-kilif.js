import * as THREE from 'three';
import { metin, smooth } from 'kts/ortak';
import { onYuz, nokta, ek } from 'kts/bileklik-ortak';

// Tüm ölçüler bileklik-kilif-olculer.json'dan gelir (mm). Baskılı elastik kumaş bileklik + üzerine kaydırılan
// tipay kimlik kılıfı. Kılıf dikiş yerini örter; ön yüzünde diğer bilekliklerle aynı gömme QR + NFC modülü
// (bileklik-ortak.js) ve dokun işareti vardır. Bileklik ekseni +Y; açı φ: 0 = +Z, π/2 = +X.
export const SPEC = await fetch(`bileklik-kilif-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { kilif: KL, modul: MOD, ayrik: AY, yerlesim: YER } = SPEC;

const TAU = Math.PI * 2;
const BOY = SPEC.boylar.liste.find((b) => b.ad === SPEC.boylar.gosterilen);
const { W, T, Q, K } = O;
const R0 = BOY.cevre / TAU;                // bant iç yarıçapı
const R_B = R0 + T;                        // bant dış yüzü
const G = KL.bosluk;
const R_IC = R0 - G;                       // kılıf deliği
const R_DIS_IC = R_B + G;
const R_ARKA = R_IC - KL.et.arka;          // kılıf bilek yüzü
const R_S = R_DIS_IC + KL.et.on;           // kılıf ön yüzü
const HY = W / 2 + G;                      // kılıf deliği yarı yüksekliği
const KY = HY + KL.et.yan;                 // kılıf yarı yüksekliği
const YC = KY;                             // kılıf alt kenarı zeminde
const POD = THREE.MathUtils.degToRad(YER.modulAci);
const K_ACI = K / R_S;
const K_MERKEZ = POD + (K / 2 - (YER.qrPay + Q / 2)) / R_S;
const P = [0, YC, 0];

// ---------------- dokular ----------------
// Örnek kumaş baskısı: koyu zemin, ince örgü çizgileri, tekrar eden tipay yazısı (desen serbesttir)
function kumasDokusu() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = '#1c2430';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,0.045)';
  g.lineWidth = 2;
  for (let y = 3; y < c.height; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(122, 196, 255, 0.10)';
  g.lineWidth = 14;
  for (let x = -c.height; x < c.width + c.height; x += 64) {
    g.beginPath();
    g.moveTo(x, c.height);
    g.lineTo(x + c.height, 0);
    g.stroke();
  }
  g.font = '600 96px Inter, "Segoe UI", Roboto, Arial, sans-serif';
  g.textBaseline = 'middle';
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? 'rgba(236, 233, 226, 0.55)' : 'rgba(140, 207, 255, 0.55)';
    g.fillText('tipay', 60 + i * 340, i % 2 ? c.height * 0.62 : c.height * 0.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------- geometri ----------------
function bant() {
  const g = new THREE.Group();
  const dis = new THREE.MeshStandardMaterial({ map: kumasDokusu(), metalness: 0, roughness: 0.92 });
  const ic = new THREE.MeshStandardMaterial({ color: 0x161b23, metalness: 0, roughness: 0.95, side: THREE.BackSide });
  const kenar = new THREE.MeshStandardMaterial({ color: 0x141920, metalness: 0, roughness: 0.95, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R_B, R_B, W, 256, 1, true).translate(0, YC, 0), dis));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, W, 256, 1, true).translate(0, YC, 0), ic));
  g.add(new THREE.Mesh(new THREE.RingGeometry(R0, R_B, 256).rotateX(-Math.PI / 2).translate(0, YC + W / 2, 0), kenar));
  g.add(new THREE.Mesh(new THREE.RingGeometry(R0, R_B, 256).rotateX(Math.PI / 2).translate(0, YC - W / 2, 0), kenar));
  return g;
}

// Yuvarlatılmış dikdörtgen (r, y) yolu, saat yönünün tersi
function kare(r0, r1, y0, y1, c, n = 6) {
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
  return pts;
}

// Kılıf: dış ve iç yüzler torna ile, iki uç alın şekil + delik olarak
function kilifGeometrileri() {
  const bas = K_MERKEZ - K_ACI / 2;
  const disYol = kare(R_ARKA, R_S, YC - KY, YC + KY, O.c);
  const icYol = kare(R_IC, R_DIS_IC, YC - HY, YC + HY, 0.4);
  const dis = new THREE.LatheGeometry([...disYol, disYol[0].clone()], 96, bas, K_ACI);
  const ic = new THREE.LatheGeometry([...icYol, icYol[0].clone()].reverse(), 96, bas, K_ACI);
  const alin = (phi) => {
    const sh = new THREE.Shape(disYol);
    sh.holes.push(new THREE.Path(icYol));
    const geo = new THREE.ShapeGeometry(sh, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const r = p.getX(i);
      const y = p.getY(i);
      p.setXYZ(i, Math.sin(phi) * r, y, Math.cos(phi) * r);
    }
    geo.computeVertexNormals();
    return geo;
  };
  return [dis, ic, alin(bas), alin(bas + K_ACI)];
}

// ---------------- teknik katman ----------------
let ON = null;
const boyMetni = SPEC.boylar.liste.map((b) => `${b.ad} ${b.cevre}`).join(' · ');

function annotate(a) {
  const x0 = R_B + 9;
  a.ext(YC - W / 2, R_B + 1, x0 + 3);
  a.ext(YC + W / 2, R_B + 1, x0 + 3);
  a.dim(x0, YC - W / 2, YC + W / 2, `W = ${metin(W)}`);

  const yd = 2 * KY + 3;
  a.line([[-R0, yd, 0], [R0, yd, 0]]);
  a.arrow([-R0, yd, 0], [R0, yd, 0]);
  a.arrow([R0, yd, 0], [-R0, yd, 0]);
  a.label(`${BOY.ad} · iç çevre ${BOY.cevre} (gerilmemiş)`, [0, yd, 0], 'dimtag');

  a.callout(nokta(POD, R_S, YC - Q / 2 + 1), ek(-22, -36, 20, P),
    `Kimlik modülü ${metin(Q)} × ${metin(Q)}`, 'gömme, kılıf yüzüyle aynı hizada · NFC + QR');
  a.callout(nokta(K_MERKEZ - K_ACI / 2, R_S, YC + KY - 2), ek(-34, 40, -6, P),
    `Kimlik kılıfı ${metin(K)} × ${metin(2 * KY)}`, `${KL.malzeme} · kaydırılır, dikişi örter`);
  a.callout(nokta(ON.NFC_PHI, R_S, YC + 3), ek(32, 40, 0, P), 'Dokun işareti', 'NFC inlay plakanın altında');
  a.callout(nokta(POD + 1.5, R_B, YC - 6), ek(30, -36, 10, P),
    'Elastik kumaş bant', `baskılı, desen serbest · ${boyMetni}`);
}

function annotateAyrik(a) {
  const pl = nokta(POD, R_S + AY.plaka, YC + AY.kilifY + AY.plakaY + Q / 2 - 2);
  a.callout(ek(-Q / 2, 0, 0, pl), ek(-30, 10, 0, pl), '4 · QR plakası', `${MOD.plaka.malzeme} · tekil QR`);
  const nf = nokta(POD, ON.R_NFC + AY.nfc, YC + AY.kilifY + AY.nfcY);
  a.callout(ek(MOD.nfc.cap / 2, 0, 0, nf), ek(30, 6, 0, nf), '3 · NFC inlay', `Ø${metin(MOD.nfc.cap)} · ${MOD.nfc.cip}`);
  const kl = nokta(K_MERKEZ + K_ACI / 2, R_S, YC + AY.kilifY);
  a.callout(kl, ek(32, -8, 0, kl), '2 · Kimlik kılıfı', `${KL.malzeme}`);
  const bt = nokta(POD + 1.4, R_B, YC - 6);
  a.callout(bt, ek(24, -22, 0, bt), '1 · Elastik bant', SPEC.bant.malzeme);
}

// ---------------- kurulum ----------------
export function kur() {
  const tpu = new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0, roughness: 0.7, side: THREE.DoubleSide });

  const kilif = new THREE.Group();
  for (const geo of kilifGeometrileri()) kilif.add(new THREE.Mesh(geo, tpu));
  ON = onYuz(SPEC, { POD, R: R_S, YC });
  kilif.add(...ON.izler);

  const modul = new THREE.Group();
  modul.add(ON.plaka, ON.nfc);

  const parts = { bant: bant(), kilif, modul };
  return {
    ad: SPEC.parca,
    alt: `Baskılı elastik bant + ${SPEC.malzemeKisa} · gömme NFC + QR · boy ${SPEC.boylar.liste.map((b) => b.ad).join(' / ')} · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    cizim: {
      src: 'bileklik-kilif-taslak.svg',
      alt: 'tipay kimlik kılıfı teknik çizimi: kılıf önden, kesit, QR plakası, boylar, parça listesi',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (e) => {
      const y = AY.kilifY * smooth(0, 0.6, e);
      kilif.position.y = y;
      modul.position.y = y;
      ON.ayrikla(smooth(0.4, 1, e), smooth);
    },
    occluder: { r: R_B, y0: YC - W / 2, y1: YC + W / 2 },
    golge: 110,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 22, h: tech ? 120 : 100, w: tech ? 150 : 96 }
      : { y: YC + (tech ? 8 : 0), h: tech ? 120 : 64, w: tech ? 150 : 78 }),
    annotate,
    annotateAyrik,
  };
}
