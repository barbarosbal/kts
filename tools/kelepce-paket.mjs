// kelepce-olculer.json + kelepce-v2-olculer.json → teklif paketi (uretim/kelepce/):
// STEP (v1 mil; v2 mil ve kovan), teknik resim PDF'leri, ZIP ve indirme sayfası.
// Xometry gibi anında teklif veren platformlara ya da fason atölyeye gönderilir.
// Kullanım: cd tools && npm run kelepce   (teknik resim SVG'leri önce npm run site ile üretilir)
//
// Mil geometrisi kelepce-ortak.js ile aynı kurallarla kurulur (görüntüleyici three.js, burada OpenCascade):
// dönel profil, iki açık + iki kilit SDS kanalı, altıgen kavrama, iki tırnak ve dış düz yüzler.
// Eksen: parça +Z (görüntüleyicide +Y). Tırnaklar ve kilit kanalları ±X, açık kanallar ±Y.
// Rulman (6804-2RS) ve segman (DIN 471) hazır alınır, modellenmez. Kovan tırtılı STEP'te düz silindirdir; resimde tanımlı.
import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, TAR, esc, fmt, fileSizes, planCss, printDrawing } from './paket-ortak.mjs';

const OUT = path.join(ROOT, 'uretim', 'kelepce');
const oku = async (f) => JSON.parse(await readFile(path.join(ROOT, f), 'utf8'));
const S1 = await oku('kelepce-olculer.json');
const S2 = await oku('kelepce-v2-olculer.json');
const olc = (spec) => Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));
const M1 = olc(S1);
const M2 = olc(S2);

const B1 = `kelepce-ucu-rev${S1.rev}`;
const B2 = `kelepce-ucu-v2-rev${S2.rev}`;
const FILES = {
  v1: `${B1}.step`,
  v1Pdf: `${B1}-teknik-resim.pdf`,
  v2Mil: `${B2}-mil.step`,
  v2Kovan: `${B2}-kovan.step`,
  v2Pdf: `${B2}-teknik-resim.pdf`,
  zip: `kelepce-uclari-teklif-paketi.zip`,
};

// ---------------- dönel profiller [r, z] ----------------
// v1: sap, boyun, halka, gövde, ön kanal, alın yuvası, orta cep ve delik (model-kelepce.js ile aynı)
function profilV1(spec, M) {
  const { sap, govde, alin, halka } = spec.pah;
  const BODY_R = M.D / 2, SAP_R = M.S / 2, NECK_R = M.N / 2;
  const BODY_Y = M.L + M.T;
  const FACE_Y = M.H - M.C;
  const GROOVE_Y = FACE_Y - spec.onKanal.konum;
  const ringR = M.Z / 2;
  const ring0 = M.L + spec.halka.konum;
  const ring1 = ring0 + spec.halka.kalinlik;
  const g = spec.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0], [SAP_R - sap, 0], [SAP_R, sap * 0.8], [SAP_R, M.L], [NECK_R, M.L + SAP_R - NECK_R], [NECK_R, ring0],
    [ringR - halka, ring0], [ringR, ring0 + halka], [ringR, ring1 - halka], [ringR - halka, ring1], [NECK_R, ring1],
    [NECK_R, BODY_Y], [BODY_R - govde, BODY_Y], [BODY_R, BODY_Y + govde], [BODY_R, GROOVE_Y - g], [BODY_R - g, GROOVE_Y],
    [BODY_R, GROOVE_Y + g], [BODY_R, FACE_Y - alin], [BODY_R - alin, FACE_Y], [M.W / 2, FACE_Y], [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y], [M.P / 2, cep], [M.J / 2, cep], [M.J / 2, cep - 3], [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}

