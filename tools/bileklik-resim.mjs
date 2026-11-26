// tipay bileklik teknik çizimi: bileklik-olculer.json → bileklik-taslak.svg
// Kullanım: cd tools && node bileklik-resim.mjs  (ardından node onbellek.mjs)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = JSON.parse(await readFile(path.join(ROOT, 'bileklik-olculer.json'), 'utf8'));
const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
const { pim: PIM, tutucu: TUT, modul: MOD, qr: QR } = SPEC;

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const m = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- kayış yolu: model-bileklik.js ile aynı hesap ----
const R0 = O.R;
const T = O.T;
const W = O.W;
const WP = O.Wp;
const KAT = T + 0.15;
const DS = 0.4;
const POD = rad(SPEC.yerlesim.modulAci);
const R_DIS = R0 + T;
const POD_YARI = WP / 2 / R_DIS;

const s = [0];
const rel = [0];
const bitis = TAU + SPEC.kuyruk.uc / (R0 + T / 2);
for (let i = 0; ; i++) {
  const r = R0 + KAT * smooth(TAU - 0.32, TAU - 0.03, rel[i]);
  if (rel[i] >= bitis) break;
  rel.push(rel[i] + DS / (r + T / 2));
  s.push(s[i] + DS);
}
const L = s[s.length - 1];
const ara = (arr, sx) => {
  const f = Math.min(Math.max(sx / DS, 0), arr.length - 1);
  const i = Math.min(Math.floor(f), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};
const sBul = (hedef) => {
  let i = 0;
  while (i < rel.length - 1 && rel[i + 1] < hedef) i++;
  return (i + (hedef - rel[i]) / (rel[i + 1] - rel[i])) * DS;
};
const OFS = POD + Math.PI - ara(rel, PIM.konum);
const S_POD = sBul(POD - OFS + (POD - OFS < 0 ? TAU : 0));
const S_LOGO = sBul(((POD + rad(SPEC.yerlesim.logoAci) - OFS) % TAU + TAU) % TAU);
const S_TAKILI = sBul(ara(rel, PIM.konum) + TAU);
const DELIKLER = Array.from({ length: O.n }, (_, k) => S_TAKILI + (k - SPEC.ayar.takili) * O.p);
const CEVRE = TAU * R0;
const ARALIK = [CEVRE - (O.n - 1 - SPEC.ayar.takili) * O.p, CEVRE + SPEC.ayar.takili * O.p];

function en(sx) {
  let w = W;
  const r = ara(rel, sx);
  if (r < TAU) w += (WP - 1.5 - W) * (1 - smooth(POD_YARI, POD_YARI + 0.4, Math.abs(sar(r + OFS - POD))));
  const uc = Math.min(sx, L - sx);
  const h = w / 2;
  if (uc < h) w = 2 * Math.sqrt(Math.max(0, h * h - (h - uc) ** 2));
  return w;
}

// ---- çizim yardımcıları ----
const q = SPEC.onayli ? '' : ' q';
const out = [];
const add = (x) => out.push(x);
const f = (n) => Math.round(n * 10) / 10;
const pts = (arr) => arr.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
function dimH(x1, x2, y, text, { ext = [] } = {}) {
  for (const [x, y0] of ext) add(`<line class="dim" x1="${f(x)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y + (y > y0 ? 4 : -4))}"/>`);
  add(`<line class="dima" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/>`);
  const w = Math.max(56, text.length * 8.2);
  add(`<rect x="${f((x1 + x2) / 2 - w / 2)}" y="${f(y - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
  add(`<text class="tb${q}" x="${f((x1 + x2) / 2)}" y="${f(y + 5)}" text-anchor="middle">${esc(text)}</text>`);
}
function dimV(x, y1, y2, text, { ext = [] } = {}) {
  for (const [x0, y] of ext) add(`<line class="dim" x1="${f(x0)}" y1="${f(y)}" x2="${f(x + (x > x0 ? 4 : -4))}" y2="${f(y)}"/>`);
  add(`<line class="dima" x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y2)}"/>`);
  const w = Math.max(56, text.length * 8.2);
  add(`<rect x="${f(x - w / 2)}" y="${f((y1 + y2) / 2 - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
  add(`<text class="tb${q}" x="${f(x)}" y="${f((y1 + y2) / 2 + 5)}" text-anchor="middle">${esc(text)}</text>`);
}
function lead(points, title, sub) {
  add(`<polyline class="lead" points="${pts(points)}"/>`);
  const [x, y] = points[points.length - 2];
  add(`<text class="tb" x="${f(x + 4)}" y="${f(y - 6)}">${esc(title)}</text>`);
  if (sub) add(`<text class="ts" x="${f(x + 4)}" y="${f(y + 14)}">${esc(sub)}</text>`);
}
const rrect = (x, y, w, h, r, cls, extra = '') => add(`<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ${extra}/>`);

// ---- 1 · açılmış kayış, dış yüz ----
const K1 = 4.4;
const X0 = 90;
const CY = 225;
const X = (sx) => X0 + sx * K1;
{
  const ust = [];
  const alt = [];
  for (let sx = 0; sx <= L + 1e-6; sx += 0.5) {
    const w = en(Math.min(sx, L));
    ust.push([X(sx), CY - (w / 2) * K1]);
    alt.push([X(sx), CY + (w / 2) * K1]);
  }
  add(`<line class="ctr" x1="${X0 - 30}" y1="${CY}" x2="${f(X(L) + 30)}" y2="${CY}"/>`);
  add(`<polygon class="vis" points="${pts([...ust, ...alt.reverse()])}"/>`);

  // modül yuvası, cep ve plaka
  const px = X(S_POD);
  rrect(px - (WP / 2) * K1, CY - (WP / 2) * K1, WP * K1, WP * K1, 3 * K1, 'vis');
  const c = MOD.yuva.en;
  rrect(px - (c / 2) * K1, CY - (c / 2) * K1, c * K1, c * K1, 0.6 * K1, 'thin');
  const pe = MOD.plaka.en - 1.6;
  rrect(px - (pe / 2) * K1, CY - (pe / 2) * K1, pe * K1, pe * K1, 0, 'thin', 'fill="url(#qr)"');
  add(`<circle class="hid" cx="${f(px)}" cy="${CY}" r="${f((MOD.nfc.cap / 2) * K1)}"/>`);

  // delikler, pim, tutucu, logo
  DELIKLER.forEach((sx) => add(`<circle class="vis" fill="#fff" cx="${f(X(sx))}" cy="${CY}" r="${f((O.d / 2) * K1)}"/>`));
  add(`<circle class="vis" fill="#fff" cx="${f(X(PIM.konum))}" cy="${CY}" r="${f((PIM.basCap / 2) * K1)}"/>`);
  add(`<circle class="thin" cx="${f(X(PIM.konum))}" cy="${CY}" r="${f((PIM.sapCap / 2) * K1)}"/>`);
  const th = W / 2 + 0.15 + TUT.et;
  rrect(X(TUT.konum) - (TUT.en / 2) * K1, CY - th * K1, TUT.en * K1, 2 * th * K1, 1.2 * K1, 'vis', 'fill="#fff"');
  add(`<text x="${f(X(S_LOGO))}" y="${f(CY + 2.6 * K1)}" text-anchor="middle" font-size="${f(SPEC.logo.yukseklik * K1 * 1.05)}" font-weight="600" fill="none" stroke="#111" stroke-width="1">tipay</text>`);

  // ölçüler
  const yAlt = CY + (WP / 2) * K1;
  dimH(X(0), X(L), yAlt + 64, `L ≈ ${Math.round(L)}`, { ext: [[X(0), CY + 4], [X(L), CY + 4]] });
  dimH(X(0), X(PIM.konum), yAlt + 30, m(PIM.konum), { ext: [[X(0), CY + 4], [X(PIM.konum), CY + (PIM.basCap / 2) * K1]] });
  dimH(X(0), px, CY - (WP / 2) * K1 - 22, `${Math.round(S_POD)}`, { ext: [[X(0), CY - 4], [px, CY - (WP / 2) * K1]] });
  dimH(X(DELIKLER[0]), X(DELIKLER[O.n - 1]), yAlt + 30, `${O.n - 1} × ${m(O.p)} = ${m((O.n - 1) * O.p)}`, {
    ext: [[X(DELIKLER[0]), CY + (O.d / 2) * K1], [X(DELIKLER[O.n - 1]), CY + (O.d / 2) * K1]],
  });
  dimV(X(72), CY - (W / 2) * K1, CY + (W / 2) * K1, `W = ${m(W)}`);
  dimV(px - (WP / 2) * K1 - 30, CY - (WP / 2) * K1, CY + (WP / 2) * K1, m(WP), {
    ext: [[px - (WP / 2) * K1 + 6, CY - (WP / 2) * K1], [px - (WP / 2) * K1 + 6, CY + (WP / 2) * K1]],
  });

  lead([[X(PIM.konum), CY - (PIM.basCap / 2) * K1], [X(PIM.konum) - 10, 58], [X(PIM.konum) + 200, 58]],
    'MANTAR PİM', `baş Ø${m(PIM.basCap)} · sap Ø${m(PIM.sapCap)} · kalıpla tek parça`);
  lead([[X(TUT.konum), CY - th * K1], [X(TUT.konum) + 30, 104], [X(TUT.konum) + 210, 104]],
    'TUTUCU HALKA', `en ${m(TUT.en)} · et ${m(TUT.et)} · iki katı sarar`);
  lead([[px, CY - (WP / 2) * K1], [px + 40, 58], [px + 300, 58]],
    `KİMLİK MODÜLÜ YUVASI ${m(WP)} × ${m(WP)}`, `cep ${m(MOD.yuva.en)} · derinlik ${m(MOD.yuva.derinlik)} · NFC Ø${m(MOD.nfc.cap)} (kesikli)`);
  lead([[X(DELIKLER[O.n - 1]), CY - (O.d / 2) * K1], [X(DELIKLER[O.n - 1]) + 20, 104], [X(DELIKLER[O.n - 1]) + 220, 104]],
    `${O.n} AYAR DELİĞİ Ø${m(O.d)}`, `bilek çevresi ≈ ${Math.round(ARALIK[0])}–${Math.round(ARALIK[1])} mm`);
  add(`<text class="ts" x="${X0 - 4}" y="${CY + 5}" text-anchor="end">BAŞ</text>`);
  add(`<text class="ts" x="${f(X(L) + 6)}" y="${CY + 5}">KUYRUK</text>`);
  add(`<text class="h" x="${f(X(L / 2))}" y="${f(yAlt + 112)}" text-anchor="middle">AÇILMIŞ KAYIŞ · DIŞ YÜZ · ${m(K1 / 3.78)}:1</text>`);
}

// ---- 2 · A–A kesit, kimlik modülü ----
{
  const K = 12;
  const ox = 290;
  const oy = 640;                          // bilek yüzü
  const P = (y, t) => [ox + y * K, oy - t * K];
  const tUst = T + O.h;
  const tZemin = tUst - MOD.yuva.derinlik;
  const ac = MOD.yuva.en / 2;
  const du = ac - MOD.yuva.dudak;
  const gov = [
    [-WP / 2, 0], [WP / 2, 0], [WP / 2, tUst], [du, tUst], [du, tUst - 0.4], [ac, tUst - 0.4], [ac, tZemin],
    [-ac, tZemin], [-ac, tUst - 0.4], [-du, tUst - 0.4], [-du, tUst], [-WP / 2, tUst],
  ].map(([y, t]) => P(y, t));
  add(`<polygon class="vis" fill="url(#h1)" points="${pts(gov)}"/>`);
  const nfc0 = tZemin;
  const nfc1 = tZemin + MOD.nfc.kalinlik;
  const [n0x, n0y] = P(-MOD.nfc.cap / 2, nfc1);
  add(`<rect x="${f(n0x)}" y="${f(n0y)}" width="${f(MOD.nfc.cap * K)}" height="${f(MOD.nfc.kalinlik * K)}" fill="#111"/>`);
  const p0 = nfc1 + 0.05;
  const p1 = p0 + MOD.plaka.kalinlik;
  const [p0x, p0y] = P(-MOD.plaka.en / 2, p1);
  add(`<rect class="vis" x="${f(p0x)}" y="${f(p0y)}" width="${f(MOD.plaka.en * K)}" height="${f(MOD.plaka.kalinlik * K)}" fill="url(#h2)"/>`);
  add(`<line class="ctr" x1="${ox}" y1="${oy + 30}" x2="${ox}" y2="${oy - tUst * K - 40}"/>`);
  add(`<line class="hid" x1="${f(P(-WP / 2, T)[0])}" y1="${f(P(0, T)[1])}" x2="${f(P(WP / 2, T)[0])}" y2="${f(P(0, T)[1])}"/>`);

  dimH(P(-WP / 2, 0)[0], P(WP / 2, 0)[0], oy + 34, m(WP), { ext: [[P(-WP / 2, 0)[0], oy + 2], [P(WP / 2, 0)[0], oy + 2]] });
  dimH(P(-ac, 0)[0], P(ac, 0)[0], oy - tUst * K - 30, `cep ${m(MOD.yuva.en)}`, { ext: [[P(-ac, 0)[0], P(0, tZemin)[1]], [P(ac, 0)[0], P(0, tZemin)[1]]] });
  const xr = P(WP / 2, 0)[0] + 30;
  dimV(xr, P(0, tUst)[1], P(0, 0)[1], m(tUst), { ext: [[P(WP / 2, 0)[0] + 2, P(0, tUst)[1]], [P(WP / 2, 0)[0] + 2, P(0, 0)[1]]] });
  dimV(xr + 62, P(0, T)[1], P(0, 0)[1], `T = ${m(T)}`, { ext: [[P(WP / 2, 0)[0] + 2, P(0, T)[1]]] });
  dimV(P(-WP / 2, 0)[0] - 34, P(0, tUst)[1], P(0, tZemin)[1], m(MOD.yuva.derinlik), {
    ext: [[P(-ac, 0)[0], P(0, tZemin)[1]], [P(-WP / 2, 0)[0], P(0, tUst)[1]]],
  });

  lead([[P(-MOD.plaka.en / 4, p1)[0], P(0, p1)[1] + 6], [ox - 250, oy - 150], [ox - 40, oy - 150]],
    `3 · KİMLİK PLAKASI ${m(MOD.plaka.en)} × ${m(MOD.plaka.en)} × ${m(MOD.plaka.kalinlik)}`, MOD.plaka.malzeme);
  lead([[P(MOD.nfc.cap / 2 - 1, nfc0)[0], P(0, nfc0)[1] - 2], [ox + 110, oy - 190], [ox + 330, oy - 190]],
    `2 · NFC INLAY Ø${m(MOD.nfc.cap)} × ${m(MOD.nfc.kalinlik)}`, MOD.nfc.cip);
  lead([[P(du, tUst)[0] + 4, P(0, tUst)[1] + 2], [ox + 150, oy - 112], [ox + 330, oy - 112]],
    `DUDAK ${m(MOD.yuva.dudak)}`, 'modül bastırılarak takılır, silikon tutar');
  lead([[P(-WP / 2 + 2, T / 2)[0], P(0, T / 2)[1]], [ox - 250, oy + 70], [ox - 60, oy + 70]],
    '1 · SİLİKON KAYIŞ', `${SPEC.malzemeKisa} · bilek tarafı`);
  add(`<text class="h" x="${ox}" y="${oy + 120}" text-anchor="middle">A–A KESİT · KİMLİK MODÜLÜ · ${m(K / 3.78)}:1</text>`);
}

// ---- 3 · kimlik plakası ----
{
  const K = 9;
  const e = MOD.plaka.en;
  const cx = 830;
  const cy = 600;
  const x0 = cx - (e / 2) * K;
  const y0 = cy - (e / 2) * K;
  add(`<rect class="vis" x="${f(x0)}" y="${f(y0)}" width="${f(e * K)}" height="${f(e * K)}" fill="#fff"/>`);
  const N = QR.modul + 2 * QR.sessiz;
  const mod = 0.45;
  const qx = cx - ((N * mod) / 2) * K;
  const qy = cy - ((N * mod) / 2) * K;
  add(`<rect class="thin" x="${f(qx)}" y="${f(qy)}" width="${f(N * mod * K)}" height="${f(N * mod * K)}" stroke-dasharray="4 3"/>`);
  const ix = qx + QR.sessiz * mod * K;
  const iy = qy + QR.sessiz * mod * K;
  const s7 = 7 * mod * K;
  const iq = QR.modul * mod * K;
  add(`<rect x="${f(ix)}" y="${f(iy)}" width="${f(iq)}" height="${f(iq)}" fill="url(#qr)"/>`);
  for (const [bx, by] of [[ix, iy], [ix + iq - s7, iy], [ix, iy + iq - s7]]) {
    add(`<rect x="${f(bx)}" y="${f(by)}" width="${f(s7)}" height="${f(s7)}" fill="#111"/>`);
    add(`<rect x="${f(bx + mod * K)}" y="${f(by + mod * K)}" width="${f(s7 - 2 * mod * K)}" height="${f(s7 - 2 * mod * K)}" fill="#fff"/>`);
    add(`<rect x="${f(bx + 2 * mod * K)}" y="${f(by + 2 * mod * K)}" width="${f(3 * mod * K)}" height="${f(3 * mod * K)}" fill="#111"/>`);
  }
  dimH(x0, x0 + e * K, y0 - 26, m(e), { ext: [[x0, y0 - 2], [x0 + e * K, y0 - 2]] });
  dimV(x0 + e * K + 30, qy, qy + N * mod * K, m(N * mod), { ext: [[qx + N * mod * K + 2, qy], [qx + N * mod * K + 2, qy + N * mod * K]] });
  add(`<text class="tn" x="${cx}" y="${f(y0 + e * K + 30)}" text-anchor="middle">${QR.modul} × ${QR.modul} modül · ECC ${QR.ecc} · sessiz bölge ${QR.sessiz} modül · modül ${m(mod)}</text>`);
  add(`<text class="tn" x="${cx}" y="${f(y0 + e * K + 50)}" text-anchor="middle">Değişken veri: her adet tekil · koyu modül, açık zemin</text>`);
  add(`<text class="h" x="${cx}" y="${f(y0 + e * K + 82)}" text-anchor="middle">3 · KİMLİK PLAKASI · ÜSTTEN · ${m(K / 3.78)}:1</text>`);
}

// ---- parça listesi, notlar, antet ----
{
  const x = 1035;
  let y = 430;
  add(`<text class="h" x="${x}" y="${y}">PARÇA LİSTESİ</text>`);
  y += 12;
  const rows = [
    ['1', 'Silikon kayış', `${SPEC.malzemeKisa} siyah mat · pim, tutucu, logo tek parça`],
    ['2', 'NFC inlay', `Ø${m(MOD.nfc.cap)}; her çipe tekil adres yazılır, kilitlenir`],
    ['3', 'Kimlik plakası', `PC ${m(MOD.plaka.en)} × ${m(MOD.plaka.en)} × ${m(MOD.plaka.kalinlik)}, ters baskı, tekil QR`],
  ];
  for (const [no, ad, not] of rows) {
    add(`<rect class="grid" x="${x}" y="${y}" width="330" height="44"/>`);
    add(`<text class="tb" x="${x + 10}" y="${y + 19}">${no}</text>`);
    add(`<text class="tb" x="${x + 32}" y="${y + 19}">${esc(ad)}</text>`);
    add(`<text class="tl" x="${x + 32}" y="${y + 35}">${esc(not)}</text>`);
    y += 44;
  }
  y += 30;
  add(`<text class="h" x="${x}" y="${y}">NOTLAR</text>`);
  const notlar = [
    'TASLAK: ölçüler varsayım; numune, bilek oturması',
    've tarama / dokunma testiyle kesinleşir.',
    'Tüm bileklikler NFC + QR; NFC\'siz model yoktur.',
    'Kayış üreticisi kimlik görmez: modül (2 + 3)',
    'tipay\'de yuvaya bastırılarak takılır.',
    'QR yükü yalnız origin + /a/<publicId>.',
    `Ayar ${O.n} delik × ${m(O.p)} mm: bilek ≈ ${Math.round(ARALIK[0])}–${Math.round(ARALIK[1])} mm.`,
    'Farklı boy gerekirse yalnız kayış boyu değişir.',
    'Silikonun cilt temasına uygunluk belgesi istenir.',
  ];
  y += 8;
  for (const n of notlar) {
    y += 19;
    add(`<text class="ts" x="${x}" y="${y}">${esc(n)}</text>`);
  }

  const ax = 1035;
  const ay = 860;
  add(`<rect class="grid" x="${ax}" y="${ay}" width="330" height="96" stroke-width="1.6"/>`);
  add(`<line class="grid" x1="${ax}" y1="${ay + 40}" x2="${ax + 330}" y2="${ay + 40}"/>`);
  add(`<text class="h" x="${ax + 12}" y="${ay + 27}">${esc(SPEC.parca)}</text>`);
  add(`<text class="ts" x="${ax + 12}" y="${ay + 60}">Rev ${SPEC.rev} · ${SPEC.tarih} · ${SPEC.onayli ? 'ONAYLI' : 'TASLAK'} · ölçüler mm</text>`);
  add(`<text class="ts" x="${ax + 12}" y="${ay + 80}">Seri: sıkıştırma kalıp · prototip: üretan döküm</text>`);
  add(`<text class="tl" x="${ax + 318}" y="${ay + 60}" text-anchor="end">Ratel Systems</text>`);
  if (!SPEC.onayli) add(`<text class="tn q" x="${ax}" y="${ay - 12}">Turuncu ölçüler ön değerdir.</text>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/>
    </marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <pattern id="h2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#111" stroke-width=".6"/></pattern>
    <pattern id="qr" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#bbb"/><rect x="4" y="4" width="4" height="4" fill="#bbb"/></pattern>
    <style>
      .vis{stroke:#111;stroke-width:2.2;stroke-linejoin:round}
      polygon.vis:not([fill]),rect.vis:not([fill]){fill:#fff}
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
  ${out.join('\n  ')}
</svg>
`;
await writeFile(path.join(ROOT, 'bileklik-taslak.svg'), svg);
console.log(`SVG   bileklik-taslak.svg  L ≈ ${L.toFixed(1)} mm · modül s ≈ ${S_POD.toFixed(1)} · bilek ${ARALIK.map(Math.round).join('–')} mm`);
