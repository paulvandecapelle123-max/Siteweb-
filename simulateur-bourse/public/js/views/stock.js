// Écran « Action » : cours, graphique, chiffres clés, ma position et formulaire d'ordre.

import { api, esc, state, live, fmtPrice, fmtEur, fmtPct, fmtQty, fmtNum, fmtBig, fmtDateTime, cls, debounce, freshPill } from '../core.js';
import { help } from '../glossary.js';
import { createPriceChart } from '../charts.js';
import { starButton, toggleWatch } from './markets.js';
import { openProtectionModal, cancelOrder } from './portfolio.js';

const RANGES = [
  ['1d', '1 jour'],
  ['1w', '1 semaine'],
  ['1m', '1 mois'],
  ['1y', '1 an'],
  ['5y', '5 ans'],
];

let lastRange = '1m';
let lastType = 'area';

function annualVolatility(candles) {
  if (!candles || candles.length < 20) return null;
  const rets = [];
  for (let i = 1; i < candles.length; i++) rets.push(Math.log(candles[i].close / candles[i - 1].close));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v) * Math.sqrt(252) * 100;
}

function fact(label, value, helpKey = '') {
  return `<div class="fact"><div class="f-label">${esc(label)} ${helpKey ? help(helpKey) : ''}</div><div class="f-value">${value}</div></div>`;
}

