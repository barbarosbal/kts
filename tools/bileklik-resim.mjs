// tipay bileklik teknik çizimleri:
//   bileklik-olculer.json        → bileklik-taslak.svg         (kapalı halka, S/M/L)
//   bileklik-ayarli-olculer.json → bileklik-ayarli-taslak.svg  (ayarlı kayış, tek beden)
// Kullanım: cd tools && node bileklik-resim.mjs  (ardından node onbellek.mjs)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAU = Math.PI * 2;
const m = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n) => Math.round(n * 10) / 10;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Ayarlı kayışın sarmal yolu: model-bileklik-ayarli.js ile aynı hesap
function ayarliYol(SPEC, O) {
  const R0 = O.C / TAU;
  const KAT = O.T + 0.15;
  const DS = 0.4;
  const s = [0];
  const rel = [0];
  const bitis = TAU + SPEC.kuyruk.uc / (R0 + O.T / 2);
  for (let i = 0; ; i++) {
    const r = R0 + KAT * smooth(TAU - 0.32, TAU - 0.03, rel[i]);
    if (rel[i] >= bitis) break;
    rel.push(rel[i] + DS / (r + O.T / 2));
    s.push(s[i] + DS);
  }
  const ara = (sx) => {
    const k = Math.min(Math.max(sx / DS, 0), rel.length - 1);
    const i = Math.min(Math.floor(k), rel.length - 2);
    return rel[i] + (rel[i + 1] - rel[i]) * (k - i);
  };
  const sBul = (h) => {
    let i = 0;
    while (i < rel.length - 1 && rel[i + 1] < h) i++;
    return (i + (h - rel[i]) / (rel[i + 1] - rel[i])) * DS;
  };
  const POD = (SPEC.yerlesim.modulAci * Math.PI) / 180;
  const OFS = POD + Math.PI - ara(SPEC.pim.konum);
  const S_POD = sBul((((POD - OFS) % TAU) + TAU) % TAU);
  const S_TAKILI = sBul(ara(SPEC.pim.konum) + TAU);
  const delikler = Array.from({ length: O.n }, (_, k) => S_TAKILI + (k - SPEC.ayar.takili) * O.p);
  return { L: s[s.length - 1], S_POD, delikler };
}