// v2 mil: sap, boyun, halka, yatak yeri ve segman kanalı, dayama omzu, kafa (model-kelepce-v2.js ile aynı)
function profilV2(spec, M) {
  const { sap, govde, alin, halka } = spec.pah;
  const { yatak: YT, segman: SG } = spec;
  const BODY_R = M.D / 2, SAP_R = M.S / 2, NECK_R = M.N / 2, JR = YT.cap / 2;
  const FACE_Y = M.H - M.C;
  const GROOVE_Y = FACE_Y - spec.onKanal.konum;
  const Y_J = M.L + M.T;
  const Y_K0 = Y_J + SG.kenar;
  const Y_K1 = Y_K0 + SG.kanalEn;
  const Y_R = Y_K1 + SG.bosluk;
  const Y_C = Y_R + M.K;
  const Y_KAFA = Y_C + YT.omuzBoy;
  const ringR = M.Z / 2;
  const ring0 = M.L + spec.halka.konum;
  const ring1 = ring0 + spec.halka.kalinlik;
  const g = spec.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0], [SAP_R - sap, 0], [SAP_R, sap * 0.8], [SAP_R, M.L], [NECK_R, M.L + SAP_R - NECK_R], [NECK_R, ring0],
    [ringR - halka, ring0], [ringR, ring0 + halka], [ringR, ring1 - halka], [ringR - halka, ring1], [NECK_R, ring1],
    [NECK_R, Y_J], [JR - YT.pah, Y_J], [JR, Y_J + YT.pah], [JR, Y_K0], [SG.kanalCap / 2, Y_K0], [SG.kanalCap / 2, Y_K1],
    [JR, Y_K1], [JR, Y_C], [YT.omuzCap / 2, Y_C], [YT.omuzCap / 2, Y_KAFA], [BODY_R - govde, Y_KAFA],
    [BODY_R, Y_KAFA + govde], [BODY_R, GROOVE_Y - g], [BODY_R - g, GROOVE_Y], [BODY_R, GROOVE_Y + g],
    [BODY_R, FACE_Y - alin], [BODY_R - alin, FACE_Y], [M.W / 2, FACE_Y], [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y], [M.P / 2, cep], [M.J / 2, cep], [M.J / 2, cep - 3], [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}

// ---------------- OpenCascade ----------------
const { setOC, draw, makeCylinder, makeSphere, exportSTEP, measureVolume } = await import('replicad');
const { default: opencascade } = await import('replicad-opencascadejs');
const wasm = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm');
setOC(await opencascade({ locateFile: () => wasm }));

const polyline = (pts) => pts.slice(1).reduce((pen, p) => pen.lineTo(p), draw(pts[0])).close();
const revolve = (pts) => polyline(pts).sketchOnPlane('XZ').revolve();
// Düzlemde çizilip uzatılan katıyı, uzatma yönünde ortalar (düzlem normalinin işaretinden bağımsız)
const ortala = (solid, eksen) => {
  const [[x0, y0, z0], [x1, y1, z1]] = solid.boundingBox.bounds;
  const m = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const d = [0, 0, 0];
  d[eksen] = -m[eksen];
  return solid.translate(d);
};

