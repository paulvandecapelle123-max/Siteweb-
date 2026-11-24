"use strict";

// =====================================================================
// RÉGLAGE : adresse de l'application une fois hébergée
// (ex. "https://app.promptmix.fr"). Vide = boutons « Bientôt disponible ».
// =====================================================================
const APP_URL = "";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

$("#year").textContent = new Date().getFullYear();

// ------------------------------------------------------------- boutons vers l'appli
document.querySelectorAll(".js-app").forEach((a) => {
  if (APP_URL) { a.href = APP_URL + (a.dataset.path || ""); return; }
  a.classList.add("soon");
  a.textContent = a.classList.contains("small") ? "Bientôt" : "Bientôt disponible";
  a.removeAttribute("href");
  a.setAttribute("aria-disabled", "true");
});
if (!APP_URL) document.querySelectorAll(".js-app-note").forEach((n) => (n.hidden = false));
document.querySelectorAll(".js-cgv").forEach((a) => { if (APP_URL) { a.href = APP_URL + "/cgv"; a.hidden = false; } });

// ------------------------------------------------------------- visuel : deux platines qui se croisent
(function decks() {
  const cv = $("#decks");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  const bpm = 126, beatPx = 34;
  // formes d'onde pseudo-aléatoires mais stables (kick sur chaque temps)
  const wave = (seed, x) => {
    const beat = ((x / beatPx) % 1 + 1) % 1;
    const kick = Math.exp(-beat * 9);
    const n = Math.sin(x * 0.9 + seed) * 0.5 + Math.sin(x * 0.37 + seed * 3) * 0.5;
    return 0.25 + 0.55 * kick + 0.2 * Math.abs(n);
  };
  function frame(t) {
    const s = t / 1000;
    const offset = (s * bpm / 60) * beatPx;          // défilement calé sur le tempo
    const mixPos = (Math.sin(s * 0.35) + 1) / 2;      // position du crossfader
    ctx.clearRect(0, 0, W, H);
    const lanes = [{ y: 120, col: "#ff4f7b", seed: 1, gain: 1 - mixPos, label: "MORCEAU A" },
                   { y: 270, col: "#4fd1ff", seed: 7, gain: mixPos, label: "MORCEAU B" }];
    // grille des temps (alignée sur les deux pistes)
    for (let x = -((offset % beatPx)); x < W; x += beatPx) {
      const bar = Math.round((x + offset) / beatPx) % 4 === 0;
      ctx.strokeStyle = bar ? "#ffffff22" : "#ffffff0c";
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 340); ctx.stroke();
    }
    lanes.forEach((L) => {
      ctx.fillStyle = "#8e97aa"; ctx.font = "600 11px system-ui"; ctx.fillText(L.label, 16, L.y - 62);
      for (let x = 0; x < W; x += 3) {
        const h = wave(L.seed, x + offset) * 54 * (0.25 + 0.75 * L.gain);
        ctx.fillStyle = L.col; ctx.globalAlpha = 0.35 + 0.65 * L.gain;
        ctx.fillRect(x, L.y - h, 2, h * 2);
      }
      ctx.globalAlpha = 1;
    });
    // tête de lecture + crossfader
    ctx.fillStyle = "#ffffff"; ctx.fillRect(W / 2 - 1, 40, 2, 300);
    ctx.fillStyle = "#262c38"; ctx.fillRect(W / 2 - 90, 372, 180, 6);
    ctx.fillStyle = "#eef0f5"; ctx.fillRect(W / 2 - 90 + mixPos * 160, 362, 20, 26);
    ctx.fillStyle = "#8e97aa"; ctx.fillText("A", W / 2 - 112, 380); ctx.fillText("B", W / 2 + 104, 380);
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ------------------------------------------------------------- demandes qui s'écrivent
(function typing() {
  const el = $("#typing");
  const lines = [
    "5 minutes, ça monte doucement, bass swap sur 8 mesures…",
    "riser puis coupure nette sur le drop du morceau 3",
    "la boucle de fin prend le rythme du morceau suivant",
    "le son devient étouffé, comme sous l'eau, puis un brake",
  ];
  if (reduced) { el.textContent = lines[0]; return; }
  let li = 0, ci = 0, del = false;
  (function tick() {
    const line = lines[li];
    el.textContent = line.slice(0, ci);
    if (!del && ci < line.length) { ci++; return setTimeout(tick, 38); }
    if (!del) { del = true; return setTimeout(tick, 1800); }
    if (ci > 0) { ci -= 2; return setTimeout(tick, 14); }
    del = false; li = (li + 1) % lines.length; setTimeout(tick, 300);
  })();
})();

// ------------------------------------------------------------- exemples : demande -> plan
const EXAMPLES = [
  { tab: "Warm-up de 5 minutes",
    prompt: "Mix de 5 minutes, ambiance qui monte doucement. Le morceau 1 avec son intro, bass swap sur 8 mesures vers le 2, puis riser et coupure nette sur le drop du 3. Termine dans une réverb.",
    total: 300, blocks: [["Morceau 1", 0, 108, "a"], ["Morceau 2", 93, 212, "b"], ["Morceau 3", 212, 300, "c"]],
    fx: [[100, "Bass swap"], [212, "Riser + drop"], [296, "Réverb"]],
    steps: ["Tempos calés sur 124 BPM, tonalité conservée", "Le morceau 2 entre sans ses basses ; échange net des basses sur un premier temps",
            "Montée de bruit sur 8 mesures, silence, le morceau 3 tombe pile sur son drop", "Le dernier temps part dans une grande réverb"] },
  { tab: "« La boucle prend le rythme du suivant »",
    prompt: "À la fin du premier son, tu prends un petit bout, tu le répètes en boucle, tu changes comment ça se répète, et après ça devient la même rythmique que la chanson d'après.",
    total: 180, blocks: [["Morceau 1", 0, 92, "a"], ["Morceau 2", 85, 180, "b"]],
    fx: [[88, "Boucle qui se transforme"]],
    steps: ["Un demi-temps de la fin du morceau 1 est mis en boucle, puis la boucle raccourcit",
            "Ce bout de son rejoue exactement le rythme de la première mesure du morceau 2", "Le morceau 2 monte en dessous et prend la relève"] },
  { tab: "« Comme sous l'eau » + brake",
    prompt: "Le premier devient étouffé, comme sous l'eau, pendant que le deuxième arrive. Termine avec un brake.",
    total: 200, blocks: [["Morceau 1", 0, 105, "a"], ["Morceau 2", 90, 200, "b"]],
    fx: [[97, "Filtre passe-bas"], [197, "Tape stop"]],
    steps: ["Le morceau 1 se ferme dans un filtre passe-bas résonant", "Le morceau 2 arrive par les aigus puis s'ouvre en entier",
            "Fin : le son ralentit et descend jusqu'à l'arrêt, comme une platine qu'on coupe"] },
  { tab: "Peak time : double drop",
    prompt: "Peak time, 4 minutes. Snare roll avant le drop du 2, puis double drop entre le 2 et le 3.",
    total: 240, blocks: [["Morceau 1", 0, 80, "a"], ["Morceau 2", 80, 172, "b"], ["Morceau 3", 160, 240, "c"]],
    fx: [[80, "Snare roll"], [166, "Double drop"]],
    steps: ["Roulement de caisse claire de plus en plus serré, puis drop du morceau 2",
            "Les drops des morceaux 2 et 3 démarrent ensemble ; seules les basses du 3 restent"] },
  { tab: "Hip-hop : cuts et rewind",
    prompt: "Set hip-hop de 3 minutes, que des transitions sèches, et un rewind pour le dernier.",
    total: 180, blocks: [["Morceau 1", 0, 62, "a"], ["Morceau 2", 62, 124, "b"], ["Morceau 3", 124, 180, "c"]],
    fx: [[62, "Coupe franche"], [124, "Rewind"]],
    steps: ["Passage instantané pile sur un premier temps", "Les deux derniers temps repartent à l'envers en accélérant, puis le morceau 3 tombe"] },
];
const COLORS = { a: "#ff4f7b", b: "#4fd1ff", c: "#ffd166" };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function showExample(i) {
  const ex = EXAMPLES[i];
  document.querySelectorAll("#example-tabs button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
  $("#example-prompt").textContent = `« ${ex.prompt} »`;
  const pct = (t) => (100 * t / ex.total).toFixed(2) + "%";
  $("#example-timeline").innerHTML =
    ex.blocks.map(([name, a, b, k], j) => `<div class="tl-block" style="left:${pct(a)};width:calc(${pct(b - a)} - 2px);top:${j % 2 ? 38 : 0}px;background:${COLORS[k]}">${esc(name)} · ${fmt(a)}</div>`).join("") +
    ex.fx.map(([t, label]) => `<div class="tl-fx" style="left:${pct(t)}">${esc(label)}</div>`).join("");
  $("#example-steps").innerHTML = ex.steps.map((s) => `<li>${esc(s)}</li>`).join("");
}
$("#example-tabs").innerHTML = EXAMPLES.map((e, i) => `<button role="tab" data-i="${i}">${esc(e.tab)}</button>`).join("");
document.querySelectorAll("#example-tabs button").forEach((b) => (b.onclick = () => showExample(+b.dataset.i)));
showExample(0);

// ------------------------------------------------------------- techniques (lexique partagé avec l'appli)
let TECHS = [];
let famFilter = "Toutes";

function renderTechs() {
  const q = norm($("#tech-search").value.trim());
  const list = TECHS.filter((t) => famFilter === "Toutes" || t.famille === famFilter)
    .filter((t) => !q || norm([t.nom, t.simple, t.quand, ...t.synonymes].join(" ")).includes(q));
  $("#tech-grid").innerHTML = list.map((t) => `
    <article class="tech ${t.id ? "" : "off"}">
      <span class="fam">${esc(t.famille)}</span>
      <h3>${esc(t.nom)}</h3>
      <p class="simple">${esc(t.simple)}</p>
      <div class="syn">${t.synonymes.map((s) => `<span class="${q && norm(s).includes(q) ? "hit" : ""}">${esc(s)}</span>`).join("")}</div>
      <p class="meta">${esc(t.quand)}${t.mesures ? " · " + esc(t.mesures) : ""}</p>
    </article>`).join("");
  $("#tech-empty").hidden = list.length > 0;
}

fetch("/lexique.json").then((r) => r.json()).then((data) => {
  TECHS = data.techniques;
  const fams = ["Toutes", ...new Set(TECHS.map((t) => t.famille))];
  $("#tech-chips").innerHTML = fams.map((f) => `<button aria-pressed="${f === famFilter}" data-f="${esc(f)}">${esc(f)}</button>`).join("");
  document.querySelectorAll("#tech-chips button").forEach((b) => (b.onclick = () => {
    famFilter = b.dataset.f;
    document.querySelectorAll("#tech-chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderTechs();
  }));
  renderTechs();
}).catch(() => { $("#tech-grid").innerHTML = '<p class="muted">Impossible de charger la liste des techniques.</p>'; });

$("#tech-search").addEventListener("input", renderTechs);
document.querySelectorAll("button.link[data-q]").forEach((b) => (b.onclick = () => {
  $("#tech-search").value = b.dataset.q; famFilter = "Toutes";
  document.querySelectorAll("#tech-chips button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === "Toutes")));
  renderTechs();
}));
