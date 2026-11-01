// olculer.json → STEP, DXF, teknik resim (SVG + PDF), üretim planı (HTML + PDF) ve paket ZIP.
// Kullanım: cd tools && npm install && npm run build
import { readFile, writeFile, readdir, rm, stat, mkdir } from 'node:fs/promises';
import { existsSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'uretim');
const DRAWING = path.join(ROOT, 'kazan-alti-parcasi-taslak.svg');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TAR = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'bsdtar';

const spec = JSON.parse(await readFile(path.join(ROOT, 'olculer.json'), 'utf8'));
const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));
const BASE = `kazan-alti-parcasi-rev${spec.rev}`;
const FILES = {
  step: `${BASE}.step`,
  dxf: `${BASE}.dxf`,
  drawingPdf: `${BASE}-teknik-resim.pdf`,
  planPdf: `${BASE}-uretim-plani.pdf`,
  zip: `${BASE}-uretim-paketi.zip`,
};

const fmt = (n, digits = 2) => n.toLocaleString('tr-TR', { maximumFractionDigits: digits });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------- geometri ----------------
// BSP (ISO 228-1); tapDrill: diş dibi matkabı
const BSP = {
  '1 1/2': { major: 47.803, minor: 44.845, tpi: 11, tapDrill: 45.25, gauge: 12.7 },
  '3/4': { major: 26.441, minor: 24.117, tpi: 14, tapDrill: 24.25 },
  '1/2': { major: 20.955, minor: 18.631, tpi: 14, tapDrill: 18.75 },
};
const sizeOf = (dis) => dis.replace(/^[GR]\s*/, '');
const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

const R = M.D / 2;
const RB = M.E / 2;
const H = M.H;
const Z_TT = H - M.L1;                        // üst diş başlangıcı
const LEVEL = { 1: H - M.H1, 2: H - M.H2 };   // seviyeler üst alından ölçülür
const TOP = BSP[sizeOf(spec.uclar.ust.dis)];
const BOT = BSP[sizeOf(spec.uclar.alt.dis)];
const BOT_CONICAL = /^R/.test(spec.uclar.alt.dis);
const WALL = spec.et ?? (M.D - M.E) / 2;
const CH = 0.5;                               // delik giriş pahı

// Üstten görünüm (CAD, Z yukarı): 0° = +Y (P1), 90° = -X
const PORTS = spec.portlar.map((p) => {
  const a = (p.aci * Math.PI) / 180;
  const size = sizeOf(p.dis);
  return { ...p, size, t: BSP[size], r: p.bossCap / 2, face: M[p.alin], z: LEVEL[p.seviye], dir: [clean(-Math.sin(a)), clean(Math.cos(a))] };
});
const MAX_FACE = Math.max(R, ...PORTS.map((p) => p.face));

// Dış kontur [yarıçap, z], alt uçtan üst uca. Dişler gövde çapına yakın olduğundan omuz ve kanal yok;
// diş çıkışı serbest, serbest uçlarda diş dibine 45° pah. R alt uç 1:16 koniktir: nominal çap
// serbest uçtan gauge kadar içeride, koni gövde çapına ulaşınca düz devam eder.
function profile() {
  const rcB = BOT.minor / 2 - 0.3;
  const rMB = BOT.major / 2;
  const rcT = TOP.minor / 2 - 0.3;
  const rMT = TOP.major / 2;
  const top = [[R, Z_TT], [rMT, Z_TT], [rMT, H - (rMT - rcT)], [rcT, H]];
  if (!BOT_CONICAL) return [[rcB, 0], [rMB, rMB - rcB], [rMB, M.L2], [R, M.L2], ...top];
  const rEnd = rMB - BOT.gauge / 32;                  // serbest uçta dış yarıçap
  const zCh = (rEnd - rcB) / (1 - 1 / 32);            // 45° pah ile koninin kesişimi
  return [[rcB, 0], [rcB + zCh, zCh], [R, (R - rEnd) * 32], ...top];
}

function checks() {
  const w = [];
  for (const p of PORTS) {
    if (p.z + p.r > Z_TT) w.push(`${p.id} boss'u üst diş bölgesine taşıyor`);
    if (p.z - p.r < M.L2) w.push(`${p.id} boss'u alt diş bölgesine taşıyor`);
    if (p.face < R) w.push(`${p.id} alnı gövdenin içinde kalıyor (alın < ØD/2)`);
    if (p.face - p.disDerinligi < RB) w.push(`${p.id} diş derinliği ØE deliğine taşıyor`);
    if (p.r >= R) w.push(`${p.id} boss'u gövde çapından geniş`);
  }
  for (const [i, a] of PORTS.entries()) {
    for (const b of PORTS.slice(i + 1)) {
      const sameDir = a.dir[0] === b.dir[0] && a.dir[1] === b.dir[1];
      if (sameDir && Math.abs(a.z - b.z) < a.r + b.r) w.push(`${a.id} ve ${b.id} boss'ları çakışıyor`);
    }
  }
  if (Math.abs((M.D - M.E) / 2 - WALL) > 0.01) w.push(`Et kalınlığı ${WALL} mm ile ØD/ØE uyuşmuyor`);
  if (Math.max(TOP.major, BOT.major) > M.D + 0.01) w.push('Diş çapı gövde çapından büyük');
  if ((Math.min(TOP.minor, BOT.minor) - M.E) / 2 < 1.5) w.push('Diş dibinde et 1,5 mm\'nin altına iniyor');
  return w;
}

// ---------------- STEP ----------------
async function buildStep() {
  const { setOC, draw, makeCylinder, exportSTEP, measureVolume } = await import('replicad');
  const { default: opencascade } = await import('replicad-opencascadejs');
  const wasm = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm');
  setOC(await opencascade({ locateFile: () => wasm }));

  const revolve = (pts) => pts.slice(1).reduce((pen, p) => pen.lineTo(p), draw(pts[0])).close().sketchOnPlane('XZ').revolve();
  let part = revolve([[0, 0], ...profile(), [0, H]]);

  // Boss, en geniş yeri gövde yüzeyine değdiği yerden başlar (tabanı dolu gövdenin içinde kalır)
  for (const p of PORTS) {
    const [dx, dy] = p.dir;
    const start = Math.sqrt(R * R - p.r * p.r) - 0.5;
    part = part.fuse(makeCylinder(p.r, p.face - start, [dx * start, dy * start, p.z], [dx, dy, 0]));
  }
  // Boydan boya delik, iki uçta 45° giriş pahıyla
  part = part.cut(revolve([[0, -1], [RB + CH + 1, -1], [RB, CH], [RB, H - CH], [RB + CH + 1, H + 1], [0, H + 1]]));
  // Diş dibi delikleri alından ØE deliğine kadar
  for (const p of PORTS) {
    const [dx, dy] = p.dir;
    const from = p.face + 1;
    part = part.cut(makeCylinder(p.t.tapDrill / 2, from, [dx * from, dy * from, p.z], [-dx, -dy, 0]));
  }

  const blob = exportSTEP([{ shape: part, name: `Kazan Alti Parcasi Rev ${spec.rev}`, color: '#d8b868' }], { unit: 'MM', modelUnit: 'MM' });
  await writeFile(path.join(OUT, FILES.step), Buffer.from(await blob.arrayBuffer()));
  return { volume: measureVolume(part), bounds: part.boundingBox.bounds };
}

