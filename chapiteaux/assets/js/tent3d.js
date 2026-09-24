/* =========================================================================
   Configurateur 3D des chapiteaux (reproduits d'après les photos).
   - 6 × 6 : travées de 3 m, 3 côtés blancs + façade à fenêtres transparentes
   - 6 × 12 : travées de 2 m, bâches à fenêtres en arcade, pignons pleins
   Chaque bâche s'enroule / se déroule au clic (dans la 3D ou sur le plan).
   ========================================================================= */
import * as THREE from "../vendor/three.module.min.js";

const TENTS = window.TENTS;
const canvas = document.getElementById("tent3d");
const viewer = document.getElementById("viewer");
const planEl = document.getElementById("plan");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 6;          // largeur (m)
const H = 2.2;        // hauteur sous gouttière
const R = 3.25;       // hauteur au faîte

const state = { size: "6x12", layout: "banquet", night: false };
let panels = [];
const people = [];      // { key, side, idx, type, open, t, pivot, hit, roll, kind }

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { renderer = null; }
if (!renderer) {
  viewer.insertAdjacentHTML("beforeend", '<p class="viewer-hint" style="top:45%">La 3D n\'est pas disponible sur cet appareil. Utilisez le plan à droite.</p>');
}

/* ------------------------------------------------------------------ */
/*  Textures de bâches (dessinées en canvas)                            */
/* ------------------------------------------------------------------ */
function panelTexture(type, bay) {
  const pxm = 128, w = Math.round(bay * pxm), h = Math.round(H * pxm);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  const white = "#F7F8FA", seam = "#DDE2EA";
  g.fillStyle = white; g.fillRect(0, 0, w, h);
  // ourlets et coutures verticales
  g.fillStyle = seam; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  g.fillRect(0, h - 10, w, 3);
  if (type === "clear") {
    // grande fenêtre rectangulaire transparente, jupe blanche en bas
    const mx = w * 0.09, top = h * 0.07, bottom = h * 0.3;
    g.clearRect(mx, top, w - 2 * mx, h - top - bottom);
    g.fillStyle = "rgba(210,225,245,.18)"; g.fillRect(mx, top, w - 2 * mx, h - top - bottom);
    g.strokeStyle = seam; g.lineWidth = 3; g.strokeRect(mx, top, w - 2 * mx, h - top - bottom);
  } else if (type === "arch") {
    // fenêtre en arcade avec croisillons (6 × 12)
    const mx = w * 0.16, ww = w - 2 * mx, r = ww / 2, top = h * 0.1, bottom = h * 0.3;
    const cx = w / 2, cy = top + r;
    const path = new Path2D();
    path.moveTo(mx, h - bottom); path.lineTo(mx, cy); path.arc(cx, cy, r, Math.PI, 0); path.lineTo(w - mx, h - bottom); path.closePath();
    g.save(); g.clip(path); g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(210,225,245,.16)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = white; g.lineWidth = 5;
    for (let i = 1; i <= 3; i++) { const x = mx + (ww * i) / 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const y0 = top, y1 = h - bottom;
    for (let i = 1; i <= 5; i++) { const y = y0 + ((y1 - y0) * i) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.restore();
    g.strokeStyle = seam; g.lineWidth = 3; g.stroke(path);
  } else {
    // bâche pleine : légères coutures horizontales
    g.fillStyle = "#EEF1F5"; g.fillRect(0, h * 0.5, w, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const texCache = {};
const panelMat = (type, bay) => {
  const k = type + bay;
  if (!texCache[k]) {
    const see = type !== "solid";
    texCache[k] = new THREE.MeshStandardMaterial({ map: panelTexture(type, bay), side: THREE.DoubleSide, roughness: 0.75, transparent: see, depthWrite: !see });
  }
  return texCache[k];
};

/* ------------------------------------------------------------------ */
/*  Scène                                                              */
/* ------------------------------------------------------------------ */
let scene, camera, tentGroup, furnGroup, lightsGroup, sun, hemi, warm = [], ground;
const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });

if (renderer) initScene();

function initScene() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdce7fb, 35, 90);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  hemi = new THREE.HemisphereLight(0xdfeaff, 0x6f8f55, 1.1);
  sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(10, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun);

  // pelouse
  const gc = document.createElement("canvas"); gc.width = gc.height = 256;
  const gg = gc.getContext("2d"); gg.fillStyle = "#7DAE62"; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { gg.fillStyle = `hsl(${95 + Math.random() * 20},${35 + Math.random() * 20}%,${36 + Math.random() * 16}%)`; gg.fillRect(Math.random() * 256, Math.random() * 256, 1, 2 + Math.random() * 2); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(18, 18); gt.colorSpace = THREE.SRGBColorSpace;
  ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  tentGroup = new THREE.Group(); furnGroup = new THREE.Group(); lightsGroup = new THREE.Group();
  scene.add(tentGroup, furnGroup, lightsGroup);

  // lumières chaudes de soirée
  for (let i = 0; i < 2; i++) { const p = new THREE.PointLight(0xffc36b, 0, 14, 1.6); p.position.set(0, 2.6, 0); warm.push(p); scene.add(p); }

  addPeople();
}

/* ------------------------------------------------------------------ */
/*  Construction du chapiteau                                          */
/* ------------------------------------------------------------------ */
const metal = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, metalness: 0.8, roughness: 0.35 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fb, roughness: 0.7, side: THREE.DoubleSide });
const gableMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.75, side: THREE.DoubleSide, transparent: true });
const rollMat = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.8 });

