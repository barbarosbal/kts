// kelepce-olculer.json → kelepce-ucu-taslak.svg (teknik çizim sayfası)
// Kullanım: cd tools && npm run site
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(ROOT, 'kelepce-olculer.json'), 'utf8'));
const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));
const fmt = (n) => String(n).replace('.', ',');
const onDeger = (k) => (spec.olculer[k].varsayim && !spec.onayli ? ' q' : '');
const SDS_Q = spec.onayli ? '' : ' q';

const BODY_R = M.D / 2;
const SAP_R = M.S / 2;
const NECK_R = M.N / 2;
const RING_R = M.Z / 2;
const BODY_Y = M.L + M.T;
const FACE_Y = M.H - M.C;
const BOY = FACE_Y - BODY_Y;
const MOUTH_X = M.A / 2;
const OUTER_X = MOUTH_X + M.U;
const RING_0 = M.L + spec.halka.konum;
const RING_1 = RING_0 + spec.halka.kalinlik;
const GROOVE_Y = FACE_Y - spec.onKanal.konum;
const GROOVE_D = spec.onKanal.derinlik;
const CEP_Y = FACE_Y - M.Q;
const { sap: CH_S, govde: CH_G, alin: CH_F, halka: CH_R } = spec.pah;
const { ic: UC_I, dis: UC_D, yan: UC_Y } = spec.pah.uc;
const { acik: AC, kilit: KI } = spec.sds;
const { sw: KV_SW, bas: KV_BAS, son: KV_SON } = spec.kavrama;
const KV_R = KV_SW / 2;
const KV_KENAR = KV_SW / Math.sqrt(3) / 2; // yarım kesit dış görünüşünde altıgen kenarı

// Açık kanal tabanı, freze çıkışı ve kenarı (dış görünüşte sapın görünen genişliği)
const AC_TABAN = SAP_R - AC.derinlik;
const AC_CIKIS = Math.sqrt(AC.cikisR ** 2 - (AC.cikisR - AC.derinlik) ** 2);
const AC_KENAR = Math.sqrt(SAP_R ** 2 - (AC.en / 2) ** 2);

// Kilit kanalı: yüzeyde en kadar açılan daire yayı
const KI_TABAN = SAP_R - KI.derinlik;
const KI_X = Math.sqrt(SAP_R ** 2 - (KI.en / 2) ** 2);
const KI_RHO = ((KI_X - KI_TABAN) ** 2 + (KI.en / 2) ** 2) / (2 * (KI_X - KI_TABAN));
const KI_CX = KI_TABAN + KI_RHO;
const KI_LIFT = Math.sqrt(KI_RHO ** 2 - (KI_CX - SAP_R) ** 2);

// Türetilen ölçüler: ölçü değişince çizimle birlikte denetlenir
const KIRIS = Math.sqrt(BODY_R ** 2 - OUTER_X ** 2);
if (M.V / 2 > KIRIS) console.warn(`UYARI: tırnak eni ${M.V} mm, dış düz yüzden (${(2 * KIRIS).toFixed(1)} mm) geniş`);
if (M.W / 2 >= MOUTH_X) console.warn(`UYARI: alın yuvası Ø${M.W}, ağız ${M.A} ile aynı hizada ya da geniş`);
if (AC.boy > M.L || KI.son > M.L) console.warn(`UYARI: SDS kanalı ${M.L} mm sap boyunu aşıyor`);
if (KV_SON - KV_BAS < 15) console.warn(`UYARI: altıgen ${KV_SON - KV_BAS} mm, mandren çeneleri için kısa`);
console.log(`UC    ağız ≥ ${M.A} · SDS-Plus Ø${M.S} × ${M.L} · altıgen SW ${KV_SW} × ${KV_SON - KV_BAS} · toplam boy ${M.H} · gövde ${BOY} mm`);

