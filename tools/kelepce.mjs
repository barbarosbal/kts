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

const BODY_R = M.D / 2;
const SAP_R = M.E / 2;
const FLAT_R = M.S / 2;
const BODY_Y = M.L + M.T;
const SLOT_Y = M.H - M.C;
const CH_S = spec.pah.sap;
const CH_G = spec.pah.govde;
const CH_A = spec.pah.agiz;
const RHO = spec.kanal.yaricap;

// Türetilen ölçüler: ölçü değişince çizimle birlikte denetlenir
const TIRNAK = (M.D - M.A) / 2;
const TIRNAK_EN = 2 * Math.sqrt(BODY_R ** 2 - (M.A / 2) ** 2);
const TORK = Math.round(((Math.PI * M.G ** 3) / 16) * spec.akma * 0.577 / 1000);
if (TIRNAK < 3) console.warn(`UYARI: tırnak kalınlığı ${TIRNAK} mm, gövde çapı büyütülmeli`);
console.log(`UC    tırnak ${TIRNAK} × ${TIRNAK_EN.toFixed(1)} mm · kanal boynu akma torku ≈ ${TORK} N·m`);

// ---------------- profil ----------------
// Bilye kanalı yayı; rLim yüzeyine kadar
function kanal(rLim) {
  const cr = M.G / 2 + RHO;
  const phi = Math.acos((cr - rLim) / RHO);
  return Array.from({ length: 13 }, (_, i) => {
    const a = -phi + (2 * phi * i) / 12;
    return [cr - RHO * Math.cos(a), M.K + RHO * Math.sin(a)];
  });
}
const kanalBoy = (rLim) => RHO * Math.sin(Math.acos((M.G / 2 + RHO - rLim) / RHO));

// Üst yarı dış çizgi: [r, y]; rHex görünüşte altıgenin yarı genişliği
function profil(rHex) {
  const y0 = ((rHex - SAP_R + CH_S) / CH_S) * CH_S * 0.8;
  return [
    [SAP_R - CH_S, 0],
    [rHex, y0],
    ...kanal(rHex),
    [rHex, M.L],
    [SAP_R, M.L],
    [SAP_R, M.L + 1],
    [BODY_R, BODY_Y],
    [BODY_R, M.H - CH_G],
    [BODY_R - CH_G, M.H],
  ];
}

// Çatal: tırnak ucundan dibe, eksene kadar
function catal() {
  const a = M.A / 2;
  const arc = Array.from({ length: 9 }, (_, i) => {
    const t = (i / 8) * (Math.PI / 2);
    return [a - M.R + M.R * Math.cos(t), SLOT_Y + M.R - M.R * Math.sin(t)];
  });
  return [[a + CH_A, M.H], [a, M.H - CH_A], ...arc, [0, SLOT_Y]];
}

// ---------------- ön ve yan görünüş ----------------
const S = 8;                               // 1 mm = 8 px
const X0 = 120;
const A1 = 196;                            // ön görünüş ekseni
const A2 = 540;                            // yan görünüş ekseni
const X1 = X0 + S * M.H;
const vx = (y) => X0 + S * y;
const vy = (axis, r) => axis - S * r;

const poly = (axis, upper) => {
  const pts = [...upper, ...upper.map(([r, y]) => [-r, y]).reverse()];
  return pts.map(([r, y]) => `${vx(y).toFixed(1)},${vy(axis, r).toFixed(1)}`).join(' ');
};

const cross = (axis, y, r0, r1, cls = 'thin') => `<line class="${cls}" x1="${vx(y)}" y1="${vy(axis, r0)}" x2="${vx(y)}" y2="${vy(axis, r1)}"/>`;
const along = (axis, r, y0, y1, cls = 'thin') => `<line class="${cls}" x1="${vx(y0)}" y1="${vy(axis, r)}" x2="${vx(y1)}" y2="${vy(axis, r)}"/>`;

// Kısa ölçüde yazı çizginin üstüne çıkar, oklar görünür kalır
function hdim(x0, x1, y, text, q = '') {
  const kisa = x1 - x0 < 90;
  return `
    <line class="dima" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>
    ${kisa ? '' : `<rect x="${(x0 + x1) / 2 - 34}" y="${y - 10}" width="68" height="20" fill="#fff"/>`}
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
    <polyline class="lead" points="${x},${y} ${tx - 4},${ty + 6} ${tx + 230},${ty + 6}"/>
    <text class="tb${q}" x="${tx}" y="${ty}">${title}</text>
    <text class="ts" x="${tx}" y="${ty + 22}">${sub}</text>`;
}

