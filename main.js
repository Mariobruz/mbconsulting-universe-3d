/* MB Consulting — Universe 3D · scena e interazioni */
const THREE = window.THREE;
const S = window.SHADERS;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
let mobile = innerWidth < 800;
// dispositivi touch / poco potenti: meno particelle e risoluzione più bassa
const lowPower = mobile || matchMedia('(pointer: coarse)').matches;

/* =========================================================
   RENDERER
   ========================================================= */
const canvas = $('#webgl');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
const uScale = { value: 1 };
const uTime = { value: 0 };

let maxDpr = 2;          // abbassato automaticamente se il dispositivo fatica
function sizeRenderer() {
  mobile = innerWidth < 800;
  if (!renderer) return;
  const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 1.75, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  uScale.value = dpr * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
if (renderer) renderer.setClearColor(0x05080c, 1);
sizeRenderer();

const additive = (vertexShader, fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra
});

/* =========================================================
   STELLE + WARP
   ========================================================= */
function makeStars() {
  const n = lowPower ? 1400 : 5200;
  const pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = 45 + Math.random() * 120;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 50;
    size[i] = 0.12 + Math.pow(Math.random(), 4) * 0.55;
    phase[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const pts = new THREE.Points(g, additive(S.starsVert, S.starsFrag, { uTime, uScale }));
  pts.frustumCulled = false;
  return pts;
}
const stars = makeStars();
scene.add(stars);

function makeWarp() {
  const n = lowPower ? 140 : 520;
  const pos = new Float32Array(n * 6), end = new Float32Array(n * 2), z = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.2 + Math.pow(Math.random(), 0.6) * 26;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75, zz = Math.random() * 140;
    pos.set([x, y, 0, x, y, 0], i * 6);
    end.set([0, 1], i * 2); z.set([zz, zz], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  g.setAttribute('aZ', new THREE.BufferAttribute(z, 1));
  const m = additive(S.warpVert, S.warpFrag, { uTime, uLen: { value: 6 }, uSpeed: { value: 40 }, uWarp: { value: 0 } });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return l;
}
const warp = makeWarp();
camera.add(warp);
scene.add(camera);

/* =========================================================
   PIANETA DI GHIACCIO
   ========================================================= */
function makePlanet(detail = 3, withShell = true) {
  const group = new THREE.Group();
  const crystalMat = new THREE.ShaderMaterial({
    vertexShader: S.crystalVert, fragmentShader: S.crystalFrag,
    uniforms: { uTime, uAmp: { value: 0.13 }, uGlow: { value: 1 }, uMouse: { value: new THREE.Vector3(99, 99, 99) }, uMouseStr: { value: 0 }, uMorph: { value: 0 } }
  });
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, detail), crystalMat);
  group.add(crystal);

  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.95, 64, 48), additive(S.haloVert, S.haloFrag,
    { uColor: { value: new THREE.Color(0x3fa6e8) }, uPower: { value: 3.2 }, uOpacity: { value: 0.75 } }, { side: THREE.BackSide }));
  group.add(halo);

  let shell = null;
  if (withShell) {
    const n = lowPower ? 2600 : 7800;
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const R = 2.3 + (Math.random() - 0.5) * 0.06;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    shell = new THREE.Points(g, additive(S.shellVert, S.shellFrag, {
      uTime, uScale, uMouse: { value: new THREE.Vector3(99, 99, 99) }, uMouseStr: { value: 0 }, uSpeed: { value: 0 },
      uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 1 }
    }));
    shell.frustumCulled = false;
    group.add(shell);
  }

  // anelli orbitali di polvere
  const rings = new THREE.Group();
  [[3.2, 0.32, 900], [3.75, 0.4, 700], [4.35, 0.5, 500]].forEach(([R, squash, n0], k) => {
    const n = lowPower ? Math.round(n0 * 0.45) : n0;
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, j = (Math.random() - 0.5) * 0.12;
      pos.set([Math.cos(a) * (R + j), (Math.random() - 0.5) * 0.04, Math.sin(a) * (R + j)], i * 3);
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    const p = new THREE.Points(g, additive(S.dustVert, S.dustFrag, {
      uTime, uScale, uColor: { value: new THREE.Color(k === 1 ? 0xc9ecff : 0x8fd3ff) }, uOpacity: { value: 0.8 }
    }));
    p.frustumCulled = false;
    p.rotation.set(1.2 + k * 0.08, 0, -0.38 + k * 0.05);
    p.userData.speed = 0.04 + k * 0.025;
    rings.add(p);
  });
  group.add(rings);
  return { group, crystal, crystalMat, halo, shell, rings };
}
const planet = makePlanet(3, true);
scene.add(planet.group);
// nucleo più piccolo dentro il guscio di particelle
planet.crystal.scale.setScalar(0.4);
planet.halo.scale.setScalar(0.45);
const fluid = { speed: 0, spin: 0, lastX: 0, lastY: 0, tiltX: 0, tiltZ: 0 };

// il "prossimo mondo" all'orizzonte (sezione contatti)
const nextWorld = makePlanet(2, false);
nextWorld.group.position.set(6, 0.5, -128);
nextWorld.group.scale.setScalar(3.4);
let nextWorldScale = 3.4;
/* su schermi verticali (cellulare) il pianeta finale va al centro e un po' più piccolo */
function placeNextWorld() {
  const portrait = innerWidth / innerHeight < 0.85;
  nextWorld.group.position.x = portrait ? 3 : 6;
  nextWorldScale = portrait ? 2.9 : 3.4;
}
placeNextWorld();
nextWorld.halo.material.uniforms.uColor.value.set(0x7fd0ff);
scene.add(nextWorld.group);

/* =========================================================
   MARE (territorio)
   ========================================================= */
function makeSea() {
  const geo = new THREE.PlaneGeometry(110, 80, lowPower ? 80 : 200, lowPower ? 60 : 150);
  geo.rotateX(-Math.PI / 2);
  const m = additive(S.seaVert, S.seaFrag, { uTime, uScale, uOpacity: { value: 0 } });
  const sea = new THREE.Points(geo, m);
  sea.position.set(0, -9, -18);
  sea.frustumCulled = false;
  return sea;
}
const sea = makeSea();
scene.add(sea);
const moon = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), additive(S.glowVert, S.sunFrag,
  { uTime, uOpacity: { value: 0 } }));   // il sole della sezione Territorio
moon.position.set(0, -5, -125);   // sole lontano, all'orizzonte
scene.add(moon);

/* =========================================================
   ANELLI DEL PERCORSO (approccio)
   ========================================================= */
const RING_Z = [-18, -28, -38];
/* la foto del dittico in 3D: meta finale del viaggio negli anelli */
const PHOTO_Z = -80, PHOTO_W = 4;
const photoUniforms = {
  uTex: { value: null }, uImgAspect: { value: window.PHOTO_ASPECT || 1.685 }, uPlaneAspect: { value: window.PHOTO_ASPECT || 1.685 },
  uAlpha: { value: 0 }, uFocus: { value: 1 }, uHover: { value: 0 }, uDim: { value: 0 }, uFit: { value: 0 }, uCurve: { value: 0 }, uTime
};
const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 2), new THREE.ShaderMaterial({
  vertexShader: S.cardVert, fragmentShader: S.cardFrag, uniforms: photoUniforms, transparent: true, depthWrite: false
}));
photoMesh.scale.set(PHOTO_W, PHOTO_W / (window.PHOTO_ASPECT || 1.685), 1);
photoMesh.position.set(0, 0, PHOTO_Z);
photoMesh.visible = false;
scene.add(photoMesh);
const pathRings = RING_Z.map((z, i) => {
  const m = additive(S.glowVert, S.ringFrag, { uTime, uColor: { value: new THREE.Color(0x8fd3ff) }, uOpacity: { value: 0 } }, { side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(mobile ? 2.6 : 3.4, 0.012, 6, 220), m);
  ring.position.set(0, 0, z);
  ring.rotation.z = i * 0.6;
  scene.add(ring);
  return ring;
});

/* =========================================================
   PROGETTI IN ORBITA
   ========================================================= */
let projects = [];
const cards = [];
const ringGroup = new THREE.Group();
scene.add(ringGroup);
let ringR = 6.4, cardW = 2.9, cardH = 1.93;
const PLANE_ASPECT = 1.5;
const anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;

const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);

