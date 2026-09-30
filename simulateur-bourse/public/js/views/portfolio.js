// Écran « Portefeuille » : chiffres clés, évolution, positions, ordres en attente, répartition.

import { api, esc, fmtEur, fmtPct, fmtPrice, fmtQty, fmtDate, cls, arrow, state, symbolCell, openModal, toast, go, freshPill, marketHtml } from '../core.js';
import { help } from '../glossary.js';
import { createPortfolioChart, donut } from '../charts.js';

export function kpi(label, value, sub = '', { helpKey = '', extra = '', hero = false } = {}) {
  return `<div class="kpi${hero ? ' hero' : ''}"><div class="k-label">${esc(label)} ${helpKey ? help(helpKey) : ''}</div><div class="k-value ${extra}">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
}

function summaryHtml(v) {
  const perfCls = cls(v.perfEur);
  const posCount = v.positions.length;
  const costTotal = v.positions.reduce((s, p) => s + p.costEur, 0);
  return [
    kpi('Valeur totale du compte', fmtEur(v.total), `<span class="${perfCls}">${arrow(v.perfEur)}${fmtEur(v.perfEur, { sign: true })} (${fmtPct(v.perfPct)})</span> depuis le ${fmtDate(v.createdAt)} · départ ${fmtEur(v.initialCapital, { digits: 0 })}`, { hero: true }),
    kpi('Liquidités disponibles', fmtEur(v.available), v.reserved > 0.005 ? `dont ${fmtEur(v.reserved)} réservés ${help('reserve')}` : `sur ${fmtEur(v.cash)} de liquidités`, { helpKey: 'liquidites' }),
    kpi('Valeur des positions', fmtEur(v.positionsValue), `${posCount} position${posCount > 1 ? 's' : ''} ouverte${posCount > 1 ? 's' : ''}`, { helpKey: 'position' }),
    kpi('Plus-value latente', `<span class="${cls(v.unrealized)}">${fmtEur(v.unrealized, { sign: true })}</span>`, costTotal ? `${fmtPct((v.unrealized / costTotal) * 100)} sur ${fmtEur(costTotal, { digits: 0 })} investis` : 'aucune position', { helpKey: 'plus-value-latente' }),
    kpi('Plus-value réalisée', `<span class="${cls(v.realized)}">${fmtEur(v.realized, { sign: true })}</span>`, 'gains et pertes encaissés', { helpKey: 'plus-value-realisee' }),
    kpi('Variation du jour', `<span class="${cls(v.dayChange)}">${fmtEur(v.dayChange, { sign: true })}</span>`, 'sur les positions ouvertes', { helpKey: 'variation-jour' }),
    kpi('Frais payés', fmtEur(v.fees), 'courtage, change et taxes', { helpKey: 'frais-courtage' }),
  ].join('');
}

function protectionText(p) {
  const parts = [];
  if (p.stopLoss != null) parts.push(`<span class="pill down" title="Stop-loss">SL ${fmtPrice(p.stopLoss, p.currency)}</span>`);
  if (p.takeProfit != null) parts.push(`<span class="pill up" title="Take-profit">TP ${fmtPrice(p.takeProfit, p.currency)}</span>`);
  return parts.length ? parts.join(' ') : '<span class="muted small">aucune</span>';
}

export function positionsTable(positions, { compact = false } = {}) {
  if (!positions.length) {
    return `<div class="empty">Aucune position ouverte pour l'instant.<br><br><a class="btn primary" href="#/marches">🔎 Chercher une action</a></div>`;
  }
  const rows = positions
    .map((p) => {
      const q = state.quotes.get(p.symbol);
      return `<tr class="clickable" data-go="${esc(p.symbol)}">
        <td class="first">${symbolCell(p)}<div class="s-meta small" style="margin-top:3px">${q ? `${freshPill(q)} ${marketHtml(q)}` : ''}</div></td>
        <td class="num" data-label="Quantité">${fmtQty(p.qty)}</td>
        <td class="num" data-label="Prix moyen d'achat">${fmtPrice(p.avgPrice, p.currency)}<span class="sub">${fmtEur(p.avgCostEur)} / titre (frais inclus)</span></td>
        <td class="num" data-label="Cours actuel">${fmtPrice(p.price, p.currency)}${p.currency !== 'EUR' ? `<span class="sub">${fmtEur(p.priceEur)}</span>` : ''}</td>
        <td class="num" data-label="Valeur"><strong>${fmtEur(p.valueEur)}</strong></td>
        <td class="num" data-label="+/− value latente"><span class="chg ${cls(p.pnlEur)}">${fmtEur(p.pnlEur, { sign: true })}</span><span class="sub ${cls(p.pnlEur)}">${fmtPct(p.pnlPct)}</span></td>
        <td class="num" data-label="Jour">${p.dayChangePct != null ? `<span class="chg ${cls(p.dayChangePct)}">${fmtPct(p.dayChangePct)}</span><span class="sub">${fmtEur(p.dayChangeEur, { sign: true })}</span>` : '—'}</td>
        ${compact ? '' : `<td data-label="Protection">${protectionText(p)}</td>
        <td class="num" data-label=""><div class="btn-row" style="justify-content:flex-end">
          <button class="btn small" data-protect="${esc(p.symbol)}" title="Stop-loss / take-profit">🛡️ Protéger</button>
          <button class="btn small sell" data-sell="${esc(p.symbol)}">Vendre</button>
        </div></td>`}
      </tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="stack"><thead><tr>
    <th>Action</th><th class="num">Qté</th><th class="num">Prix moyen ${help('prix-moyen')}</th><th class="num">Cours</th><th class="num">Valeur</th>
    <th class="num">+/− value ${help('plus-value-latente')}</th><th class="num">Jour</th>${compact ? '' : `<th>Protection ${help('stop-loss')}</th><th></th>`}
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function bindPositionActions(root) {
  root.addEventListener('click', (e) => {
    const protect = e.target.closest('[data-protect]');
    if (protect) {
      e.stopPropagation();
      return openProtectionModal(protect.dataset.protect);
    }
    const sell = e.target.closest('[data-sell]');
    if (sell) {
      e.stopPropagation();
      return go(`#/action/${encodeURIComponent(sell.dataset.sell)}?side=sell`);
    }
    const cancel = e.target.closest('[data-cancel]');
    if (cancel) {
      e.stopPropagation();
      return cancelOrder(cancel.dataset.cancel);
    }
    const row = e.target.closest('[data-go]');
    if (row && !e.target.closest('button, a, input, textarea, select')) go(`#/action/${encodeURIComponent(row.dataset.go)}`);
  });
}

