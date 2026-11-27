// PA12 toka: teknik resim (A3 SVG + PDF), 1:1 etiket baskı şablonu, paket sayfası, README ve ZIP
// Kullanım: cd tools && node toka.mjs && node toka-resim.mjs && node onbellek.mjs  (TOKA_SVG_ONLY=1: PDF basılmaz)
import { readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
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
const yuv = (n) => Math.round(n * 1000) / 1000;
const H = yuv(M.Kw + 2 * M.Yn);
const TOP = yuv(M.Ar + M.Kh + M.On);
const RB = M.Rb;
const RF = RB + TOP;
const SEHIM = RAPOR.dis.ucSehimi;
const MOD_MM = PL.qrAlan / (QR.modul + 2 * QR.sessiz);

// Eski revizyon dosyalarını kaldır (yalnız güncel revizyon pakette kalır)
for (const f of await readdir(OUT)) {
  if (f.startsWith(`${SPEC.kod}-rev`) && !f.startsWith(`${AD}.`) && !f.startsWith(`${AD}-`)) await unlink(path.join(OUT, f));
}

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
}
// Etiket: siyah zemin, marka, QR alanı
function etiketCiz(x0, y0, K) {
  rect(x0, y0, PL.boy * K, PL.en * K, 0.3 * K, 'vis', 'fill="#1a1b1e"');
  const qx = x0 + (PL.boy - PL.qrAlan) * K;
  qrCiz(qx, y0, K);
  const alan = (PL.boy - PL.qrAlan) * K;
  add(`<text x="${f(x0 + alan / 2)}" y="${f(y0 + (PL.en / 2 + 2.3) * K)}" text-anchor="middle" font-size="${f(7.2 * K)}" font-weight="600" fill="#f2eee5">${esc(PL.marka)}</text>`);
  return qx;
}
// Kavis merkezli yay (yan görünüş): x ∈ [-xm, xm], z(x) = -RB + √(r² − x²)
const yay = (r, xm, n = 60) => Array.from({ length: n + 1 }, (_, i) => {
  const x = -xm + (2 * xm * i) / n;
  return [x, -RB + Math.sqrt(r * r - x * x)];
});

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
  const qx = etiketCiz(cx - (PL.boy / 2) * K, cy - (PL.en / 2) * K, K);
  add(`<circle class="hid" cx="${f(qx + (PL.qrAlan / 2) * K)}" cy="${cy}" r="${f((NFC.cap / 2) * K)}"/>`);
  for (const s of [-1, 1]) add(`<line class="hid" x1="${f(x0)}" y1="${f(cy + s * (M.Kw / 2) * K)}" x2="${f(x0 + M.L * K)}" y2="${f(cy + s * (M.Kw / 2) * K)}"/>`);
  dimH(x0, x0 + M.L * K, y0 + H * K + 62, `L = ${m(M.L)}`, [[x0, cy + 20], [x0 + M.L * K, cy + 20]]);
  dimH(cx - (CEP.boy / 2) * K, cx + (CEP.boy / 2) * K, y0 + H * K + 28, `cep ${m(CEP.boy)}`, [
    [cx - (CEP.boy / 2) * K, cy + (CEP.en / 2) * K + 2], [cx + (CEP.boy / 2) * K, cy + (CEP.en / 2) * K + 2]]);
  dimV(x0 + M.L * K + 42, y0, y0 + H * K, m(H), [[x0 + M.L * K - 10, y0], [x0 + M.L * K - 10, y0 + H * K]]);
  dimV(x0 - 40, cy - (CEP.en / 2) * K, cy + (CEP.en / 2) * K, m(CEP.en), [[cx - (CEP.boy / 2) * K, cy - (CEP.en / 2) * K], [cx - (CEP.boy / 2) * K, cy + (CEP.en / 2) * K]]);
  lead([[x0 + 8, y0 + 6], [x0 - 30, 70], [x0 + 170, 70]], `PA12 TOKA · R${m(M.Rk)} köşe`, `ön ve bilek kenarları R${m(M.Rf)}`);
  lead([[qx + 10, y0 + (H / 2 - 7) * K], [qx + 90, 70], [qx + 300, 70]], `ESNEK ETİKET ${m(PL.boy)} × ${m(PL.en)}`, `marka + QR ${m(PL.qrAlan)} × ${m(PL.qrAlan)} · NFC Ø${m(NFC.cap)} altında (kesikli)`);
  add(`<text class="h" x="${cx}" y="${f(y0 + H * K + 112)}" text-anchor="middle">ÖNDEN · ${m(K / 3.78)}:1</text>`);
}