// ---------------- profil ----------------
// Sap sonundan ön kanala ortak dış çizgi: [r, y]
const boyunGovde = [
  [SAP_R, M.L],
  [NECK_R, M.L + SAP_R - NECK_R],
  [NECK_R, RING_0],
  [RING_R - CH_R, RING_0],
  [RING_R, RING_0 + CH_R],
  [RING_R, RING_1 - CH_R],
  [RING_R - CH_R, RING_1],
  [NECK_R, RING_1],
  [NECK_R, BODY_Y],
  [BODY_R - CH_G, BODY_Y],
  [BODY_R, BODY_Y + CH_G],
  [BODY_R, GROOVE_Y - GROOVE_D],
  [BODY_R - GROOVE_D, GROOVE_Y],
];

// Kilit kanalı kesiti: sap yüzeyinden tabana iner, taban boyunca gider, yüzeye çıkar
function kilitYol() {
  const yay = (y0, s) => Array.from({ length: 9 }, (_, i) => {
    const t = (i / 8) * KI_LIFT;
    return [KI_CX - Math.sqrt(KI_RHO ** 2 - t ** 2), y0 + s * t];
  });
  return [...yay(KI.bas + KI_LIFT, -1).reverse(), ...yay(KI.son - KI_LIFT, 1)];
}

// Açık kanal kesiti: taban, freze çıkışı
function acikYol() {
  const [cx, cy] = [AC_TABAN + AC.cikisR, AC.boy - AC_CIKIS];
  const son = Math.acos((cx - SAP_R) / AC.cikisR);
  return Array.from({ length: 11 }, (_, i) => {
    const t = (i / 10) * son;
    return [cx - AC.cikisR * Math.cos(t), cy + AC.cikisR * Math.sin(t)];
  });
}

// Kilit kanalının dış görünüş çizgisi: oval yüzeyde kanal kenarını izler
function kilitDis() {
  const r = KI.en / 2;
  const w = (y0, s) => Array.from({ length: 7 }, (_, i) => {
    const t = (i / 6) * r;
    return [Math.sqrt(SAP_R ** 2 - (r ** 2 - t ** 2)), y0 + s * t];
  });
  return [...w(KI.bas + r, -1).reverse(), ...w(KI.son - r, 1)];
}

// Sap uç pahı: rSinir yarıçapına kadar
const sapUc = (rSinir) => [[SAP_R - CH_S, 0], [rSinir, (rSinir - SAP_R + CH_S) * 0.8]];

// Yarım kesit düzlemi kilit kanalının tabanından geçer; dış yarıda kanal kenarı görünür.
// Yan görünüşte açık kanal önde kalır: dış çizgi kanal kenarı, altıgende düz yüz.
const sapKesitYol = [...sapUc(SAP_R), ...kilitYol()];
const sapDisYol = [...sapUc(SAP_R), ...kilitDis()];
const sapYanYol = [...sapUc(AC_KENAR), [AC_KENAR, KV_BAS], [KV_R, KV_BAS], [KV_R, KV_SON], [NECK_R, KV_SON]];

// Tırnak, kalınlık yönünde: dış düz yüzden ağız pahına
const tirnakKalinlik = [
  [OUTER_X, GROOVE_Y],
  [OUTER_X, M.H - UC_D],
  [OUTER_X - UC_D, M.H],
  [MOUTH_X + UC_I, M.H],
  [MOUTH_X, M.H - UC_I],
  [MOUTH_X, FACE_Y],
];

// Alın yuvası, orta cep, delik: eksene iner
const icCep = [
  [M.W / 2, FACE_Y],
  [M.W / 2, FACE_Y - M.Y],
  [M.P / 2, FACE_Y - M.Y],
  [M.P / 2, CEP_Y],
  [M.J / 2, CEP_Y],
  [M.J / 2, CEP_Y - 3],
  [0, CEP_Y - 3 - (M.J / 2) * 0.6],
];

