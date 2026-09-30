// Écrans « Ordres & historique » et « Journal de trading ».

import { api, esc, state, fmtPrice, fmtEur, fmtPct, fmtQty, fmtNum, fmtDateTime, cls, toast, symbolCell, go } from '../core.js';
import { help } from '../glossary.js';
import { pendingOrdersTable, cancelOrder } from './portfolio.js';
import { statusLabel } from './stock.js';

const ORIGIN = { 'stop-loss': '🛑 Stop-loss', 'take-profit': '🎯 Take-profit' };

function sideCell(o) {
  const base = `<span class="pill ${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Achat' : 'Vente'}</span>`;
  const extra = ORIGIN[o.origin] ? ` <span class="small">${ORIGIN[o.origin]}</span>` : o.type === 'limit' ? ' <span class="small muted">limite</span>' : '';
  return base + extra;
}

let filter = 'filled';

export function renderOrders(el) {
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h2>Ordres en attente ${help('ordre-limite')}</h2>
      <div id="or-pending"></div>
    </div>
    <div class="card">
      <div class="card-head">
        <h2>Historique des transactions</h2>
        <div class="btn-row">
          <div class="segmented" id="or-filter">
            <button data-f="filled">Exécutés</button><button data-f="closed">Annulés / refusés</button><button data-f="all">Tout</button>
          </div>
          <button class="btn small" id="or-csv">⬇︎ Export CSV</button>
        </div>
      </div>
      <div id="or-history"></div>
    </div>`;

  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cancel]');
    if (c) return cancelOrder(c.dataset.cancel);
    const f = e.target.closest('[data-f]');
    if (f) {
      filter = f.dataset.f;
      draw();
      return;
    }
    const row = e.target.closest('[data-go]');
    if (row && !e.target.closest('button, a')) go(`#/action/${encodeURIComponent(row.dataset.go)}`);
  });
  el.querySelector('#or-csv').addEventListener('click', exportCsv);

  const draw = () => {
    el.querySelectorAll('#or-filter button').forEach((b) => b.classList.toggle('active', b.dataset.f === filter));
    const orders = state.portfolio.orders;
    el.querySelector('#or-pending').innerHTML = pendingOrdersTable(orders.filter((o) => o.status === 'pending'));
    const list = orders
      .filter((o) => o.status !== 'pending')
      .filter((o) => (filter === 'all' ? true : filter === 'filled' ? o.status === 'filled' : o.status !== 'filled'))
      .slice()
      .reverse();
    if (!list.length) {
      el.querySelector('#or-history').innerHTML = '<div class="empty">Aucune transaction pour l’instant.</div>';
      return;
    }
    el.querySelector('#or-history').innerHTML = `<div class="table-wrap"><table class="stack"><thead><tr>
      <th>Date</th><th>Action</th><th>Sens</th><th class="num">Qté</th><th class="num">Prix</th><th class="num">Change ${help('risque-change')}</th>
      <th class="num">Montant</th><th class="num">Frais ${help('frais-courtage')}</th><th class="num">Total</th><th class="num">Résultat ${help('plus-value-realisee')}</th><th>Statut</th>
    </tr></thead><tbody>${list
      .map(
        (o) => `<tr class="clickable" data-go="${esc(o.symbol)}">
        <td data-label="Date" class="nowrap">${fmtDateTime(o.filledAt || o.closedAt || o.createdAt)}</td>
        <td class="first">${symbolCell(o)}</td>
        <td data-label="Sens">${sideCell(o)}</td>
        <td class="num" data-label="Quantité">${fmtQty(o.qty)}</td>
        <td class="num" data-label="Prix">${o.fillPrice ? fmtPrice(o.fillPrice, o.currency) : o.limitPrice ? `limite ${fmtPrice(o.limitPrice, o.currency)}` : '—'}</td>
        <td class="num" data-label="Taux de change">${o.fxRate && o.currency !== 'EUR' ? `1 € = ${fmtNum(o.fxRate, o.fxRate > 100 ? 2 : 4)} ${esc(o.currency)}` : '—'}</td>
        <td class="num" data-label="Montant">${o.grossEur != null ? fmtEur(o.grossEur) : '—'}</td>
        <td class="num" data-label="Frais" title="${o.fees ? `Courtage ${fmtEur(o.fees.broker)} · change ${fmtEur(o.fees.fx)} · TOB ${fmtEur(o.fees.tob)}` : ''}">${o.fees ? fmtEur(o.fees.total) : '—'}</td>
        <td class="num" data-label="Total">${o.cashFlowEur != null ? `<span class="${cls(o.cashFlowEur)}">${fmtEur(o.cashFlowEur, { sign: true })}</span>` : '—'}</td>
        <td class="num" data-label="Résultat">${o.realizedEur != null ? `<span class="chg ${cls(o.realizedEur)}">${fmtEur(o.realizedEur, { sign: true })}</span><span class="sub ${cls(o.realizedEur)}">${fmtPct(o.realizedPct)}</span>` : '—'}</td>
        <td data-label="Statut">${statusLabel(o)}</td>
      </tr>`,
      )
      .join('')}</tbody></table></div>`;
  };
  draw();
  return { onPortfolio: draw };
}

