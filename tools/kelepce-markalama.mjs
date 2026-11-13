// kelepce-olculer.json → kelepce-ucu-markalama.svg (lazer kazıma resmi)
// Atölyenin lazer kazıma için istediği tek sayfa: markalamanın yeri (yan görünüş, uçtan açısal konum),
// logonun kendisi (açınım 5:1), yöntem ve kabul şartları. 1:1 vektör dosyaları (DXF, SVG) kelepce-paket.mjs'te yazılır.
// Kullanım: cd tools && npm run site
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, oku, fmt, uc, gorunus, hdim, vdim, extV, extH, sayfa, logoOku, logoYollari } from './kelepce-ortak.mjs';

const spec = await oku('kelepce-olculer.json');
const U = uc(spec);
const { M, BODY_R, NECK_R, RING_R, FACE_Y, MOUTH_X, OUTER_X, RING_0, RING_1, GROOVE_Y, GROOVE_D, CH_G, UC_D, UC_Y, KV_R, KIRIS, boyunHalka, tirnakEn } = U;
const BODY_Y = M.L + M.T;                  // A: gövde arka yüzü
const MARK = spec.markalama;
const LOGO = await logoOku(MARK.logo);
const { LW, LH } = LOGO;
const MK = MARK.yukseklik / LH;            // logo birimi → mm
const MARK_Y = BODY_Y + MARK.alt;          // logonun alt kenarı (arka yüze yakın kenar)
const MARK_UST = MARK_Y + MARK.yukseklik;  // harf üstleri, tırnak tarafı
const YAY = LW * MK;                       // çevre yönünde yay boyu
const ACI = (YAY / BODY_R) * (180 / Math.PI);
const SEHIM = BODY_R * (1 - Math.cos(YAY / BODY_R / 2)); // düz markalamada odak farkı
const BANT = [BODY_Y + CH_G, GROOVE_Y - GROOVE_D];       // markalanabilir düz silindir bandı
if (MARK_Y < BANT[0] + 1 || MARK_UST > BANT[1] - 1) console.warn(`UYARI: logo ${MARK_Y}–${MARK_UST}, düz bandın (${BANT[0]}–${BANT[1]}) kenarına 1 mm'den yakın`);
console.log(`MARKA ${fmt(MARK.yukseklik)} × ${YAY.toFixed(2)} yay (${ACI.toFixed(1)}°) · arka yüzden ${MARK.alt} · sehim ${SEHIM.toFixed(1)} mm`);

const f1 = (n) => fmt(+n.toFixed(1));
const logoDosya = (rev) => `kelepce-ucu-rev${rev}-logo-1-1`; // kelepce-paket.mjs ile aynı ad
const LOGO_DOSYA = logoDosya(spec.rev);

// ---------------- yan görünüş: tırnak karşıdan, logo altında ----------------
const S = 7;                               // 1 mm = 7 px
const X0 = 120;
const A = 236;
const X1 = X0 + S * M.H;
const { vx, vy, tumu, cross, along } = gorunus(S, X0);
const sapYan = [[0, 0], ...U.sapYanYol];
const govde = [
  ...boyunHalka.slice(2),
  [NECK_R, BODY_Y],
  [BODY_R - CH_G, BODY_Y],
  [BODY_R, BODY_Y + CH_G],
  [BODY_R, GROOVE_Y - GROOVE_D],
  [BODY_R - GROOVE_D, GROOVE_Y],
];
const yanYari = [...sapYan, ...govde, ...tirnakEn];
const logoNokta = (u, v) => [X0 + S * (MARK_UST - v * MK), A + S * BODY_R * Math.sin(((u - LW / 2) * MK) / BODY_R)];
const LOGO_Z = BODY_R * Math.sin(YAY / BODY_R / 2);      // görünüşte logonun yarı yüksekliği

// Bayrak notu: markalama yeri
const bayrak = (x, y, n = 1) => `
    <polygon class="thin" style="fill:#fff" points="${x},${y - 13} ${x + 13},${y + 9} ${x - 13},${y + 9}"/>
    <text class="tb" x="${x}" y="${y + 6}" text-anchor="middle" style="font-size:12px">${n}</text>`;