const kesitYari = [[0, 0], ...sapKesitYol, ...boyunGovde, ...tirnakKalinlik, ...icCep];
const disYari = [[0, 0], ...sapDisYol, ...boyunGovde, ...tirnakKalinlik, [0, FACE_Y]];
const yanYari = [
  [0, 0],
  ...sapYanYol,
  ...boyunGovde.slice(2),
  [BODY_R, GROOVE_Y + GROOVE_D],
  [BODY_R, FACE_Y - CH_F],
  [BODY_R - CH_F, FACE_Y],
  [M.V / 2, FACE_Y],
  [M.V / 2, M.H - UC_Y],
  [M.V / 2 - UC_Y, M.H],
  [0, M.H],
];

// ---------------- yarım kesit ve yan görünüş ----------------
const S = 6.6;                             // 1 mm = 6,6 px
const X0 = 120;
const A1 = 190;                            // yarım kesit ekseni
const A2 = 544;                            // yan görünüş ekseni
const X1 = X0 + S * M.H;
const vx = (y) => +(X0 + S * y).toFixed(1);
const vy = (axis, r) => +(axis - S * r).toFixed(1);

const yari = (axis, pts, side = 1) => pts.map(([r, y]) => `${vx(y).toFixed(1)},${vy(axis, side * r).toFixed(1)}`).join(' ');
const tumu = (axis, upper) => yari(axis, [...upper, ...upper.map(([r, y]) => [-r, y]).reverse()]);

const cross = (axis, y, r0, r1, cls = 'thin') => `<line class="${cls}" x1="${vx(y)}" y1="${vy(axis, r0)}" x2="${vx(y)}" y2="${vy(axis, r1)}"/>`;
const along = (axis, r, y0, y1, cls = 'thin') => `<line class="${cls}" x1="${vx(y0)}" y1="${vy(axis, r)}" x2="${vx(y1)}" y2="${vy(axis, r)}"/>`;

// Kısa ölçüde yazı çizginin üstüne çıkar, oklar görünür kalır
function hdim(x0, x1, y, text, q = '') {
  const kisa = x1 - x0 < 90;
  const en = Math.max(68, text.length * 8.5);
  return `
    <line class="dima" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>
    ${kisa ? '' : `<rect x="${(x0 + x1 - en) / 2}" y="${y - 10}" width="${en}" height="20" fill="#fff"/>`}
    <text class="tb${q}" x="${(x0 + x1) / 2}" y="${kisa ? y - 6 : y + 5}" text-anchor="middle">${text}</text>`;
}

function vdim(x, y0, y1, text, q = '') {
  return `
    <line class="dima" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>
    <rect x="${x - 34}" y="${(y0 + y1) / 2 - 10}" width="68" height="20" fill="#fff"/>
    <text class="tb${q}" x="${x}" y="${(y0 + y1) / 2 + 5}" text-anchor="middle">${text}</text>`;
}

