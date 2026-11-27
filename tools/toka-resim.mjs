// PA12 toka: teknik resim (A3 SVG + PDF), 1:1 plaka baskı şablonu, paket sayfası, README ve ZIP
// Kullanım: cd tools && node toka.mjs && node toka-resim.mjs && node onbellek.mjs  (TOKA_SVG_ONLY=1: PDF basılmaz)
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, TAR, printDrawing } from './paket-ortak.mjs';

const SPEC = JSON.parse(await readFile(path.join(ROOT, 'toka-olculer.json'), 'utf8'));
const RAPOR = JSON.parse(await readFile(path.join(ROOT, 'uretim', 'toka', 'kontrol-raporu.json'), 'utf8'));
const OUT = path.join(ROOT, 'uretim', 'toka');
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { cep: CEP, plaka: PL, nfc: NFC, qr: QR } = SPEC;
const AD = `${SPEC.kod}-rev${SPEC.rev}`;
const H = M.Kw + 2 * M.Yn;
const TOP = M.Ar + M.Kh + M.On;            // toplam kalınlık
const ACIK = M.Kw - 2 * M.De;
const MOD_MM = PL.qrAlan / (QR.modul + 2 * QR.sessiz);

const m = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n) => Math.round(n * 10) / 10;
const q = SPEC.onayli ? '' : ' q';
const out = [];
const add = (x) => out.push(x);
function dimH(x1, x2, y, text, ext = []) {
  for (const [x, y0] of ext) add(`<line class="dim" x1="${f(x)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y + (y > y0 ? 4 : -4))}"/>`);
  add(`<line class="dima" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/>`);
  const w = Math.max(40, text.length * 8.4);
  add(`<rect x="${f((x1 + x2) / 2 - w / 2)}" y="${f(y - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
  add(`<text class="tb${q}" x="${f((x1 + x2) / 2)}" y="${f(y + 5)}" text-anchor="middle">${esc(text)}</text>`);
}
function dimV(x, y1, y2, text, ext = []) {
  for (const [x0, y] of ext) add(`<line class="dim" x1="${f(x0)}" y1="${f(y)}" x2="${f(x + (x > x0 ? 4 : -4))}" y2="${f(y)}"/>`);
  add(`<line class="dima" x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y2)}"/>`);
  const w = Math.max(40, text.length * 8.4);
  add(`<rect x="${f(x - w / 2)}" y="${f((y1 + y2) / 2 - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
  add(`<text class="tb${q}" x="${f(x)}" y="${f((y1 + y2) / 2 + 5)}" text-anchor="middle">${esc(text)}</text>`);
}
function lead(points, title, sub) {
  add(`<polyline class="lead" points="${points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`);
  const [x, y] = points[points.length - 2];
  add(`<text class="tb" x="${f(x + 4)}" y="${f(y - 6)}">${esc(title)}</text>`);
  if (sub) add(`<text class="ts" x="${f(x + 4)}" y="${f(y + 14)}">${esc(sub)}</text>`);
}
const rect = (x, y, w, h, r, cls, extra = '') => add(`<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ${extra}/>`);
function qrCiz(x0, y0, mmPx) {
  const mp = MOD_MM * mmPx;
  const ix = x0 + QR.sessiz * mp;
  const iy = y0 + QR.sessiz * mp;
  const iq = QR.modul * mp;
  add(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(PL.qrAlan * mmPx)}" height="${f(PL.qrAlan * mmPx)}" fill="#fff"/>`);
  add(`<rect x="${f(ix)}" y="${f(iy)}" width="${f(iq)}" height="${f(iq)}" fill="url(#qr)"/>`);
  for (const [bx, by] of [[ix, iy], [ix + iq - 7 * mp, iy], [ix, iy + iq - 7 * mp]]) {
    add(`<rect x="${f(bx)}" y="${f(by)}" width="${f(7 * mp)}" height="${f(7 * mp)}" fill="#111"/>`);
    add(`<rect x="${f(bx + mp)}" y="${f(by + mp)}" width="${f(5 * mp)}" height="${f(5 * mp)}" fill="#fff"/>`);
    add(`<rect x="${f(bx + 2 * mp)}" y="${f(by + 2 * mp)}" width="${f(3 * mp)}" height="${f(3 * mp)}" fill="#111"/>`);
  }
  return { ix, iy, iq };
}
// Baskılı plaka: siyah zemin, marka, QR alanı
function plakaCiz(x0, y0, K) {
  rect(x0, y0, PL.boy * K, PL.en * K, 0.3 * K, 'vis', 'fill="#1a1b1e"');
  const qx = x0 + (PL.boy - PL.qrAlan) * K;
  qrCiz(qx, y0, K);
  const alan = (PL.boy - PL.qrAlan) * K;
  add(`<text x="${f(x0 + alan / 2)}" y="${f(y0 + (PL.en / 2 + 2.3) * K)}" text-anchor="middle" font-size="${f(7.2 * K)}" font-weight="600" fill="#f2eee5">${esc(PL.marka)}</text>`);
  return qx;
}

