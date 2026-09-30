// Point d'entrée : chargement initial, flux temps réel, navigation, bandeau des indices.

import { api, esc, state, patchLive, fmtEur, fmtPct, fmtNum, cls, arrow, toast, openModal, live, symbolCell, go } from './core.js';
import { initTooltips, help } from './glossary.js';
import { render as renderPortfolio } from './views/portfolio.js';
import { renderMarkets, renderWatchlist, renderExchanges } from './views/markets.js';
import { renderStock } from './views/stock.js';
import { renderOrders, renderJournal } from './views/orders.js';
import { renderStats } from './views/stats.js';
import { renderSettings, renderHelp, sourcesList, sourceDotClass } from './views/settings.js';

const ROUTES = {
  portefeuille: { render: renderPortfolio, title: 'Portefeuille' },
  marches: { render: renderMarkets, title: 'Marchés' },
  favoris: { render: renderWatchlist, title: 'Favoris' },
  ordres: { render: renderOrders, title: 'Ordres & historique' },
  journal: { render: renderJournal, title: 'Journal' },
  stats: { render: renderStats, title: 'Statistiques' },
  bourses: { render: renderExchanges, title: 'Bourses' },
  reglages: { render: renderSettings, title: 'Réglages' },
  aide: { render: renderHelp, title: 'Aide' },
  action: { render: renderStock, title: 'Action', tab: 'marches' },
};

let current = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'portefeuille';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (parts[0] === 'action') params.symbol = parts.slice(1).join('/');
  return { name: ROUTES[parts[0]] ? parts[0] : 'portefeuille', params };
}

function navigate() {
  const { name, params } = parseHash();
  const route = ROUTES[name];
  try {
    current?.cleanup?.();
  } catch {
    /* rien */
  }
  const view = document.getElementById('view');
  view.innerHTML = '';
  const host = document.createElement('div');
  view.appendChild(host);
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === (route.tab || name)));
  document.getElementById('tooltip').classList.remove('show');
  document.title = `${name === 'action' ? decodeURIComponent(params.symbol || '') : route.title} · Simulateur de bourse`;
  current = route.render(host, params) || {};
  sendFocus();
  window.scrollTo(0, 0);
}

// Indique au serveur quels tickers la page affiche (il les actualise en priorité)
let focusTimer = null;
function sendFocus() {
  clearTimeout(focusTimer);
  const symbols = current?.focusSymbols?.() || [];
  if (symbols.length) api('/api/focus', { method: 'POST', body: { symbols } }).catch(() => {});
  focusTimer = setTimeout(sendFocus, 60000);
}

// ---------- En-tête ----------

function renderHeader() {
  const v = state.portfolio.valuation;
  if (v) {
    document.getElementById('hdr-total').textContent = fmtEur(v.total);
    const perf = document.getElementById('hdr-perf');
    perf.className = `small ${cls(v.perfEur)}`;
    perf.textContent = `${arrow(v.perfEur)}${fmtEur(v.perfEur, { sign: true })} (${fmtPct(v.perfPct)})`;
  }
  const pending = state.portfolio.orders.filter((o) => o.status === 'pending').length;
  const badge = document.getElementById('pending-count');
  badge.textContent = pending;
  badge.classList.toggle('hidden', !pending);
}

function worstSource() {
  const s = state.sources || {};
  const classes = ['yahoo', 'finnhub', 'twelvedata', 'fx'].map((k) => sourceDotClass(s[k]));
  if (sourceDotClass(s.yahoo) === 'err' || classes.includes('err')) return 'err';
  if (classes.includes('warn')) return 'warn';
  return sourceDotClass(s.yahoo) === 'ok' ? 'ok' : '';
}

function renderSources() {
  document.getElementById('sources-dot').className = `source-dot ${worstSource()}`;
  const banners = document.getElementById('banners');
  const y = state.sources?.yahoo;
  const msgs = [];
  if (y && (y.state === 'error' || y.state === 'rate-limit')) msgs.push({ kind: y.state === 'error' ? 'err' : 'warn', text: `⚠️ ${y.message} Les prix affichés peuvent dater.` });
  const f = state.sources?.finnhub;
  if (f && f.state === 'invalid-key') msgs.push({ kind: 'warn', text: `⚠️ ${f.message}` });
  banners.innerHTML = msgs.map((m) => `<div class="banner ${m.kind}">${esc(m.text)}</div>`).join('');
}

// ---------- Bandeau des indices ----------

