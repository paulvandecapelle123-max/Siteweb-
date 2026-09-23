(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NM = window.NM || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  $("#year").textContent = new Date().getFullYear();

  /* ---------- bande défilante ---------- */
  const words = ["Polissage", "Céramique", "Nettoyage intérieur", "Import Allemagne", "Import Pays-Bas", "Rénovation phares", "Soin du cuir", "Préparation vente"];
  $("#strip").innerHTML = words.concat(words).map((w) => `<span>${w}</span>`).join("");

  /* ---------- inclinaison 3D + reflet au survol ---------- */
  function tilt(el, max = 10) {
    if (reduce) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); el.style.setProperty("--my", "-30%"); });
  }

  /* ---------- prestations ---------- */
  const ICONS = {
    wash: '<path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9Z"/><path d="M9.5 13a2.5 2.5 0 0 0 2.5 2.5"/>',
    interior: '<path d="M7 20v-5a3 3 0 0 1 3-3h1V5a2 2 0 0 1 4 0v10"/><path d="M5 20h14"/><path d="M15 15h2a2 2 0 0 1 2 2v3"/>',
    polish: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
    ceramic: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    leather: '<path d="M6 21V9a6 6 0 0 1 12 0v12"/><path d="M6 14h12M9 21v-4M15 21v-4"/>',
    lights: '<path d="M10 6c-4 0-7 2.7-7 6s3 6 7 6h1V6h-1Z"/><path d="M15 8h6M15 12h6M15 16h6"/>',
    engine: '<path d="M4 10h3l2-3h6l2 3h3v7h-3l-2 2H9l-2-2H4v-7Z"/><path d="M12 10v4"/>',
    sale: '<path d="M3 12 12 3h8v8l-9 9-8-8Z"/><circle cx="16" cy="8" r="1.5"/>'
  };
  $("#services").innerHTML = (window.SERVICES || []).map((s) => `
    <article class="svc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[s.icon] || ""}</svg>
      <span class="quote">Sur devis</span>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
      <ul>${s.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </article>`).join("");
  $$(".svc").forEach((el) => tilt(el, 12));

  /* ---------- capot à polir ---------- */
  const cv = $("#polishCanvas"), pad = $("#pad");
  const ctx = cv.getContext("2d");
  const clean = document.createElement("canvas"), dirt = document.createElement("canvas");
  let W = 0, H = 0, done = false, lastCheck = 0, painting = false;

  function drawClean(c) {
    const g = c.getContext("2d"), w = c.width, h = c.height;
    // vernis rouge profond
    let grd = g.createLinearGradient(0, 0, w * 0.3, h);
    grd.addColorStop(0, "#7A0F0A"); grd.addColorStop(0.45, "#C8241C"); grd.addColorStop(1, "#4A0806");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // reflets de softbox (miroir)
    g.save(); g.translate(w * 0.5, h * 0.5); g.rotate(-0.28);
    [[-0.34, 0.07, 0.95], [-0.12, 0.025, 0.6], [0.18, 0.05, 0.85], [0.34, 0.012, 0.5]].forEach(([y, th, a]) => {
      const sg = g.createLinearGradient(0, h * (y - th), 0, h * (y + th));
      sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, `rgba(255,255,255,${a})`); sg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = sg; g.fillRect(-w, h * (y - th), w * 2, h * th * 2);
    });
    g.restore();
    // ligne de caisse + reflet d'arbres/ciel
    grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(120,170,255,.18)"); grd.addColorStop(0.3, "rgba(0,0,0,0)"); grd.addColorStop(0.85, "rgba(0,0,0,.35)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h * 0.78); g.bezierCurveTo(w * 0.3, h * 0.72, w * 0.7, h * 0.72, w, h * 0.8); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, h * 0.785); g.bezierCurveTo(w * 0.3, h * 0.725, w * 0.7, h * 0.725, w, h * 0.805); g.stroke();
    // logo discret
    g.fillStyle = "rgba(255,255,255,.08)"; g.font = `${Math.round(h * 0.09)}px Michroma, sans-serif`; g.textAlign = "center";
    g.fillText("NMcars", w / 2, h * 0.92);
  }

  function drawDirt(c) {
    const g = c.getContext("2d"), w = c.width, h = c.height;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    // voile terne et oxydé
    g.fillStyle = "rgba(118,72,64,.93)"; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "rgba(160,140,120,.35)"); grd.addColorStop(1, "rgba(60,40,30,.4)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // poussière
    for (let i = 0; i < w * h / 90; i++) {
      g.fillStyle = `rgba(${170 + Math.random() * 60},${150 + Math.random() * 50},${120 + Math.random() * 40},${Math.random() * 0.25})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // micro-rayures circulaires (rouleaux de station)
    const cx = w * 0.55, cy = h * 0.4;
    g.lineWidth = 0.8;
    for (let i = 0; i < 260; i++) {
      const r = 20 + Math.random() * Math.max(w, h) * 0.8, a = Math.random() * Math.PI * 2;
      g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.14})`;
      g.beginPath(); g.arc(cx, cy, r, a, a + 0.1 + Math.random() * 0.35); g.stroke();
    }
    // traces de gouttes séchées
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * 9;
      g.strokeStyle = "rgba(230,220,200,.28)"; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
    // coulures
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w;
      const sg = g.createLinearGradient(0, 0, 0, h);
      sg.addColorStop(0, "rgba(40,30,20,0)"); sg.addColorStop(1, "rgba(40,30,20,.35)");
      g.fillStyle = sg; g.fillRect(x, h * (0.3 + Math.random() * 0.4), 2 + Math.random() * 5, h);
    }
  }

  function sizePolish() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr);
    clean.width = dirt.width = W; clean.height = dirt.height = H;
    drawClean(clean); drawDirt(dirt); done = false; updateGauge(0);
    render();
  }
  function render(sparkle) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(clean, 0, 0);
    ctx.drawImage(dirt, 0, 0);
    if (sparkle) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(W * (sparkle - 0.2), 0, W * sparkle, H);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
  function scrub(x, y) {
    const g = dirt.getContext("2d");
    const dpr = W / cv.getBoundingClientRect().width;
    const R = Math.max(W, H) * 0.075;
    g.globalCompositeOperation = "destination-out";
    const rg = g.createRadialGradient(x * dpr, y * dpr, 0, x * dpr, y * dpr, R);
    rg.addColorStop(0, "rgba(0,0,0,.55)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(x * dpr, y * dpr, R, 0, Math.PI * 2); g.fill();
    render();
    const now = performance.now();
    if (now - lastCheck > 180) { lastCheck = now; measure(); }
  }
  function measure() {
    const d = dirt.getContext("2d").getImageData(0, 0, W, H).data;
    let left = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) { left += d[i]; n++; }
    const pct = Math.min(100, Math.round((1 - left / (n * 255)) * 100 / 0.92));
    updateGauge(pct);
  }
  function updateGauge(pct) {
    $("#polishPct").textContent = `${pct} %`;
    $("#polishBar").style.width = `${pct}%`;
    const st = $("#polishState"), gauge = $(".gauge");
    st.textContent = pct < 25 ? "Surface : voilée, micro-rayures" : pct < 60 ? "Décontamination en cours…" : pct < 85 ? "Correction : le vernis revient" : "Brillance miroir. Prêt pour la céramique.";
    gauge.classList.toggle("done", pct >= 85);
    if (pct >= 85 && !done) {
      done = true;
      dirt.getContext("2d").clearRect(0, 0, W, H);
      if (reduce) return render();
      const t0 = performance.now();
      (function sweep(t) {
        const p = (t - t0) / 900;
        render(p * 1.4);
        if (p < 1) requestAnimationFrame(sweep); else render();
      })(t0);
    }
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", (e) => { painting = true; cv.setPointerCapture(e.pointerId); scrub(...pos(e)); });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = pos(e);
    pad.style.transform = `translate(${x}px, ${y}px)`;
    pad.classList.add("on");
    if (painting) scrub(x, y);
  });
  // À la souris, le simple survol polit aussi : plus ludique
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !painting) scrub(...pos(e)); });
  ["pointerup", "pointercancel"].forEach((ev) => cv.addEventListener(ev, () => { painting = false; measure(); }));
  cv.addEventListener("pointerleave", () => { pad.classList.remove("on"); painting = false; });
  $("#polishReset").addEventListener("click", () => { drawDirt(dirt); done = false; updateGauge(0); render(); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(sizePolish, 200); });
  sizePolish();
  if (document.fonts) document.fonts.ready.then(() => { drawClean(clean); render(); });

  /* ---------- carte d'import ---------- */
  const O = window.ORIGINS || [], A = window.AUBEL;
  const svgNS = "http://www.w3.org/2000/svg";
  const routes = $("#routes"), nodes = $("#nodes");
  const curve = (o) => {
    const mx = (o.x + A.x) / 2, my = (o.y + A.y) / 2 - 40;
    return `M${o.x} ${o.y} Q ${mx} ${my} ${A.x} ${A.y}`;
  };
  routes.innerHTML = O.map((o, i) => `<path class="route" id="rt${i}" d="${curve(o)}"/>`).join("") + `<circle class="car-dot" r="6" id="carDot" cx="${A.x}" cy="${A.y}"/>`;
  nodes.innerHTML = O.map((o, i) => `
    <g class="node" data-i="${i}" tabindex="0" role="button" aria-label="${o.city} : ${o.km} km">
      <circle class="hit" cx="${o.x}" cy="${o.y}" r="26"/>
      <circle class="pin" cx="${o.x}" cy="${o.y}" r="6"/>
      <text x="${o.x}" y="${o.y - 16}" text-anchor="middle">${o.city}</text>
      <text class="km" x="${o.x}" y="${o.y + 24}" text-anchor="middle">${o.km} km</text>
    </g>`).join("") +
    `<g class="home"><circle class="pulse" cx="${A.x}" cy="${A.y}" r="9"/><circle cx="${A.x}" cy="${A.y}" r="9"/><text x="${A.x - 16}" y="${A.y + 34}" text-anchor="middle">AUBEL</text></g>`;

  let active = -1, anim = 0;
  function pick(i) {
    if (i === active) return;
    active = i;
    $$(".node").forEach((n) => n.classList.toggle("on", +n.dataset.i === i));
    $$(".route").forEach((r, k) => r.classList.toggle("on", k === i));
    const o = O[i];
    $("#mcCity").textContent = `${o.city} (${o.country})`;
    $("#mcInfo").textContent = `${o.km} km d'Aubel · ${o.time}`;
    const path = $(`#rt${i}`), dot = $("#carDot"), len = path.getTotalLength();
    cancelAnimationFrame(anim);
    if (reduce) { dot.setAttribute("cx", A.x); dot.setAttribute("cy", A.y); return; }
    const t0 = performance.now();
    (function drive(t) {
      const p = Math.min(1, (t - t0) / 1600), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const pt = path.getPointAtLength(len * e);
      dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
      if (p < 1) anim = requestAnimationFrame(drive);
    })(t0);
  }
  $$(".node").forEach((n) => {
    const i = +n.dataset.i;
    n.addEventListener("pointerenter", () => pick(i));
    n.addEventListener("click", () => { active = -1; pick(i); });
    n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); active = -1; pick(i); } });
  });
  pick(0);
  // tournée automatique tant que personne ne touche la carte
  let auto = setInterval(() => pick((active + 1) % O.length), 3200);
  $("#map").addEventListener("pointerenter", () => clearInterval(auto), { once: true });

  /* ---------- compteurs ---------- */
  const counters = $$("[data-count]");
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target, to = +el.dataset.count, suf = el.dataset.suffix || "";
    io.unobserve(el);
    if (reduce) { el.textContent = to + suf; return; }
    const t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: 0.4 });
  counters.forEach((c) => { c.textContent = c.dataset.count + (c.dataset.suffix || ""); io.observe(c); });

  /* ---------- réalisations ---------- */
  const carSvg = '<svg viewBox="0 0 200 90" fill="none" stroke="#3A414C" stroke-width="2"><path d="M10 62h14a14 14 0 0 1 28 0h92a14 14 0 0 1 28 0h18v-14l-18-6-30-22H72L44 42 14 46z"/><circle cx="38" cy="62" r="11"/><circle cx="158" cy="62" r="11"/><path d="M78 24h36l22 18H66z"/></svg>';
  $("#gallery").innerHTML = (window.GALLERY || []).map((g) => {
    const ba = g.before && g.after;
    const media = ba
      ? `<img src="${esc(g.before)}" alt="${esc(g.title)} — avant" loading="lazy"><img class="ba-after" src="${esc(g.after)}" alt="${esc(g.title)} — après" loading="lazy"><span class="ba-line"></span><input type="range" min="0" max="100" value="50" aria-label="Comparer avant / après">`
      : g.img ? `<img src="${esc(g.img)}" alt="${esc(g.title)}" loading="lazy">` : `<span class="ph">${carSvg}</span>`;
    return `<figure class="shot" style="margin:0">${media}<figcaption><b>${esc(g.title)}</b><span>${esc(g.car)}${!g.img && !ba ? " · photo à venir" : ""}</span></figcaption></figure>`;
  }).join("");
  $$(".shot").forEach((el) => {
    const range = $("input[type=range]", el);
    if (range) range.addEventListener("input", () => el.style.setProperty("--cut", range.value + "%"));
    else tilt(el, 8);
  });

  /* ---------- FAQ ---------- */
  $("#faqList").innerHTML = (window.FAQ || []).map((f, i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  /* ---------- coordonnées ---------- */
  const I = {
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9c0 3 2 5 5 6l1.2-1.2-2-1-1 1c-1-.4-1.6-1-2-2l1-1-1-2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  const rows = [];
  if (NM.instagram) rows.push(`<li><a href="${esc(NM.instagram)}" target="_blank" rel="noopener">${I.ig}@nmcars.be sur Instagram</a></li>`);
  if (NM.phone) rows.push(`<li><a href="tel:${esc(NM.phone.replace(/\s/g, ""))}">${I.phone}${esc(NM.phone)}</a></li>`);
  if (NM.whatsapp) rows.push(`<li><a href="https://wa.me/${esc(NM.whatsapp)}" target="_blank" rel="noopener">${I.wa}WhatsApp</a></li>`);
  if (NM.email) rows.push(`<li><a href="mailto:${esc(NM.email)}">${I.mail}${esc(NM.email)}</a></li>`);
  if (NM.address) rows.push(`<li><span>${I.pin}${esc(NM.address)}</span></li>`);
  if (NM.hours) rows.push(`<li><span>${I.clock}${esc(NM.hours)}</span></li>`);
  $("#coords").innerHTML = rows.join("");
  if (NM.bce) $("#legal").textContent = `Aubel, Belgique · ${NM.bce}`;

  /* ---------- formulaire ---------- */
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target; let ok = true;
    ["name", "contact", "message"].forEach((n) => { const el = f.elements[n]; const bad = !el.value.trim(); el.setAttribute("aria-invalid", String(bad)); if (bad) ok = false; });
    const note = $("#formNote");
    if (!ok) { note.hidden = false; note.textContent = "Il manque votre nom, un moyen de vous joindre ou votre message."; $("[aria-invalid='true']", f).focus(); return; }
    const kind = f.elements.kind.value;
    const text = `Bonjour NMcars, demande ${kind}.\n\n${f.elements.message.value}\n\nVéhicule : ${f.elements.car.value || "—"}\n${f.elements.name.value} · ${f.elements.contact.value}`;
    note.hidden = false;
    if (NM.whatsapp) {
      location.href = `https://wa.me/${NM.whatsapp}?text=${encodeURIComponent(text)}`;
      note.textContent = "WhatsApp s'ouvre avec votre demande pré-remplie.";
    } else if (NM.email) {
      location.href = `mailto:${NM.email}?subject=${encodeURIComponent("Demande " + kind + " — site NMcars")}&body=${encodeURIComponent(text)}`;
      note.textContent = "Votre messagerie s'ouvre avec la demande pré-remplie.";
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
      note.innerHTML = `Votre message est copié. Collez-le en message privé sur <a href="${esc(NM.instagram)}" target="_blank" rel="noopener">Instagram @nmcars.be</a>.`;
    }
  });
})();
