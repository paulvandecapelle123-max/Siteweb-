// Écrans « Réglages » et « Aide ».

import { api, esc, state, toast, openModal, fmtEur } from '../core.js';
import { help, GLOSSARY } from '../glossary.js';

const SOURCE_LABEL = {
  yahoo: 'Yahoo Finance (toutes les bourses, sans clé)',
  finnhub: 'Finnhub (temps réel US, clé gratuite)',
  twelvedata: 'Twelve Data (secours US, clé gratuite)',
  fx: 'Taux de change',
};

export function sourceDotClass(s) {
  if (!s) return '';
  if (['ok', 'connected', 'ready', 'fallback', 'cache'].includes(s.state)) return s.state === 'fallback' || s.state === 'cache' ? 'warn' : 'ok';
  if (['no-key', 'demo', 'unknown', 'connecting'].includes(s.state)) return '';
  if (s.state === 'rate-limit') return 'warn';
  return 'err';
}

export function sourcesList() {
  const s = state.sources || {};
  return `<ul class="status-list">${['yahoo', 'finnhub', 'twelvedata', 'fx']
    .map((k) => `<li><span class="source-dot ${sourceDotClass(s[k])}"></span><div><strong>${esc(SOURCE_LABEL[k])}</strong><div class="small muted">${esc(s[k]?.message || '—')}</div></div></li>`)
    .join('')}</ul>`;
}

function keyBlock(id, title, s, hasKey, masked, steps) {
  return `<div class="card">
    <h2>${title}</h2>
    ${steps}
    <div class="field"><label for="${id}-key">Clé API</label>
      <div class="input-group"><input id="${id}-key" type="password" autocomplete="off" spellcheck="false" placeholder="${hasKey ? `Clé enregistrée (${esc(masked)}) — colle une nouvelle clé pour la remplacer` : 'Colle ta clé ici'}">
      <button class="btn" data-test="${id}">Tester</button></div>
      <div class="hint">La clé est enregistrée uniquement sur ton ordinateur (fichier data/reglages.json) et n'est jamais envoyée à la page web.</div>
    </div>
    <div id="${id}-msg"></div>
    <div class="btn-row"><button class="btn primary" data-savekey="${id}">Enregistrer la clé</button>${hasKey ? `<button class="btn danger" data-delkey="${id}">Supprimer la clé</button>` : ''}</div>
  </div>`;
}

