// rekor-olculer.json → oynar-rekor-taslak.svg (teknik çizim sayfası) + sökme yolu denetimi
// Kullanım: cd tools && npm run site
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ROOT, spec, M, BSP, ust, alt, CONTA, BORE_R, NECK_R, COLLAR_R, HEX_R, SPIGOT_R, SEAT_Y, SPIGOT_Y, FACE_Y,
  COLLAR_TOP, NECK_TOP, LIP, CH_U, CH_B, CH_A, collarOutline, inCollar, contactArea,
} from './rekor-olcu.mjs';

const fmt = (n) => String(n).replace('.', ',');

// ---------------- sökme yolu denetimi ----------------
// Gövde noktaları bileziğin katı bölgesine girmeden yol tamamlanıyor mu? En küçük boşluğu bulur.
function bodyPoints() {
  const pts = [];
  const circle = (r, y, n = 48) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      pts.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
  };
  for (let y = COLLAR_TOP; y <= NECK_TOP; y += 1) circle(NECK_R, y);
  for (let y = NECK_TOP; y <= M.H; y += 2) circle(24.2, y);
  for (let y = SPIGOT_Y; y <= FACE_Y; y += 1) circle(SPIGOT_R, y);
  const outline = collarOutline();
  const [fu, fb] = [1 - CH_U / COLLAR_R, 1 - CH_B / COLLAR_R];
  for (const [x, z] of outline) {
    pts.push([x, (FACE_Y + COLLAR_TOP) / 2, z], [x, FACE_Y + CH_B, z], [x, COLLAR_TOP - CH_U, z]);
    pts.push([x * fb, FACE_Y, z * fb], [x * fu, COLLAR_TOP, z * fu]);
  }
  for (let x = -COLLAR_R; x <= COLLAR_R; x += 2) {
    for (let z = -M.F / 2; z <= M.F / 2; z += 2) {
      if (inCollar(x * 1.1, z * 1.1)) pts.push([x, FACE_Y, z], [x, COLLAR_TOP, z]);
    }
  }
  return pts;
}

// Nokta, m kadar şişirilmiş bilezik katısının içinde mi?
function inNut(q, m) {
  const r = Math.hypot(q[0], q[2]);
  const y = q[1];
  if (y < -m || y > M.B + m) return false;
  if (y >= COLLAR_TOP - m) return r >= M.W / 2 + Math.max(0, y - (M.B - CH_A)) - m;
  if (y >= M.C - m) return r >= M.G / 2 - m;
  return r >= BSP.minor / 2 + 0.2 - m;
}

// Yol boyunca çarpışma; kilitli poz (dokunma) atlanır, son adım gövdenin altındadır
function blockedAt(m) {
  const pts = bodyPoints();
  const way = spec.sokme.yol;
  for (let i = 1; i < way.length - 1; i++) {
    const [a, b] = [way[i], way[i + 1]];
    const steps = Math.ceil(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2])) * 4 + 1;
    for (let s = 0; s <= steps; s++) {
      const [sx, dy, th] = a.map((v, k) => v + ((b[k] - v) * s) / steps);
      const t = (th * Math.PI) / 180;
      const [cs, sn] = [Math.cos(t), Math.sin(t)];
      for (const p of pts) {
        const X = p[0] - sx;
        const Y = p[1] - dy - COLLAR_TOP;
        if (inNut([cs * X + sn * Y, -sn * X + cs * Y + COLLAR_TOP, p[2]], m)) return [sx, dy, th].map((v) => Math.round(v * 10) / 10);
      }
    }
  }
  return null;
}

function checkPath() {
  let worst = 0;
  for (const m of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    if (blockedAt(m)) break;
    worst = m;
  }
  return { worst, at: worst ? null : blockedAt(0.05) };
}

const path0 = checkPath();
const AREA = Math.round(contactArea());
if (path0.worst < 0.3) console.warn(`UYARI: sökme yolunda boşluk ${path0.worst} mm${path0.at ? `, poz ${path0.at}` : ''}`);
console.log(`YOL   en küçük boşluk ${path0.worst} mm · yaka teması ${AREA} mm²`);

// ---------------- kesit ----------------
const AX = 350;
const S = 6.5;                             // 1 mm = 6,5 px
const BASE = 572;
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
  [COLLAR_R - CH_U, COLLAR_TOP],
  [COLLAR_R, COLLAR_TOP - CH_U],
  [COLLAR_R, FACE_Y + CH_B],
  [COLLAR_R - CH_B, FACE_Y],
  [SPIGOT_R, FACE_Y],
  [SPIGOT_R, SPIGOT_Y + 0.5],
  [SPIGOT_R - 0.5, SPIGOT_Y],
  [BORE_R, SPIGOT_Y],
];

