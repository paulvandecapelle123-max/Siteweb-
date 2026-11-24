"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let mode = "register";

async function api(url, opts = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  let data = null;
  try { data = await r.json(); } catch { /* vide */ }
  if (!r.ok) {
    const d = data && data.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : `Erreur ${r.status}`);
  }
  return data;
}
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function flash(msg, ok = true) { const f = $("#flash"); f.textContent = msg; f.className = "flash " + (ok ? "ok" : "ko"); f.hidden = !msg; }
function err(el, msg) { el.textContent = msg; el.hidden = !msg; }

document.querySelectorAll(".tab").forEach((t) => t.onclick = () => {
  mode = t.dataset.mode;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  $("#auth-submit").textContent = mode === "register" ? "Créer mon compte" : "Me connecter";
  $("#password").autocomplete = mode === "register" ? "new-password" : "current-password";
});

$("#auth-form").onsubmit = async (ev) => {
  ev.preventDefault();
  err($("#auth-error"), "");
  try {
    await post(`/api/auth/${mode}`, { email: $("#email").value, password: $("#password").value });
    if (mode === "register") flash("Compte créé : ton premier mix est offert !");
    await refresh();
  } catch (e) { err($("#auth-error"), e.message); }
};

$("#logout").onclick = async () => { await post("/api/auth/logout", {}); flash(""); refresh(); };

async function buy(packId) {
  err($("#buy-error"), "");
  if (!$("#cgv").checked) return err($("#buy-error"), "Accepte les conditions générales de vente.");
  if (!$("#waiver").checked) return err($("#buy-error"), "Coche la case sur la disponibilité immédiate des crédits.");
  try {
    const r = await post("/api/checkout", { pack_id: packId, cgv: true, waiver: true });
    window.location.href = r.url;   // page de paiement sécurisée Stripe
  } catch (e) { err($("#buy-error"), e.message); }
}

const REASON_DATE = (t) => new Date(t * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

async function refresh() {
  const me = await api("/api/me");
  if (!me.billing) { $("#off").hidden = false; return; }
  $("#auth").hidden = me.logged_in;
  ["#account", "#buy", "#history-card"].forEach((s) => ($(s).hidden = !me.logged_in));
  if (!me.logged_in) return;
  $("#who").textContent = me.email;
  $("#balance").textContent = me.credits;
  $("#history").innerHTML = me.history.map((h) => `<tr><td>${REASON_DATE(h.created_at)}</td><td>${esc(h.reason)}${h.amount_cents ? ` · ${(h.amount_cents / 100).toFixed(2).replace(".", ",")} €` : ""}</td>
    <td class="${h.delta > 0 ? "plus" : "minus"}">${h.delta > 0 ? "+" : ""}${h.delta}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">Aucune opération</td></tr>';
}

async function init() {
  const { packs } = await api("/api/packs");
  const best = packs.reduce((a, p) => (p.price_cents / p.credits < a.price_cents / a.credits ? p : a), packs[0]);
  $("#packs").innerHTML = packs.map((p) => `
    <div class="pack ${p.id === best.id ? "best" : ""}">
      ${p.id === best.id ? '<span class="badge">Meilleur prix</span>' : ""}
      <h3>${esc(p.name)}</h3>
      <p class="price">${esc(p.price_eur)}</p>
      <p class="muted">${p.credits} crédits · ${esc(p.per_mix_eur)} le mix</p>
      <button type="button" data-id="${esc(p.id)}">Acheter</button>
    </div>`).join("");
  document.querySelectorAll(".pack button").forEach((b) => (b.onclick = () => buy(b.dataset.id)));

  const q = new URLSearchParams(location.search);
  await refresh();
  if (q.get("annule")) flash("Paiement annulé : aucun montant n'a été débité.", false);
  if (q.get("session_id")) {
    try {
      const r = await api(`/api/checkout/confirm?session_id=${encodeURIComponent(q.get("session_id"))}`);
      flash(r.paid ? `Paiement reçu : ${r.credits} crédits ajoutés. Merci !` : "Paiement en cours de validation : tes crédits arriveront dans quelques instants.", r.paid);
      await refresh();
    } catch (e) { flash(e.message, false); }
  }
  if (q.toString()) history.replaceState(null, "", "/credits");
}
init();
