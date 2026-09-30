// Écrans « Marchés » (recherche), « Favoris » et « Bourses » (horaires).

import { api, esc, state, live, symbolCell, debounce, go, toast } from '../core.js';
import { help } from '../glossary.js';

const SUGGESTIONS = ['AAPL', 'MSFT', 'NVDA', 'ABI.BR', 'KBC.BR', 'UCB.BR', 'MC.PA', 'ASML.AS', 'SAP.DE', 'SHEL.L', 'NESN.SW', '7203.T', '0700.HK', 'RY.TO', 'IWDA.AS', 'SXR8.DE'];

let lastQuery = '';
let lastFilter = '';

export function filterOptions(selected = '') {
  const regions = ['Europe', 'Amérique', 'Asie-Pacifique'];
  const opt = (v, label) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  let html = opt('', '🌍 Toutes les bourses');
  html += `<optgroup label="Régions">${regions.map((r) => opt(`region:${r}`, `Toute la zone ${r}`)).join('')}</optgroup>`;
  for (const r of regions) {
    const exs = state.exchanges.filter((e) => e.region === r).sort((a, b) => a.country.localeCompare(b.country, 'fr'));
    html += `<optgroup label="${esc(r)}">${exs.map((e) => opt(e.id, `${e.country} — ${e.name}${e.suffix ? ` (${e.suffix})` : ''}`)).join('')}</optgroup>`;
  }
  return html;
}

export function starButton(symbol) {
  const on = state.portfolio.watchlist.includes(symbol);
  return `<button class="star${on ? ' on' : ''}" data-star="${esc(symbol)}" title="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-label="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${on ? '★' : '☆'}</button>`;
}