function loadTexture(src) {
  return new Promise((resolve) => {
    if (src.endsWith('.svg') || src.startsWith('data:image/svg')) {
      manager.itemStart(src);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const w = 600, h = Math.round(600 * (img.naturalHeight || 280) / (img.naturalWidth || 200));
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const t = new THREE.CanvasTexture(c);
        manager.itemEnd(src);
        resolve({ tex: t, aspect: w / h });
      };
      img.onerror = () => { manager.itemEnd(src); resolve({ tex: null, aspect: 1.5 }); };
      img.src = src;
    } else {
      texLoader.load(src, (t) => resolve({ tex: t, aspect: t.image.width / t.image.height }),
        undefined, () => resolve({ tex: null, aspect: 1.5 }));
    }
  });
}

function buildCards() {
  const geo = new THREE.PlaneGeometry(1, 1, 24, 6);
  projects.forEach((p, i) => {
    const uniforms = {
      uTex: { value: null }, uImgAspect: { value: 1.5 }, uPlaneAspect: { value: PLANE_ASPECT },
      uAlpha: { value: 0 }, uFocus: { value: 0 }, uHover: { value: 0 }, uDim: { value: 0 }, uFit: { value: 0 },
      uCurve: { value: 0.06 }, uTime
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: S.cardVert, fragmentShader: S.cardFrag, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { index: i, angle: (i / projects.length) * Math.PI * 2, scale: 0, hover: 0, visible: true };
    ringGroup.add(mesh);
    cards.push(mesh);
    loadTexture((window.THUMBS && window.THUMBS[p.img]) || p.img).then(({ tex, aspect }) => {
      if (!tex) return;
      tex.anisotropy = anisotropy;
      uniforms.uTex.value = tex;
      uniforms.uImgAspect.value = aspect;
      uniforms.uFit.value = aspect < 1.1 ? 1 : 0;
    });
  });
  layoutCards();
}
function layoutCards() {
  ringR = mobile ? 4.6 : 7.9;
  cardW = mobile ? 2.25 : 2.9;
  cardH = cardW / PLANE_ASPECT;
}

/* =========================================================
   STATO UNIVERSO (filtri, focus)
   ========================================================= */
let activeFilter = 'Tutti';
let visibleList = [];             // indici dei progetti visibili
let focusSlot = 0;                // slot corrente (0..n-1)
let focusIndex = -1;              // indice progetto a fuoco
let ringRot = 0;

const indexEl = $('#project-index');
function buildIndex() {
  indexEl.replaceChildren();
  projects.forEach((p, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${p.name} <span>${String(i + 1).padStart(2, '0')}</span>`;
    b.addEventListener('click', () => goToProject(i));
    li.append(b);
    indexEl.append(li);
  });
}
function applyFilter(f) {
  activeFilter = f;
  visibleList = projects.map((p, i) => i).filter(i => f === 'Tutti' || projects[i].cat === f);
  $$('#project-index li').forEach(li => li.classList.toggle('off', !visibleList.includes(+li.dataset.index)));
  cards.forEach((c, i) => { c.userData.visible = visibleList.includes(i); });
  $('#empty').hidden = visibleList.length > 0;
  focusIndex = -1;
}
$$('[data-filter]').forEach(b => b.addEventListener('click', () => {
  $$('[data-filter]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  applyFilter(b.dataset.filter);
  const u = anchorsY[1], v = anchorsY[2];
  if (scrollY < u || scrollY > v) scrollToY(u + 2);
}));

function setFocus(i) {
  if (i === focusIndex || i == null) return;
  focusIndex = i;
  const p = projects[i];
  const lang = getLang();
  const shown = lang === 'en' ? { ...p, ...p.en } : p;
  const fc = $('#focus-card');
  $('#focus-cat').textContent = catLabel(p.cat);
  $('#focus-num').textContent = `${String(i + 1).padStart(2, '0')} / ${projects.length}`;
  $('#focus-name').textContent = p.name;
  $('#focus-tag').textContent = shown.tag;
  fc.classList.remove('swap'); void fc.offsetWidth; fc.classList.add('swap');
  $$('#project-index button').forEach((b, k) => b.classList.toggle('current', k === i));
}
function slotScrollY(slot) {
  const n = visibleList.length;
  const u = anchorsY[1], v = anchorsY[2];
  return n <= 1 ? u + 2 : u + (slot / (n - 1)) * (v - u);
}
function goToProject(i) {
  const slot = visibleList.indexOf(i);
  if (slot < 0) return;
  scrollToY(slotScrollY(slot) + 1);
}
$('#orbit-prev').addEventListener('click', () => { const s = Math.max(0, focusSlot - 1); scrollToY(slotScrollY(s) + 1); });
$('#orbit-next').addEventListener('click', () => { const s = Math.min(visibleList.length - 1, focusSlot + 1); scrollToY(slotScrollY(s) + 1); });
$('#focus-open').addEventListener('click', () => { if (focusIndex >= 0) openProject(focusIndex); });

/* =========================================================
   DIALOG PROGETTO
   ========================================================= */
const modal = $('#detail');
let lastFocus = null;
function openProject(i) {
  const p = projects[i];
  const lang = getLang();
  const shown = lang === 'en' ? { ...p, ...p.en } : p;
  lastFocus = document.activeElement;
  $('#detail-img').src = p.img;
  $('#detail-img').alt = p.name;
  $('#detail-cat').textContent = `${catLabel(p.cat)} · ${String(i + 1).padStart(2, '0')} / ${projects.length}`;
  $('#detail-name').textContent = p.name;
  const desc = $('#detail-desc');
  desc.replaceChildren(...shown.desc.split(/\n\s*\n/).map(t => { const el = document.createElement('p'); el.textContent = t.trim(); return el; }));
  const cta = $('#detail-cta');
  cta.href = '#contatti';
  cta.dataset.project = p.name;
  const pg = $('#detail-page'); if (pg && window.APP_SLUGS[p.name]) pg.href = (getLang() === 'en' ? 'en/app/' : 'app/') + window.APP_SLUGS[p.name];
  cta.querySelector('span').textContent = t('js.talk');
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.classList.add('modal-open');
  if (!modal.open) { modal.showModal(); modal.dataset.shownAt = performance.now(); }
  modal.dataset.index = i;
  modal.scrollTop = 0;
}

/* =========================================================
   SWIPE (cellulare): destra/sinistra per cambiare progetto
   ========================================================= */
function onSwipe(el, handler, ignoreSel) {
  let s = null;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches.length === 1 ? e.touches[0] : null;
    s = t && !(ignoreSel && e.target.closest(ignoreSel)) ? { x: t.clientX, y: t.clientY, time: performance.now() } : null;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const st = s; s = null;
    const t = e.changedTouches[0];
    if (!st || !t) return;
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4 || performance.now() - st.time > 900) return;
    handler(dx < 0 ? 1 : -1);
  }, { passive: true });
  el.addEventListener('touchcancel', () => { s = null; }, { passive: true });
}
/* carosello: la card successiva/precedente */
let swipeSlot = -1, swipeSlotAt = 0;
onSwipe($('#universo'), (dir) => {
  if (modal.open || ringPresence < 0.5 || !visibleList.length) return;
  const base = performance.now() - swipeSlotAt < 900 ? swipeSlot : focusSlot;   // swipe ravvicinati: si somma
  const s = clamp(base + dir, 0, visibleList.length - 1);
  swipeSlot = s; swipeSlotAt = performance.now();
  scrollToY(slotScrollY(s) + 1);
}, '.filters,.project-index');
/* scheda aperta: progetto successivo/precedente */
onSwipe(modal, (dir) => {
  const cur = visibleList.indexOf(+modal.dataset.index);
  const list = cur >= 0 ? visibleList : projects.map((p, i) => i);
  const pos = cur >= 0 ? cur : +modal.dataset.index;
  const next = pos + dir;
  if (next < 0 || next >= list.length) return;
  openProject(list[next]);
  modal.classList.remove('slide-l', 'slide-r'); void modal.offsetWidth;
  modal.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
  if (visibleList.includes(list[next])) goToProject(list[next]);
}, '#detail-cta,#close');
$('#close').addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal && performance.now() - (+modal.dataset.shownAt || 0) > 450) modal.close(); });
modal.addEventListener('close', () => { document.documentElement.style.overflow = ''; document.documentElement.classList.remove('modal-open'); lastFocus?.focus?.(); });

/* =========================================================
   SCROLL → KEYFRAME CAMERA
   ========================================================= */
const ANCHORS = [['#home', 0], ['#universo', 0], ['#universo', 1], ['#territorio', 0.5], ['#approccio', 0], ['#approccio', 1], ['#competenze', 0.38], ['#contatti', 1]];
let anchorsY = ANCHORS.map(() => 0);
function measure() {
  const max = document.documentElement.scrollHeight - innerHeight;
  anchorsY = ANCHORS.map(([sel, f]) => {
    const el = $(sel);
    const top = el.getBoundingClientRect().top + scrollY;
    return clamp(top + f * (el.offsetHeight - innerHeight), 0, max);
  });
  for (let i = 1; i < anchorsY.length; i++) if (anchorsY[i] <= anchorsY[i - 1]) anchorsY[i] = anchorsY[i - 1] + 1;
  // distanza della camera dalla foto 3D perché combaci con la foto HTML al centro
  const ph = $('.cred-photo');
  const px = ph ? ph.getBoundingClientRect().width : 0;
  if (px > 0) credD = clamp(PHOTO_W * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * px), 6, 34);
  KF = keyframes();
}
let credD = 14;
function tFromScroll(s) {
  if (s <= anchorsY[0]) return 0;
  for (let i = 0; i < anchorsY.length - 1; i++) {
    if (s <= anchorsY[i + 1]) return i + (s - anchorsY[i]) / (anchorsY[i + 1] - anchorsY[i]);
  }
  return anchorsY.length - 1;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function keyframes() {
  return mobile ? [
    [V(0, -1.7, 11.5), V(0, -1.7, 0)],
    [V(0, 2.2, 14.2), V(0, -0.2, 0)],
    [V(0, 2.2, 14.2), V(0, -0.2, 0)],
    [V(0, -3.4, 7), V(0, -8.8, -16)],
    [V(0, 0, -8), V(0, 0, -60)],
    [V(0, 0, -44), V(0, 0, -100)],
    [V(0, 0, PHOTO_Z + credD), V(0, 0, PHOTO_Z)],
    [V(0, 0, -96), V(3, 0.4, -128)]
  ] : [
    [V(-2.4, 0.25, 9.8), V(-2.4, 0.1, 0)],
    [V(0, 2.6, 18.2), V(0, -0.9, 0)],
    [V(0, 2.6, 18.2), V(0, -0.9, 0)],
    [V(0, -3.2, 7), V(0, -8.6, -16)],
    [V(0, 0, -8), V(0, 0, -60)],
    [V(0, 0, -44), V(0, 0, -100)],
    [V(0, 0, PHOTO_Z + credD), V(0, 0, PHOTO_Z)],
    [V(-1, 0, -94), V(3, 0.3, -128)]
  ];
}
let KF = keyframes();

let sSmooth = 0, tSmooth = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), prevCam = new THREE.Vector3();
let lookCur = new THREE.Vector3();

let programmaticScroll = 0;
function scrollToY(y) {
  programmaticScroll = performance.now();
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

/* fine degli anelli → scorrimento automatico fino alla foto dei bimbi */
const auto = { active: false, armed: true, lastY: scrollY, raf: 0 };
function autoScrollTo(target) {
  const start = scrollY, dist = target - start;
  if (dist <= 0) return;
  const dur = clamp(dist / innerHeight * 900, 1600, 3200);
  const t0 = performance.now();
  auto.active = true;
  const step = (now) => {
    if (!auto.active) return;
    const x = clamp((now - t0) / dur);
    window.scrollTo(0, start + dist * ease(x));
    if (x < 1) auto.raf = requestAnimationFrame(step);
    else auto.active = false;
  };
  auto.raf = requestAnimationFrame(step);
}
function stopAuto() { auto.active = false; cancelAnimationFrame(auto.raf); }
addEventListener('wheel', (e) => {
  if (!auto.active) return;
  if (e.deltaY < 0) stopAuto();          // l'utente torna su: si ferma
  else e.preventDefault();               // verso il basso: lascia finire il viaggio
}, { passive: false });
addEventListener('touchstart', () => { if (auto.active) stopAuto(); }, { passive: true });
addEventListener('keydown', (e) => { if (auto.active && ['ArrowUp', 'PageUp', 'Home'].includes(e.key)) stopAuto(); });
addEventListener('scroll', () => {
  const y = scrollY, down = y > auto.lastY;
  auto.lastY = y;
  if (auto.active || reduce) return;
  const a0 = anchorsY[4], a1 = anchorsY[5], target = anchorsY[6];
  const trigger = a1 - (a1 - a0) * 0.04;
  if (y < trigger - innerHeight * 0.25) auto.armed = true;   // risalendo si riattiva
  if (y > target) auto.armed = false;
  const userScroll = performance.now() - programmaticScroll > 1800;
  if (auto.armed && down && userScroll && y >= trigger && y < target - 5) {
    auto.armed = false;
    autoScrollTo(target);
  }
}, { passive: true });
$$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const el = id.length > 1 ? $(id) : null;
  if (!el && id !== '#') return;
  e.preventDefault();
  scrollToY(el ? el.getBoundingClientRect().top + scrollY : 0);
}));

/* =========================================================
   PUNTATORE / RAYCAST / CURSORE
   ========================================================= */
const pointer = { x: 0, y: 0, nx: 0, ny: 0, sx: 0, sy: 0, active: false, moved: false };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane();
const hitPoint = new THREE.Vector3();
let hoverCard = null;
let ringPresence = 0;

addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = -(e.clientY / innerHeight) * 2 + 1;
  pointer.active = true; pointer.moved = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.active = false; });

function isUiTarget(el) { return !!el.closest('a,button,input,iframe,dialog,.filters,.project-index,.focus-card,.site-header'); }
/* il "prossimo mondo": cliccandolo si apre il modulo di contatto */
const planetSphere = new THREE.Sphere();
let planetHover = false;
function hitNextWorld(clientX, clientY) {
  if (!renderer || !nextWorld.group.visible || tSmooth < 6.25) return false;
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  nextWorld.group.getWorldPosition(planetSphere.center);
  planetSphere.radius = 1.95 * nextWorld.group.scale.x;
  return raycaster.ray.intersectsSphere(planetSphere);
}
function cardAt(clientX, clientY) {
  if (!renderer || ringPresence <= 0.6) return null;
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(cards.filter(c => c.userData.visible && c.userData.scale > 0.5), false);
  const front = hits.find(h => h.face && h.object.userData.cos > -0.1);
  return front ? front.object : null;
}
/* tocco/clic sulla scena 3D: pianeta finale -> modulo, card -> progetto */
function sceneTap(x, y, target) {
  if (!target || isUiTarget(target) || modal.open || contactDlg.open) return false;
  if (hitNextWorld(x, y)) { openContact(); return true; }
  const c = cardAt(x, y);
  if (c) { const i = c.userData.index; if (i === focusIndex) openProject(i); else goToProject(i); return true; }
  return false;
}
/* su iPhone/iPad Safari il "click" non arriva se si tocca un elemento non cliccabile:
   il tocco viene riconosciuto direttamente da touchstart/touchend */
let tapStart = null, lastTouchTap = 0;
addEventListener('touchstart', (e) => {
  const t = e.touches.length === 1 ? e.touches[0] : null;
  tapStart = t ? { x: t.clientX, y: t.clientY, time: performance.now(), sy: scrollY } : null;
}, { passive: true });
addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (tapStart && t && Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) > 12) tapStart = null;
}, { passive: true });
addEventListener('touchend', (e) => {
  const s = tapStart; tapStart = null;
  const t = e.changedTouches[0];
  if (!s || !t || e.touches.length) return;
  if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > 12 || performance.now() - s.time > 650 || Math.abs(scrollY - s.sy) > 12) return;
  if (sceneTap(t.clientX, t.clientY, e.target)) {
    lastTouchTap = performance.now();
    if (e.cancelable) e.preventDefault();   // niente "click" fantasma che richiuderebbe la finestra
  }
}, { passive: false });
addEventListener('click', (e) => {
  if (performance.now() - lastTouchTap < 800) return;
  sceneTap(e.clientX, e.clientY, e.target);
});

const cursor = $('#cursor'), cursorLabel = $('#cursor-label');
const cur = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
if (finePointer && !reduce) {
  document.documentElement.classList.add('has-cursor');
  document.addEventListener('pointerover', (e) => { cursor.classList.toggle('hover', !!e.target.closest('a,button')); });
}

// effetto magnetico
if (finePointer && !reduce) {
  $$('.round-link b, .nav-contact, .open-btn, .orbit-btn, .closing-cta b, .enter-btn').forEach(el => {
    el.classList.add('magnetic');
    const host = el.closest('a,button') || el;
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.25, dy = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${clamp(dx, -14, 14)}px,${clamp(dy, -14, 14)}px)`;
    });
    host.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* =========================================================
   UI SINCRONIZZATA ALLO SCROLL
   ========================================================= */
const railItems = $$('.rail li');
const railFill = $('#rail-fill');
const sections = $$('[data-section]');
const steps = $$('.steps li');
let currentStep = -1;
function updateUi() {
  const max = document.documentElement.scrollHeight - innerHeight;
  railFill.style.transform = `scaleY(${max > 0 ? scrollY / max : 0})`;
  const mid = innerHeight * 0.5;
  let active = sections[0].id;
  sections.forEach(s => { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) active = s.id; });
  railItems.forEach(li => li.classList.toggle('active', li.dataset.rail === active));
  // step approccio
  const a0 = anchorsY[4], a1 = anchorsY[5];
  const pa = clamp((scrollY - a0) / (a1 - a0));
  const st = scrollY < a0 - innerHeight * 0.3 ? -1 : Math.min(2, Math.floor(pa * 3));
  if (st !== currentStep) {
    currentStep = st;
    steps.forEach((li, k) => { li.classList.toggle('on', k === st); li.classList.toggle('past', st > k); });
  }
}

const io = new IntersectionObserver((entries) => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.2 });
$$('.reveal').forEach(el => io.observe(el));

