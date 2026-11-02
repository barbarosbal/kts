// rekor-olculer.json → oynar-rekor-taslak.svg (teknik çizim sayfası)
// Kullanım: cd tools && npm run site
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(ROOT, 'rekor-olculer.json'), 'utf8'));
const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));

const BSP = { major: 47.803, minor: 44.845, pitch: 25.4 / 11, gauge: 12.7 };
const { ust, alt } = spec.uclar;
const CONTA = spec.conta;
const fmt = (n) => String(n).replace('.', ',');

const BORE_R = M.E / 2;
const NECK_R = M.N / 2;
const BACK_R = NECK_R + 0.1;
const RELIEF_R = 24.5;
const WIRE_R = M.T / 2;
const HEX_R = M.S / 2;
const FACE_Y = M.C + CONTA.kalinlik;
const NECK_TOP = M.H - M.L;
const WIRE_Y = M.B - M.W;
const FLAT_Y = [M.B + (M.U - M.A) / 2, M.B + (M.U + M.A) / 2];
const TEL_BOY = Math.round(Math.PI * M.N);

// ---------------- kesit ----------------
const AX = 350;
const S = 8;                               // 1 mm = 8 px
const BASE = 620;
const px = (r, side) => AX + side * S * r;
const py = (y) => BASE - S * y;
const poly = (pts, side) => pts.map(([r, y]) => `${px(r, side).toFixed(1)},${py(y).toFixed(1)}`).join(' ');

function arc(r, y, a0, a1, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([r + WIRE_R * Math.cos(a), y + WIRE_R * Math.sin(a)]);
  }
  return pts;
}

// Üst dış diş: serbest uçtan boyuna; R dişte çap 1:16 konik
function outerThread() {
  const conical = /^R/.test(ust.dis);
  const taper = (y) => (conical ? (M.H - y - BSP.gauge) / 32 : 0);
  const rootR = (y) => BSP.minor / 2 + taper(y);
  const crestR = (y) => BSP.major / 2 + taper(y);
  const pts = [[rootR(M.H) - 0.3, M.H]];
  for (let y = M.H - 0.8; y - BSP.pitch > NECK_TOP + 2; y -= BSP.pitch) {
    pts.push([crestR(y - BSP.pitch / 2), y - BSP.pitch / 2], [rootR(y - BSP.pitch), y - BSP.pitch]);
  }
  return pts;
}

// Bilezik iç dişi: çeltikten alın pahına
function innerThread() {
  const pts = [];
  for (let y = M.C; y - BSP.pitch > 0.8; y -= BSP.pitch) {
    pts.push([BSP.major / 2, y], [BSP.minor / 2, y - BSP.pitch / 2]);
  }
  pts.push([BSP.major / 2, 0.8]);
  return pts;
}

const bodyPts = [
  [BORE_R, M.H],
  ...outerThread(),
  [NECK_R, NECK_TOP],
  [NECK_R, FLAT_Y[1]],
  [M.K / 2, FLAT_Y[1]],
  [M.K / 2, FLAT_Y[0]],
  [NECK_R, FLAT_Y[0]],
  ...arc(NECK_R, WIRE_Y, 90, 270),
  [NECK_R, FACE_Y + 0.5],
  [NECK_R - 0.5, FACE_Y],
  [BORE_R, FACE_Y],
];

const nutPts = [
  [BSP.major / 2 + 0.8, 0],
  [HEX_R - 0.4, 0],
  [HEX_R, 0.23],
  [HEX_R, M.B - 0.23],
  [HEX_R - 0.4, M.B],
  [BACK_R + 0.4, M.B],
  [BACK_R, M.B - 0.4],
  ...arc(BACK_R, WIRE_Y, 90, -90),
  [BACK_R, M.C + 4],
  [RELIEF_R, M.C + 4],
  [RELIEF_R, M.C],
  ...innerThread(),
];