export async function toggleWatch(symbol) {
  try {
    if (state.portfolio.watchlist.includes(symbol)) {
      await api(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
      toast(`${symbol} retiré des favoris.`, 'info', 3000);
    } else {
      await api('/api/watchlist', { method: 'POST', body: { symbol } });
      toast(`${symbol} ajouté aux favoris ★`, 'success', 3000);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

/** Tableau de cotations (recherche, favoris). items : [{ symbol, name, quoteType, exchange }] */
export function quotesTable(items, { emptyText = 'Aucun résultat.' } = {}) {
  if (!items.length) return `<div class="empty">${esc(emptyText)}</div>`;
  const rows = items
    .map((it) => {
      const q = it.quote || state.quotes.get(it.symbol);
      const ex = it.exchange;
      return `<tr class="clickable" data-go="${esc(it.symbol)}">
        <td class="first">${symbolCell({ ...it, name: q?.name || it.name }, { showExchange: false })}</td>
        <td data-label="Bourse"><span class="nowrap">${esc(ex?.country || '')}</span><span class="sub">${esc(ex?.name || '')} · ${live(it.symbol, 'market', q)}</span></td>
        <td class="num" data-label="Cours">${live(it.symbol, 'price', q)}</td>
        <td class="num" data-label="En euros">${live(it.symbol, 'priceEur', q)}</td>
        <td class="num" data-label="Variation du jour">${live(it.symbol, 'change', q)}</td>
        <td data-label="Fraîcheur">${live(it.symbol, 'fresh', q)}</td>
        <td class="num">${starButton(it.symbol)}</td>
      </tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="stack"><thead><tr>
    <th>Action ${help('ticker')}</th><th>Bourse</th><th class="num">Cours</th><th class="num">En €  ${help('risque-change')}</th><th class="num">Variation du jour ${help('variation-jour')}</th><th>Prix ${help('differe')}</th><th></th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function bindQuoteTable(root) {
  root.addEventListener('click', (e) => {
    const star = e.target.closest('[data-star]');
    if (star) {
      e.stopPropagation();
      return toggleWatch(star.dataset.star);
    }
    const row = e.target.closest('[data-go]');
    if (row && !e.target.closest('button, a, input')) go(`#/action/${encodeURIComponent(row.dataset.go)}`);
  });
}

// ---------- Marchés (recherche) ----------

export function renderMarkets(el, params) {
  if (params.q !== undefined) lastQuery = params.q;
  if (params.f !== undefined) lastFilter = params.f;
  el.innerHTML = `
    <div class="card">
      <h2>Chercher une action ou un ETF ${help('ticker')}</h2>
      <p class="muted small">Tape simplement le nom d'une entreprise (ex. « InBev », « LVMH », « Toyota ») ou un ticker (ex. ABI.BR, MC.PA, 7203.T). Filtre par pays ou par bourse pour affiner, ou choisis une bourse sans rien taper pour voir ses grandes valeurs.</p>
      <div class="search-bar">
        <input type="search" id="mk-q" placeholder="Nom d'entreprise ou ticker…" value="${esc(lastQuery)}" autocomplete="off" aria-label="Recherche">
        <select id="mk-f" aria-label="Filtrer par bourse">${filterOptions(lastFilter)}</select>
      </div>
      <div id="mk-warning"></div>
      <div id="mk-results"><div class="loading"><span class="spinner"></span> Recherche…</div></div>
    </div>`;
  const qEl = el.querySelector('#mk-q');
  const fEl = el.querySelector('#mk-f');
  const out = el.querySelector('#mk-results');
  const warn = el.querySelector('#mk-warning');
  bindQuoteTable(out);
  let seq = 0;
  let current = [];

  const run = async () => {
    const q = qEl.value.trim();
    const f = fEl.value;
    lastQuery = q;
    lastFilter = f;
    history.replaceState(null, '', `#/marches${q || f ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { f } : {}) })}` : ''}`);
    const my = ++seq;
    out.innerHTML = '<div class="loading"><span class="spinner"></span> Recherche…</div>';
    warn.innerHTML = '';
    try {
      let results;
      let warning = null;
      if (!q && !f) {
        const r = await api(`/api/quotes?symbols=${SUGGESTIONS.join(',')}`);
        results = r.quotes.map((x) => ({ symbol: x.symbol, name: x.name, quoteType: x.quoteType, exchange: x.exchange, quote: x }));
        if (!results.length) warning = r.sources?.yahoo?.message;
      } else {
        const params = new URLSearchParams({ q });
        if (f.startsWith('region:')) params.set('region', f.slice(7));
        else if (f) params.set('exchange', f);
        const r = await api(`/api/search?${params}`);
        results = r.results;
        warning = r.warning;
      }
      if (my !== seq) return;
      for (const r of results) if (r.quote) state.quotes.set(r.symbol, r.quote);
      current = results;
      const title = !q && !f ? '<h3 class="section-title" style="margin-top:6px">Suggestions du jour</h3>' : `<p class="muted small">${results.length} résultat${results.length > 1 ? 's' : ''}</p>`;
      out.innerHTML = title + quotesTable(results, { emptyText: 'Aucun résultat.' });
      if (warning) warn.innerHTML = `<div class="banner warn" style="margin:0 0 12px">${esc(warning)}</div>`;
    } catch (err) {
      if (my !== seq) return;
      out.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    }
  };
  const debounced = debounce(run, 350);
  qEl.addEventListener('input', debounced);
  qEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
  fEl.addEventListener('change', run);
  run();
  qEl.focus();

  return {
    focusSymbols: () => current.map((r) => r.symbol),
    onPortfolio() {
      el.querySelectorAll('[data-star]').forEach((b) => (b.outerHTML = starButton(b.dataset.star)));
    },
  };
}

// ---------- Favoris ----------

export function renderWatchlist(el) {
  el.innerHTML = `<div class="card"><div class="card-head"><h2>★ Mes favoris</h2><a class="btn small" href="#/marches">+ Ajouter depuis la recherche</a></div><div id="wl"></div></div>`;
  const box = el.querySelector('#wl');
  bindQuoteTable(box);
  const draw = async () => {
    const symbols = state.portfolio.watchlist;
    if (!symbols.length) {
      box.innerHTML = `<div class="empty">Ta liste de suivi est vide.<br>Clique sur l'étoile ☆ à côté d'une action pour la suivre ici.</div>`;
      return;
    }
    const missing = symbols.filter((s) => !state.quotes.has(s));
    if (missing.length) {
      try {
        const r = await api(`/api/quotes?symbols=${missing.join(',')}`);
        for (const q of r.quotes) state.quotes.set(q.symbol, q);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
    const items = symbols.map((s) => {
      const q = state.quotes.get(s);
      return { symbol: s, name: q?.name || s, quoteType: q?.quoteType, exchange: q?.exchange, quote: q };
    });
    box.innerHTML = quotesTable(items);
  };
  draw();
  return { focusSymbols: () => state.portfolio.watchlist, onPortfolio: draw };
}

// ---------- Bourses (horaires) ----------

export function renderExchanges(el) {
  el.innerHTML = `<div class="card"><h2>Bourses du monde ${help('horaires')}</h2>
    <p class="muted small">Horaires de la séance continue, affichés en <strong>heure de Bruxelles</strong> (changements d'heure et jours fériés principaux compris). Quand une bourse est fermée, tes ordres au marché attendent son ouverture.</p>
    <div id="ex-table"></div></div>`;
  const draw = () => {
    const regions = ['Europe', 'Amérique', 'Asie-Pacifique'];
    el.querySelector('#ex-table').innerHTML = regions
      .map((r) => {
        const rows = state.markets
          .filter((m) => m.region === r)
          .map((m) => {
            const dot = m.open ? 'open' : m.state === 'break' ? 'break' : 'closed';
            return `<tr>
              <td class="first"><div class="sym"><span class="s-name">${esc(m.name)}</span><span class="s-meta">${esc(m.city)}, ${esc(m.country)} · suffixe <span class="mono">${esc(m.suffix || '(aucun)')}</span></span></div></td>
              <td data-label="Devise">${esc(m.currency)}</td>
              <td data-label="État"><span class="nowrap"><span class="dot ${dot}"></span> ${esc(m.label)}</span></td>
              <td data-label="Horaires (Bruxelles)" class="nowrap">${esc(m.hoursBrussels)}</td>
              <td data-label="Prochain événement" class="small">${esc(m.detail)}</td>
              <td data-label="Heure locale" class="num">${esc(m.localTime)}</td>
            </tr>`;
          })
          .join('');
        return `<h3 class="section-title">${esc(r)}</h3><div class="table-wrap"><table class="stack"><thead><tr><th>Bourse</th><th>Devise</th><th>État</th><th>Horaires (Bruxelles)</th><th>Prochain événement</th><th class="num">Heure locale</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      })
      .join('');
  };
  draw();
  return { onMarkets: draw };
}