/* =========================================================
   COMPETENZE: badge in orbita
   ========================================================= */
const credItems = $$('#cred-orbit li');
let credVisible = false, credAngle = 0;
new IntersectionObserver(([en]) => { credVisible = en.isIntersecting; }).observe($('#competenze'));
const credStage = $('.cred-stage');
const credEllipses = $$('#cred-path ellipse');
const CRED_TILT = -12 * Math.PI / 180;
let credHover = false, zoomOpen = false;
credStage.addEventListener('pointerenter', () => { credHover = true; });
credStage.addEventListener('pointerleave', () => { credHover = false; });
function updateCreds(dt) {
  if (!credVisible) return;
  credAngle += dt * (reduce || zoomOpen ? 0 : (credHover ? 0.05 : 0.16));
  const W = credStage.clientWidth, H = credStage.clientHeight;
  const rx = W * 0.43, ry = W * 0.285, cx = W / 2, cy = H / 2;
  const ct = Math.cos(CRED_TILT), st = Math.sin(CRED_TILT);
  credEllipses.forEach(e => {
    e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('rx', rx); e.setAttribute('ry', ry);
    e.setAttribute('transform', `rotate(${CRED_TILT * 180 / Math.PI} ${cx} ${cy})`);
  });
  const n = credItems.length;
  credItems.forEach((li, i) => {
    const a = credAngle + (i / n) * Math.PI * 2;
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    const x = cx + ex * ct - ey * st, y = cy + ex * st + ey * ct;
    const depth = Math.sin(a) * 0.5 + 0.5;          // 1 = davanti, 0 = dietro
    const s = 0.82 + 0.2 * depth;
    const size = li.offsetWidth;
    li.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px) scale(${s.toFixed(3)})`;
    li.style.zIndex = depth > 0.5 ? 3 : 1;
    li.style.filter = `brightness(${(0.78 + 0.22 * depth).toFixed(3)})`;
  });
}

/* badge ingrandito al click */
const zoom = $('#badge-zoom'), zoomImg = $('#badge-zoom-img'), zoomCap = $('#badge-zoom-cap');
let zoomFrom = null;
function openBadge(btn) {
  const img = btn.querySelector('img');
  zoomFrom = btn;
  zoomImg.src = img.src;
  zoomImg.alt = img.alt;
  zoomCap.textContent = img.alt;
  zoomOpen = true;
  zoom.hidden = false;
  document.documentElement.classList.add('modal-open');
  requestAnimationFrame(() => zoom.classList.add('show'));
  $('#badge-zoom-close').focus({ preventScroll: true });
}
function closeBadge() {
  if (zoom.hidden) return;
  zoom.classList.remove('show');
  document.documentElement.classList.remove('modal-open');
  zoomOpen = false;
  setTimeout(() => { zoom.hidden = true; }, 450);
  zoomFrom?.focus({ preventScroll: true });
}
$$('.badge-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openBadge(b); }));
zoom.addEventListener('click', closeBadge);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBadge(); });
addEventListener('wheel', () => { if (zoomOpen) closeBadge(); }, { passive: true });

/* copertina del video in 3D: si inclina col mouse e con lo scroll */
const vFrame = $('.video-frame'), terSec = $('#territorio');
const v3 = { rx: 0, ry: 0, mx: 0, my: 0, tx: 0, ty: 0, over: false };
terSec.addEventListener('pointermove', (e) => {
  const r = vFrame.getBoundingClientRect();
  v3.tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9), -1, 1);
  v3.ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.9), -1, 1);
  v3.over = true;
});
terSec.addEventListener('pointerleave', () => { v3.over = false; });
function updateVideo3D(dt) {
  if (!vFrame || vFrame.classList.contains('playing')) return;
  const r = terSec.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const prog = clamp((innerHeight - r.top) / (innerHeight + r.height));      // 0 entra, 1 esce
  const time = performance.now() / 1000;
  const idleX = reduce ? 0 : Math.sin(time * 0.6) * 0.25, idleY = reduce ? 0 : Math.cos(time * 0.5) * 0.2;
  const tx = v3.over && finePointer ? v3.tx : idleX, ty = v3.over && finePointer ? v3.ty : idleY;
  const kk = 1 - Math.pow(0.004, dt);
  v3.mx = lerp(v3.mx, tx, kk); v3.my = lerp(v3.my, ty, kk);
  const scrollTilt = reduce ? 0 : (0.5 - prog) * 22;                        // ruota mentre entra/esce
  v3.ry = v3.mx * 12 - scrollTilt * 0.6;
  v3.rx = -v3.my * 9 + scrollTilt * 0.35;
  vFrame.style.setProperty('--rx', v3.rx.toFixed(2) + 'deg');
  vFrame.style.setProperty('--ry', v3.ry.toFixed(2) + 'deg');
  vFrame.style.setProperty('--mx', v3.mx.toFixed(3));
  vFrame.style.setProperty('--my', v3.my.toFixed(3));
  vFrame.style.setProperty('--px', (50 + v3.mx * 45).toFixed(1) + '%');
  vFrame.style.setProperty('--py', (50 + v3.my * 45).toFixed(1) + '%');
}

/* =========================================================
   VIDEO (caricato solo al click)
   ========================================================= */
/* Video: 1) file locale assets/il-tesoro-perduto.mp4 riprodotto nella pagina (funziona anche col doppio clic)
          2) se manca e il sito è online (http/https) → lettore YouTube incorporato
          3) se manca e il sito è aperto dal disco → YouTube non lo permette (errore 153): si apre YouTube */
const LOCAL_VIDEO = 'assets/il-tesoro-perduto.mp4';
const YT_ID = 'fTDawcAx7Dc';
function pauseMusicForVideo() { if (!music.paused) { music.pause(); musicWasOnBeforeVideo = true; } }
function resumeMusicAfterVideo() { if (musicWasOnBeforeVideo) { musicWasOnBeforeVideo = false; music.play().catch(() => {}); } }
function embedYouTube(poster) {
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
  f.title = 'Il Tesoro Perduto di Soverato — YouTube';
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.allowFullscreen = true;
  poster.closest('.video-frame').classList.add('playing');
  poster.replaceWith(f);
  pauseMusicForVideo();
  // ascolta lo stato del lettore YouTube: in pausa o finito → la musica di sottofondo riparte
  f.addEventListener('load', () => {
    const send = (o) => f.contentWindow && f.contentWindow.postMessage(JSON.stringify(o), '*');
    send({ event: 'listening', id: 'mbyt', channel: 'widget' });
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 'mbyt', channel: 'widget' });
  });
}
addEventListener('message', (e) => {
  if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin || 'http://x').hostname)) return;
  let msg; try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
  if (!msg) return;
  const state = msg.event === 'onStateChange' ? msg.info : (msg.event === 'infoDelivery' && msg.info ? msg.info.playerState : undefined);
  if (state === 1) pauseMusicForVideo();                 // in riproduzione
  else if (state === 2 || state === 0) resumeMusicAfterVideo();   // in pausa o finito
});
$('#video-poster').addEventListener('click', function () {
  const poster = this;
  const v = document.createElement('video');
  v.controls = true; v.playsInline = true; v.preload = 'auto';
  v.poster = poster.querySelector('img').src;
  let done = false;
  v.addEventListener('loadeddata', () => {
    if (done) return; done = true;
    poster.closest('.video-frame').classList.add('playing');
    poster.replaceWith(v);
    v.play().catch(() => {});
  }, { once: true });
  v.addEventListener('error', () => {
    if (done) return; done = true;
    if (location.protocol.startsWith('http')) embedYouTube(poster);
    else window.open(`https://youtu.be/${YT_ID}`, '_blank', 'noopener');
  }, { once: true });
  v.addEventListener('play', pauseMusicForVideo);
  v.addEventListener('pause', resumeMusicAfterVideo);
  v.addEventListener('ended', resumeMusicAfterVideo);
  v.src = LOCAL_VIDEO;
  v.load();
});