export async function cancelOrder(id) {
  try {
    await api(`/api/orders/${id}/cancel`, { method: 'POST' });
    toast('Ordre annulé.', 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function openProtectionModal(symbol) {
  const pos = state.portfolio.valuation?.positions.find((p) => p.symbol === symbol);
  if (!pos) return;
  const price = pos.price;
  const cur = pos.currency;
  const r = (x) => Math.round(x * 100) / 100;
  openModal(
    `<header><h2>🛡️ Protéger ${esc(pos.name)}</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></header>
     <p class="muted small">Cours actuel : <strong>${fmtPrice(price, cur)}</strong> · prix moyen d'achat : ${fmtPrice(pos.avgPrice, cur)} · ${fmtQty(pos.qty)} titre(s).
     Si le cours atteint un de ces seuils pendant la séance, <strong>toute la position est vendue au marché</strong>.</p>
     <div class="field"><label for="pm-sl">Stop-loss (${esc(cur)}) ${help('stop-loss')}</label>
       <input id="pm-sl" type="number" step="any" min="0" value="${pos.stopLoss ?? ''}" placeholder="vide = aucun">
       <div class="btn-row" style="margin-top:6px"><button class="btn small" data-sl="0.95">−5 %</button><button class="btn small" data-sl="0.9">−10 %</button><button class="btn small" data-sl="0.85">−15 %</button></div></div>
     <div class="field"><label for="pm-tp">Take-profit (${esc(cur)}) ${help('take-profit')}</label>
       <input id="pm-tp" type="number" step="any" min="0" value="${pos.takeProfit ?? ''}" placeholder="vide = aucun">
       <div class="btn-row" style="margin-top:6px"><button class="btn small" data-tp="1.1">+10 %</button><button class="btn small" data-tp="1.2">+20 %</button><button class="btn small" data-tp="1.3">+30 %</button></div></div>
     <div id="pm-msg"></div>
     <div class="btn-row" style="justify-content:flex-end"><button class="btn" data-close>Annuler</button><button class="btn primary" id="pm-save">Enregistrer</button></div>`,
    {
      onMount(modal, close) {
        const sl = modal.querySelector('#pm-sl');
        const tp = modal.querySelector('#pm-tp');
        modal.querySelectorAll('[data-sl]').forEach((b) => b.addEventListener('click', () => (sl.value = r(price * Number(b.dataset.sl)))));
        modal.querySelectorAll('[data-tp]').forEach((b) => b.addEventListener('click', () => (tp.value = r(price * Number(b.dataset.tp)))));
        modal.querySelector('#pm-save').addEventListener('click', async () => {
          try {
            await api(`/api/positions/${encodeURIComponent(symbol)}/protection`, { method: 'POST', body: { stopLoss: sl.value, takeProfit: tp.value } });
            toast('Protection enregistrée.', 'success');
            close();
          } catch (err) {
            modal.querySelector('#pm-msg').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
          }
        });
      },
    },
  );
}

export function pendingOrdersTable(orders) {
  if (!orders.length) return '<p class="muted small">Aucun ordre en attente.</p>';
  return `<div class="table-wrap"><table class="stack"><thead><tr><th>Date</th><th>Action</th><th>Ordre</th><th class="num">Qté</th><th>Statut</th><th></th></tr></thead><tbody>
    ${orders
      .map(
        (o) => `<tr>
        <td data-label="Date" class="nowrap">${esc(new Date(o.createdAt).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td>
        <td data-label="Action" class="first">${symbolCell(o, { showExchange: false })}</td>
        <td data-label="Ordre"><span class="pill ${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Achat' : 'Vente'}</span> ${o.type === 'limit' ? `limite ${fmtPrice(o.limitPrice, o.currency)}` : 'au marché'}</td>
        <td data-label="Qté" class="num">${fmtQty(o.qty)}</td>
        <td data-label="Statut" class="small">${esc(o.statusReason || 'En attente')}${o.reservedEur ? `<span class="sub">${fmtEur(o.reservedEur)} réservés</span>` : ''}</td>
        <td class="num"><button class="btn small danger" data-cancel="${esc(o.id)}">Annuler</button></td>
      </tr>`,
      )
      .join('')}</tbody></table></div>`;
}

export function render(el) {
  el.innerHTML = `
    <div class="kpis" id="pf-kpis"></div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Évolution de la valeur du compte ${help('msci-world')}</h2><div class="legend" id="pf-legend"></div></div>
      <div class="chart-box small" id="pf-chart"><div class="chart-overlay" id="pf-chart-msg"></div></div>
      <p class="muted small" style="margin-top:8px">La ligne pointillée montre ce que serait devenue ta mise de départ placée dans l'indice de comparaison (réglable dans les Réglages).</p>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Positions ouvertes ${help('position')}</h2><a class="btn small" href="#/marches">+ Acheter une action</a></div>
      <div id="pf-positions"></div>
    </div>
    <div class="card" style="margin-top:16px" id="pf-pending-card">
      <div class="card-head"><h2>Ordres en attente ${help('ordre-limite')}</h2><a class="small" href="#/ordres">Tout l'historique →</a></div>
      <div id="pf-pending"></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h2>Répartition par pays ${help('diversification')}</h2><div id="pf-country"></div></div>
      <div class="card"><h2>Répartition par secteur ${help('diversification')}</h2><div id="pf-sector"></div></div>
    </div>`;

  const chart = createPortfolioChart(el.querySelector('#pf-chart'), el.querySelector('#pf-legend'));
  bindPositionActions(el);

  const renderValuation = () => {
    const v = state.portfolio.valuation;
    if (!v) return;
    el.querySelector('#pf-kpis').innerHTML = summaryHtml(v);
    el.querySelector('#pf-positions').innerHTML = positionsTable(v.positions);
    el.querySelector('#pf-country').innerHTML = donut(v.byCountry, { title: 'Répartition par pays' });
    el.querySelector('#pf-sector').innerHTML = donut(v.bySector, { title: 'Répartition par secteur' });
  };
  const renderOrders = () => {
    const pending = state.portfolio.orders.filter((o) => o.status === 'pending');
    el.querySelector('#pf-pending').innerHTML = pendingOrdersTable(pending);
  };
  let loading = false;
  const loadHistory = async () => {
    if (loading) return;
    loading = true;
    try {
      const h = await api('/api/portfolio/history');
      chart.setData(h);
      el.querySelector('#pf-chart-msg').textContent = h.portfolio.length < 3 ? "La courbe se remplit au fil du temps (un point toutes les 5 min quand les prix bougent, et à chaque ordre)." : '';
    } catch (err) {
      el.querySelector('#pf-chart-msg').textContent = err.message;
    } finally {
      loading = false;
    }
  };

  renderValuation();
  renderOrders();
  loadHistory();
  const timer = setInterval(loadHistory, 5 * 60000);

  return {
    onValuation: renderValuation,
    onPortfolio() {
      renderValuation();
      renderOrders();
      loadHistory();
    },
    cleanup() {
      clearInterval(timer);
      chart.destroy();
    },
  };
}
