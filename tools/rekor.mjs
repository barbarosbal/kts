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
const COLLAR_R = M.D / 2;
const HEX_R = M.S / 2;
const SPIGOT_Y = M.C + 1;
const FACE_Y = M.C + CONTA.kalinlik;
const COLLAR_TOP = FACE_Y + M.T;
const NECK_TOP = M.H - M.L;
const LIP = M.B - COLLAR_TOP;

// ---------------- kesit ----------------
const AX = 350;
const S = 7.5;                             // 1 mm = 7,5 px
const BASE = 590;
const px = (r, side) => AX + side * S * r;
const py = (y) => BASE - S * y;
const poly = (pts, side) => pts.map(([r, y]) => `${px(r, side).toFixed(1)},${py(y).toFixed(1)}`).join(' ');

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
  [NECK_R, COLLAR_TOP],
  [COLLAR_R - 0.5, COLLAR_TOP],
  [COLLAR_R, COLLAR_TOP - 0.5],
  [COLLAR_R, FACE_Y + 0.5],
  [COLLAR_R - 0.5, FACE_Y],
  [CONTA.ic / 2 - 0.25, FACE_Y],
  [CONTA.ic / 2 - 0.25, SPIGOT_Y],
  [BORE_R, SPIGOT_Y],
];

const nutPts = [
  [BSP.major / 2 + 0.8, 0],
  [HEX_R - 0.4, 0],
  [HEX_R, 0.23],
  [HEX_R, M.B - 0.23],
  [HEX_R - 0.4, M.B],
  [M.W / 2 + 0.4, M.B],
  [M.W / 2, M.B - 0.4],
  [M.W / 2, COLLAR_TOP],
  [M.G / 2, COLLAR_TOP],
  [M.G / 2, M.C],
  ...innerThread(),
];

const gasketPts = [[CONTA.ic / 2, M.C], [CONTA.dis / 2, M.C], [CONTA.dis / 2, FACE_Y], [CONTA.ic / 2, FACE_Y]];

