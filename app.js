import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

// Tüm ölçüler olculer.json'dan gelir (mm). Parça ekseni +Y, orijin alt ucun merkezi.
const SPEC = await fetch(`olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = Object.fromEntries(Object.entries(SPEC.olculer).map(([k, v]) => [k, v.deger]));

// BSP (ISO 228-1) diş verileri; tapDrill: diş dibi matkabı
const BSP = {
  '1 1/2': { major: 47.803, minor: 44.845, pitch: 25.4 / 11, tapDrill: 45.25, gauge: 12.7 },
  '3/4': { major: 26.441, minor: 24.117, pitch: 25.4 / 14, tapDrill: 24.25 },
  '1/2': { major: 20.955, minor: 18.631, pitch: 25.4 / 14, tapDrill: 18.75 },
};
const sizeOf = (dis) => dis.replace(/^[GR]\s*/, '');

const BODY_R = M.D / 2;
const BORE_R = M.E / 2;
const L1 = M.L1;
const L2 = M.L2;
const TOP = M.H;
const BODY_Y = [L2, TOP - L1];             // dişsiz gövde bölümü (alt / üst diş arası)
const LEVEL = { 1: TOP - M.H1, 2: TOP - M.H2 };   // seviyeler üst alından ölçülür
const LEVEL1 = LEVEL[1];
const LEVEL2 = LEVEL[2];
const TOP_THREAD = BSP[sizeOf(SPEC.uclar.ust.dis)];
const BOTTOM_THREAD = BSP[sizeOf(SPEC.uclar.alt.dis)];

// Açı üstten görünümde: 0° = P1 yönü (-Z), 90° = sol (-X). face: eksenden port alnına (A, B).
// Diş dibi matkabı Ø, diş bitiminden gövde deliğine kadar devam eder.
const PORTS = SPEC.portlar.map((p) => {
  const a = THREE.MathUtils.degToRad(p.aci);
  const size = sizeOf(p.dis);
  return {
    id: p.id,
    size,
    bossR: p.bossCap / 2,
    face: M[p.alin],
    depth: p.disDerinligi,
    passR: BSP[size].tapDrill / 2,
    y: LEVEL[p.seviye],
    level: p.seviye,
    dir: new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)),
  };
});

const Y = new THREE.Vector3(0, 1, 0);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Yuvarlatılmış Whitworth profili: 0 = diş dibi, 1 = diş tepesi
function profile(u) {
  const tri = 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  return tri * tri * (3 - 2 * tri);
}

// +Y ekseni boyunca s ∈ [0, len], yarıçapı r(θ, s) olan silindirik yüzey
function radialSurface(len, segs, rows, radius, inward) {
  const pos = new Float32Array((rows + 1) * segs * 3);
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const s = (len * j) / rows;
    for (let i = 0; i < segs; i++) {
      const th = (2 * Math.PI * i) / segs;
      const r = radius(th, s);
      pos[k++] = Math.cos(th) * r;
      pos[k++] = s;
      pos[k++] = -Math.sin(th) * r;
    }
  }
  const index = new Uint32Array(rows * segs * 6);
  k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * segs + i;
      const b = j * segs + ((i + 1) % segs);
      const c = a + segs;
      const d = b + segs;
      index.set(inward ? [a, c, b, b, c, d] : [a, b, c, b, d, c], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  return g;
}

// Sağ el dış diş; serbest uçta 45° pah, gövde tarafında diş çıkışı (diş derinliği sıfıra iner).
// R (ISO 7-1) dişte çap 1:16 koniktir; nominal çap serbest uçtan spec.gauge kadar içeride.
function externalThread(spec, len, freeAtStart, conical) {
  const rMaj = spec.major / 2;
  const rMin = spec.minor / 2;
  const rEnd = rMin - 0.3;
  const rows = Math.ceil((len / spec.pitch) * 26);
  return radialSurface(len, 192, rows, (th, s) => {
    const free = freeAtStart ? s : len - s;
    const runout = freeAtStart ? len - s : s;
    const taper = conical ? (s - spec.gauge) / 32 : 0;
    let r = lerp(rMin, rMaj, profile(s / spec.pitch - th / (2 * Math.PI))) + taper;
    r = lerp(rMaj + taper, r, smooth(0.4, 2.6, runout));
    return Math.min(r, rEnd + free, BODY_R);
  }, false);
}

// İç diş yüzeyi; iki ucunda delik çapına yumuşakça iner
function internalThread(spec, len) {
  const rMaj = spec.major / 2;
  const rMin = spec.minor / 2;
  const rows = Math.ceil((len / spec.pitch) * 22);
  return radialSurface(len, spec.major > 24 ? 112 : 96, rows, (th, s) => {
    const r = lerp(rMin, rMaj, profile(s / spec.pitch - th / (2 * Math.PI)));
    return lerp(rMaj, r, smooth(0, 0.9, s) * smooth(0, 1.2, len - s));
  }, true);
}

// Dış dişli boru ucu: diş + iç delik + alın halkası
function threadedEnd(spec, len, y0, freeAtStart, mat, conical = false) {
  const g = new THREE.Group();
  g.position.y = y0;
  g.add(new THREE.Mesh(externalThread(spec, len, freeAtStart, conical), mat));
  g.add(new THREE.Mesh(radialSurface(len, 128, 1, () => BORE_R, true), mat));
  const cap = new THREE.RingGeometry(BORE_R, spec.minor / 2 - 0.3, 192, 1);
  cap.rotateX(freeAtStart ? Math.PI / 2 : -Math.PI / 2);
  cap.translate(0, freeAtStart ? 0 : len, 0);
  g.add(new THREE.Mesh(cap, mat));
  return g;
}

// Nesnenin yerel +Y eksenini port yönüne çevirip eksenden `dist` uzağa koyar
function place(obj, p, dist) {
  obj.quaternion.setFromUnitVectors(Y, p.dir);
  obj.position.copy(p.dir).multiplyScalar(dist).setY(p.y);
  obj.updateMatrixWorld();
}

// Gövde: dolu silindir + eksenden başlayan port bossları − delik (ince ette boss içi delikte kalır)
// − diş delikleri, kanallar, havşalar
function buildBody() {
  const [y0, y1] = BODY_Y;
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = false;
  const cyl = (rTop, rBottom, h, segs) => new Brush(new THREE.CylinderGeometry(rTop, rBottom, h, segs));
  // CSG sonucu ilk operandın yerel koordinatında döner: eksendeki silindirlerin kaydırması geometriye işlenir
  const onAxis = (r, h, segs) => {
    const brush = new Brush(new THREE.CylinderGeometry(r, r, h, segs).translate(0, (y0 + y1) / 2, 0));
    brush.updateMatrixWorld();
    return brush;
  };

  let body = onAxis(BODY_R, y1 - y0, 160);
  for (const p of PORTS) {
    // Boss, en geniş yeri gövde yüzeyine değdiği yerden başlar: tabanı dolu gövdenin içinde kalır,
    // aynı seviyedeki diğer bosslarla kesişmez
    const from = Math.sqrt(Math.max(0, BODY_R ** 2 - p.bossR ** 2)) - 0.5;
    const boss = cyl(p.bossR, p.bossR, p.face - from, 72);
    place(boss, p, (p.face + from) / 2);
    body = ev.evaluate(body, boss, ADDITION);
  }
  body = ev.evaluate(body, onAxis(BORE_R, y1 - y0 + 2, 128), SUBTRACTION);

  for (const p of PORTS) {
    const rh = BSP[p.size].major / 2;
    const bottom = p.face - p.depth;
    const cuts = [
      [cyl(rh, rh, p.depth + 1, 64), p.face - p.depth / 2 + 0.5],
      [cyl(p.passR, p.passR, bottom + 0.5 - 10, 48), (bottom + 0.5 + 10) / 2],
      [cyl(rh + 1.6, rh - 0.2, 1.8, 64), p.face - 0.3],
    ];
    for (const [brush, dist] of cuts) {
      place(brush, p, dist);
      body = ev.evaluate(body, brush, SUBTRACTION);
    }
  }

  return toCreasedNormals(body.geometry, THREE.MathUtils.degToRad(30));
}

function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(0.4, 'rgba(0,0,0,0.28)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.2;
  return m;
}

// ---------------- sahne ----------------
const app = document.getElementById('app');
const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const techBtn = document.getElementById('tech');
const sheet = document.getElementById('sheet');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
stage.append(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(90, 170, 120);
scene.add(key);

const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
const TARGET = new THREE.Vector3(0, TOP / 2, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 110;
controls.maxDistance = 1200;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 1.2;

// Parçanın (teknik çizimde etiketlerle birlikte) kadraja sığdığı uzaklık
function fitDistance() {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const [h, w] = (annot.visible ? [0.78, 0.9] : [0.6, 0.56]).map((k) => k * TOP);
  return Math.max(h / t, w / (t * camera.aspect));
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
new ResizeObserver(resize).observe(stage);

// ---------------- görünümler ----------------
const VIEWS = {
  iso: { theta: -50, phi: 66 },
  front: { theta: 0, phi: 90 },
  top: { theta: 0, phi: 0.05 },
  bottom: { theta: 0, phi: 179.95 },
};
const viewBtns = [...document.querySelectorAll('[data-view]')];
let tween = null;

function sphericalNow() {
  return new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
}

function goTo(view) {
  const from = sphericalNow();
  const to = view
    ? new THREE.Spherical(fitDistance(), THREE.MathUtils.degToRad(view.phi), THREE.MathUtils.degToRad(view.theta))
    : new THREE.Spherical(fitDistance(), from.phi, from.theta);
  let dTheta = (to.theta - from.theta) % (2 * Math.PI);
  if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
  if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  tween = { from, to, dTheta, target: controls.target.clone(), t0: performance.now() };
  controls.autoRotate = false;
}

function stepTween(now) {
  const t = Math.min(1, (now - tween.t0) / 700);
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const { from, to, dTheta } = tween;
  const s = new THREE.Spherical(
    lerp(from.radius, to.radius, e),
    lerp(from.phi, to.phi, e),
    from.theta + dTheta * e,
  );
  controls.target.lerpVectors(tween.target, TARGET, e);
  camera.position.setFromSpherical(s).add(controls.target);
  if (t === 1) tween = null;
}

controls.addEventListener('start', () => {
  controls.autoRotate = false;
  tween = null;
  viewBtns.forEach((b) => b.classList.remove('on'));
});

viewBtns.forEach((btn) => btn.addEventListener('click', () => {
  viewBtns.forEach((b) => b.classList.toggle('on', b === btn));
  goTo(VIEWS[btn.dataset.view]);
}));

// ---------------- teknik çizim katmanı ----------------
const annot = new THREE.Group();
const labels = [];
const techColor = 0x8ccfff;
const techMat = new THREE.LineBasicMaterial({ color: techColor, transparent: true, opacity: 0.9 });
const dashMat = new THREE.LineDashedMaterial({ color: techColor, dashSize: 5, gapSize: 2.5, transparent: true, opacity: 0.7 });
const arrowGeo = new THREE.ConeGeometry(0.9, 3.4, 12);
const arrowMat = new THREE.MeshBasicMaterial({ color: techColor });
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));

function line(points, mat = techMat) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v3)), mat);
  if (mat.isLineDashedMaterial) l.computeLineDistances();
  annot.add(l);
}

function arrow(tip, from) {
  const a = v3(tip);
  const dir = a.clone().sub(v3(from)).normalize();
  const m = new THREE.Mesh(arrowGeo, arrowMat);
  m.quaternion.setFromUnitVectors(Y, dir);
  m.position.copy(a).addScaledVector(dir, -1.7);
  annot.add(m);
}

function label(html, at, cls = 'tag') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  const o = new CSS2DObject(el);
  o.position.copy(v3(at));
  annot.add(o);
  labels.push(o);
}

function dim(x, y0, y1, text) {
  line([[x, y0, 0], [x, y1, 0]]);
  arrow([x, y0, 0], [x, y1, 0]);
  arrow([x, y1, 0], [x, y0, 0]);
  label(text, [x + 5, (y0 + y1) / 2, 0], 'dimtag');
}

function ext(y, x0, x1) {
  line([[x0, y, 0], [x1, y, 0]]);
}

function ring(y, r) {
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  line(pts, dashMat);
}

function callout(at, to, title, sub) {
  line([at, to]);
  label(`<b>${title}</b><span>${sub}</span>`, to);
}

function buildAnnotations() {
  const rT = TOP_THREAD.major / 2;
  const d45 = Math.SQRT1_2;

  // eksenler
  line([[0, -14, 0], [0, TOP + 16, 0]], dashMat);
  for (const p of PORTS) {
    line([[0, p.y, 0], p.dir.clone().multiplyScalar(p.face + 16).setY(p.y)], dashMat);
  }

  // seviyeler
  for (const [y, n] of [[LEVEL1, 1], [LEVEL2, 2]]) {
    ring(y, BODY_R + 5);
    label(`SEVİYE ${n}`, [(BODY_R + 10) * d45, y, (BODY_R + 10) * d45], 'lvl');
  }

  // yükseklik ölçüleri (boş olan +X tarafında)
  const [x0, x1, x2, x3] = [15, 28, 40, 54].map((d) => BODY_R + d);
  ext(TOP, rT + 1, x3 + 4);
  ext(BODY_Y[1], BODY_R + 1, x0 + 4);
  ext(LEVEL1, BODY_R + 1, x1 + 4);
  ext(LEVEL2, BODY_R + 1, x2 + 4);
  ext(BODY_Y[0], BODY_R + 1, x0 + 4);
  ext(0, rT + 1, x3 + 4);
  dim(x0, BODY_Y[1], TOP, 'L1');
  dim(x0, 0, BODY_Y[0], 'L2');
  dim(x1, LEVEL1, TOP, 'H1');
  dim(x2, LEVEL2, TOP, 'H2');
  dim(x3, 0, TOP, 'H');

  // açıklamalar: seviye 1 etiketleri yukarı, seviye 2 aşağı
  for (const p of PORTS) {
    const up = p.level === 1 ? 1 : -1;
    const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x).multiplyScalar(12 * up);
    const at = p.dir.clone().multiplyScalar(p.face).setY(p.y + up * p.bossR);
    const to = p.dir.clone().multiplyScalar(p.face + 20).add(side).setY(p.y + up * 32);
    callout(at, to, `${p.id} · ${p.size}″ iç diş`, `Seviye ${p.level}`);
  }
  const { ust, alt } = SPEC.uclar;
  callout([0, TOP - 6, rT], [-26, TOP + 16, 44], `${sizeOf(ust.dis)}″ dış diş`, `Üst uç · ${ust.sizdirmazlik}`);
  callout([0, 8, rT], [24, -16, 44], `${sizeOf(alt.dis)}″ dış diş`, `Alt uç · ${alt.sizdirmazlik}`);
}

// Gövdenin arkasında kalan etiketleri gizler (gövde ≈ BODY_R yarıçaplı silindir)
function hideOccludedLabels() {
  const c = camera.position;
  for (const l of labels) {
    const a = l.position;
    const dx = a.x - c.x;
    const dz = a.z - c.z;
    const qa = dx * dx + dz * dz;
    const qb = 2 * (c.x * dx + c.z * dz);
    const qc = c.x * c.x + c.z * c.z - BODY_R * BODY_R;
    const disc = qb * qb - 4 * qa * qc;
    let hidden = false;
    if (qa > 1e-6 && disc > 0) {
      const t = (-qb - Math.sqrt(disc)) / (2 * qa);
      const y = c.y + t * (a.y - c.y);
      hidden = t > 0 && t < 1 && y > 0 && y < TOP;
    }
    l.visible = !hidden;
  }
}

function setTech(on, { refit = true } = {}) {
  app.classList.toggle('tech', on);
  techBtn.setAttribute('aria-checked', String(on));
  sheet.setAttribute('aria-hidden', String(!on));
  annot.visible = on;
  labels.forEach((l) => { l.visible = on; });
  history.replaceState(null, '', on ? '#teknik' : location.pathname + location.search);
  if (refit) setTimeout(() => goTo(null), 320);
}

techBtn.addEventListener('click', () => setTech(techBtn.getAttribute('aria-checked') !== 'true'));
window.addEventListener('keydown', (e) => {
  if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) techBtn.click();
});

// ---------------- kurulum ----------------
await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));

try {
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8b868, metalness: 1, roughness: 0.3 });

  const part = new THREE.Group();
  part.add(new THREE.Mesh(buildBody(), brass));
  part.add(threadedEnd(TOP_THREAD, L1, BODY_Y[1], false, brass));
  part.add(threadedEnd(BOTTOM_THREAD, L2, 0, true, brass, /^R/.test(SPEC.uclar.alt.dis)));
  for (const p of PORTS) {
    const m = new THREE.Mesh(internalThread(BSP[p.size], p.depth - 1.6), brass);
    m.quaternion.setFromUnitVectors(Y, p.dir.clone().negate());
    m.position.copy(p.dir).multiplyScalar(p.face - 1).setY(p.y);
    part.add(m);
  }
  scene.add(part, contactShadow());

  buildAnnotations();
  scene.add(annot);
  const techAtStart = location.hash === '#teknik';
  setTech(techAtStart, { refit: techAtStart });

  const start = VIEWS.iso;
  camera.position
    .setFromSpherical(new THREE.Spherical(fitDistance(), THREE.MathUtils.degToRad(start.phi), THREE.MathUtils.degToRad(start.theta)))
    .add(TARGET);

  renderer.setAnimationLoop((now) => {
    if (tween) stepTween(now);
    controls.update();
    if (annot.visible) hideOccludedLabels();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });
  loading.remove();
} catch (err) {
  console.error(err);
  loading.textContent = `Model yüklenemedi: ${err.message}`;
  loading.classList.add('err');
}