// ---------------- DXF (R12) ----------------
class Dxf {
  #ents = [];

  static ascii(s) {
    const tr = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' };
    return s.replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => tr[c]).replace(/[^\x20-\x7e]/g, '');
  }

  #add(type, layer, codes) { this.#ents.push([0, type, 8, layer, ...codes]); }
  line(layer, [x1, y1], [x2, y2]) { this.#add('LINE', layer, [10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0]); }
  path(layer, pts) { for (let i = 1; i < pts.length; i++) this.line(layer, pts[i - 1], pts[i]); }
  circle(layer, [x, y], r) { this.#add('CIRCLE', layer, [10, x, 20, y, 30, 0, 40, r]); }
  arc(layer, [x, y], r, a0, a1) { this.#add('ARC', layer, [10, x, 20, y, 30, 0, 40, r, 50, a0, 51, a1]); }
  text(layer, [x, y], h, s) { this.#add('TEXT', layer, [10, x, 20, y, 30, 0, 40, h, 1, Dxf.ascii(s)]); }

  toString() {
    const ltypes = [['CONTINUOUS', 'Solid line', []], ['DASHED', '__ __ __', [6, -3]], ['CENTER', '____ _ ____', [20, -4, 2, -4]]];
    const layers = [['KONTUR', 7, 'CONTINUOUS'], ['DIS', 7, 'CONTINUOUS'], ['GIZLI', 8, 'DASHED'], ['EKSEN', 1, 'CENTER'], ['YAZI', 3, 'CONTINUOUS']];
    const out = [
      0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$LTSCALE', 40, 1, 0, 'ENDSEC',
      0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LTYPE', 70, ltypes.length,
      ...ltypes.flatMap(([n, d, pat]) => [0, 'LTYPE', 2, n, 70, 0, 3, d, 72, 65, 73, pat.length,
        40, pat.reduce((s, v) => s + Math.abs(v), 0), ...pat.flatMap((v) => [49, v])]),
      0, 'ENDTAB', 0, 'TABLE', 2, 'LAYER', 70, layers.length,
      ...layers.flatMap(([n, c, lt]) => [0, 'LAYER', 2, n, 70, 0, 62, c, 6, lt]),
      0, 'ENDTAB', 0, 'ENDSEC',
      0, 'SECTION', 2, 'ENTITIES', ...this.#ents.flat(), 0, 'ENDSEC', 0, 'EOF',
    ];
    const lines = [];
    for (let i = 0; i < out.length; i += 2) {
      const v = out[i + 1];
      lines.push(String(out[i]), typeof v === 'number' ? String(Number(v.toFixed(4))) : v);
    }
    return lines.join('\r\n') + '\r\n';
  }
}

function buildDxf() {
  const d = new Dxf();
  const outer = profile();
  const bodyAt = outer.findIndex(([r]) => r === R);   // gövde çapının başladığı nokta
  const [zBodyLo, zBodyHi] = [outer[bodyAt][1], Z_TT];

  // ---- Ön görünüş (boş taraftan, -Y yönünden bakış): x = X, y = Z ----
  for (const side of [1, -1]) {
    const gaps = PORTS.filter((p) => p.dir[0] === side).map((p) => [p.z - p.r, p.z + p.r]).sort((a, b) => a[0] - b[0]);
    const pre = outer.slice(0, bodyAt + 1);   // alt uçtan gövde başına
    const post = outer.slice(bodyAt + 1);     // gövde sonundan üst uca
    d.path('KONTUR', pre.map(([r, z]) => [side * r, z]));
    d.path('KONTUR', post.map(([r, z]) => [side * r, z]));
    let z0 = zBodyLo;
    for (const [lo, hi] of gaps) {
      d.line('KONTUR', [side * R, z0], [side * R, lo]);
      z0 = hi;
    }
    d.line('KONTUR', [side * R, z0], [side * R, zBodyHi]);
  }
  d.line('KONTUR', [-outer[0][0], 0], [outer[0][0], 0]);
  d.line('KONTUR', [-outer.at(-1)[0], H], [outer.at(-1)[0], H]);
  // Çap değişimlerindeki daire kenarları
  const edgeZ = new Map();
  for (const [r, z] of outer) if (z > 0 && z < H) edgeZ.set(z, Math.max(edgeZ.get(z) ?? 0, r));
  for (const [z, r] of edgeZ) d.line('KONTUR', [-r, z], [r, z]);
  // Diş dibi çizgileri (ince)
  const rootAt = (t, z, conical) => t.minor / 2 + (conical ? (z - t.gauge) / 32 : 0);
  const threadRuns = [[BOT, outer[1][1], M.L2, BOT_CONICAL], [TOP, Z_TT, outer.at(-2)[1], false]];
  for (const [t, z0, z1, conical] of threadRuns) {
    for (const s of [1, -1]) d.line('DIS', [s * rootAt(t, z0, conical), z0], [s * rootAt(t, z1, conical), z1]);
  }
  // Diş sınırı çizgileri
  for (const z of [M.L2, Z_TT]) d.line('KONTUR', [-R, z], [R, z]);
  // Delik (gizli) ve eksen
  for (const s of [1, -1]) d.line('GIZLI', [s * RB, CH], [s * RB, H - CH]);
  d.line('EKSEN', [0, -6], [0, H + 6]);

  for (const p of PORTS) {
    const [sx, sy] = p.dir;
    if (sx !== 0) {
      // yandan görünen port: boss + gövdeyle kesişim eğrisi
      const curve = [];
      for (let i = 0; i <= 16; i++) {
        const y = (p.r * i) / 16;
        curve.push([sx * Math.sqrt(R * R - y * y), p.z + Math.sqrt(Math.max(0, p.r * p.r - y * y))]);
      }
      d.path('KONTUR', curve);
      d.path('KONTUR', curve.map(([x, z]) => [x, 2 * p.z - z]));
      d.path('KONTUR', [[sx * R, p.z + p.r], [sx * p.face, p.z + p.r], [sx * p.face, p.z - p.r], [sx * R, p.z - p.r]]);
      for (const s of [1, -1]) d.line('GIZLI', [sx * p.face, p.z + (s * p.t.tapDrill) / 2], [sx * RB, p.z + (s * p.t.tapDrill) / 2]);
      d.line('EKSEN', [sx * (p.face + 5), p.z], [0, p.z]);
    } else {
      // önden/arkadan görünen port
      const layer = sy < 0 ? 'KONTUR' : 'GIZLI';
      d.circle(layer, [0, p.z], p.r);
      d.circle(layer, [0, p.z], p.t.tapDrill / 2);
      d.line('EKSEN', [-p.r - 4, p.z], [p.r + 4, p.z]);
    }
  }
  d.text('YAZI', [-MAX_FACE, -14], 3.5, 'ON GORUNUS (bos taraftan bakis)');
  d.text('YAZI', [TOP.major / 2 + 4, H - 8], 2.5, `${spec.uclar.ust.dis} dis dis - ${spec.uclar.ust.sizdirmazlik}`);
  d.text('YAZI', [BOT.major / 2 + 4, 6], 2.5, `${spec.uclar.alt.dis} dis dis - ${spec.uclar.alt.sizdirmazlik}`);
  for (const p of PORTS.filter((q) => q.dir[0] !== 0)) {
    d.text('YAZI', [p.dir[0] * (p.face + 4) - (p.dir[0] < 0 ? 22 : 0), p.z + p.r + 2], 2.5, `${p.id} ${p.dis}`);
  }

  // ---- Üst görünüş: x = X, y = Y, merkez (cx, cy) ----
  const cx = 2 * MAX_FACE + 40;
  const cy = H / 2;
  const c = (x, y) => [cx + x, cy + y];
  d.circle('KONTUR', c(0, 0), R);
  d.circle('KONTUR', c(0, 0), TOP.major / 2);
  d.circle('KONTUR', c(0, 0), TOP.minor / 2 - 0.3);
  d.arc('DIS', c(0, 0), TOP.minor / 2, 0, 270);
  d.circle('KONTUR', c(0, 0), RB);
  d.circle('KONTUR', c(0, 0), RB + CH);
  const drawn = new Set();
  for (const p of PORTS) {
    const key = `${p.dir}|${p.r}|${p.face}`;
    const [dx, dy] = p.dir;
    const [px, py] = [-dy, dx];
    const at = (s, o) => c(dx * s + px * o, dy * s + py * o);
    if (!drawn.has(key)) {
      drawn.add(key);
      const s0 = Math.sqrt(R * R - p.r * p.r);
      d.path('KONTUR', [at(s0, p.r), at(p.face, p.r), at(p.face, -p.r), at(s0, -p.r)]);
      for (const o of [1, -1]) d.line('GIZLI', at(p.face, (o * p.t.tapDrill) / 2), at(RB, (o * p.t.tapDrill) / 2));
    }
    const stacked = PORTS.filter((q) => `${q.dir}|${q.r}|${q.face}` === key).map((q) => q.id).join('/');
    if (stacked.startsWith(p.id)) {
      const [tx, ty] = at(p.face + 4, 0);
      d.text('YAZI', [dx < 0 ? tx - 24 : tx + 2, ty + 3], 2.5, `${stacked} ${p.dis}`);
    }
  }
  d.line('EKSEN', c(-MAX_FACE - 8, 0), c(MAX_FACE + 8, 0));
  d.line('EKSEN', c(0, -MAX_FACE - 8), c(0, MAX_FACE + 8));
  d.text('YAZI', c(-MAX_FACE, -MAX_FACE - 14), 3.5, 'UST GORUNUS');

  // ---- antet ----
  const dims = Object.entries(M).map(([k, v]) => `${k}=${fmt(v).replace(',', '.')}`).join('  ');
  d.text('YAZI', [-MAX_FACE, -26], 3.5, `KAZAN ALTI PARCASI - Rev ${spec.rev} - ${spec.tarih} - Olcek 1:1 - mm - ${spec.malzeme.split(' ')[0]}`);
  d.text('YAZI', [-MAX_FACE, -32], 2.5, dims);
  d.text('YAZI', [-MAX_FACE, -37], 2.5, spec.onayli ? 'Olculer onaylidir.' : 'Olculer on degerdir, teyit edilecek. Geometri icin STEP modeli esastir.');
  return writeFile(path.join(OUT, FILES.dxf), d.toString(), 'latin1');
}

// ---------------- teknik resim (SVG) ----------------
const SHORT = { D: 'Gövde dış çapı', E: 'Delik çapı', A: 'Eksen–P1 alın', B: 'Eksen–P2/P3 alın', H: 'Toplam boy', H1: 'Üst alın–seviye 1', H2: 'Üst alın–seviye 2', L1: 'Üst diş boyu', L2: 'Alt diş boyu' };
const letter = (k) => (k === 'D' || k === 'E' ? `Ø${k}` : k);

function olcuTablosu() {
  const x = 36;
  const top = 54;
  const rowH = 20;
  const [w0, w1, w2] = [34, 55, 121];
  const rows = Object.entries(spec.olculer);
  const q = spec.onayli ? '' : ' q';
  const bottom = top + rowH * (rows.length + 1);
  const s = [
    `  <g>`,
    `    <text class="tb" x="${x}" y="${top - 8}">ÖLÇÜ TABLOSU (mm)</text>`,
    `    <rect x="${x}" y="${top}" width="${w0 + w1 + w2}" height="${rowH}" fill="#eee"/>`,
    `    <rect class="grid" x="${x}" y="${top}" width="${w0 + w1 + w2}" height="${bottom - top}"/>`,
    `    <path class="grid" d="${rows.map((_, i) => `M${x} ${top + rowH * (i + 1)} H${x + w0 + w1 + w2}`).join(' ')} M${x + w0} ${top} V${bottom} M${x + w0 + w1} ${top} V${bottom}"/>`,
    `    <text class="ttb" x="${x + 6}" y="${top + 14}">Harf</text><text class="ttb" x="${x + w0 + 6}" y="${top + 14}">Değer</text><text class="ttb" x="${x + w0 + w1 + 6}" y="${top + 14}">Açıklama</text>`,
  ];
  rows.forEach(([k, v], i) => {
    const y = top + rowH * (i + 1) + 14;
    s.push(`    <text class="ttb" x="${x + 6}" y="${y}">${letter(k)}</text><text class="tt${q}" x="${x + w0 + 6}" y="${y}">${fmt(v.deger)}</text><text class="tt" x="${x + w0 + w1 + 6}" y="${y}">${esc(SHORT[k] ?? v.aciklama)}</text>`);
  });
  if (!spec.onayli) s.push(`    <text class="ts q" x="${x}" y="${bottom + 16}">Turuncu: ön değer, teyit edilecek.</text>`);
  s.push('  </g>');
  return s.join('\n');
}

async function buildDrawing() {
  const template = await readFile(path.join(ROOT, 'tools', 'cizim-sablon.svg'), 'utf8');
  const vals = {
    q: spec.onayli ? '' : ' class="q"',
    qc: spec.onayli ? '' : ' q',
    rev: spec.rev,
    revDurum: spec.onayli ? 'Onaylı' : 'Taslak',
    tarih: spec.tarih,
    durumKisa: spec.onayli ? 'Üretime hazır' : 'Teklif aşaması',
    revNot: esc(spec.revNot ?? ''),
    malzeme: esc(spec.malzeme),
    malzemeKisa: esc(spec.malzemeKisa),
    ustDis: spec.uclar.ust.dis,
    altDis: spec.uclar.alt.dis,
    genelTolerans: esc(spec.genelTolerans),
    onDegerNotu: spec.onayli ? '' : ' (turuncu: ön değer)',
    et: fmt(WALL),
    OLCU_TABLOSU: olcuTablosu(),
    L1: fmt(M.L1),
    L2: fmt(M.L2),
  };
  for (const p of PORTS) {
    vals[`${p.id}_BOSS`] = `Ø${fmt(p.bossCap)}`;
    vals[`${p.id}_DIS`] = fmt(p.disDerinligi);
  }
  const svg = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vals)) throw new Error(`Çizim şablonunda bilinmeyen alan: ${k}`);
    return vals[k];
  });
  await writeFile(DRAWING, svg);
}

