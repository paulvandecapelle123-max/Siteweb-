// Écran « Statistiques ».

import { api, esc, fmtEur, fmtPct, fmtNum, fmtDate, cls } from '../core.js';
import { help } from '../glossary.js';
import { kpi } from './portfolio.js';

export function renderStats(el) {
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Calcul des statistiques…</div>';
  let busy = false;

  const draw = async () => {
    if (busy) return;
    busy = true;
    try {
      const s = await api('/api/stats');
      const b = s.benchmark;
      const tradeLink = (t) => (t ? `<a href="#/action/${encodeURIComponent(t.symbol)}">${esc(t.name)}</a> <span class="${cls(t.realizedEur)}">${fmtEur(t.realizedEur, { sign: true })} (${fmtPct(t.realizedPct)})</span>` : '<span class="muted">—</span>');
      el.innerHTML = `
        <div class="kpis">
          ${kpi('Performance totale', `<span class="${cls(s.perfPct)}">${fmtPct(s.perfPct)}</span>`, `${fmtEur(s.perfEur, { sign: true })} depuis le ${fmtDate(s.since)}`, { hero: true })}
          ${kpi('Nombre de trades', fmtNum(s.trades, 0), `${s.buys} achat(s) · ${s.sells} vente(s)${s.pending ? ` · ${s.pending} en attente` : ''}`, { helpKey: 'trade' })}
          ${kpi('Trades gagnants', s.winRate != null ? `${fmtNum(s.winRate, 0)} %` : '—', s.sells ? `${s.wins} gagnant(s) · ${s.losses} perdant(s)` : 'aucune vente pour l’instant', { helpKey: 'taux-reussite' })}
          ${kpi('Gain moyen / perte moyenne', `<span class="up">${s.avgWin != null ? fmtEur(s.avgWin, { sign: true }) : '—'}</span> / <span class="down">${s.avgLoss != null ? fmtEur(s.avgLoss, { sign: true }) : '—'}</span>`, 'par vente')}
          ${kpi('Plus-value réalisée', `<span class="${cls(s.realized)}">${fmtEur(s.realized, { sign: true })}</span>`, '', { helpKey: 'plus-value-realisee' })}
          ${kpi('Plus-value latente', `<span class="${cls(s.unrealized)}">${fmtEur(s.unrealized, { sign: true })}</span>`, '', { helpKey: 'plus-value-latente' })}
          ${kpi('Frais payés', fmtEur(s.fees), s.trades ? `${fmtEur(s.fees / s.trades)} par trade en moyenne` : '', { helpKey: 'frais-courtage' })}
          ${kpi('Baisse maximale', `<span class="${s.maxDrawdownPct < 0 ? 'down' : 'flat'}">${fmtPct(s.maxDrawdownPct)}</span>`, 'du plus haut au plus bas', { helpKey: 'drawdown' })}
          ${kpi('Volatilité du portefeuille', s.volatility != null ? `${fmtNum(s.volatility, 1)} %` : '—', s.volatility != null ? 'annualisée' : 'il faut au moins une semaine d’historique', { helpKey: 'volatilite' })}
        </div>
        <div class="grid cols-2" style="margin-top:16px">
          <div class="card">
            <h2>Comparaison avec un indice mondial ${help('msci-world')}</h2>
            ${b ? `<p>Sur la même période, <strong>${esc(b.name || b.symbol)}</strong> (<span class="mono">${esc(b.symbol)}</span>) a fait <strong class="${cls(b.pct)}">${fmtPct(b.pct)}</strong>, contre <strong class="${cls(s.perfPct)}">${fmtPct(s.perfPct)}</strong> pour ton portefeuille.</p>
              <p style="font-size:1.1rem">${b.diff >= 0 ? '🏆' : '📉'} Écart : <strong class="${cls(b.diff)}">${fmtPct(b.diff)}</strong> ${b.diff >= 0 ? '— tu bats l’indice !' : "— un simple ETF aurait fait mieux pour l'instant."}</p>
              <p class="muted small">Calcul en euros, sans frais pour l'indice. L'indice de comparaison se change dans les Réglages.</p>`
              : '<p class="muted">Comparaison indisponible pour le moment (indice de référence non chargé).</p>'}
          </div>
          <div class="card">
            <h2>Meilleur et pire trade</h2>
            <div class="facts">
              <div class="fact"><div class="f-label">🥇 Meilleur trade</div><div class="f-value">${tradeLink(s.best)}</div></div>
              <div class="fact"><div class="f-label">🥶 Pire trade</div><div class="f-value">${tradeLink(s.worst)}</div></div>
            </div>
            <p class="muted small" style="margin-top:10px">Un « trade » gagnant ou perdant se mesure à la vente, frais compris. Relis ton <a href="#/journal">journal</a> pour comprendre ce qui a marché… ou pas.</p>
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="card form-error">${esc(err.message)}</div>`;
    } finally {
      busy = false;
    }
  };
  draw();
  return { onPortfolio: draw };
}