const gasketPts = [[CONTA.ic / 2, M.C], [CONTA.dis / 2, M.C], [CONTA.dis / 2, FACE_Y], [CONTA.ic / 2, FACE_Y]];

const section = [-1, 1].map((side) => `
    <polygon class="vis" fill="url(#h1)" points="${poly(bodyPts, side)}"/>
    <polygon class="vis" fill="url(#h2)" points="${poly(nutPts, side)}"/>
    <polygon class="thin" style="fill:#555" points="${poly(gasketPts, side)}"/>
    <circle cx="${px(NECK_R, side)}" cy="${py(WIRE_Y)}" r="${S * WIRE_R}" fill="#111"/>
    <path class="hid" d="M${px(20, side)} ${py(M.C)} V${py(-7)} M${px(BSP.major / 2, side)} ${py(M.C)} V${py(-7)}"/>`).join('');

// ---------------- ölçüler ----------------
function vdim(x, y0, y1, text) {
  return `
    <line class="dima" x1="${x}" y1="${py(y0)}" x2="${x}" y2="${py(y1)}"/>
    <rect x="${x - 25}" y="${(py(y0) + py(y1)) / 2 - 10}" width="50" height="20" fill="#fff"/>
    <text class="tb" x="${x}" y="${(py(y0) + py(y1)) / 2 + 5}" text-anchor="middle">${text}</text>`;
}

function ext(y, x0, x1) {
  return `<line class="dim" x1="${x0}" y1="${py(y)}" x2="${x1}" y2="${py(y)}"/>`;
}

function note(at, y, title, sub) {
  const [x, yAt] = at;
  return `
    <polyline class="lead" points="${x},${yAt} 612,${y + 6} 762,${y + 6}"/>
    <text class="tb" x="616" y="${y}">${title}</text>
    <text class="ts" x="616" y="${y + 22}">${sub}</text>`;
}