// ---- 1 · önden görünüş ----
{
  const K = 9;
  const cx = 330;
  const cy = 220;
  const x0 = cx - (M.L / 2) * K;
  const y0 = cy - (H / 2) * K;
  add(`<line class="ctr" x1="${f(x0 - 40)}" y1="${cy}" x2="${f(x0 + M.L * K + 40)}" y2="${cy}"/>`);
  rect(x0, y0, M.L * K, H * K, M.Rk * K, 'vis', 'fill="#fff"');
  rect(cx - (CEP.boy / 2) * K, cy - (CEP.en / 2) * K, CEP.boy * K, CEP.en * K, CEP.koseR * K, 'thin');
  const qx = plakaCiz(cx - (PL.boy / 2) * K, cy - (PL.en / 2) * K, K);
  add(`<circle class="hid" cx="${f(qx + (PL.qrAlan / 2) * K)}" cy="${cy}" r="${f((NFC.cap / 2) * K)}"/>`);
  for (const s of [-1, 1]) add(`<line class="hid" x1="${f(x0)}" y1="${f(cy + s * (M.Kw / 2) * K)}" x2="${f(x0 + M.L * K)}" y2="${f(cy + s * (M.Kw / 2) * K)}"/>`);
  dimH(x0, x0 + M.L * K, y0 + H * K + 62, `L = ${m(M.L)}`, [[x0, cy + 20], [x0 + M.L * K, cy + 20]]);
  dimH(cx - (CEP.boy / 2) * K, cx + (CEP.boy / 2) * K, y0 + H * K + 28, `cep ${m(CEP.boy)}`, [
    [cx - (CEP.boy / 2) * K, cy + (CEP.en / 2) * K + 2], [cx + (CEP.boy / 2) * K, cy + (CEP.en / 2) * K + 2]]);
  dimV(x0 + M.L * K + 42, y0, y0 + H * K, m(H), [[x0 + M.L * K - 10, y0], [x0 + M.L * K - 10, y0 + H * K]]);
  dimV(x0 - 40, cy - (CEP.en / 2) * K, cy + (CEP.en / 2) * K, m(CEP.en), [[cx - (CEP.boy / 2) * K, cy - (CEP.en / 2) * K], [cx - (CEP.boy / 2) * K, cy + (CEP.en / 2) * K]]);
  lead([[x0 + 8, y0 + 6], [x0 - 30, 70], [x0 + 170, 70]], `PA12 TOKA · R${m(M.Rk)} köşe`, `ön kenar R${m(M.Rf)} · arka kenar R0,5`);
  lead([[qx + 10, y0 + (H / 2 - 7) * K], [qx + 90, 70], [qx + 300, 70]], `BASKILI PLAKA ${m(PL.boy)} × ${m(PL.en)}`, `marka + QR ${m(PL.qrAlan)} × ${m(PL.qrAlan)} · NFC Ø${m(NFC.cap)} altında (kesikli)`);
  add(`<text class="h" x="${cx}" y="${f(y0 + H * K + 112)}" text-anchor="middle">ÖNDEN · ${m(K / 3.78)}:1</text>`);
}

