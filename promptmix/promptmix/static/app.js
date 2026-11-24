"use strict";
const $ = (s) => document.querySelector(s);
const MAX_MB = 50;
let files = [];
let jobId = null;
let cfg = {};
let pollTimer = null;
let original = {};   // valeurs détectées par piste, pour repérer les corrections

const TRANSITION_FR = {
  fondu: "Fondu", filtre_passe_haut: "Filtre passe-haut", filtre_passe_bas: "Filtre passe-bas",
  bass_swap: "Bass swap", echo_out: "Echo out", riser_drop: "Riser + coupure sur le drop", rewind: "Rewind",
  loop_roll: "Loop roll", blackout: "Blackout", reverb_out: "Fin dans une réverb", coupe: "Coupe franche",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(s) { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function setProgress(el, frac, label) {
  el.hidden = false;
  el.querySelector(".bar").style.width = `${Math.round(frac * 100)}%`;
  el.querySelector(".label").textContent = `${Math.round(frac * 100)} % — ${label || ""}`;
}
function showError(el, msg) { el.textContent = msg; el.hidden = !msg; }

async function api(url, opts = {}) {
  const r = await fetch(url, opts);
  let data = null;
  try { data = await r.json(); } catch { /* corps vide */ }
  if (!r.ok) {
    const d = data && data.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : `Erreur ${r.status}`);
  }
  return data;
}

// ------------------------------------------------------------------ dépôt
function addFiles(list) {
  for (const f of list) {
    if (files.length >= 3) break;
    if (!files.some((g) => g.name === f.name && g.size === f.size)) files.push(f);
  }
  renderFiles();
}
function fileProblem(f) {
  if (!f.name.toLowerCase().endsWith(".mp3")) return "pas un MP3";
  if (f.size > MAX_MB * 1024 * 1024) return "plus de 50 Mo";
  return "";
}
function renderFiles() {
  const ul = $("#file-list");
  ul.innerHTML = files.map((f, i) => {
    const pb = fileProblem(f);
    return `<li class="${pb ? "bad" : ""}"><span>${i + 1}. ${esc(f.name)} — ${(f.size / 1048576).toFixed(1)} Mo ${pb ? "(" + pb + ")" : ""}</span>
      <button title="Retirer" data-i="${i}">×</button></li>`;
  }).join("");
  ul.querySelectorAll("button").forEach((b) => b.onclick = () => { files.splice(+b.dataset.i, 1); renderFiles(); });
  updateAnalyzeButton();
}
function updateAnalyzeButton() {
  const ok = files.length >= 2 && files.length <= 3 && files.every((f) => !fileProblem(f)) && $("#rights").checked;
  $("#btn-analyze").disabled = !ok;
}

const dz = $("#dropzone");
["dragenter", "dragover"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (ev) => addFiles(ev.dataTransfer.files));
$("#file-input").addEventListener("change", (ev) => { addFiles(ev.target.files); ev.target.value = ""; });
$("#rights").addEventListener("change", updateAnalyzeButton);

$("#btn-analyze").onclick = async () => {
  showError($("#upload-error"), "");
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f, f.name));
  fd.append("rights", $("#rights").checked ? "true" : "false");
  $("#btn-analyze").disabled = true;
  $("#step-analysis").hidden = false;
  $("#tracks").innerHTML = "";
  setProgress($("#analysis-progress"), 0.01, "Envoi des fichiers…");
  try {
    const r = await api("/api/jobs", { method: "POST", body: fd });
    jobId = r.job_id;
    poll();
  } catch (e) {
    showError($("#upload-error"), e.message);
    $("#step-analysis").hidden = true;
    updateAnalyzeButton();
  }
};

// ------------------------------------------------------------------ suivi
function poll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      const job = await api(`/api/jobs/${jobId}`);
      onJob(job);
      if (job.status === "analyse" || job.status === "mixage") poll();
    } catch (e) { showError($("#mix-error"), e.message); }
  }, 800);
}

function onJob(job) {
  if (job.status === "analyse") setProgress($("#analysis-progress"), job.progress, job.message);
  if (job.status === "erreur") {
    const target = job.tracks.length ? $("#mix-error") : $("#upload-error");
    showError(target, job.error);
    $("#analysis-progress").hidden = true;
    $("#mix-progress").hidden = true;
    $("#btn-mix").disabled = !job.tracks.length;
    updateAnalyzeButton();
  }
  if (job.tracks.length && !$("#tracks").children.length) {
    $("#analysis-progress").hidden = true;
    renderTracks(job.tracks);
    $("#btn-mix").disabled = false;
  }
  if (job.status === "mixage") setProgress($("#mix-progress"), job.progress, job.message);
  if (job.status === "termine") {
    $("#mix-progress").hidden = true;
    $("#btn-mix").disabled = false;
    renderTracks(job.tracks);
    renderResult(job);
  }
}