const K = kanalBoy(SAP_R);
const KF = kanalBoy(FLAT_R);
const KENAR = M.S / Math.sqrt(3) / 2;      // ön görünüşte altıgen kenarı
const KIRIS = TIRNAK_EN / 2;

const onGorunus = `
    <line class="ctr" x1="${X0 - 26}" y1="${A1}" x2="${X1 + 22}" y2="${A1}"/>
    <polygon class="vis" points="${poly(A1, [...profil(SAP_R), ...catal()])}"/>
    ${cross(A1, M.L, -SAP_R, SAP_R)}
    ${cross(A1, M.L + 1, -SAP_R, SAP_R)}
    ${cross(A1, BODY_Y, -BODY_R, BODY_R)}
    ${[-1, 1].map((s) => `
    ${cross(A1, M.H - CH_G, s * (M.A / 2 + CH_A), s * BODY_R)}
    ${along(A1, s * KENAR, CH_S * 0.8, M.K - K)}
    ${along(A1, s * KENAR, M.K + K, M.L)}`).join('')}
    ${cross(A1, M.K - K, -SAP_R, SAP_R)}
    ${cross(A1, M.K + K, -SAP_R, SAP_R)}
    ${extV(vx(0), vy(A1, -SAP_R) + 4, A1 + 142)}
    ${extV(vx(M.L), vy(A1, -SAP_R) + 4, A1 + 114)}
    ${extV(vx(SLOT_Y), A1 + 8, A1 + 114)}
    ${extV(X1, vy(A1, -BODY_R + CH_G) + 4, A1 + 142)}
    ${extH(vx(M.H - CH_A), X1 + 46, vy(A1, M.A / 2))}
    ${extH(vx(M.H - CH_A), X1 + 46, vy(A1, -M.A / 2))}
    ${hdim(vx(0), vx(M.L), A1 + 110, `L = ${fmt(M.L)}`)}
    ${hdim(vx(SLOT_Y), X1, A1 + 110, `C = ${fmt(M.C)}`, onDeger('C'))}
    ${hdim(vx(0), X1, A1 + 138, `H = ${fmt(M.H)}`)}
    ${vdim(X1 + 42, vy(A1, M.A / 2), vy(A1, -M.A / 2), `A = ${fmt(M.A)}`, onDeger('A'))}
    ${note([vx(SLOT_Y + 0.6), vy(A1, M.A / 2 - 0.6)], 410, 44, `ÇATAL DİBİ R ${fmt(M.R)}`, 'keskin köşe bırakılmaz')}
    ${note([vx(5), vy(A1, FLAT_R)], 100, 44, '1/4″ ALTIGEN SAP', `E 6.3 · matkap ve vidalama · SW ${fmt(M.S)}`)}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A1 + 176}" text-anchor="middle">ÖN GÖRÜNÜŞ</text>`;