function beam(a, b, r = 0.035) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), metal);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

function build() {
  if (!renderer) { panels = []; buildPanelsOnly(); return; }
  tentGroup.clear(); panels = [];
  const T = TENTS[state.size], L = T.length, bay = T.bay;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- structure alu
  for (let x = -L / 2; x <= L / 2 + 1e-6; x += bay) {
    tentGroup.add(beam(V(x, 0, -W / 2), V(x, H, -W / 2)), beam(V(x, 0, W / 2), V(x, H, W / 2)));
    tentGroup.add(beam(V(x, H, -W / 2), V(x, R, 0)), beam(V(x, H, W / 2), V(x, R, 0)));   // chevrons
    tentGroup.add(beam(V(x, H, -W / 2), V(x, H, W / 2), 0.025));                            // entrait
  }
  tentGroup.add(beam(V(-L / 2, H, -W / 2), V(L / 2, H, -W / 2)), beam(V(-L / 2, H, W / 2), V(L / 2, H, W / 2)), beam(V(-L / 2, R, 0), V(L / 2, R, 0)));
  [-L / 2, L / 2].forEach((x) => {
    for (let z = -W / 2 + bay; z < W / 2 - 1e-6; z += bay) tentGroup.add(beam(V(x, 0, z), V(x, H, z)));
    tentGroup.add(beam(V(x, H, 0), V(x, R, 0), 0.03));
  });

  // ---- toit (2 pans + rives)
  const slope = Math.hypot(W / 2, R - H), ang = Math.atan2(R - H, W / 2), over = 0.12;
  [-1, 1].forEach((s) => {
    const pan = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.16, slope + over), roofMat);
    pan.rotation.x = s > 0 ? -Math.PI / 2 + ang : Math.PI / 2 - ang;
    pan.position.set(0, (H + R) / 2 - over / 2 * Math.sin(ang) + 0.04, s * (W / 4 + over / 2 * Math.cos(ang)));
    pan.castShadow = true; pan.receiveShadow = true;
    tentGroup.add(pan);
    const rive = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.16, 0.2), roofMat);
    rive.position.set(0, H - 0.06, s * (W / 2 + over * Math.cos(ang)));
    tentGroup.add(rive);
  });

  // ---- pignons (triangles)
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, R - H)]);
  [["front", L / 2], ["back", -L / 2]].forEach(([side, x]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, H, 0); pivot.rotation.y = Math.PI / 2;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), gableMat.clone()); m.castShadow = true;
    const hit = new THREE.Mesh(new THREE.ShapeGeometry(tri), hitMat);
    pivot.add(m, hit); tentGroup.add(pivot);
    const p = { key: `gable-${side}`, side, kind: "gable", type: "solid", open: false, t: 0, pivot, mesh: m, hit };
    hit.userData.panel = p; panels.push(p);
  });

  // ---- bâches
  const sides = [
    { side: "left", n: L / bay, pos: (i) => [-L / 2 + bay * (i + 0.5), -W / 2], rotY: 0, len: bay },
    { side: "right", n: L / bay, pos: (i) => [L / 2 - bay * (i + 0.5), W / 2], rotY: Math.PI, len: bay },
    { side: "front", n: W / bay, pos: (i) => [L / 2, -W / 2 + bay * (i + 0.5)], rotY: -Math.PI / 2, len: bay },
    { side: "back", n: W / bay, pos: (i) => [-L / 2, W / 2 - bay * (i + 0.5)], rotY: Math.PI / 2, len: bay }
  ];
  sides.forEach((S) => {
    const type = T.walls[S.side];
    for (let i = 0; i < S.n; i++) {
      const [x, z] = S.pos(i);
      const pivot = new THREE.Group(); pivot.position.set(x, H, z); pivot.rotation.y = S.rotY;
      const geo = new THREE.PlaneGeometry(S.len - 0.02, H); geo.translate(0, -H / 2, 0);
      const mesh = new THREE.Mesh(geo, panelMat(type, bay)); mesh.castShadow = type === "solid"; mesh.receiveShadow = true;
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, S.len - 0.04, 14), rollMat);
      roll.rotation.z = Math.PI / 2; roll.visible = false; roll.castShadow = true;
      const hit = new THREE.Mesh(new THREE.PlaneGeometry(S.len, H).translate(0, -H / 2, 0), hitMat);
      pivot.add(mesh, roll, hit); tentGroup.add(pivot);
      const p = { key: `${S.side}-${i}`, side: S.side, idx: i, kind: "wall", type, open: false, t: 0, pivot, mesh, roll, hit };
      hit.userData.panel = p; panels.push(p);
    }
  });

  buildFurniture();
  buildLights();
  frameCamera();
  renderPlan();
}