function mil(spec, M, profil) {
  const SAP_R = M.S / 2;
  const FACE_Y = M.H - M.C;
  const MOUTH_X = M.A / 2;
  const OUTER_X = MOUTH_X + M.U;
  const GROOVE_Y = FACE_Y - spec.onKanal.konum;
  let govde = revolve(profil);

  // Açık kanallar (±Y): sap ucundan başlar, diskli freze çıkışı (yarıçap cikisR) ile biter
  const { en: aEn, derinlik: aDer, boy: aBoy, cikisR } = spec.sds.acik;
  const taban = SAP_R - aDer;
  const run = Math.sqrt(cikisR ** 2 - (cikisR - aDer) ** 2);
  const [cr, cz] = [taban + cikisR, aBoy - run];
  const tSon = Math.acos((cr - SAP_R - 1) / cikisR);
  const yayN = (t) => [cr - cikisR * Math.cos(t), cz + cikisR * Math.sin(t)];
  for (const s of [1, -1]) {
    const p = (r, z) => [s * r, z];
    const kesit = draw(p(taban, -2)).lineTo(p(SAP_R + 3, -2)).lineTo(p(SAP_R + 3, yayN(tSon)[1])).lineTo(p(...yayN(tSon)))
      .threePointsArcTo(p(...yayN(0)), p(...yayN(tSon / 2))).close();
    govde = govde.cut(ortala(kesit.sketchOnPlane('YZ').extrude(aEn), 0));
  }

  // Kilit kanalları (±X): kapalı bilye yatağı = kapsül (silindir + iki küre)
  const { en: kEn, derinlik: kDer, bas, son } = spec.sds.kilit;
  const kTaban = SAP_R - kDer;
  const x = Math.sqrt(SAP_R ** 2 - (kEn / 2) ** 2) - kTaban;
  const rho = (x ** 2 + (kEn / 2) ** 2) / (2 * x);
  const kcx = kTaban + rho;
  const lift = Math.sqrt(rho ** 2 - (kcx - SAP_R) ** 2);
  const [z0, z1] = [bas + lift, son - lift];
  for (const s of [1, -1]) {
    const kapsul = makeCylinder(rho, z1 - z0, [s * kcx, 0, z0], [0, 0, 1])
      .fuse(makeSphere(rho).translate([s * kcx, 0, z0]))
      .fuse(makeSphere(rho).translate([s * kcx, 0, z1]));
    govde = govde.cut(kapsul);
  }

  // Altıgen kavrama: köşeler ±X, sap çapında; SW iki karşılıklı yüz arası
  const { sw, bas: hb, son: hs } = spec.kavrama;
  const rk = sw / Math.sqrt(3);
  const altigen = polyline(Array.from({ length: 6 }, (_, i) => [rk * Math.cos((i * Math.PI) / 3), rk * Math.sin((i * Math.PI) / 3)]))
    .sketchOnPlane('XY', hb).extrude(hs - hb);
  govde = govde.cut(makeCylinder(M.D, hs - hb, [0, 0, hb], [0, 0, 1]).cut(altigen));

  // Tırnaklar (±X): kalınlık profili (ağız pahı) ∩ en profili (yan pahlar); dış yüz ön kanaldan uca düz
  const { ic, yan, dis } = spec.pah.uc;
  const y0 = FACE_Y - 1;
  const hv = M.V / 2;
  for (const s of [1, -1]) {
    const p = (r, z) => [s * r, z];
    const kalinlik = ortala(polyline([p(MOUTH_X, y0), p(OUTER_X + 2, y0), p(OUTER_X + 2, M.H), p(MOUTH_X + ic, M.H), p(MOUTH_X, M.H - ic)])
      .sketchOnPlane('XZ').extrude(M.V + 2), 1);
    const enProfil = ortala(polyline([[-hv, y0], [hv, y0], [hv, M.H - yan], [hv - yan, M.H], [-hv + yan, M.H], [-hv, M.H - yan]])
      .sketchOnPlane('YZ').extrude(M.U + 6), 0).translate([s * (OUTER_X - (M.U + 6) / 2 + 3), 0, 0]);
    govde = govde.fuse(kalinlik.intersect(enProfil));
    const duz = ortala(polyline([p(OUTER_X, GROOVE_Y + 0.2), p(OUTER_X + 6, GROOVE_Y + 0.2), p(OUTER_X + 6, M.H + 2), p(OUTER_X - dis - 2, M.H + 2), p(OUTER_X, M.H - dis)])
      .sketchOnPlane('XZ').extrude(M.D + 4), 1);
    govde = govde.cut(duz);
  }
  return govde;
}

// v2 kovan: tırtıl bölgesi düz silindir (Ø E), siper kosinüs benzeri genişleme, rulman yuvaları ve iç omuz
function kovan(spec, M) {
  const { rulman: RL, kovan: KV } = spec;
  const KV_R = M.E / 2, SIPER_R = M.F / 2, YUVA_R = RL.D / 2;
  const { siperR, arkaR, kavis } = KV;
  const k = 0.5;
  const ys = M.K - KV.siper;
  const yay = (cr, cz, r, a) => [cr + r * Math.cos(a), cz + r * Math.sin(a)];
  const kesit = draw([YUVA_R + k, 0])
    .lineTo([KV_R - arkaR, 0])
    .threePointsArcTo([KV_R, arkaR], yay(KV_R - arkaR, arkaR, arkaR, -Math.PI / 4))
    .lineTo([KV_R, ys])
    .cubicBezierCurveTo([SIPER_R, ys + kavis], [KV_R, ys + kavis * 0.45], [SIPER_R, ys + kavis * 0.55])
    .lineTo([SIPER_R, M.K - siperR])
    .threePointsArcTo([SIPER_R - siperR, M.K], yay(SIPER_R - siperR, M.K - siperR, siperR, Math.PI / 4))
    .lineTo([YUVA_R + k, M.K])
    .lineTo([YUVA_R, M.K - k])
    .lineTo([YUVA_R, M.K - RL.B])
    .lineTo([KV.icCap / 2, M.K - RL.B])
    .lineTo([KV.icCap / 2, RL.B])
    .lineTo([YUVA_R, RL.B])
    .lineTo([YUVA_R, k])
    .close();
  return kesit.sketchOnPlane('XZ').revolve();
}

const v1 = mil(S1, M1, profilV1(S1, M1));
const v2Mil = mil(S2, M2, profilV2(S2, M2));
const v2Kovan = kovan(S2, M2);

await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) if (/\.(step|pdf|zip|stl)$/.test(f)) await rm(path.join(OUT, f));