/* =========================================================
   MUSICA
   ========================================================= */
const music = $('#site-music');
const musicBtn = $('#music-toggle');
let musicWasOnBeforeVideo = false;
music.volume = 0.55;
function syncMusic() { musicBtn.setAttribute('aria-pressed', String(!music.paused)); }
music.addEventListener('play', syncMusic);
music.addEventListener('pause', syncMusic);
// cambio scheda / finestra ridotta: la musica si ferma e riparte al ritorno (se stava suonando)
let musicPausedByHide = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!music.paused) { music.pause(); musicPausedByHide = true; }
  } else if (musicPausedByHide) {
    musicPausedByHide = false;
    music.play().catch(() => {});
  }
});
addEventListener('pagehide', () => { music.pause(); });
musicBtn.addEventListener('click', () => {
  if (music.paused) { music.play().catch(() => {}); try { localStorage.setItem('mb3d-music', 'on'); } catch (e) {} }
  else { music.pause(); try { localStorage.setItem('mb3d-music', 'off'); } catch (e) {} }
});

/* =========================================================
   LINGUA
   ========================================================= */
function splitTitle() {
  const h1 = $('.hero h1');
  const nodes = [...h1.childNodes];
  h1.replaceChildren();
  const wrap = (inner) => { const w = document.createElement('span'); w.className = 'w'; const s = document.createElement('span'); s.append(inner); w.append(s); return w; };
  let k = 0;
  nodes.forEach(n => {
    if (n.nodeType === 3) {
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { h1.append(document.createTextNode(' ')); return; }
        const w = wrap(document.createTextNode(part)); w.firstChild.style.transitionDelay = `${0.08 * k++}s`; h1.append(w);
      });
    } else if (n.nodeName === 'BR') h1.append(n);
    else { const w = wrap(n); w.firstChild.style.transitionDelay = `${0.08 * k++}s`; h1.append(w); }
  });
}
splitTitle();

