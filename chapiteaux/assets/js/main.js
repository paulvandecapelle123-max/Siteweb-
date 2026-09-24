(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.SITE, T = window.TENTS, D = window.DURATIONS, OPT = window.OPTIONS || [];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const eur = (n) => new Intl.NumberFormat("fr-BE").format(n) + " €";

  /* ---------- infos société ---------- */
  $$("[data-site]").forEach((el) => { const v = S[el.dataset.site]; if (v) el.textContent = v; });
  $("#year").textContent = new Date().getFullYear();
  $("#radiusNote").textContent = `Livraison, montage et démontage compris dans un rayon de ${S.radiusKm} km autour d'${S.city}.`;
  if (S.bce) $("#legal").textContent = `${S.city} · ${S.region} · ${S.bce}`;

  /* ---------- parallaxe du hero à la souris / au doigt ---------- */
  const scene = $("#scene");
  const layers = $$(".layer", scene);
  layers.forEach((l) => l.style.setProperty("--d", `${l.dataset.depth}px`));
  if (!reduce) {
    const move = (x, y) => layers.forEach((l) => { l.style.setProperty("--px", x.toFixed(3)); l.style.setProperty("--py", y.toFixed(3)); });
    $("#hero").addEventListener("pointermove", (e) => {
      const r = scene.getBoundingClientRect();
      move(((e.clientX - r.left) / r.width - 0.5) * -1, ((e.clientY - r.top) / r.height - 0.5) * -1);
    });
    $("#hero").addEventListener("pointerleave", () => move(0, 0));
    // sur mobile : léger mouvement au défilement
    addEventListener("scroll", () => { if (scrollY < 900) move(0, Math.min(1, scrollY / 600) * -0.8); }, { passive: true });
  }

  /* ---------- bandeau ---------- */
  const words = ["Mariages", "Communions", "Anniversaires", "Fêtes de village", "Soirées", "Barbecues", "Événements d'entreprise", "Marchés de Noël", "Baptêmes"];
  $("#ticker").innerHTML = words.concat(words).map((w) => `<span>${w}</span>`).join("");

  /* ---------- inclinaison 3D au survol ---------- */
  function tilt(el, max = 8) {
    if (reduce) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * max}deg`); el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); el.style.setProperty("--my", "-40%"); });
  }

  /* ---------- tarifs ---------- */
  const miniPlan = (t) => {
    const k = 7, w = t.length * k, h = t.width * k;
    let lines = ""; for (let x = t.bay * k; x < w; x += t.bay * k) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
    return `<svg class="mini-plan" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}" aria-hidden="true"><rect width="${w}" height="${h}" rx="2" fill="#DCE7FB" stroke="#2B59C3" stroke-width="2"/><g stroke="#2B59C3" stroke-opacity=".35">${lines}</g></svg>`;
  };
  $("#prices").innerHTML = Object.entries(T).map(([id, t]) => `
    <article class="price ${id === "6x12" ? "feat" : ""}">
      ${id === "6x12" ? '<span class="badge">Le plus demandé</span>' : ""}
      <h3>${esc(t.label)}</h3>
      <p class="meta">${t.surface} m² · jusqu'à ${t.seated} assis · ${t.standing} debout</p>
      ${miniPlan(t)}
      <p>${esc(t.blurb)}</p>
      <div class="price-rows">
        ${Object.entries(D).map(([d, dd]) => `<div class="price-row"><span>${dd.label}<small>${dd.detail}</small></span><b>${eur(t.prices[d])}</b></div>`).join("")}
      </div>
      <ul><li>Livraison, montage et démontage</li><li>Bâches amovibles panneau par panneau</li><li>Arrimage sur herbe ou lests sur pavés</li></ul>
      <button type="button" class="btn btn-line full" data-see="${id}">Voir le ${t.short} en 3D</button>
    </article>`).join("");
  $$(".price").forEach((el) => tilt(el, 6));
  $$("[data-see]").forEach((b) => b.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("tent:setSize", { detail: b.dataset.see }));
    $("#configurateur").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }));
  $("#optionsList").innerHTML = OPT.map((o) => `<li><span>${esc(o.label)}</span><b>${eur(o.price)} <small>${esc(o.unit)}</small></b></li>`).join("");

  /* ---------- résumé du configurateur ---------- */
  let cfg = { size: "6x12" };
  window.addEventListener("tent:state", (e) => {
    const prev = cfg.size; cfg = e.detail;
    const t = T[cfg.size];
    const set = (id, v) => { const el = $(id); if (el.textContent !== v) { el.textContent = v; if (prev !== cfg.size) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } } };
    set("#sSurface", `${t.surface} m²`);
    set("#sCap", cfg.layout === "cocktail" ? `${t.standing} debout` : `${t.seated} assis`);
    set("#sWeekend", eur(t.prices.weekend));
    set("#sWeek", eur(t.prices.week));
    $("#cfgCta").textContent = `Réserver le ${t.short} m`;
    const radio = $(`#form input[name=tent][value="${cfg.size}"]`); if (radio) { radio.checked = true; updateTotal(); }
  });

  /* ---------- réalisations ---------- */
  const G = window.GALLERY || [];
  const ph = '<svg viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M8 54V26L50 6l42 20v28M8 26h84M50 6v48M8 54h84"/></svg>';
  $("#gallery").innerHTML = (G.length ? G : Array.from({ length: 3 }, () => null)).map((g) =>
    g ? `<figure class="shot"><img src="${esc(g.img)}" alt="Chapiteau ${esc(g.tent)} ${esc(g.event)}${g.place ? " à " + esc(g.place) : ""}" loading="lazy"><figcaption><span class="t">${esc(T[g.tent]?.short || g.tent)}</span>${g.event ? `<span>${esc(g.event)}</span>` : ""}${g.place ? `<span>${esc(g.place)}</span>` : ""}</figcaption></figure>`
      : `<figure class="shot ph">${ph}</figure>`).join("");
  $$(".shot").forEach((el) => tilt(el, 7));

  const RV = window.REVIEWS || [];
  $("#reviews").innerHTML = RV.length
    ? RV.map((r) => `<article class="review"><div class="stars" aria-label="5 étoiles">★★★★★</div><blockquote>${esc(r.text)}</blockquote><footer><b>${esc(r.name)}</b> · ${esc(r.event)}${r.place ? ", " + esc(r.place) : ""}</footer></article>`).join("")
    : `<div class="reviews-empty"><p>Vous avez loué un chapiteau chez nous ? Votre avis aide les prochains clients.</p>${S.instagram ? `<a class="btn btn-line btn-sm" href="${esc(S.instagram)}" target="_blank" rel="noopener">Nous laisser un mot sur Instagram</a>` : ""}</div>`;

  /* ---------- zone ---------- */
  $("#villages").innerHTML = (window.ZONE || []).map((v, i) => `<li class="${i === 0 ? "home" : ""}">${esc(v)}</li>`).join("");

  /* ---------- FAQ ---------- */
  const FAQ = [
    ["Quel terrain faut-il pour installer le chapiteau ?", "Un terrain plat : pelouse, gravier, pavés ou béton. Sur herbe, on arrime le chapiteau avec des piquets. Sur un sol dur, on utilise des lests pour ne rien percer."],
    ["Quelle place prévoir ?", "Comptez environ 1 m de dégagement autour du chapiteau : à peu près 8 × 8 m pour le 6 × 6 et 8 × 14 m pour le 6 × 12. En cas de doute, envoyez-nous une photo du terrain."],
    ["Le montage est-il vraiment compris ?", `Oui. Dans un rayon de ${S.radiusKm} km autour d'${S.city}, la livraison, le montage et le démontage sont inclus dans le prix. Au-delà, on vous fait un devis pour le déplacement.`],
    ["Peut-on ouvrir ou fermer les côtés pendant la fête ?", "Oui, chaque bâche s'enroule et se ferme indépendamment. Vous gardez les côtés ouverts au soleil et vous refermez en quelques secondes si le temps tourne. C'est exactement ce que montre le configurateur 3D."],
    ["Et s'il y a beaucoup de vent ?", "Le chapiteau est arrimé solidement. En cas d'alerte météo sérieuse, on vous contacte pour décider ensemble : votre sécurité passe avant tout."],
    ["Peut-on louer les deux chapiteaux ensemble ?", "Bien sûr. 6 × 6 + 6 × 12, c'est 108 m² : pratique pour séparer le repas et le bar, ou abriter le traiteur."],
    ["Combien de temps à l'avance faut-il réserver ?", "Le plus tôt possible pour les week-ends de mai à septembre, qui partent vite. En dehors de la saison, quelques jours suffisent souvent."],
    ["Faut-il une prise électrique ?", "Uniquement si vous prenez l'option guirlandes lumineuses ou si vous prévoyez de la musique. Une rallonge depuis la maison suffit dans la plupart des cas."]
  ];
  $("#faqList").innerHTML = FAQ.map(([q, a], i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");

  /* ---------- coordonnées ---------- */
  const rows = [];
  if (S.phone) rows.push(`<li>GSM · <a href="tel:${S.phone.replace(/\s/g, "")}">${esc(S.phone)}</a></li>`);
  if (S.email) rows.push(`<li>E-mail · <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>`);
  if (S.instagram) rows.push(`<li>Instagram · <a href="${esc(S.instagram)}" target="_blank" rel="noopener">@${esc(S.instagram.replace(/\/$/, "").split("/").pop())}</a></li>`);
  rows.push(`<li><span>${esc(S.city)} · ${esc(S.region)}</span></li>`);
  $("#coords").innerHTML = rows.join("");

  /* ---------- formulaire + estimation ---------- */
  const form = $("#form");
  const today = new Date(); $("#f-date").min = today.toISOString().slice(0, 10);
  function updateTotal() {
    const t = T[form.elements.tent.value], d = form.elements.duration.value;
    $("#formTotal").innerHTML = `<span>Estimation · ${esc(t.short)} m · ${esc(D[d].label.toLowerCase())}, montage compris</span><b>${eur(t.prices[d])}</b>`;
  }
  form.addEventListener("change", (e) => {
    updateTotal();
    if (e.target.name === "tent") window.dispatchEvent(new CustomEvent("tent:setSize", { detail: e.target.value }));
  });
  updateTotal();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    ["date", "place", "name", "contact"].forEach((n) => { const el = form.elements[n]; const bad = !el.value.trim(); el.setAttribute("aria-invalid", String(bad)); if (bad) ok = false; });
    const note = $("#formNote"); note.hidden = false;
    if (!ok) { note.textContent = "Il manque la date, le lieu, votre nom ou un moyen de vous joindre."; $("[aria-invalid='true']", form).focus(); return; }
    const t = T[form.elements.tent.value], d = D[form.elements.duration.value];
    const date = new Date(form.elements.date.value).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const txt = `Bonjour ${S.name}, je souhaite réserver le ${t.label} (${d.label.toLowerCase()}) pour le ${date} à ${form.elements.place.value}.` +
      (form.elements.message.value ? `\n\n${form.elements.message.value}` : "") +
      `\n\n${form.elements.name.value} · ${form.elements.contact.value}`;
    if (S.whatsapp) {
      location.href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(txt)}`;
      note.textContent = "WhatsApp s'ouvre avec votre demande pré-remplie. Il ne reste qu'à l'envoyer.";
    } else if (S.email) {
      location.href = `mailto:${S.email}?subject=${encodeURIComponent("Réservation chapiteau " + t.short)}&body=${encodeURIComponent(txt)}`;
      note.textContent = "Votre messagerie s'ouvre avec la demande pré-remplie.";
    }
  });
})();
