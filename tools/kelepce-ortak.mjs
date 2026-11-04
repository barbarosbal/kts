// Kelepçe sıkma uçlarının (v1, v2) ortak teknik çizim parçaları:
// SDS-Plus sap, altıgen kavrama, tırnaklar, ağız görünüşü, A–A kesiti, sayfa ve antet.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const oku = async (dosya) => JSON.parse(await readFile(path.join(ROOT, dosya), 'utf8'));
export const fmt = (n) => String(n).replace('.', ',');

// ---------------- mil geometrisi ----------------
// Sap, halka, tırnak ve kafa alnı ölçüleri; iki uçta da aynı kurallarla türetilir
export function uc(spec) {
  const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));
  const onDeger = (k) => (spec.olculer[k].varsayim && !spec.onayli ? ' q' : '');
  const SDS_Q = spec.onayli ? '' : ' q';

  const BODY_R = M.D / 2;
  const SAP_R = M.S / 2;
  const NECK_R = M.N / 2;
  const RING_R = M.Z / 2;
  const FACE_Y = M.H - M.C;
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

  // Sap sonundan boyun ve halkaya: [r, y]
  const boyunHalka = [
    [SAP_R, M.L],
    [NECK_R, M.L + SAP_R - NECK_R],
    [NECK_R, RING_0],
    [RING_R - CH_R, RING_0],
    [RING_R, RING_0 + CH_R],
    [RING_R, RING_1 - CH_R],
    [RING_R - CH_R, RING_1],
    [NECK_R, RING_1],
  ];

  // Tırnak, kalınlık yönünde: dış düz yüzden ağız pahına
  const tirnakKalinlik = [
    [OUTER_X, GROOVE_Y],
    [OUTER_X, M.H - UC_D],
    [OUTER_X - UC_D, M.H],
    [MOUTH_X + UC_I, M.H],
    [MOUTH_X, M.H - UC_I],
    [MOUTH_X, FACE_Y],
  ];

  // Tırnak, en yönünde (yan görünüş): ön kanaldan uca
  const tirnakEn = [
    [BODY_R, GROOVE_Y + GROOVE_D],
    [BODY_R, FACE_Y - CH_F],
    [BODY_R - CH_F, FACE_Y],
    [M.V / 2, FACE_Y],
    [M.V / 2, M.H - UC_Y],
    [M.V / 2 - UC_Y, M.H],
    [0, M.H],
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

  // A–A altıgen bölgeden geçer: ±X kilit kanalı, ±Z açık kanal, köşeler sap çapında. Çeyrek çizilir, aynalanır.
  function sapKesit(CX, NY, HS) {
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

  return {
    M, onDeger, SDS_Q, BODY_R, SAP_R, NECK_R, RING_R, FACE_Y, MOUTH_X, OUTER_X, RING_0, RING_1, GROOVE_Y, GROOVE_D,
    CEP_Y, CH_S, CH_G, CH_F, CH_R, UC_I, UC_D, UC_Y, AC, KI, KV_SW, KV_BAS, KV_SON, KV_R, KV_KENAR,
    AC_TABAN, AC_CIKIS, AC_KENAR, KI_TABAN, KIRIS,
    kilitYol, acikYol, kilitDis, sapKesitYol, sapDisYol, sapYanYol, boyunHalka, tirnakKalinlik, tirnakEn, icCep, sapKesit,
  };
}

// ---------------- görünüş ölçeği ----------------
// Eksen yatay: y (mm) → x (px), r (mm) → eksenden yukarı
export function gorunus(S, X0) {
  const vx = (y) => +(X0 + S * y).toFixed(1);
  const vy = (axis, r) => +(axis - S * r).toFixed(1);
  const yari = (axis, pts, side = 1) => pts.map(([r, y]) => `${vx(y).toFixed(1)},${vy(axis, side * r).toFixed(1)}`).join(' ');
  const tumu = (axis, upper) => yari(axis, [...upper, ...upper.map(([r, y]) => [-r, y]).reverse()]);
  const cross = (axis, y, r0, r1, cls = 'thin') => `<line class="${cls}" x1="${vx(y)}" y1="${vy(axis, r0)}" x2="${vx(y)}" y2="${vy(axis, r1)}"/>`;
  const along = (axis, r, y0, y1, cls = 'thin') => `<line class="${cls}" x1="${vx(y0)}" y1="${vy(axis, r)}" x2="${vx(y1)}" y2="${vy(axis, r)}"/>`;
  return { vx, vy, yari, tumu, cross, along };
}

// ---------------- ölçü ve not ----------------
// Kısa ölçüde yazı çizginin üstüne çıkar, oklar görünür kalır
export function hdim(x0, x1, y, text, q = '') {
  const kisa = x1 - x0 < 90;
  const en = Math.max(68, text.length * 8.5);
  return `
    <line class="dima" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>
    ${kisa ? '' : `<rect x="${(x0 + x1 - en) / 2}" y="${y - 10}" width="${en}" height="20" fill="#fff"/>`}
    <text class="tb${q}" x="${(x0 + x1) / 2}" y="${kisa ? y - 6 : y + 5}" text-anchor="middle">${text}</text>`;
}

export function vdim(x, y0, y1, text, q = '') {
  return `
    <line class="dima" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>
    <rect x="${x - 34}" y="${(y0 + y1) / 2 - 10}" width="68" height="20" fill="#fff"/>
    <text class="tb${q}" x="${x}" y="${(y0 + y1) / 2 + 5}" text-anchor="middle">${text}</text>`;
}

export const extV = (x, y0, y1) => `<line class="dim" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`;
export const extH = (x0, x1, y) => `<line class="dim" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;

export function note([x, y], tx, ty, title, sub, q = '', en = 240) {
  return `
    <polyline class="lead" points="${x},${y} ${tx - 4},${ty + 6} ${tx + en},${ty + 6}"/>
    <text class="tb${q}" x="${tx}" y="${ty}">${title}</text>
    <text class="ts" x="${tx}" y="${ty + 22}">${sub}</text>`;
}

// ---------------- ağız ve A–A ----------------
// Uçtan bakış: gövde dairesi iki dış düz yüzle, alın yuvası, cep, delik, tırnaklar. ek: arkada kalan çizgiler
export function agiz(u, NX, NY, T, ek = '') {
  const { M, BODY_R, MOUTH_X, OUTER_X, UC_I, UC_D, UC_Y } = u;
  const govdeUc = Array.from({ length: 120 }, (_, i) => {
    const a = (i * Math.PI) / 60;
    const x = Math.max(-OUTER_X, Math.min(OUTER_X, BODY_R * Math.cos(a)));
    return `${(NX + T * x).toFixed(1)},${(NY + T * BODY_R * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const dikdortgen = (s, x0, x1, hz) => [[x0, -hz], [x1, -hz], [x1, hz], [x0, hz]]
    .map(([x, z]) => `${(NX + s * T * x).toFixed(1)},${(NY + T * z).toFixed(1)}`).join(' ');
  return `
    <line class="ctr" x1="${NX - 118}" y1="${NY}" x2="${NX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${NX}" y1="${NY - 118}" x2="${NX}" y2="${NY + 118}"/>${ek}
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
}

export function kesitA(u, CX, NY, HS) {
  const { M, SAP_R, KV_R, KV_SW } = u;
  return `
    <line class="ctr" x1="${CX - 118}" y1="${NY}" x2="${CX + 118}" y2="${NY}"/>
    <line class="ctr" x1="${CX}" y1="${NY - 118}" x2="${CX}" y2="${NY + 118}"/>
    <polygon class="vis" fill="url(#h1)" points="${u.sapKesit(CX, NY, HS)}"/>
    <circle class="hid" cx="${CX}" cy="${NY}" r="${HS * SAP_R}"/>
    ${extH(CX, CX + 140, NY - HS * KV_R)}
    ${extH(CX, CX + 140, NY + HS * KV_R)}
    ${vdim(CX + 136, NY - HS * KV_R, NY + HS * KV_R, `SW ${fmt(KV_SW)}`)}
    <text class="h" x="${CX}" y="${NY + 146}" text-anchor="middle">KESİT A–A</text>
    <text class="ts" x="${CX}" y="${NY + 166}" text-anchor="middle">altıgen · kesikli daire sap Ø${fmt(M.S)} · köşeler bu çapta</text>`;
}

// ---------------- logo ----------------
// Lazer markalama logosu: SVG dosyası ve viewBox ölçüsü (logo birimi)
export async function logoOku(dosya) {
  const svg = await readFile(path.join(ROOT, dosya), 'utf8');
  const [, , LW, LH] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  return { svg, LW, LH };
}

// Ramer–Douglas–Peucker: çizimde görünmeyecek kadar küçük kırılmalar atılır
function sadelestir(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1e-9;
  let iMax = 0;
  let dMax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > dMax) [iMax, dMax] = [i, d];
  }
  if (dMax <= tol) return [pts[0], pts.at(-1)];
  return [...sadelestir(pts.slice(0, iMax + 1), tol).slice(0, -1), ...sadelestir(pts.slice(iMax), tol)];
}

// Logo yolları yalnız M, L, C içerir; eğriler parçalara bölünüp izdüşürülür
function logoYol(d, logoNokta) {
  const tok = d.match(/[MLCZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const halkalar = [];
  let cur = null;
  let p = [0, 0];
  let cmd = null;
  for (let i = 0; i < tok.length;) {
    const harf = /[A-Za-z]/.test(tok[i]);
    if (harf) cmd = tok[i++];
    const n = () => +tok[i++];
    if (cmd === 'Z' || cmd === 'z') {
      // Z kendi başına bir komuttur: ardından gelen M'yi tüketmez
      if (!harf) i++;
      continue;
    }
    if (cmd === 'M') {
      p = [n(), n()];
      cur = [logoNokta(...p)];
      halkalar.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      p = [n(), n()];
      cur.push(logoNokta(...p));
    } else if (cmd === 'C') {
      const [c1, c2, e] = [[n(), n()], [n(), n()], [n(), n()]];
      for (const t of [1 / 3, 2 / 3, 1]) {
        const k = 1 - t;
        cur.push(logoNokta(
          k ** 3 * p[0] + 3 * k * k * t * c1[0] + 3 * k * t * t * c2[0] + t ** 3 * e[0],
          k ** 3 * p[1] + 3 * k * k * t * c1[1] + 3 * k * t * t * c2[1] + t ** 3 * e[1],
        ));
      }
      p = e;
    } else {
      i++;
    }
  }
  // Kapalı halkada uçlar çakışır: en uzak noktadan ikiye bölünüp ayrı ayrı sadeleştirilir
  const halka = (h) => {
    const [x0, y0] = h[0];
    let k = 1;
    h.forEach(([x, y], i) => { if (Math.hypot(x - x0, y - y0) > Math.hypot(h[k][0] - x0, h[k][1] - y0)) k = i; });
    return [...sadelestir(h.slice(0, k + 1), 0.12).slice(0, -1), ...sadelestir(h.slice(k), 0.12)];
  };
  return halkalar
    .map(halka)
    .filter((h) => h.length > 2)
    .map((h) => `M${h.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')}Z`)
    .join('');
}

// Logonun her yolu nokta(u, v) ile çizime izdüşürülür (u sağa, v aşağı, logo birimi)
export function logoYollari(svg, nokta) {
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)]
    .map((m) => `<path class="mark" fill-rule="evenodd" d="${logoYol(m[1], nokta)}"/>`)
    .join('\n    ');
}

// ---------------- sayfa ----------------
// bloklar: çizim grupları; desen: ek tarama desenleri; not: NOTLAR başlığı ve satır yerleşimi; antet: { ad, malzeme }
export function sayfa(spec, { bloklar, notlar, not = { baslik: 832, ilk: 854, adim: 17 }, desen = '', stil = '', antet }) {
  const notes = notlar.map((t, i) => `<text class="tn" x="40" y="${not.ilk + i * not.adim}">${i + 1}. ${t}</text>`).join('\n    ');
  const durumKisa = spec.onayli ? 'ONAYLI' : 'TASLAK';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/>
    </marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>${desen}
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
      .q{fill:#c2410c}${stil}
    </style>
  </defs>

  <rect x="0" y="0" width="1400" height="990" fill="#fff"/>
  <rect x="20" y="20" width="1360" height="950" class="grid" stroke-width="1.6"/>
${bloklar.map((b) => `
  <g>${b}
  </g>
`).join('')}
  <g>
    <text class="tb" x="40" y="${not.baslik}">NOTLAR</text>
    ${notes}
  </g>

  <g>
    <rect x="780" y="780" width="580" height="175" class="grid" stroke-width="1.6"/>
    <path class="grid" d="M780 830 H1360 M780 872 H1360 M780 914 H1360"/>
    <path class="grid" d="M980 830 V914 M1180 830 V914"/>
    <text x="795" y="814" font-size="22" font-weight="700" fill="#111" letter-spacing=".5">${antet.ad}</text>
    <text class="ts" x="1345" y="814" text-anchor="end">Teknik resim</text>

    <text class="tl" x="790" y="845">MALZEME</text><text class="tb" x="790" y="864">${antet.malzeme}</text>
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
}