/* =========================================================
   TESTO CHE REAGISCE AL MOUSE: le lettere si spostano, si inspessiscono e si illuminano
   ========================================================= */
const FX_SEL = '.hero h1, .uni-head h2, .territory-copy h2, .approach-head h2, .cred-copy h2, .closing-cta > span';
let fxLetters = [];
function splitLetters(el) {
  const walk = (node) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const wd = document.createElement('span'); wd.className = 'wd';
          [...part].forEach(ch => { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; wd.append(c); });
          frag.append(wd);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('ch') && n.nodeName !== 'BR') walk(n);
    });
  };
  walk(el);
  el.classList.add('fx');
}
function setupTextFx() {
  if (!finePointer || reduce) return;
  $$(FX_SEL).forEach(el => { if (!el.querySelector('.ch')) splitLetters(el); });
  fxLetters = $$(FX_SEL).map(el => ({
    el,
    letters: [...el.querySelectorAll('.ch')].map(c => ({ c, serif: !!c.closest('em'), f: 0, tx: 0, ty: 0, r: 0, live: false }))
  }));
}
function updateTextFx(dt) {
  if (!fxLetters.length) return;
  const R = Math.max(130, innerWidth * 0.1);
  const kk = 1 - Math.pow(0.0008, dt);
  fxLetters.forEach(group => {
    const box = group.el.getBoundingClientRect();
    const near = pointer.active && !document.documentElement.classList.contains('modal-open') &&
      pointer.x > box.left - R && pointer.x < box.right + R && pointer.y > box.top - R && pointer.y < box.bottom + R &&
      box.bottom > 0 && box.top < innerHeight;
    if (!near && !group.live) return;
    let anyLive = false;
    group.letters.forEach(L => {
      let tf = 0, ttx = 0, tty = 0, tr = 0;
      if (near) {
        const r = L.c.getBoundingClientRect();
        const dx = r.left + r.width / 2 - pointer.x, dy = r.top + r.height / 2 - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        tf = Math.max(0, 1 - dist / R); tf = tf * tf * (3 - 2 * tf);
        const push = tf * Math.min(26, r.height * 0.22);
        ttx = dx / dist * push; tty = dy / dist * push * 0.8; tr = dx / dist * tf * 9;
      }
      L.f = lerp(L.f, tf, kk); L.tx = lerp(L.tx, ttx, kk); L.ty = lerp(L.ty, tty, kk); L.r = lerp(L.r, tr, kk);
      const active = L.f > 0.003 || Math.abs(L.tx) > 0.05 || Math.abs(L.ty) > 0.05;
      if (active || L.live) {
        L.c.style.transform = active ? `translate(${L.tx.toFixed(2)}px,${L.ty.toFixed(2)}px) rotate(${L.r.toFixed(2)}deg) scale(${(1 + L.f * 0.14).toFixed(3)})` : '';
        L.c.style.setProperty('--f', active ? L.f.toFixed(3) : '0');
        if (!L.serif) L.c.style.fontVariationSettings = active ? `'wght' ${Math.round(400 + L.f * 300)}` : '';
        L.live = active;
      }
      if (active) anyLive = true;
    });
    group.live = anyLive;
  });
}
setupTextFx();
$$('[data-lang]').forEach(b => b.addEventListener('click', () => applyLanguage(b.dataset.lang)));
document.addEventListener('langchange', () => {
  splitTitle();
  setupTextFx();
  const f = focusIndex; focusIndex = -1; if (f >= 0) setFocus(f);
});
$('#year').textContent = new Date().getFullYear();

/* =========================================================
   LOADER + INGRESSO
   ========================================================= */
const loader = $('#loader');
let loadTarget = 0, loadShown = 0, loadDone = false, entered = false, introStart = 0;
manager.onProgress = (url, loaded, total) => { loadTarget = total ? loaded / total : 1; };
manager.onLoad = () => { loadTarget = 1; loadDone = true; };
/* ritorno dalla scheda completa di un'app: si riparte dallo stesso punto, senza schermata iniziale */
const RETURN_KEY = 'mb3d-return';
let restore = null;
try {
  const r = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
  sessionStorage.removeItem(RETURN_KEY);
  if (r && Date.now() - r.t < 2 * 3600e3 && !new URLSearchParams(location.search).get('contatto')) restore = r;
} catch (e) {}
/* chi è già entrato nel sito (in questa sessione del browser) non rivede più la schermata col contatore */
const ENTERED_KEY = 'mb3d-entered';
if (!restore) {
  try {
    if (sessionStorage.getItem(ENTERED_KEY)) restore = { y: null, music: localStorage.getItem('mb3d-music') === 'on', t: Date.now() };
  } catch (e) {}
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#detail-page, .footer-apps a')) return;
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ y: Math.round(scrollY), music: !music.paused, t: Date.now() })); } catch (err) {}
}, true);
setTimeout(() => { loadTarget = 1; loadDone = true; }, 9000);

