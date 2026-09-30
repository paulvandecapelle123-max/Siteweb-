// Outils partagés : formatage (fr-BE), appels au serveur local, état global,
// cellules « en direct », fenêtres modales et notifications.

// ---------- Formatage ----------

const formatters = new Map();
function nf(min, max) {
  const key = `${min}-${max}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat('fr-BE', { minimumFractionDigits: min, maximumFractionDigits: max }));
  return formatters.get(key);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fmtNum(x, digits = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return nf(digits, digits).format(x);
}

/** Nombre de décimales adapté au prix et à la devise. */
export function priceDigits(x, cur) {
  if (['JPY', 'KRW', 'IDR', 'HUF', 'CLP'].includes(cur) && Math.abs(x) >= 100) return 0;
  if (Math.abs(x) < 1) return 4;
  return 2;
}

export function fmtPrice(x, cur) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = fmtNum(x, priceDigits(x, cur));
  return cur === 'EUR' ? `${s} €` : `${s} ${esc(cur || '')}`;
}

export function fmtEur(x, { sign = false, digits = 2 } = {}) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = fmtNum(Math.abs(x), digits);
  const prefix = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return `${prefix}${s} €`;
}

export function fmtPct(x, { sign = true, digits = 2 } = {}) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = fmtNum(Math.abs(x), digits);
  const prefix = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return `${prefix}${s} %`;
}

export function fmtSigned(x, cur) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = fmtNum(Math.abs(x), priceDigits(x, cur));
  const prefix = x < 0 ? '−' : x > 0 ? '+' : '';
  return `${prefix}${s} ${cur === 'EUR' ? '€' : esc(cur || '')}`;
}

export function cls(x) {
  if (x == null || !Number.isFinite(x) || Math.abs(x) < 1e-9) return 'flat';
  return x > 0 ? 'up' : 'down';
}

export function arrow(x) {
  if (x == null || !Number.isFinite(x) || Math.abs(x) < 1e-9) return '';
  return x > 0 ? '▲ ' : '▼ ';
}

export function fmtQty(x) {
  if (x == null) return '—';
  return Number.isInteger(x) ? nf(0, 0).format(x) : nf(0, 4).format(x);
}

export function fmtBig(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return `${fmtNum(n / 1e12, 2)} billion`;
  if (a >= 1e9) return `${fmtNum(n / 1e9, 1)} Md`;
  if (a >= 1e6) return `${fmtNum(n / 1e6, 1)} M`;
  if (a >= 1e3) return `${fmtNum(n / 1e3, 1)} k`;
  return fmtNum(n, 0);
}

const dtf = new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric' });
const tf = new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' });

export function fmtDateTime(ms) {
  return ms ? dtf.format(new Date(ms)) : '—';
}
export function fmtDate(ms) {
  return ms ? df.format(new Date(ms)) : '—';
}
export function fmtTime(ms) {
  return ms ? tf.format(new Date(ms)) : '—';
}

/** Décalage horaire de Bruxelles (en secondes) à un instant donné : sert aux graphiques. */
const brusselsParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
export function brusselsOffsetSec(sec) {
  const p = {};
  for (const x of brusselsParts.formatToParts(new Date(sec * 1000))) p[x.type] = x.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - sec * 1000) / 1000);
}

// ---------- Appels au serveur local ----------

export async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} };
  if (method !== 'GET') opts.headers['X-Simulateur'] = '1';
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new Error('Le serveur local ne répond pas. Vérifie qu’il tourne toujours (commande « npm start »).');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* réponse vide */
  }
  if (!res.ok) {
    const e = new Error(data?.error || `Erreur ${res.status}`);
    e.code = data?.code;
    throw e;
  }
  return data;
}

// ---------- État global & événements ----------

export const state = {
  demo: false,
  settings: null,
  portfolio: { valuation: null, orders: [], watchlist: [] },
  markets: [],
  exchanges: [],
  indices: [],
  indexEtfs: {},
  sources: {},
  fx: null,
  quotes: new Map(),
};

const bus = new EventTarget();
export function on(type, fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}
export function emit(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

export function exchangeById(id) {
  return state.exchanges.find((e) => e.id === id) || null;
}

export function marketById(id) {
  return state.markets.find((m) => m.id === id) || null;
}

// ---------- Cellules mises à jour en direct ----------

export function freshPill(q) {
  if (!q?.freshness) return '<span class="pill closed">—</span>';
  const f = q.freshness;
  return `<span class="pill ${esc(f.kind)}" title="${esc(f.note || '')}">${esc(f.label)}</span>`;
}

export function changeHtml(pct, abs, cur) {
  if (pct == null) return '<span class="flat">—</span>';
  const c = cls(pct);
  return `<span class="chg ${c}">${arrow(pct)}${fmtPct(pct)}${abs != null ? ` <span class="small">(${fmtSigned(abs, cur)})</span>` : ''}</span>`;
}

export function marketHtml(q) {
  const m = q?.market;
  if (!m) return '';
  const dot = m.open ? 'open' : m.state === 'break' ? 'break' : 'closed';
  return `<span class="nowrap" title="${esc(m.detail)} — horaires (heure de Bruxelles) : ${esc(m.hoursBrussels || '')}"><span class="dot ${dot}"></span> ${m.open ? 'Ouverte' : m.state === 'break' ? 'Pause' : 'Fermée'}</span>`;
}

export function renderField(q, field) {
  if (!q) return '—';
  switch (field) {
    case 'price':
      return fmtPrice(q.price, q.currency);
    case 'priceEur':
      return q.currency === 'EUR' ? '' : fmtEur(q.priceEur);
    case 'priceBoth':
      return `${fmtPrice(q.price, q.currency)}${q.currency !== 'EUR' ? `<span class="sub">${fmtEur(q.priceEur)}</span>` : ''}`;
    case 'change':
      return changeHtml(q.changePct, q.change, q.currency);
    case 'changePct':
      return q.changePct == null ? '—' : `<span class="chg ${cls(q.changePct)}">${arrow(q.changePct)}${fmtPct(q.changePct)}</span>`;
    case 'fresh':
      return freshPill(q);
    case 'market':
      return marketHtml(q);
    case 'big':
      return fmtPrice(q.price, q.currency);
    default:
      return undefined;
  }
}

export function live(symbol, field, q = state.quotes.get(symbol)) {
  return `<span data-q="${esc(symbol)}" data-f="${field}" data-v="${q?.price ?? ''}">${renderField(q, field)}</span>`;
}

export function patchLive(quotes) {
  for (const q of quotes) {
    const els = document.querySelectorAll(`[data-q="${CSS.escape(q.symbol)}"]`);
    for (const el of els) {
      const prev = Number(el.dataset.v);
      const html = renderField(q, el.dataset.f);
      if (html === undefined) continue;
      el.innerHTML = html;
      if (['price', 'big', 'priceBoth'].includes(el.dataset.f) && prev && q.price && prev !== q.price) {
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(q.price > prev ? 'flash-up' : 'flash-down');
      }
      el.dataset.v = q.price ?? '';
    }
  }
}

// ---------- Fenêtre modale ----------

export function openModal(html, { onMount, wide = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" style="${wide ? 'width:min(760px,100%)' : ''}">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  const modal = backdrop.firstElementChild;
  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(modal, close);
  const first = modal.querySelector('input, textarea, button:not([data-close])');
  first?.focus();
  return close;
}

// ---------- Notifications ----------

export function toast(message, type = 'info', ms = 6000) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), ms);
  while (box.children.length > 5) box.firstElementChild.remove();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function symbolCell(item, { showExchange = true } = {}) {
  const ex = item.exchange || exchangeById(item.exchangeId);
  const type = item.quoteType === 'ETF' ? '<span class="pill etf">ETF</span>' : '';
  return `<div class="sym"><span class="s-name" title="${esc(item.name)}">${esc(item.name)}</span><span class="s-meta"><span class="mono">${esc(item.symbol)}</span>${type}${showExchange && ex ? `<span>· ${esc(ex.name)}</span>` : ''}</span></div>`;
}

export function go(hash) {
  location.hash = hash;
}
