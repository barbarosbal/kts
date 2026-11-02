// rekor-olculer.json → STEP (gövde, bilezik, montaj), DXF, teknik resim PDF, üretim planı (HTML + PDF), ZIP.
// Kullanım: cd tools && npm run rekor
import { writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TAR, Dxf, esc, fmt, fileSizes, planCss, printDrawing, printPdf, table } from './paket-ortak.mjs';
import {
  ROOT, spec, M, BSP, ust, alt, CONTA, BORE_R, NECK_R, COLLAR_R, HEX_R, SPIGOT_R, SEAT_Y, SPIGOT_Y, FACE_Y,
  COLLAR_TOP, NECK_TOP, LIP, CH_U, CH_B, CH_A, collarGeometry, contactArea, contactArc,
} from './rekor-olcu.mjs';

const OUT = path.join(ROOT, 'uretim', 'rekor');
const DRAWING = path.join(ROOT, 'oynar-rekor-taslak.svg');
const BASE = `oynar-rekor-rev${spec.rev}`;
const FILES = {
  govde: `${BASE}-govde.step`,
  bilezik: `${BASE}-bilezik.step`,
  montaj: `${BASE}-montaj.step`,
  dxf: `${BASE}.dxf`,
  drawingPdf: `${BASE}-teknik-resim.pdf`,
  planPdf: `${BASE}-uretim-plani.pdf`,
  zip: `${BASE}-uretim-paketi.zip`,
};
const T = spec.tolerans;
const DENSITY = 8.5e-6;                    // kg/mm³

// ---------------- kesit profilleri [r, z] ----------------
const CONICAL = /^R/.test(ust.dis);
const taper = (z) => (CONICAL ? (M.H - z - BSP.gauge) / 32 : 0);
const rEnd = BSP.minor / 2 - 0.3;          // serbest uçta diş dibine 45° pah
const FREE = (BSP.major / 2 - BSP.gauge / 32 * (CONICAL ? 1 : 0) - rEnd) / (CONICAL ? 31 / 32 : 1);
const RISE = (BSP.major / 2 + taper(NECK_TOP) - NECK_R) / (CONICAL ? 33 / 32 : 1);

const bodyProfile = [
  [BORE_R, SPIGOT_Y],
  [SPIGOT_R - 0.5, SPIGOT_Y],
  [SPIGOT_R, SPIGOT_Y + 0.5],
  [SPIGOT_R, FACE_Y],
  [COLLAR_R - CH_B, FACE_Y],
  [COLLAR_R, FACE_Y + CH_B],
  [COLLAR_R, COLLAR_TOP - CH_U],
  [COLLAR_R - CH_U, COLLAR_TOP],
  [NECK_R, COLLAR_TOP],
  [NECK_R, NECK_TOP],
  [NECK_R + RISE, NECK_TOP + RISE],
  [rEnd + FREE, M.H - FREE],
  [rEnd, M.H],
  [BORE_R + 0.5, M.H],
  [BORE_R, M.H - 0.5],
];

const rT = BSP.major / 2;
const rTap = BSP.tapDrill / 2;
const nutRing = () => {
  const rFace = HEX_R - 0.4;
  const rOut = HEX_R / Math.cos(Math.PI / 6) + 1;
  const ch = (rOut - rFace) * Math.tan(Math.PI / 6);
  return [
    [rT + 0.8, 0],
    [rFace, 0],
    [rOut, ch],
    [rOut, M.B - ch],
    [rFace, M.B],
    [M.W / 2 + CH_A, M.B],
    [M.W / 2, M.B - CH_A],
    [M.W / 2, COLLAR_TOP],
    [M.G / 2, COLLAR_TOP],
    [M.G / 2, M.C],
    [rTap, M.C],
    [rTap, rT + 0.8 - rTap],
  ];
};