const kaydet = async (file, shape, name, color) => {
  const blob = exportSTEP([{ shape, name, color }], { unit: 'MM', modelUnit: 'MM' });
  await writeFile(path.join(OUT, file), Buffer.from(await blob.arrayBuffer()));
};
await kaydet(FILES.v1, v1, `Kelepce Sikma Ucu Rev ${S1.rev}`, '#7d838b');
await kaydet(FILES.v2Mil, v2Mil, `Kelepce Sikma Ucu v2 Mil Rev ${S2.rev}`, '#7d838b');
await kaydet(FILES.v2Kovan, v2Kovan, `Kelepce Sikma Ucu v2 Kovan Rev ${S2.rev}`, '#24272c');
const bilgi = (s) => ({ hacim: measureVolume(s), sinir: s.boundingBox.bounds, yuz: s.faces.length });
const OZ = { v1: bilgi(v1), v2Mil: bilgi(v2Mil), v2Kovan: bilgi(v2Kovan) };
for (const [k, b] of Object.entries(OZ)) {
  console.log(`STEP  ${k.padEnd(8)} hacim ${fmt(b.hacim / 1000, 1)} cm³, ${b.yuz} yüz, sınırlar ${JSON.stringify(b.sinir.map((p) => p.map((v) => Math.round(v * 100) / 100)))}`);
}
if (process.env.KELEPCE_STL) {
  // Görsel denetim için STL (pakete girmez)
  for (const [ad, s] of [['v1', v1], ['v2-mil', v2Mil], ['v2-kovan', v2Kovan]]) {
    await writeFile(path.join(process.env.KELEPCE_STL, `${ad}.stl`), Buffer.from(await s.blobSTL({ tolerance: 0.02, angularTolerance: 0.1 }).arrayBuffer()));
  }
}

// ---------------- teknik resim PDF ----------------
if (await printDrawing(path.join(ROOT, 'kelepce-ucu-taslak.svg'), path.join(OUT, FILES.v1Pdf))) console.log(`PDF   ${FILES.v1Pdf}`);
if (await printDrawing(path.join(ROOT, 'kelepce-ucu-v2-taslak.svg'), path.join(OUT, FILES.v2Pdf))) console.log(`PDF   ${FILES.v2Pdf}`);