function buildPanelsOnly() {
  const T = TENTS[state.size];
  ["left", "right"].forEach((side) => { for (let i = 0; i < T.length / T.bay; i++) panels.push({ key: `${side}-${i}`, side, idx: i, kind: "wall", type: T.walls[side], open: false, t: 0 }); });
  ["front", "back"].forEach((side) => { for (let i = 0; i < W / T.bay; i++) panels.push({ key: `${side}-${i}`, side, idx: i, kind: "wall", type: T.walls[side], open: false, t: 0 }); });
  ["front", "back"].forEach((side) => panels.push({ key: `gable-${side}`, side, kind: "gable", type: "solid", open: false, t: 0 }));
  renderPlan();
}

/* ---- mobilier ---- */
const woodMat = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.8 });
const clothMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
function buildFurniture() {
  furnGroup.clear();
  const L = TENTS[state.size].length;
  if (state.layout === "banquet") {
    // sets brasserie : table 2,2 × 0,5 m + 2 bancs
    const rows = [-1.5, 1.5], per = Math.max(1, Math.floor((L - 1.2) / 2.6));
    rows.forEach((z) => {
      for (let i = 0; i < per; i++) {
        const x = -((per - 1) * 2.6) / 2 + i * 2.6;
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.5), woodMat); top.position.set(x, 0.76, z);
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.25), woodMat); b1.position.set(x, 0.46, z - 0.5);
        const b2 = b1.clone(); b2.position.z = z + 0.5;
        [top, b1, b2].forEach((m) => { m.castShadow = true; furnGroup.add(m); });
        [-0.9, 0.9].forEach((dx) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.44), metal); leg.position.set(x + dx, 0.38, z); furnGroup.add(leg); });
      }
    });
  } else if (state.layout === "cocktail") {
    // mange-debout habillés de noir (comme sur les photos)
    const cols = Math.max(2, Math.round(L / 2.4));
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
      if ((i + j) % 2 && L > 6) continue;
      const x = -L / 2 + (L / cols) * (i + 0.5), z = j ? 1.3 : -1.3;
      const g = new THREE.Group();
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 1.08, 20, 1, true), clothMat); skirt.position.y = 0.54;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.06, 24), clothMat); top.position.y = 1.1;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.06, 24), clothMat); foot.position.y = 0.03;
      [skirt, top, foot].forEach((m) => { m.castShadow = true; g.add(m); });
      g.position.set(x, 0, z); furnGroup.add(g);
    }
  }
}