const yan = `
    <line class="ctr" x1="${X0 - 26}" y1="${A}" x2="${X1 + 22}" y2="${A}"/>
    <polygon class="vis" points="${tumu(A, yanYari)}"/>
    <rect x="${vx(MARK_Y)}" y="${A - S * LOGO_Z}" width="${S * MARK.yukseklik}" height="${2 * S * LOGO_Z}" fill="#e9edf1"/>
    ${logoYollari(LOGO.svg, logoNokta)}
    ${cross(A, RING_0, -RING_R, RING_R)}
    ${cross(A, RING_1, -RING_R, RING_R)}
    ${cross(A, BODY_Y + CH_G, -BODY_R, BODY_R)}
    ${cross(A, GROOVE_Y, GROOVE_D - BODY_R, BODY_R - GROOVE_D)}
    ${cross(A, FACE_Y, -M.V / 2, M.V / 2)}
    ${along(A, KIRIS, GROOVE_Y, FACE_Y)}
    ${along(A, -KIRIS, GROOVE_Y, FACE_Y)}
    ${cross(A, M.H - UC_D, UC_Y - M.V / 2, M.V / 2 - UC_Y)}
    ${extV(vx(BODY_Y), vy(A, -BODY_R) + 4, A + 182)}
    ${extV(vx(MARK_Y), vy(A, -LOGO_Z) + 4, A + 182)}
    ${extV(vx(MARK_UST), vy(A, -LOGO_Z) + 4, A + 150)}
    ${hdim(vx(BODY_Y), vx(MARK_Y), A + 178, fmt(MARK.alt))}
    ${hdim(vx(MARK_Y), vx(MARK_UST), A + 146, fmt(MARK.yukseklik))}
    ${extH(vx(MARK_UST) + 4, X1 + 108, vy(A, BODY_R))}
    ${extH(vx(MARK_UST) + 4, X1 + 108, vy(A, -BODY_R))}
    ${vdim(X1 + 104, vy(A, BODY_R), vy(A, -BODY_R), `Ø${fmt(M.D)}`)}
    <polygon fill="#111" points="${vx(BODY_Y) - 7},${A + 196} ${vx(BODY_Y) + 7},${A + 196} ${vx(BODY_Y)},${A + 184}"/>
    <rect class="thin" style="fill:#fff" x="${vx(BODY_Y) - 11}" y="${A + 196}" width="22" height="20"/>
    <text class="tb" x="${vx(BODY_Y)}" y="${A + 211}" text-anchor="middle">A</text>
    <polyline class="lead" points="${vx(MARK_Y + 2)},${A - S * LOGO_Z * 0.7} ${vx(BODY_Y) - 40},${A - 150} ${vx(BODY_Y) - 210},${A - 150}"/>
    ${bayrak(vx(BODY_Y) - 196, A - 162)}
    <text class="tb" x="${vx(BODY_Y) - 176}" y="${A - 157}">LAZER KAZIMA · LASER ENGRAVING</text>
    <text class="ts" x="${vx(BODY_Y) - 176}" y="${A - 139}">Ratel logosu, Ø${fmt(M.D)} gövdeye sarılır, 0,03–0,05 derin</text>
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A + 252}" text-anchor="middle">YAN GÖRÜNÜŞ · KAZIMA YERİ</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A + 272}" text-anchor="middle">tırnak karşıdan · logo altında ortalı · ölçek ≈ 2:1</text>`;