export function renderSettings(el) {
  const draw = () => {
    const s = state.settings;
    const f = s.fees;
    el.innerHTML = `
      ${state.demo ? '<div class="banner warn" style="margin:0 0 16px">Mode démo : les prix sont simulés et les clés API ne sont pas utilisées. Lance « npm start » pour les vrais cours.</div>' : ''}
      <div class="card" style="margin-bottom:16px"><h2>État des sources de données</h2>${sourcesList()}</div>
      <h2 class="section-title">Clés API gratuites (facultatives)</h2>
      <p class="muted">Yahoo Finance fonctionne <strong>sans clé</strong> et couvre toutes les bourses. Les clés ci-dessous améliorent les actions américaines.</p>
      <div class="grid cols-2">
        ${keyBlock('finnhub', '⚡ Finnhub — temps réel US', s, s.hasFinnhubKey, s.finnhubKey, `<ol class="steps small"><li>Crée un compte gratuit sur <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io/register</a>.</li><li>Copie la clé affichée sur ton <a href="https://finnhub.io/dashboard" target="_blank" rel="noopener">tableau de bord</a>.</li><li>Colle-la ici et enregistre.</li></ol><p class="small muted">Gratuit : flux WebSocket temps réel pour 50 actions US, 60 requêtes/min.</p>`)}
        ${keyBlock('twelvedata', '🛟 Twelve Data — source de secours', s, s.hasTwelveDataKey, s.twelveDataKey, `<ol class="steps small"><li>Crée un compte gratuit sur <a href="https://twelvedata.com/register" target="_blank" rel="noopener">twelvedata.com/register</a>.</li><li>Copie ta clé dans <a href="https://twelvedata.com/account/api-keys" target="_blank" rel="noopener">Account → API Keys</a>.</li><li>Colle-la ici et enregistre.</li></ol><p class="small muted">Gratuit : 800 requêtes/jour (8/min), actions US. Utilisée seulement si Yahoo ne répond pas.</p>`)}
      </div>

      <h2 class="section-title">Frais simulés ${help('frais-courtage')}</h2>
      <div class="card">
        <p class="muted small">Des frais réalistes évitent une simulation trop optimiste. Par défaut : 1 € + 0,10 % en Europe, 2 € + 0,15 % ailleurs, 0,25 % de frais de change.</p>
        <div class="grid cols-3">
          <div><h3>Bourses européennes</h3>
            <div class="field-row"><div class="field"><label>Fixe (€)</label><input type="number" step="0.01" min="0" id="fe-fixed" value="${f.europe.fixed}"></div>
            <div class="field"><label>Variable (%)</label><input type="number" step="0.01" min="0" id="fe-pct" value="${f.europe.pct}"></div></div></div>
          <div><h3>Hors Europe</h3>
            <div class="field-row"><div class="field"><label>Fixe (€)</label><input type="number" step="0.01" min="0" id="fi-fixed" value="${f.international.fixed}"></div>
            <div class="field"><label>Variable (%)</label><input type="number" step="0.01" min="0" id="fi-pct" value="${f.international.pct}"></div></div></div>
          <div><h3>Change et fourchette</h3>
            <div class="field-row"><div class="field"><label>Frais de change (%) ${help('frais-change')}</label><input type="number" step="0.01" min="0" id="f-fx" value="${f.fxPct}"></div>
            <div class="field"><label>Fourchette simulée (%) ${help('spread')}</label><input type="number" step="0.01" min="0" id="f-spread" value="${f.spreadPct}"></div></div>
            <div class="hint">La fourchette simulée s'applique quand la source ne donne pas de prix acheteur/vendeur fiables.</div></div>
        </div>
        <div class="field" style="margin-top:8px"><label class="check"><input type="checkbox" id="tob-on" ${f.tob.enabled ? 'checked' : ''}> Appliquer la taxe boursière belge (TOB) ${help('tob')}</label></div>
        <div class="grid cols-2" id="tob-box" ${f.tob.enabled ? '' : 'hidden'}>
          <div class="field-row"><div class="field"><label>Actions (%)</label><input type="number" step="0.01" id="tob-stock" value="${f.tob.stockPct}"></div><div class="field"><label>Plafond actions (€)</label><input type="number" step="1" id="tob-stock-cap" value="${f.tob.stockCap}"></div></div>
          <div class="field-row"><div class="field"><label>ETF (%)</label><input type="number" step="0.01" id="tob-etf" value="${f.tob.etfPct}"></div><div class="field"><label>Plafond ETF (€)</label><input type="number" step="1" id="tob-etf-cap" value="${f.tob.etfCap}"></div></div>
        </div>
      </div>

      <h2 class="section-title">Préférences</h2>
      <div class="card">
        <div class="grid cols-3">
          <div class="field"><label>Actualisation des prix (secondes)</label><input type="number" min="5" max="300" id="p-refresh" value="${s.refreshSeconds}"><div class="hint">15 s conseillé (limites des API gratuites).</div></div>
          <div class="field"><label>Indice de comparaison ${help('msci-world')}</label><input type="text" id="p-bench" value="${esc(s.benchmark)}"><div class="hint">Ticker d'un ETF, ex. IWDA.AS (MSCI World en €), SXR8.DE (S&amp;P 500).</div></div>
          <div class="field"><label>Capital de départ (€)</label><input type="number" min="100" step="100" id="p-capital" value="${s.initialCapital}"><div class="hint">Appliqué à la prochaine réinitialisation.</div></div>
          <div class="field"><label>Thème</label><select id="p-theme"><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Sombre</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Clair</option><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Comme le système</option></select></div>
          <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="p-frac" ${s.allowFractional ? 'checked' : ''}> Autoriser les fractions d'action ${help('fractions')}</label></div>
        </div>
        <div id="set-msg"></div>
        <div class="btn-row"><button class="btn primary" id="set-save">Enregistrer les réglages</button><button class="btn ghost" id="set-defaults">Frais par défaut</button></div>
      </div>

      <h2 class="section-title">Zone sensible</h2>
      <div class="card" style="border-color:color-mix(in srgb, var(--down) 45%, var(--border))">
        <h3>Réinitialiser le portefeuille</h3>
        <p class="muted small">Revenir à ${fmtEur(s.initialCapital, { digits: 0 })} de liquidités : positions, ordres, historique et journal sont remis à zéro (une copie est archivée dans data/archives). Tes favoris et tes réglages sont conservés.</p>
        <button class="btn danger" id="reset-btn">Réinitialiser le portefeuille…</button>
      </div>`;
    bind();
  };

  const bind = () => {
    el.querySelector('#tob-on').addEventListener('change', (e) => (el.querySelector('#tob-box').hidden = !e.target.checked));
    el.querySelectorAll('[data-test]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.test;
        const msg = el.querySelector(`#${id}-msg`);
        msg.innerHTML = '<div class="loading" style="padding:6px 0;justify-content:flex-start"><span class="spinner"></span> Test en cours…</div>';
        try {
          const r = await api('/api/settings/test', { method: 'POST', body: { provider: id, key: el.querySelector(`#${id}-key`).value.trim() } });
          msg.innerHTML = `<div class="form-ok">${esc(r.message)}</div>`;
        } catch (err) {
          msg.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
        }
      }),
    );
    el.querySelectorAll('[data-savekey]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.savekey;
        const value = el.querySelector(`#${id}-key`).value.trim();
        if (!value) return (el.querySelector(`#${id}-msg`).innerHTML = '<div class="form-error">Colle d’abord une clé.</div>');
        await saveSettings({ [id === 'finnhub' ? 'finnhubKey' : 'twelveDataKey']: value }, 'Clé enregistrée.');
      }),
    );
    el.querySelectorAll('[data-delkey]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.delkey;
        await saveSettings({ [id === 'finnhub' ? 'finnhubKey' : 'twelveDataKey']: '' }, 'Clé supprimée.');
      }),
    );
    const n = (id) => Number(el.querySelector(id).value);
    el.querySelector('#set-save').addEventListener('click', () =>
      saveSettings(
        {
          refreshSeconds: n('#p-refresh'),
          benchmark: el.querySelector('#p-bench').value,
          initialCapital: n('#p-capital'),
          theme: el.querySelector('#p-theme').value,
          allowFractional: el.querySelector('#p-frac').checked,
          fees: {
            europe: { fixed: n('#fe-fixed'), pct: n('#fe-pct') },
            international: { fixed: n('#fi-fixed'), pct: n('#fi-pct') },
            fxPct: n('#f-fx'),
            spreadPct: n('#f-spread'),
            tob: { enabled: el.querySelector('#tob-on').checked, stockPct: n('#tob-stock'), stockCap: n('#tob-stock-cap'), etfPct: n('#tob-etf'), etfCap: n('#tob-etf-cap') },
          },
        },
        'Réglages enregistrés.',
      ),
    );
    el.querySelector('#set-defaults').addEventListener('click', () =>
      saveSettings({ fees: { europe: { fixed: 1, pct: 0.1 }, international: { fixed: 2, pct: 0.15 }, fxPct: 0.25, spreadPct: 0.05, tob: { enabled: false } } }, 'Frais par défaut rétablis.'),
    );
    el.querySelector('#reset-btn').addEventListener('click', confirmReset);
  };

  const saveSettings = async (patch, okMsg) => {
    try {
      state.settings = await api('/api/settings', { method: 'PUT', body: patch });
      document.documentElement.dataset.theme = state.settings.theme;
      toast(okMsg, 'success', 3000);
      draw();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  draw();
  return {
    onSources() {
      const card = el.querySelector('.status-list');
      if (card) card.outerHTML = sourcesList();
    },
  };
}

export function confirmReset() {
  const cap = state.settings.initialCapital;
  openModal(
    `<header><h2>Réinitialiser le portefeuille ?</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></header>
     <p>Tu vas repartir de <strong>${fmtEur(cap, { digits: 0 })}</strong> de liquidités. Toutes tes positions, tes ordres, ton historique et ton journal seront remis à zéro.</p>
     <p class="muted small">Une copie de l'ancien portefeuille est gardée dans le dossier data/archives. Favoris et réglages sont conservés.</p>
     <label class="check" style="margin:14px 0"><input type="checkbox" id="rs-ok"> Oui, je veux tout remettre à zéro</label>
     <div class="btn-row" style="justify-content:flex-end"><button class="btn" data-close>Annuler</button><button class="btn danger solid" id="rs-go" disabled>Réinitialiser</button></div>`,
    {
      onMount(modal, close) {
        const ok = modal.querySelector('#rs-ok');
        const go = modal.querySelector('#rs-go');
        ok.addEventListener('change', () => (go.disabled = !ok.checked));
        go.addEventListener('click', async () => {
          try {
            await api('/api/reset', { method: 'POST', body: { confirm: true } });
            close();
            location.hash = '#/portefeuille';
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      },
    },
  );
}

// ---------- Aide ----------

export function renderHelp(el) {
  const terms = Object.entries(GLOSSARY).sort((a, b) => a[1].title.localeCompare(b[1].title, 'fr'));
  el.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <h2>🚀 Bien démarrer</h2>
        <ol class="steps">
          <li>Tu disposes de <strong>${fmtEur(state.settings.initialCapital, { digits: 0 })} fictifs</strong>. Rien n'est réel : teste sans stress !</li>
          <li>Onglet <a href="#/marches">Marchés</a> : cherche une entreprise par son nom (« InBev », « Toyota ») et filtre par pays ou par bourse.</li>
          <li>Ouvre sa fiche : graphique (1 jour à 5 ans), chiffres clés, puis passe un ordre <em>au marché</em> ou <em>limite</em>.</li>
          <li>Note <strong>pourquoi</strong> tu achètes : ton raisonnement est gardé dans le <a href="#/journal">Journal</a>.</li>
          <li>Protège-toi avec un <strong>stop-loss</strong> ${help('stop-loss')} et fixe un objectif avec un <strong>take-profit</strong> ${help('take-profit')}.</li>
          <li>Suis ta progression dans <a href="#/portefeuille">Portefeuille</a> et <a href="#/stats">Statistiques</a>, comparée à un ETF mondial.</li>
        </ol>
        <h3 style="margin-top:16px">Pour acheter « un indice »</h3>
        <p class="muted">Clique sur un indice dans le bandeau du haut (CAC 40, S&amp;P 500…) : l'appli te propose les ETF qui le répliquent.</p>
      </div>
      <div class="card">
        <h2>📡 D'où viennent les prix ?</h2>
        <ul class="steps">
          <li><strong>Yahoo Finance</strong> (sans clé) : toutes les bourses du monde, indices, ETF et taux de change. Temps réel pour les actions américaines, <strong>différé de 15 à 20 min</strong> pour la plupart des autres bourses ${help('differe')}.</li>
          <li><strong>Finnhub</strong> (clé gratuite) : flux <em>WebSocket</em> temps réel des transactions américaines ${help('direct')}.</li>
          <li><strong>Twelve Data</strong> (clé gratuite) : secours pour les actions américaines si Yahoo ne répond pas.</li>
          <li><strong>BCE</strong> (via Frankfurter, sans clé) : secours pour les taux de change.</li>
        </ul>
        <p class="muted small">Chaque prix affiche une pastille : <span class="pill live">En direct</span> <span class="pill delayed">Différé de 15 min</span> <span class="pill closed">Marché fermé</span>. Les ordres s'exécutent au dernier cours connu, uniquement pendant la séance de la bourse concernée.</p>
        <h3 style="margin-top:16px">Ce que le simulateur ne fait pas</h3>
        <ul class="steps small muted">
          <li>Pas de vente à découvert, ni d'effet de levier, ni d'options.</li>
          <li>Les dividendes et les opérations sur titres (divisions d'actions…) ne sont pas versés.</li>
          <li>Les lots minimum de Tokyo et Hong Kong sont ignorés ${help('lot-minimum')}.</li>
        </ul>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>📚 Lexique</h2>
      <dl class="glossary">${terms.map(([, g]) => `<dt>${esc(g.title)}</dt><dd>${esc(g.text)}${g.ex ? ` <em>Exemple : ${esc(g.ex)}</em>` : ''}</dd>`).join('')}</dl>
    </div>`;
  return {};
}