const yanGorunus = `
    <line class="ctr" x1="${X0 - 26}" y1="${A2}" x2="${X1 + 22}" y2="${A2}"/>
    <polygon class="vis" points="${poly(A2, profil(FLAT_R))}"/>
    ${cross(A2, M.L + 1, -SAP_R, SAP_R)}
    ${cross(A2, BODY_Y, -BODY_R, BODY_R)}
    ${cross(A2, M.H - CH_G, -BODY_R, BODY_R)}
    ${cross(A2, M.K - KF, -FLAT_R, FLAT_R)}
    ${cross(A2, M.K + KF, -FLAT_R, FLAT_R)}
    ${cross(A2, SLOT_Y, -KIRIS, KIRIS, 'hid')}
    ${cross(A2, SLOT_Y + M.R, -KIRIS, KIRIS, 'hid')}
    ${cross(A2, M.H - CH_A, -KIRIS, KIRIS, 'hid')}
    ${along(A2, KIRIS, SLOT_Y, M.H, 'hid')}
    ${along(A2, -KIRIS, SLOT_Y, M.H, 'hid')}
    <path class="dim" d="M${vx(17)} ${vy(A2, BODY_R)} V${vy(A2, FLAT_R) - 14} M${vx(17)} ${vy(A2, -FLAT_R) + 14} V${vy(A2, -BODY_R)}"/>
    <text class="tb" x="${vx(17)}" y="${vy(A2, BODY_R) - 8}" text-anchor="middle">A</text>
    <text class="tb" x="${vx(17)}" y="${vy(A2, -BODY_R) + 20}" text-anchor="middle">A</text>
    ${extV(vx(0), vy(A2, -FLAT_R) + 4, A2 + 114)}
    ${extV(vx(M.K), vy(A2, -FLAT_R) + 4, A2 + 114)}
    ${extV(vx(M.L), vy(A2, -SAP_R) + 4, A2 + 114)}
    ${extV(vx(BODY_Y), vy(A2, -BODY_R) + 4, A2 + 114)}
    ${extH(vx(0) - 44, vx(0) - 4, vy(A2, FLAT_R))}
    ${extH(vx(0) - 44, vx(0) - 4, vy(A2, -FLAT_R))}
    ${extH(vx(M.H) - 8, X1 + 46, vy(A2, BODY_R))}
    ${extH(vx(M.H) - 8, X1 + 46, vy(A2, -BODY_R))}
    ${hdim(vx(0), vx(M.K), A2 + 110, `K = ${fmt(M.K)}`, onDeger('K'))}
    ${hdim(vx(M.L), vx(BODY_Y), A2 + 110, `T = ${fmt(M.T)}`)}
    ${vdim(vx(0) - 40, vy(A2, FLAT_R), vy(A2, -FLAT_R), `SW ${fmt(M.S)}`)}
    ${vdim(X1 + 42, vy(A2, BODY_R), vy(A2, -BODY_R), `ØD = ${fmt(M.D)}`)}
    ${note([vx(M.K), vy(A2, M.G / 2)], 100, 398, `BİLYE KANALI Ø${fmt(M.G)} × R${RHO}`, 'gerçek E 6.3 bite göre kontrol edilir', onDeger('G'))}
    ${note([vx(SLOT_Y + 8), vy(A2, KIRIS)], 410, 398, `TIRNAK ${fmt(TIRNAK)} × ${fmt(TIRNAK_EN.toFixed(1))}`, 'kesikli çizgi: çatal kanalı arkada')}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A2 + 148}" text-anchor="middle">YAN GÖRÜNÜŞ</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A2 + 168}" text-anchor="middle">ön görünüşe göre 90° döndürülmüş</text>`;

// ---------------- çatal ucu ve altıgen kesit ----------------
const T = 8;
const NX = 930;
const NY = 196;
const CX = 1200;
const HS = 25;                             // A–A ölçeği: 1 mm = 25 px

// Tırnak alnı (çember parçası): s = ±1
function tirnak(s) {
  const a0 = Math.acos((M.A / 2 + CH_A) / (BODY_R - CH_G));
  const pts = Array.from({ length: 25 }, (_, i) => {
    const t = -a0 + (2 * a0 * i) / 24;
    return [(BODY_R - CH_G) * Math.cos(t), (BODY_R - CH_G) * Math.sin(t)];
  });
  return pts.map(([x, z]) => `${(NX + s * T * x).toFixed(1)},${(NY + T * z).toFixed(1)}`).join(' ');
}