const extV = (x, y0, y1) => `<line class="dim" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`;
const extH = (x0, x1, y) => `<line class="dim" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;

function note([x, y], tx, ty, title, sub, q = '') {
  return `
    <polyline class="lead" points="${x},${y} ${tx - 4},${ty + 6} ${tx + 240},${ty + 6}"/>
    <text class="tb${q}" x="${tx}" y="${ty}">${title}</text>
    <text class="ts" x="${tx}" y="${ty + 22}">${sub}</text>`;
}

const yarimKesit = `
    <line class="ctr" x1="${X0 - 26}" y1="${A1}" x2="${X1 + 22}" y2="${A1}"/>
    <polygon class="vis" fill="url(#h1)" points="${yari(A1, kesitYari)}"/>
    <polygon class="vis" points="${yari(A1, disYari, -1)}"/>
    ${along(A1, -AC.en / 2, 0, AC.boy - AC_CIKIS)}
    ${cross(A1, AC.boy - AC_CIKIS, 0, -AC.en / 2)}
    ${along(A1, -KV_KENAR, KV_BAS, KV_SON)}
    ${cross(A1, KV_BAS, 0, -SAP_R)}
    ${cross(A1, KV_SON, 0, -NECK_R)}
    ${cross(A1, RING_0, 0, -RING_R)}
    ${cross(A1, RING_1, 0, -RING_R)}
    ${cross(A1, BODY_Y + CH_G, 0, -BODY_R)}
    ${cross(A1, GROOVE_Y, 0, GROOVE_D - BODY_R)}
    ${cross(A1, FACE_Y, -MOUTH_X, -OUTER_X)}
    ${extV(vx(0), vy(A1, -SAP_R) + 4, A1 + 166)}
    ${extV(vx(M.L), vy(A1, -SAP_R) + 4, A1 + 138)}
    ${extV(vx(KV_BAS), vy(A1, -SAP_R) + 4, A1 + 84)}
    ${extV(vx(KV_SON), vy(A1, -NECK_R) + 4, A1 + 84)}
    ${extV(vx(BODY_Y), vy(A1, -NECK_R) + 4, A1 + 138)}
    ${extV(vx(FACE_Y), vy(A1, -OUTER_X) + 4, A1 + 138)}
    ${extV(X1, vy(A1, -OUTER_X + UC_D) + 4, A1 + 166)}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A1, SAP_R))}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A1, -SAP_R))}
    ${extH(vx(M.H - UC_I), X1 + 46, vy(A1, MOUTH_X))}
    ${extH(vx(M.H - UC_I), X1 + 46, vy(A1, -MOUTH_X))}
    ${hdim(vx(KV_BAS), vx(KV_SON), A1 + 80, `altıgen ${fmt(KV_SON - KV_BAS)}`)}
    ${hdim(vx(0), vx(M.L), A1 + 134, `L = ${fmt(M.L)}`)}
    ${hdim(vx(BODY_Y), vx(FACE_Y), A1 + 134, `(${fmt(BOY)})`)}
    ${hdim(vx(FACE_Y), X1, A1 + 134, `C = ${fmt(M.C)}`, onDeger('C'))}
    ${hdim(vx(0), X1, A1 + 162, `H = ${fmt(M.H)}`)}
    ${vdim(vx(0) - 40, vy(A1, SAP_R), vy(A1, -SAP_R), `ØS = ${fmt(M.S)}`)}
    ${vdim(X1 + 42, vy(A1, MOUTH_X), vy(A1, -MOUTH_X), `A ≥ ${fmt(M.A)}`)}
    ${note([vx(18), vy(A1, KI_TABAN)], 100, 40, `SDS-PLUS SAP Ø${fmt(M.S)} × ${fmt(M.L)}`, `kilit kanalı ${fmt(KI.en)} × ${fmt(KI.derinlik)} · 2 adet`)}
    ${note([vx(FACE_Y - M.Q + 2), vy(A1, M.P / 2 - 2)], 400, 40, `ORTA CEP Ø${fmt(M.P)} × ${fmt(M.Q)}`, `alın yuvası Ø${fmt(M.W)} × ${fmt(M.Y)} · delik Ø${fmt(M.J)}`, onDeger('P'))}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A1 + 196}" text-anchor="middle">YARIM KESİT</text>`;

// Kilit kanalı yan görünüşte oval olarak görünür
const ovalY = [KI.bas + KI.en / 2, KI.son - KI.en / 2].map(vx);
const ovalR = (S * KI.en) / 2;
const oval = `<path class="thin" d="M${ovalY[0]} ${A2 - ovalR} H${ovalY[1]} A${ovalR} ${ovalR} 0 0 1 ${ovalY[1]} ${A2 + ovalR} H${ovalY[0]} A${ovalR} ${ovalR} 0 0 1 ${ovalY[0]} ${A2 - ovalR} Z"/>`;

