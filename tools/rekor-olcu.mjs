// rekor-olculer.json'dan türeyen ölçüler: teknik çizim ve üretim paketi aynı değerleri kullanır
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const spec = JSON.parse(await readFile(path.join(ROOT, 'rekor-olculer.json'), 'utf8'));
export const M = Object.fromEntries(Object.entries(spec.olculer).map(([k, v]) => [k, v.deger]));

export const BSP = { major: 47.803, minor: 44.845, pitch: 25.4 / 11, gauge: 12.7, tapDrill: 45.25, tpi: 11 };
export const { ust, alt } = spec.uclar;
export const CONTA = spec.conta;

export const BORE_R = M.E / 2;
export const NECK_R = M.N / 2;
export const COLLAR_R = M.D / 2;
export const HEX_R = M.S / 2;
export const SPIGOT_R = spec.merkezleme.cap / 2;
export const SEAT_Y = M.C + M.K;           // Parça 1 üst alnı
export const SPIGOT_Y = SEAT_Y - spec.merkezleme.giris;
export const FACE_Y = SEAT_Y + CONTA.kalinlik;
export const COLLAR_TOP = FACE_Y + M.T;
export const NECK_TOP = M.H - M.L;
export const LIP = M.B - COLLAR_TOP;
export const CH_U = spec.pah.yakaUst;
export const CH_B = spec.pah.yakaAlt;
export const CH_A = spec.pah.agiz;

// Yaka dış çizgisinin dönüm noktaları
export function collarGeometry() {
  const hf = M.F / 2;
  const rc = M.R;
  const ef = hf - rc;
  const ang = Math.asin(ef / (COLLAR_R - rc));
  const cx = (COLLAR_R - rc) * Math.cos(ang);
  return { hf, rc, ef, ang, cx, a: COLLAR_R * Math.cos(ang), b: COLLAR_R * Math.sin(ang) };
}

// Yaka dış çizgisi: x, z noktaları
export function collarOutline(n = 24) {
  const { hf, rc, ang, cx } = collarGeometry();
  const quarter = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * ang;
    quarter.push([COLLAR_R * Math.cos(a), COLLAR_R * Math.sin(a)]);
  }
  for (let i = 1; i <= n / 2; i++) {
    const a = ang + ((2 * i) / n) * (Math.PI / 2 - ang);
    quarter.push([cx + rc * Math.cos(a), hf - rc + rc * Math.sin(a)]);
  }
  const m = (sx, sz, list) => list.map(([x, z]) => [sx * x, sz * z]);
  return [...quarter, ...m(-1, 1, quarter).reverse(), ...m(-1, -1, quarter), ...m(1, -1, quarter).reverse()];
}

// Nokta yaka dış çizgisinin içinde mi?
export function inCollar(x, z) {
  if (Math.abs(z) > M.F / 2 || Math.hypot(x, z) > COLLAR_R) return false;
  const ef = M.F / 2 - M.R;
  const cx = Math.sqrt((COLLAR_R - M.R) ** 2 - ef ** 2);
  const [ax, az] = [Math.abs(x), Math.abs(z)];
  if (az <= ef || ax <= cx) return true;
  if (Math.atan2(az - ef, ax - cx) < Math.atan2(ef, cx)) return true;
  return Math.hypot(ax - cx, az - ef) <= M.R;
}

// Tırnağın yakaya bastığı düz yüzey alanı (mm²)
export function contactArea() {
  const d = 0.05;
  let n = 0;
  for (let x = -COLLAR_R; x <= COLLAR_R; x += d) {
    for (let z = -COLLAR_R; z <= COLLAR_R; z += d) {
      if (Math.hypot(x, z) >= M.W / 2 && Math.hypot(x, z) <= COLLAR_R - CH_U && inCollar(x, z)) n++;
    }
  }
  return n * d * d;
}

// Temas yayının toplam boyu (mm), orta yarıçapta
export function contactArc() {
  const r = (M.W / 2 + COLLAR_R - CH_U) / 2;
  const steps = 7200;
  let n = 0;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    if (inCollar(r * Math.cos(a), r * Math.sin(a))) n++;
  }
  return { r, length: (n / steps) * 2 * Math.PI * r };
}