const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  const r = (HS * M.S) / Math.sqrt(3);
  return `${(CX + r * Math.cos(a)).toFixed(1)},${(NY + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const uctan = `
    <line class="ctr" x1="${NX - 118}" y1="${NY}" x2="${NX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 118}" x2="${NX}" y2="${NY + 118}"/>
    <circle class="vis" style="fill:none" cx="${NX}" cy="${NY}" r="${T * BODY_R}"/>
    <polygon class="vis" style="fill:#fff" points="${tirnak(1)}"/>
    <polygon class="vis" style="fill:#fff" points="${tirnak(-1)}"/>
    ${[-1, 1].map((s) => `
    <line class="thin" x1="${NX + (s * T * M.A) / 2}" y1="${NY - T * KIRIS}" x2="${NX + (s * T * M.A) / 2}" y2="${NY + T * KIRIS}"/>
    <line class="hid" x1="${NX + s * T * (M.A / 2 - M.R)}" y1="${NY - T * KIRIS}" x2="${NX + s * T * (M.A / 2 - M.R)}" y2="${NY + T * KIRIS}"/>`).join('')}
    ${extV(NX - (T * M.A) / 2, NY - T * KIRIS - 4, NY - 124)}
    ${extV(NX + (T * M.A) / 2, NY - T * KIRIS - 4, NY - 124)}
    ${hdim(NX - (T * M.A) / 2, NX + (T * M.A) / 2, NY - 120, `A = ${fmt(M.A)}`, onDeger('A'))}
    <text class="h" x="${NX}" y="${NY + 146}" text-anchor="middle">ÇATAL UCU</text>
    <text class="ts" x="${NX}" y="${NY + 166}" text-anchor="middle">uçtan bakış · tırnak ${fmt(TIRNAK)} × ${fmt(TIRNAK_EN.toFixed(1))}</text>`;

const kesitA = `
    <line class="ctr" x1="${CX - 118}" y1="${NY}" x2="${CX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${CX}" y1="${NY - 118}" x2="${CX}" y2="${NY + 118}"/>
    <polygon class="vis" fill="url(#h1)" points="${hex}"/>
    <circle class="thin" cx="${CX}" cy="${NY}" r="${(HS * M.E) / 2}"/>
    <circle class="hid" cx="${CX}" cy="${NY}" r="${(HS * M.G) / 2}"/>
    ${extH(CX + 48, CX + 130, NY - (HS * M.S) / 2)}
    ${extH(CX + 48, CX + 130, NY + (HS * M.S) / 2)}
    ${vdim(CX + 126, NY - (HS * M.S) / 2, NY + (HS * M.S) / 2, `SW ${fmt(M.S)}`)}
    <text class="h" x="${CX}" y="${NY + 146}" text-anchor="middle">KESİT A–A</text>
    <text class="ts" x="${CX}" y="${NY + 166}" text-anchor="middle">köşe Ø${fmt(M.E)} · kesikli daire kanal dibi Ø${fmt(M.G)}</text>`;

// ---------------- işleme sırası ve açık noktalar ----------------
const ISLEM = [
  `Torna: gövde Ø${fmt(M.D)}, geçiş, Ø${fmt(M.E)} sap, bilye kanalı.`,
  `Freze (bölücülü): altıgenin 6 yüzeyi, SW ${fmt(M.S)} × ${fmt(M.L)}.`,
  `Freze: çatal kanalı ${fmt(M.A)} × ${fmt(M.C)}, dip köşe R ${fmt(M.R)}, ağız pahı ${CH_A} × 45°.`,
  `Isıl işlem: su verme + temperleme, ${spec.sertlik}.`,
  `Yüzey: ${spec.yuzey}. Altıgen ve çatal ölçüsü işlem sonrası kontrol edilir.`,
  'Deneme: vidalama mandreninde kilitlenme, sonra gerçek kelepçede tork testi.',
];

const ACIK = [
  'Kelepçe mekanizması: çatal kulakları döndürüyor mu, sıkma vida / somundan mı?',
  `Çatal açıklığı A ve derinliği C (şimdilik ${fmt(M.A)} × ${fmt(M.C)}).`,
  'Gereken sıkma torku (N·m).',
  `Gövde Ø${fmt(M.D)} ve boy ${fmt(M.H)} kelepçenin çevresine sığıyor mu?`,
];

const planlar = `
    <text class="tb" x="780" y="414">İŞLEME SIRASI</text>
    ${ISLEM.map((t, i) => `<text class="tn" x="780" y="${436 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}
    <text class="tb q" x="780" y="584">ÜRETİMDEN ÖNCE DOĞRULANACAK</text>
    ${ACIK.map((t, i) => `<text class="tn" x="780" y="${606 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}`;

// ---------------- notlar ----------------
const NOTES = [
  `${spec.onayli ? 'Ölçüler onaylıdır.' : 'Taslak: turuncu ölçüler varsayımdır, gerçek kelepçe ölçülmeden üretime verilmez.'} Çizim orantılıdır, değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Altıgen SW ${fmt(M.S)} +0 / −0,10. Çatal açıklığı A +0,20 / +0,05.`,
  'Sap ISO 1173 E 6.3 (1/4″) uyumlu olacak. Kanal konumu ve çapı ön değerdir, gerçek bir E 6.3 bite göre kontrol edilir.',
  `Gövde ile altıgen ekseni arasında salgı en çok 0,10. Malzeme: ${spec.malzeme}.`,
  `Sertlik ${spec.sertlik}, yüzey ${spec.yuzey}. Keskin kenarlar 0,3 × 45°.`,
  `En zayıf kesit Ø${fmt(M.G)} kanal boynu, akma torku yaklaşık ${TORK} N·m. Tork ayarlı kullanılır, darbeli vidalamaya uygun değildir.`,
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

  <g>${onGorunus}
  </g>

  <g>${yanGorunus}
  </g>

  <g>${uctan}
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