const nutPts = [
  [BSP.major / 2 + 0.8, 0],
  [HEX_R - 0.4, 0],
  [HEX_R, 0.23],
  [HEX_R, M.B - 0.23],
  [HEX_R - 0.4, M.B],
  [M.W / 2 + CH_A, M.B],
  [M.W / 2, M.B - CH_A],
  [M.W / 2, COLLAR_TOP],
  [M.G / 2, COLLAR_TOP],
  [M.G / 2, M.C],
  ...innerThread(),
];

const gasketPts = [[CONTA.ic / 2, SEAT_Y], [CONTA.dis / 2, SEAT_Y], [CONTA.dis / 2, FACE_Y], [CONTA.ic / 2, FACE_Y]];

const section = [-1, 1].map((side) => `
    <polygon class="vis" fill="url(#h1)" points="${poly(bodyPts, side)}"/>
    <polygon class="vis" fill="url(#h2)" points="${poly(nutPts, side)}"/>
    <polygon class="thin" style="fill:#555" points="${poly(gasketPts, side)}"/>
    <path class="hid" d="M${px(20, side)} ${py(SEAT_Y)} V${py(-7)} M${px(BSP.major / 2 - 2, side)} ${py(SEAT_Y)} L${px(BSP.major / 2, side)} ${py(SEAT_Y - 2)} V${py(-7)} M${px(20, side)} ${py(SEAT_Y)} H${px(BSP.major / 2 - 2, side)}"/>`).join('');

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
    ${hdim(BORE_R, 165, `ØE = ${M.E}`)}
    ${hdim(HEX_R, 640, `SW ${M.S}`)}
    ${note([px(BSP.major / 2, 1), py(47)], 176, `${ust.dis} DIŞ DİŞ`, ust.sizdirmazlik)}
    ${note([px(NECK_R, 1), py(34)], 242, `BOYUN ÇELTİĞİ ØN = ${M.N}`, `U = ${M.U} · bilezik burada kayar`)}
    ${note([px(M.W / 2 + 2, 1), py(28)], 308, `AĞIZ ØW = ${M.W}`, `tırnak ${LIP} · üst pah ${CH_A}`)}
    ${note([px(COLLAR_R, 1), py(22)], 374, `YAKA ØD = ${M.D}`, `T = ${M.T} · F = ${M.F} · alt pah ${CH_B}`)}
    ${note([px(CONTA.dis / 2, 1), py(SEAT_Y + 1)], 440, 'KLİNGERİT CONTA', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`)}
    ${note([px(BSP.major / 2, 1), py(6)], 506, `${alt.dis} İÇ DİŞ`, `C = ${M.C} · ØG = ${M.G} · K = ${M.K}`)}`;

// ---------------- bilezik ve yaka görünüşleri ----------------
const T = 3.1;                             // 1 mm = 3,1 px
const NY = 198;
const NX = 945;
const CX = 1225;

const corner = HEX_R / Math.cos(Math.PI / 6);
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  return `${(NX + T * corner * Math.sin(a)).toFixed(1)},${(NY + T * corner * Math.cos(a)).toFixed(1)}`;
}).join(' ');
const collar = collarOutline().map(([x, z]) => `${(CX + T * x).toFixed(1)},${(NY + T * z).toFixed(1)}`).join(' ');

const views = `
    <line class="ctr" x1="${NX - 145}" y1="${NY}" x2="${NX + 145}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 150}" x2="${NX}" y2="${NY + 150}"/>
    <polygon class="vis" points="${hex}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${T * (HEX_R - 0.4)}"/>
    <circle class="vis" style="fill:none" cx="${NX}" cy="${NY}" r="${(T * M.W) / 2}"/>
    <circle class="thin" cx="${NX}" cy="${NY}" r="${T * (M.W / 2 + CH_A)}"/>
    <circle class="hid" cx="${NX}" cy="${NY}" r="${(T * M.G) / 2}"/>
    <text class="h" x="${NX}" y="${NY + 176}" text-anchor="middle">BİLEZİK</text>
    <text class="ts" x="${NX}" y="${NY + 196}" text-anchor="middle">üstten · ØW = ${M.W} · çentik yok</text>
    <line class="ctr" x1="${CX - 120}" y1="${NY}" x2="${CX + 120}" y2="${NY}"/>
    <line class="ctr" x1="${CX}" y1="${NY - 120}" x2="${CX}" y2="${NY + 120}"/>
    <polygon class="vis" style="fill:none" points="${collar}"/>
    <circle class="thin" cx="${CX}" cy="${NY}" r="${T * SPIGOT_R}"/>
    <circle class="vis" style="fill:none" cx="${CX}" cy="${NY}" r="${T * BORE_R}"/>
    <circle class="hid" cx="${CX}" cy="${NY}" r="${T * NECK_R}"/>
    <text class="h" x="${CX}" y="${NY + 176}" text-anchor="middle">YAKA</text>
    <text class="ts" x="${CX}" y="${NY + 196}" text-anchor="middle">alttan · ØD = ${M.D} · kesik F = ${M.F} · köşe R${M.R}</text>`;