// ---- 2 · A–A kesit (bant enine) ----
{
  const K = 16;
  const ox = 330;
  const oy = 760;                          // kanal tabanı (bilek tarafı)
  const P = (y, z) => [ox + y * K, oy - z * K];
  const yH = H / 2;
  const yK = M.Kw / 2;
  const yA = ACIK / 2;
  const zT = M.Kh + M.On;
  const zC = zT - CEP.derinlik;
  const yC = CEP.en / 2;
  const sag = [
    [yA, -M.Ar], [yH, -M.Ar], [yH, zT], [yC, zT], [yC, zC], [-yC, zC], [-yC, zT], [-yH, zT], [-yH, -M.Ar], [-yA, -M.Ar],
    [-yA, 0], [-yK, 0], [-yK, M.Kh], [yK, M.Kh], [yK, 0], [yA, 0],
  ].map(([y, z]) => P(y, z));
  add(`<polygon class="vis" fill="url(#h1)" points="${sag.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`);
  // bant (dikiş yerinde iki kat)
  for (const k of [0, 1]) {
    const [bx, by] = P(-M.Wb / 2, 0.25 + (k + 1) * M.Tb);
    add(`<rect class="thin" x="${f(bx)}" y="${f(by)}" width="${f(M.Wb * K)}" height="${f(M.Tb * K)}" fill="url(#h3)"/>`);
  }
  const [nx, ny] = P(-NFC.cap / 2, zC + NFC.kalinlik);
  add(`<rect x="${f(nx)}" y="${f(ny)}" width="${f(NFC.cap * K)}" height="${f(NFC.kalinlik * K)}" fill="#111"/>`);
  const [px, py] = P(-PL.en / 2, zT);
  add(`<rect class="vis" x="${f(px)}" y="${f(py)}" width="${f(PL.en * K)}" height="${f(PL.kalinlik * K)}" fill="url(#h2)"/>`);
  add(`<line class="ctr" x1="${ox}" y1="${f(oy + M.Ar * K + 30)}" x2="${ox}" y2="${f(oy - zT * K - 40)}"/>`);

  dimH(P(-yH, 0)[0], P(yH, 0)[0], oy + M.Ar * K + 34, m(H), [[P(-yH, 0)[0], oy + M.Ar * K + 2], [P(yH, 0)[0], oy + M.Ar * K + 2]]);
  dimH(P(-yA, 0)[0], P(yA, 0)[0], oy + M.Ar * K + 66, `arka açıklık ${m(ACIK)}`, [[P(-yA, 0)[0], oy + M.Ar * K + 2], [P(yA, 0)[0], oy + M.Ar * K + 2]]);
  dimH(P(-yK, 0)[0], P(yK, 0)[0], oy - zT * K - 30, `kanal ${m(M.Kw)}`, [[P(-yK, 0)[0], P(0, M.Kh)[1] - 2], [P(yK, 0)[0], P(0, M.Kh)[1] - 2]]);
  const xr = P(yH, 0)[0] + 36;
  dimV(xr, P(0, zT)[1], P(0, -M.Ar)[1], m(TOP), [[P(yH, 0)[0] + 2, P(0, zT)[1]], [P(yH, 0)[0] + 2, P(0, -M.Ar)[1]]]);
  dimV(xr + 60, P(0, M.Kh)[1], P(0, 0)[1], `Kh ${m(M.Kh)}`, [[P(yK, 0)[0], P(0, M.Kh)[1]], [P(yK, 0)[0], P(0, 0)[1]]]);
  dimV(P(-yH, 0)[0] - 40, P(0, zT)[1], P(0, zC)[1], m(CEP.derinlik), [[P(-yC, 0)[0], P(0, zC)[1]], [P(-yH, 0)[0] - 2, P(0, zT)[1]]]);
  lead([[P(-PL.en / 4, zT)[0], P(0, zT)[1] + 4], [ox - 250, oy - 140], [ox - 40, oy - 140]],
    `3 · PLAKA ${m(PL.boy)} × ${m(PL.en)} × ${m(PL.kalinlik)}`, PL.malzeme);
  lead([[P(NFC.cap / 2 - 1, zC)[0], P(0, zC)[1] - 2], [ox + 130, oy - 160], [ox + 330, oy - 160]],
    `2 · NFC Ø${m(NFC.cap)} × ${m(NFC.kalinlik)}`, 'cep tabanında, QR alanının altında');
  lead([[P(yH - 0.7, M.Kh / 2)[0], P(0, M.Kh / 2)[1]], [ox + 170, oy - 90], [ox + 330, oy - 90]],
    '1 · PA12 TOKA', `ön ${m(M.On)} · yan ${m(M.Yn)} · arka dudak ${m(M.Ar)} × ${m(M.De)}`);
  lead([[P(-M.Wb / 2 + 2, 0.25 + M.Tb)[0], P(0, 0.25 + M.Tb)[1]], [ox - 250, oy + 126], [ox - 60, oy + 126]],
    'ELASTİK BANT · DİKİŞ YERİ', `${m(M.Wb)} × ${m(M.Tb)} · iki kat`);
  add(`<text class="h" x="${ox + 120}" y="${f(oy + 182)}" text-anchor="middle">A–A KESİT · ${m(K / 3.78)}:1</text>`);
}

