// Site dosyalarının özetini index.html'deki ?v= etiketlerine yazar (Pages 10 dk önbellekler)
// Kullanım: cd tools && npm run site
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'app.js', 'ortak.js', 'model-kazan.js', 'model-rekor.js', 'model-montaj.js', 'style.css',
  'olculer.json', 'rekor-olculer.json', 'kazan-alti-parcasi-taslak.svg', 'oynar-rekor-taslak.svg',
];

const h = createHash('sha1');
for (const f of FILES) h.update(await readFile(path.join(ROOT, f)));
const v = h.digest('hex').slice(0, 8);

const indexPath = path.join(ROOT, 'index.html');
const html = await readFile(indexPath, 'utf8');
await writeFile(indexPath, html.replace(/\?v=[\w-]+/g, `?v=${v}`));
console.log(`HTML  önbellek etiketi ${v}`);