/* ---- guirlandes (mode soirée) ---- */
const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb84d, emissiveIntensity: 0 });
const wireMat = new THREE.LineBasicMaterial({ color: 0x222222 });
function buildLights() {
  lightsGroup.clear();
  const L = TENTS[state.size].length;
  // festons en zigzag sous le toit, d'une gouttière à l'autre
  const pts = [], n = Math.round(L / 1.5);
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + 0.3 + (i * (L - 0.6)) / n, z = i % 2 ? W / 2 - 0.3 : -W / 2 + 0.3;
    pts.push(new THREE.Vector3(x, H - 0.05, z));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mid = a.clone().lerp(b, 0.5); mid.y -= 0.45;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    lightsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)), wireMat));
    for (let k = 1; k < 8; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bulbMat);
      s.position.copy(curve.getPoint(k / 8)); lightsGroup.add(s);
    }
  }
  warm[0].position.set(-L / 4, 2.2, 0); warm[1].position.set(L / 4, 2.2, 0);
}

/* ---- silhouettes pour l'échelle ---- */
function addPeople() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b59c3, roughness: 0.7 });
  const mat2 = new THREE.MeshStandardMaterial({ color: 0x0f1e3a, roughness: 0.7 });
  [[0, 0, mat], [0.55, 0.25, mat2]].forEach(([dx, dz, m]) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.9, 6, 12), m); body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), m); head.position.y = 1.55;
    [body, head].forEach((o) => { o.castShadow = true; g.add(o); });
    g.position.set(dx, 0, dz); g.userData.person = true;
    scene.add(g);
    people.push(g);
  });
}