function tickLoader(dt) {
  if (entered) return;
  const now = performance.now(); const realDt = Math.min(0.25, (now - (tickLoader.last || now)) / 1000); tickLoader.last = now;
  loadShown = Math.min(loadTarget, loadShown + realDt * (restore ? 6 : 1.4));
  $('#loader-pct').textContent = String(Math.round(loadShown * 100)).padStart(3, '0');
  $('#loader-bar').style.transform = `scaleX(${loadShown})`;
  if (restore && loadDone && loadShown >= 1) { $(restore.music ? '[data-enter="sound"]' : '[data-enter="silent"]').click(); return; }
  if (loadDone && loadShown >= 1 && $('#loader-enter').hidden) {
    $('#loader-enter').hidden = false;
    $('.loader-enter .enter-btn').focus({ preventScroll: true });
  }
}
$$('[data-enter]').forEach(b => b.addEventListener('click', () => {
  if (entered) return;
  entered = true;
  if (b.dataset.enter === 'sound') { music.play().catch(() => {}); try { localStorage.setItem('mb3d-music', 'on'); } catch (e) {} }
  else if (!restore) { try { localStorage.setItem('mb3d-music', 'off'); } catch (e) {} }
  try { sessionStorage.setItem(ENTERED_KEY, '1'); } catch (e) {}
  loader.classList.add('done');
  document.body.classList.remove('is-loading');
  document.body.classList.add('entered');
  introStart = performance.now();
  setTimeout(() => document.body.classList.add('revealed'), 2800);
  setTimeout(() => loader.remove(), 1300);
  if (restore) {                      // niente intro: si torna subito al punto lasciato
    if (restore.music) {               // se il browser blocca la musica, riparte al primo tocco
      const ev = ['pointerdown', 'keydown', 'touchend'];
      const resume = () => { ev.forEach(t => removeEventListener(t, resume, true)); if (music.paused) music.play().catch(() => {}); };
      ev.forEach(t => addEventListener(t, resume, true));
    }
    introStart -= 2800;
    document.body.classList.add('revealed');
    const y = restore.y;
    if (y != null) requestAnimationFrame(() => requestAnimationFrame(() => {
      programmaticScroll = performance.now();
      auto.armed = y < anchorsY[5];
      window.scrollTo({ top: y, behavior: 'instant' });
      auto.lastY = y;
    }));
  }
  if (wantContact) setTimeout(() => openContact(wantContact === '1' ? undefined : wantContact), restore ? 300 : 1500);
}));
/* arrivo da una pagina applicazione: ?contatto=Nome apre il modulo con il progetto già scelto */
const wantContact = (() => { try { return new URLSearchParams(location.search).get('contatto'); } catch (e) { return null; } })();
/* pagine applicazione: indirizzi e link nel piè di pagina secondo la lingua */
window.APP_SLUGS = {"Ciakstream": "ciakstream", "Crypto Oracle v2": "crypto-oracle", "Equilibrium": "equilibrium", "FlexPay": "flexpay", "Kinea": "kinea", "LawKey": "lawkey", "Lumiere AI": "lumiere-ai", "Mappix": "mappix", "Pollicino": "pollicino", "Rentora": "rentora", "Scanner ISBN": "scanner-isbn", "SchermiAI": "schermiai", "Simona": "simona", "Spesa Smart": "spesa-smart", "The Mask": "the-mask"};
function updateAppLinks() {
  const pre = getLang() === 'en' ? 'en/app/' : 'app/';
  $$('[data-app]').forEach(a => { a.href = pre + a.dataset.app; });
}
document.addEventListener('langchange', updateAppLinks);
updateAppLinks();

/* scheda completa dentro il sito: si apre sopra il 3D, la musica continua,
   la X (o Indietro) chiude e si resta esattamente dove si era */
let appFrame = null;
function openAppFrame(href) {
  if (!appFrame) {
    appFrame = document.createElement('div');
    appFrame.id = 'app-frame';
    const fr = document.createElement('iframe');
    fr.title = 'Scheda applicazione';
    fr.src = href;                       // impostato prima di entrare nella pagina: nessuna voce in cronologia
    appFrame.append(fr);
    document.body.append(appFrame);
  } else {
    try { appFrame.querySelector('iframe').contentWindow.location.replace(href); }   // replace: niente cronologia
    catch (e) { appFrame.querySelector('iframe').src = href; }
  }
  const f = appFrame.querySelector('iframe');
  if (modal.open) modal.close();
  appFrameOpen = true;
  document.documentElement.style.overflow = 'hidden';
  appFrame.classList.remove('out'); void appFrame.offsetWidth; appFrame.classList.add('in');
  try { history.pushState({ appFrame: 1 }, ''); } catch (e) {}
  setTimeout(() => { try { f.focus(); } catch (e) {} }, 300);
}
function closeAppFrame(opts) {
  if (!appFrameOpen) return;
  const fromPop = opts === true;
  const contact = opts && opts.contact;
  appFrameOpen = false;
  document.documentElement.style.overflow = '';
  appFrame.classList.remove('in'); appFrame.classList.add('out');
  setTimeout(() => {
    if (appFrameOpen) return;
    try { appFrame.querySelector('iframe').contentWindow.location.replace('about:blank'); } catch (e) {}
  }, 450);
  if (!fromPop && history.state && history.state.appFrame) { try { history.back(); } catch (e) {} }
  if (contact) setTimeout(() => openContact(contact === '1' ? undefined : contact), 420);
}
window.openAppFrame = openAppFrame;
window.closeAppFrame = closeAppFrame;
addEventListener('popstate', () => { if (appFrameOpen) closeAppFrame(true); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && appFrameOpen) closeAppFrame(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('#detail-page, .footer-apps a');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
  e.preventDefault();
  try { sessionStorage.removeItem(RETURN_KEY); } catch (err) {}   // il riquadro non ricarica il sito: niente ripristino
  openAppFrame(a.href);
});

/* =========================================================
   CARICAMENTO DATI
   ========================================================= */
(function initProjects() {
  projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  $('#count-all').textContent = projects.length;
  buildIndex();
  buildCards();
  applyFilter('Tutti');
  if (visibleList.length) setFocus(visibleList[0]);
  if (!projects.length) { loadTarget = 1; loadDone = true; }
})();

/* =========================================================
   LOOP
   ========================================================= */
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const parallax = { x: 0, y: 0 };