// ---- 2 · yandan görünüş (kavis) ----
{
  const K = 9;
  const cx = 850;
  const zy = 190;                          // bilek yüzü tepesi (z = 0)
  const X = (x) => cx + x * K;
  const Z = (z) => zy - z * K;
  const xm = M.L / 2;
  const dis = [...yay(RF, xm), ...yay(RB, xm).reverse()].map(([x, z]) => `${f(X(x))},${f(Z(z))}`).join(' ');
  add(`<polygon class="vis" fill="#fff" points="${dis}"/>`);
  for (const r of [RB + M.Ar, RB + M.Ar + M.Kh]) {
    add(`<polyline class="hid" points="${yay(r, xm).map(([x, z]) => `${f(X(x))},${f(Z(z))}`).join(' ')}"/>`);
  }
  add(`<polyline class="hid" points="${yay(RF - CEP.derinlik, CEP.boy / 2).map(([x, z]) => `${f(X(x))},${f(Z(z))}`).join(' ')}"/>`);
  add(`<line class="ctr" x1="${f(X(0))}" y1="${f(Z(TOP) - 30)}" x2="${f(X(0))}" y2="${f(Z(-SEHIM) + 30)}"/>`);
  dimH(X(-xm), X(xm), Z(-SEHIM) + 34, m(M.L), [[X(-xm), Z(-SEHIM) + 2], [X(xm), Z(-SEHIM) + 2]]);
  dimV(X(xm) + 40, Z(TOP), Z(0), m(TOP), [[X(0) + 4, Z(TOP)], [X(0) + 4, Z(0)]]);
  dimV(X(xm) + 96, Z(0), Z(-SEHIM), m(SEHIM), [[X(0) + 4, Z(0)], [X(xm) + 2, Z(-SEHIM)]]);
  lead([[X(xm * 0.55), Z(-RB + Math.sqrt(RB * RB - (xm * 0.55) ** 2))], [X(xm) - 10, Z(-SEHIM) + 62], [X(xm) + 150, Z(-SEHIM) + 62]],
    `BİLEK YÜZÜ R${m(RB)}`, 'kanal kavsi izler (kesikli)');
  add(`<text class="ts" x="${f(X(0))}" y="${f(Z(TOP) - 38)}" text-anchor="middle">ön yüz (etiket tarafı)</text>`);
  add(`<text class="h" x="${f(X(0))}" y="${f(Z(-SEHIM) + 100)}" text-anchor="middle">YANDAN · ${m(K / 3.78)}:1</text>`);
}