const yanGorunus = `
    <line class="ctr" x1="${X0 - 26}" y1="${A2}" x2="${X1 + 22}" y2="${A2}"/>
    <polygon class="vis" points="${tumu(A2, yanYari)}"/>
    ${oval}
    ${along(A2, AC_TABAN, 0, AC.boy - AC_CIKIS, 'hid')}
    ${along(A2, -AC_TABAN, 0, AC.boy - AC_CIKIS, 'hid')}
    <polyline class="hid" points="${yari(A2, acikYol().filter(([r]) => r <= KV_R))}"/>
    <polyline class="hid" points="${yari(A2, acikYol().filter(([r]) => r <= KV_R), -1)}"/>
    ${cross(A2, RING_0, -RING_R, RING_R)}
    ${cross(A2, RING_1, -RING_R, RING_R)}
    ${cross(A2, BODY_Y + CH_G, -BODY_R, BODY_R)}
    ${cross(A2, GROOVE_Y, GROOVE_D - BODY_R, BODY_R - GROOVE_D)}
    ${cross(A2, FACE_Y, -M.V / 2, M.V / 2)}
    ${along(A2, KIRIS, GROOVE_Y, FACE_Y)}
    ${along(A2, -KIRIS, GROOVE_Y, FACE_Y)}
    ${cross(A2, M.H - UC_D, UC_Y - M.V / 2, M.V / 2 - UC_Y)}
    <path class="dim" d="M${vx(25)} ${vy(A2, SAP_R) - 30} V${vy(A2, SAP_R) - 10} M${vx(25)} ${vy(A2, -SAP_R) + 10} V${vy(A2, -SAP_R) + 30}"/>
    <text class="tb" x="${vx(25)}" y="${vy(A2, SAP_R) - 36}" text-anchor="middle">A</text>
    <text class="tb" x="${vx(25)}" y="${vy(A2, -SAP_R) + 46}" text-anchor="middle">A</text>
    ${extV(vx(0), vy(A2, -AC_KENAR) + 4, A2 + 166)}
    ${extV(vx(KI.bas), vy(A2, -AC_KENAR) + 4, A2 + 166)}
    ${extV(vx(KI.son), vy(A2, -KV_R) + 4, A2 + 166)}
    ${extV(vx(AC.boy), vy(A2, -KV_R) + 4, A2 + 138)}
    ${extV(vx(M.L), vy(A2, -NECK_R) + 4, A2 + 138)}
    ${extV(vx(BODY_Y), vy(A2, -NECK_R) + 4, A2 + 138)}
    ${extH(vx(M.H - UC_Y), X1 + 46, vy(A2, M.V / 2))}
    ${extH(vx(M.H - UC_Y), X1 + 46, vy(A2, -M.V / 2))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, BODY_R))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, -BODY_R))}
    ${hdim(vx(0), vx(AC.boy), A2 + 134, fmt(AC.boy), SDS_Q)}
    ${hdim(vx(M.L), vx(BODY_Y), A2 + 134, `T = ${fmt(M.T)}`)}
    ${hdim(vx(0), vx(KI.bas), A2 + 162, fmt(KI.bas), SDS_Q)}
    ${hdim(vx(KI.bas), vx(KI.son), A2 + 162, fmt(KI.son - KI.bas), SDS_Q)}
    ${vdim(X1 + 42, vy(A2, M.V / 2), vy(A2, -M.V / 2), `V = ${fmt(M.V)}`, onDeger('V'))}
    ${vdim(X1 + 104, vy(A2, BODY_R), vy(A2, -BODY_R), `ØD = ${fmt(M.D)}`)}
    ${note([vx(6), vy(A2, AC_TABAN)], 100, 396, `AÇIK KANAL ${fmt(AC.en)} × ${fmt(AC.derinlik)}`, '2 adet · kilit kanallarına 90°', SDS_Q)}
    ${note([vx(M.H - 8), vy(A2, M.V / 2)], 480, 396, `TIRNAK ${fmt(M.V)} × ${fmt(M.U)} × ${fmt(M.C)}`, 'uçlarda iki yan ve ağız pahı', onDeger('V'))}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A2 + 198}" text-anchor="middle">YAN GÖRÜNÜŞ</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A2 + 218}" text-anchor="middle">yarım kesite göre 90° döndürülmüş</text>`;