async function ciz(girdi, cikti, ayarli) {
  const SPEC = JSON.parse(await readFile(path.join(ROOT, girdi), 'utf8'));
  const O = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));
  const { modul: MOD, qr: QR, yerlesim: YER } = SPEC;
  const { W, T, Q } = O;
  const CEP = MOD.cep.en;
  const MODUL_MM = Q / (QR.modul + 2 * QR.sessiz);

  const q = SPEC.onayli ? '' : ' q';
  const out = [];
  const add = (x) => out.push(x);
  const dimH = (x1, x2, y, text, ext = []) => {
    for (const [x, y0] of ext) add(`<line class="dim" x1="${f(x)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y + (y > y0 ? 4 : -4))}"/>`);
    add(`<line class="dima" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/>`);
    const w = Math.max(44, text.length * 8.4);
    add(`<rect x="${f((x1 + x2) / 2 - w / 2)}" y="${f(y - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
    add(`<text class="tb${q}" x="${f((x1 + x2) / 2)}" y="${f(y + 5)}" text-anchor="middle">${esc(text)}</text>`);
  };
  const dimV = (x, y1, y2, text, ext = []) => {
    for (const [x0, y] of ext) add(`<line class="dim" x1="${f(x0)}" y1="${f(y)}" x2="${f(x + (x > x0 ? 4 : -4))}" y2="${f(y)}"/>`);
    add(`<line class="dima" x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y2)}"/>`);
    const w = Math.max(44, text.length * 8.4);
    add(`<rect x="${f(x - w / 2)}" y="${f((y1 + y2) / 2 - 10)}" width="${f(w)}" height="20" fill="#fff"/>`);
    add(`<text class="tb${q}" x="${f(x)}" y="${f((y1 + y2) / 2 + 5)}" text-anchor="middle">${esc(text)}</text>`);
  };
  const lead = (points, title, sub) => {
    add(`<polyline class="lead" points="${points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`);
    const [x, y] = points[points.length - 2];
    add(`<text class="tb" x="${f(x + 4)}" y="${f(y - 6)}">${esc(title)}</text>`);
    if (sub) add(`<text class="ts" x="${f(x + 4)}" y="${f(y + 14)}">${esc(sub)}</text>`);
  };
  const rect = (x, y, w, h, r, cls, extra = '') => add(`<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ${extra}/>`);

  // QR görünümü: üç bulucu + desen dolgusu (örnek; her ürün tekil basılır)
  const qrCiz = (cx, cy, mmPx) => {
    const N = QR.modul + 2 * QR.sessiz;
    const mp = MODUL_MM * mmPx;
    const ix = cx - (N * mp) / 2 + QR.sessiz * mp;
    const iy = cy - (N * mp) / 2 + QR.sessiz * mp;
    const iq = QR.modul * mp;
    add(`<rect x="${f(ix)}" y="${f(iy)}" width="${f(iq)}" height="${f(iq)}" fill="url(#qr)"/>`);
    for (const [bx, by] of [[ix, iy], [ix + iq - 7 * mp, iy], [ix, iy + iq - 7 * mp]]) {
      add(`<rect x="${f(bx)}" y="${f(by)}" width="${f(7 * mp)}" height="${f(7 * mp)}" fill="#111"/>`);
      add(`<rect x="${f(bx + mp)}" y="${f(by + mp)}" width="${f(5 * mp)}" height="${f(5 * mp)}" fill="#fff"/>`);
      add(`<rect x="${f(bx + 2 * mp)}" y="${f(by + 2 * mp)}" width="${f(3 * mp)}" height="${f(3 * mp)}" fill="#111"/>`);
    }
    return { ix, iy, iq };
  };
  // NFC dokun işareti: sağa açılan dört yay; x sol kenar, h yükseklik (px)
  const nfcIsaret = (x, cy, h) => {
    const a = 0.95;
    [0.27, 0.5, 0.73, 0.96].forEach((k) => {
      const R = (k * h) / 2 / Math.sin(a);
      const ox = x + k * h * 0.45 - R * Math.cos(a);
      add(`<path class="thin" stroke-width="1.6" d="M${f(ox + R * Math.cos(-a))},${f(cy + R * Math.sin(-a))} A${f(R)},${f(R)} 0 0 1 ${f(ox + R * Math.cos(a))},${f(cy + R * Math.sin(a))}"/>`);
    });
  };

  // Ön yüz dizisi (logo · modül · işaret) cx merkezli; K px/mm
  const onYuz = (cx, CY, K, yt) => {
    rect(cx - (CEP / 2) * K, CY - (CEP / 2) * K, CEP * K, CEP * K, 0.4 * K, 'thin');
    rect(cx - (Q / 2) * K, CY - (Q / 2) * K, Q * K, Q * K, 0.2 * K, 'vis', 'fill="#fff"');
    qrCiz(cx, CY, K);
    add(`<circle class="hid" cx="${f(cx)}" cy="${CY}" r="${f((MOD.nfc.cap / 2) * K)}"/>`);
    const hL = SPEC.logo.yukseklik;
    const logoEn = hL * 2.3;
    const lx = cx - (Q / 2 + YER.logoBosluk) * K;
    add(`<text x="${f(lx)}" y="${f(CY + hL * 0.22 * K)}" text-anchor="end" font-size="${f(hL * K)}" font-weight="600" fill="none" stroke="#111" stroke-width="1.2" textLength="${f(logoEn * K)}" lengthAdjust="spacingAndGlyphs">tipay</text>`);
    const nx = cx + (Q / 2 + YER.nfcBosluk) * K;
    nfcIsaret(nx, CY, SPEC.nfcIsareti.yukseklik * K);
    dimH(lx, cx - (Q / 2) * K, yt - 22, m(YER.logoBosluk), [[lx, CY - 30], [cx - (Q / 2) * K, CY - (Q / 2) * K - 2]]);
    dimH(cx + (Q / 2) * K, nx, yt - 22, m(YER.nfcBosluk), [[nx, CY - 20], [cx + (Q / 2) * K, CY - (Q / 2) * K - 2]]);
    lead([[lx - logoEn * K * 0.5, yt + 10], [lx - logoEn * K * 0.5 - 30, 74], [lx - logoEn * K * 0.5 + 140, 74]],
      'tipay LOGOSU', `kalıpta gömme · h ${m(hL)}`);
    lead([[cx - (Q / 2) * K + 6, CY - (Q / 2) * K + 6], [cx + 40, 74], [cx + 300, 74]],
      `KİMLİK MODÜLÜ ${m(Q)} × ${m(Q)} · GÖMME`, `cep ${m(CEP)} · yüzeyle aynı hizada, çıkıntı yok · NFC Ø${m(MOD.nfc.cap)} (kesikli)`);
    lead([[nx + 18, CY - 12], [nx + 130, 132], [nx + 300, 132]], 'DOKUN İŞARETİ', `kalıpta gömme · h ${m(SPEC.nfcIsareti.yukseklik)}`);
  };

  // ---- 1 · açılmış görünüş, dış yüz ----
  const CY = 230;
  if (!ayarli) {
    const K1 = 5;
    const BOY = SPEC.boylar.liste.find((b) => b.ad === SPEC.boylar.gosterilen);
    const L = TAU * (BOY.cevre / TAU + T);
    const X0 = 150;
    const x1 = X0 + L * K1;
    const cx = (X0 + x1) / 2;
    const yt = CY - (W / 2) * K1;
    const yb = CY + (W / 2) * K1;
    add(`<line class="ctr" x1="${X0 - 30}" y1="${CY}" x2="${f(x1 + 30)}" y2="${CY}"/>`);
    rect(X0, yt, L * K1, W * K1, O.c * K1, 'vis');
    onYuz(cx, CY, K1, yt);
    add(`<text class="tl" x="${X0 + 4}" y="${f(yb + 16)}">AÇILIM KESİĞİ</text>`);
    add(`<text class="tl" x="${f(x1 - 4)}" y="${f(yb + 16)}" text-anchor="end">AÇILIM KESİĞİ</text>`);
    dimH(X0, x1, yb + 74, `dış çevre ≈ ${Math.round(L)} (${BOY.ad})`, [[X0, yb + 2], [x1, yb + 2]]);
    dimH(cx - (Q / 2) * K1, cx + (Q / 2) * K1, yb + 30, m(Q), [[cx - (Q / 2) * K1, CY + (Q / 2) * K1 + 2], [cx + (Q / 2) * K1, CY + (Q / 2) * K1 + 2]]);
    dimV(x1 + 46, yt, yb, `W = ${m(W)}`, [[x1 + 2, yt], [x1 + 2, yb]]);
    add(`<text class="h" x="${f(cx)}" y="${f(yb + 122)}" text-anchor="middle">AÇILMIŞ HALKA · DIŞ YÜZ · ${BOY.ad} BOY · ${m(K1 / 3.78)}:1</text>`);
  } else {
    const K1 = 4;
    const { PIM, TUT } = { PIM: SPEC.pim, TUT: SPEC.tutucu };
    const { L, S_POD, delikler } = ayarliYol(SPEC, O);
    const X0 = 70;
    const X = (sx) => X0 + sx * K1;
    const yt = CY - (W / 2) * K1;
    const yb = CY + (W / 2) * K1;
    const ust = [];
    const alt = [];
    for (let sx = 0; sx <= L + 1e-6; sx += 0.5) {
      const s2 = Math.min(sx, L);
      const uc = Math.min(s2, L - s2);
      const r = W / 2;
      const w = uc < r ? 2 * Math.sqrt(Math.max(0, r * r - (r - uc) ** 2)) : W;
      ust.push([X(s2), CY - (w / 2) * K1]);
      alt.push([X(s2), CY + (w / 2) * K1]);
    }
    add(`<line class="ctr" x1="${X0 - 20}" y1="${CY}" x2="${f(X(L) + 20)}" y2="${CY}"/>`);
    add(`<polygon class="vis" points="${[...ust, ...alt.reverse()].map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`);
    onYuz(X(S_POD), CY, K1, yt);
    delikler.forEach((sx) => add(`<circle class="vis" fill="#fff" cx="${f(X(sx))}" cy="${CY}" r="${f((O.d / 2) * K1)}"/>`));
    add(`<circle class="vis" fill="#fff" cx="${f(X(PIM.konum))}" cy="${CY}" r="${f((PIM.basCap / 2) * K1)}"/>`);
    add(`<circle class="thin" cx="${f(X(PIM.konum))}" cy="${CY}" r="${f((PIM.sapCap / 2) * K1)}"/>`);
    const th = W / 2 + 0.15 + TUT.et;
    rect(X(TUT.konum) - (TUT.en / 2) * K1, CY - th * K1, TUT.en * K1, 2 * th * K1, 1.2 * K1, 'vis', 'fill="#fff"');
    add(`<text class="ts" x="${X0 + 6}" y="${f(yb + 16)}">BAŞ</text>`);
    add(`<text class="ts" x="${f(X(L) - 6)}" y="${f(yb + 16)}" text-anchor="end">KUYRUK</text>`);

    dimH(X(0), X(L), yb + 74, `L ≈ ${Math.round(L)}`, [[X(0), CY + 4], [X(L), CY + 4]]);
    dimH(X(0), X(PIM.konum), yb + 32, m(PIM.konum), [[X(0), CY + 4], [X(PIM.konum), CY + (PIM.basCap / 2) * K1]]);
    dimH(X(delikler[0]), X(delikler[O.n - 1]), yb + 32, `${O.n - 1} × ${m(O.p)} = ${m((O.n - 1) * O.p)}`, [
      [X(delikler[0]), CY + (O.d / 2) * K1], [X(delikler[O.n - 1]), CY + (O.d / 2) * K1],
    ]);
    dimV(X(TUT.konum + 15), yt, yb, `W = ${m(W)}`);
    lead([[X(PIM.konum), CY - (PIM.basCap / 2) * K1], [X(PIM.konum) - 10, 116], [X(PIM.konum) + 170, 116]],
      'MANTAR PİM', `baş Ø${m(PIM.basCap)} · kalıpla tek parça`);
    lead([[X(TUT.konum), CY + th * K1], [X(TUT.konum) + 20, yb + 58], [X(TUT.konum) + 200, yb + 58]],
      'TUTUCU HALKA', `en ${m(TUT.en)} · iki katı sarar`);
    const ys = SPEC.ayar.takili;
    const araliK = [O.C - (O.n - 1 - ys) * O.p, O.C + ys * O.p];
    lead([[X(delikler[O.n - 1]), CY - (O.d / 2) * K1], [X(delikler[O.n - 1]) - 20, 132], [X(delikler[O.n - 1]) + 150, 132]],
      `${O.n} AYAR DELİĞİ Ø${m(O.d)}`, `bilek çevresi ≈ ${araliK[0]}–${araliK[1]} mm`);
    add(`<text class="h" x="${f(X(L / 2))}" y="${f(yb + 122)}" text-anchor="middle">AÇILMIŞ KAYIŞ · DIŞ YÜZ · ${m(K1 / 3.78)}:1</text>`);
  }

  // ---- 2 · A–A kesit, kimlik modülü ----
  {
    const K = 14;
    const ox = 310;
    const oy = 640;
    const P = (y, t) => [ox + y * K, oy - t * K];
    const ac = CEP / 2;
    const du = ac - MOD.cep.dudak;
    const tz = T - MOD.cep.derinlik;
    const c = O.c;
    const gov = [
      [-W / 2 + c, 0], [W / 2 - c, 0], [W / 2, c], [W / 2, T - c], [W / 2 - c, T], [du, T], [du, T - 0.3], [ac, T - 0.3],
      [ac, tz], [-ac, tz], [-ac, T - 0.3], [-du, T - 0.3], [-du, T], [-W / 2 + c, T], [-W / 2, T - c], [-W / 2, c],
    ].map(([y, t]) => P(y, t));
    add(`<polygon class="vis" fill="url(#h1)" points="${gov.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`);
    const [nx, ny] = P(-MOD.nfc.cap / 2, tz + MOD.nfc.kalinlik);
    add(`<rect x="${f(nx)}" y="${f(ny)}" width="${f(MOD.nfc.cap * K)}" height="${f(MOD.nfc.kalinlik * K)}" fill="#111"/>`);
    const pk = MOD.plaka.kalinlik;
    const [px0, py0] = P(-Q / 2, T);
    add(`<rect class="vis" x="${f(px0)}" y="${f(py0)}" width="${f(Q * K)}" height="${f(pk * K)}" fill="url(#h2)"/>`);
    add(`<line class="ctr" x1="${ox}" y1="${oy + 30}" x2="${ox}" y2="${f(oy - T * K - 40)}"/>`);
    dimH(P(-W / 2, 0)[0], P(W / 2, 0)[0], oy + 36, `W = ${m(W)}`, [[P(-W / 2, 0)[0], oy + 2], [P(W / 2, 0)[0], oy + 2]]);
    dimH(P(-ac, 0)[0], P(ac, 0)[0], oy - T * K - 30, `cep ${m(CEP)}`, [[P(-ac, 0)[0], P(0, T)[1] - 2], [P(ac, 0)[0], P(0, T)[1] - 2]]);
    const xr = P(W / 2, 0)[0] + 34;
    dimV(xr, P(0, T)[1], P(0, 0)[1], `T = ${m(T)}`, [[P(W / 2, 0)[0] + 2, P(0, T)[1]], [P(W / 2, 0)[0] + 2, P(0, 0)[1]]]);
    dimV(P(-W / 2, 0)[0] - 36, P(0, T)[1], P(0, tz)[1], m(MOD.cep.derinlik), [[P(-ac, 0)[0], P(0, tz)[1]], [P(-W / 2, 0)[0] - 2, P(0, T)[1]]]);
    lead([[P(-Q / 4, T)[0], P(0, T)[1] + 4], [ox - 260, oy - 140], [ox - 50, oy - 140]],
      `3 · QR PLAKASI ${m(Q)} × ${m(Q)} × ${m(pk)}`, MOD.plaka.malzeme);
    lead([[P(MOD.nfc.cap / 2 - 1, tz)[0], P(0, tz)[1] - 2], [ox + 120, oy - 190], [ox + 330, oy - 190]],
      `2 · NFC INLAY Ø${m(MOD.nfc.cap)} × ${m(MOD.nfc.kalinlik)}`, MOD.nfc.cip);
    lead([[P(du, T)[0] + 4, P(0, T)[1] + 2], [ox + 160, oy - 112], [ox + 330, oy - 112]],
      `DUDAK ${m(MOD.cep.dudak)}`, 'modül bastırılarak takılır, silikon tutar');
    lead([[P(-W / 2 + 1.5, T / 3)[0], P(0, T / 3)[1]], [ox - 260, oy + 72], [ox - 70, oy + 72]],
      `1 · SİLİKON ${ayarli ? 'KAYIŞ' : 'HALKA'}`, `${SPEC.malzemeKisa} · bilek tarafı`);
    add(`<text class="h" x="${ox}" y="${oy + 120}" text-anchor="middle">A–A KESİT · KİMLİK MODÜLÜ · ${m(K / 3.78)}:1</text>`);
  }

  // ---- 3 · QR plakası ----
  {
    const K = 11;
    const cx = 820;
    const cy = 590;
    const x0 = cx - (Q / 2) * K;
    const y0 = cy - (Q / 2) * K;
    add(`<rect class="vis" x="${f(x0)}" y="${f(y0)}" width="${f(Q * K)}" height="${f(Q * K)}" fill="#fff"/>`);
    const { ix, iy, iq } = qrCiz(cx, cy, K);
    dimH(x0, x0 + Q * K, y0 - 26, m(Q), [[x0, y0 - 2], [x0 + Q * K, y0 - 2]]);
    dimV(x0 + Q * K + 32, iy, iy + iq, m(QR.modul * MODUL_MM), [[ix + iq + 2, iy], [ix + iq + 2, iy + iq]]);
    add(`<text class="tn" x="${cx}" y="${f(y0 + Q * K + 30)}" text-anchor="middle">${QR.modul} × ${QR.modul} modül · ECC ${QR.ecc} · modül ${m(MODUL_MM)} · sessiz bölge ${QR.sessiz} modül</text>`);
    add(`<text class="tn" x="${cx}" y="${f(y0 + Q * K + 50)}" text-anchor="middle">Değişken veri: her adet tekil · koyu modül, açık zemin</text>`);
    add(`<text class="h" x="${cx}" y="${f(y0 + Q * K + 82)}" text-anchor="middle">3 · QR PLAKASI · ÜSTTEN · ${m(K / 3.78)}:1</text>`);
  }

  // ---- boylar / ayar, parça listesi, notlar, antet ----
  {
    const x = 1035;
    let y = 400;
    const satir = (cells, bold) => {
      add(`<rect class="grid" x="${x}" y="${y}" width="330" height="24"/>`);
      cells.forEach((c, i) => add(`<text class="${bold ? 'tb' : `tn${q}`}" x="${x + 12 + i * 80}" y="${y + 17}">${esc(c)}</text>`));
      y += 24;
    };
    if (!ayarli) {
      add(`<text class="h" x="${x}" y="${y}">BOYLAR</text>`);
      y += 10;
      satir(['Boy', 'İç çevre', 'İç Ø', 'Dış çevre'], true);
      for (const b of SPEC.boylar.liste) {
        const r = b.cevre / TAU;
        satir([b.ad, m(b.cevre), m(Math.round(2 * r * 10) / 10), m(Math.round(TAU * (r + T)))]);
      }
    } else {
      add(`<text class="h" x="${x}" y="${y}">AYAR · TEK BEDEN</text>`);
      y += 10;
      satir(['Delik', 'İç çevre', 'İç Ø', ''], true);
      const ys = SPEC.ayar.takili;
      for (const k of [0, ys, O.n - 1]) {
        const c = O.C + (ys - k) * O.p;
        satir([`${k + 1}.${k === ys ? ' (orta)' : ''}`, m(c), m(Math.round((c / Math.PI) * 10) / 10), '']);
      }
    }
    y += 34;
    add(`<text class="h" x="${x}" y="${y}">PARÇA LİSTESİ</text>`);
    y += 10;
    const rows = [
      ['1', ayarli ? 'Silikon kayış' : 'Silikon halka', ayarli
        ? `${SPEC.malzemeKisa} · pim, tutucu, logo, işaret tek parça`
        : `${SPEC.malzemeKisa} koyu gri mat · logo ve işaret gömme`],
      ['2', 'NFC inlay', `Ø${m(MOD.nfc.cap)} · her çipe tekil adres yazılır, kilitlenir`],
      ['3', 'QR plakası', `PC ${m(Q)} × ${m(Q)} × ${m(MOD.plaka.kalinlik)} · ters baskı · tekil QR`],
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
      'TASLAK: ölçüler varsayım; numune, oturma ve',
      'tarama / dokunma testiyle kesinleşir.',
      'Tüm bileklikler NFC + QR; NFC\'siz model yoktur.',
      'Modül çıkıntısız: üst yüz kayış yüzüyle aynı hizada.',
      'Kayış üreticisi kimlik görmez: modül (2 + 3)',
      'tipay\'de cebe bastırılarak takılır.',
      'QR yükü yalnız origin + /a/<publicId>.',
      ayarli ? 'Toka bileğin arkasında; ön yüz kapalı halkayla aynı.' : 'Plaka halka eğrisine ısıl şekillendirilir.',
      'Silikonun cilt temasına uygunluk belgesi istenir.',
    ];
    y += 6;
    for (const n of notlar) {
      y += 18;
      add(`<text class="ts" x="${x}" y="${y}">${esc(n)}</text>`);
    }
    const ay = 862;
    add(`<rect class="grid" x="${x}" y="${ay}" width="330" height="96" stroke-width="1.6"/>`);
    add(`<line class="grid" x1="${x}" y1="${ay + 40}" x2="${x + 330}" y2="${ay + 40}"/>`);
    add(`<text class="h" x="${x + 12}" y="${ay + 27}" textLength="${Math.min(306, SPEC.parca.length * 10.4)}" lengthAdjust="spacingAndGlyphs">${esc(SPEC.parca)}</text>`);
    add(`<text class="ts" x="${x + 12}" y="${ay + 60}">Rev ${SPEC.rev} · ${SPEC.tarih} · ${SPEC.onayli ? 'ONAYLI' : 'TASLAK'} · ölçüler mm</text>`);
    add(`<text class="ts" x="${x + 12}" y="${ay + 80}">Seri: sıkıştırma kalıp · prototip: üretan döküm</text>`);
    add(`<text class="tl" x="${x + 318}" y="${ay + 60}" text-anchor="end">Ratel Systems</text>`);
    if (!SPEC.onayli) add(`<text class="tn q" x="${x}" y="${ay - 10}">Turuncu ölçüler ön değerdir.</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,1.5 L10,5 L0,8.5 z" fill="#111"/>
    </marker>
    <pattern id="h1" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff"/><line x1="0" y1="0" x2="0" y2="9" stroke="#111" stroke-width=".8"/></pattern>
    <pattern id="h2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="4" stroke="#111" stroke-width=".6"/></pattern>
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
  await writeFile(path.join(ROOT, cikti), svg);
  console.log(`SVG   ${cikti}`);
}

await ciz('bileklik-olculer.json', 'bileklik-taslak.svg', false);
await ciz('bileklik-ayarli-olculer.json', 'bileklik-ayarli-taslak.svg', true);
