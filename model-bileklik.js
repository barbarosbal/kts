import * as THREE from 'three';
import { metin, smooth } from 'kts/ortak';
import { onYuz, silikonMat, nokta, ek } from 'kts/bileklik-ortak';

// Tüm ölçüler bileklik-olculer.json'dan gelir (mm). Bileklik ekseni +Y; kapalı halka XZ düzleminde.
// Açı φ: 0 = +Z, π/2 = +X (dışarıdan bakınca sağa doğru artar).
// Gövde (silikon halka) ile kimlik modülü (NFC inlay + QR plakası) ayrı parçalardır; modül halkanın
// cebine gömülür, üst yüzü halka yüzüyle aynı hizadadır (çıkıntı yok). Ön yüz: bileklik-ortak.js.
export const SPEC = await fetch(`bileklik-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { modul: MOD, ayrik: AY } = SPEC;

const TAU = Math.PI * 2;
const BOY = SPEC.boylar.liste.find((b) => b.ad === SPEC.boylar.gosterilen);
const R0 = BOY.cevre / TAU;               // iç yarıçap
const T = O.T;
const W = O.W;
const Q = O.Q;
const YC = W / 2;                          // halka orta düzlemi, alt kenar zeminde
const R_DIS = R0 + T;
const POD = THREE.MathUtils.degToRad(SPEC.yerlesim.modulAci);
const P = [0, YC, 0];

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

// ---------------- teknik katman ----------------
const boyMetni = SPEC.boylar.liste.map((b) => `${b.ad} ${b.cevre}`).join(' · ');
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
  a.label(`${BOY.ad} · iç çevre ${BOY.cevre}`, [0, yd, 0], 'dimtag');

  a.callout(nokta(POD, R_DIS, YC - Q / 2 + 1), ek(-24, -34, 20, P),
    `Kimlik modülü ${metin(Q)} × ${metin(Q)}`, 'gömme, yüzeyle aynı hizada · NFC + QR');
  a.callout(nokta(ON.LOGO_PHI, R_DIS, YC + 5), ek(-34, 42, -6, P),
    'tipay logosu', `kalıpta gömme · h ${metin(SPEC.logo.yukseklik)}`);
  a.callout(nokta(ON.NFC_PHI, R_DIS, YC + 3), ek(32, 38, 0, P),
    'Dokun işareti', 'NFC inlay plakanın altında');
  a.callout(nokta(POD + 1.6, R_DIS, 2), ek(30, -34, 10, P),
    `Boylar ${boyMetni}`, `kapalı halka · T ${metin(T)} · ${SPEC.malzemeKisa}`);
}

function annotateAyrik(a) {
  const pl = nokta(POD, R_DIS + AY.plaka, YC + AY.plakaY + Q / 2 - 2);
  a.callout(ek(-Q / 2, 0, 0, pl), ek(-30, 12, 0, pl), '3 · QR plakası', `${MOD.plaka.malzeme} · tekil QR`);
  const nf = nokta(POD, ON.R_NFC + AY.nfc, YC + AY.nfcY);
  a.callout(ek(MOD.nfc.cap / 2, 0, 0, nf), ek(30, 4, 0, nf), '2 · NFC inlay', `Ø${metin(MOD.nfc.cap)} · ${MOD.nfc.cip}`);
  const ky = nokta(POD + 1.1, R_DIS, 2);
  a.callout(ky, ek(24, -18, 0, ky), '1 · Silikon halka', `${SPEC.malzemeKisa} · cep ${metin(MOD.cep.en)} × ${metin(MOD.cep.derinlik)}`);
}

// ---------------- kurulum ----------------
export function kur() {
  const halka = new THREE.Group();
  halka.add(new THREE.Mesh(new THREE.LatheGeometry(kesit(R0, R_DIS, 0, W, O.c), 256), silikonMat()));
  ON = onYuz(SPEC, { POD, R: R_DIS, YC });
  halka.add(...ON.izler);

  const parts = { halka, nfc: ON.nfc, plaka: ON.plaka };
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
    ayrikla: (e) => ON.ayrikla(e, smooth),
    occluder: { r: R_DIS, y0: 0, y1: W },
    golge: 120,
    fit: (tech, ayrik) => (ayrik
      ? { y: YC + 10, h: tech ? 104 : 84, w: tech ? 150 : 96 }
      : { y: YC + (tech ? 8 : 0), h: tech ? 120 : 64, w: tech ? 150 : 80 }),
    annotate,
    annotateAyrik,
  };
}