function renderTicker() {
  const bar = document.getElementById('ticker-bar');
  const chips = state.indices.map((i) => {
    const q = state.quotes.get(i.symbol);
    return `<button class="ticker" data-index="${esc(i.symbol)}" title="${esc(i.name)} — cliquer pour voir les ETF qui le suivent">
      <span class="t-name">${esc(i.name)} <span data-q="${esc(i.symbol)}" data-f="fresh-dot">${freshDot(q)}</span></span>
      <span class="t-val" data-q="${esc(i.symbol)}" data-f="idx-val">${q ? fmtNum(q.price, 2) : '—'}</span>
      <span class="t-chg" data-q="${esc(i.symbol)}" data-f="changePct">${q?.changePct != null ? `<span class="chg ${cls(q.changePct)}">${arrow(q.changePct)}${fmtPct(q.changePct)}</span>` : '—'}</span>
    </button>`;
  });
  const usd = state.fx?.rates?.USD;
  chips.push(`<div class="ticker" style="cursor:default" title="Taux de change utilisé pour convertir les prix en euros"><span class="t-name">EUR / USD ${help('risque-change')}</span><span class="t-val" id="fx-usd">${usd ? fmtNum(usd, 4) : '—'}</span><span class="t-chg muted">1 € en dollars</span></div>`);
  bar.innerHTML = chips.join('');
}

function freshDot(q) {
  if (!q?.market) return '';
  return `<span class="dot ${q.market.open ? 'open' : 'closed'}" title="${esc(q.market.detail)} · ${esc(q.freshness?.label || '')}"></span>`;
}

function patchTicker(quotes) {
  for (const q of quotes) {
    document.querySelectorAll(`#ticker-bar [data-q="${CSS.escape(q.symbol)}"]`).forEach((el) => {
      if (el.dataset.f === 'idx-val') el.textContent = fmtNum(q.price, 2);
      if (el.dataset.f === 'fresh-dot') el.innerHTML = freshDot(q);
    });
  }
  const usdQuote = quotes.find((q) => q.currency === 'USD' && q.fxRate);
  if (usdQuote && state.fx?.rates) state.fx.rates.USD = usdQuote.fxRate;
  const usd = state.fx?.rates?.USD;
  const fx = document.getElementById('fx-usd');
  if (fx && usd) fx.textContent = fmtNum(usd, 4);
}

async function openEtfs(idx) {
  const q = state.quotes.get(idx.symbol);
  const close = openModal(
    `<header><div><h2>${esc(idx.name)} ${help('indice')}</h2>
      <div class="small muted">${q ? `${fmtNum(q.price, 2)} points · <span class="chg ${cls(q.changePct)}">${fmtPct(q.changePct)}</span> · ${esc(q.market?.detail || '')}` : ''}</div></div>
      <button class="icon-btn" data-close aria-label="Fermer">✕</button></header>
     <p class="muted small">Un indice ne s'achète pas directement : on achète un ETF qui le réplique ${help('etf')}.</p>
     <div id="etf-body"><div class="loading"><span class="spinner"></span> Chargement des ETF…</div></div>
     <div class="btn-row" style="justify-content:space-between;margin-top:12px"><a class="btn small" href="#/action/${encodeURIComponent(idx.symbol)}" id="etf-chart">📈 Graphique de l'indice</a><button class="btn" data-close>Fermer</button></div>`,
    { wide: true },
  );
  document.getElementById('etf-chart')?.addEventListener('click', () => close());
  try {
    const r = await api(`/api/etfs?key=${idx.etf}`);
    const body = document.getElementById('etf-body');
    if (!body) return;
    for (const e of r.etfs) state.quotes.set(e.symbol, e.quote);
    const rows = r.etfs.map((e) => ({ symbol: e.symbol, name: e.name, quoteType: e.quote.quoteType, exchange: e.quote.exchange, quote: e.quote }));
    body.innerHTML = `<p>${esc(r.note)}</p>${rows.length ? `<div class="table-wrap"><table class="stack"><thead><tr><th>ETF / action</th><th>Bourse</th><th class="num">Cours</th><th class="num">Jour</th><th></th></tr></thead><tbody>${rows
      .map(
        (e) => `<tr class="clickable" data-go="${esc(e.symbol)}"><td class="first">${symbolCell(e, { showExchange: false })}</td>
        <td data-label="Bourse" class="small">${esc(e.exchange?.name || '')}<span class="sub">${esc(e.quote.currency)}</span></td>
        <td class="num" data-label="Cours">${live(e.symbol, 'priceBoth', e.quote)}</td>
        <td class="num" data-label="Jour">${live(e.symbol, 'changePct', e.quote)}</td>
        <td class="num"><button class="btn small primary" data-go-btn="${esc(e.symbol)}">Voir / acheter</button></td></tr>`,
      )
      .join('')}</tbody></table></div>` : '<p class="muted">Aucun ETF disponible pour le moment (source de données indisponible ?).</p>'}
      ${r.unavailable ? `<p class="small muted">${r.unavailable} produit(s) momentanément introuvable(s) chez la source de données.</p>` : ''}`;
    body.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-go-btn], [data-go]');
      if (!t) return;
      close();
      go(`#/action/${encodeURIComponent(t.dataset.goBtn || t.dataset.go)}`);
    });
  } catch (err) {
    const body = document.getElementById('etf-body');
    if (body) body.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
  }
}