/* ------------------------------------------------------------------ */
/*  Caméra orbitale maison                                             */
/* ------------------------------------------------------------------ */
const orbit = { theta: 0.7, phi: 1.24, r: 24, target: new THREE.Vector3(0, 1.3, 0), vTheta: 0 };
function frameCamera() {
  const L = TENTS[state.size].length;
  const narrow = canvas.clientWidth < 600;
  orbit.rTarget = (L > 6 ? 22 : 15.5) * (narrow ? 1.3 : 1);
  if (!orbit.r) orbit.r = orbit.rTarget;
  people.forEach((p, i) => p.position.set(L / 2 + 1.8 + i * 0.55, 0, 2.2 + i * 0.3));
}
function placeCamera() {
  const { theta, phi, r, target } = orbit;
  camera.position.set(target.x + r * Math.sin(phi) * Math.cos(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.sin(theta));
  camera.lookAt(target);
}

/* ------------------------------------------------------------------ */
/*  Interactions                                                       */
/* ------------------------------------------------------------------ */
function setOpen(p, open) {
  p.open = open;
  renderPlan(); emit();
}
function toggle(p) { setOpen(p, !p.open); }

if (renderer) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pointers = new Map();
  let drag = null, hovered = null, pinch = 0, lastTouch = 0;

  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(panels.map((p) => p.hit), false)[0];
    return hit ? hit.object.userData.panel : null;
  };

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    lastTouch = performance.now();
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      orbit.rTarget = THREE.MathUtils.clamp(orbit.rTarget * (pinch / d), 8, 34); pinch = d; if (drag) drag.moved = 99; return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      orbit.vTheta = dx * 0.006; orbit.theta += orbit.vTheta;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.005, 0.5, 1.45);
      lastTouch = performance.now();
    } else if (e.pointerType === "mouse") {
      const p = pick(e);
      if (p !== hovered) { hovered = p; canvas.classList.toggle("hover", !!p); }
    }
  });
  const end = (e) => {
    if (drag && drag.moved < 6 && pointers.size === 1) { const p = pick(e); if (p) toggle(p); }
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0;
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { hovered = null; canvas.classList.remove("hover"); });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); orbit.rTarget = THREE.MathUtils.clamp(orbit.rTarget * (1 + Math.sign(e.deltaY) * 0.08), 8, 34); lastTouch = performance.now(); }, { passive: false });

  // rendu
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let nightT = 0;
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    // rotation d'exposition quand personne ne touche
    if (!drag) { orbit.vTheta *= 0.93; orbit.theta += orbit.vTheta; if (!reduce && performance.now() - lastTouch > 4000) orbit.theta += dt * 0.08; }
    orbit.r += (orbit.rTarget - orbit.r) * 0.1;
    placeCamera();

    // animation des bâches
    panels.forEach((p) => {
      const goal = p.open ? 1 : 0;
      if (Math.abs(p.t - goal) > 0.001) p.t += (goal - p.t) * Math.min(1, dt * (reduce ? 60 : 7)); else p.t = goal;
      if (p.kind === "wall") {
        const s = 1 - 0.95 * p.t;
        p.mesh.scale.y = Math.max(0.05, s);
        p.mesh.visible = p.t < 0.98;
        p.roll.visible = p.t > 0.02;
        p.roll.position.y = -H * s;
        const rr = 0.04 + 0.05 * p.t; p.roll.scale.set(rr / 0.07, 1, rr / 0.07);
        p.hit.scale.y = p.open ? 0.12 : 1; // bâche enroulée : on clique sur le rouleau
      } else {
        p.mesh.material.opacity = 1 - p.t;
        p.mesh.visible = p.t < 0.99;
      }
    });

    // jour / nuit
    const ng = state.night ? 1 : 0; nightT += (ng - nightT) * Math.min(1, dt * 3);
    hemi.intensity = 1.1 - 0.85 * nightT;
    sun.intensity = 2.2 * (1 - nightT) + 0.15;
    sun.color.setRGB(1, 1 - 0.1 * nightT, 1 - 0.1 * nightT).lerp(new THREE.Color(0x8fa6ff), nightT * 0.7);
    bulbMat.emissiveIntensity = nightT * 2.4;
    warm.forEach((w) => (w.intensity = nightT * 9));
    scene.fog.color.setRGB(0.86 - 0.8 * nightT, 0.9 - 0.8 * nightT, 0.98 - 0.75 * nightT);
    lightsGroup.visible = state.night || nightT > 0.02;
    // la toile laisse passer la lumière chaude : elle rayonne le soir
    const glow = nightT * 0.32;
    [roofMat, gableMat, ...Object.values(texCache)].forEach((m) => { m.emissive.setHex(0xffc98a); m.emissiveIntensity = glow; });
    panels.forEach((p) => { if (p.kind === "gable") { p.mesh.material.emissive.setHex(0xffc98a); p.mesh.material.emissiveIntensity = glow; } });

    renderer.render(scene, camera);
  })();
}