// ------------------------------------------------------------------ analyse
function renderTracks(tracks) {
  original = {};
  $("#tracks").innerHTML = tracks.map((t) => {
    original[t.track_id] = { bpm: t.bpm, key: t.key.short };
    const total = t.n_bars || 1;
    const secs = (t.sections || []).map((s) =>
      `<div class="s-${esc(s.label)}" style="width:${(100 * s.length_bars / total).toFixed(2)}%" title="${esc(s.label)} : mesures ${s.start_bar}–${s.start_bar + s.length_bars - 1}">${esc(s.label)}</div>`).join("");
    const bass = t.band_phases_ms && Math.abs(t.band_phases_ms.low ?? 0) > 15 ? " · basse syncopée détectée (grille calée sur la bande complète)" : "";
    return `<div class="track" data-id="${t.track_id}">
      <div class="track-head"><span class="title">Morceau ${t.track_id} — ${esc(t.display)}</span>
        <span class="src">${fmt(t.duration_s)} · ${t.n_bars} mesures · tags : ${esc(t.tag_source)} · détecteur : ${esc(t.beat_engine)}${bass}</span></div>
      <div class="fields">
        <label>BPM ${t.bpm_corrected ? "(corrigé)" : "détecté"}<input type="number" step="0.01" min="60" max="200" class="bpm" value="${t.bpm.toFixed(2)}"></label>
        <button class="secondary mini half" type="button">÷2</button><button class="secondary mini dbl" type="button">×2</button>
        <label>Tonalité ${t.key_corrected ? "(corrigée)" : "détectée"}<input type="text" class="key" value="${esc(t.key.short)}" title="ex. Am, F#, 8A, La mineur"></label>
        <span class="muted">${esc(t.key.name)} · Camelot ${esc(t.key.camelot)}</span>
      </div>
      <div class="sections">${secs}</div>
    </div>`;
  }).join("");
  document.querySelectorAll(".track").forEach((el) => {
    const id = el.dataset.id, bpm = el.querySelector(".bpm"), key = el.querySelector(".key");
    const mark = () => {
      bpm.classList.toggle("changed", Math.abs(+bpm.value - original[id].bpm) > 0.05);
      key.classList.toggle("changed", key.value.trim() !== original[id].key);
    };
    el.querySelector(".half").onclick = () => { bpm.value = (+bpm.value / 2).toFixed(2); mark(); };
    el.querySelector(".dbl").onclick = () => { bpm.value = (+bpm.value * 2).toFixed(2); mark(); };
    bpm.oninput = key.oninput = mark;
  });
}

function corrections() {
  const c = {};
  document.querySelectorAll(".track").forEach((el) => {
    const id = el.dataset.id, bpm = +el.querySelector(".bpm").value, key = el.querySelector(".key").value.trim();
    const o = {};
    if (Math.abs(bpm - original[id].bpm) > 0.05) o.bpm = bpm;
    if (key && key !== original[id].key) o.key = key;
    if (Object.keys(o).length) c[id] = o;
  });
  return c;
}

// ------------------------------------------------------------------ mix
$("#btn-mix").onclick = async () => {
  showError($("#mix-error"), "");
  const prompt = $("#prompt").value.trim();
  if (prompt.length < 3) return showError($("#mix-error"), "Décris le mix que tu veux.");
  $("#btn-mix").disabled = true;
  $("#step-result").hidden = true;
  setProgress($("#mix-progress"), 0.0, "Démarrage…");
  try {
    await api(`/api/jobs/${jobId}/mix`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, corrections: corrections() }),
    });
    poll();
  } catch (e) {
    showError($("#mix-error"), e.message);
    $("#mix-progress").hidden = true;
    $("#btn-mix").disabled = false;
  }
};

function renderResult(job) {
  const r = job.result;
  $("#step-result").hidden = false;
  const v = Date.now();
  $("#player").src = `/api/jobs/${jobId}/mix.mp3?v=${v}`;
  $("#dl-mix").href = `/api/jobs/${jobId}/mix.mp3?download=1&v=${v}`;
  $("#dl-tracklist").href = `/api/jobs/${jobId}/tracklist.txt`;
  $("#explanation").textContent = `${r.plan.explanation || ""} (plan : ${r.planner} · ${r.plan.target_bpm} BPM · ${fmt(r.plan.target_duration_s)})`;
  $("#tracklist").innerHTML = r.tracklist.map((t) => `<tr><td>${t.start}</td><td>${esc(t.display)}</td>
    <td>${t.original_bpm} (${t.stretch_pct > 0 ? "+" : ""}${t.stretch_pct} %)</td><td>${esc(t.camelot)}</td>
    <td>${esc(TRANSITION_FR[t.transition_out] || t.transition_out)}</td></tr>`).join("");
  $("#transitions").innerHTML = r.transitions.map((t) =>
    `<li><b>${t.at}</b> — ${esc(TRANSITION_FR[t.type] || t.type)} sur ${t.length_bars} mesure(s)${t.overlap_bars ? `, chevauchement ${t.overlap_bars} mesures` : ""}</li>`).join("");
  const c = r.checks;
  const align = c.alignement.transitions.map((a) =>
    `transition ${a.transition} : ${a.mesurable ? `écart ${a.ecart_entre_morceaux_ms} ms` : "non mesurable (pas d'attaques nettes)"}`).join(" ; ");
  $("#checks").innerHTML = [
    [c.duree.ok, `Durée : ${c.duree.obtenu_s.toFixed(2)} s pour ${c.duree.demande_s} s demandées (tolérance ±0,5 s)`],
    [c.true_peak.ok, `True peak : ${c.true_peak.dbtp} dBTP (max ${c.true_peak.max} dBTP)`],
    [c.sonie.ok, `Sonie : ${c.sonie.lufs} LUFS (cible ${c.sonie.cible})`],
    [c.alignement.ok, `Temps alignés pendant les transitions (±20 ms) — ${align}`],
  ].map(([ok, txt]) => `<li class="${ok ? "ok" : "ko"}">${esc(txt)}</li>`).join("");
  $("#warnings").textContent = r.warnings.length ? "Ajustements : " + r.warnings.join(" ; ") : "";
}

// ------------------------------------------------------------------ init
(async () => {
  try {
    cfg = await api("/api/config");
    $("#prompt").value = cfg.example_prompt;
    $("#retention").textContent = cfg.retention_hours;
    $("#planner-info").textContent = cfg.claude ? `Plan par Claude (${cfg.model})` : "Aucune clé ANTHROPIC_API_KEY : plan par règles locales";
  } catch { /* serveur indisponible */ }
})();