// ---------------- üretim planı (HTML) ----------------
const BAR_SIZES = [50, 55, 60, 63, 65, 70, 75, 80, 85, 90, 100];   // Ø, zarfa +1 mm işleme payı

function planData(stepInfo) {
  const envelope = 2 * MAX_FACE;
  const bar = BAR_SIZES.find((s) => s >= envelope + 1) ?? Math.ceil(envelope + 5);
  const blank = H + 7;
  const rawKg = (Math.PI / 4) * bar * bar * blank * 8.5e-6;
  const partKg = stepInfo.volume * 8.5e-6;
  const sealFace = TOP.minor / 2 - 0.3 - (RB + CH);           // üst alında conta için kalan halka genişliği
  const rootWall = (Math.min(TOP.minor, BOT.minor) - M.E) / 2; // diş dibindeki et
  const threadLen = PORTS.map((p) => p.face - RB);             // port dişi için kullanılabilir boy

  // Dayanım el hesabı: ince cidarlı boru σ = P·D / 2t, burulma τ = T·r / J
  const YIELD = 140;                                           // MPa, pirinç için muhafazakâr akma kabulü
  const TORQUE = 200;                                          // Nm, sıkma momenti kabulü
  const rootD = Math.min(TOP.minor, BOT.minor);
  const hoop = (bar, D, t) => (bar * 0.1 * D) / (2 * t);
  const tau = (D) => (TORQUE * 1000 * (D / 2)) / ((Math.PI / 32) * (D ** 4 - M.E ** 4));
  const pMax = spec.isletmeBasinci.max;
  const strength = [
    [`${pMax} bar, gövde (et ${fmt(WALL)} mm)`, hoop(pMax, M.D, WALL), YIELD],
    [`${pMax} bar, diş dibi (et ${fmt(rootWall, 1)} mm)`, hoop(pMax, rootD, rootWall), YIELD],
    [`${spec.testBasinci} bar test, diş dibi`, hoop(spec.testBasinci, rootD, rootWall), YIELD],
    [`${TORQUE} Nm sıkma, diş dibi (burulma)`, tau(rootD), 0.58 * YIELD],
  ];
  return { envelope, bar, blank, rawKg, partKg, chipPct: 100 * (1 - partKg / rawKg), sealFace, rootWall, threadLen, strength, YIELD };
}

