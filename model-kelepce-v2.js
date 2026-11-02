import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { metin, smooth } from 'kts/ortak';
import { olculer, milGeometrisi } from 'kts/kelepce-ortak';

// Tüm ölçüler kelepce-v2-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin SDS-Plus sap ucunun merkezi.
// Mil v1 ile aynı kafa ve sapı taşır (kelepce-ortak.js); arada Ø20 yatak yeri vardır. Kovan iki rulmanla
// bu yerde serbest döner: matkap mili çevirirken el kovanı tutar, ucu kelepçenin dibinden destekler.
export const SPEC = await fetch(`kelepce-v2-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = olculer(SPEC);
const { yatak: YT, rulman: RL, segman: SG, kovan: KV } = SPEC;

const BODY_R = M.D / 2;
const SAP_R = M.S / 2;
const NECK_R = M.N / 2;
const JR = YT.cap / 2;                     // yatak yeri
const FACE_Y = M.H - M.C;                  // kafa alnı, tırnaklar buradan uzar
const MOUTH_X = M.A / 2;
const OUTER_X = MOUTH_X + M.U;
const GROOVE_Y = FACE_Y - SPEC.onKanal.konum;

// Eksen boyunca zincir: yatak yeri → segman kanalı → arka rulman/kovan → ön rulman → dayama omzu → kafa
const Y_J = M.L + M.T;                     // yatak yeri başı
const Y_K0 = Y_J + SG.kenar;               // segman kanalı arka duvarı
const Y_K1 = Y_K0 + SG.kanalEn;            // segman kanalı ön duvarı
const Y_R = Y_K1 + SG.bosluk;              // kovan ve arka rulman arka alnı
const Y_C = Y_R + M.K;                     // ön rulman ön alnı, dayama omzu
const Y_KAFA = Y_C + YT.omuzBoy;           // kafa arka alnı
export const G = FACE_Y - Y_KAFA;          // kafa boyu (türetilir)

const lathe = (pts, segs = 192) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const creased = (geo) => toCreasedNormals(geo, THREE.MathUtils.degToRad(30));

// Çeyrek yay: merkez (cr, cy), yarıçap rho, a0 → a1 (radyan, r ekseninden)
function yay(cr, cy, rho, a0, a1, n = 8) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cr + rho * Math.cos(a), cy + rho * Math.sin(a)];
  });
}

// ---------------- mil ----------------
// Sap, boyun, halka, yatak yeri ve segman kanalı, dayama omzu, kafa, ön kanal, alın yuvası, orta cep ve delik
function milProfili() {
  const { sap, govde, alin, halka } = SPEC.pah;
  const ringR = M.Z / 2;
  const ring0 = M.L + SPEC.halka.konum;
  const ring1 = ring0 + SPEC.halka.kalinlik;
  const g = SPEC.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0],
    [SAP_R - sap, 0],
    [SAP_R, sap * 0.8],
    [SAP_R, M.L],
    [NECK_R, M.L + SAP_R - NECK_R],
    [NECK_R, ring0],
    [ringR - halka, ring0],
    [ringR, ring0 + halka],
    [ringR, ring1 - halka],
    [ringR - halka, ring1],
    [NECK_R, ring1],
    [NECK_R, Y_J],
    [JR - YT.pah, Y_J],
    [JR, Y_J + YT.pah],
    [JR, Y_K0],
    [SG.kanalCap / 2, Y_K0],
    [SG.kanalCap / 2, Y_K1],
    [JR, Y_K1],
    [JR, Y_C],
    [YT.omuzCap / 2, Y_C],
    [YT.omuzCap / 2, Y_KAFA],
    [BODY_R - govde, Y_KAFA],
    [BODY_R, Y_KAFA + govde],
    [BODY_R, GROOVE_Y - g],
    [BODY_R - g, GROOVE_Y],
    [BODY_R, GROOVE_Y + g],
    [BODY_R, FACE_Y - alin],
    [BODY_R - alin, FACE_Y],
    [M.W / 2, FACE_Y],
    [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y],
    [M.P / 2, cep],
    [M.J / 2, cep],
    [M.J / 2, cep - 3],
    [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}

// ---------------- kovan ----------------
// Yerel y: 0 arka alın, K ön alın (siper). Tırtıl bölgesi ayrı yüzeydir, iki uçta profile sıfır derinlikle bağlanır.
const KV_R = M.E / 2;
const SIPER_R = M.F / 2;
const YUVA_R = RL.D / 2;
const TIRTIL_BAS = KV.tirtil.bas;
const TIRTIL_SON = M.K - KV.siper - KV.tirtil.bosluk;

// Siper: tırtıl bitiminden kosinüs eğrisiyle genişler, kısa düz bölge, ön kenar yuvarlatması
function siperEgrisi(y0, n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    return [KV_R + ((SIPER_R - KV_R) * (1 - Math.cos(Math.PI * t))) / 2, y0 + KV.kavis * t];
  });
}

function kovanProfili() {
  const { siperR, arkaR } = KV;
  const k = 0.5;                           // rulman yuvası giriş pahı
  const ys = M.K - KV.siper;               // siper genişlemesinin başı
  // Saat yönünün tersi: arka alından dışa, tırtıl bölgesi atlanır, dış yüzden sipere, ön alından deliğe
  const arka = [
    [YUVA_R + k, 0],
    [KV_R - arkaR, 0],
    ...yay(KV_R - arkaR, arkaR, arkaR, -Math.PI / 2, 0).slice(1),
    [KV_R, TIRTIL_BAS],
  ];
  const on = [
    [KV_R, TIRTIL_SON],
    [KV_R, ys],
    ...siperEgrisi(ys),
    [SIPER_R, M.K - siperR],
    ...yay(SIPER_R - siperR, M.K - siperR, siperR, 0, Math.PI / 2).slice(1),
    [YUVA_R + k, M.K],
    [YUVA_R, M.K - k],
    [YUVA_R, M.K - RL.B],
    [KV.icCap / 2, M.K - RL.B],
    [KV.icCap / 2, RL.B],
    [YUVA_R, RL.B],
    [YUVA_R, k],
    [YUVA_R + k, 0],
  ];
  return { arka, on };
}

// Çapraz tırtıl (RGE 30°): iki sarmal oluk ailesi, tepeler elmas piramit. Diş sayısı çevreye tam bölünür.
function tirtilYuzeyi() {
  const { adim, derinlik } = KV.tirtil;
  const n = Math.round((2 * Math.PI * KV_R) / adim);
  const tan = Math.tan(THREE.MathUtils.degToRad(30));
  const boy = TIRTIL_SON - TIRTIL_BAS;
  const tri = (t) => 1 - Math.abs(2 * (t - Math.floor(t)) - 1);
  const h = (th, s) => {
    const u = (th * n) / (2 * Math.PI);
    const v = (s * tan) / adim;
    const fade = smooth(0, 0.9, s) * smooth(0, 0.9, boy - s);
    return KV_R - derinlik * fade * (1 - Math.min(tri(u + v), tri(u - v)));
  };
  const per = 6;                           // periyot başına örnek: tepe ve oluk çizgileri ızgaraya denk gelir
  const segs = n * per;
  const rows = Math.ceil((boy * tan * per) / adim);
  const pos = new Float32Array((rows + 1) * segs * 3);
  const val = new Float32Array((rows + 1) * segs);
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const s = (boy * j) / rows;
    for (let i = 0; i < segs; i++) {
      const th = (2 * Math.PI * i) / segs;
      const r = h(th, s);
      val[j * segs + i] = r;
      pos[k++] = Math.sin(th) * r;
      pos[k++] = s;
      pos[k++] = Math.cos(th) * r;
    }
  }
  // Her dörtgen, ortasındaki gerçek yüksekliğe daha yakın düşen köşegenden bölünür (iki oluk ailesi de korunur)
  const index = new Uint32Array(rows * segs * 6);
  k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % segs;
      const a = j * segs + i;
      const b = j * segs + i1;
      const c = a + segs;
      const d = b + segs;
      const mid = h((2 * Math.PI * (i + 0.5)) / segs, (boy * (j + 0.5)) / rows);
      const bc = Math.abs((val[b] + val[c]) / 2 - mid);
      const ad = Math.abs((val[a] + val[d]) / 2 - mid);
      index.set(bc <= ad ? [a, b, c, b, d, c] : [a, b, d, a, d, c], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  g.translate(0, TIRTIL_BAS, 0);
  return g;
}

// ---------------- rulman ve segman ----------------
// Yerel y: 0 → B. İç ve dış bilezik çelik, keçeler alından biraz içeride
function rulmanBilezikleri() {
  const { d, D, B, r, icBilezik, disBilezik } = RL;
  const ring = (r0, r1) => creased(lathe([
    [r0 + r, 0], [r1 - r, 0], [r1, r], [r1, B - r], [r1 - r, B], [r0 + r, B], [r0, B - r], [r0, r], [r0 + r, 0],
  ], 128));
  return [ring(d / 2, icBilezik / 2), ring(disBilezik / 2, D / 2)];
}

function rulmanKeceleri() {
  const { B, icBilezik, disBilezik } = RL;
  const kece = (y, yon) => {
    const g = new THREE.RingGeometry(icBilezik / 2, disBilezik / 2, 128, 1).rotateX(yon * Math.PI / 2);
    return g.translate(0, y, 0);
  };
  const g1 = kece(0.25, 1);
  const g2 = kece(RL.B - 0.25, -1);
  return [g1, g2];
}

// DIN 471: kanala oturan iç kenar, kulaklara doğru incelen sırt, iki delikli kulak. Yerel y: 0 → kalınlık
function segmanGeometrisi() {
  const r0 = SG.kanalCap / 2;
  const acik = THREE.MathUtils.degToRad(8);
  const kulak = THREE.MathUtils.degToRad(30);
  const dis = (a) => (a < kulak || a > 2 * Math.PI - kulak
    ? r0 + SG.kulak
    : r0 + SG.sirt - (SG.sirt - 1.5) * ((1 + Math.cos(a)) / 2) ** 2);
  const shape = new THREE.Shape();
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const a = acik + ((2 * Math.PI - 2 * acik) * i) / n;
    const p = [dis(a) * Math.cos(a), dis(a) * Math.sin(a)];
    if (i === 0) shape.moveTo(...p); else shape.lineTo(...p);
  }
  for (let i = n; i >= 0; i--) {
    const a = acik + ((2 * Math.PI - 2 * acik) * i) / n;
    shape.lineTo(r0 * Math.cos(a), r0 * Math.sin(a));
  }
  for (const s of [1, -1]) {
    const a = s * (acik + kulak) / 2 + (s < 0 ? 2 * Math.PI : 0);
    const rc = r0 + SG.kulak * 0.55;
    const hole = new THREE.Path();
    hole.absarc(rc * Math.cos(a), rc * Math.sin(a), SG.delik / 2, 0, 2 * Math.PI, true);
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: SG.kalinlik, bevelEnabled: false, curveSegments: 16 })
    .rotateX(-Math.PI / 2);
}

// ---------------- markalama ----------------
// Ratel logosu: lazer markalama, kovanın arka düz bandına sarılır; siyah eloksal üstünde beyaz.
// Logo tek renk maskeye çevrilir, kovan yüzeyinin hemen üstündeki ince bir bantta gösterilir.
const MARK = SPEC.markalama;
const LOGO = await (async () => {
  try {
    const img = new Image();
    img.src = MARK.logo;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 4096;
    c.height = Math.round((c.width * img.naturalHeight) / img.naturalWidth);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  } catch (err) {
    console.warn('Logo yüklenemedi', err);
    return null;
  }
})();
const MARK_MERKEZ = THREE.MathUtils.degToRad(-50);  // açılıştaki izometrik kameraya bakar

function logoBandi() {
  const aci = (MARK.yukseklik * LOGO.width) / LOGO.height / KV_R;
  const r = KV_R + 0.02;
  const tex = new THREE.CanvasTexture(LOGO);
  tex.anisotropy = 8;
  const geo = new THREE.CylinderGeometry(r, r, MARK.yukseklik, 128, 1, true, MARK_MERKEZ - aci / 2, aci)
    .translate(0, MARK.alt + MARK.yukseklik / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8eaed,
    map: tex,
    metalness: 0.1,
    roughness: 0.55,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------- teknik katman ----------------
function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const hdim = (y, r, text) => {
    a.line([[-r, y, 0], [r, y, 0]]);
    a.arrow([-r, y, 0], [r, y, 0]);
    a.arrow([r, y, 0], [-r, y, 0]);
    a.label(text, [0, y, 0], 'dimtag');
  };

  a.line([[0, -8, 0], [0, M.H + 8, 0]], a.dashMat);

  const [x0, x1] = [SIPER_R + 8, SIPER_R + 20];
  a.ext(M.H, OUTER_X + 1, x1 + 3);
  a.ext(FACE_Y, BODY_R + 1, x0 + 3);
  a.ext(M.L, NECK_R + 1, x0 + 3);
  a.ext(0, SAP_R + 1, x1 + 3);
  dim(x0, FACE_Y, M.H, 'C');
  dim(x0, 0, M.L, 'L');
  dim(x1, 0, M.H, 'H');

  a.line([[-MOUTH_X, M.H, 0], [-MOUTH_X, M.H + 9, 0]]);
  a.line([[MOUTH_X, M.H, 0], [MOUTH_X, M.H + 9, 0]]);
  hdim(M.H + 7, MOUTH_X, `A ≥ ${metin(M.A)}`);

  a.callout([-OUTER_X, M.H - 6, 0], [-44, M.H + 2, 6], `Tırnak ${metin(M.V)} × ${metin(M.U)}`, 'En ve boy varsayım');
  a.callout([-SIPER_R, Y_C - 2, 0], [-50, Y_C + 6, 6], `Siper Ø${metin(M.F)}`, 'Eli dönen kafadan uzak tutar');
  a.callout([-KV_R, (Y_R + Y_C) / 2 + 6, 0], [-56, (Y_R + Y_C) / 2 + 8, 6], `Döner kovan Ø${metin(M.E)} × ${metin(M.K)}`, `${KV.malzemeKisa} · ${KV.yuzey} · tırtıl`);
  if (LOGO) {
    const y = Y_R + MARK.alt + MARK.yukseklik / 2;
    a.callout([KV_R * Math.sin(MARK_MERKEZ - 0.35), y, KV_R * Math.cos(MARK_MERKEZ - 0.35)], [-58, Y_R + 12, 6],
      'Ratel logosu', `lazer markalama · h ${metin(MARK.yukseklik)} · beyaz`);
  }
  a.callout([-KV_R, Y_R + RL.B / 2, 0], [-54, Y_R - 4, 6], `${RL.adet} × ${RL.kod}`, `Rulman ${RL.d} × ${RL.D} × ${RL.B} · ${SG.standart} segman`);
  const { sw, bas, son } = SPEC.kavrama;
  a.callout([-SAP_R, 32, 0], [-40, 26, 6], 'Altıgen kavrama', `SW ${metin(sw)} × ${metin(son - bas)} · mandren çeneleri`);
  a.callout([-SAP_R, 12, 0], [-34, 7, 6], 'SDS-Plus sap', `Ø${metin(M.S)} × ${metin(M.L)} · 2 açık + 2 kilit kanalı`);
}

// Ayrık: önce segman çıkar, sonra mil yukarı kalkar; kovan yerinde kalır, rulmanlar iki yandan ayrılır
const AY = SPEC.ayrik;
const Y_SEGMAN = Y_K0 + (SG.kanalEn - SG.kalinlik) / 2;
const evre = (e, a, b) => smooth(a, b, e);

function ayrikla(p, e) {
  p.segman.position.y = Y_SEGMAN + AY.segman * evre(e, 0, 0.3);
  p.mil.position.y = AY.mil * evre(e, 0.2, 0.8);
  const r = evre(e, 0.7, 1);
  p.arkaRulman.position.y = Y_R + AY.arkaRulman * r;
  p.onRulman.position.y = Y_C - RL.B + AY.onRulman * r;
}

function annotateAyrik(a) {
  const mil = AY.mil;
  const seg = Y_SEGMAN + AY.segman;
  const arka = Y_R + AY.arkaRulman;
  const on = Y_C - RL.B + AY.onRulman;
  a.callout([-JR, mil + (Y_J + Y_C) / 2, 0], [-60, mil + (Y_J + Y_C) / 2 + 6, 6], '1 · Mil', `${SPEC.malzemeKisa} · yatak yeri Ø${YT.cap} ${YT.tolerans}`);
  a.callout([-KV_R, (Y_R + Y_C) / 2, 0], [-56, (Y_R + Y_C) / 2 + 4, 6], '2 · Döner kovan', `${KV.malzemeKisa} · ${KV.yuzey}`);
  a.callout([RL.D / 2, on + RL.B / 2, 0], [44, on + 12, 6], `3 · ${RL.kod}`, `${RL.d} × ${RL.D} × ${RL.B} · ${RL.adet} adet`);
  a.callout([RL.D / 2, arka + RL.B / 2, 0], [44, arka + 2, 6], `3 · ${RL.kod}`, 'Arka rulman');
  a.callout([SG.kanalCap / 2 + SG.sirt, seg, 0], [40, seg - 10, 6], `4 · Segman ${SG.standart}`, `${SG.olcu}`);
}

export function kur({ celik }) {
  const eloksal = new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: 0.55, roughness: 0.42 });
  const rulmanCelik = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 1, roughness: 0.22 });
  const kauçuk = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0, roughness: 0.8, side: THREE.DoubleSide });
  const yayCeligi = new THREE.MeshStandardMaterial({ color: 0x41464d, metalness: 0.9, roughness: 0.45 });

  if (G < M.Q + 3) console.warn(`kafa boyu ${G} mm, orta cep ve delik için kısa`);

  const mil = new THREE.Group();
  mil.add(new THREE.Mesh(milGeometrisi(SPEC, milProfili()), celik));

  const kovan = new THREE.Group();
  const { arka, on } = kovanProfili();
  kovan.add(new THREE.Mesh(creased(lathe(arka)), eloksal));
  kovan.add(new THREE.Mesh(creased(lathe(on)), eloksal));
  kovan.add(new THREE.Mesh(tirtilYuzeyi(), eloksal));
  if (LOGO) kovan.add(logoBandi());
  kovan.position.y = Y_R;

  const rulman = () => {
    const g = new THREE.Group();
    for (const geo of rulmanBilezikleri()) g.add(new THREE.Mesh(geo, rulmanCelik));
    for (const geo of rulmanKeceleri()) g.add(new THREE.Mesh(geo, kauçuk));
    return g;
  };
  const arkaRulman = rulman();
  const onRulman = rulman();

  const segman = new THREE.Group();
  segman.add(new THREE.Mesh(creased(segmanGeometrisi()), yayCeligi));

  const parts = { mil, kovan, arkaRulman, onRulman, segman };

  return {
    ad: SPEC.parca,
    alt: `Çelik ${SPEC.malzemeKisa} + ${KV.malzemeKisa} kovan · ${RL.adet} rulman · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: null,
    cizim: {
      src: 'kelepce-ucu-v2-taslak.svg',
      alt: 'Kelepçe sıkma ucu v2 teknik çizimi: montaj yarım kesiti, mil yan görünüşü, ağız, SDS-Plus sap kesiti, parça listesi, montaj sırası',
    },
    parts,
    parcalar: Object.values(parts).map((obj) => ({ obj })),
    ayrikla: (e) => ayrikla(parts, e),
    occluder: { r: KV_R, y0: Y_R, y1: Y_C },
    golge: 100,
    fit: (tech, ayrik) => (ayrik
      ? { y: 128, h: tech ? 150 : 134, w: tech ? 120 : 64 }
      : { y: M.H / 2, h: tech ? 92 : 80, w: tech ? 112 : 56 }),
    annotate,
    annotateAyrik,
  };
}
