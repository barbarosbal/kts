// tipay bileklik tokası (PA12): toka-olculer.json → STEP, görüntüleyici ağı, kontrol raporu
// Kullanım: cd tools && node toka.mjs && node toka-resim.mjs && node onbellek.mjs
// CAD ekseni: X bant boyunca, Y bant eni yönünde, Z dışa (ön yüz +Z).
// Kavis merkezi (0, 0, -Rb): bilek yüzünün tepesi Z = 0; kanal Ar..Ar+Kh, ön yüz Ar+Kh+On (tepede).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setOC, draw, drawRoundedRectangle, exportSTEP, measureVolume, importSTEP } from 'replicad';
import opencascade from 'replicad-opencascadejs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'uretim', 'toka');
const require = createRequire(import.meta.url);
const oc = await opencascade({ locateFile: () => require.resolve('replicad-opencascadejs/wasm') });
setOC(oc);

const spec = JSON.parse(await readFile(path.join(ROOT, 'toka-olculer.json'), 'utf8'));
const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));
const C = spec.cep;
const yuvarla = (n) => Math.round(n * 1000) / 1000;
const H = yuvarla(M.Kw + 2 * M.Yn);        // önden görünüş yüksekliği
const RB = M.Rb;                           // bilek yüzü
const RK0 = RB + M.Ar;                     // kanal alt yüzü
const RK1 = RK0 + M.Kh;                    // kanal üst yüzü
const RF = RK1 + M.On;                     // ön yüz
const TOP = RF - RB;

assert(M.Kw > M.Wb, 'Kanal bant eninden geniş olmalı');
assert(M.Kh >= 2 * M.Tb, 'Kanal dikişteki iki kat bandı almalı');
assert(C.derinlik <= M.On - 0.8, 'Cep tabanında en az 0,8 mm duvar kalmalı');
assert(C.en <= H - 2 * 1.2 && C.boy <= M.L - 2 * 1.5, 'Cep çevresinde duvar kalmalı');

// Kavis merkezli halka dilimi (XZ düzleminde), Y boyunca h kadar, Y'de ortalı
const P = (r, t) => [r * Math.sin(t), -RB + r * Math.cos(t)];
function dilim(r0, r1, a, h) {
  const sk = draw(P(r0, -a)).lineTo(P(r1, -a)).threePointsArcTo(P(r1, a), P(r1, 0))
    .lineTo(P(r0, a)).threePointsArcTo(P(r0, -a), P(r0, 0)).close();
  const s = sk.sketchOnPlane('XZ').extrude(h);
  const [lo, hi] = s.boundingBox.bounds;
  return s.translate([0, -(lo[1] + hi[1]) / 2, 0]);
}
const prizma = (l, w, r) => drawRoundedRectangle(l, w, r).sketchOnPlane('XY', -RB).extrude(2 * RB);

// Dış gövde: kavisli dilim ∩ önden yuvarlatılmış dikdörtgen prizma; uçlar düşey
const A = Math.asin((M.L / 2 + 3) / RB);
let toka = dilim(RB, RF, A, H).intersect(prizma(M.L, H, M.Rk));
let fileto = 'yok';
if (!process.env.TOKA_FILETOSUZ) try {
  toka = toka.fillet(M.Rf, (e) => e.not((f) => f.inDirection('Z')));
  fileto = `R${M.Rf}`;
} catch (err) {
  console.warn('Kenar yuvarlatması uygulanamadı:', err.message);
}

// Kapalı bant kanalı: kavisi izler, iki uçtan açık
toka = toka.cut(dilim(RK0, RK1, A + 0.05, M.Kw));

// Ön yüz cebi: sabit derinlik, ön yüz kavsini izler
const cep = dilim(RF - C.derinlik, RF + 3, A, C.en + 4).intersect(prizma(C.boy, C.en, C.koseR));
toka = toka.cut(cep).simplify();

