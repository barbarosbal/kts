import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { lerp, makeAnnot } from 'kts/ortak';

const V = new URL(import.meta.url).search;

function contactShadow(size) {
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
    new THREE.PlaneGeometry(size, size),
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
const splitBtn = document.getElementById('split');
const sheet = document.getElementById('sheet');
const modelsMenu = document.getElementById('models');
const modelLinks = [...modelsMenu.querySelectorAll('a')];

// Model adresten seçilir (?model=rekor); geçersizse ilk model açılır
const MODEL_ID = modelLinks.find((a) => a.dataset.model === new URLSearchParams(location.search).get('model'))?.dataset.model
  ?? modelLinks[0].dataset.model;
modelLinks.forEach((a) => {
  if (a.dataset.model === MODEL_ID) a.setAttribute('aria-current', 'page');
});

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
const TARGET = new THREE.Vector3();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 70;
controls.maxDistance = 1200;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 1.2;

let model = null;
let tech = false;
let split = false;

// Parçanın (etiketlerle birlikte) kadraja sığdığı uzaklık
function fitDistance() {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const { h, w } = model.fit(tech, split);
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
  // Kullanıcı daha dokunmadıysa kadraj yeni boyuta uyar
  if (model && controls.autoRotate) camera.position.sub(controls.target).setLength(fitDistance()).add(controls.target);
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
  TARGET.y = model.fit(tech, split).y;
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
const annotJoined = makeAnnot();
const annotSplit = makeAnnot();

function showAnnot() {
  annotJoined.group.visible = tech && !split;
  annotSplit.group.visible = tech && split;
}

// Gövdenin arkasında kalan etiketleri gizler (gövde ≈ silindir)
function hideOccludedLabels() {
  const c = camera.position;
  const { r, y0, y1 } = model.occluder;
  for (const l of annotJoined.labels) {
    const a = l.position;
    const dx = a.x - c.x;
    const dz = a.z - c.z;
    const qa = dx * dx + dz * dz;
    const qb = 2 * (c.x * dx + c.z * dz);
    const qc = c.x * c.x + c.z * c.z - r * r;
    const disc = qb * qb - 4 * qa * qc;
    let hidden = false;
    if (qa > 1e-6 && disc > 0) {
      const t = (-qb - Math.sqrt(disc)) / (2 * qa);
      const y = c.y + t * (a.y - c.y);
      hidden = t > 0 && t < 1 && y > y0 && y < y1;
    }
    l.visible = !hidden;
  }
}

function setTech(on, { refit = true } = {}) {
  tech = on;
  app.classList.toggle('tech', on);
  techBtn.setAttribute('aria-checked', String(on));
  sheet.setAttribute('aria-hidden', String(!on));
  showAnnot();
  history.replaceState(null, '', on ? '#teknik' : location.pathname + location.search);
  modelLinks.forEach((a) => { a.hash = on ? 'teknik' : ''; });
  if (refit) setTimeout(() => goTo(null), 320);
}

techBtn.addEventListener('click', () => setTech(!tech));

// ---------------- birleşik / ayrık ----------------
let burst = null;
let burstE = 0;

// gecikme: önce kilit dönüşü, sonra eksen boyunca ayrılma
function applyBurst(e) {
  burstE = e;
  const a = model.gecikme ?? 0;
  const slide = Math.max(0, (e - a) / (1 - a));
  const turn = a ? Math.min(1, e / a) : e;
  for (const p of model.parcalar) {
    p.obj.position.y = p.y0 + p.ayrik * slide;
    p.obj.rotation.y = (p.donus ?? 0) * 2 * Math.PI * turn;
  }
}

function stepBurst(now) {
  const t = Math.min(1, (now - burst.t0) / 1300);
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  applyBurst(lerp(burst.from, burst.to, e));
  if (t === 1) burst = null;
}

function setSplit(on) {
  split = on;
  splitBtn.setAttribute('aria-checked', String(on));
  showAnnot();
  if (reducedMotion) applyBurst(on ? 1 : 0);
  else burst = { from: burstE, to: on ? 1 : 0, t0: performance.now() };
  goTo(null);
}

splitBtn.addEventListener('click', () => setSplit(!split));

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') techBtn.click();
  if ((e.key === 'a' || e.key === 'A') && !splitBtn.disabled) splitBtn.click();
  if (e.key === 'Escape') modelsMenu.open = false;
});

document.addEventListener('click', (e) => {
  if (!modelsMenu.contains(e.target)) modelsMenu.open = false;
});

// ---------------- kurulum ----------------
await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));

function fillPage() {
  document.title = `${model.ad} · KTS`;
  document.getElementById('model-ad').textContent = model.ad;
  document.getElementById('model-alt').textContent = model.alt;
  const pkg = document.getElementById('pkg');
  pkg.hidden = !model.paket;
  if (model.paket) pkg.href = model.paket;

  const src = `${model.cizim.src}${V}`;
  document.getElementById('sheet-rev').textContent = `Teknik çizim · Rev ${model.rev}`;
  document.getElementById('sheet-open').href = src;
  document.getElementById('sheet-link').href = src;
  const img = document.getElementById('sheet-img');
  img.src = src;
  img.alt = model.cizim.alt;

  const separable = model.parcalar.length > 1;
  splitBtn.disabled = !separable;
  splitBtn.title = separable ? 'Parçaları ayır (A)' : 'Tek parça';
}

try {
  const mod = await import(`kts/${MODEL_ID}`);
  model = mod.kur({
    brass: new THREE.MeshStandardMaterial({ color: 0xd8b868, metalness: 1, roughness: 0.3 }),
    conta: new THREE.MeshStandardMaterial({ color: 0x55665c, metalness: 0, roughness: 0.85 }),
  });
  for (const p of model.parcalar) {
    p.y0 = p.obj.position.y;
    scene.add(p.obj);
  }
  scene.add(contactShadow(model.golge ?? 150));
  fillPage();

  model.annotate(annotJoined);
  model.annotateAyrik?.(annotSplit);
  scene.add(annotJoined.group, annotSplit.group);
  const techAtStart = location.hash === '#teknik';
  setTech(techAtStart, { refit: techAtStart });

  TARGET.y = model.fit(tech, split).y;
  controls.target.copy(TARGET);
  const start = VIEWS.iso;
  camera.position
    .setFromSpherical(new THREE.Spherical(fitDistance(), THREE.MathUtils.degToRad(start.phi), THREE.MathUtils.degToRad(start.theta)))
    .add(TARGET);

  renderer.setAnimationLoop((now) => {
    if (tween) stepTween(now);
    if (burst) stepBurst(now);
    controls.update();
    if (annotJoined.group.visible) hideOccludedLabels();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });
  loading.remove();
} catch (err) {
  console.error(err);
  loading.textContent = `Model yüklenemedi: ${err.message}`;
  loading.classList.add('err');
}