// ---------------- STEP ----------------
async function buildStep() {
  const { setOC, draw, exportSTEP, measureVolume } = await import('replicad');
  const { default: opencascade } = await import('replicad-opencascadejs');
  const wasm = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm');
  setOC(await opencascade({ locateFile: () => wasm }));

  const polygon = (pts) => pts.slice(1).reduce((pen, p) => pen.lineTo(p), draw(pts[0])).close();
  const revolve = (pts) => polygon(pts).sketchOnPlane('XZ').revolve();

  // Gövde: kesit döndürülür, yakanın iki yanı çizgiyle kesilir (kesikler ±Y)
  const { hf, rc, ef, ang, cx, a, b } = collarGeometry();
  const fm = (ang + Math.PI / 2) / 2;
  const [mx, my] = [cx + rc * Math.cos(fm), ef + rc * Math.sin(fm)];
  const outline = draw([cx, hf])
    .lineTo([-cx, hf])
    .threePointsArcTo([-a, b], [-mx, my])
    .threePointsArcTo([-a, -b], [-COLLAR_R, 0])
    .threePointsArcTo([-cx, -hf], [-mx, -my])
    .lineTo([cx, -hf])
    .threePointsArcTo([a, -b], [mx, -my])
    .threePointsArcTo([a, b], [COLLAR_R, 0])
    .threePointsArcTo([cx, hf], [mx, my])
    .close();
  const govde = revolve(bodyProfile).intersect(outline.sketchOnPlane('XY', -2).extrude(M.H + 4));

  // Bilezik: pahlı halka ∩ altıgen
  const rc6 = HEX_R / Math.cos(Math.PI / 6);
  const hex = polygon(Array.from({ length: 6 }, (_, i) => {
    const t = (i * Math.PI) / 3;
    return [rc6 * Math.sin(t), rc6 * Math.cos(t)];
  })).sketchOnPlane('XY', -1).extrude(M.B + 2);
  const bilezik = revolve(nutRing()).intersect(hex);

  const conta = revolve([[CONTA.ic / 2, SEAT_Y], [CONTA.dis / 2, SEAT_Y], [CONTA.dis / 2, FACE_Y], [CONTA.ic / 2, FACE_Y]]);

  const save = async (file, shapes) => {
    const blob = exportSTEP(shapes, { unit: 'MM', modelUnit: 'MM' });
    await writeFile(path.join(OUT, file), Buffer.from(await blob.arrayBuffer()));
  };
  const parts = {
    govde: { shape: govde, name: `Oynar Rekor Govde Rev ${spec.rev}`, color: '#d8b868' },
    bilezik: { shape: bilezik, name: `Oynar Rekor Bilezik Rev ${spec.rev}`, color: '#d8b868' },
    conta: { shape: conta, name: 'Klingerit Conta', color: '#55665c' },
  };
  await save(FILES.govde, [parts.govde]);
  await save(FILES.bilezik, [parts.bilezik]);
  await save(FILES.montaj, Object.values(parts));
  const info = (s) => ({ volume: measureVolume(s), bounds: s.boundingBox.bounds, faces: s.faces.length });
  return { govde: info(govde), bilezik: info(bilezik) };
}

// ---------------- DXF ----------------
function buildDxf() {
  const d = new Dxf();
  const closed = (pts) => [...pts, pts[0]];
  const both = (x0, pts, layer = 'KONTUR') => {
    for (const s of [1, -1]) d.path(layer, closed(pts).map(([r, z]) => [x0 + s * r, z]));
  };

  // Gövde kesiti: kulaklardan
  both(0, bodyProfile);
  for (const s of [1, -1]) d.line('DIS', [s * (BSP.minor / 2), M.H - 2], [s * (BSP.minor / 2), NECK_TOP + 2]);
  d.line('EKSEN', [0, SPIGOT_Y - 6], [0, M.H + 6]);
  d.text('YAZI', [-30, SPIGOT_Y - 12], 3.5, 'GOVDE KESITI');
  d.text('YAZI', [BSP.major / 2 + 4, M.H - 8], 2.5, `${ust.dis} dis dis`);

  // Bilezik kesiti: altıgen yüzlerinden
  const nx = 110;
  const nut = nutRing().map(([r, z], i) => (i >= 1 && i <= 4 ? [Math.min(r, HEX_R), z] : [r, z]));
  both(nx, nut);
  for (const s of [1, -1]) d.line('DIS', [nx + s * rT, 0], [nx + s * rT, M.C]);
  d.line('EKSEN', [nx, -6], [nx, M.B + 6]);
  d.text('YAZI', [nx - 30, -12], 3.5, 'BILEZIK KESITI');
  d.text('YAZI', [nx + HEX_R + 4, 6], 2.5, `${alt.dis} ic dis`);

  // Yaka, alttan: kesikler Y yönünde
  const { hf, rc, ef, ang, cx } = collarGeometry();
  const deg = (r) => (r * 180) / Math.PI;
  const c1 = [225, 30];
  const at = ([x, y]) => [c1[0] + x, c1[1] + y];
  d.line('KONTUR', at([-cx, hf]), at([cx, hf]));
  d.line('KONTUR', at([-cx, -hf]), at([cx, -hf]));
  d.arc('KONTUR', c1, COLLAR_R, -deg(ang), deg(ang));
  d.arc('KONTUR', c1, COLLAR_R, 180 - deg(ang), 180 + deg(ang));
  d.arc('KONTUR', at([cx, ef]), rc, deg(ang), 90);
  d.arc('KONTUR', at([-cx, ef]), rc, 90, 180 - deg(ang));
  d.arc('KONTUR', at([-cx, -ef]), rc, 180 + deg(ang), 270);
  d.arc('KONTUR', at([cx, -ef]), rc, 270, 360 - deg(ang));
  d.circle('KONTUR', c1, SPIGOT_R);
  d.circle('KONTUR', c1, BORE_R);
  d.circle('GIZLI', c1, NECK_R);
  d.line('EKSEN', at([-COLLAR_R - 6, 0]), at([COLLAR_R + 6, 0]));
  d.line('EKSEN', at([0, -hf - 6]), at([0, hf + 6]));
  d.text('YAZI', at([-30, -hf - 14]), 3.5, 'YAKA (alttan)');

  // Bilezik, üstten
  const c2 = [330, 30];
  const rc6 = HEX_R / Math.cos(Math.PI / 6);
  const hexPts = Array.from({ length: 6 }, (_, i) => {
    const t = (i * Math.PI) / 3;
    return [c2[0] + rc6 * Math.sin(t), c2[1] + rc6 * Math.cos(t)];
  });
  d.path('KONTUR', closed(hexPts));
  d.circle('KONTUR', c2, HEX_R - 0.4);
  d.circle('KONTUR', c2, M.W / 2);
  d.circle('KONTUR', c2, M.W / 2 + CH_A);
  d.circle('GIZLI', c2, M.G / 2);
  d.line('EKSEN', [c2[0] - rc6 - 6, c2[1]], [c2[0] + rc6 + 6, c2[1]]);
  d.line('EKSEN', [c2[0], c2[1] - rc6 - 6], [c2[0], c2[1] + rc6 + 6]);
  d.text('YAZI', [c2[0] - 30, c2[1] - rc6 - 14], 3.5, 'BILEZIK (ustten)');

  // Antet
  const dims = Object.entries(M).map(([k, v]) => `${k}=${String(v)}`).join('  ');
  d.text('YAZI', [-30, -32], 3.5, `OYNAR REKOR - Rev ${spec.rev} - ${spec.tarih} - Olcek 1:1 - mm - ${spec.malzemeKisa}`);
  d.text('YAZI', [-30, -38], 2.5, dims);
  d.text('YAZI', [-30, -43], 2.5, 'Olculer onaylidir. Disler nominal cizgidir, tolerans ve dis tipi teknik resimde.');
  return writeFile(path.join(OUT, FILES.dxf), d.toString(), 'latin1');
}