function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function planHtml(info, sizes) {
  const d = planData(info);
  const q = (v) => (spec.onayli ? v : `<span class="q">${v}</span>`);
  const [P1] = PORTS;
  const portRows = PORTS.map((p) => [`<b>${p.id}</b>`, p.dis, `${p.aci}°`, p.seviye, `Ø${fmt(p.bossCap)}`, q(fmt(p.face)), fmt(p.disDerinligi), `Ø${fmt(p.t.tapDrill)}`]);
  const uniqueTaps = [...new Map(PORTS.map((p) => [p.size, p])).values()];
  const dl = (file, label, sub) => `<a class="dl" href="${file}" download><b>${label}</b><span>${sub}${sizes?.[file] ? ` · ${sizes[file]}` : ''}</span></a>`;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Üretim Paketi · Kazan Altı Parçası Rev ${spec.rev}</title>
<link rel="icon" type="image/svg+xml" href="../brand/favicon.svg">
<style>
  :root { --ink: #0f1a1c; --muted: #5b6670; --line: #d9dde1; --soft: #f4f5f6; --q: #c2410c; --accent: #9a6b12; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--ink); font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 16px; }
  header img { height: 24px; display: block; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: -.2px; }
  .meta { color: var(--muted); margin-top: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${spec.onayli ? '#e7f6ec; color:#17663a' : '#fff1e8; color: var(--q)'}; white-space: nowrap; }
  .back { color: var(--muted); font-size: 13px; text-decoration: none; }
  .back:hover { color: var(--ink); }
  h2 { font-size: 18px; margin: 36px 0 10px; padding-top: 4px; }
  h2 small { color: var(--muted); font-weight: 400; font-size: 13px; margin-left: 6px; }
  p { margin: 8px 0; }
  .q { color: var(--q); font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  th, td { text-align: left; vertical-align: top; padding: 7px 9px; border-bottom: 1px solid var(--line); }
  th { background: var(--soft); font-weight: 600; white-space: nowrap; }
  td:first-child { white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin: 12px 0; }
  .dl { display: block; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; color: inherit; text-decoration: none; }
  .dl:hover { border-color: var(--ink); }
  .dl b { display: block; }
  .dl span { color: var(--muted); font-size: 12px; }
  .dl.main { background: var(--ink); color: #fff; border-color: var(--ink); }
  .dl.main span { color: #c9d1d6; }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .facts div { padding: 10px 14px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .facts small { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .facts b { font-size: 15px; }
  ol.open { padding-left: 20px; }
  ol.open li { margin: 6px 0; }
  .callout { border-left: 3px solid var(--accent); background: #fbf7ee; padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 12px 0; }
  .note { color: var(--muted); font-size: 12px; }
  footer { margin-top: 48px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
  @media print {
    @page { size: A4; margin: 14mm 12mm; }
    body { font-size: 11px; }
    main { padding: 0; max-width: none; }
    .noprint { display: none !important; }
    h2 { break-after: avoid; margin-top: 22px; }
    table, .callout, .facts { break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<main>
<header>
  <div>
    <img src="../brand/ratel-lockup.svg" alt="Ratel Systems">
    <h1>Üretim Paketi — ${esc(spec.parca)}</h1>
    <div class="meta">Rev ${spec.rev} · ${spec.tarih} · ${esc(spec.malzeme)} · ${esc(spec.adet)}</div>
  </div>
  <div style="text-align:right">
    <span class="badge">${spec.onayli ? 'Ölçüler onaylı' : esc(spec.durum)}</span><br>
    <a class="back noprint" href="../">← 3D model</a>
  </div>
</header>

<section class="noprint">
  <h2>İndir</h2>
  <div class="grid">
    ${dl(FILES.zip, 'Paketin tamamı (ZIP)', 'Fason atölyeye gönderilecek dosya')}
    ${dl(FILES.step, 'STEP 3D model', 'CAM için, AP242, mm')}
    ${dl(FILES.drawingPdf, 'Teknik resim (PDF)', 'A3, ölçü tablolu')}
    ${dl(FILES.dxf, 'DXF', 'Ön + üst görünüş, 1:1, mm')}
    ${dl(FILES.planPdf, 'Üretim planı (PDF)', 'Bu sayfanın baskısı')}
  </div>
  ${spec.onayli ? '' : `<p class="callout"><b>Teklif aşaması.</b> Ölçüler girildi, boy onayı bekleniyor. Fiyat bu paketle istenebilir, sipariş ise onaylı revizyon üzerinden verilmeli. Ölçüler <code>olculer.json</code> dosyasına girilip <code>npm run build</code> çalıştırılınca bütün dosyalar yeniden üretilir.</p>`}
</section>

<h2>1. Özet</h2>
<div class="facts">
  <div><small>Parça</small><b>${esc(spec.parca)}</b></div>
  <div><small>Revizyon</small><b>${spec.rev} · ${spec.tarih}</b></div>
  <div><small>Malzeme</small><b>${esc(spec.malzeme.split(' (')[0])}</b></div>
  <div><small>Adet</small><b>${esc(spec.adet)}</b></div>
  <div><small>Ham malzeme</small><b>Ø${d.bar} yuvarlak çubuk · ${d.blank} mm</b></div>
  <div><small>Ağırlık (tahmini)</small><b>${fmt(d.partKg, 2)} kg mamul · ${fmt(d.rawKg, 2)} kg ham</b></div>
  <div><small>Genel tolerans</small><b>${esc(spec.genelTolerans)}</b></div>
  <div><small>Üst / alt bağlantı</small><b>${spec.uclar.ust.dis} / ${spec.uclar.alt.dis} dış</b></div>
  <div><small>İşletme / test basıncı</small><b>${spec.isletmeBasinci.min}–${spec.isletmeBasinci.max} bar / ${spec.testBasinci} bar</b></div>
</div>

<h2>2. Açık konular <small>siparişten önce kapatılacak</small></h2>
<ol class="open">
  ${spec.onayli ? '' : `<li><b>Boy onayı:</b> diş boyları 20 mm olunca H ${fmt(H)} mm'ye çıktı (H1 ${fmt(M.H1)}, H2 ${fmt(M.H2)}); teyit edilecek. Kritik toleranslar da konuşulacak.</li>`}
  <li><b>Üretim yöntemi (ustaya sorulacak):</b> çubuktan tek parça mı, boru + lehimli manşon mu? Maliyete en çok etki eden karar; seçenekler aşağıda.</li>
  <li><b>Çalışma sıcaklığı:</b> azami su sıcaklığı teyit edilecek.</li>
  <li><b>Yüzey ve markalama:</b> doğal pirinç mi, nikel kaplama mı? Lazer markalama (logo, rev, parti no) istenecek mi?</li>
</ol>

<h2>3. Üretilebilirlik notları</h2>
<p><b>Et ${fmt(WALL)} mm: gövde boru gibi.</b> Dış Ø${fmt(M.D)}, delik Ø${fmt(M.E)}. ${sizeOf(spec.uclar.ust.dis)}" dişler gövdeyle neredeyse aynı çapta (Ø${fmt(TOP.major)}) olduğu için omuz ve diş boşaltma kanalı yok, dişler serbest çıkışla biter. Diş dibinde et ${fmt(d.rootWall, 1)} mm kalır; bu boru dişlerinde normaldir.</p>
<p><b>Port boss'ları zorunlu.</b> ${fmt(WALL)} mm et tek başına yalnız ${fmt(WALL)} mm diş boyu verir; 1/2" ve 3/4" bağlantılar için 12–14 mm gerekir. Alın mesafeleri (A, B) korunduğu için kullanılabilir diş boyu ${PORTS.map((p, i) => `${p.id} ${fmt(d.threadLen[i], 1)} mm`).join(', ')}. Boss'lar gövdeden ${fmt(Math.min(...PORTS.map((p) => p.face - R)), 1)}–${fmt(Math.max(...PORTS.map((p) => p.face - R)), 1)} mm çıkar.</p>
${table(['Seçenek', 'Nasıl', 'İşleme', 'Not'], [
    ['<b>A. Çubuktan tek parça</b> (öneri, prototip)', `Ø${d.bar} çubuk; gövde boss'ların etrafında Ø${fmt(M.D)} çapa indirilir`, 'Torna + 4 eksen kontur frezeleme', `Tek parça, sızdırmazlık riski yok; talaş çok (≈ %${fmt(d.chipPct, 0)})`],
    ['<b>B. Boru + lehimli manşon</b>', `Ø${fmt(M.D)} × ${fmt(WALL)} pirinç boru; ${[...new Set(PORTS.map((p) => p.dis))].join(' ve ')} manşonlar kurşunsuz sert lehimle`, 'Torna + lehim + diş', 'Malzeme ucuz; boru ve manşon da suya uygun olmalı, lehim kalitesi ve basınç testi kritik'],
    ['<b>C. Sıcak dövme + CNC</b>', `${esc(spec.malzemeKisa)} dövme ham parça, boss'lar dövmeden gelir`, 'Kalıp + torna + delik/diş', 'Seri (1000+) için en ucuz; kalıp yatırımı'],
  ])}
<p><b>Malzeme:</b> parça suyla temas ettiği için ${esc(spec.malzemeKisa)} seçildi: kurşun oranı %0,2'nin altında, çinko kaybına dayanıklı (EN ISO 6509). Kurşunlu pirince göre daha zor işlenir, çapak eğilimi fazladır. Alternatif: kurşunsuz CW724R (yüksek dayanım, daha pahalı).</p>
<ul>
  <li><b>Conta yüzeyi:</b> klingerit conta üst alına oturur, conta bileziği yok (karar verildi). Diş pahı ve delik pahından sonra alında yaklaşık ${fmt(d.sealFace, 1)} mm genişliğinde halka kalır. Bu halka düz, çapaksız ve Ra 1,6 olmalı; pahlar büyütülmemeli.</li>
  <li><b>Dişler:</b> üst uç ${spec.uclar.ust.dis} (ISO 228-1, düz), conta ile sızdırmaz. Alt uç ${spec.uclar.alt.dis} (ISO 7-1, 1:16 konik), keten + teflonla sızdırmaz; ölçüm düzlemi serbest uçtan ${fmt(BOT.gauge, 1)} mm içeride, L2 = ${fmt(M.L2)} mm yeterli.</li>
  <li><b>Diş bitişi ile ağız arası:</b> ağız kenarları diş bitişine ${fmt(Math.min(...PORTS.map((p) => Math.min(Z_TT - p.z - p.r, p.z - p.r - M.L2))))} mm mesafede. Diş takımının çıkışı bu paya göre planlanmalı.</li>
  <li><b>Anahtar:</b> altıgen yok, parça boru anahtarıyla sıkılır. Anahtar gövdenin ağızsız yarısından tutar; ${fmt(WALL)} mm eti ezmemek için ağız koruması (bez, kayış veya yumuşak çene) kullanılmalı.</li>
  <li><b>İnce et ve bağlama:</b> ${fmt(WALL)} mm ette ayna sıkma kuvveti gövdeyi ovalleştirebilir; ikinci bağlamada geniş/yumuşak çene veya iç destek tapası önerilir.</li>
  <li><b>Port delikleri:</b> diş dibi delikleri (${uniqueTaps.map((p) => `${p.dis} için Ø${fmt(p.t.tapDrill)}`).join(', ')}) doğrudan ØE deliğine açılır, ayrı kanal delmeye gerek yok. Kesişimde çapak oluşur, çapak alma ayrı operasyon olarak planlandı.</li>
  <li><b>Diş frezesi:</b> G 1/2 ve G 3/4 aynı adımda (14 TPI). Kılavuz yerine 14 TPI 55° diş frezesi kullanılırsa iki port tek takımla çekilir.</li>
  <li><b>Talaş oranı:</b> yaklaşık %${fmt(d.chipPct, 0)}. Prototip için sorun değil; seri üretimde sıcak dövme ham parça + CNC daha ekonomik olur.</li>
</ul>

<h2>Dayanım kontrolü <small>el hesabı</small></h2>
${table(['Durum', 'Gerilme', 'İzin verilen', 'Emniyet'], d.strength.map(([name, s, limit]) => [name, `${fmt(s, 1)} MPa`, `${fmt(limit, 0)} MPa`, `≈ ${fmt(limit / s, 0)} kat`]))}
<p class="note">Akma için muhafazakâr ${d.YIELD} MPa kabul edildi; kesin değer malzeme sertifikasından alınır. Hesap ince cidarlı boru formülüyle yapıldı, port delikleri çevresindeki gerilme yığılması dahil değildir; bu yüzden ${spec.testBasinci} bar sızdırmazlık testi her parçaya uygulanır. ${fmt(WALL)} mm et basınç ve burulma için yeterlidir; asıl risk boru anahtarının eti ezmesidir, bu yüzden ağız koruması kullanılır.</p>

<h2>4. Ölçüler <small>olculer.json</small></h2>
${table(['Harf', 'Değer (mm)', 'Açıklama'], Object.entries(spec.olculer).map(([k, v]) => [`<b>${letter(k)}</b>`, q(fmt(v.deger)), esc(v.aciklama)]))}
${table(['Port', 'Diş', 'Açı', 'Seviye', 'Boss', 'Alın (eksenden)', 'Diş derinliği', 'Diş dibi matkabı'], portRows)}
<p class="note">Üstten görünümde açı: 0° = P1 yönü, 90° = sol. Seviyeler üst alından ölçülür: seviye 1 = H1, seviye 2 = H2. Et kalınlığı = (ØD − ØE) / 2 = ${fmt(WALL)} mm.</p>

<h2>5. Ham malzeme</h2>
${table(['Kalem', 'Değer'], [
    ['Malzeme', `${esc(spec.malzeme)} · EN 12164 çubuk · EN 10204 3.1 sertifikalı`],
    ['Çubuk (seçenek A)', `Ø${d.bar} mm yuvarlak (boss zarfı Ø${fmt(d.envelope)})`],
    ['Boru (seçenek B)', `Ø${fmt(M.D)} × ${fmt(WALL)} mm pirinç boru + manşonlar`],
    ['Kesim boyu', `${d.blank} mm / parça (H = ${fmt(H)} + alın ve kesme payı)`],
    ['10 adet için', `≈ ${fmt((d.blank + 3) * 10 / 1000, 2)} m çubuk (testere payı dahil)`],
  ])}

<h2>6. Operasyon planı <small>fason, prototip</small></h2>
${table(['Op', 'Tezgah / bağlama', 'İşlem', 'Takım'], [
    ['10', 'CNC torna — 1. bağlama, alt uç dışarıda', `Alın tornalama · dış çap kaba (boss bölgesi Ø${fmt(d.envelope)} zarf bırakılır) · alt uç Ø${fmt(BOT.major)} · pah · punta + Ø25 ön delik + ØE ${fmt(M.E)} iç tornalama (boydan) · alt dış diş ${spec.uclar.alt.dis} (${BOT.tpi} TPI${BOT_CONICAL ? ', 1:16 konik' : ''}, serbest çıkış) · kesme`, 'T01, T02, T03, T04, T05, T06'],
    ['20', 'CNC torna — 2. bağlama, ters, geniş/yumuşak çene + iç destek', `Boy alma H = ${fmt(H)} · üst uç Ø${fmt(TOP.major)} · üst alın (conta yüzeyi) finiş, Ra 1,6, düz · pah · üst dış diş ${spec.uclar.ust.dis} (${TOP.tpi} TPI) · iç pah`, 'T01, T03, T06'],
    ['30', '4 eksen dik işlem / C eksenli torna', `Gövdeyi boss'lar etrafında Ø${fmt(M.D)} çapa indirme (kontur), et ${fmt(WALL)} mm`, 'T07'],
    ['40', 'Aynı bağlama', `Port alınlarını düzleme (A = ${fmt(M.A)}, B = ${fmt(M.B)}) · punta · diş dibi delikleri ØE'ye kadar (${uniqueTaps.map((p) => `Ø${fmt(p.t.tapDrill)}`).join(' / ')}) · 90° havşa · port dişleri ${uniqueTaps.map((p) => p.dis).join(' / ')}`, 'T04, T07, T08, T09, T10, T11'],
    ['50', 'Tezgah dışı', 'Çapak alma: port–ØE kesişimleri, diş girişleri, pahlar · yıkama, kurutma', 'Çapak alma takımı, fırça'],
    ['60', 'Kalite', 'Ölçü ve diş kontrolü, sızdırmazlık testi (bkz. kontrol planı)', 'Mastarlar, test düzeneği'],
    ['70', 'Paketleme', 'Diş koruma tapaları/kapakları, parça başı poşet, etiket (parça, rev, adet)', '—'],
  ])}

<h2>7. Takım listesi <small>${esc(spec.malzemeKisa)} için tahmini başlangıç değerleri</small></h2>
${table(['T', 'Takım', 'Kullanım', 'Vc (m/dk)', 'İlerleme'], [
    ['T01', 'Dış tornalama kateri 35° (VCGT tipi, keskin, talaş kırıcılı)', 'Kaba + finiş', '180–300', '0,10–0,20 mm/dev'],
    ['T02', 'Kesme kateri 3 mm', 'Kesme', '100–180', '0,05–0,10 mm/dev'],
    ['T03', 'Dış diş kateri 55° (Whitworth)', `${[...new Set([spec.uclar.ust.dis, spec.uclar.alt.dis])].join(' / ')} (${TOP.tpi} TPI, adım ${fmt(25.4 / TOP.tpi, 3)})`, '80–140', 'Adım'],
    ['T04', 'Punta matkabı 90°', 'Merkezleme', '60–100', '0,05–0,10 mm/dev'],
    ['T05', 'Matkap Ø25 (ağzı köreltilmiş, 0° talaş açısı)', 'ØE ön delik', '60–100', '0,08–0,15 mm/dev'],
    ['T06', `İç tornalama bıçağı (Ø${fmt(M.E)} için)`, 'ØE finiş, iç pahlar', '150–220', '0,06–0,12 mm/dev'],
    ['T07', 'Parmak freze Ø10–12, 3 ağız (pirinç/alüminyum)', 'Boss konturu, port alınları', '100–180', '0,03–0,05 mm/diş'],
    ['T08', `Matkap Ø${fmt(P1.t.tapDrill)}`, `${P1.dis} diş dibi (alternatif Ø24,5)`, '60–90', '0,08–0,15 mm/dev'],
    ['T09', `Matkap Ø${fmt(BSP['1/2'].tapDrill)}`, 'G 1/2 diş dibi (alternatif Ø19)', '60–90', '0,08–0,12 mm/dev'],
    ['T10', 'Havşa 90°', 'Port girişleri', '60–100', 'Elle/yavaş'],
    ['T11', 'Kılavuz G 3/4 ve G 1/2 (ISO 228, HSS-E, düz oluklu) <i>veya</i> diş frezesi 14 TPI 55°', 'Port dişleri', '8–15 / 60–100', 'Adım 1,814'],
  ])}
<p class="note">Değerler başlangıç içindir; atölye kendi takım ve tezgahına göre ayarlar. Pirinçte matkap ve kılavuzda pozitif talaş açısı yerine 0° (ağzı köreltilmiş) tercih edilir; böylece takım işe çekilmez. ${esc(spec.malzemeKisa)} kurşunlu pirince göre uzun talaş ve fazla çapak verebilir: ilerleme düşük tutulur, takım keskin olmalıdır.</p>

<h2>8. Kontrol planı <small>prototipte %100</small></h2>
${table(['No', 'Karakteristik', 'Kabul kriteri', 'Yöntem / ekipman', 'Kayıt'], [
    ['1', 'Malzeme', `${esc(spec.malzemeKisa)}, EN 12164, Pb ≤ %0,2, çinko kaybına dayanıklı (EN ISO 6509)`, 'EN 10204 3.1 sertifikası', 'Sertifika'],
    ['2', 'Toplam boy H', `${q(fmt(H))} · ${esc(spec.genelTolerans)}`, 'Kumpas', 'Ölçüm raporu'],
    ['3', 'Gövde ØD, delik ØE, et', `${q(fmt(M.D))} / ${q(fmt(M.E))} · et ${fmt(WALL)} mm ± 0,2 (öneri)`, 'Kumpas, mikrometre, iç ölçer; et için ultrasonik kalınlık ölçer', 'Ölçüm raporu'],
    ['4', 'Seviye yükseklikleri H1, H2', `${q(fmt(M.H1))} / ${q(fmt(M.H2))} (üst alından)`, 'Yükseklik mihengiri / kumpas', 'Ölçüm raporu'],
    ['5', 'Port alınları A, B', `${q(fmt(M.A))} / ${q(fmt(M.B))} (eksenden)`, 'Kumpas (ØD/2 + çıkıntı)', 'Ölçüm raporu'],
    ['6', `Üst dış diş ${spec.uclar.ust.dis}`, 'ISO 228-1, sınıf A (öneri)', `${spec.uclar.ust.dis} halka mastar, geçer/geçmez`, 'Ölçüm raporu'],
    ['7', `Alt dış diş ${spec.uclar.alt.dis}`, BOT_CONICAL ? 'ISO 7-1, konik 1:16' : 'ISO 228-1', BOT_CONICAL ? `${spec.uclar.alt.dis} konik halka mastar (ISO 7-2)` : `${spec.uclar.alt.dis} halka mastar`, 'Ölçüm raporu'],
    ['8', 'Port dişleri', `${uniqueTaps.map((p) => p.dis).join(', ')} · ISO 228-1`, 'Tampon mastar, geçer/geçmez', 'Ölçüm raporu'],
    ['9', 'Diş boyları', `L1 = ${q(fmt(M.L1))}, L2 = ${q(fmt(M.L2))}, port diş derinlikleri ${PORTS.map((p) => `${p.id} ${fmt(p.disDerinligi)}`).join(', ')}`, 'Kumpas, mastarla tur sayısı', 'Ölçüm raporu'],
    ['10', 'Conta yüzeyi (üst alın)', 'Düz, çapaksız, radyal çizik yok, Ra ≤ 1,6', 'Görsel + pürüzlülük karşılaştırma numunesi', 'Ölçüm raporu'],
    ['11', 'İç kesişim çapakları', 'Çapak ve gevşek talaş yok', 'Görsel (fener / endoskop)', 'Kontrol listesi'],
    ['12', 'Kenar pahları', '0,3–0,5 × 45°, keskin kenar yok', 'Görsel', 'Kontrol listesi'],
    ['13', 'Sızdırmazlık', `${spec.testBasinci} bar (1,5 × ${spec.isletmeBasinci.max} bar), 60 s, kaçak yok`, 'Hidrostatik test veya su altında hava testi', 'Test kaydı'],
    ['14', 'İlk parça muayenesi', 'Tüm karakteristikler', 'Ölçüm tablosu + fotoğraf', 'İlk parça raporu'],
  ])}

<h2>9. Teklif talebi <small>fason atölyeye</small></h2>
<p>Ekteki STEP model ve teknik resme göre ${esc(spec.parca)} (Rev ${spec.rev}) için fiyat rica ediyoruz.</p>
${table(['Kalem', 'İstek'], [
    ['Adet', '1, 5 ve 10 adet için ayrı birim fiyat'],
    ['Malzeme', `${esc(spec.malzeme)}, EN 12164, EN 10204 3.1 sertifikalı · Ø${d.bar} çubuk temin edilebiliyor mu belirtin · kurşunsuz CW724R için ayrı fiyat`],
    ['Üretim', 'Seçenek A (çubuktan tek parça). Uygun görürseniz seçenek B (boru + lehimli manşon) için de fiyat'],
    ['Kalite', `${esc(spec.genelTolerans)} · diş mastar kontrolü (${spec.uclar.ust.dis} ve ${spec.uclar.alt.dis} halka, ${[...new Set(PORTS.map((p) => p.dis))].join(' ve ')} tampon) · ${spec.testBasinci} bar sızdırmazlık testi (işletme ${spec.isletmeBasinci.min}–${spec.isletmeBasinci.max} bar) · ilk parça ölçüm raporu`],
    ['Teslim', 'Çapaksız ve temiz; diş koruma tapalı, parça başı poşet, etiketli'],
    ['Teklifte görmek istediklerimiz', 'Birim fiyat, kurulum / programlama bedeli, malzeme, mastar bedeli (mastarlar sizde var mı), test, termin, teklif geçerlilik süresi, ödeme koşulu'],
    ['Not', `Sipariş onaylı revizyon üzerinden verilecektir; boy onayında küçük değişiklik olabilir.`],
  ])}

<footer>${esc(spec.parca)} · Rev ${spec.rev} · ${spec.tarih} · Bu sayfa ve ekleri <code>olculer.json</code> dosyasından üretildi.</footer>
</main>
</body>
</html>
`;
}

// ---------------- PDF, ZIP ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function printPdf(url, pdf) {
  if (!existsSync(EDGE)) {
    console.warn(`Edge bulunamadı (${EDGE}); ${path.basename(pdf)} atlandı. EDGE_PATH ile yol verilebilir.`);
    return false;
  }
  const profileDir = mkdtempSync(path.join(tmpdir(), 'kts-edge-'));
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--no-first-run', `--user-data-dir=${profileDir}`, '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, url], { stdio: 'ignore', timeout: 120000 });
  // Edge başlatıcısı PDF yazılmadan dönebiliyor: dosya oluşup boyutu sabitlenene kadar bekle
  for (let i = 0; i < 120; i++) {
    if (existsSync(pdf)) {
      const before = (await stat(pdf)).size;
      await sleep(400);
      if (before > 0 && before === (await stat(pdf)).size) return true;
    }
    await sleep(250);
  }
  return false;
}

async function fileSizes() {
  const sizes = {};
  for (const f of Object.values(FILES)) {
    const p = path.join(OUT, f);
    if (!existsSync(p)) continue;
    const kb = (await stat(p)).size / 1024;
    sizes[f] = kb > 1024 ? `${fmt(kb / 1024, 1)} MB` : `${fmt(kb, 0)} KB`;
  }
  return sizes;
}

// Sitedeki varlık linklerine içerik özeti ekler (GitHub Pages 10 dk önbellek tutar)
async function bustCache() {
  const h = createHash('sha1');
  for (const f of ['app.js', 'style.css', 'olculer.json', 'kazan-alti-parcasi-taslak.svg']) h.update(await readFile(path.join(ROOT, f)));
  const v = h.digest('hex').slice(0, 8);
  const indexPath = path.join(ROOT, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, html
    .replace(/\?v=[\w-]+/g, `?v=${v}`)
    .replace(/Rev [A-Z]+ taslak/g, `Rev ${spec.rev} taslak`)
    .replace(/Pirinç [A-Z0-9]+ ·/g, `Pirinç ${spec.malzemeKisa} ·`)
    .replace(/(Teknik çizim · Rev )[A-Z]+/g, `$1${spec.rev}`));
  return v;
}

// ---------------- çalıştır ----------------
const warnings = checks();
for (const w of warnings) console.warn(`UYARI: ${w}`);

await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) {
  if (/^kazan-alti-parcasi-rev.*\.(step|dxf|pdf|zip)$/.test(f)) await rm(path.join(OUT, f));
}

const info = await buildStep();
console.log(`STEP  ${FILES.step}  hacim ${fmt(info.volume / 1000, 1)} cm³, sınırlar ${JSON.stringify(info.bounds.map((b) => b.map((v) => Math.round(v * 100) / 100)))}`);
await buildDxf();
console.log(`DXF   ${FILES.dxf}`);
await buildDrawing();
console.log('SVG   kazan-alti-parcasi-taslak.svg');

const planPath = path.join(OUT, 'index.html');
await writeFile(planPath, planHtml(info));
const wrapDir = mkdtempSync(path.join(tmpdir(), 'kts-cizim-'));
const wrap = path.join(wrapDir, 'cizim.html');
await writeFile(wrap, `<!doctype html><meta charset="utf-8"><style>@page{size:420mm 297mm;margin:0}html,body{margin:0}img{display:block;width:420mm;height:297mm}</style><img src="${pathToFileURL(DRAWING).href}">`);
if (await printPdf(pathToFileURL(wrap).href, path.join(OUT, FILES.drawingPdf))) console.log(`PDF   ${FILES.drawingPdf}`);
if (await printPdf(pathToFileURL(planPath).href, path.join(OUT, FILES.planPdf))) console.log(`PDF   ${FILES.planPdf}`);

const packed = [FILES.step, FILES.dxf, FILES.drawingPdf, FILES.planPdf].filter((f) => existsSync(path.join(OUT, f)));
execFileSync(TAR, ['-a', '-c', '-f', path.join(OUT, FILES.zip), '-C', OUT, ...packed, '-C', ROOT, 'olculer.json']);
console.log(`ZIP   ${FILES.zip}`);

await writeFile(planPath, planHtml(info, await fileSizes()));
console.log(`HTML  uretim/index.html · önbellek etiketi ${await bustCache()}`);
