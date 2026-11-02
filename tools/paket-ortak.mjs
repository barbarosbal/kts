// Üretim paketi üreticilerinin ortak parçaları: DXF yazıcı, plan sayfası biçemi, PDF baskısı
import { stat } from 'node:fs/promises';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TAR = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'bsdtar';
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

export const fmt = (n, digits = 2) => n.toLocaleString('tr-TR', { maximumFractionDigits: digits });
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// DXF (R12)
export class Dxf {
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

export function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

export const planCss = (onayli) => `  :root { --ink: #0f1a1c; --muted: #5b6670; --line: #d9dde1; --soft: #f4f5f6; --q: #c2410c; --accent: #9a6b12; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--ink); font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 16px; }
  header img { height: 24px; display: block; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: -.2px; }
  .meta { color: var(--muted); margin-top: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${onayli ? '#e7f6ec; color:#17663a' : '#fff1e8; color: var(--q)'}; white-space: nowrap; }
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
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function printPdf(url, pdf) {
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

// A3 teknik resim SVG'sini PDF'e basar
export async function printDrawing(svg, pdf) {
  const dir = mkdtempSync(path.join(tmpdir(), 'kts-cizim-'));
  const wrap = path.join(dir, 'cizim.html');
  writeFileSync(wrap, `<!doctype html><meta charset="utf-8"><style>@page{size:420mm 297mm;margin:0}html,body{margin:0}img{display:block;width:420mm;height:297mm}</style><img src="${pathToFileURL(svg).href}">`);
  return printPdf(pathToFileURL(wrap).href, pdf);
}

export async function fileSizes(dir, files) {
  const sizes = {};
  for (const f of files) {
    const p = path.join(dir, f);
    if (!existsSync(p)) continue;
    const kb = (await stat(p)).size / 1024;
    sizes[f] = kb > 1024 ? `${fmt(kb / 1024, 1)} MB` : `${fmt(kb, 0)} KB`;
  }
  return sizes;
}