// ---------------- üretim planı ----------------
const BAR_SIZES = [50, 55, 60, 63, 65, 70, 75, 80, 85, 90, 100];

function planData(info) {
  const bodyBar = BAR_SIZES.find((s) => s >= M.D + 1) ?? Math.ceil(M.D + 5);
  const bodyLen = M.H - SPIGOT_Y;
  const bodyBlank = bodyLen + 7;
  const nutBlank = M.B + 7;
  const nutRound = BAR_SIZES.find((s) => s >= (M.S / Math.cos(Math.PI / 6)) + 2) ?? 100;
  const bodyRaw = (Math.PI / 4) * bodyBar ** 2 * bodyBlank * DENSITY;
  const nutRaw = (Math.sqrt(3) / 2) * M.S ** 2 * nutBlank * DENSITY;

  // Dayanım el hesabı
  const YIELD = 140;
  const TORQUE = 200;
  const pMax = spec.isletmeBasinci.max;
  const pTest = spec.testBasinci;
  const area = contactArea();
  const arc = contactArc();
  const part1Seal = Math.PI * ((BSP.minor / 2 - 0.3) ** 2 - 20.5 ** 2);        // Parça 1 üst alın halkası
  const seat = (30 * part1Seal) / 1000;                                         // kN, 30 MPa conta oturma
  const lift = (0.1 * pTest * Math.PI * (BSP.minor - 0.6) ** 2) / 4 / 1000;     // kN, test basıncı
  const LOAD = Math.round((seat + lift) * 10) / 10;
  const wall = (M.N - M.E) / 2;
  const rootWall = (BSP.minor - M.E) / 2;
  const hoop = (bar, D, t) => (bar * 0.1 * D) / (2 * t);
  const neckA = (Math.PI / 4) * (M.N ** 2 - M.E ** 2);
  const tau = (TORQUE * 1000 * (M.N / 2)) / ((Math.PI / 32) * (M.N ** 4 - M.E ** 4));
  const F = LOAD * 1000;
  const bend = (6 * (F / arc.length) * (arc.r - NECK_R)) / M.T ** 2;
  const strength = [
    [`${pMax} bar, boyun (et ${fmt(wall)} mm)`, hoop(pMax, M.N, wall), YIELD],
    [`${pTest} bar test, diş dibi (et ${fmt(rootWall, 1)} mm)`, hoop(pTest, BSP.minor, rootWall), YIELD],
    [`${fmt(LOAD)} kN çekme, boyun`, F / neckA, YIELD],
    [`${fmt(LOAD)} kN, tırnak–yaka teması (${Math.round(area)} mm²)`, F / area, YIELD],
    [`${fmt(LOAD)} kN, yaka kulağı eğilmesi (T = ${M.T})`, bend, YIELD],
    [`${fmt(LOAD)} kN, tırnak kesmesi (${LIP} mm)`, F / (2 * Math.PI * (M.G / 2) * LIP), 0.58 * YIELD],
    [`${fmt(LOAD)} kN, iç diş kesmesi (${M.C} mm)`, F / (Math.PI * BSP.minor * M.C * 0.6), 0.58 * YIELD],
    [`${TORQUE} Nm sıkma, boyun burulması`, tau, 0.58 * YIELD],
  ];
  const seatTorque = 0.2 * (seat * 1000) * ((BSP.major + BSP.minor) / 2 / 1000);
  const govdeKg = info.govde.volume * DENSITY;
  const bilezikKg = info.bilezik.volume * DENSITY;
  return { bodyBar, bodyLen, bodyBlank, nutBlank, nutRound, bodyRaw, nutRaw, YIELD, strength, area, LOAD, seat, lift, seatTorque, govdeKg, bilezikKg, wall, rootWall };
}

