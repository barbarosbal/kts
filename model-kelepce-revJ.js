import * as THREE from 'three';
import { metin } from 'kts/ortak';

// STEP ile aynı OpenCascade katısından üretilen ağ. CAD ekseni +Z; sahne ekseni +Y.
const VERSION = new URL(import.meta.url).search;
async function json(path) {
  const response = await fetch(`${path}${VERSION}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
export const SPEC = await json('kelepce-revJ-olculer.json');
const { mesh } = await json('uretim/kelepce-revJ/revJ-mesh.json');
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([key, value]) => [key, value.deger]));
const BODY_R = M.D / 2;
const BODY_Y = M.L + M.T;
const FACE_Y = M.H - M.C;
const MOUTH_X = M.A / 2;
const OUTER_X = MOUTH_X + M.U;
const MARK = SPEC.markalama;
const MARK_Y = BODY_Y + MARK.alt;

const LOGO = await (async () => {
  try {
    const img = new Image();
    img.src = `${MARK.logo}${VERSION}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = Math.round(canvas.width * img.naturalHeight / img.naturalWidth);
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  } catch (error) {
    console.warn('Logo yüklenemedi', error);
    return null;
  }
})();

function logoBand() {
  const angle = MARK.yukseklik * LOGO.width / LOGO.height / BODY_R;
  const radius = BODY_R + 0.02;
  const texture = new THREE.CanvasTexture(LOGO);
  texture.anisotropy = 8;
  const geometry = new THREE.CylinderGeometry(radius, radius, MARK.yukseklik, 128, 1, true,
    1.5 * Math.PI - angle / 2, angle).translate(0, MARK_Y + MARK.yukseklik / 2, 0);
  // Görsel yüzey izi; 0,03–0,05 mm kazıma şartı lazer resmindedir.
  const material = new THREE.MeshStandardMaterial({
    color: 0xaab0b6, map: texture, metalness: 0.55, roughness: 0.95,
    transparent: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  });
  return new THREE.Mesh(geometry, material);
}

function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const hdim = (y, radius, label) => {
    a.line([[-radius, y, 0], [radius, y, 0]]);
    a.arrow([-radius, y, 0], [radius, y, 0]);
    a.arrow([radius, y, 0], [-radius, y, 0]);
    a.label(label, [0, y, 0], 'dimtag');
  };
  a.line([[0, -8, 0], [0, M.H + 8, 0]], a.dashMat);
  const [x0, x1] = [BODY_R + 8, BODY_R + 20];
  a.ext(M.H, OUTER_X + 1, x1 + 3);
  a.ext(FACE_Y, BODY_R + 1, x0 + 3);
  a.ext(M.L, M.N / 2 + 1, x0 + 3);
  a.ext(0, M.S / 2 + 1, x1 + 3);
  dim(x0, FACE_Y, M.H, 'C');
  dim(x0, 0, M.L, 'L');
  dim(x1, 0, M.H, 'H');
  a.line([[-MOUTH_X, M.H, 0], [-MOUTH_X, M.H + 9, 0]]);
  a.line([[MOUTH_X, M.H, 0], [MOUTH_X, M.H + 9, 0]]);
  hdim(M.H + 7, MOUTH_X, `A ≥ ${metin(M.A)}`);
  a.callout([-OUTER_X, M.H - 6, 0], [-42, M.H + 2, 6],
    `Tırnak ${metin(M.V)} × ${metin(M.U)}`, '20 mm düz çalışma · dip R2');
  a.callout([-BODY_R, BODY_Y + 2, 0], [-43, BODY_Y - 2, 6],
    `Gövde Ø${metin(M.D)}`, `${SPEC.malzemeKisa} · kaplamasız`);
  if (LOGO) {
    const t = THREE.MathUtils.degToRad(-80);
    a.callout([BODY_R * Math.sin(t), MARK_Y + MARK.yukseklik / 2, BODY_R * Math.cos(t)],
      [-48, FACE_Y + 5, 6], 'Ratel logosu', 'Lazer kazıma · 0,03–0,05 mm');
  }
  a.callout([-M.S / 2, M.L / 2, 0], [-34, 12, 6], 'Altıgen sap',
    `SW ${metin(SPEC.kavrama.sw)} × ${metin(M.L)} · boyun Ø${metin(M.N)} / R2`);
}

export function kur({ celik }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geometry.setIndex(mesh.triangles);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, celik));
  if (LOGO) group.add(logoBand());
  return {
    ad: SPEC.parca,
    alt: `${SPEC.malzemeKisa} · Tek parça torna + freze · Rev J · Numune adayı`,
    rev: SPEC.rev,
    paket: 'uretim/kelepce-revJ/',
    cizim: {
      src: 'uretim/kelepce-revJ/kelepce-ucu-revJ-teknik-resim.svg',
      alt: 'Rev J teknik resmi: Ø34 gövde, SW9 sap, Ø9 boyun, R2 dipler ve korunan 20 mm çalışma uçları',
    },
    parcalar: [{ obj: group }],
    occluder: { r: BODY_R, y0: BODY_Y, y1: FACE_Y },
    golge: 90,
    fit: (tech) => ({ y: M.H / 2, h: tech ? 70 : 64, w: tech ? 80 : 40 }),
    annotate,
  };
}