/* ------------------------------------------------------------------ */
/*  Plan vu du dessus (accessible, synchronisé avec la 3D)             */
/* ------------------------------------------------------------------ */
function renderPlan() {
  const T = TENTS[state.size], L = T.length;
  const maxW = Math.min(planEl.parentElement.clientWidth - 8, 320);
  const k = (maxW - 40) / Math.max(L, 12), pw = L * k, ph = W * k, th = 10, pad = 20;
  planEl.style.width = `${pw + pad * 2}px`; planEl.style.height = `${ph + pad * 2}px`;
  let html = `<div class="plan-roof" style="--bays:${L / T.bay};inset:${pad}px">${T.short} m</div>`;
  panels.forEach((p) => {
    const cls = p.open ? "open" : p.type;
    let st = "";
    const seg = T.bay * k;
    if (p.kind === "gable") {
      const x = p.side === "front" ? pad + pw + 4 : pad - 4 - 12;
      st = `left:${x}px;top:${pad + ph / 2 - 16}px;width:12px;height:32px;border-radius:${p.side === "front" ? "2px 16px 16px 2px" : "16px 2px 2px 16px"}`;
    } else if (p.side === "left") st = `left:${pad + p.idx * seg + 2}px;top:${pad - th / 2}px;width:${seg - 4}px;height:${th}px`;
    else if (p.side === "right") st = `left:${pad + pw - (p.idx + 1) * seg + 2}px;top:${pad + ph - th / 2}px;width:${seg - 4}px;height:${th}px`;
    else if (p.side === "front") st = `left:${pad + pw - th / 2}px;top:${pad + p.idx * seg + 2}px;width:${th}px;height:${seg - 4}px`;
    else st = `left:${pad - th / 2}px;top:${pad + ph - (p.idx + 1) * seg + 2}px;width:${th}px;height:${seg - 4}px`;
    const name = p.kind === "gable" ? `Triangle du pignon ${p.side === "front" ? "avant" : "arrière"}` : `Bâche ${({ left: "côté gauche", right: "côté droit", front: "pignon avant", back: "pignon arrière" })[p.side]} n°${p.idx + 1}`;
    html += `<button type="button" class="${cls}" style="${st}" data-key="${p.key}" aria-pressed="${!p.open}" aria-label="${name} : ${p.open ? "ouverte" : "fermée"}" title="${name}"></button>`;
  });
  planEl.innerHTML = html;
}
planEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-key]"); if (!b) return;
  const p = panels.find((q) => q.key === b.dataset.key); if (p) toggle(p);
  const nb = planEl.querySelector(`[data-key="${b.dataset.key}"]`); nb && nb.focus();
});

/* ------------------------------------------------------------------ */
/*  Contrôles                                                          */
/* ------------------------------------------------------------------ */
function preset(name) {
  panels.forEach((p) => {
    if (name === "closed") p.open = false;
    else if (name === "open") p.open = p.kind === "wall";
    else if (name === "front") p.open = p.side === "front";
    else if (name === "half") p.open = p.kind === "wall" && (p.side === "left" || p.side === "right") && p.idx % 2 === 0;
  });
  renderPlan(); emit();
}
function setSize(size) {
  if (!TENTS[size]) return;
  state.size = size;
  document.querySelectorAll("#sizeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === size)));
  build();
  preset(size === "6x12" ? "front" : "closed");
}
document.querySelectorAll("#sizeSeg button").forEach((b) => b.addEventListener("click", () => setSize(b.dataset.size)));
document.querySelectorAll("#presets button").forEach((b) => b.addEventListener("click", () => preset(b.dataset.preset)));
document.querySelectorAll("#layoutSeg button").forEach((b) => b.addEventListener("click", () => {
  state.layout = b.dataset.layout;
  document.querySelectorAll("#layoutSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  if (renderer) buildFurniture();
  emit();
}));
const nightBtn = document.getElementById("nightBtn");
nightBtn.addEventListener("click", () => {
  state.night = !state.night;
  nightBtn.setAttribute("aria-pressed", String(state.night));
  viewer.classList.toggle("night", state.night);
});
window.addEventListener("tent:setSize", (e) => setSize(e.detail));

function emit() {
  const walls = panels.filter((p) => p.kind === "wall");
  window.dispatchEvent(new CustomEvent("tent:state", { detail: { size: state.size, layout: state.layout, open: walls.filter((p) => p.open).length, total: walls.length } }));
  const T = TENTS[state.size];
  document.getElementById("dims").textContent = `${T.length} m × ${W} m · ${T.surface} m² · ${walls.filter((p) => !p.open).length}/${walls.length} bâches`;
}

let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderPlan, 150); });
setSize(state.size);