function planHtml(info, sizes) {
  const d = planData(info);
  const way = spec.sokme.yol;
  const shift = Math.max(...way.map((p) => Math.abs(p[0])));
  const tilt = Math.max(...way.map((p) => Math.abs(p[2])));
  const dl = (file, label, sub, cls = '') => `<a class="dl ${cls}" href="${file}" download><b>${label}</b><span>${sub}${sizes?.[file] ? ` · ${sizes[file]}` : ''}</span></a>`;
  const letter = (k) => (['D', 'E', 'N', 'W', 'G'].includes(k) ? `Ø${k}` : k);

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Üretim Paketi · ${esc(spec.parca)} Rev ${spec.rev}</title>
<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">
<style>
${planCss(spec.onayli)}</style>
</head>
<body>
<main>
<header>
  <div>
    <img src="../../brand/ratel-lockup.svg" alt="Ratel Systems">
    <h1>Üretim Paketi — ${esc(spec.parca)}</h1>
    <div class="meta">Rev ${spec.rev} · ${spec.tarih} · ${esc(spec.malzeme)} · ${esc(spec.adet)}</div>
  </div>
  <div style="text-align:right">
    <span class="badge">${esc(spec.durum)}</span><br>
    <a class="back noprint" href="../../?model=rekor">← 3D model</a>
  </div>
</header>

<section class="noprint">
  <h2>İndir</h2>
  <div class="grid">
    ${dl(FILES.zip, 'Paketin tamamı (ZIP)', 'Fason atölyeye gönderilecek dosya', 'main')}
    ${dl(FILES.govde, 'STEP · Gövde', 'CAM için, AP242, mm')}
    ${dl(FILES.bilezik, 'STEP · Bilezik', 'CAM için, AP242, mm')}
    ${dl(FILES.montaj, 'STEP · Montaj', 'Gövde, bilezik, conta birlikte')}
    ${dl(FILES.drawingPdf, 'Teknik resim (PDF)', 'A3, ölçülü')}
    ${dl(FILES.dxf, 'DXF', 'Kesitler ve görünüşler, 1:1, mm')}
    ${dl(FILES.planPdf, 'Üretim planı (PDF)', 'Bu sayfanın baskısı')}
  </div>
</section>

<h2>1. Özet</h2>
<div class="facts">
  <div><small>Parça</small><b>${esc(spec.parca)}</b></div>
  <div><small>Revizyon</small><b>${spec.rev} · ${spec.tarih}</b></div>
  <div><small>Malzeme</small><b>${esc(spec.malzeme.split(' (')[0])}</b></div>
  <div><small>Adet</small><b>${esc(spec.adet)}</b></div>
  <div><small>Takım</small><b>Gövde + bilezik + conta</b></div>
  <div><small>Ağırlık (tahmini)</small><b>${fmt(d.govdeKg, 2)} kg gövde · ${fmt(d.bilezikKg, 2)} kg bilezik</b></div>
  <div><small>Genel tolerans</small><b>${esc(spec.genelTolerans)}</b></div>
  <div><small>Bağlantı</small><b>${ust.dis} dış / ${alt.dis} iç</b></div>
  <div><small>İşletme / test basıncı</small><b>${spec.isletmeBasinci.min}–${spec.isletmeBasinci.max} bar / ${spec.testBasinci} bar</b></div>
</div>

<h2>2. Açık konular <small>siparişten önce kapatılacak</small></h2>
<ol class="open">
  <li><b>Prototip testi:</b> sızdırmazlık ve sökme hareketi hesap ve simülasyonla doğrulandı. Sipariş öncesi ilk parçada Parça 1 ile ${spec.testBasinci} bar test ve elle sökme denemesi yapılacak.</li>
  <li><b>Çözülme payı:</b> sökerken Parça 1 ya da gövde en az ${spec.merkezleme.giris} mm eksen boyunca çekilebilmeli. Tesisatta bu pay olduğu teyit edilecek.</li>
  <li><b>Çalışma sıcaklığı:</b> ${esc(spec.calismaKosulu.replace(/^B/, 'b'))} bildirildi; normal ve azami sıcaklık ile conta sınıfı teyit edilecek.</li>
  <li><b>Yüzey ve markalama:</b> doğal pirinç mi, nikel kaplama mı? Lazer markalama (logo, rev, parti no) istenecek mi?</li>
</ol>

<h2>3. Çalışma prensibi ve üretilebilirlik</h2>
<p><b>Bilezik sökülebilir, gövde yerinde kalır.</b> Gövdenin üst dişi bağlıyken bilezik Parça 1'den sökülür, sonra gövdeden de tamamen çıkarılır. Bilezik ağzı çentiksiz, düz yuvarlaktır (Ø${fmt(M.W)}). Yaka (Ø${fmt(M.D)}) ağızdan büyüktür, bu yüzden tırnak yakaya basar ve sıkma her açıda aynıdır. Yakanın iki yanı ${fmt(M.F)} mm'ye kesik olduğu için bilezik ${fmt(shift)} mm yana kaydırılıp ${fmt(tilt)}° eğilince yaka ağızdan sıyrılır.</p>
${table(['Adım', 'Sökme', 'Takma'], [
    ['1', `Bilezik Parça 1'den sökülür. Merkezleme deliğinden çıkar, conta alınır.`, 'Gövde üst dişe sıkılır (bilezik takılı değilken, yaka kesiklerinden SW ' + fmt(M.F) + ').'],
    ['2', `Bilezik ${fmt(shift)} mm yana kaydırılır, yakanın bir ucu ağız içine girer.`, 'Bilezik eğik tutularak yakanın bir ucundan geçirilir.'],
    ['3', `Bilezik ${fmt(tilt)}° eğilir, yaka ağızdan sıyrılır.`, 'Bilezik doğrultulur, tırnak yakanın üstüne gelir.'],
    ['4', 'Bilezik aşağı alınır. Üst diş hiç açılmaz.', `Conta merkezlemeye takılır, bilezik Parça 1'e ${spec.sikma.onerilen} Nm ile sıkılır.`],
  ])}
<ul>
  <li><b>Sızdırmazlık:</b> conta ${fmt(CONTA.dis)} × ${fmt(CONTA.ic)} × ${fmt(CONTA.kalinlik)} merkezleme çıkıntısına oturur. Çıkıntı Ø${fmt(spec.merkezleme.cap)} Parça 1 deliğine ${spec.merkezleme.giris} mm girer: conta içeri kaçmaz, gövde eksende kalır ve Parça 1 takılıyken bilezik yana kayamaz. Yaka kesikleri (${fmt(M.F)}) conta dış çapından (Ø${fmt(CONTA.dis)}) geniştir, conta alnı tam destekli kalır.</li>
  <li><b>Kritik pahlar:</b> yaka alt pahı ${fmt(CH_B)} × 45° ve ağız üst pahı ${fmt(CH_A)} × 45° sökme için gereklidir. Yaka üst pahı en fazla ${fmt(CH_U)} mm olmalı; bu pah büyürse tırnağın bastığı yüzey kaybolur.</li>
  <li><b>Sıkma momenti:</b> bilezik SW ${fmt(M.S)} ile ${spec.sikma.onerilen} Nm sıkılır, ${spec.sikma.azami} Nm geçilmez. Conta oturması için yaklaşık ${fmt(d.seatTorque, 0)} Nm yeterlidir. Uzun anahtarla aşırı sıkma yaka kulaklarını eğer.</li>
  <li><b>Gövde bağlama:</b> yaka tarafı ince olduğu için ikinci bağlamada Ø${fmt(M.D)} çapı yumuşak çeneyle tutulur, anahtar yüzleri son işlem olarak frezelenir.</li>
  <li><b>Bilezik iç çeltiği:</b> ØG ${fmt(M.G)} × ${fmt(COLLAR_TOP - M.C)} mm çeltik, ağız Ø${fmt(M.W)} içinden iç kanal kateriyle açılır. Radyal derinlik ${fmt((M.G - M.W) / 2, 1)} mm, erişim ${fmt(M.B - M.C)} mm. Diş bu çeltiğe serbest çıkar, ayrı kanal gerekmez.</li>
  <li><b>Ham altıgen:</b> SW ${fmt(M.S)} ${esc(spec.malzemeKisa)} altıgen çubuk bulunamazsa Ø${d.nutRound} yuvarlaktan altı yüz frezelenir.</li>
</ul>
<p><b>Malzeme:</b> parça suyla temas ettiği için ${esc(spec.malzemeKisa)} seçildi: kurşun oranı %0,2'nin altında, çinko kaybına dayanıklı (EN ISO 6509). Kurşunlu pirince göre daha zor işlenir, çapak eğilimi fazladır.</p>

<h2>Dayanım kontrolü <small>el hesabı</small></h2>
${table(['Durum', 'Gerilme', 'İzin verilen', 'Emniyet'], d.strength.map(([name, s, limit]) => [name, `${fmt(s, 1)} MPa`, `${fmt(limit, 0)} MPa`, `≈ ${fmt(limit / s, 1)} kat`]))}
<p class="note">Tasarım yükü ${fmt(d.LOAD)} kN: conta oturması ${fmt(d.seat, 1)} kN (30 MPa, Parça 1 üst alın halkası) + ${spec.testBasinci} bar test basıncı ${fmt(d.lift, 1)} kN. Akma için muhafazakâr ${d.YIELD} MPa kabul edildi; kesin değer malzeme sertifikasından alınır. En düşük emniyet yaka kulağı eğilmesindedir; hesap kulağı konsol kiriş sayar, gerçekte yayılma nedeniyle daha iyidir. Bu nedenle sıkma momenti sınırlandı ve ilk parçada test şarttır.</p>

<h2>4. Ölçüler <small>rekor-olculer.json</small></h2>
${table(['Harf', 'Değer (mm)', 'Tolerans', 'Açıklama'], Object.entries(spec.olculer).map(([k, v]) => [`<b>${letter(k)}</b>`, fmt(v.deger), T[k] ?? esc(spec.genelTolerans), esc(v.aciklama)]))}
<p class="note">Merkezleme Ø${fmt(spec.merkezleme.cap)} ${T.merkezleme}, bilezik iç çeltik yüksekliği ${fmt(COLLAR_TOP - M.C)} ${T.celtikYuksekligi}. Toleranslar sökme yolundaki ${fmt(0.4)} mm boşluğu korumak için tek yönlü verildi: anma ölçüsü en kötü durumdur.</p>

<h2>5. Ham malzeme</h2>
${table(['Parça', 'Ham', 'Kesim boyu', 'Ham ağırlık', '10 adet için'], [
    ['Gövde', `Ø${d.bodyBar} yuvarlak çubuk`, `${d.bodyBlank} mm (boy ${d.bodyLen} + alın ve kesme payı)`, `${fmt(d.bodyRaw, 2)} kg`, `≈ ${fmt((d.bodyBlank + 3) * 10 / 1000, 2)} m`],
    ['Bilezik', `SW ${fmt(M.S)} altıgen çubuk (yedek Ø${d.nutRound} yuvarlak)`, `${d.nutBlank} mm (boy ${fmt(M.B)} + alın ve kesme payı)`, `${fmt(d.nutRaw, 2)} kg`, `≈ ${fmt((d.nutBlank + 3) * 10 / 1000, 2)} m`],
    ['Conta', `Klingerit, ${fmt(CONTA.kalinlik)} mm`, `Ø${fmt(CONTA.dis)} × Ø${fmt(CONTA.ic)}, hazır kesim`, '—', '10 adet + yedek'],
  ])}
<p class="note">Çubuklar ${esc(spec.malzemeKisa)}, EN 12164 / EN 12168, EN 10204 3.1 sertifikalı.</p>

<h2>6. Operasyon planı <small>fason, prototip</small></h2>
<h3>Gövde</h3>
${table(['Op', 'Tezgah / bağlama', 'İşlem', 'Takım'], [
    ['10', 'CNC torna — 1. bağlama, yaka tarafı dışarıda', `Alın · merkezleme Ø${fmt(spec.merkezleme.cap)} × ${spec.merkezleme.giris} ${T.merkezleme} · conta alnı finiş, Ra 1,6, düz · yaka ØD ${fmt(M.D)} ${T.D} · alt pah ${fmt(CH_B)} × 45° · üst pah ${fmt(CH_U)} × 45° · delik ØE ${fmt(M.E)} (boydan) · kesme`, 'T01, T02, T03, T04, T05'],
    ['20', 'CNC torna — 2. bağlama, ters, Ø' + fmt(M.D) + ' yumuşak çene', `Boy alma · boyun çeltiği ØN ${fmt(M.N)} · dış çap · ${ust.dis} dış diş (${BSP.tpi} TPI${CONICAL ? ', 1:16 konik' : ''}, boyun çeltiğine çıkar) · pah · iç pah`, 'T01, T02, T06'],
    ['30', 'CNC freze / C eksenli torna', `Yakanın iki yanı F = ${fmt(M.F)} ${T.F}, köşeler R${fmt(M.R)} (kontur)`, 'T07'],
    ['40', 'Tezgah dışı', 'Çapak alma, yıkama, kurutma', 'Çapak alma takımı'],
  ])}
<h3>Bilezik</h3>
${table(['Op', 'Tezgah / bağlama', 'İşlem', 'Takım'], [
    ['10', 'CNC torna — 1. bağlama, üst alın dışarıda', `Alın · 30° altıgen pahı · punta + Ø30 ön delik (boydan) · ağız ØW ${fmt(M.W)} ${T.W} · üst pah ${fmt(CH_A)} × 45° · iç çeltik ØG ${fmt(M.G)} ${T.G}, yükseklik ${fmt(COLLAR_TOP - M.C)} ${T.celtikYuksekligi} · kesme`, 'T01, T02, T03, T04, T05, T08'],
    ['20', 'CNC torna — 2. bağlama, ters, altıgen yumuşak çene', `Boy alma B = ${fmt(M.B)} · 30° altıgen pahı · diş dibi deliği Ø${fmt(BSP.tapDrill)} · ${alt.dis} iç diş C = ${fmt(M.C)} (${BSP.tpi} TPI, çeltiğe serbest çıkar) · giriş pahı`, 'T01, T03, T09'],
    ['30', 'Tezgah dışı', 'Çapak alma, yıkama, kurutma', 'Çapak alma takımı'],
  ])}
<h3>Takım montajı ve test</h3>
${table(['Op', 'İşlem', 'Not'], [
    ['50', `Kontrol planı, ardından sökme denemesi: bilezik gövdeye takılır ve ${fmt(shift)} mm + ${fmt(tilt)}° ile çıkarılır`, 'Elle, zorlamadan olmalı'],
    ['60', `Parça 1 ile ${spec.testBasinci} bar sızdırmazlık testi, ${spec.sikma.onerilen} Nm sıkma`, 'İlk parça ve her adet'],
    ['70', 'Diş koruma kapakları, parça başı poşet, etiket (parça, rev, adet)', '—'],
  ])}

<h2>7. Takım listesi <small>${esc(spec.malzemeKisa)} için tahmini başlangıç değerleri</small></h2>
${table(['T', 'Takım', 'Kullanım', 'Vc (m/dk)', 'İlerleme'], [
    ['T01', 'Dış tornalama kateri 35° (VCGT tipi, keskin)', 'Kaba + finiş, conta alnı', '180–300', '0,08–0,20 mm/dev'],
    ['T02', 'Kesme kateri 3 mm', 'Kesme, boyun çeltiği', '100–180', '0,05–0,10 mm/dev'],
    ['T03', `İç tornalama bıçağı (Ø${fmt(M.E)} ve üzeri)`, 'ØE, ØW, iç pahlar', '150–220', '0,06–0,12 mm/dev'],
    ['T04', 'Punta matkabı 90°', 'Merkezleme', '60–100', '0,05–0,10 mm/dev'],
    ['T05', 'Matkap Ø30 (ağzı köreltilmiş, 0° talaş açısı)', 'Ön delik', '60–100', '0,08–0,15 mm/dev'],
    ['T06', 'Dış diş kateri 55° (Whitworth)', `${ust.dis} (${BSP.tpi} TPI, adım ${fmt(BSP.pitch, 3)})`, '80–140', 'Adım'],
    ['T07', 'Parmak freze Ø16, 3 ağız (pirinç/alüminyum)', `Yaka kesikleri, köşe R${fmt(M.R)}`, '100–180', '0,03–0,06 mm/diş'],
    ['T08', `İç kanal kateri, en az ${fmt((M.G - M.W) / 2 + 1, 1)} mm radyal, erişim ${fmt(M.B - M.C + 2)} mm`, `İç çeltik ØG ${fmt(M.G)}`, '100–160', '0,03–0,06 mm/dev'],
    ['T09', 'İç diş kateri 55° (Whitworth)', `${alt.dis} (${BSP.tpi} TPI)`, '80–140', 'Adım'],
  ])}
<p class="note">Değerler başlangıç içindir; atölye kendi takım ve tezgahına göre ayarlar. ${esc(spec.malzemeKisa)} kurşunlu pirince göre uzun talaş ve fazla çapak verebilir: ilerleme düşük tutulur, takım keskin olmalıdır.</p>

<h2>8. Kontrol planı <small>prototipte %100</small></h2>
${table(['No', 'Karakteristik', 'Kabul kriteri', 'Yöntem / ekipman', 'Kayıt'], [
    ['1', 'Malzeme', `${esc(spec.malzemeKisa)}, Pb ≤ %0,2, çinko kaybına dayanıklı (EN ISO 6509)`, 'EN 10204 3.1 sertifikası', 'Sertifika'],
    ['2', 'Gövde boyları', `L ${fmt(M.L)}, U ${fmt(M.U)}, T ${fmt(M.T)} ${T.T}`, 'Kumpas, yükseklik mihengiri', 'Ölçüm raporu'],
    ['3', 'Yaka', `ØD ${fmt(M.D)} ${T.D}, F ${fmt(M.F)} ${T.F}, köşe R${fmt(M.R)}`, 'Mikrometre, kumpas, radyüs mastarı', 'Ölçüm raporu'],
    ['4', 'Yaka pahları', `Alt ${fmt(CH_B)} × 45°, üst en fazla ${fmt(CH_U)} × 45°`, 'Profil projektörü / pah ölçer', 'Ölçüm raporu'],
    ['5', 'Merkezleme', `Ø${fmt(spec.merkezleme.cap)} ${T.merkezleme}, boy ${spec.merkezleme.giris}`, 'Mikrometre', 'Ölçüm raporu'],
    ['6', 'Delik, boyun', `ØE ${fmt(M.E)}, ØN ${fmt(M.N)}, boyun eti ${fmt(d.wall)} mm`, 'Kumpas, iç ölçer', 'Ölçüm raporu'],
    ['7', `Üst dış diş ${ust.dis}`, CONICAL ? 'ISO 7-1, konik 1:16' : 'ISO 228-1', `${ust.dis} ${CONICAL ? 'konik ' : ''}halka mastar`, 'Ölçüm raporu'],
    ['8', 'Bilezik', `SW ${fmt(M.S)}, B ${fmt(M.B)}, tırnak ${fmt(LIP)}`, 'Kumpas', 'Ölçüm raporu'],
    ['9', 'Bilezik ağzı', `ØW ${fmt(M.W)} ${T.W}, üst pah ${fmt(CH_A)} × 45°, çentik yok`, 'İç mikrometre', 'Ölçüm raporu'],
    ['10', 'İç çeltik', `ØG ${fmt(M.G)} ${T.G}, yükseklik ${fmt(COLLAR_TOP - M.C)} ${T.celtikYuksekligi}`, 'İç kanal mastarı / kumpas', 'Ölçüm raporu'],
    ['11', `İç diş ${alt.dis}`, `ISO 228-1, sınıf A (öneri), boy ${fmt(M.C)}`, 'Tampon mastar, geçer/geçmez', 'Ölçüm raporu'],
    ['12', 'Conta alnı', 'Düz, çapaksız, radyal çizik yok, Ra ≤ 1,6', 'Görsel + pürüzlülük numunesi', 'Ölçüm raporu'],
    ['13', 'Sökme denemesi', `Bilezik ${fmt(shift)} mm + ${fmt(tilt)}° ile elle takılıp çıkar`, 'Her takım', 'Kontrol listesi'],
    ['14', 'Sızdırmazlık', `Parça 1 ile ${spec.sikma.onerilen} Nm, ${spec.testBasinci} bar (1,5 × ${spec.isletmeBasinci.max} bar), 60 s, kaçak yok`, 'Hidrostatik test (su ile); basınçlı hava kullanılmaz', 'Test kaydı'],
    ['15', 'İlk parça muayenesi', 'Tüm karakteristikler', 'Ölçüm tablosu + fotoğraf', 'İlk parça raporu'],
  ])}

<h2>9. Teklif talebi <small>fason atölyeye</small></h2>
<p>Ekteki STEP modeller ve teknik resme göre ${esc(spec.parca)} (Rev ${spec.rev}) takımı için fiyat rica ediyoruz.</p>
${table(['Kalem', 'İstek'], [
    ['Adet', '1, 5 ve 10 takım için ayrı birim fiyat (gövde + bilezik)'],
    ['Malzeme', `${esc(spec.malzeme)}, EN 10204 3.1 sertifikalı · Ø${d.bodyBar} yuvarlak ve SW ${fmt(M.S)} altıgen temin edilebiliyor mu belirtin`],
    ['Çalışma koşulu', `${esc(spec.calismaKosulu)}, işletme ${spec.isletmeBasinci.min}–${spec.isletmeBasinci.max} bar; azami sıcaklık teyit edilecek`],
    ['Kalite', `${esc(spec.genelTolerans)} · 4. bölümdeki kritik toleranslar · diş mastar kontrolü (${ust.dis} halka, ${alt.dis} tampon) · ilk parça ölçüm raporu`],
    ['Teslim', 'Çapaksız ve temiz; diş koruma kapaklı, parça başı poşet, etiketli'],
    ['Teklifte görmek istediklerimiz', 'Birim fiyat, kurulum / programlama bedeli, malzeme, mastar bedeli, termin, teklif geçerlilik süresi, ödeme koşulu'],
    ['Not', `Ölçüler onaylıdır (Rev ${spec.rev}). Yaka ve ağız pahları sökme için kritiktir, değiştirilmeden uygulanmalıdır; işlenemeyen bir nokta varsa teklif öncesi bildirin.`],
  ])}

<footer>${esc(spec.parca)} · Rev ${spec.rev} · ${spec.tarih} · Bu sayfa ve ekleri <code>rekor-olculer.json</code> dosyasından üretildi.</footer>
</main>
</body>
</html>
`;
}

// ---------------- çalıştır ----------------
await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) {
  if (/^oynar-rekor-rev.*\.(step|dxf|pdf|zip)$/.test(f)) await rm(path.join(OUT, f));
}

const info = await buildStep();
for (const k of ['govde', 'bilezik']) {
  const { volume, bounds, faces } = info[k];
  console.log(`STEP  ${FILES[k]}  hacim ${fmt(volume / 1000, 1)} cm³, ${faces} yüz, sınırlar ${JSON.stringify(bounds.map((b) => b.map((v) => Math.round(v * 100) / 100)))}`);
}
await buildDxf();
console.log(`DXF   ${FILES.dxf}`);

const planPath = path.join(OUT, 'index.html');
await writeFile(planPath, planHtml(info));
if (await printDrawing(DRAWING, path.join(OUT, FILES.drawingPdf))) console.log(`PDF   ${FILES.drawingPdf}`);
if (await printPdf(pathToFileURL(planPath).href, path.join(OUT, FILES.planPdf))) console.log(`PDF   ${FILES.planPdf}`);

const packed = Object.values(FILES).filter((f) => f !== FILES.zip && existsSync(path.join(OUT, f)));
execFileSync(TAR, ['-a', '-c', '-f', path.join(OUT, FILES.zip), '-C', OUT, ...packed, '-C', ROOT, 'rekor-olculer.json']);
console.log(`ZIP   ${FILES.zip}`);

await writeFile(planPath, planHtml(info, await fileSizes(OUT, Object.values(FILES))));
console.log('HTML  uretim/rekor/index.html');