// ---- 3 · üstten görünüş ----
{
  const K = 9;
  const cx = 820;
  const cy = 150;
  const x0 = cx - (M.L / 2) * K;
  const yOn = cy - (TOP / 2) * K;
  rect(x0, yOn, M.L * K, TOP * K, 0.5 * K, 'vis', 'fill="#fff"');
  const zK0 = yOn + (M.On) * K;
  const zK1 = zK0 + M.Kh * K;
  for (const y of [zK0, zK1]) add(`<line class="hid" x1="${f(x0)}" y1="${f(y)}" x2="${f(x0 + M.L * K)}" y2="${f(y)}"/>`);
  add(`<line class="hid" x1="${f(cx - (CEP.boy / 2) * K)}" y1="${f(yOn + CEP.derinlik * K)}" x2="${f(cx + (CEP.boy / 2) * K)}" y2="${f(yOn + CEP.derinlik * K)}"/>`);
  for (const s of [-1, 1]) {
    const bx0 = s < 0 ? x0 - 70 : x0 + M.L * K;
    add(`<rect class="thin" x="${f(bx0)}" y="${f(zK0 + 0.6 * K)}" width="70" height="${f(M.Tb * K)}" fill="url(#h3)"/>`);
  }
  dimV(x0 + M.L * K + 40, yOn, yOn + TOP * K, m(TOP), [[x0 + M.L * K + 2, yOn], [x0 + M.L * K + 2, yOn + TOP * K]]);
  add(`<text class="ts" x="${cx}" y="${f(yOn - 12)}" text-anchor="middle">ön yüz (plaka tarafı)</text>`);
  add(`<text class="ts" x="${cx}" y="${f(yOn + TOP * K + 22)}" text-anchor="middle">bilek tarafı · bant kanalda kayar</text>`);
  add(`<text class="h" x="${cx}" y="${f(yOn + TOP * K + 64)}" text-anchor="middle">ÜSTTEN · ${m(K / 3.78)}:1</text>`);
}

// ---- 4 · plaka baskı şablonu ----
{
  const K = 7;
  const x0 = 640;
  const y0 = 330;
  plakaCiz(x0, y0, K);
  dimH(x0, x0 + PL.boy * K, y0 - 22, m(PL.boy), [[x0, y0 - 2], [x0 + PL.boy * K, y0 - 2]]);
  dimH(x0 + (PL.boy - PL.qrAlan) * K, x0 + PL.boy * K, y0 + PL.en * K + 24, `QR ${m(PL.qrAlan)}`, [
    [x0 + (PL.boy - PL.qrAlan) * K, y0 + PL.en * K + 2], [x0 + PL.boy * K, y0 + PL.en * K + 2]]);
  dimV(x0 + PL.boy * K + 34, y0, y0 + PL.en * K, m(PL.en), [[x0 + PL.boy * K + 2, y0], [x0 + PL.boy * K + 2, y0 + PL.en * K]]);
  add(`<text class="tn" x="${x0}" y="${f(y0 + PL.en * K + 62)}">${QR.modul} × ${QR.modul} modül · ECC ${QR.ecc} · modül ${m(MOD_MM)} · sessiz bölge ${QR.sessiz} modül</text>`);
  add(`<text class="tn" x="${x0}" y="${f(y0 + PL.en * K + 80)}">Her adet tekil QR · koyu modül, açık zemin · 1:1 şablon pakette</text>`);
  add(`<text class="h" x="${x0}" y="${f(y0 + PL.en * K + 112)}">PLAKA BASKISI · ${m(K / 3.78)}:1</text>`);
}

