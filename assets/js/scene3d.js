/* Scène 3D du hero : objets cartoon (toon shading + contours) qui flottent,
   suivent la souris, tournent au glisser et rebondissent au clic. */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { renderer = null; }
  if (renderer) init(renderer);
}

function init(renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x3dd6f5, 1.2);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  // Dégradé 3 tons = rendu cartoon
  const tones = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const grad = new THREE.DataTexture(tones, 3, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;

  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: grad });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0e0c16, side: THREE.BackSide });

  // Mesh + contour noir (coque inversée légèrement plus grande)
  function part(geo, color, thick = 0.06) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, toon(color));
    const o = new THREE.Mesh(geo, outlineMat);
    geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 1;
    o.scale.setScalar(1 + thick / r);
    g.add(m, o);
    return g;
  }

  const YELLOW = 0xffd23f, CORAL = 0xff5a5f, CYAN = 0x3dd6f5, BONE = 0xf6f3ec, INK = 0x0e0c16, PURPLE = 0xc08bff, GREEN = 0x9be564;

  /* ---- Crâne qui parle (skeleton ads) ---- */
  function makeSkull() {
    const g = new THREE.Group();
    const head = part(new THREE.SphereGeometry(1, 32, 24), BONE);
    head.scale.set(1, 0.95, 0.95);
    const jaw = new THREE.Group();
    const jawMesh = part(new THREE.BoxGeometry(1.1, 0.42, 0.9, 2, 2, 2), BONE);
    jawMesh.position.set(0, -0.2, 0.05);
    jaw.add(jawMesh);
    for (let i = -2; i <= 2; i++) {
      const tooth = part(new THREE.BoxGeometry(0.14, 0.18, 0.08), BONE, 0.03);
      tooth.position.set(i * 0.18, 0.02, 0.5);
      jaw.add(tooth);
    }
    jaw.position.set(0, -0.72, 0.1);
    const eyeGeo = new THREE.SphereGeometry(0.26, 20, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: INK });
    const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.36, 0.05, 0.78); eL.scale.z = 0.5;
    const eR = eL.clone(); eR.position.x = 0.36;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: CORAL }));
    const pL = pupil.clone(); pL.position.set(-0.36, 0.05, 0.9);
    const pR = pupil.clone(); pR.position.set(0.36, 0.05, 0.9);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 3), eyeMat);
    nose.position.set(0, -0.28, 0.88); nose.rotation.x = Math.PI;
    g.add(head, jaw, eL, eR, pL, pR, nose);
    g.userData.jaw = jaw;
    return g;
  }

  /* ---- Micro (singing ads) ---- */
  function makeMic() {
    const g = new THREE.Group();
    const headM = part(new THREE.SphereGeometry(0.62, 24, 18), 0xd8d4e8);
    headM.position.y = 0.9;
    const band = part(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 24), CORAL, 0.04);
    band.position.y = 0.36;
    const handle = part(new THREE.CylinderGeometry(0.28, 0.18, 1.6, 20), 0x2a2440, 0.05);
    handle.position.y = -0.5;
    const btn = part(new THREE.BoxGeometry(0.12, 0.3, 0.1), YELLOW, 0.03);
    btn.position.set(0, -0.2, 0.26);
    g.add(headM, band, handle, btn);
    return g;
  }

  /* ---- Clap de cinéma ---- */
  function stripes() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 32;
    const x = c.getContext("2d");
    x.fillStyle = "#F6F3EC"; x.fillRect(0, 0, 256, 32);
    x.fillStyle = "#0E0C16";
    for (let i = -1; i < 9; i++) { x.beginPath(); x.moveTo(i * 32, 32); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, 32); x.fill(); }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }
  function makeClap() {
    const g = new THREE.Group();
    const board = part(new THREE.BoxGeometry(2, 1.4, 0.18), 0x2a2440);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), new THREE.MeshBasicMaterial({ color: YELLOW }));
    label.position.set(0, -0.1, 0.1);
    const label2 = label.clone(); label2.position.y = -0.4; label2.scale.x = 0.6; label2.position.x = -0.32;
    const tex = stripes();
    const topGeo = new THREE.BoxGeometry(2, 0.3, 0.18);
    const top = new THREE.Group();
    const topMesh = new THREE.Mesh(topGeo, new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }));
    const topOut = new THREE.Mesh(topGeo, outlineMat); topOut.scale.setScalar(1.06);
    topMesh.position.x = topOut.position.x = 1;
    top.add(topMesh, topOut);
    top.position.set(-1, 0.88, 0);
    const bar = new THREE.Mesh(topGeo, new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }));
    bar.position.y = 0.55;
    g.add(board, label, label2, top, bar);
    g.userData.top = top;
    return g;
  }

  /* ---- Bouton Play ---- */
  function makePlay() {
    const s = new THREE.Shape();
    s.moveTo(-0.6, -0.75); s.lineTo(0.85, 0); s.lineTo(-0.6, 0.75); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4 });
    geo.center();
    return part(geo, YELLOW, 0.08);
  }

  /* ---- Étoile cartoon ---- */
  function makeStar() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.42 : 0.95, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3 });
    geo.center();
    return part(geo, CYAN, 0.08);
  }

  /* ---- Bobine de film ---- */
  function makeReel() {
    const g = new THREE.Group();
    const disc = part(new THREE.CylinderGeometry(1, 1, 0.26, 36), CORAL);
    disc.rotation.x = Math.PI / 2;
    const holeMat = new THREE.MeshBasicMaterial({ color: INK });
    for (let i = 0; i < 5; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 20), holeMat);
      const a = (i / 5) * Math.PI * 2;
      h.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.01);
      h.rotation.x = Math.PI / 2;
      g.add(h);
    }
    const hub = part(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 16), YELLOW, 0.04);
    hub.rotation.x = Math.PI / 2;
    g.add(disc, hub);
    return g;
  }

  /* ---- Note de musique ---- */
  function makeNote() {
    const g = new THREE.Group();
    const head = part(new THREE.SphereGeometry(0.4, 20, 16), PURPLE);
    head.scale.set(1.25, 0.9, 0.9); head.rotation.z = 0.4;
    const stem = part(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10), PURPLE, 0.04);
    stem.position.set(0.42, 0.72, 0);
    const flag = part(new THREE.BoxGeometry(0.55, 0.16, 0.14), PURPLE, 0.04);
    flag.position.set(0.66, 1.36, 0); flag.rotation.z = -0.5;
    g.add(head, stem, flag);
    return g;
  }

  /* ---- Pomme qui parle (objets qui parlent) ---- */
  function makeFruit() {
    const g = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.8, 28, 20), GREEN);
    body.scale.set(1, 0.92, 1);
    const leaf = part(new THREE.SphereGeometry(0.22, 12, 8), 0x3fa34d, 0.03);
    leaf.scale.set(1.6, 0.5, 0.6); leaf.position.set(0.25, 0.86, 0); leaf.rotation.z = 0.5;
    const eyeMat = new THREE.MeshBasicMaterial({ color: INK });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), eyeMat); e1.position.set(-0.22, 0.12, 0.74);
    const e2 = e1.clone(); e2.position.x = 0.22;
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20, Math.PI), eyeMat);
    mouth.position.set(0, -0.12, 0.76); mouth.rotation.z = Math.PI;
    g.add(body, leaf, e1, e2, mouth);
    return g;
  }

  const world = new THREE.Group();
  scene.add(world);

  const defs = [
    { make: makeSkull, pos: [3.6, 0.6, 0], s: 1.35, spin: [0, 0.4, 0], talk: true },
    { make: makeMic, pos: [6.6, 2.6, -2], s: 0.95, spin: [0.2, 0.6, 0.3] },
    { make: makeClap, pos: [6.4, -2.4, -1], s: 0.95, spin: [0.3, 0.5, 0.1], clap: true },
    { make: makePlay, pos: [1.6, 3.5, -3], s: 0.9, spin: [0.2, 0.9, 0.1] },
    { make: makeStar, pos: [8.6, 0.2, -4], s: 0.9, spin: [0.1, 0.8, 0.5] },
    { make: makeReel, pos: [2.4, -3.4, -2], s: 0.85, spin: [0.2, 0.2, 1.2] },
    { make: makeNote, pos: [-0.6, 1.6, -6], s: 0.9, spin: [0.1, 0.7, 0.2] },
    { make: makeFruit, pos: [9.2, 3.8, -6], s: 0.9, spin: [0.2, 0.6, 0.1] }
  ];

  const items = defs.map((d, i) => {
    const obj = d.make();
    obj.userData = { ...obj.userData, ...d, base: new THREE.Vector3(...d.pos), phase: i * 1.37, squash: 0 };
    obj.scale.setScalar(d.s);
    obj.rotation.set(Math.random(), Math.random() * 2, Math.random() * 0.4);
    world.add(obj);
    return obj;
  });

  /* ---- interactions ---- */
  const pointer = new THREE.Vector2(0, 0);
  const target = { x: 0, y: 0 };
  let drag = null, spinVel = 0, spinY = 0;
  const ray = new THREE.Raycaster();

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    target.x = pointer.x; target.y = pointer.y;
    if (drag) { const dx = e.clientX - drag.x; spinVel = dx * 0.004; spinY += spinVel; drag.x = e.clientX; drag.moved += Math.abs(dx); }
  });
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", (e) => {
    if (drag && drag.moved < 6) {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(world.children, true)[0];
      if (hit) { let o = hit.object; while (o.parent !== world) o = o.parent; o.userData.squash = 1; }
    }
    drag = null;
  });

  /* ---- mise en page responsive ---- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const narrow = w < 700;
    world.position.set(narrow ? -3.2 : 0, narrow ? 3.5 : 0, narrow ? -5 : 0);
    items.forEach((o, i) => (o.visible = !narrow || i < 6));
    canvas.style.opacity = narrow ? "0.55" : "1";
  }
  addEventListener("resize", resize);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!drag) { spinVel *= 0.94; spinY += spinVel; }
    world.rotation.y += ((spinY + target.x * 0.25) - world.rotation.y) * 0.08;
    world.rotation.x += ((-target.y * 0.15) - world.rotation.x) * 0.08;

    items.forEach((o) => {
      const u = o.userData;
      const k = reduce ? 0 : 1;
      o.position.set(u.base.x, u.base.y + Math.sin(t * 1.2 + u.phase) * 0.35 * k, u.base.z);
      o.rotation.x += u.spin[0] * dt * 0.5 * k;
      o.rotation.y += u.spin[1] * dt * 0.5 * k;
      o.rotation.z += u.spin[2] * dt * 0.3 * k;
      if (u.talk) { o.rotation.set(Math.sin(t * 0.8) * 0.15, -0.35 + Math.sin(t * 0.6) * 0.35 + target.x * 0.4, 0); u.jaw.rotation.x = Math.max(0, Math.sin(t * 9)) * 0.35 * k; }
      if (u.clap) u.top.rotation.z = Math.max(0, Math.sin(t * 2.4)) * 0.45 * k;
      // squash & stretch au clic
      if (u.squash > 0) {
        u.squash = Math.max(0, u.squash - dt * 1.6);
        const w = Math.sin((1 - u.squash) * Math.PI * 3) * u.squash;
        o.scale.set(u.s * (1 + w * 0.35), u.s * (1 - w * 0.35), u.s * (1 + w * 0.35));
        o.rotation.y += u.squash * 0.3;
      }
    });
    renderer.render(scene, camera);
  }
  loop();
}