const dims = `
    ${ext(M.H, px(BSP.major / 2 - 2, -1), 37)}
    ${ext(NECK_TOP, px(NECK_R, -1) - 4, 67)}
    ${ext(M.B, px(HEX_R, -1) - 4, 67)}
    ${ext(0, px(HEX_R, -1) - 4, 37)}
    ${vdim(75, NECK_TOP, M.H, `L = ${M.L}`)}
    ${vdim(75, M.B, NECK_TOP, `U = ${M.U}`)}
    ${vdim(75, 0, M.B, `B = ${M.B}`)}
    ${vdim(45, 0, M.H, `H = ${M.H}`)}
    <line class="dim" x1="${px(BORE_R, -1)}" y1="${py(M.H) - 4}" x2="${px(BORE_R, -1)}" y2="88"/>
    <line class="dim" x1="${px(BORE_R, 1)}" y1="${py(M.H) - 4}" x2="${px(BORE_R, 1)}" y2="88"/>
    <line class="dima" x1="${px(BORE_R, -1)}" y1="92" x2="${px(BORE_R, 1)}" y2="92"/>
    <rect x="${AX - 42}" y="82" width="84" height="20" fill="#fff"/>
    <text class="tb" x="${AX}" y="97" text-anchor="middle">ØE = ${M.E}</text>
    <line class="dim" x1="${px(HEX_R, -1)}" y1="${py(0) + 4}" x2="${px(HEX_R, -1)}" y2="696"/>
    <line class="dim" x1="${px(HEX_R, 1)}" y1="${py(0) + 4}" x2="${px(HEX_R, 1)}" y2="696"/>
    <line class="dima" x1="${px(HEX_R, -1)}" y1="692" x2="${px(HEX_R, 1)}" y2="692"/>
    <rect x="${AX - 42}" y="682" width="84" height="20" fill="#fff"/>
    <text class="tb" x="${AX}" y="697" text-anchor="middle">SW ${M.S}</text>
    ${note([px(BSP.major / 2, 1), py(52)], 150, `${ust.dis} DIŞ DİŞ`, ust.sizdirmazlik)}
    ${note([px(M.K / 2, 1), py(34)], 262, `SW ${M.K} ANAHTAR YÜZÜ`, `K = ${M.K} · boy ${M.A} · iki yüz`)}
    ${note([px(NECK_R, 1), py(38.5)], 206, `BOYUN ÇELTİĞİ ØN = ${M.N}`, 'diş çıkışı · f7')}
    ${note([px(NECK_R + WIRE_R, 1), py(WIRE_Y)], 356, `TEL KİLİT Ø${M.T}`, `W = ${M.W} · çeltik Ø${M.N - M.T}`)}
    ${note([px(CONTA.dis / 2, 1), py(M.C + 1)], 446, 'KLİNGERİT CONTA', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`)}
    ${note([px(BSP.major / 2, 1), py(6)], 536, `${alt.dis} İÇ DİŞ`, `C = ${M.C} · Parça 1 üst ucu`)}`;

// ---------------- üstten görünüm ----------------
const TX = 1070;
const TY = 250;
const T = 5;                               // 1 mm = 5 px
const corner = HEX_R / Math.cos(Math.PI / 6);
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  return `${(TX + T * corner * Math.sin(a)).toFixed(1)},${(TY + T * corner * Math.cos(a)).toFixed(1)}`;
}).join(' ');
const holeZ = NECK_R + 0.05;
const holeX = -(HEX_R - holeZ * Math.sin(Math.PI / 3)) / Math.cos(Math.PI / 3);
const chord = Math.sqrt(NECK_R ** 2 - (M.K / 2) ** 2);

const topView = `
    <line class="ctr" x1="${TX - 195}" y1="${TY}" x2="${TX + 195}" y2="${TY}"/>
    <line class="ctr" x1="${TX}" y1="${TY - 195}" x2="${TX}" y2="${TY + 195}"/>
    <polygon class="vis" points="${hex}"/>
    <circle class="thin" cx="${TX}" cy="${TY}" r="${T * (HEX_R - 0.4)}"/>
    <circle class="vis" cx="${TX}" cy="${TY}" r="${(T * BSP.major) / 2}"/>
    <path class="thin" d="M${TX} ${TY - (T * BSP.minor) / 2} A${(T * BSP.minor) / 2} ${(T * BSP.minor) / 2} 0 1 0 ${TX + (T * BSP.minor) / 2} ${TY}"/>
    <circle class="vis" cx="${TX}" cy="${TY}" r="${T * BORE_R}"/>
    <path class="hid" d="M${TX - (T * M.K) / 2} ${TY - T * chord} V${TY + T * chord} M${TX + (T * M.K) / 2} ${TY - T * chord} V${TY + T * chord}"/>
    <path class="hid" d="M${TX} ${TY + T * (holeZ - WIRE_R)} H${TX + T * holeX} M${TX} ${TY + T * (holeZ + WIRE_R)} H${TX + T * holeX}"/>
    <polyline class="lead" points="${TX + T * (holeX + 8)},${TY + T * holeZ} ${TX - 260},${TY + 170} ${TX - 170},${TY + 170}"/>
    <text class="ts" x="${TX - 262}" y="${TY + 188}">tel deliği, çeltiğe teğet</text>
    <text class="h" x="${TX}" y="${TY + 215}" text-anchor="middle">ÜSTTEN GÖRÜNÜM</text>`;

// ---------------- parça listesi ----------------
const ROWS = [
  ['1', 'Gövde', '1', `Pirinç ${spec.malzemeKisa}`, `Boy ${M.H - FACE_Y}`],
  ['2', 'Bilezik', '1', `Pirinç ${spec.malzemeKisa}`, `SW ${M.S} × ${M.B}`],
  ['3', 'Tel kilit', '1', spec.tel.malzeme, `Ø${M.T} × ${TEL_BOY}`],
  ['4', 'Conta', '1', 'Klingerit', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`],
];
const COLS = [790, 850, 1000, 1080, 1250];
const rowY = (i) => 526 + i * 26;
const parts = `
    <text class="tb" x="780" y="500">PARÇA LİSTESİ</text>
    <rect x="780" y="508" width="580" height="26" fill="#eee"/>
    <rect x="780" y="508" width="580" height="130" class="grid"/>
    <path class="grid" d="M780 534 H1360 M780 560 H1360 M780 586 H1360 M780 612 H1360"/>
    <path class="grid" d="M840 508 V638 M990 508 V638 M1070 508 V638 M1240 508 V638"/>
    <g class="tb" font-size="13">${['No', 'Parça', 'Adet', 'Malzeme', 'Ölçü'].map((t, i) => `<text x="${COLS[i]}" y="${rowY(0)}">${t}</text>`).join('')}</g>
    <g class="tn">${ROWS.map((row, j) => row.map((t, i) => `<text x="${COLS[i]}" y="${rowY(j + 1)}">${t}</text>`).join('')).join('')}</g>`;