// ---- parça listesi, notlar, antet ----
{
  const x = 1035;
  let y = 380;
  add(`<text class="h" x="${x}" y="${y}">PARÇA LİSTESİ</text>`);
  y += 10;
  const rows = [
    ['1', 'PA12 toka', `${SPEC.malzemeKisa} 3D baskı · mat siyah · ≈ ${m(RAPOR.tahminiKutleGram)} g`],
    ['2', 'NFC inlay', `Ø${m(NFC.cap)} · tekil adres yazılır, kilitlenir`],
    ['3', 'Baskılı plaka', `${m(PL.boy)} × ${m(PL.en)} × ${m(PL.kalinlik)} PC · tekil QR`],
    ['4', 'Elastik bant', `${m(M.Wb)} mm siyah dokuma · tedarik`],
  ];
  for (const [no, ad, not] of rows) {
    add(`<rect class="grid" x="${x}" y="${y}" width="330" height="42"/>`);
    add(`<text class="tb" x="${x + 10}" y="${y + 18}">${no}</text>`);
    add(`<text class="tb" x="${x + 30}" y="${y + 18}">${esc(ad)}</text>`);
    add(`<text class="tl" x="${x + 30}" y="${y + 33}">${esc(not)}</text>`);
    y += 42;
  }
  y += 30;
  add(`<text class="h" x="${x}" y="${y}">NOTLAR</text>`);
  const notlar = [
    'Malzeme: PA12 3D baskı (MJF / SLS), mat siyah.',
    `Genel tolerans ${SPEC.genelTolerans.split(';')[0]}.`,
    'Kanal ölçüsü gerçek bantla 3 numunede denenir.',
    'Montaj: toka banda geçirilir, uçlar üst üste',
    'dikilir; dikiş tokanın altında kalır.',
    'NFC + plaka tipay\'de takılır (yapıştırma);',
    'toka üreticisi ürün kimliği görmez.',
    'Marka yalnız plakada: ad değişirse toka aynı kalır.',
    'QR yükü yalnız origin + /a/<publicId>.',
  ];
  y += 6;
  for (const n of notlar) {
    y += 18;
    add(`<text class="ts" x="${x}" y="${y}">${esc(n)}</text>`);
  }
  const ay = 862;
  add(`<rect class="grid" x="${x}" y="${ay}" width="330" height="96" stroke-width="1.6"/>`);
  add(`<line class="grid" x1="${x}" y1="${ay + 40}" x2="${x + 330}" y2="${ay + 40}"/>`);
  add(`<text class="h" x="${x + 12}" y="${ay + 27}">${esc(SPEC.parca)}</text>`);
  add(`<text class="ts" x="${x + 12}" y="${ay + 60}">Rev ${SPEC.rev} · ${SPEC.tarih} · ${SPEC.onayli ? 'ONAYLI' : 'NUMUNE ADAYI'} · mm</text>`);
  add(`<text class="ts" x="${x + 12}" y="${ay + 80}">STEP: ${esc(AD)}.step</text>`);
  add(`<text class="tl" x="${x + 318}" y="${ay + 60}" text-anchor="end">Ratel Systems</text>`);
  if (!SPEC.onayli) add(`<text class="tn q" x="${x}" y="${ay - 10}">Turuncu ölçüler ön değerdir.</text>`);
}