// ---------------- ağız ve sap kesiti ----------------
const T = 6.4;
const NX = 930;
const NY = 196;
const CX = 1190;
const HS = 18;                             // A–A ölçeği: 1 mm = 18 px

// Gövde dış çizgisi: daire, iki dış düz yüz
const govdeUc = Array.from({ length: 120 }, (_, i) => {
  const a = (i * Math.PI) / 60;
  const x = Math.max(-OUTER_X, Math.min(OUTER_X, BODY_R * Math.cos(a)));
  return `${(NX + T * x).toFixed(1)},${(NY + T * BODY_R * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const dikdortgen = (s, x0, x1, hz) => [[x0, -hz], [x1, -hz], [x1, hz], [x0, hz]]
  .map(([x, z]) => `${(NX + s * T * x).toFixed(1)},${(NY + T * z).toFixed(1)}`).join(' ');

// A–A altıgen bölgeden geçer: ±X kilit kanalı, ±Z açık kanal, köşeler sap çapında. Çeyrek çizilir, aynalanır.
function sapKesit() {
  const P30 = Math.PI / 6;
  const kilitT = Math.acos((KI_CX * Math.cos(P30) - KV_R) / KI_RHO) - P30;
  const d = Math.acos(KV_R / SAP_R);
  const q = [];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * kilitT;
    q.push([KI_CX - KI_RHO * Math.cos(t), KI_RHO * Math.sin(t)]);
  }
  q.push(
    [SAP_R * Math.cos(P30 + d), SAP_R * Math.sin(P30 + d)],
    [SAP_R * Math.cos(Math.PI / 2 - d), SAP_R * Math.sin(Math.PI / 2 - d)],
    [AC.en / 2, KV_R],
    [AC.en / 2, AC_TABAN],
    [0, AC_TABAN],
  );
  const m = (sx, sz, list) => list.map(([x, z]) => [sx * x, sz * z]);
  return [...q, ...m(-1, 1, q).reverse(), ...m(-1, -1, q), ...m(1, -1, q).reverse()]
    .map(([x, z]) => `${(CX + HS * x).toFixed(1)},${(NY + HS * z).toFixed(1)}`).join(' ');
}

const agiz = `
    <line class="ctr" x1="${NX - 118}" y1="${NY}" x2="${NX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 118}" x2="${NX}" y2="${NY + 118}"/>
    <polygon class="vis" style="fill:#fff" points="${govdeUc}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${(T * M.W) / 2}"/>
    <circle class="vis" style="fill:none" cx="${NX}" cy="${NY}" r="${(T * M.P) / 2}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${(T * M.J) / 2}"/>
    ${[-1, 1].map((s) => `
    <polygon class="vis" style="fill:#fff" points="${dikdortgen(s, MOUTH_X, OUTER_X, M.V / 2)}"/>
    <polygon class="thin" points="${dikdortgen(s, MOUTH_X + UC_I, OUTER_X - UC_D, M.V / 2 - UC_Y)}"/>`).join('')}
    ${extV(NX - T * MOUTH_X, NY - (T * M.V) / 2 - 4, NY - 126)}
    ${extV(NX + T * MOUTH_X, NY - (T * M.V) / 2 - 4, NY - 126)}
    ${hdim(NX - T * MOUTH_X, NX + T * MOUTH_X, NY - 122, `A ≥ ${fmt(M.A)}`)}
    <text class="h" x="${NX}" y="${NY + 146}" text-anchor="middle">AĞIZ</text>
    <text class="ts" x="${NX}" y="${NY + 166}" text-anchor="middle">uçtan bakış · dış düz yüzler arası ${fmt(2 * OUTER_X)}</text>`;

const kesitA = `
    <line class="ctr" x1="${CX - 118}" y1="${NY}" x2="${CX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${CX}" y1="${NY - 118}" x2="${CX}" y2="${NY + 118}"/>
    <polygon class="vis" fill="url(#h1)" points="${sapKesit()}"/>
    <circle class="hid" cx="${CX}" cy="${NY}" r="${HS * SAP_R}"/>
    ${extH(CX, CX + 140, NY - HS * KV_R)}
    ${extH(CX, CX + 140, NY + HS * KV_R)}
    ${vdim(CX + 136, NY - HS * KV_R, NY + HS * KV_R, `SW ${fmt(KV_SW)}`)}
    <text class="h" x="${CX}" y="${NY + 146}" text-anchor="middle">KESİT A–A</text>
    <text class="ts" x="${CX}" y="${NY + 166}" text-anchor="middle">altıgen · kesikli daire sap Ø${fmt(M.S)} · köşeler bu çapta</text>`;

// ---------------- işleme sırası ve açık noktalar ----------------
const ISLEM = [
  `Torna: sap Ø${fmt(M.S)} × ${fmt(M.L)}, boyun Ø${fmt(M.N)}, halka Ø${fmt(M.Z)}, gövde Ø${fmt(M.D)}, ön kanal.`,
  `Torna: alın yuvası Ø${fmt(M.W)}, orta cep Ø${fmt(M.P)} × ${fmt(M.Q)}, delik Ø${fmt(M.J)}.`,
  `Freze (bölücülü): 2 açık ve 2 kilit kanalı, 90° aralıklı; altıgen SW ${fmt(KV_SW)} × ${fmt(KV_SON - KV_BAS)}.`,
  `Freze: iki tırnak ${fmt(M.V)} × ${fmt(M.U)}, dış düz yüzler ${fmt(2 * OUTER_X)}, uç pahları.`,
  `Isıl işlem: su verme + temperleme, ${spec.sertlik}. Yüzey: ${spec.yuzey}.`,
  'Deneme: SDS-Plus ve üç ayaklı mandrende oturma, sonra gerçek kelepçede tork testi.',
];

const ACIK = [
  'SDS kanal ölçüleri gerçek bir SDS-Plus uçtan ölçülecek; altıgenli sap SDS mandrende denenecek.',
  'Tırnaklar kelepçede nereye oturuyor: karşılıklı iki nokta mı, kaç mm genişlik?',
  `Tırnak boyu C ve eni V (şimdilik ${fmt(M.C)} × ${fmt(M.V)}).`,
  `Orta cep Ø${fmt(M.P)} × ${fmt(M.Q)} kelepçenin ortasındaki parçayı alıyor mu?`,
  'Gereken sıkma torku (N·m).',
];

const planlar = `
    <text class="tb" x="780" y="414">İŞLEME SIRASI</text>
    ${ISLEM.map((t, i) => `<text class="tn" x="780" y="${436 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}
    <text class="tb q" x="780" y="584">ÜRETİMDEN ÖNCE DOĞRULANACAK</text>
    ${ACIK.map((t, i) => `<text class="tn" x="780" y="${606 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}`;

// ---------------- notlar ----------------
const NOTES = [
  `${spec.onayli ? 'Ölçüler onaylıdır.' : 'Taslak: turuncu ölçüler varsayımdır, gerçek kelepçe ölçülmeden üretime verilmez.'} Çizim orantılıdır, değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Ağız açıklığı A en az ${fmt(M.A)}: +0,50 / 0.`,
  `Sap SDS-Plus: Ø${fmt(M.S)} × ${fmt(M.L)}, 2 açık + 2 kilit kanalı. Kanal ölçüleri gerçek bir SDS-Plus uçtan alınır, mandrende denenir.`,
  `Gövde ile sap ekseni arasında salgı en çok 0,10. Malzeme: ${spec.malzeme}.`,
  `Sertlik ${spec.sertlik}, yüzey ${spec.yuzey}. Keskin kenarlar 0,3 × 45°.`,
  `SDS-Plus matkapta darbe kapalı kullanılır. Altıgen köşeleri Ø${fmt(M.S)} içinde kalır, sap SDS mandrene girer.`,
  'Üç ayaklı mandrende uç halkaya dayanana kadar sürülür, çeneler altıgene oturur. 1/4″ altıgen mandrene girmez.',
];
const notes = NOTES.map((t, i) => `<text class="tn" x="40" y="${854 + i * 17}">${i + 1}. ${t}</text>`).join('\n    ');

const durumKisa = spec.onayli ? 'ONAYLI' : 'TASLAK';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/>
    </marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <style>
      .vis{stroke:#111;stroke-width:2.2;stroke-linejoin:round}
      polygon.vis:not([fill]){fill:#fff}
      .thin{fill:none;stroke:#111;stroke-width:1}
      .hid{fill:none;stroke:#111;stroke-width:1.2;stroke-dasharray:7 4}
      .ctr{fill:none;stroke:#555;stroke-width:0.9;stroke-dasharray:22 4 3 4}
      .dim{fill:none;stroke:#111;stroke-width:0.9}
      .dima{fill:none;stroke:#111;stroke-width:0.9;marker-start:url(#arr);marker-end:url(#arr)}
      .lead{fill:none;stroke:#111;stroke-width:0.9;marker-start:url(#arr)}
      .grid{fill:none;stroke:#111;stroke-width:1}
      .t{font-size:14px;fill:#111}
      .tb{font-size:14px;font-weight:700;fill:#111}
      .ts{font-size:12px;fill:#333}
      .tn{font-size:13px;fill:#111}
      .tl{font-size:10px;fill:#555;letter-spacing:.4px}
      .h{font-size:18px;font-weight:700;fill:#111;letter-spacing:.5px}
      .q{fill:#c2410c}
    </style>
  </defs>

  <rect x="0" y="0" width="1400" height="990" fill="#fff"/>
  <rect x="20" y="20" width="1360" height="950" class="grid" stroke-width="1.6"/>

  <g>${yarimKesit}
  </g>

  <g>${yanGorunus}
  </g>

  <g>${agiz}
  </g>

  <g>${kesitA}
  </g>

  <g>${planlar}
  </g>

  <g>
    <text class="tb" x="40" y="832">NOTLAR</text>
    ${notes}
  </g>

  <g>
    <rect x="780" y="780" width="580" height="175" class="grid" stroke-width="1.6"/>
    <path class="grid" d="M780 830 H1360 M780 872 H1360 M780 914 H1360"/>
    <path class="grid" d="M980 830 V914 M1180 830 V914"/>
    <text x="795" y="814" font-size="22" font-weight="700" fill="#111" letter-spacing=".5">KELEPÇE SIKMA UCU</text>
    <text class="ts" x="1345" y="814" text-anchor="end">Teknik resim</text>

    <text class="tl" x="790" y="845">MALZEME</text><text class="tb" x="790" y="864">Çelik ${spec.malzemeKisa}</text>
    <text class="tl" x="990" y="845">ÖLÇEK</text><text class="tb" x="990" y="864">Ölçeksiz</text>
    <text class="tl" x="1190" y="845">BİRİM</text><text class="tb" x="1190" y="864">mm</text>

    <text class="tl" x="790" y="887">REVİZYON</text><text class="tb" x="790" y="906">${spec.rev} — ${spec.onayli ? 'onaylı' : 'taslak'}</text>
    <text class="tl" x="990" y="887">TARİH</text><text class="tb" x="990" y="906">${spec.tarih}</text>
    <text class="tl" x="1190" y="887">DURUM</text><text class="tb${spec.onayli ? '' : ' q'}" x="1190" y="906">${durumKisa}</text>

    <text class="tl" x="790" y="929">REV ${spec.rev}</text>
    <text class="t" x="790" y="947">${spec.revNot}</text>
  </g>
</svg>
`;

await writeFile(path.join(ROOT, 'kelepce-ucu-taslak.svg'), svg);
console.log('SVG   kelepce-ucu-taslak.svg');