export function renderStock(el, params) {
  const symbol = decodeURIComponent(params.symbol || '').toUpperCase();
  let side = params.side === 'sell' ? 'sell' : 'buy';
  let type = 'market';
  let q = state.quotes.get(symbol) || null;
  let profile = null;
  let volatility = null;
  let chartCtl = null;
  let destroyed = false;

  el.innerHTML = `<div class="loading"><span class="spinner"></span> Chargement de ${esc(symbol)}…</div>`;

  const layout = () => {
    const ex = q.exchange;
    const isIndex = q.isIndex;
    el.innerHTML = `
      <div class="stock-head">
        <div>
          <h1>${esc(q.name)} ${starButton(symbol)}</h1>
          <div class="meta-line">
            <span class="mono">${esc(symbol)}</span> ${help('ticker')}
            ${q.quoteType === 'ETF' ? `<span class="pill etf">ETF</span> ${help('etf')}` : ''}
            <span>· ${esc(ex?.name || q.yahooExchange || '')}${ex ? ` (${esc(ex.country)})` : ''}</span>
            <span>· ${live(symbol, 'market', q)}</span>
            <span>${live(symbol, 'fresh', q)}</span>
          </div>
          <div class="meta-line small" style="margin-top:4px" id="st-hours"></div>
          <div class="meta-line small" style="margin-top:4px" id="st-profile"></div>
        </div>
        <div class="stock-price">
          <div class="big">${live(symbol, 'big', q)}</div>
          <div>${live(symbol, 'change', q)}</div>
          <div class="eur" id="st-eur"></div>
          <div class="small muted" id="st-ext"></div>
        </div>
      </div>
      <div class="grid stock">
        <div class="grid" style="gap:16px">
          <div class="card">
            <div class="chart-toolbar">
              <div class="segmented" id="st-ranges">${RANGES.map(([k, l]) => `<button data-range="${k}" class="${k === lastRange ? 'active' : ''}">${l}</button>`).join('')}</div>
              <div class="segmented" id="st-types"><button data-type="area" class="${lastType === 'area' ? 'active' : ''}">Ligne</button><button data-type="candles" class="${lastType === 'candles' ? 'active' : ''}">Bougies</button></div>
            </div>
            <div class="legend" id="st-legend" style="min-height:20px;margin-bottom:6px"></div>
            <div class="chart-box" id="st-chart"><div class="chart-overlay" id="st-chart-msg"><span class="spinner"></span></div></div>
            <p class="muted small" style="margin-top:8px">Heures affichées en heure de Bruxelles. Graphique <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView Lightweight Charts</a>.</p>
          </div>
          <div class="card"><h2>Chiffres clés</h2><div class="facts" id="st-facts"></div></div>
          <div class="card" id="st-position"></div>
          <div class="card" id="st-orders"></div>
        </div>
        <div class="card ticket" id="st-ticket">${isIndex ? indexTicket() : ticketHtml()}</div>
      </div>`;
    bindHead();
    drawDynamic();
    if (!isIndex) bindTicket();
    loadChart();
  };

  const indexTicket = () => {
    const idx = state.indices.find((i) => i.symbol === symbol);
    return `<h2>Acheter cet indice ? ${help('indice')}</h2>
      <p class="muted">Un indice n'est pas une action : on ne peut pas l'acheter directement. On achète un <strong>ETF</strong> qui le réplique ${help('etf')}.</p>
      ${idx ? `<button class="btn primary block" id="st-etfs">Voir les ETF qui suivent le ${esc(idx.name)}</button>` : '<a class="btn primary block" href="#/marches?q=ETF">Chercher un ETF</a>'}`;
  };

  const ticketHtml = () => `
    <h2>Passer un ordre ${help('paper-trading')}</h2>
    <div class="segmented buy-sell full" id="tk-side" style="margin-bottom:12px">
      <button data-side="buy" class="${side === 'buy' ? 'active' : ''}">Acheter</button>
      <button data-side="sell" class="${side === 'sell' ? 'active' : ''}">Vendre</button>
    </div>
    <div class="field"><label>Type d'ordre ${help('ordre-marche')} ${help('ordre-limite')}</label>
      <div class="segmented full" id="tk-type"><button data-type="market" class="active">Au marché</button><button data-type="limit">Limite</button></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="tk-qty">Quantité</label><input id="tk-qty" type="number" min="0" step="${state.settings.allowFractional ? 'any' : '1'}" value="1" inputmode="decimal"><div class="hint" id="tk-qty-hint"></div></div>
      <div class="field" id="tk-limit-field" hidden><label for="tk-limit">Prix limite (${esc(q.currency)})</label><input id="tk-limit" type="number" min="0" step="any" inputmode="decimal"></div>
    </div>
    <details class="more" id="tk-protect"><summary>🛡️ Stop-loss / take-profit (facultatif)</summary>
      <div class="field-row" style="margin-top:8px">
        <div class="field"><label for="tk-sl">Stop-loss (${esc(q.currency)}) ${help('stop-loss')}</label><input id="tk-sl" type="number" min="0" step="any" placeholder="ex. −10 %"></div>
        <div class="field"><label for="tk-tp">Take-profit (${esc(q.currency)}) ${help('take-profit')}</label><input id="tk-tp" type="number" min="0" step="any" placeholder="ex. +20 %"></div>
      </div>
    </details>
    <div class="field"><label for="tk-reason">Pourquoi je prends cette position ? <span class="muted">(facultatif)</span></label>
      <textarea id="tk-reason" placeholder="Ex. : bons résultats trimestriels, je vise +15 % en 6 mois et je coupe à −8 %."></textarea>
      <div class="hint">Ton raisonnement est gardé dans le Journal pour que tu puisses le relire plus tard.</div>
    </div>
    <div id="tk-estimate" class="estimate"><span class="muted">Estimation…</span></div>
    <div id="tk-msg"></div>
    <button class="btn block ${side === 'buy' ? 'buy' : 'sell'}" id="tk-submit">${side === 'buy' ? 'Acheter' : 'Vendre'}</button>
    <p class="hint" style="margin-top:8px">Argent fictif. Frais simulés ${help('frais-courtage')} ${help('frais-change')} ${help('spread')}</p>`;

  const bindHead = () => {
    el.querySelector('.stock-head').addEventListener('click', (e) => {
      const star = e.target.closest('[data-star]');
      if (star) toggleWatch(star.dataset.star);
    });
    el.querySelector('#st-ranges').addEventListener('click', (e) => {
      const b = e.target.closest('[data-range]');
      if (!b) return;
      lastRange = b.dataset.range;
      el.querySelectorAll('#st-ranges button').forEach((x) => x.classList.toggle('active', x === b));
      loadChart();
    });
    el.querySelector('#st-types').addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      lastType = b.dataset.type;
      el.querySelectorAll('#st-types button').forEach((x) => x.classList.toggle('active', x === b));
      loadChart();
    });
    el.querySelector('#st-etfs')?.addEventListener('click', () => {
      const idx = state.indices.find((i) => i.symbol === symbol);
      if (idx) window.dispatchEvent(new CustomEvent('open-etfs', { detail: idx }));
    });
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-protect]');
      if (p) openProtectionModal(p.dataset.protect);
      const c = e.target.closest('[data-cancel]');
      if (c) cancelOrder(c.dataset.cancel);
    });
  };

  const drawDynamic = () => {
    if (!q) return;
    const eur = el.querySelector('#st-eur');
    if (eur) {
      eur.innerHTML = q.currency !== 'EUR' && q.fxRate
        ? `≈ ${fmtEur(q.priceEur)} · 1 € = ${fmtNum(q.fxRate, q.fxRate > 100 ? 2 : 4)} ${esc(q.currency)} ${help('risque-change')}${q.unitNote ? ` · ${esc(q.unitNote)} ${help('pence')}` : ''}`
        : q.currency !== 'EUR' ? 'Taux de change indisponible' : '';
    }
    const ext = el.querySelector('#st-ext');
    if (ext) ext.innerHTML = q.ext?.price ? `${esc(q.ext.label)} : ${fmtPrice(q.ext.price, q.currency)} ${q.ext.changePct != null ? `(${fmtPct(q.ext.changePct)})` : ''} ${help('avant-apres-bourse')}` : '';
    const hours = el.querySelector('#st-hours');
    if (hours && q.market) hours.innerHTML = `🕘 ${esc(q.market.detail)} · séance ${esc(q.market.hoursBrussels)} (heure de Bruxelles) ${help('horaires')}`;
    const prof = el.querySelector('#st-profile');
    if (prof && profile) prof.innerHTML = `${esc(profile.sector || '')}${profile.industry && profile.industry !== 'Demo' ? ` · ${esc(profile.industry)}` : ''}${profile.country ? ` · siège : ${esc(profile.country)}` : ''}`;

    const facts = el.querySelector('#st-facts');
    if (facts) {
      const c = q.currency;
      facts.innerHTML = [
        fact('Cours', fmtPrice(q.price, c)),
        fact('Clôture veille', fmtPrice(q.prevClose, c), 'cloture-veille'),
        fact('Ouverture', fmtPrice(q.open, c)),
        fact('Plus bas / haut du jour', `${fmtPrice(q.dayLow, c)} – ${fmtPrice(q.dayHigh, c)}`),
        fact('52 semaines', `${fmtPrice(q.week52Low, c)} – ${fmtPrice(q.week52High, c)}`, '52-semaines'),
        fact('Achat / vente (bid / ask)', q.bid && q.ask ? `${fmtPrice(q.bid, c)} / ${fmtPrice(q.ask, c)}` : '<span class="muted">non fourni</span>', 'spread'),
        fact('Volume', q.volume != null ? fmtBig(q.volume) : '—', 'volume'),
        fact('Volatilité (1 an)', volatility != null ? `${fmtNum(volatility, 1)} %` : '<span class="muted">calcul…</span>', 'volatilite'),
        ...(q.isIndex ? [] : [
          fact('Capitalisation', q.marketCap ? `${fmtBig(q.marketCap)} ${esc(c)}` : '—', 'capitalisation'),
          fact('PER', q.pe ? fmtNum(q.pe, 1) : '—', 'per'),
          fact('Rendement du dividende', q.dividendYield ? fmtPct(q.dividendYield * 100, { sign: false }) : '—', 'dividende'),
        ]),
        fact('Dernière cotation', `${fmtDateTime(q.time)}`),
        fact('Source', `${esc(q.source === 'finnhub-ws' ? 'Finnhub (temps réel)' : q.source === 'twelvedata' ? 'Twelve Data' : q.source === 'finnhub' ? 'Finnhub' : 'Yahoo Finance')} ${freshPill(q)}`, q.freshness?.kind === 'live' ? 'direct' : 'differe'),
      ].join('');
    }
    drawPosition();
    drawOrders();
    updateQtyHint();
  };

  const position = () => state.portfolio.valuation?.positions.find((p) => p.symbol === symbol) || null;

  const drawPosition = () => {
    const box = el.querySelector('#st-position');
    if (!box) return;
    const p = position();
    if (!p) {
      box.innerHTML = `<h2>Ma position ${help('position')}</h2><p class="muted small">Tu ne possèdes pas encore ${esc(q.name)}.</p>`;
      return;
    }
    box.innerHTML = `<div class="card-head"><h2>Ma position ${help('position')}</h2><button class="btn small" data-protect="${esc(symbol)}">🛡️ Stop-loss / take-profit</button></div>
      <div class="facts">
        ${fact('Quantité', fmtQty(p.qty))}
        ${fact("Prix moyen d'achat", fmtPrice(p.avgPrice, p.currency), 'prix-moyen')}
        ${fact('Coût total (frais inclus)', fmtEur(p.costEur))}
        ${fact('Valeur actuelle', `<strong>${fmtEur(p.valueEur)}</strong>`)}
        ${fact('+/− value latente', `<span class="${cls(p.pnlEur)}">${fmtEur(p.pnlEur, { sign: true })} (${fmtPct(p.pnlPct)})</span>`, 'plus-value-latente')}
        ${fact('Stop-loss', p.stopLoss != null ? fmtPrice(p.stopLoss, p.currency) : '<span class="muted">aucun</span>', 'stop-loss')}
        ${fact('Take-profit', p.takeProfit != null ? fmtPrice(p.takeProfit, p.currency) : '<span class="muted">aucun</span>', 'take-profit')}
        ${fact('Détenue depuis le', fmtDateTime(p.openedAt))}
      </div>`;
  };

  const drawOrders = () => {
    const box = el.querySelector('#st-orders');
    if (!box) return;
    const orders = state.portfolio.orders.filter((o) => o.symbol === symbol).slice(-15).reverse();
    if (!orders.length) {
      box.innerHTML = '<h2>Mes ordres sur ce titre</h2><p class="muted small">Aucun ordre pour l’instant.</p>';
      return;
    }
    box.innerHTML = `<h2>Mes ordres sur ce titre</h2><div class="table-wrap"><table class="stack"><thead><tr><th>Date</th><th>Ordre</th><th class="num">Qté</th><th class="num">Prix</th><th>Statut</th><th></th></tr></thead><tbody>${orders
      .map(
        (o) => `<tr><td data-label="Date" class="nowrap">${fmtDateTime(o.filledAt || o.createdAt)}</td>
        <td data-label="Ordre"><span class="pill ${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Achat' : 'Vente'}</span> ${o.type === 'limit' ? `limite ${fmtPrice(o.limitPrice, o.currency)}` : o.origin !== 'user' ? esc(o.origin) : 'marché'}</td>
        <td class="num" data-label="Qté">${fmtQty(o.qty)}</td>
        <td class="num" data-label="Prix">${o.fillPrice ? fmtPrice(o.fillPrice, o.currency) : '—'}</td>
        <td data-label="Statut" class="small">${statusLabel(o)}</td>
        <td class="num">${o.status === 'pending' ? `<button class="btn small danger" data-cancel="${esc(o.id)}">Annuler</button>` : ''}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
  };

  // ---------- Formulaire d'ordre ----------

  const $ = (s) => el.querySelector(s);

  const updateQtyHint = () => {
    const hint = $('#tk-qty-hint');
    if (!hint || !q) return;
    if (side === 'sell') {
      const p = position();
      hint.innerHTML = p ? `Tu détiens <a href="#" data-fill="${p.qty}">${fmtQty(p.qty)}</a> titre(s)` : 'Tu ne détiens pas ce titre';
      return;
    }
    const v = state.portfolio.valuation;
    const f = state.settings.fees;
    const zone = q.exchange?.feeZone === 'europe' ? f.europe : f.international;
    const px = type === 'limit' && Number($('#tk-limit')?.value) > 0 ? Number($('#tk-limit').value) : q.ask || q.price;
    const pxEur = q.fxRate ? px / q.fxRate : null;
    if (!pxEur || !v) {
      hint.textContent = '';
      return;
    }
    const pct = zone.pct / 100 + (q.currency !== 'EUR' ? f.fxPct / 100 : 0) + (f.tob?.enabled ? (q.quoteType === 'ETF' ? f.tob.etfPct : f.tob.stockPct) / 100 : 0);
    const raw = (v.available - zone.fixed) / (pxEur * (1 + pct) * 1.001);
    const max = state.settings.allowFractional ? Math.max(0, Math.floor(raw * 1000) / 1000) : Math.max(0, Math.floor(raw));
    hint.innerHTML = `Maximum ≈ <a href="#" data-fill="${max}">${fmtQty(max)}</a> avec ${fmtEur(v.available)} disponibles`;
  };

  const readInputs = () => ({
    symbol,
    side,
    type,
    qty: $('#tk-qty').value,
    limitPrice: $('#tk-limit').value,
    stopLoss: side === 'buy' ? $('#tk-sl').value : '',
    takeProfit: side === 'buy' ? $('#tk-tp').value : '',
    reason: $('#tk-reason').value,
  });

  let previewSeq = 0;
  const refreshEstimate = async () => {
    const box = $('#tk-estimate');
    if (!box) return;
    const input = readInputs();
    if (!(Number(input.qty) > 0) || (type === 'limit' && !(Number(input.limitPrice) > 0))) {
      box.innerHTML = '<span class="muted">Indique une quantité' + (type === 'limit' ? ' et un prix limite' : '') + '.</span>';
      return;
    }
    const my = ++previewSeq;
    try {
      const e = await api('/api/orders/preview', { method: 'POST', body: input });
      if (my !== previewSeq) return;
      const buy = side === 'buy';
      const p = position();
      let result = '';
      if (!buy && p) {
        const cost = (p.costEur * Number(input.qty)) / p.qty;
        const r = e.totalEur - cost;
        result = `<div class="row"><span>Résultat estimé ${help('plus-value-realisee')}</span><strong class="${cls(r)}">${fmtEur(r, { sign: true })} (${fmtPct((r / cost) * 100)})</strong></div>`;
      }
      box.innerHTML = `
        <div class="row"><span>Prix estimé${e.spreadSimulated ? ` <span class="muted small">(fourchette simulée)</span>` : ''}</span><span>${fmtPrice(e.priceLocal, e.currency)}${e.currency !== 'EUR' ? ` ≈ ${fmtEur(e.priceEur)}` : ''}</span></div>
        <div class="row"><span>Montant</span><span>${fmtEur(e.grossEur)}</span></div>
        <div class="row"><span>Courtage (${esc(e.fees.zone)}) ${help('frais-courtage')}</span><span>${fmtEur(e.fees.broker)}</span></div>
        ${e.fees.fx ? `<div class="row"><span>Frais de change ${help('frais-change')}</span><span>${fmtEur(e.fees.fx)}</span></div>` : ''}
        ${e.fees.tob ? `<div class="row"><span>Taxe boursière (TOB) ${help('tob')}</span><span>${fmtEur(e.fees.tob)}</span></div>` : ''}
        <div class="row total"><span>${buy ? 'Total débité' : 'Total crédité'}</span><span>${fmtEur(e.totalEur)}</span></div>
        ${result}
        ${buy ? `<div class="row small muted"><span>Liquidités après l'achat</span><span>${fmtEur(e.availableCash - e.totalEur)}</span></div>` : ''}
        ${e.warnings.length ? `<ul class="warnings">${e.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
    } catch (err) {
      if (my !== previewSeq) return;
      box.innerHTML = `<span class="down">${esc(err.message)}</span>`;
    }
  };
  const debouncedEstimate = debounce(refreshEstimate, 250);

  const setSide = (s) => {
    side = s;
    el.querySelectorAll('#tk-side button').forEach((b) => b.classList.toggle('active', b.dataset.side === s));
    const btn = $('#tk-submit');
    btn.className = `btn block ${s === 'buy' ? 'buy' : 'sell'}`;
    btn.textContent = s === 'buy' ? 'Acheter' : 'Vendre';
    $('#tk-protect').hidden = s !== 'buy';
    if (s === 'sell') {
      const p = position();
      if (p && Number($('#tk-qty').value) > p.qty) $('#tk-qty').value = p.qty;
    }
    updateQtyHint();
    refreshEstimate();
  };

  const setType = (t) => {
    type = t;
    el.querySelectorAll('#tk-type button').forEach((b) => b.classList.toggle('active', b.dataset.type === t));
    $('#tk-limit-field').hidden = t !== 'limit';
    if (t === 'limit' && !$('#tk-limit').value && q.price) {
      const d = q.price >= 100 ? 2 : q.price >= 1 ? 2 : 4;
      $('#tk-limit').value = (side === 'buy' ? q.price * 0.98 : q.price * 1.02).toFixed(d);
    }
    updateQtyHint();
    refreshEstimate();
  };

  const bindTicket = () => {
    el.querySelector('#tk-side').addEventListener('click', (e) => {
      const b = e.target.closest('[data-side]');
      if (b) setSide(b.dataset.side);
    });
    el.querySelector('#tk-type').addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]');
      if (b) setType(b.dataset.type);
    });
    for (const id of ['#tk-qty', '#tk-limit', '#tk-sl', '#tk-tp']) $(id).addEventListener('input', () => {
      updateQtyHint();
      debouncedEstimate();
    });
    $('#tk-sl').placeholder = q.price ? `ex. ${fmtNum(q.price * 0.9, q.price >= 1 ? 2 : 4)} (−10 %)` : '';
    $('#tk-tp').placeholder = q.price ? `ex. ${fmtNum(q.price * 1.2, q.price >= 1 ? 2 : 4)} (+20 %)` : '';
    el.querySelector('#st-ticket').addEventListener('click', (e) => {
      const a = e.target.closest('[data-fill]');
      if (a) {
        e.preventDefault();
        $('#tk-qty').value = a.dataset.fill;
        refreshEstimate();
      }
    });
    $('#tk-submit').addEventListener('click', async () => {
      const btn = $('#tk-submit');
      const msg = $('#tk-msg');
      msg.innerHTML = '';
      btn.disabled = true;
      try {
        const order = await api('/api/orders', { method: 'POST', body: readInputs() });
        if (order.status === 'filled') {
          msg.innerHTML = `<div class="form-ok">✔ ${order.side === 'buy' ? 'Achat exécuté' : 'Vente exécutée'} : ${fmtQty(order.qty)} × ${fmtPrice(order.fillPrice, order.currency)} (frais ${fmtEur(order.fees.total)}).</div>`;
        } else if (order.status === 'pending') {
          msg.innerHTML = `<div class="form-ok">⏳ Ordre enregistré. ${esc(order.statusReason || '')}</div>`;
        } else {
          msg.innerHTML = `<div class="form-error">${esc(order.statusReason || 'Ordre refusé.')}</div>`;
        }
        $('#tk-reason').value = '';
        $('#tk-sl').value = '';
        $('#tk-tp').value = '';
      } catch (err) {
        msg.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });
    setSide(side);
  };

  // ---------- Graphique ----------

  let chartSeq = 0;
  const loadChart = async () => {
    const box = el.querySelector('#st-chart');
    if (!box) return;
    const msg = el.querySelector('#st-chart-msg');
    msg.innerHTML = '<span class="spinner"></span>';
    const my = ++chartSeq;
    try {
      const h = await api(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${lastRange}`);
      if (my !== chartSeq || destroyed) return;
      if (!chartCtl) chartCtl = createPriceChart(box, el.querySelector('#st-legend'));
      chartCtl.setData(h, { type: lastType });
      msg.textContent = h.candles.length ? '' : 'Pas de cotation sur cette période.';
      if (lastRange === '1y') {
        volatility = annualVolatility(h.candles);
        drawDynamic();
      }
    } catch (err) {
      if (my !== chartSeq) return;
      msg.textContent = err.message;
    }
  };

  const loadVolatility = async () => {
    try {
      const h = await api(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1y`);
      volatility = annualVolatility(h.candles);
      if (!destroyed) drawDynamic();
    } catch {
      /* rien */
    }
  };

  // ---------- Chargement initial ----------

  (async () => {
    try {
      if (!q || Date.now() - (q.fetchedAt || 0) > 20000) {
        const r = await api(`/api/quotes?symbols=${encodeURIComponent(symbol)}`);
        if (r.quotes[0]) q = r.quotes[0];
        else if (!q) {
          const why = r.sources?.yahoo?.state === 'ok' || !r.sources?.yahoo ? `Ticker introuvable : « ${symbol} ». Vérifie l'orthographe ou cherche l'entreprise par son nom.` : r.sources.yahoo.message;
          el.innerHTML = `<div class="card"><h2>Action introuvable</h2><p>${esc(why)}</p><a class="btn primary" href="#/marches?q=${encodeURIComponent(symbol.split('.')[0])}">🔎 Chercher</a></div>`;
          return;
        }
      }
      if (destroyed) return;
      state.quotes.set(symbol, q);
      layout();
      if (!q.isIndex) {
        api(`/api/profile?symbol=${encodeURIComponent(symbol)}`).then((p) => {
          profile = p;
          if (!destroyed) drawDynamic();
        }).catch(() => {});
      }
      if (lastRange !== '1y') loadVolatility();
    } catch (err) {
      el.innerHTML = `<div class="card"><h2>Erreur</h2><p>${esc(err.message)}</p></div>`;
    }
  })();

  let estimateTimer = setInterval(() => {
    if ($('#tk-estimate')) refreshEstimate();
  }, 20000);

  return {
    focusSymbols: () => [symbol],
    onQuotes(quotes) {
      const nq = quotes.find((x) => x.symbol === symbol);
      if (nq && el.querySelector('.stock-head')) {
        q = nq;
        drawDynamic();
        if (q.market?.open) chartCtl?.updatePrice(q.price);
      }
    },
    onPortfolio() {
      if (!el.querySelector('.stock-head')) return;
      el.querySelectorAll('.stock-head [data-star]').forEach((b) => (b.outerHTML = starButton(symbol)));
      drawPosition();
      drawOrders();
      updateQtyHint();
    },
    onValuation() {
      if (el.querySelector('.stock-head')) {
        drawPosition();
        updateQtyHint();
      }
    },
    cleanup() {
      destroyed = true;
      clearInterval(estimateTimer);
      chartCtl?.destroy();
    },
  };
}

export function statusLabel(o) {
  if (o.status === 'filled') return '<span class="pill up">Exécuté</span>';
  if (o.status === 'pending') return `<span class="pill pending">En attente</span><span class="sub">${esc(o.statusReason || '')}</span>`;
  if (o.status === 'cancelled') return `<span class="pill">Annulé</span><span class="sub">${esc(o.statusReason || '')}</span>`;
  return `<span class="pill down">Refusé</span><span class="sub">${esc(o.statusReason || '')}</span>`;
}