// ---------------- parça listesi ve sökme sırası ----------------
const ROWS = [
  ['1', 'Gövde', '1', `Pirinç ${spec.malzemeKisa}`, `Boy ${M.H - SPIGOT_Y}`],
  ['2', 'Bilezik', '1', `Pirinç ${spec.malzemeKisa}`, `SW ${M.S} × ${M.B}`],
  ['3', 'Conta', '1', 'Klingerit', `Ø${CONTA.dis} × Ø${CONTA.ic} × ${CONTA.kalinlik}`],
];
const COLS = [790, 850, 1000, 1080, 1250];
const rowY = (i) => 450 + i * 24;
const parts = `
    <text class="tb" x="780" y="426">PARÇA LİSTESİ</text>
    <rect x="780" y="432" width="580" height="24" fill="#eee"/>
    <rect x="780" y="432" width="580" height="96" class="grid"/>
    <path class="grid" d="M780 456 H1360 M780 480 H1360 M780 504 H1360"/>
    <path class="grid" d="M840 432 V528 M990 432 V528 M1070 432 V528 M1240 432 V528"/>
    <g class="tb" font-size="13">${['No', 'Parça', 'Adet', 'Malzeme', 'Ölçü'].map((t, i) => `<text x="${COLS[i]}" y="${rowY(0)}">${t}</text>`).join('')}</g>
    <g class="tn">${ROWS.map((row, j) => row.map((t, i) => `<text x="${COLS[i]}" y="${rowY(j + 1)}">${t}</text>`).join('')).join('')}</g>`;

const way = spec.sokme.yol;
const maxShift = Math.max(...way.map((p) => Math.abs(p[0])));
const maxTilt = Math.max(...way.map((p) => Math.abs(p[2])));
const STEPS = [
  'Bilezik Parça 1 dişinden sökülür; merkezleme Parça 1 deliğinden çıkar, conta düşer.',
  `Bilezik ${maxShift} mm yana kaydırılır: yakanın bir ucu ağız içine girer.`,
  `Bilezik ${maxTilt}° eğilir, yaka ağızdan sıyrılır.`,
  'Bilezik aşağı alınır. Üst diş hiç açılmaz. Takma ters sırayla yapılır.',
];
const steps = `
    <text class="tb" x="780" y="560">SÖKME SIRASI</text>
    ${STEPS.map((t, i) => `<text class="tn" x="780" y="${582 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}
    <text class="ts" x="780" y="674">Yol simülasyonla denendi: en dar yerde ${fmt(path0.worst)} mm boşluk. Parça 1 takılıyken bilezik kaymaz.</text>`;

// ---------------- notlar ----------------
const t = spec.tolerans;
const NOTES = [
  `${spec.onayli ? 'Ölçüler onaylıdır.' : 'Taslak: ölçüler öneridir, onaydan sonra kesinleşir.'} Kesit orantılı çizildi; değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Kritik: ØD ${M.D} ${t.D}, ØW ${M.W} ${t.W}, ØG ${M.G} ${t.G}, F ${M.F} ${t.F}, T ${M.T} ${t.T}, merkezleme ${t.merkezleme}. Bilezik sıkma ${spec.sikma.azami} Nm'yi geçmez.`,
  `Üst uç ${ust.dis} (ISO 7-1, konik 1:16), ${ust.sizdirmazlik}. Bilezik ${alt.dis} (ISO 228-1), Parça 1 üst dişine oturur.`,
  `Sızdırmazlık: conta merkezlemeye oturur, merkezleme Ø${fmt(spec.merkezleme.cap)} Parça 1 deliğine ${spec.merkezleme.giris} mm girer; bilezik her açıda aynı sıkar.`,
  `Yaka alt pahı ${CH_B} × 45° ve ağız üst pahı ${CH_A} × 45° sökme için gereklidir. Yaka üst pahı ${fmt(CH_U)} geçilmez: tırnak buraya basar.`,
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
    <line class="ctr" x1="${AX}" y1="178" x2="${AX}" y2="626"/>
    ${section}
    ${dims}
    <text class="h" x="${AX}" y="700" text-anchor="middle">KESİT</text>
    <text class="ts" x="${AX}" y="720" text-anchor="middle">sıkılı konum · kesikli çizgi Parça 1 üst ucu</text>
  </g>

  <g>${views}
  </g>

  <g>${parts}
  </g>

  <g>${steps}
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