// ---- 3 · A–A kesit (bant enine, kapalı kanal) ----
{
  const K = 14;
  const ox = 330;
  const oy = 770;                          // bilek yüzü (z = 0)
  const P = (y, z) => [ox + y * K, oy - z * K];
  const yH = H / 2;
  const yK = M.Kw / 2;
  const zK0 = M.Ar;
  const zK1 = M.Ar + M.Kh;
  const zC = TOP - CEP.derinlik;
  const yC = CEP.en / 2;
  const yol = (pts) => `M${pts.map(([y, z]) => P(y, z).map(f).join(',')).join(' L')} Z`;
  const dis = [[-yH, 0], [yH, 0], [yH, TOP], [yC, TOP], [yC, zC], [-yC, zC], [-yC, TOP], [-yH, TOP]];
  const ic = [[-yK, zK0], [yK, zK0], [yK, zK1], [-yK, zK1]];
  add(`<path class="vis" fill="url(#h1)" fill-rule="evenodd" d="${yol(dis)} ${yol(ic)}"/>`);
  for (const k of [0, 1]) {
    const [bx, by] = P(-M.Wb / 2, zK0 + 0.1 + (k + 1) * M.Tb);
    add(`<rect class="thin" x="${f(bx)}" y="${f(by)}" width="${f(M.Wb * K)}" height="${f(M.Tb * K)}" fill="url(#h3)"/>`);
  }
  const [nx, ny] = P(-NFC.cap / 2, zC + NFC.kalinlik);
  add(`<rect x="${f(nx)}" y="${f(ny)}" width="${f(NFC.cap * K)}" height="${f(NFC.kalinlik * K)}" fill="#111"/>`);
  const [px, py] = P(-PL.en / 2, TOP - 0.05);
  add(`<rect class="thin" x="${f(px)}" y="${f(py)}" width="${f(PL.en * K)}" height="${f(PL.kalinlik * K)}" fill="#666"/>`);
  add(`<line class="ctr" x1="${ox}" y1="${f(oy + 30)}" x2="${ox}" y2="${f(oy - TOP * K - 40)}"/>`);

  dimH(P(-yH, 0)[0], P(yH, 0)[0], oy + 34, m(H), [[P(-yH, 0)[0], oy + 2], [P(yH, 0)[0], oy + 2]]);
  dimH(P(-yK, 0)[0], P(yK, 0)[0], oy - TOP * K - 30, `kanal ${m(M.Kw)}`, [[P(-yK, 0)[0], P(0, zK1)[1] - 2], [P(yK, 0)[0], P(0, zK1)[1] - 2]]);
  const xr = P(yH, 0)[0] + 36;
  dimV(xr, P(0, TOP)[1], P(0, 0)[1], m(TOP), [[P(yH, 0)[0] + 2, P(0, TOP)[1]], [P(yH, 0)[0] + 2, P(0, 0)[1]]]);
  dimV(xr + 60, P(0, zK1)[1], P(0, zK0)[1], `Kh ${m(M.Kh)}`, [[P(yK, 0)[0], P(0, zK1)[1]], [P(yK, 0)[0], P(0, zK0)[1]]]);
  dimV(P(-yH, 0)[0] - 40, P(0, TOP)[1], P(0, zC)[1], m(CEP.derinlik), [[P(-yC, 0)[0], P(0, zC)[1]], [P(-yH, 0)[0] - 2, P(0, TOP)[1]]]);
  dimV(P(-yH, 0)[0] - 40, P(0, zK0)[1], P(0, 0)[1], `arka ${m(M.Ar)}`, [[P(-yK, 0)[0], P(0, zK0)[1]], [P(-yH, 0)[0] - 2, P(0, 0)[1]]]);
  lead([[P(-PL.en / 4, TOP)[0], P(0, TOP)[1] + 2], [ox - 250, oy - 150], [ox - 40, oy - 150]],
    `3 · ETİKET ${m(PL.boy)} × ${m(PL.en)} × ${m(PL.kalinlik)}`, PL.malzeme);
  lead([[P(NFC.cap / 2 - 1, zC)[0], P(0, zC)[1] - 2], [ox + 130, oy - 170], [ox + 330, oy - 170]],
    `2 · NFC Ø${m(NFC.cap)} × ${m(NFC.kalinlik)}`, 'cep tabanında, QR alanının altında');
  lead([[P(yH - 0.7, M.Ar + M.Kh / 2)[0], P(0, M.Ar + M.Kh / 2)[1]], [ox + 170, oy - 125], [ox + 330, oy - 125]],
    '1 · PA12 TOKA · KAPALI KANAL', `ön ${m(M.On)} · yan ${m(M.Yn)} · arka ${m(M.Ar)}`);
  lead([[P(-M.Wb / 2 + 2, zK0 + 0.1 + M.Tb)[0], P(0, zK0 + 0.1 + M.Tb)[1]], [ox - 250, oy + 90], [ox - 60, oy + 90]],
    'ELASTİK BANT · DİKİŞ YERİ', `${m(M.Wb)} × ${m(M.Tb)} · iki kat`);
  add(`<text class="h" x="${ox + 120}" y="${f(oy + 150)}" text-anchor="middle">A–A KESİT · ${m(K / 3.78)}:1</text>`);
}

// ---- 4 · etiket baskısı ----
{
  const K = 6;
  const x0 = 680;
  const y0 = 700;
  etiketCiz(x0, y0, K);
  dimH(x0, x0 + PL.boy * K, y0 - 22, m(PL.boy), [[x0, y0 - 2], [x0 + PL.boy * K, y0 - 2]]);
  dimH(x0 + (PL.boy - PL.qrAlan) * K, x0 + PL.boy * K, y0 + PL.en * K + 24, `QR ${m(PL.qrAlan)}`, [
    [x0 + (PL.boy - PL.qrAlan) * K, y0 + PL.en * K + 2], [x0 + PL.boy * K, y0 + PL.en * K + 2]]);
  dimV(x0 + PL.boy * K + 34, y0, y0 + PL.en * K, m(PL.en), [[x0 + PL.boy * K + 2, y0], [x0 + PL.boy * K + 2, y0 + PL.en * K]]);
  add(`<text class="tn" x="${x0}" y="${f(y0 + PL.en * K + 62)}">${QR.modul} × ${QR.modul} modül · ECC ${QR.ecc} · modül ${m(MOD_MM)} · sessiz bölge ${QR.sessiz} modül</text>`);
  add(`<text class="tn" x="${x0}" y="${f(y0 + PL.en * K + 80)}">Her adet tekil QR · koyu modül, açık zemin</text>`);
  add(`<text class="h" x="${x0}" y="${f(y0 + PL.en * K + 104)}">ETİKET BASKISI · ${m(K / 3.78)}:1</text>`);
}