const section = [-1, 1].map((side) => `
    <polygon class="vis" fill="url(#h1)" points="${poly(bodyPts, side)}"/>
    <polygon class="vis" fill="url(#h2)" points="${poly(nutPts, side)}"/>
    <polygon class="thin" style="fill:#555" points="${poly(gasketPts, side)}"/>
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

function hdim(r, y, text) {
  const edge = y < py(M.H) ? py(M.H) - 4 : py(0) + 4;
  return `
    <line class="dim" x1="${px(r, -1)}" y1="${edge}" x2="${px(r, -1)}" y2="${y}"/>
    <line class="dim" x1="${px(r, 1)}" y1="${edge}" x2="${px(r, 1)}" y2="${y}"/>
    <line class="dima" x1="${px(r, -1)}" y1="${y}" x2="${px(r, 1)}" y2="${y}"/>
    <rect x="${AX - 42}" y="${y - 10}" width="84" height="20" fill="#fff"/>
    <text class="tb" x="${AX}" y="${y + 5}" text-anchor="middle">${text}</text>`;
}

function note(at, y, title, sub) {
  const [x, yAt] = at;
  return `
    <polyline class="lead" points="${x},${yAt} 620,${y + 6} 770,${y + 6}"/>
    <text class="tb" x="624" y="${y}">${title}</text>
    <text class="ts" x="624" y="${y + 22}">${sub}</text>`;
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
    ${hdim(BORE_R, 150, `ØE = ${M.E}`)}
    ${hdim(HEX_R, 664, `SW ${M.S}`)}
    ${note([px(BSP.major / 2, 1), py(44)], 186, `${ust.dis} DIŞ DİŞ`, ust.sizdirmazlik)}
    ${note([px(NECK_R, 1), py(31)], 252, `BOYUN ÇELTİĞİ ØN = ${M.N}`, 'diş çıkışı · bilezik burada döner')}
    ${note([px(M.W / 2 + 1, 1), py(25)], 318, `TIRNAK · KALINLIK ${LIP}`, `ağız W = ${fmt(M.W)} × A = ${fmt(M.A)}`)}
    ${note([px(COLLAR_R, 1), py(19)], 384, `YAKA ØD = ${M.D}`, `T = ${M.T} · iki yan kesik F = ${M.F}`)}
    ${note([px(CONTA.dis / 2, 1), py(M.C + 1)], 450, 'KLİNGERİT CONTA', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`)}
    ${note([px(BSP.major / 2, 1), py(6)], 516, `${alt.dis} İÇ DİŞ`, `C = ${M.C} · iç çeltik ØG = ${M.G}`)}`;

// ---------------- bilezik ağzı ve yaka ----------------
const T = 3.4;                             // 1 mm = 3,4 px
const NY = 210;
const NX = 950;
const CX = 1225;

const corner = HEX_R / Math.cos(Math.PI / 6);
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  return `${(NX + T * corner * Math.sin(a)).toFixed(1)},${(NY + T * corner * Math.cos(a)).toFixed(1)}`;
}).join(' ');

// Bilezik ağzı: dar ölçü X yönünde, tırnaklar sağda solda
const rA = (T * M.A) / 2;
const hw = (T * M.W) / 2;
const zc = Math.sqrt(rA ** 2 - hw ** 2);
const opening = `M${NX + hw} ${NY - zc} V${NY + zc} A${rA} ${rA} 0 0 1 ${NX - hw} ${NY + zc} V${NY - zc} A${rA} ${rA} 0 0 1 ${NX + hw} ${NY - zc} Z`;

// Yaka: kesikler Z yönünde, kulaklar sağda solda
const rD = T * COLLAR_R;
const hf = (T * M.F) / 2;
const xc = Math.sqrt(rD ** 2 - hf ** 2);
const collar = `M${CX - xc} ${NY - hf} H${CX + xc} A${rD} ${rD} 0 0 1 ${CX + xc} ${NY + hf} H${CX - xc} A${rD} ${rD} 0 0 1 ${CX - xc} ${NY - hf} Z`;

const views = `
    <line class="ctr" x1="${NX - 150}" y1="${NY}" x2="${NX + 150}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 155}" x2="${NX}" y2="${NY + 155}"/>
    <polygon class="vis" points="${hex}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${T * (HEX_R - 0.4)}"/>
    <path class="vis" style="fill:none" d="${opening}"/>
    <circle class="hid" cx="${NX}" cy="${NY}" r="${(T * BSP.major) / 2}"/>
    <text class="h" x="${NX}" y="${NY + 182}" text-anchor="middle">BİLEZİK AĞZI</text>
    <text class="ts" x="${NX}" y="${NY + 202}" text-anchor="middle">üstten · W = ${fmt(M.W)} × A = ${fmt(M.A)}</text>
    <line class="ctr" x1="${CX - 125}" y1="${NY}" x2="${CX + 125}" y2="${NY}"/>
    <line class="ctr" x1="${CX}" y1="${NY - 125}" x2="${CX}" y2="${NY + 125}"/>
    <path class="vis" style="fill:none" d="${collar}"/>
    <circle class="thin" cx="${CX}" cy="${NY}" r="${T * (CONTA.ic / 2 - 0.25)}"/>
    <circle class="vis" style="fill:none" cx="${CX}" cy="${NY}" r="${T * BORE_R}"/>
    <circle class="hid" cx="${CX}" cy="${NY}" r="${T * NECK_R}"/>
    <text class="h" x="${CX}" y="${NY + 182}" text-anchor="middle">YAKA</text>
    <text class="ts" x="${CX}" y="${NY + 202}" text-anchor="middle">alttan · ØD = ${M.D} · kesik F = ${M.F}</text>`;

// ---------------- parça listesi ----------------
const ROWS = [
  ['1', 'Gövde', '1', `Pirinç ${spec.malzemeKisa}`, `Boy ${M.H - SPIGOT_Y}`],
  ['2', 'Bilezik', '1', `Pirinç ${spec.malzemeKisa}`, `SW ${M.S} × ${M.B}`],
  ['3', 'Conta', '1', 'Klingerit', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`],
];
const COLS = [790, 850, 1000, 1080, 1250];
const rowY = (i) => 536 + i * 26;
const parts = `
    <text class="tb" x="780" y="510">PARÇA LİSTESİ</text>
    <rect x="780" y="518" width="580" height="26" fill="#eee"/>
    <rect x="780" y="518" width="580" height="104" class="grid"/>
    <path class="grid" d="M780 544 H1360 M780 570 H1360 M780 596 H1360"/>
    <path class="grid" d="M840 518 V622 M990 518 V622 M1070 518 V622 M1240 518 V622"/>
    <g class="tb" font-size="13">${['No', 'Parça', 'Adet', 'Malzeme', 'Ölçü'].map((t, i) => `<text x="${COLS[i]}" y="${rowY(0)}">${t}</text>`).join('')}</g>
    <g class="tn">${ROWS.map((row, j) => row.map((t, i) => `<text x="${COLS[i]}" y="${rowY(j + 1)}">${t}</text>`).join('')).join('')}</g>`;

// ---------------- notlar ----------------
const NOTES = [
  'Taslak: ölçüler öneridir, onaydan sonra kesinleşir. Kesit orantılı çizildi; değerler esastır.',
  `Genel tolerans ${spec.genelTolerans}. Bilezik boyunda serbest dönmeli; ağız ile yaka arasında çapta en az 0,5 mm boşluk kalır.`,
  `Üst uç ${ust.dis} (ISO 7-1, konik 1:16), ${ust.sizdirmazlik}. Bilezik ${alt.dis} (ISO 228-1), Parça 1 üst dişine oturur.`,
  'Montaj: kesikler hizalıyken yaka bilezik ağzından geçer, 90° çevrilince tırnaklar yakaya basar.',
  'Sıkılı konumda kesikler hizaya ±15° yaklaşmamalı. Bilezik ve yakaya işaret vurulur; gerekirse conta kalınlığı değiştirilir.',
  `Gövde, bilezik takılmadan yaka kesiklerinden SW ${M.F} anahtarla sıkılır. Conta alnı düz, Ra 1,6. Keskin kenarlar 0,3–0,5 × 45°.`,
  `Malzeme: ${spec.malzeme}, EN 10204 3.1 sertifikalı.`,
];
const notes = NOTES.map((t, i) => `<text class="tn" x="40" y="${854 + i * 17}">${i + 1}. ${t}</text>`).join('\n    ');

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
      polygon.vis:not([fill]){fill:none}
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
    <line class="ctr" x1="${AX}" y1="164" x2="${AX}" y2="648"/>
    ${section}
    ${dims}
    <text class="h" x="${AX}" y="716" text-anchor="middle">KESİT</text>
    <text class="ts" x="${AX}" y="736" text-anchor="middle">kilitli konum: tırnaklar yakaya basar · kesikli çizgi Parça 1 üst ucu</text>
  </g>

  <g>${views}
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