// ---------------- uçtan görünüş: açısal konum ----------------
const T = 6;
const NX = 1020;
const NY = 236;
const p = (r, a) => [NX + T * r * Math.cos(a), NY - T * r * Math.sin(a)]; // a: +X'ten saat yönü tersine
const yayYol = (r, a0, a1) => {
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${(T * r).toFixed(1)} ${(T * r).toFixed(1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};
const govdeUc = Array.from({ length: 180 }, (_, i) => {
  const a = (i * Math.PI) / 90;
  const x = Math.max(-OUTER_X, Math.min(OUTER_X, BODY_R * Math.cos(a)));
  return `${(NX + T * x).toFixed(1)},${(NY - T * BODY_R * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const tirnak = (s) => [[MOUTH_X, -M.V / 2], [OUTER_X, -M.V / 2], [OUTER_X, M.V / 2], [MOUTH_X, M.V / 2]]
  .map(([x, z]) => `${(NX + s * T * x).toFixed(1)},${(NY + T * z).toFixed(1)}`).join(' ');
const yarim = (YAY / BODY_R) / 2;
const [a0, a1] = [Math.PI - yarim, Math.PI + yarim];
const RD = BODY_R + 9;                     // açı ölçüsü yarıçapı
const ucGorunus = `
    <line class="ctr" x1="${NX - 140}" y1="${NY}" x2="${NX + 140}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 130}" x2="${NX}" y2="${NY + 130}"/>
    <polygon class="vis" style="fill:#fff" points="${govdeUc}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${(T * M.W) / 2}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${(T * M.P) / 2}"/>
    <polygon class="vis" style="fill:#fff" points="${tirnak(-1)}"/>
    <polygon class="vis" style="fill:#fff" points="${tirnak(1)}"/>
    <path d="${yayYol(BODY_R + 0.9, a0, a1)}" fill="none" stroke="#111" stroke-width="6"/>
    <line class="dim" x1="${p(BODY_R + 1.6, a0)[0]}" y1="${p(BODY_R + 1.6, a0)[1]}" x2="${p(RD + 3, a0)[0]}" y2="${p(RD + 3, a0)[1]}"/>
    <line class="dim" x1="${p(BODY_R + 1.6, a1)[0]}" y1="${p(BODY_R + 1.6, a1)[1]}" x2="${p(RD + 3, a1)[0]}" y2="${p(RD + 3, a1)[1]}"/>
    <path class="dima" d="${yayYol(RD, a0, a1)}"/>
    <rect x="${p(RD, Math.PI)[0] - 46}" y="${NY - 11}" width="44" height="22" fill="#fff"/>
    <text class="tb" x="${p(RD, Math.PI)[0] - 24}" y="${NY + 5}" text-anchor="middle">${Math.round(ACI)}°</text>
    <text class="tb" x="${NX + 152}" y="${NY + 5}">B</text>
    ${bayrak(p(RD + 6, Math.PI - yarim - 0.25)[0], p(RD + 6, Math.PI - yarim - 0.25)[1])}
    <text class="h" x="${NX}" y="${NY + 162}" text-anchor="middle">UÇTAN GÖRÜNÜŞ · AÇISAL KONUM</text>
    <text class="ts" x="${NX}" y="${NY + 182}" text-anchor="middle">tırnak tarafından · logo ortası tırnak ekseni B'de · yay ${f1(YAY)} = ${f1(ACI)}°</text>`;

// ---------------- açınım 5:1 ----------------
const K = 5 * (1400 / 420);                // 5:1 ölçek, px/mm (A3 sayfa 420 mm)
const AX = 150;
const AY = 600;
const W = K * YAY;
const H = K * MARK.yukseklik;
const acinim = `
    <rect x="${AX}" y="${AY}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#f3f5f7" stroke="#9aa3ab" stroke-width=".8" stroke-dasharray="4 3"/>
    ${logoYollari(LOGO.svg, (u, v) => [AX + K * MK * u, AY + K * MK * v])}
    ${extV(AX, AY - 4, AY - 40)}
    ${extV(AX + W, AY - 4, AY - 40)}
    ${hdim(AX, +(AX + W).toFixed(1), AY - 34, `${f1(YAY)} (yay boyu)`)}
    ${extH(AX - 4, AX - 52, AY)}
    ${extH(AX - 4, AX - 52, AY + H)}
    ${vdim(AX - 46, AY, +(AY + H).toFixed(1), fmt(MARK.yukseklik))}
    <text class="ts" x="${AX + W + 16}" y="${AY + 12}">↑ harf üstleri</text>
    <text class="ts" x="${AX + W + 16}" y="${AY + 28}">tırnak tarafında</text>
    <text class="ts" x="${AX + W + 16}" y="${AY + H}">↓ A yüzeyi tarafı</text>
    <text class="h" x="${AX}" y="${AY + H + 44}">AÇINIM · ÖLÇEK 5:1</text>
    <text class="ts" x="${AX}" y="${AY + H + 64}">Logo silindir yüzeyin açılmış hali; siyah alan kazınır; kesikli çerçeve yalnız ölçü içindir, kazınmaz.</text>
    <text class="ts" x="${AX}" y="${AY + H + 80}">Vektör dosyası 1:1, mm: ${LOGO_DOSYA}.dxf · ${LOGO_DOSYA}.svg</text>`;

// ---------------- kazıma şartları ----------------
const SARTLAR = [
  ['Yöntem', 'Fiber lazer kazıma (engraving); boya ve dolgu yok.'],
  ['Derinlik', '0,03–0,05 mm. Logo çelik renginde, mat; koyu (siyah) markalama olmaz.'],
  ['Eksen', `Döner eksenle (rotary) silindire sarılır. Düz kazıma olmaz:`],
  ['', `${f1(ACI)}° yayda kenarlar odaktan ${f1(SEHIM)} mm uzaklaşır.`],
  ['Konum', `Logo alt kenarı A yüzeyinden ${fmt(MARK.alt)} ±0,3; ortası B ekseninde ±3°.`],
  ['Boyut', `Yükseklik ${fmt(MARK.yukseklik)} ±0,2; yay ${f1(YAY)} ±0,5. Oranlar korunur.`],
  ['Yön', 'Harf üstleri tırnak tarafında; ayna ya da ters baskı olmaz.'],
  ['Sıra', 'Tüm işleme ve çapak almadan sonra, son işlem.'],
  ['Kabul', 'Kenarlar net, taban düzgün, derinlik eşit; kabartı, çapak ve'],
  ['', 'yanık izi yok; kazıma logonun dışına taşmaz. Kontrast aranmaz.'],
];
const sartlar = `
    ${bayrak(796, 466)}
    <text class="tb" x="816" y="471">KAZIMA ŞARTLARI · ENGRAVING REQUIREMENTS</text>
    ${SARTLAR.map(([k, v], i) => `<text class="tb" x="784" y="${502 + i * 21}" style="font-size:13px">${k}</text><text class="tn" x="866" y="${502 + i * 21}">${v}</text>`).join('\n    ')}`;

// ---------------- notlar ----------------
const NOTES = [
  'Bu resim yalnız lazer kazımayı tanımlar. Ölçü, malzeme ve toleranslar parçanın STEP modeli ve teknik resmindedir.',
  `Parça: kelepçe sıkma ucu Rev ${spec.rev}, ${spec.malzeme}, yüzey ${spec.yuzey}. Toplam boy ${fmt(M.H)}, gövde Ø${fmt(M.D)}.`,
  `A: gövde arka yüzü (sap tarafı). B: tırnak ekseni; iki tırnak simetrik, logo birinin altına gelir.`,
  `Kazıma bandı: A'dan ${f1(BANT[0] - BODY_Y)}–${f1(BANT[1] - BODY_Y)} mm arası düz silindir; logo bu bandın dışına taşmaz.`,
  'Logo yalnız vektör dosyasından basılır; yeniden çizilmez, yazı tipine çevrilmez.',
  'Çizim ISO 128 ve ISO 129-1, yazılar ISO 3098. Kazıma yeri ve yöntemi bayrak notuyla (1) gösterilir.',
];

const svg = sayfa(spec, {
  bloklar: [yan, ucGorunus, acinim, sartlar],
  notlar: NOTES,
  not: { baslik: 822, ilk: 846, adim: 18 },
  stil: '\n      .mark{fill:#111;stroke:none}',
  antet: { ad: 'KELEPÇE UCU · LAZER KAZIMA', malzeme: `Çelik ${spec.malzemeKisa}` },
});

await writeFile(path.join(ROOT, 'kelepce-ucu-markalama.svg'), svg);
console.log('SVG   kelepce-ucu-markalama.svg');