// ---------- Flux temps réel ----------

function connectStream() {
  const es = new EventSource('/api/stream');
  let wasDown = false;
  es.addEventListener('open', () => {
    if (wasDown) {
      toast('Connexion au serveur local rétablie.', 'success', 3000);
      refreshAll();
    }
    wasDown = false;
  });
  es.addEventListener('error', () => {
    if (!wasDown) {
      wasDown = true;
      document.getElementById('banners').innerHTML = '<div class="banner err">Connexion au serveur local perdue. Vérifie que « npm start » tourne toujours ; reconnexion automatique…</div>';
    }
  });
  const handle = (type, fn) =>
    es.addEventListener(type, (e) => {
      try {
        fn(JSON.parse(e.data));
      } catch (err) {
        console.error(type, err);
      }
    });
  handle('quotes', (quotes) => {
    for (const q of quotes) state.quotes.set(q.symbol, q);
    patchLive(quotes);
    patchTicker(quotes);
    current?.onQuotes?.(quotes);
  });
  handle('valuation', (v) => {
    state.portfolio.valuation = v;
    renderHeader();
    current?.onValuation?.();
  });
  handle('portfolio', (p) => {
    state.portfolio = p;
    renderHeader();
    current?.onPortfolio?.();
  });
  handle('notify', (n) => toast(n.message, n.type, n.type === 'info' ? 6000 : 9000));
  handle('sources', (s) => {
    state.sources = s;
    renderSources();
    current?.onSources?.();
  });
  handle('markets', (m) => {
    state.markets = m;
    current?.onMarkets?.();
  });
  handle('settings', (s) => {
    state.settings = s;
    document.documentElement.dataset.theme = s.theme;
  });
}

async function refreshAll() {
  const b = await api('/api/bootstrap');
  Object.assign(state, {
    demo: b.demo,
    settings: b.settings,
    portfolio: b.portfolio,
    markets: b.markets,
    exchanges: b.exchanges,
    indices: b.indices,
    indexEtfs: b.indexEtfs,
    sources: b.sources,
    fx: b.fx,
  });
  for (const q of b.quotes) state.quotes.set(q.symbol, q);
  renderHeader();
  renderSources();
  renderTicker();
}

// ---------- Démarrage ----------

async function start() {
  initTooltips();
  try {
    await refreshAll();
  } catch (err) {
    document.getElementById('view').innerHTML = `<div class="card"><h2>Impossible de joindre le serveur local</h2><p>${esc(err.message)}</p></div>`;
    return;
  }
  document.documentElement.dataset.theme = state.settings.theme;
  document.getElementById('demo-badge').classList.toggle('hidden', !state.demo);

  document.getElementById('ticker-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-index]');
    if (b && !e.target.closest('[data-help]')) {
      const idx = state.indices.find((i) => i.symbol === b.dataset.index);
      if (idx) openEtfs(idx);
    }
  });
  window.addEventListener('open-etfs', (e) => openEtfs(e.detail));

  document.getElementById('theme-btn').addEventListener('click', async () => {
    const order = ['dark', 'light', 'auto'];
    const next = order[(order.indexOf(state.settings.theme) + 1) % order.length];
    document.documentElement.dataset.theme = next;
    try {
      state.settings = await api('/api/settings', { method: 'PUT', body: { theme: next } });
    } catch {
      /* rien */
    }
    toast(`Thème : ${next === 'dark' ? 'sombre' : next === 'light' ? 'clair' : 'comme le système'}`, 'info', 2000);
    navigate(); // redessine les graphiques avec les nouvelles couleurs
  });

  document.getElementById('sources-btn').addEventListener('click', () => {
    openModal(`<header><h2>Sources de données</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></header>${sourcesList()}
      <p class="small muted" style="margin-top:12px">Actualisation toutes les ${state.settings.refreshSeconds} s. Les clés se règlent dans <a href="#/reglages" data-close>Réglages</a>.</p>`);
  });

  window.addEventListener('hashchange', navigate);
  navigate();
  connectStream();
}

start();
