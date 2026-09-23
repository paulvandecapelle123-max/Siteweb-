(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CATS = window.CATEGORIES || [];
  const PROJECTS = window.PROJECTS || [];
  const SITE = window.SITE || {};
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let lang = "fr";
  try { lang = localStorage.getItem("lang") || "fr"; } catch (e) {}
  if (!window.I18N[lang]) lang = "fr";

  let current = "all"; // catégorie active
  const t = (k) => (window.I18N[lang] && window.I18N[lang][k]) || window.I18N.fr[k] || "";
  const tx = (o) => (o && typeof o === "object" ? o[lang] || o.fr : o || "");
  const catById = (id) => CATS.find((c) => c.id === id);
  const projectsOf = (id) => PROJECTS.filter((p) => id === "all" || p.cat === id)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  /* ---------- config ---------- */
  $$("[data-config]").forEach((el) => { const v = SITE[el.dataset.config]; if (v) el.textContent = v; });
  $("#year").textContent = new Date().getFullYear();
  $("#stat-cats").textContent = CATS.length;

  /* ---------- i18n ---------- */
  function applyLang() {
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    buildTicker(); buildGuide(); buildGrid(false); buildFaq(); buildSelect(); tune(tvIndex, false);
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang;
    try { localStorage.setItem("lang", lang); } catch (e) {}
    applyLang();
  }));

  /* ---------- ticker ---------- */
  function buildTicker() {
    const items = CATS.map((c) => `<span>${tx(c.name)}</span>`).join("");
    $("#ticker").innerHTML = items + items;
  }

  /* ---------- guide des chaînes ---------- */
  function buildGuide() {
    const all = `<button type="button" role="tab" class="guide-item all" data-cat="all" aria-selected="${current === "all"}">
      <span class="g-ch">CH 00</span><span><span class="g-name">${t("work.all")}</span><span class="g-tag">${CATS.length} ${lang === "fr" ? "catégories" : "categories"}</span></span><span class="g-n">${PROJECTS.length}</span></button>`;
    const items = CATS.map((c) => `<button type="button" role="tab" class="guide-item" data-cat="${c.id}" style="--c:${c.color}" aria-selected="${current === c.id}">
      <span class="g-ch">CH ${c.ch}</span><span><span class="g-name">${tx(c.name)}</span><span class="g-tag">${tx(c.tag)}</span></span><span class="g-n">${projectsOf(c.id).length}</span></button>`).join("");
    $("#guide").innerHTML = all + items;
    $$("#guide .guide-item").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.cat;
      select(id);
      if (id !== "all") tune(CATS.findIndex((c) => c.id === id), true);
    }));
  }

  function select(id) {
    current = id;
    $$("#guide .guide-item").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === id)));
    buildGrid(true);
  }

  /* ---------- grille ---------- */
  function mediaKind(url) {
    if (!url) return null;
    if (/youtu\.?be/.test(url)) return "youtube";
    if (/vimeo\.com/.test(url)) return "vimeo";
    if (/cloudflarestream\.com|videodelivery\.net/.test(url)) return "stream";
    return "file";
  }

  function buildGrid(animate) {
    const grid = $("#grid");
    const list = projectsOf(current);
    const c = catById(current);
    $("#gridTitle").textContent = c ? tx(c.name) : t("work.all");
    $("#gridCount").textContent = `${list.length} ${t("work.count")}`;

    let html = list.map((p, i) => {
      const cat = catById(p.cat) || {};
      const kind = mediaKind(p.video);
      const media = p.poster
        ? `<img src="${p.poster}" alt="" loading="lazy">`
        : kind === "file" ? `<video src="${p.video}#t=0.5" muted playsinline preload="metadata"></video>` : "";
      const meta = [p.client, p.length, p.format].filter(Boolean).join(" · ");
      return `<button type="button" class="card" data-idx="${PROJECTS.indexOf(p)}" data-format="${p.format || "9:16"}" style="--c:${cat.color};--i:${i}">
        ${media}
        ${p.result ? `<span class="card-result">${tx(p.result)}</span>` : ""}
        <span class="card-play" aria-hidden="true">▶</span>
        <span class="card-info"><span class="card-cat">CH ${cat.ch} · ${tx(cat.name)}</span><span class="card-title">${tx(p.title)}</span><span class="card-meta">${meta}</span></span>
      </button>`;
    }).join("");

    // Cartes « à venir » pour les catégories qui manquent encore de vidéos
    const targets = current === "all" ? CATS : [c];
    let n = list.length;
    targets.forEach((cat) => {
      const missing = Math.max(0, (current === "all" ? 1 : 3) - projectsOf(cat.id).length);
      for (let k = 0; k < missing; k++) {
        html += `<div class="card soon" style="--c:${cat.color};--i:${n++}">
          <span class="soon-art" aria-hidden="true"><b>${cat.glyph}</b></span>
          <span class="card-info"><span class="card-cat">CH ${cat.ch} · ${tx(cat.name)}</span><span class="card-title">${t("work.soon")}</span><span class="card-meta">${t("work.soonText")}</span></span>
        </div>`;
      }
    });

    grid.innerHTML = html;
    if (!animate) $$(".card", grid).forEach((el) => (el.style.animation = "none"));
    $$(".card:not(.soon)", grid).forEach(bindCard);
  }

  function bindCard(card) {
    card.addEventListener("click", () => openModal(PROJECTS[+card.dataset.idx]));
    if (reduceMotion) return;
    const vid = $("video", card);
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ty", `${x * 16}deg`);
      card.style.setProperty("--tx", `${-y * 16}deg`);
    });
    card.addEventListener("pointerenter", () => { card.style.animation = "none"; vid && vid.play().catch(() => {}); });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--ty", "0deg"); card.style.setProperty("--tx", "0deg");
      if (vid) { vid.pause(); vid.currentTime = 0.5; }
    });
  }

  /* ---------- modal ---------- */
  const modal = $("#modal");
  let lastFocus = null;
  function embedUrl(url, kind) {
    if (kind === "youtube") {
      const id = (url.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
      return id && `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (kind === "vimeo") {
      const id = (url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || [])[1];
      return id && `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return url;
  }
  function openModal(p) {
    if (!p) return;
    const cat = catById(p.cat) || {};
    const kind = mediaKind(p.video);
    const box = $("#modalMedia");
    box.classList.toggle("wide", p.format === "16:9");
    if (kind === "file") {
      box.innerHTML = `<video src="${p.video}" ${p.poster ? `poster="${p.poster}"` : ""} controls autoplay playsinline></video>`;
    } else if (kind) {
      box.innerHTML = `<iframe src="${embedUrl(p.video, kind)}" title="${tx(p.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      box.innerHTML = "";
    }
    $("#modalCat").textContent = `CH ${cat.ch} · ${tx(cat.name)}`;
    $("#modalCat").style.color = cat.color;
    $("#modalTitle").textContent = tx(p.title);
    $("#modalMeta").textContent = [p.client, p.length, p.format, (p.tools || []).join(" + "), tx(p.result)].filter(Boolean).join(" · ");
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal-close", modal).focus();
  }
  function closeModal() {
    modal.hidden = true;
    $("#modalMedia").innerHTML = "";
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  }
  $$("[data-close]", modal).forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  /* ---------- TV ---------- */
  const tv = $("#tv"), stage = $("#tvStage"), staticCv = $("#tvStatic");
  let tvIndex = 0, staticRAF = 0;

  function drawStatic(ms) {
    const ctx = staticCv.getContext("2d");
    const w = (staticCv.width = 160), h = (staticCv.height = 120);
    const img = ctx.createImageData(w, h);
    const end = performance.now() + ms;
    staticCv.classList.add("on");
    cancelAnimationFrame(staticRAF);
    (function frame() {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (performance.now() < end) staticRAF = requestAnimationFrame(frame);
      else staticCv.classList.remove("on");
    })();
  }

  function tune(i, fx) {
    if (!CATS.length) return;
    tvIndex = (i + CATS.length) % CATS.length;
    const c = CATS[tvIndex];
    const feat = projectsOf(c.id)[0];
    const kind = feat && mediaKind(feat.video);
    let bg = "";
    if (feat && kind === "file") bg = `<video src="${feat.video}" ${feat.poster ? `poster="${feat.poster}"` : ""} muted loop autoplay playsinline></video>`;
    else if (feat && feat.poster) bg = `<img class="ch-bg" src="${feat.poster}" alt="">`;
    const render = () => {
      $("#tvChannel").innerHTML = `<div class="ch-card" style="--c:${c.color};background:radial-gradient(circle at 70% 30%, ${c.color}33, #120F20 70%)">
        ${bg || `<span class="ch-glyph" aria-hidden="true">${c.glyph}</span>`}
        <span class="ch-no">CH ${c.ch} · ${tx(c.tag)}</span>
        <h3>${tx(c.name)}</h3>
        <p>${tx(c.pitch)}</p>
        <button type="button" class="btn btn-primary" data-watch="${c.id}">${t("tv.watch")} →</button>
      </div>`;
      $("#osdCh").textContent = `CH ${c.ch}`;
      $("[data-watch]", tv).addEventListener("click", () => {
        select(c.id);
        $("#gridTitle").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    };
    $("#tvDial").style.transform = `rotate(${tvIndex * (300 / CATS.length) - 150}deg)`;
    if (fx && !reduceMotion) {
      drawStatic(320);
      tv.classList.remove("shake"); void tv.offsetWidth; tv.classList.add("shake");
      setTimeout(render, 160);
    } else render();
  }
  tv.addEventListener("animationend", (e) => { if (e.animationName === "shake") tv.classList.remove("shake"); });
  $("#tvPrev").addEventListener("click", () => { tune(tvIndex - 1, true); syncGuide(); });
  $("#tvNext").addEventListener("click", () => { tune(tvIndex + 1, true); syncGuide(); });
  function syncGuide() { select(CATS[tvIndex].id); }

  // Inclinaison 3D de la TV avec la souris
  if (!reduceMotion) {
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tv.style.setProperty("--ry", `${x * 26}deg`);
      tv.style.setProperty("--rx", `${-y * 16}deg`);
    });
    stage.addEventListener("pointerleave", () => { tv.style.setProperty("--ry", "-10deg"); tv.style.setProperty("--rx", "4deg"); });
  }

  /* ---------- FAQ ---------- */
  function buildFaq() {
    $("#faqList").innerHTML = (window.FAQ || []).map((f, i) =>
      `<details class="faq-item" ${i === 0 ? "open" : ""}><summary>${tx(f.q)}</summary><p>${tx(f.a)}</p></details>`).join("");
  }

  /* ---------- formulaire ---------- */
  function buildSelect() {
    const sel = $("#f-type"); const v = sel.value;
    sel.innerHTML = CATS.map((c) => `<option value="${c.id}">${tx(c.name)}</option>`).join("") +
      `<option value="unsure">${t("contact.unsure")}</option>`;
    if (v) sel.value = v;
  }
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    let ok = true;
    ["name", "email", "message"].forEach((n) => {
      const el = f.elements[n];
      const bad = !el.value.trim() || (n === "email" && !/^\S+@\S+\.\S+$/.test(el.value));
      el.setAttribute("aria-invalid", String(bad)); if (bad) ok = false;
    });
    if (!ok) { $("[aria-invalid='true']", f).focus(); return; }
    const type = f.elements.type.selectedOptions[0]?.textContent || "";
    const body = `${f.elements.message.value}\n\n— ${f.elements.name.value} (${f.elements.email.value})\n${f.elements.brand.value ? "Marque : " + f.elements.brand.value + "\n" : ""}Format : ${type}`;
    location.href = `mailto:${SITE.email}?subject=${encodeURIComponent("Projet pub IA — " + type)}&body=${encodeURIComponent(body)}`;
    $("#formNote").hidden = false;
  });
  $("#copyEmail").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(SITE.email); }
    catch (err) { const r = document.createRange(); r.selectNodeContents($("#email")); getSelection().removeAllRanges(); getSelection().addRange(r); }
    btn.textContent = t("contact.copied");
    setTimeout(() => (btn.textContent = t("contact.copy")), 1800);
  });

  /* ---------- timecode & règle ---------- */
  const tc = $("#tc"), t0 = performance.now();
  const pad = (n) => String(n).padStart(2, "0");
  (function tick() {
    const s = (performance.now() - t0) / 1000;
    tc.textContent = `00:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}:${pad(Math.floor((s % 1) * 30))}`;
    if (!reduceMotion) requestAnimationFrame(tick);
  })();
  $("#ruler").innerHTML = Array.from({ length: 8 }, (_, i) => `<span>00:${pad(i * 4)}</span>`).join("");

  applyLang();
})();