const DEFS = `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/></marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <pattern id="h2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="4" stroke="#111" stroke-width=".6"/></pattern>
    <pattern id="h3" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fff"/><path d="M0,3 L6,3 M3,0 L3,6" stroke="#888" stroke-width=".6"/></pattern>
    <pattern id="qr" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#bbb"/><rect x="4" y="4" width="4" height="4" fill="#bbb"/></pattern>
    <style>
      .vis{stroke:#111;stroke-width:2.2;stroke-linejoin:round}
      .thin{fill:none;stroke:#111;stroke-width:1}
      .hid{fill:none;stroke:#111;stroke-width:1.2;stroke-dasharray:7 4}
      .ctr{fill:none;stroke:#555;stroke-width:0.9;stroke-dasharray:22 4 3 4}
      .dim{fill:none;stroke:#111;stroke-width:0.9}
      .dima{fill:none;stroke:#111;stroke-width:0.9;marker-start:url(#arr);marker-end:url(#arr)}
      .lead{fill:none;stroke:#111;stroke-width:0.9;marker-start:url(#arr)}
      .grid{fill:none;stroke:#111;stroke-width:1}
      .tb{font-size:14px;font-weight:700;fill:#111}
      .ts{font-size:12px;fill:#333}
      .tn{font-size:13px;fill:#111}
      .tl{font-size:10px;fill:#555;letter-spacing:.4px}
      .h{font-size:18px;font-weight:700;fill:#111;letter-spacing:.5px}
      .q{fill:#c2410c}
    </style>
  </defs>`;
const resim = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  ${DEFS}
  <rect x="0" y="0" width="1400" height="990" fill="#fff"/>
  <rect x="20" y="20" width="1360" height="950" class="grid" stroke-width="1.6"/>
  ${out.join('\n  ')}
</svg>
`;
const resimSvg = path.join(OUT, `${AD}-teknik-resim.svg`);
await writeFile(resimSvg, resim);

// 1:1 plaka baskı şablonu (mm): QR alanı yer tutucu; her adetin QR'ı üretimde tekil basılır
out.length = 0;
plakaCiz(0, 0, 1);
const sablon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PL.boy} ${PL.en}" width="${PL.boy}mm" height="${PL.en}mm" font-family="Arial, Helvetica, sans-serif">
  ${DEFS.replace(/stroke-width:2\.2/, 'stroke-width:0.1')}
  ${out.join('\n  ')}
</svg>
`;
await writeFile(path.join(OUT, `${AD}-plaka-sablon.svg`), sablon);

let pdf = false;
if (!process.env.TOKA_SVG_ONLY) pdf = await printDrawing(resimSvg, path.join(OUT, `${AD}-teknik-resim.pdf`));

// ---- README, paket sayfası, ZIP ----
const readme = `# ${SPEC.parca} · Rev ${SPEC.rev}

**Durum:** ${SPEC.durum}. Bu paket üretim onayı değildir; ${SPEC.adet}.

## Parça

Kurucunun elle büktüğü sac prototipin biçimi: bandı saran C kanal, arkada iki dudak, bant kanaldan kayar ve dikiş yerini örter.
Metal yerine **${SPEC.malzemeKisa}**: NFC metalde çalışmaz; plastikte normal NFC inlay yeterli, ferrit gerekmez.

| Ölçü | Değer |
|---|---:|
| Dış ölçü | ${m(M.L)} × ${m(H)} × ${m(TOP)} mm |
| Bant kanalı | ${m(M.Kw)} × ${m(M.Kh)} mm (dikişte iki kat ${m(M.Tb)} mm bant) |
| Arka açıklık | ${m(ACIK)} mm (dudaklar ${m(M.De)} × ${m(M.Ar)} mm) |
| Ön duvar / yan duvar | ${m(M.On)} / ${m(M.Yn)} mm |
| Plaka cebi | ${m(CEP.boy)} × ${m(CEP.en)} × ${m(CEP.derinlik)} mm, köşe R${m(CEP.koseR)} |
| Tahmini kütle | ≈ ${m(RAPOR.tahminiKutleGram)} g |

## Üretim

- **Malzeme:** ${SPEC.malzeme}. **Yüzey:** ${SPEC.yuzey}
- **Tolerans:** ${SPEC.genelTolerans}.
- Önce 3 numune: banda geçirme, ter / su / sürtünme, bilekte kullanım; iPhone ve Android'de QR + NFC.
- Montaj tipay'de: NFC inlay cebe, baskılı plaka üstüne yapıştırılır. Toka üreticisi kimlik görmez.

## Dosyalar

- \`${AD}.step\`: mm, tek katı CAD modeli (3D baskı teklifi için).
- \`${AD}-teknik-resim.pdf\` / \`.svg\`: A3 ölçülü resim.
- \`${AD}-plaka-sablon.svg\`: 1:1 (mm) plaka baskı şablonu; QR alanı yer tutucudur.
- \`toka-olculer.json\`: parametreler. \`kontrol-raporu.json\`: geometri ve STEP dönüş kontrolleri.
`;
await writeFile(path.join(OUT, 'README.md'), readme);

