// tipay bileklik tokası (PA12): toka-olculer.json → STEP, görüntüleyici ağı, kontrol raporu
// Kullanım: cd tools && node toka.mjs && node toka-resim.mjs && node onbellek.mjs
// CAD ekseni: X bant boyunca, Y bant eni yönünde, Z dışa (ön yüz +Z). Z = 0 kanalın bilek tarafı yüzü.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setOC, drawRoundedRectangle, makeBaseBox, exportSTEP, measureVolume, importSTEP } from 'replicad';
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
const Z0 = -M.Ar;                          // arka (bilek) yüz
const Z1 = M.Kh + M.On;                    // ön yüz

assert(M.Kw > M.Wb, 'Kanal bant eninden geniş olmalı');
assert(M.Kh >= 2 * M.Tb, 'Kanal dikişteki iki kat bandı almalı');
assert(C.derinlik < M.On - 0.5, 'Cep tabanında en az 0,5 mm duvar kalmalı');
assert(C.en <= H - 2 * 1.2 && C.boy <= M.L - 2 * 1.5, 'Cep çevresinde duvar kalmalı');
assert(M.Kw - 2 * M.De > 6, 'Arka açıklık bandın kayması için yeterli olmalı');

// Dış gövde: önden yuvarlatılmış dikdörtgen, ön ve arka kenarlar yuvarlatılır
let toka = drawRoundedRectangle(M.L, H, M.Rk).sketchOnPlane('XY', Z0).extrude(Z1 - Z0);
toka = toka.fillet(M.Rf, (e) => e.inPlane('XY', Z1));
toka = toka.fillet(0.5, (e) => e.inPlane('XY', Z0));

// Bant kanalı (X boyunca boydan boya) ve arka açıklık (iki dudak arası)
toka = toka.cut(makeBaseBox(M.L + 4, M.Kw, M.Kh).translate([0, 0, 0]));
toka = toka.cut(makeBaseBox(M.L + 4, M.Kw - 2 * M.De, M.Ar + 2).translate([0, 0, Z0 - 1]));

// Ön yüz cebi: baskılı plaka + NFC inlay
const cep = drawRoundedRectangle(C.boy, C.en, C.koseR).sketchOnPlane('XY', Z1 - C.derinlik).extrude(C.derinlik + 1);
toka = toka.cut(cep).simplify();

// ---------------- kontroller ----------------
const volume = (s) => (s.solids?.length ? Math.abs(measureVolume(s)) : 0);
assert.equal(toka.solids.length, 1, 'Toka tek katı olmalı');
const brep = new oc.BRepCheck_Analyzer(toka.wrapped, true, false, true);
const brepValid = brep.IsValid();
brep.delete();
assert(brepValid, 'OpenCascade geometri / topoloji doğrulaması başarısız');
const [lo, hi] = toka.boundingBox.bounds;
assert(Math.abs(hi[0] - lo[0] - M.L) < 1e-4, 'Boy uyuşmuyor');
assert(Math.abs(hi[1] - lo[1] - H) < 1e-4, 'Yükseklik uyuşmuyor');
assert(Math.abs(hi[2] - lo[2] - (Z1 - Z0)) < 1e-4, 'Kalınlık uyuşmuyor');

const step = exportSTEP([{ shape: toka, name: `${spec.kod} Rev ${spec.rev} - NUMUNE ADAYI`, color: '#202226' }], { unit: 'MM', modelUnit: 'MM' });
await mkdir(OUT, { recursive: true });
const stepAdi = `${spec.kod}-rev${spec.rev}.step`;
const stepBytes = Buffer.from(await step.arrayBuffer());
await writeFile(path.join(OUT, stepAdi), stepBytes);
const geri = await importSTEP(new Blob([stepBytes]));
assert.equal(geri.solids.length, 1, 'STEP dönüşünde birden çok katı');
const geriKontrol = new oc.BRepCheck_Analyzer(geri.wrapped, true, false, true);
const stepValid = geriKontrol.IsValid();
geriKontrol.delete();
assert(stepValid, 'STEP dönüş geometrisi geçersiz');
const hacim = volume(toka);
assert(Math.abs(volume(geri) - hacim) < 0.01, 'STEP hacmi uyuşmuyor');

const ag = { tolerance: 0.02, angularTolerance: 0.1 };
await writeFile(path.join(OUT, 'toka-mesh.json'), JSON.stringify({ mesh: toka.mesh(ag), edges: toka.meshEdges(ag) }));

const rapor = {
  parca: spec.parca, rev: spec.rev, tarih: spec.tarih, durum: 'NUMUNE ADAYI - ÜRETİM ONAYI DEĞİL',
  birim: 'mm', kati: toka.solids.length, sinirlar: toka.boundingBox.bounds,
  hacimMm3: yuvarla(hacim), tahminiKutleGram: Math.round(hacim * 0.00101 * 100) / 100,
  dis: { boy: M.L, yukseklik: H, kalinlik: Z1 - Z0 },
  kanal: { en: M.Kw, yukseklik: M.Kh, arkaAciklik: yuvarla(M.Kw - 2 * M.De) },
  cepTabanDuvari: yuvarla(M.On - C.derinlik),
  kontroller: { brepGecerli: brepValid, stepGecerli: stepValid, stepHacimFarkiMm3: Math.abs(volume(geri) - hacim) },
  notlar: [
    'PA12 yoğunluğu 1,01 g/cm³ alındı.',
    'Kanal iç ölçüsü gerçek bantla numunede denenir; dikiş kalınlığı ölçülmedi.',
    'Fiziksel ter / sürtünme / bükülme testi yapılmadı.',
  ],
};
await writeFile(path.join(OUT, 'kontrol-raporu.json'), JSON.stringify(rapor, null, 2) + '\n');
await writeFile(path.join(OUT, 'toka-olculer.json'), JSON.stringify(spec, null, 2) + '\n');
console.log(`STEP  ${stepAdi} · hacim ${hacim.toFixed(1)} mm³ · ≈ ${(hacim * 0.00101).toFixed(2)} g · ${M.L} × ${H} × ${(Z1 - Z0).toFixed(1)} mm`);