// ---------------- notlar ----------------
const NOTES = [
  `Taslak: ölçüler öneridir, onaydan sonra kesinleşir. Kesit orantılı çizildi; değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Boyun ØN ${M.N} f7, bilezik sırt deliği Ø${fmt(BACK_R * 2)} H8: bilezik serbest dönmeli.`,
  `Üst uç ${ust.dis} (ISO 7-1, konik 1:16), ${ust.sizdirmazlik}. Bilezik ${alt.dis} (ISO 228-1), Parça 1 üst dişine oturur.`,
  `Montaj: bilezik gövdeye conta tarafından geçirilir, tel Ø${M.T} teğet delikten çeltiğe sürülür, delik kapatılır.`,
  `Conta alnı düz, çapaksız, Ra 1,6. Keskin kenarlar 0,3–0,5 × 45°.`,
  `Malzeme: ${spec.malzeme}, EN 10204 3.1 sertifikalı.`,
];
const notes = NOTES.map((t, i) => `<text class="tn" x="40" y="${854 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ');

const durumKisa = spec.onayli ? 'ONAYLI' : 'TASLAK';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/>
    </marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <pattern id="h2" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <style>
      .vis{stroke:#111;stroke-width:2.2;stroke-linejoin:round}
      circle.vis,polygon.vis:not([fill]){fill:none}
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

  <g>
    <line class="ctr" x1="${AX}" y1="104" x2="${AX}" y2="676"/>
    ${section}
    ${dims}
    <text class="h" x="${AX}" y="740" text-anchor="middle">KESİT</text>
    <text class="ts" x="${AX}" y="760" text-anchor="middle">anahtar yüzlerinden · tel kilitli, bilezik boşta · kesikli çizgi Parça 1 üst ucu</text>
  </g>

  <g>${topView}
  </g>

  <g>${parts}
  </g>

  <g>
    <text class="tb" x="40" y="832">NOTLAR</text>
    ${notes}
  </g>

  <g>
    <rect x="780" y="780" width="580" height="175" class="grid" stroke-width="1.6"/>
    <path class="grid" d="M780 830 H1360 M780 872 H1360 M780 914 H1360"/>
    <path class="grid" d="M980 830 V914 M1180 830 V914"/>
    <text x="795" y="814" font-size="22" font-weight="700" fill="#111" letter-spacing=".5">OYNAR REKOR</text>
    <text class="ts" x="1345" y="814" text-anchor="end">Teknik resim</text>

    <text class="tl" x="790" y="845">MALZEME</text><text class="tb" x="790" y="864">Pirinç ${spec.malzemeKisa}</text>
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

await writeFile(path.join(ROOT, 'oynar-rekor-taslak.svg'), svg);
console.log('SVG   oynar-rekor-taslak.svg');