const files = [`${AD}.step`, `${AD}-teknik-resim.svg`, ...(pdf ? [`${AD}-teknik-resim.pdf`] : []), `${AD}-plaka-sablon.svg`, 'toka-olculer.json', 'kontrol-raporu.json', 'README.md'];
const sums = [];
for (const fl of files) sums.push(createHash('sha256').update(await readFile(path.join(OUT, fl))).digest('hex') + '  ' + fl);
await writeFile(path.join(OUT, 'sha256sums.txt'), sums.join('\n') + '\n');
const zip = `${AD}-uretim-paketi.zip`;
execFileSync(TAR, ['-a', '-c', '-f', path.join(OUT, zip), '-C', OUT, ...files, 'sha256sums.txt']);

const link = (href, t, dl = true) => `<a href="${href}"${dl ? ' download' : ''}>${t}</a>`;
const sayfa = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><title>${esc(SPEC.parca)} — üretim paketi</title><style>body{margin:0;background:#f6f8fa;color:#13232b;font:16px/1.6 system-ui}main{max-width:1050px;margin:auto;padding:36px 24px}h1{font-size:32px}.status{color:#a44716;font-weight:600}img{width:100%;display:block;border-radius:16px;margin:24px 0;background:#fff}a{color:#11688f}.downloads{display:flex;flex-wrap:wrap;gap:12px}.downloads a{background:white;border:1px solid #dce3e8;border-radius:8px;padding:12px 18px;text-decoration:none}table{border-collapse:collapse}td{padding:4px 14px 4px 0;border-bottom:1px solid #e3e8ec}</style><main><p><a href="../../?model=toka">← 3D model</a></p><h1>${esc(SPEC.parca)} · Rev ${SPEC.rev}</h1><p class="status">${esc(SPEC.durum)}</p><p>Bandı saran C kanal; bant kanaldan kayar, dikiş tokanın altında kalır. Ön yüzde ${m(PL.boy)} × ${m(PL.en)} mm baskılı plaka (marka + tekil QR) ve altında Ø${m(NFC.cap)} NFC. ${esc(SPEC.malzeme)}.</p><table><tr><td>Dış ölçü</td><td>${m(M.L)} × ${m(H)} × ${m(TOP)} mm</td></tr><tr><td>Bant kanalı</td><td>${m(M.Kw)} × ${m(M.Kh)} mm · ${m(M.Wb)} mm bant</td></tr><tr><td>Tahmini kütle</td><td>≈ ${m(RAPOR.tahminiKutleGram)} g</td></tr><tr><td>Adet</td><td>${esc(SPEC.adet)}</td></tr></table><img src="${AD}-teknik-resim.svg" alt="Teknik resim"><div class="downloads">${link(zip, 'Üretim paketi ZIP')}${link(`${AD}.step`, 'STEP')}${pdf ? link(`${AD}-teknik-resim.pdf`, 'Teknik resim PDF', false) : ''}${link(`${AD}-teknik-resim.svg`, 'Teknik resim SVG', false)}${link(`${AD}-plaka-sablon.svg`, 'Plaka şablonu 1:1')}</div></main></html>
`;
await writeFile(path.join(OUT, 'index.html'), sayfa);
console.log(`Paket ${zip} (${(await stat(path.join(OUT, zip))).size} bayt) · PDF ${pdf ? 'var' : 'yok'}`);