// ---- parça listesi, notlar, antet ----
{
  const x = 1035;
  let y = 380;
  add(`<text class="h" x="${x}" y="${y}">PARÇA LİSTESİ</text>`);
  y += 10;
  const rows = [
    ['1', 'PA12 toka', `3D baskı · arkası kapalı · R${m(RB)} · ≈ ${m(RAPOR.tahminiKutleGram)} g`],
    ['2', 'NFC inlay', `Ø${m(NFC.cap)} esnek · tekil adres, kilitli`],
    ['3', 'Esnek etiket', `${m(PL.boy)} × ${m(PL.en)} × ${m(PL.kalinlik)} polyester · tekil QR`],
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
    'Kanal kapalı, iki uçtan açık: baskı tozu temizlenir.',
    'Kanal ölçüsü gerçek bantla 3 numunede denenir.',
    'Montaj: toka banda geçirilir, uçlar üst üste',
    'dikilir; dikiş kapalı kanalın içinde kalır.',
    "NFC + etiket tipay'de yapıştırılır;",
    'toka üreticisi ürün kimliği görmez.',
    'Marka yalnız etikette: ad değişirse toka aynı kalır.',
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

// 1:1 etiket baskı şablonu (mm): QR alanı yer tutucu; her adetin QR'ı üretimde tekil basılır
out.length = 0;
etiketCiz(0, 0, 1);
const sablon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PL.boy} ${PL.en}" width="${PL.boy}mm" height="${PL.en}mm" font-family="Arial, Helvetica, sans-serif">
  ${DEFS.replace(/stroke-width:2\.2/, 'stroke-width:0.1')}
  ${out.join('\n  ')}
</svg>
`;
await writeFile(path.join(OUT, `${AD}-etiket-sablon.svg`), sablon);

let pdf = false;
if (!process.env.TOKA_SVG_ONLY) pdf = await printDrawing(resimSvg, path.join(OUT, `${AD}-teknik-resim.pdf`));

// ---- README, paket sayfası, ZIP ----
const K_ = RAPOR.kontroller;
const readme = `# ${SPEC.parca} · Rev ${SPEC.rev}

**Durum:** ${SPEC.durum}. Bu paket üretim onayı değildir; ${SPEC.adet}.

## Parça

Kurucunun sac prototipinin fikri: toka bandın dikiş yerini örter, bant tokanın içinden geçer.
Rev B: **arkası kapalı kanal** (bant çıkmaz, bileğe kenar değmez) ve **bilek formunda kavis** (bilek yüzü R${m(RB)}).
Metal yerine **${SPEC.malzemeKisa}**: NFC metalde çalışmaz; plastikte normal NFC inlay yeterli, ferrit gerekmez.

| Ölçü | Değer |
|---|---:|
| Dış ölçü (önden izdüşüm × tepe kalınlığı) | ${m(M.L)} × ${m(H)} × ${m(TOP)} mm |
| Bilek yüzü kavsi / uç sehimi | R${m(RB)} / ${m(SEHIM)} mm |
| Kapalı bant kanalı | ${m(M.Kw)} × ${m(M.Kh)} mm (dikişte iki kat ${m(M.Tb)} mm bant) |
| Ön / yan / arka duvar | ${m(M.On)} / ${m(M.Yn)} / ${m(M.Ar)} mm |
| Etiket cebi | ${m(CEP.boy)} × ${m(CEP.en)} × ${m(CEP.derinlik)} mm, kavisi izler |
| Kenar yuvarlatması | ön ve bilek yüzü ${RAPOR.kenarYuvarlatmasi}, önden köşe R${m(M.Rk)} |
| Tahmini kütle | ≈ ${m(RAPOR.tahminiKutleGram)} g |

## Üretim

- **Malzeme:** ${SPEC.malzeme}. **Yüzey:** ${SPEC.yuzey}
- **Tolerans:** ${SPEC.genelTolerans}.
- Kanal iki uçtan açık; 3D baskı tozu temizlenebilir.
- Önce 3 numune: banda geçirme, ter / su / sürtünme, bilekte kullanım; iPhone ve Android'de QR + NFC.
- Montaj tipay'de: NFC inlay cebe, esnek etiket üstüne yapıştırılır. Toka üreticisi kimlik görmez.

## CAD kontrolleri

- Bellekte tek katı, OpenCascade kesin (exact) BRep kontrolü: ${K_.brepGecerliKesin ? 'geçti' : 'geçmedi'}.
- STEP dışa aktarma ve geri okuma: standart BRep kontrolü ${K_.stepGecerliStandart ? 'geçti' : 'geçmedi'}, hacim farkı ${K_.stepHacimFarkiMm3.toExponential(1)} mm³.
- Kesin (exact) kontrol STEP dönüşünde ${K_.stepGecerliKesin ? 'geçti' : 'geçmiyor: kavisli yüz kesişim eğrileri STEP\'e yaklaşık yazılıyor (tolerans düzeyi)'}.

## Dosyalar

- \`${AD}.step\`: mm, tek katı CAD modeli (3D baskı teklifi için).
- \`${AD}-teknik-resim.pdf\` / \`.svg\`: A3 ölçülü resim.
- \`${AD}-etiket-sablon.svg\`: 1:1 (mm) etiket baskı şablonu; QR alanı yer tutucudur.
- \`toka-olculer.json\`: parametreler. \`kontrol-raporu.json\`: geometri ve STEP dönüş kontrolleri.
`;
await writeFile(path.join(OUT, 'README.md'), readme);

const files = [`${AD}.step`, `${AD}-teknik-resim.svg`, ...(pdf ? [`${AD}-teknik-resim.pdf`] : []), `${AD}-etiket-sablon.svg`, 'toka-olculer.json', 'kontrol-raporu.json', 'README.md'];
const sums = [];
for (const fl of files) sums.push(createHash('sha256').update(await readFile(path.join(OUT, fl))).digest('hex') + '  ' + fl);
await writeFile(path.join(OUT, 'sha256sums.txt'), sums.join('\n') + '\n');
const zip = `${AD}-uretim-paketi.zip`;
execFileSync(TAR, ['-a', '-c', '-f', path.join(OUT, zip), '-C', OUT, ...files, 'sha256sums.txt']);

const link = (href, t, dl = true) => `<a href="${href}"${dl ? ' download' : ''}>${t}</a>`;
const sayfa = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><title>${esc(SPEC.parca)} — üretim paketi</title><style>body{margin:0;background:#f6f8fa;color:#13232b;font:16px/1.6 system-ui}main{max-width:1050px;margin:auto;padding:36px 24px}h1{font-size:32px}.status{color:#a44716;font-weight:600}img{width:100%;display:block;border-radius:16px;margin:24px 0;background:#fff}a{color:#11688f}.downloads{display:flex;flex-wrap:wrap;gap:12px}.downloads a{background:white;border:1px solid #dce3e8;border-radius:8px;padding:12px 18px;text-decoration:none}table{border-collapse:collapse}td{padding:4px 14px 4px 0;border-bottom:1px solid #e3e8ec}</style><main><p><a href="../../?model=toka">← 3D model</a></p><h1>${esc(SPEC.parca)} · Rev ${SPEC.rev}</h1><p class="status">${esc(SPEC.durum)}</p><p>Arkası kapalı kanal: bant tokanın içinden geçer, dikiş içeride kalır. Bilek yüzü R${m(RB)} kavisli. Ön yüzde ${m(PL.boy)} × ${m(PL.en)} mm esnek etiket (marka + tekil QR) ve altında Ø${m(NFC.cap)} NFC. ${esc(SPEC.malzeme)}.</p><table><tr><td>Dış ölçü</td><td>${m(M.L)} × ${m(H)} × ${m(TOP)} mm · uç sehimi ${m(SEHIM)} mm</td></tr><tr><td>Kapalı kanal</td><td>${m(M.Kw)} × ${m(M.Kh)} mm · ${m(M.Wb)} mm bant</td></tr><tr><td>Tahmini kütle</td><td>≈ ${m(RAPOR.tahminiKutleGram)} g</td></tr><tr><td>Adet</td><td>${esc(SPEC.adet)}</td></tr></table><img src="${AD}-teknik-resim.svg" alt="Teknik resim"><div class="downloads">${link(zip, 'Üretim paketi ZIP')}${link(`${AD}.step`, 'STEP')}${pdf ? link(`${AD}-teknik-resim.pdf`, 'Teknik resim PDF', false) : ''}${link(`${AD}-teknik-resim.svg`, 'Teknik resim SVG', false)}${link(`${AD}-etiket-sablon.svg`, 'Etiket şablonu 1:1')}</div></main></html>
`;
await writeFile(path.join(OUT, 'index.html'), sayfa);
console.log(`Paket ${zip} (${(await stat(path.join(OUT, zip))).size} bayt) · PDF ${pdf ? 'var' : 'yok'}`);