const perf = { frames: 0, time: 0, checks: 0 };
function watchPerformance(rawDt) {
  if (!entered || perf.checks >= 3 || document.hidden) return;
  perf.frames++; perf.time += rawDt;
  if (perf.time < 2) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0; perf.time = 0; perf.checks++;
  if (fps < 45 && renderer && renderer.getPixelRatio() > 1) {      // troppo lento: meno pixel
    maxDpr = Math.max(1, renderer.getPixelRatio() - 0.35);
    sizeRenderer();
    document.documentElement.classList.add('lite');
  } else if (fps < 30) document.documentElement.classList.add('lite');
}
let appFrameOpen = false;          // scheda completa aperta sopra il 3D: niente rendering inutile
function frame() {
  requestAnimationFrame(frame);
  if (appFrameOpen) { clock.getDelta(); return; }
  const rawDt = clock.getDelta();
  watchPerformance(rawDt);
  const dt = Math.min(rawDt, 0.05);
  const k = 1 - Math.pow(0.001, dt);       // fattore di smorzamento indipendente dal frame-rate
  uTime.value += dt;
  tickLoader(dt);
  updateCreds(dt);
  updateVideo3D(dt);
  updateTextFx(dt);

  // cursore
  if (finePointer && !reduce) {
    cur.x = pointer.x; cur.y = pointer.y;
    cur.rx = lerp(cur.rx, cur.x, 1 - Math.pow(0.00002, dt));
    cur.ry = lerp(cur.ry, cur.y, 1 - Math.pow(0.00002, dt));
    $('.c-dot').style.transform = `translate(${cur.x}px,${cur.y}px)`;
    $('.c-ring').style.transform = `translate(${cur.rx}px,${cur.ry}px)`;
  }

  updateUi();
  if (!renderer) return;

  // scroll smussato → t
  sSmooth = reduce ? scrollY : lerp(sSmooth, scrollY, 1 - Math.pow(0.0004, dt));
  const t = tFromScroll(sSmooth);
  tSmooth = t;
  const i0 = Math.min(KF.length - 2, Math.floor(t)), f = ease(clamp(t - i0));
  camPos.lerpVectors(KF[i0][0], KF[i0 + 1][0], f);
  camLook.lerpVectors(KF[i0][1], KF[i0 + 1][1], f);

  // intro (volo d'ingresso)
  let intro = 1;
  if (!reduce) intro = entered ? clamp((performance.now() - introStart) / 2800) : 0;
  const ie = 1 - Math.pow(1 - intro, 3);
  camPos.z += (1 - ie) * 26;
  camPos.y += (1 - ie) * 3;

  // parallasse col puntatore
  if (!reduce) {
    parallax.x = lerp(parallax.x, pointer.active ? pointer.nx : 0, k * 0.6);
    parallax.y = lerp(parallax.y, pointer.active ? pointer.ny : 0, k * 0.6);
  }
  const pFree = 1 - smooth(5.3, 5.85, t) * (1 - smooth(6.15, 6.6, t));
  camPos.x += parallax.x * 0.45 * pFree; camPos.y += parallax.y * 0.3 * pFree;
  camera.position.copy(camPos);
  lookCur.lerp(camLook, intro < 1 ? 1 : k * 1.4);
  camera.lookAt(lookCur.x + parallax.x * 0.25 * pFree, lookCur.y + parallax.y * 0.15 * pFree, lookCur.z);

  // warp in base alla velocità della camera + sezione finale
  const vel = camera.position.distanceTo(prevCam) / Math.max(dt, 0.001);
  prevCam.copy(camera.position);
  const wTarget = clamp(vel / 28) * 0.9 * (1 - smooth(5.6, 5.95, t) * (1 - smooth(6.1, 6.4, t))) + smooth(6.3, 7, t) * 0.55;
  const wu = warp.material.uniforms;
  wu.uWarp.value = lerp(wu.uWarp.value, reduce ? 0 : wTarget, k * 0.5);
  wu.uLen.value = 2 + wu.uWarp.value * 10;
  wu.uSpeed.value = 18 + wu.uWarp.value * 70;

  // pianeta
  const planetScale = (mobile ? 0.82 : 1) * lerp(1, 0.62, smooth(0.2, 1, t)) * (0.05 + 0.95 * ie);
  planet.group.scale.setScalar(planetScale);
  // fluidità: velocità del mouse → rotazione, deformazione, onde
  const pdx = pointer.nx - fluid.lastX, pdy = pointer.ny - fluid.lastY;
  fluid.lastX = pointer.nx; fluid.lastY = pointer.ny;
  const inst = (pointer.active && t < 0.9) ? Math.min(1, Math.hypot(pdx, pdy) / Math.max(dt, 0.001) / 3) : 0;
  fluid.speed = lerp(fluid.speed, inst, inst > fluid.speed ? 1 - Math.pow(0.02, dt) : 1 - Math.pow(0.35, dt));
  fluid.spin = lerp(fluid.spin, (pointer.active && t < 0.9 ? pdx / Math.max(dt, 0.001) : 0) * 0.9, 1 - Math.pow(0.08, dt));
  fluid.tiltX = lerp(fluid.tiltX, -parallax.y * 0.35, 1 - Math.pow(0.05, dt));
  fluid.tiltZ = lerp(fluid.tiltZ, -parallax.x * 0.18, 1 - Math.pow(0.05, dt));
  planet.group.rotation.y += dt * (0.08 + fluid.spin);
  planet.crystal.rotation.x += dt * (0.03 + fluid.speed * 0.6);
  planet.crystal.rotation.z += dt * fluid.spin * 0.5;
  planet.group.rotation.x = fluid.tiltX;
  planet.group.rotation.z = fluid.tiltZ;
  planet.rings.children.forEach((r, i) => { r.rotation.y += dt * r.userData.speed * (1 + fluid.speed * 6 + Math.abs(fluid.spin) * 3); r.rotation.x = 1.2 + i * 0.08 + parallax.y * 0.25 * (i + 1) * 0.5; });
  planet.crystalMat.uniforms.uGlow.value = 0.9 + 0.1 * Math.sin(uTime.value * 0.8);

  // interazione mouse con il guscio
  const su = planet.shell.material.uniforms;
  let strTarget = 0;
  if (pointer.active && finePointer && t < 0.9) {
    ndc.set(pointer.nx, pointer.ny);
    raycaster.setFromCamera(ndc, camera);
    camera.getWorldDirection(tmpV);
    plane.setFromNormalAndCoplanarPoint(tmpV.negate(), planet.group.position);
    if (raycaster.ray.intersectPlane(plane, hitPoint)) {
      su.uMouse.value.lerp(hitPoint, 1 - Math.pow(0.0001, dt));
      strTarget = 1;
    }
  }
  su.uMouseStr.value = lerp(su.uMouseStr.value, strTarget, k * 0.35);
  su.uSpeed.value = fluid.speed;
  const cu = planet.crystalMat.uniforms;
  cu.uMouse.value.copy(su.uMouse.value);
  cu.uMouseStr.value = su.uMouseStr.value;
  cu.uMorph.value = lerp(cu.uMorph.value, strTarget * 0.35 + fluid.speed * 0.9, 1 - Math.pow(0.05, dt));
  planet.halo.material.uniforms.uOpacity.value = 0.75 + su.uMouseStr.value * 0.35 + fluid.speed * 0.4;
  su.uCenter.value.copy(planet.group.position);

  // foto 3D (meta degli anelli) e passaggio alla foto HTML con i badge
  const photoIn = smooth(5.0, 5.4, t);   // la foto compare solo a fine corsa, dopo gli anelli
  const htmlIn = smooth(5.84, 5.97, t);
  photoUniforms.uAlpha.value = photoIn * (1 - htmlIn);
  photoMesh.visible = photoUniforms.uAlpha.value > 0.002;
  if (!photoUniforms.uTex.value && window.PHOTO_THUMB && !photoMesh.userData.loading) {
    photoMesh.userData.loading = true;
    loadTexture(window.PHOTO_THUMB).then(({ tex }) => { if (tex) { tex.anisotropy = anisotropy; photoUniforms.uTex.value = tex; } });
  }
  credStage.style.opacity = htmlIn.toFixed(3);
  credStage.style.pointerEvents = htmlIn > 0.5 ? 'auto' : 'none';

  // mondo successivo
  nextWorld.group.rotation.y += dt * 0.05;
  nextWorld.group.visible = t > 6.1;
  nextWorld.group.scale.setScalar(nextWorldScale * (0.2 + 0.8 * smooth(6.1, 6.8, t)));
  const ph = pointer.active && !modal.open && !contactDlg.open && hitNextWorld(pointer.x, pointer.y);
  if (ph !== planetHover) {
    planetHover = ph;
    document.documentElement.classList.toggle('planet-hover', ph);
    if (finePointer) { cursor.classList.toggle('label', ph); cursorLabel.textContent = ph ? t_('cf.planet') : ''; }
  }
  nextWorld.group.userData.hover = lerp(nextWorld.group.userData.hover || 0, ph ? 1 : 0, 1 - Math.pow(0.002, dt));
  const pulse = 1 + 0.025 * Math.sin(uTime.value * 2.2) + nextWorld.group.userData.hover * 0.06;
  nextWorld.group.scale.multiplyScalar(pulse);
  nextWorld.group.rotation.y += dt * nextWorld.group.userData.hover * 0.6;
  nextWorld.halo.material.uniforms.uOpacity.value = 0.75 + 0.25 * Math.sin(uTime.value * 2.2) + nextWorld.group.userData.hover * 0.6;
  nextWorld.crystalMat.uniforms.uGlow.value = (0.6 + 0.6 * smooth(6.1, 7, t)) * (1 + nextWorld.group.userData.hover * 0.35);

  // mare + luna
  const seaP = smooth(1.9, 2.9, t) * (1 - smooth(4.6, 5.6, t) * 0.6);
  sea.material.uniforms.uOpacity.value = seaP;
  moon.material.uniforms.uOpacity.value = (mobile ? 0.65 : 1) * smooth(1.9, 2.9, t) * (1 - smooth(3.15, 3.8, t));
  moon.lookAt(camera.position);

  // anelli del percorso
  pathRings.forEach((r, i) => {
    const d = Math.abs(camera.position.z - r.position.z);
    const near = smooth(22, 3, d);
    r.material.uniforms.uOpacity.value = smooth(3.3, 4.1, t) * (1 - smooth(5.6, 6.2, t)) * (0.25 + near * 1.2) * (i === currentStep ? 1.3 : 0.8);
    r.rotation.z += dt * (0.05 + i * 0.03);
    r.scale.setScalar(1 + near * 0.06 * Math.sin(uTime.value * 2 + i));
  });

  // stelle
  stars.rotation.y += dt * 0.006;

  // anello dei progetti
  updateRing(dt, k, t);

  renderer.render(scene, camera);
}

