/* Voiture 3D du hero : carrosserie vernie (clearcoat) sur plateau tournant.
   Glisser = tourner · toucher/cliquer = changer la teinte avec un balayage de lumière. */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.getElementById("car3d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const PAINTS = [
  { name: "Rosso Corsa", hex: 0xc8201a },
  { name: "Nardo Grey", hex: 0x7c8084 },
  { name: "Midnight Blue", hex: 0x0f2350 },
  { name: "Perlweiß", hex: 0xe9e7e1 },
  { name: "British Racing Green", hex: 0x0f3b2a },
  { name: "Obsidian Black", hex: 0x0b0b0d }
];

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { /* pas de WebGL */ }
if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  /* ---- studio : environnement avec softbox pour les reflets ---- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x0c0d10, side: THREE.BackSide })));
  const box = (w, h, x, y, z, ry, rx, c = 0xffffff, i = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); env.add(m);
  };
  box(14, 1.2, 0, 6.8, 0, 0, Math.PI / 2, 0xffffff, 3);     // bande plafond
  box(14, 1.2, 0, 6.8, 3, 0, Math.PI / 2, 0xffffff, 2);
  box(14, 1.2, 0, 6.8, -3, 0, Math.PI / 2, 0xffffff, 2);
  box(8, 3, -14.8, 3, 0, Math.PI / 2, 0, 0xffffff, 1.4);    // softbox gauche
  box(8, 3, 14.8, 3, 0, -Math.PI / 2, 0, 0xffe2d0, 1.2);    // softbox droite chaude
  box(12, 1.5, 0, 2.5, -14.8, 0, 0, 0xd0e0ff, 0.8);         // fond froid
  box(4, 2, 0, 2, 14.8, Math.PI, 0, 0xff3b30, 0.9);         // rappel rouge
  scene.environment = pmrem.fromScene(env, 0.02).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 8, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.radius = 6;
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.15));

  /* ---- matériaux ---- */
  const paint = new THREE.MeshPhysicalMaterial({ color: PAINTS[0].hex, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, metalness: 0.2, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.88 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.18 });
  const caliper = new THREE.MeshStandardMaterial({ color: 0xe8362d, roughness: 0.4 });
  const headL = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 2.5 });
  const tailL = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a10, emissiveIntensity: 2.2 });

  /* ---- carrosserie (profil extrudé, en mètres) ---- */
  const car = new THREE.Group();
  const WIDTH = 1.84;

  const body = new THREE.Shape();
  body.moveTo(-2.22, 0.36);
  body.lineTo(-1.86, 0.36);
  body.absarc(-1.38, 0.36, 0.48, Math.PI, 0, true);
  body.lineTo(0.92, 0.36);
  body.absarc(1.4, 0.36, 0.48, Math.PI, 0, true);
  body.lineTo(2.26, 0.36);
  body.quadraticCurveTo(2.36, 0.44, 2.34, 0.6);
  body.quadraticCurveTo(2.3, 0.8, 1.9, 0.86);
  body.lineTo(0.72, 1.0);
  body.lineTo(-1.55, 1.04);
  body.quadraticCurveTo(-2.18, 1.03, -2.28, 0.82);
  body.quadraticCurveTo(-2.34, 0.55, -2.22, 0.36);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: WIDTH - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6, curveSegments: 32 });
  bodyGeo.translate(0, 0, -(WIDTH - 0.24) / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  bodyMesh.castShadow = true;
  car.add(bodyMesh);

  // habitacle
  const cab = new THREE.Shape();
  cab.moveTo(0.78, 0.98);
  cab.quadraticCurveTo(0.2, 1.3, -0.18, 1.4);
  cab.lineTo(-0.95, 1.42);
  cab.quadraticCurveTo(-1.5, 1.32, -1.86, 1.02);
  cab.lineTo(0.78, 0.98);
  const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: 1.26, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 5, curveSegments: 24 });
  cabGeo.translate(0, 0, -0.63);
  const cabin = new THREE.Mesh(cabGeo, glass);
  car.add(cabin);
  // toit peint
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 1.28), paint);
  roof.position.set(-0.56, 1.47, 0); car.add(roof);
  // montants B
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.02), black);
    p.position.set(-0.45, 1.2, s * 0.7); p.rotation.z = 0.05; car.add(p);
  });

  // bas de caisse, calandre, diffuseur
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, WIDTH + 0.02), black);
  skirt.position.set(0, 0.36, 0); car.add(skirt);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 1.1), black);
  grille.position.set(2.38, 0.52, 0); car.add(grille);
  const diff = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.3), black);
  diff.position.set(-2.32, 0.44, 0); car.add(diff);
  [-0.35, 0.35].forEach((z) => {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20), chrome);
    ex.rotation.z = Math.PI / 2; ex.position.set(-2.36, 0.44, z); car.add(ex);
  });

  // phares et feux
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.42), headL);
    h.position.set(2.3, 0.72, s * 0.6); h.rotation.z = -0.35; car.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.5), tailL);
    t.position.set(-2.34, 0.84, s * 0.55); car.add(t);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.1), paint); // rétroviseur
    m.position.set(0.55, 1.08, s * 0.98); car.add(m);
  });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 1.6), tailL);
  tailBar.position.set(-2.35, 0.84, 0); car.add(tailBar);

  // roues
  const wheels = [];
  function wheel(x, z) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 40), tyre);
    t.rotation.x = Math.PI / 2; t.castShadow = true; g.add(t);
    const side = Math.sign(z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 40), chrome);
    rim.rotation.x = Math.PI / 2; rim.position.z = side * 0.141; g.add(rim);
    const hub = new THREE.Group(); hub.position.z = side * 0.155;
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.27, 0.025), chrome);
      sp.position.y = 0.13; const pv = new THREE.Group(); pv.rotation.z = (i / 5) * Math.PI * 2; pv.add(sp); hub.add(pv);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), black);
    cap.rotation.x = Math.PI / 2; hub.add(cap);
    g.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), black);
    disc.rotation.x = Math.PI / 2; disc.position.z = side * 0.13; g.add(disc);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.05), caliper);
    cal.position.set(0.12, 0.12, side * 0.13); g.add(cal);
    g.position.set(x, 0.4, z);
    car.add(g); wheels.push(hub);
  }
  wheel(1.4, 0.8); wheel(1.4, -0.8); wheel(-1.38, 0.8); wheel(-1.38, -0.8);

  car.position.x = 0.05;

  /* ---- plateau tournant ---- */
  const turntable = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.06, 96), new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.6, roughness: 0.35 }));
  plate.position.y = -0.03; plate.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.018, 8, 128), new THREE.MeshBasicMaterial({ color: 0xe8362d }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.005;
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.002; shadowCatcher.receiveShadow = true;
  turntable.add(plate, ring, shadowCatcher, car);
  scene.add(turntable);

  // balayage de lumière lors du changement de teinte
  const sweep = new THREE.SpotLight(0xffffff, 0, 14, 0.35, 0.6);
  sweep.position.set(-6, 5, 3); sweep.target = car; scene.add(sweep);

  /* ---- interactions ---- */
  let rotY = -0.6, vel = reduce ? 0 : 0.0025, drag = null, lastInteract = 0;
  let paintIdx = 0, fromColor = new THREE.Color(PAINTS[0].hex), toColor = fromColor.clone(), blend = 1, sweepT = 1;
  let bounce = 0;
  const swBox = document.getElementById("swatches"), nameEl = document.getElementById("paintName");
  swBox.innerHTML = PAINTS.map((p, i) => `<button type="button" style="--c:#${p.hex.toString(16).padStart(6, "0")}" aria-label="${p.name}" aria-pressed="${i === 0}"></button>`).join("");
  const swBtns = [...swBox.children];
  function setPaint(i) {
    paintIdx = (i + PAINTS.length) % PAINTS.length;
    fromColor = paint.color.clone(); toColor = new THREE.Color(PAINTS[paintIdx].hex);
    blend = 0; sweepT = 0; bounce = 1;
    nameEl.textContent = PAINTS[paintIdx].name;
    swBtns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === paintIdx)));
  }
  swBtns.forEach((b, i) => b.addEventListener("click", () => setPaint(i)));

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, moved: 0 }; canvas.setPointerCapture(e.pointerId); lastInteract = performance.now(); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx);
    vel = dx * 0.006; rotY += vel; lastInteract = performance.now();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (drag && drag.moved < 6) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.intersectObject(car, true).length) setPaint(paintIdx + 1);
      else vel += 0.05; // toucher le plateau le relance
    }
    drag = null;
  });
  canvas.addEventListener("pointercancel", () => (drag = null));

  /* ---- taille ---- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const d = w / h < 1.1 ? 11.5 : 10;
    camera.position.set(0, 3.2, d);
    camera.lookAt(0, 0.55, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!drag) {
      vel *= 0.95;
      const idle = performance.now() - lastInteract > 2500;
      if (idle && !reduce) vel += (0.0035 - vel) * 0.02; // reprend la rotation d'exposition
      rotY += vel;
    }
    turntable.rotation.y = rotY;
    wheels.forEach((w) => (w.rotation.z -= vel * 2));

    if (blend < 1) { blend = Math.min(1, blend + dt * 2.2); paint.color.copy(fromColor).lerp(toColor, blend); }
    if (sweepT < 1) {
      sweepT = Math.min(1, sweepT + dt * 1.1);
      sweep.intensity = Math.sin(sweepT * Math.PI) * 60;
      sweep.position.x = -6 + sweepT * 12;
    }
    // petit rebond de suspension au changement
    if (bounce > 0) { bounce = Math.max(0, bounce - dt * 1.8); car.position.y = Math.sin((1 - bounce) * Math.PI * 4) * 0.05 * bounce; }
    else if (!reduce) car.position.y = Math.sin(t * 1.5) * 0.004;

    renderer.render(scene, camera);
  })();
}