// ---------------- indirme sayfası ----------------
const kg = (cm3, yog) => fmt((cm3 / 1000) * yog / 1000, 2);
function sayfa(sizes) {
  const dl = (file, label, sub, cls = '') => `<a class="dl${cls ? ` ${cls}` : ''}" href="${file}" download><b>${label}</b><span>${sub}${sizes?.[file] ? ` · ${sizes[file]}` : ''}</span></a>`;
  const satir = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Teklif Paketi · Kelepçe Sıkma Uçları</title>
<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">
<style>
${planCss(S1.onayli && S2.onayli)}</style>
</head>
<body>
<main>
<header>
  <div>
    <img src="../../brand/ratel-lockup.svg" alt="Ratel Systems">
    <h1>Teklif Paketi — Kelepçe Sıkma Uçları</h1>
    <div class="meta">v1 Rev ${S1.rev} · v2 Rev ${S2.rev} · ${S2.tarih} · ${esc(S1.malzeme)}</div>
  </div>
  <div style="text-align:right">
    <span class="badge">${esc(S1.durum)}</span><br>
    <a class="back noprint" href="../../?model=kelepce">← 3D model</a>
  </div>
</header>

<section class="noprint">
  <h2>İndir</h2>
  <div class="grid">
    ${dl(FILES.zip, 'Paketin tamamı (ZIP)', 'STEP + teknik resim, iki uç', 'main')}
    ${dl(FILES.v1, 'STEP · Kelepçe ucu v1', 'Tek parça mil, AP242, mm')}
    ${dl(FILES.v1Pdf, 'Teknik resim · v1 (PDF)', 'A3, ölçülü')}
    ${dl(FILES.v2Mil, 'STEP · v2 mil', 'Çelik mil, AP242, mm')}
    ${dl(FILES.v2Kovan, 'STEP · v2 kovan', 'Alüminyum kovan, tırtıl resimde')}
    ${dl(FILES.v2Pdf, 'Teknik resim · v2 (PDF)', 'A3, montaj ve parça listesi')}
  </div>
  ${S1.onayli && S2.onayli
    ? `<p class="callout"><b>Kelepçe ölçüleri onaylı.</b> Ağız A ${fmt(M1.A)}, tırnak ${fmt(M1.V)} × ${fmt(M1.U)} × ${fmt(M1.C)}, orta cep Ø${fmt(M1.P)} × ${fmt(M1.Q)}, sap boyu L ${fmt(M1.L)}. SDS-Plus kanal ölçüleri orantıyla çizildi; atölye gerçek bir SDS-Plus uçla karşılaştırır.</p>`
    : `<p class="callout"><b>Taslak.</b> Turuncu ölçüler varsayım, gerçek kelepçe ölçülünce kesinleşir. Fiyat bu paketle istenebilir, sipariş kesin ölçüyle verilir.</p>`}
</section>

<h2>Anında teklif platformuna (Xometry vb.) yükleme</h2>
<p>Her parça ayrı yüklenir; teknik resim PDF'i ilgili parçaya eklenir (diş, tolerans, ısıl işlem ve yüzey resimde).</p>
<table><thead><tr><th>Parça</th><th>Dosya</th><th>Süreç</th><th>Malzeme</th><th>Isıl işlem / yüzey</th><th>Not</th></tr></thead><tbody>
<tr><td><b>v1 mil</b></td><td>${FILES.v1}</td><td>CNC torna + freze (C eksen)</td><td>42CrMo4+QT (1.7225, AISI 4140), ıslahlı çubuk</td><td>Ek ısıl işlem yok (${esc(S1.sertlik)}) · kumlama + siyah oksit</td><td>SDS-Plus kanalları, SW ${fmt(S1.kavrama.sw)} altıgen · lazer logo (Ratel)</td></tr>
<tr><td><b>v2 mil</b></td><td>${FILES.v2Mil}</td><td>CNC torna + freze (C eksen)</td><td>42CrMo4+QT (1.7225, AISI 4140), ıslahlı çubuk</td><td>Ek ısıl işlem yok (${esc(S2.sertlik)}) · kumlama + siyah oksit</td><td>Yatak yeri Ø${fmt(S2.yatak.cap)} ${esc(S2.yatak.tolerans)} ince tornalanır · segman kanalı DIN 471</td></tr>
<tr><td><b>v2 kovan</b></td><td>${FILES.v2Kovan}</td><td>CNC torna + tırtıl</td><td>${esc(S2.kovan.malzeme)}</td><td>${esc(S2.kovan.yuzey)}</td><td>Rulman yuvaları Ø${fmt(S2.rulman.D)} ${esc(S2.kovan.yatakTolerans)} · tırtıl ${esc(S2.kovan.tirtil.tip)} ${fmt(S2.kovan.tirtil.adim)} (STEP'te düz) · lazer logo (Ratel)</td></tr>
</tbody></table>
<table><thead><tr><th>Kalem</th><th>Değer</th></tr></thead><tbody>
${satir('Adet', '1, 3 ve 10 adet için ayrı fiyat')}
${satir('Prototip', 'Siyah oksit ve lazer logo istenmezse platformda yüzey işlemi seçilmez, sipariş notuna yazılır')}
${satir('Hazır alınan (v2)', `${S2.rulman.adet} × ${esc(S2.rulman.kod)} rulman, 1 × ${esc(S2.segman.standart)} ${esc(S2.segman.olcu)} segman; montaj resimdeki sırayla`)}
${satir('Genel tolerans', esc(S1.genelTolerans))}
${satir('Tahmini ağırlık', `v1 ${kg(OZ.v1.hacim, 7.85)} kg · v2 mil ${kg(OZ.v2Mil.hacim, 7.85)} kg · v2 kovan ${kg(OZ.v2Kovan.hacim, 2.70)} kg`)}
${satir('Deneme', 'SDS-Plus mandrende ve üç ayaklı mandrende oturma; v2 kovan elde serbest dönmeli')}
</tbody></table>

<footer>Kelepçe sıkma uçları · v1 Rev ${S1.rev}, v2 Rev ${S2.rev} · ${S2.tarih} · Bu sayfa ve ekleri <code>kelepce-olculer.json</code> ve <code>kelepce-v2-olculer.json</code> dosyalarından üretildi.</footer>
</main>
</body>
</html>
`;
}

const sayfaYolu = path.join(OUT, 'index.html');
await writeFile(sayfaYolu, sayfa());
const paket = [FILES.v1, FILES.v1Pdf, FILES.v2Mil, FILES.v2Kovan, FILES.v2Pdf].filter((f) => existsSync(path.join(OUT, f)));
execFileSync(TAR, ['-a', '-c', '-f', path.join(OUT, FILES.zip), '-C', OUT, ...paket, '-C', ROOT, 'kelepce-olculer.json', 'kelepce-v2-olculer.json']);
console.log(`ZIP   ${FILES.zip}`);
await writeFile(sayfaYolu, sayfa(await fileSizes(OUT, Object.values(FILES))));
console.log('HTML  uretim/kelepce/index.html');