function updateRing(dt, k, t) {
  ringPresence = smooth(0.35, 0.95, t) * (1 - smooth(2.1, 2.7, t));
  ringGroup.visible = ringPresence > 0.002 && cards.length > 0;
  if (!cards.length) return;
  const n = Math.max(1, visibleList.length);
  const u = anchorsY[1], v = anchorsY[2];
  const p = clamp((sSmooth - u) / Math.max(1, v - u));
  const focusFloat = n > 1 ? p * (n - 1) : 0;
  const slotNow = Math.round(focusFloat);
  if (visibleList.length) {
    focusSlot = clamp(Math.round(clamp((scrollY - u) / Math.max(1, v - u)) * (n - 1)), 0, n - 1);
    setFocus(visibleList[clamp(slotNow, 0, n - 1)]);
  }
  const step = (Math.PI * 2) / n;
  ringRot = -focusFloat * step;
  layoutCards();

  // hover via raycast
  let hit = null;
  if (pointer.active && ringPresence > 0.6 && !modal.open) {
    ndc.set(pointer.nx, pointer.ny);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(cards.filter(c => c.userData.visible && c.userData.scale > 0.5), false);
    const front = hits.find(h => h.face && h.object.userData.cos > -0.1);
    hit = front ? front.object : null;
  }
  if (hit !== hoverCard) {
    hoverCard = hit;
    if (finePointer) {
      cursor.classList.toggle('label', !!hit);
      cursorLabel.textContent = hit ? (hit.userData.index === focusIndex ? t_('js.open') : '→') : '';
    }
  }

  const bob = reduce ? 0 : 1;
  cards.forEach((c, i) => {
    const ud = c.userData;
    const slot = visibleList.indexOf(i);
    if (slot >= 0) {
      const target = slot * step;
      let diff = target - ud.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      ud.angle += diff * k * 0.9;
    }
    ud.scale = lerp(ud.scale, ud.visible ? 1 : 0, k * 0.8);
    ud.hover = lerp(ud.hover, hit === c ? 1 : 0, k * 1.2);
    const a = ud.angle + ringRot;
    const cos = Math.cos(a);
    ud.cos = cos;
    c.position.set(Math.sin(a) * ringR, Math.sin(uTime.value * 0.7 + i) * 0.08 * bob + (1 - ud.scale) * -1.5, cos * ringR);
    c.rotation.set(0, a, 0);
    c.scale.set(cardW * ud.scale, cardH * ud.scale, 1);
    c.visible = ud.scale > 0.01;
    const un = c.material.uniforms;
    const focus = smooth(0.55, 1, cos);
    un.uFocus.value = focus;
    un.uHover.value = ud.hover;
    un.uDim.value = lerp(un.uDim.value, 0, k);
    un.uAlpha.value = ringPresence * (0.1 + 0.9 * smooth(-0.6, 0.6, cos));
  });
  ringGroup.rotation.y = 0;
}
const t_ = (key) => window.t(key);

/* =========================================================
   AVVIO
   ========================================================= */
function onResize() {
  sizeRenderer();
  placeNextWorld();
  KF = keyframes();
  measure();
}
addEventListener('resize', onResize);
addEventListener('load', measure);
document.fonts?.ready.then(measure);
measure();
sSmooth = scrollY;
if (renderer) { camera.position.copy(KF[0][0]); lookCur.copy(KF[0][1]); prevCam.copy(camera.position); }
requestAnimationFrame(frame);

// accesso debug per test (non usato dal sito)
window.__mb3d = { get t() { return tSmooth; }, get ready() { return loadDone; }, enter: () => $('[data-enter="silent"]').click() };

/* =========================================================
   MODULO DI CONTATTO
   ========================================================= */
const form = $('#contact-form'), topicSel = $('#cf-topic'), cfStatus = $('#cf-status'), cfBtn = $('.cf-submit');
function buildTopics(selected) {
  const cur = selected ?? topicSel.value;
  const opts = [['new', t_('cf.t.new')], ...projects.map(p => ['p:' + p.name, t_('cf.t.project') + p.name]), ['consult', t_('cf.t.consult')], ['other', t_('cf.t.other')]];
  topicSel.replaceChildren(...opts.map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
  if (cur && opts.some(o => o[0] === cur)) topicSel.value = cur;
}
buildTopics('new');
document.addEventListener('langchange', () => buildTopics());
function setStatus(msg, kind = '') { cfStatus.textContent = msg; cfStatus.className = 'cf-status ' + kind; }
const contactDlg = $('#contact-dialog');
function openContact(projectName) {
  if (contactDlg.open) return;
  buildTopics(projectName ? 'p:' + projectName : undefined);
  setStatus('');
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.classList.add('modal-open');
  form.dataset.openedAt = performance.now();
  contactDlg.showModal();
  contactDlg.dataset.shownAt = performance.now();
  contactDlg.scrollTop = 0;
  if (finePointer) setTimeout(() => $('#cf-name').focus({ preventScroll: true }), 350);
}
window.openContact = openContact;
$('#cf-close').addEventListener('click', () => contactDlg.close());
contactDlg.addEventListener('click', (e) => { if (e.target === contactDlg && performance.now() - (+contactDlg.dataset.shownAt || 0) > 450) contactDlg.close(); });
contactDlg.addEventListener('close', () => { document.documentElement.style.overflow = ''; document.documentElement.classList.remove('modal-open'); });
$('#detail-cta').addEventListener('click', (e) => { e.preventDefault(); const name = e.currentTarget.dataset.project; modal.close(); setTimeout(() => openContact(name), 250); });
$('#closing-cta').addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); openContact(); });
/* appena si corregge un campo, l'avviso di errore sparisce */
form.addEventListener('input', (e) => {
  if (e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); setStatus(''); }
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (fd.get('sito_web')) return;                       // compilato solo dai bot
  if (performance.now() - (form.dataset.openedAt || 0) < 2500) return;   // inviato troppo in fretta: bot
  const data = {
    nome: String(fd.get('nome') || '').trim(),
    email: String(fd.get('email') || '').trim(),
    telefono: String(fd.get('telefono') || '').trim(),
    argomento: topicSel.selectedOptions[0]?.textContent || '',
    messaggio: String(fd.get('messaggio') || '').trim(),
    lingua: getLang(),
    inviato: new Date().toISOString()
  };
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const checks = [
    [!data.nome, 'nome', 'cf.err.name'],
    [!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email), 'email', 'cf.err.email'],
    [!data.messaggio, 'messaggio', 'cf.err.msg'],
    [!fd.get('privacy'), 'privacy', 'cf.err.privacy']
  ];
  const bad = checks.find(c => c[0]);
  if (bad) {
    const field = form.elements[bad[1]];
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    setStatus(t_(bad[2]), 'error');
    return;
  }
  const cfg = window.SITE_CONFIG || {};
  if (cfg.web3formsKey) {
    // Web3Forms: la richiesta arriva per email (destinatario impostato nel pannello Web3Forms)
    setStatus(t_('cf.sending')); cfBtn.disabled = true;
    const fdw = new FormData();
    fdw.append('access_key', cfg.web3formsKey);
    fdw.append('subject', `Nuova richiesta dal sito MB Consulting — ${data.argomento}`);
    fdw.append('from_name', 'Sito MB Consulting');
    fdw.append('Nome', data.nome);
    fdw.append('email', data.email);
    fdw.append('Telefono', data.telefono || '-');
    fdw.append('Argomento', data.argomento);
    fdw.append('Messaggio', data.messaggio);
    fdw.append('Lingua', data.lingua.toUpperCase());
    fdw.append('botcheck', '');
    try {
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Accept': 'application/json' }, body: fdw });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.message || r.status);
      form.reset(); buildTopics('new');
      setStatus(t_('cf.ok'), 'ok');
    } catch (err) {
      setStatus(t_('cf.fail').replace('{mail}', window.MB_MAIL), 'error');
    } finally { cfBtn.disabled = false; }
  } else if (cfg.contactEndpoint) {
    setStatus(t_('cf.sending')); cfBtn.disabled = true;
    try {
      const r = await fetch(cfg.contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status);
      form.reset(); buildTopics('new');
      setStatus(t_('cf.ok'), 'ok');
    } catch (err) {
      setStatus(t_('cf.fail').replace('{mail}', window.MB_MAIL), 'error');
    } finally { cfBtn.disabled = false; }
  } else {
    const subject = `[Sito MB] ${data.argomento} — ${data.nome}`;
    const body = `Nome: ${data.nome}\nEmail: ${data.email}\nTelefono: ${data.telefono || '-'}\nArgomento: ${data.argomento}\n\n${data.messaggio}`;
    location.href = `mailto:${window.MB_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus(t_('cf.mail'), 'ok');
  }
});