// ---------------- kontroller ----------------
const volume = (s) => (s.solids?.length ? Math.abs(measureVolume(s)) : 0);
assert.equal(toka.solids.length, 1, 'Toka tek katı olmalı');
const brep = new oc.BRepCheck_Analyzer(toka.wrapped, true, false, true);
const brepValid = brep.IsValid();
brep.delete();
assert(brepValid, 'OpenCascade geometri / topoloji doğrulaması başarısız');
const [lo, hi] = toka.boundingBox.bounds;
assert(Math.abs(hi[0] - lo[0] - M.L) < 1e-3, 'Boy uyuşmuyor');
assert(Math.abs(hi[1] - lo[1] - H) < 1e-3, 'Yükseklik uyuşmuyor');
assert(Math.abs(hi[2] - TOP) < 1e-3, 'Ön yüz tepesi uyuşmuyor');
const sehim = yuvarla(-lo[2]);              // uçların bilek yüzü tepesinden düşüşü

const step = exportSTEP([{ shape: toka, name: `${spec.kod} Rev ${spec.rev} - NUMUNE ADAYI`, color: '#202226' }], { unit: 'MM', modelUnit: 'MM' });
await mkdir(OUT, { recursive: true });
const stepAdi = `${spec.kod}-rev${spec.rev}.step`;
const stepBytes = Buffer.from(await step.arrayBuffer());
await writeFile(path.join(OUT, stepAdi), stepBytes);
const geri = await importSTEP(new Blob([stepBytes]));
assert.equal(geri.solids.length, 1, 'STEP dönüşünde birden çok katı');
// Kavisli yüzlerin kesişim eğrileri STEP'e yaklaşık yazılır: standart BRep kontrolü zorunlu,
// kesin (exact) kontrol sonucu yalnız rapora yazılır.
const kontrol = (s, kesin) => {
  const c = new oc.BRepCheck_Analyzer(s.wrapped, true, false, kesin);
  const v = c.IsValid();
  c.delete();
  return v;
};
const stepValid = kontrol(geri, false);
const stepKesin = kontrol(geri, true);
assert(stepValid, 'STEP dönüş geometrisi geçersiz');
const hacim = volume(toka);
assert(Math.abs(volume(geri) - hacim) < 0.01, 'STEP hacmi uyuşmuyor');

const ag = { tolerance: 0.02, angularTolerance: 0.1 };
await writeFile(path.join(OUT, 'toka-mesh.json'), JSON.stringify({ mesh: toka.mesh(ag), edges: toka.meshEdges(ag) }));

const rapor = {
  parca: spec.parca, rev: spec.rev, tarih: spec.tarih, durum: 'NUMUNE ADAYI - ÜRETİM ONAYI DEĞİL',
  birim: 'mm', kati: toka.solids.length, sinirlar: toka.boundingBox.bounds.map((v) => v.map(yuvarla)),
  hacimMm3: yuvarla(hacim), tahminiKutleGram: Math.round(hacim * 0.00101 * 100) / 100,
  dis: { boy: M.L, yukseklik: H, kalinlik: yuvarla(TOP), bilekYaricapi: RB, ucSehimi: sehim },
  kanal: { en: M.Kw, yukseklik: M.Kh, arka: 'kapalı', arkaDuvar: M.Ar },
  cepTabanDuvari: yuvarla(M.On - C.derinlik),
  kenarYuvarlatmasi: fileto,
  kontroller: { brepGecerliKesin: brepValid, stepGecerliStandart: stepValid, stepGecerliKesin: stepKesin, stepHacimFarkiMm3: Math.abs(volume(geri) - hacim) },
  notlar: [
    'PA12 yoğunluğu 1,01 g/cm³ alındı.',
    'Kapalı kanal iki uçtan açık: 3D baskı tozu temizlenebilir.',
    'Kanal iç ölçüsü gerçek bantla numunede denenir; dikiş kalınlığı ölçülmedi.',
    'Fiziksel ter / sürtünme / bilekte kullanım testi yapılmadı.',
  ],
};
await writeFile(path.join(OUT, 'kontrol-raporu.json'), JSON.stringify(rapor, null, 2) + '\n');
await writeFile(path.join(OUT, 'toka-olculer.json'), JSON.stringify(spec, null, 2) + '\n');
console.log(`STEP  ${stepAdi} · hacim ${hacim.toFixed(1)} mm³ · ≈ ${(hacim * 0.00101).toFixed(2)} g · ${M.L} × ${H} × ${TOP.toFixed(1)} mm · R${RB} · uç sehimi ${sehim} · fileto ${fileto}`);