function exportCsv() {
  const head = ['Date', 'Ticker', 'Nom', 'Sens', 'Type', 'Origine', 'Quantité', 'Prix', 'Devise', 'Taux EUR', 'Montant EUR', 'Frais EUR', 'Total EUR', 'Résultat EUR', 'Statut', 'Raisonnement', 'Leçon'];
  const rows = state.portfolio.orders.map((o) => [
    new Date(o.filledAt || o.closedAt || o.createdAt).toISOString(),
    o.symbol,
    o.name,
    o.side === 'buy' ? 'Achat' : 'Vente',
    o.type === 'limit' ? 'Limite' : 'Marché',
    o.origin,
    o.qty,
    o.fillPrice ?? '',
    o.currency,
    o.fxRate ?? '',
    o.grossEur ?? '',
    o.fees?.total ?? '',
    o.cashFlowEur ?? '',
    o.realizedEur ?? '',
    o.status,
    o.reason || '',
    o.lesson || '',
  ]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `historique-simulateur-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Journal ----------

let jFilter = 'all';

export function renderJournal(el) {
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h2>📓 Journal de trading</h2>
      <p class="muted">Relis tes raisonnements : pourquoi tu as pris chaque position, et ce que tu en as appris. C'est le meilleur moyen de progresser (et d'éviter de refaire les mêmes erreurs).</p>
      <div class="btn-row" style="align-items:center">
        <div class="segmented" id="jr-filter">
          <button data-j="all">Tous</button><button data-j="with">Avec raisonnement</button><button data-j="without">Sans raisonnement</button><button data-j="win">Gagnants</button><button data-j="loss">Perdants</button>
        </div>
        <span class="small muted" id="jr-stats"></span>
      </div>
    </div>
    <div id="jr-list"></div>`;

  el.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-j]');
    if (f) {
      jFilter = f.dataset.j;
      draw();
      return;
    }
    const save = e.target.closest('[data-save]');
    if (save) {
      const id = save.dataset.save;
      const box = el.querySelector(`[data-entry="${CSS.escape(id)}"]`);
      try {
        await api(`/api/journal/${id}`, { method: 'PATCH', body: { reason: box.querySelector('[name=reason]').value, lesson: box.querySelector('[name=lesson]').value } });
        save.textContent = '✔ Enregistré';
        setTimeout(() => (save.textContent = 'Enregistrer'), 1800);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  const draw = () => {
    el.querySelectorAll('#jr-filter button').forEach((b) => b.classList.toggle('active', b.dataset.j === jFilter));
    const all = state.portfolio.orders.filter((o) => o.status === 'filled' || o.status === 'pending');
    const withReason = all.filter((o) => (o.reason || '').trim());
    el.querySelector('#jr-stats').textContent = all.length ? `${withReason.length} ordre(s) sur ${all.length} justifié(s) (${fmtNum((withReason.length / all.length) * 100, 0)} %)` : '';
    const list = all
      .filter((o) => {
        if (jFilter === 'with') return (o.reason || '').trim();
        if (jFilter === 'without') return !(o.reason || '').trim();
        if (jFilter === 'win') return o.realizedEur > 0;
        if (jFilter === 'loss') return o.realizedEur != null && o.realizedEur <= 0;
        return true;
      })
      .slice()
      .reverse();
    if (!list.length) {
      el.querySelector('#jr-list').innerHTML = '<div class="card empty">Aucune entrée. Chaque ordre que tu passes apparaît ici, avec le champ « Pourquoi je prends cette position ? ».</div>';
      return;
    }
    // On ne redessine pas une entrée en cours d'édition
    const active = document.activeElement?.closest?.('[data-entry]')?.dataset.entry;
    el.querySelector('#jr-list').innerHTML = list
      .map((o) => {
        const result = o.realizedEur != null ? `<span class="pill ${o.realizedEur > 0 ? 'up' : 'down'}">${fmtEur(o.realizedEur, { sign: true })} (${fmtPct(o.realizedPct)})</span>` : '';
        return `<article class="journal-entry" data-entry="${esc(o.id)}">
          <header>
            <div class="j-title">${sideCell(o)} <a href="#/action/${encodeURIComponent(o.symbol)}">${esc(o.name)}</a> <span class="mono small muted">${esc(o.symbol)}</span> ${result}</div>
            <div class="small muted">${fmtDateTime(o.filledAt || o.createdAt)} · ${fmtQty(o.qty)} × ${o.fillPrice ? fmtPrice(o.fillPrice, o.currency) : o.type === 'limit' ? `limite ${fmtPrice(o.limitPrice, o.currency)}` : 'en attente'}${o.holdingDays != null ? ` · détenu ${o.holdingDays} j` : ''}</div>
          </header>
          <div class="grid cols-2">
            <div class="field"><label>Pourquoi je prends cette position ?</label><textarea name="reason" placeholder="Pas de raisonnement noté…">${esc(o.reason || '')}</textarea></div>
            <div class="field"><label>Ce que j'en retiens (après coup)</label><textarea name="lesson" placeholder="Ex. : j'ai vendu trop tôt / j'aurais dû mettre un stop-loss…">${esc(o.lesson || '')}</textarea></div>
          </div>
          <div class="btn-row" style="justify-content:flex-end"><button class="btn small" data-save="${esc(o.id)}">Enregistrer</button></div>
        </article>`;
      })
      .join('');
    if (active) el.querySelector(`[data-entry="${CSS.escape(active)}"] textarea`)?.focus();
  };
  draw();
  return {
    onPortfolio() {
      if (document.activeElement?.closest?.('#jr-list textarea')) return; // ne pas effacer une saisie en cours
      draw();
    },
  };
}
