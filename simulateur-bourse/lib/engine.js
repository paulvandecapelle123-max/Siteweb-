// Moteur de simulation : ordres (marché, limite), stop-loss / take-profit, frais,
// liquidités, positions, historique de valeur et statistiques.
// Toute l'argent est fictif ; la comptabilité est tenue en euros.

import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { AppError } from './errors.js';
import { exchangeForSymbol, isTradableSymbol, marketStatus, EXCHANGE_BY_ID } from './markets.js';

const EPS = 1e-9;

export function defaultPortfolio(initialCapital = 5000, watchlist = []) {
  return {
    version: 1,
    createdAt: Date.now(),
    initialCapital,
    cash: initialCapital,
    positions: {},
    orders: [],
    watchlist,
    snapshots: [{ t: Date.now(), v: initialCapital, c: initialCapital }],
    benchmark: null,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

function fmtEur(x) {
  return `${x.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function fmtPrice(x, cur) {
  const digits = x >= 1000 ? 2 : x >= 1 ? 2 : 4;
  return `${x.toLocaleString('fr-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${cur}`;
}

export class Engine extends EventEmitter {
  constructor({ md, store, settingsStore, now = () => Date.now() }) {
    super();
    this.now = now;
    this.md = md;
    this.store = store;
    this.settingsStore = settingsStore;
    this.lastSnapshotCheck = 0;
    md.addTracker(() => this.trackedSymbols());
    md.on('quotes', (quotes) => this.onQuotes(quotes));
  }

  get p() {
    return this.store.data;
  }

  get settings() {
    return this.settingsStore.data;
  }

  save() {
    this.store.save();
  }

  /** Tickers suivis en priorité : positions, ordres en attente, favoris, indice de comparaison. */
  trackedSymbols() {
    const list = [...Object.keys(this.p.positions)];
    for (const o of this.p.orders) if (o.status === 'pending') list.push(o.symbol);
    list.push(...this.p.watchlist);
    if (this.settings.benchmark) list.push(this.settings.benchmark);
    return list;
  }

  // ---------- Frais ----------

  computeFees(ex, grossEur, quoteType, currency) {
    const f = this.settings.fees;
    const zone = ex?.feeZone === 'europe' ? f.europe : f.international;
    const broker = round2(zone.fixed + (grossEur * zone.pct) / 100);
    const fx = currency && currency !== 'EUR' ? round2((grossEur * f.fxPct) / 100) : 0;
    let tob = 0;
    if (f.tob?.enabled) {
      const etf = quoteType === 'ETF';
      tob = round2(Math.min((grossEur * (etf ? f.tob.etfPct : f.tob.stockPct)) / 100, etf ? f.tob.etfCap : f.tob.stockCap));
    }
    return { broker, fx, tob, total: round2(broker + fx + tob), zone: ex?.feeZone === 'europe' ? 'Europe' : 'Hors Europe' };
  }

  /** Prix d'exécution : fourchette réelle (bid/ask) si cohérente, sinon fourchette simulée. */
  executionPrices(q) {
    const mid = q.price;
    const coherent =
      q.bid && q.ask && q.ask >= q.bid && q.bid >= mid * 0.99 && q.ask <= mid * 1.01 && (q.ask - q.bid) / mid < 0.02;
    if (coherent) return { bid: q.bid, ask: q.ask, simulated: false };
    const half = (this.settings.fees.spreadPct || 0) / 200;
    return { bid: mid * (1 - half), ask: mid * (1 + half), simulated: true };
  }

  reservedCash(exceptId = null) {
    let r = 0;
    for (const o of this.p.orders) if (o.status === 'pending' && o.side === 'buy' && o.id !== exceptId) r += o.reservedEur || 0;
    return r;
  }

  reservedQty(symbol, exceptId = null) {
    let r = 0;
    for (const o of this.p.orders) if (o.status === 'pending' && o.side === 'sell' && o.symbol === symbol && o.id !== exceptId) r += o.qty;
    return r;
  }

  availableCash() {
    return Math.max(0, this.p.cash - this.reservedCash());
  }

  // ---------- Validation d'un ordre ----------

  parseOrderInput(input) {
    const symbol = String(input.symbol || '').trim().toUpperCase();
    if (!isTradableSymbol(symbol)) {
      if (symbol.startsWith('^')) throw new AppError('BAD_REQUEST', "Un indice ne s'achète pas directement : utilise un ETF qui le réplique.");
      throw new AppError('BAD_REQUEST', `Ticker non pris en charge : « ${symbol} ».`);
    }
    const side = input.side === 'sell' ? 'sell' : input.side === 'buy' ? 'buy' : null;
    if (!side) throw new AppError('BAD_REQUEST', 'Sens de l’ordre invalide (achat ou vente).');
    const type = input.type === 'limit' ? 'limit' : 'market';
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('BAD_REQUEST', 'Indique une quantité positive.');
    if (!this.settings.allowFractional && !Number.isInteger(qty)) {
      throw new AppError('BAD_REQUEST', 'Quantité entière uniquement (active les fractions d’action dans les Réglages si tu veux).');
    }
    if (qty > 1e7) throw new AppError('BAD_REQUEST', 'Quantité trop grande.');
    const limitPrice = type === 'limit' ? Number(input.limitPrice) : null;
    if (type === 'limit' && !(limitPrice > 0)) throw new AppError('BAD_REQUEST', 'Indique un prix limite positif.');
    const opt = (v) => (v === '' || v == null ? null : Number(v));
    const stopLoss = side === 'buy' ? opt(input.stopLoss) : null;
    const takeProfit = side === 'buy' ? opt(input.takeProfit) : null;
    if (stopLoss != null && !(stopLoss > 0)) throw new AppError('BAD_REQUEST', 'Stop-loss invalide.');
    if (takeProfit != null && !(takeProfit > 0)) throw new AppError('BAD_REQUEST', 'Take-profit invalide.');
    const reason = String(input.reason || '').slice(0, 2000);
    return { symbol, side, type, qty, limitPrice, stopLoss, takeProfit, reason };
  }

  /** Estimation d'un ordre (affichée avant validation). */
  async preview(input) {
    const o = this.parseOrderInput({ ...input, reason: '' });
    const q = await this.md.requireQuote(o.symbol, 30000);
    return this.estimate(o, q);
  }

  estimate(o, q) {
    const ex = exchangeForSymbol(o.symbol);
    if (!q.fxRate) throw new AppError('UNAVAILABLE', `Taux de change ${q.currency}/EUR indisponible pour le moment. Réessaie dans une minute.`);
    const { bid, ask, simulated } = this.executionPrices(q);
    let px = o.side === 'buy' ? ask : bid;
    if (o.type === 'limit') px = o.side === 'buy' ? Math.min(px, o.limitPrice) : Math.max(px, o.limitPrice);
    const grossEur = (o.qty * px) / q.fxRate;
    const fees = this.computeFees(ex, grossEur, q.quoteType, q.currency);
    const totalEur = o.side === 'buy' ? grossEur + fees.total : grossEur - fees.total;
    const st = marketStatus(ex, this.now());
    const warnings = [];
    if (!st.open) warnings.push(`Bourse fermée : l'ordre sera exécuté à l'ouverture (${st.detail.replace(/^Fermée · |^Fermée /, '')}).`);
    if (q.delayMin > 0 && st.open) warnings.push(`Prix différé de ${q.delayMin} min : l'exécution se fera au dernier cours connu.`);
    if (o.type === 'limit' && o.side === 'buy' && ask > o.limitPrice) warnings.push('Le prix actuel est au-dessus de ta limite : l’ordre attendra une baisse.');
    if (o.type === 'limit' && o.side === 'sell' && bid < o.limitPrice) warnings.push('Le prix actuel est sous ta limite : l’ordre attendra une hausse.');
    if (q.currency !== 'EUR') warnings.push(`Action cotée en ${q.currency} : frais de change de ${this.settings.fees.fxPct} % et risque de change.`);
    return {
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      currency: q.currency,
      fxRate: q.fxRate,
      priceLocal: px,
      priceEur: px / q.fxRate,
      spreadSimulated: simulated,
      grossEur,
      fees,
      totalEur,
      availableCash: this.availableCash(),
      marketOpen: st.open,
      marketDetail: st.detail,
      warnings,
    };
  }

  // ---------- Passage d'ordre ----------

  async placeOrder(input) {
    const o = this.parseOrderInput(input);
    const q = await this.md.requireQuote(o.symbol, 10000);
    if (q.isIndex) throw new AppError('BAD_REQUEST', "Un indice ne s'achète pas directement : utilise un ETF qui le réplique.");
    if (q.quoteType && !['EQUITY', 'ETF'].includes(q.quoteType)) {
      throw new AppError('BAD_REQUEST', `Ce type d'instrument (${q.quoteType}) n'est pas pris en charge : actions et ETF uniquement.`);
    }
    const est = this.estimate(o, q);
    const ex = exchangeForSymbol(o.symbol);
    const refPx = o.type === 'limit' ? o.limitPrice : q.price;

    if (o.side === 'buy') {
      if (o.stopLoss != null && o.stopLoss >= refPx) throw new AppError('BAD_REQUEST', `Le stop-loss (${fmtPrice(o.stopLoss, q.currency)}) doit être sous le prix d'achat (${fmtPrice(refPx, q.currency)}).`);
      if (o.takeProfit != null && o.takeProfit <= refPx) throw new AppError('BAD_REQUEST', `Le take-profit (${fmtPrice(o.takeProfit, q.currency)}) doit être au-dessus du prix d'achat (${fmtPrice(refPx, q.currency)}).`);
      // Marge de 3 % sur un ordre au marché en attente (le prix peut bouger d'ici l'ouverture)
      const need = o.type === 'market' && !est.marketOpen ? est.grossEur * 1.03 + est.fees.total : est.totalEur;
      const avail = this.availableCash();
      if (need > avail + 0.005) {
        throw new AppError('BAD_REQUEST', `Liquidités insuffisantes : il faut environ ${fmtEur(need)}, tu disposes de ${fmtEur(avail)}.`);
      }
      o.reservedEur = round2(need);
    } else {
      const pos = this.p.positions[o.symbol];
      if (!pos) throw new AppError('BAD_REQUEST', "Tu ne possèdes pas cette action. (La vente à découvert n'est pas possible dans ce simulateur.)");
      const free = pos.qty - this.reservedQty(o.symbol);
      if (o.qty > free + EPS) {
        throw new AppError('BAD_REQUEST', `Tu ne peux vendre que ${free} titre(s)${free < pos.qty ? ' (le reste est déjà engagé dans un ordre en attente)' : ''}.`);
      }
    }

    const order = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      symbol: o.symbol,
      name: q.name,
      exchangeId: ex.id,
      currency: q.currency,
      quoteType: q.quoteType || 'EQUITY',
      side: o.side,
      type: o.type,
      qty: o.qty,
      limitPrice: o.limitPrice,
      stopLoss: o.stopLoss,
      takeProfit: o.takeProfit,
      reason: o.reason,
      lesson: '',
      origin: 'user',
      status: 'pending',
      statusReason: null,
      reservedEur: o.reservedEur || 0,
      priceAtOrder: q.price,
    };
    this.p.orders.push(order);
    this.tryExecute(order, q);
    if (order.status === 'pending') {
      const st = marketStatus(ex, this.now());
      order.statusReason = !st.open
        ? `En attente de l'ouverture de ${ex.name} (${st.detail.replace(/^Fermée · |^Fermée /, '')}).`
        : order.type === 'limit'
          ? `En attente : exécution si le prix ${order.side === 'buy' ? 'descend à' : 'monte à'} ${fmtPrice(order.limitPrice, order.currency)}.`
          : 'En attente du premier cours de la séance (données différées).';
      this.emit('notify', { type: 'info', message: `Ordre enregistré : ${order.side === 'buy' ? 'achat' : 'vente'} de ${order.qty} ${order.name}. ${order.statusReason}` });
    }
    this.save();
    this.emit('changed');
    return order;
  }

  /** Une cotation permet-elle d'exécuter maintenant ? (bourse ouverte + cours du jour + source active) */
  canExecute(q) {
    if (!q || q.price == null) return false;
    const ex = exchangeForSymbol(q.symbol);
    if (!ex) return false;
    const st = marketStatus(ex, this.now());
    if (!st.open) return false;
    if (q.time && st.sessionOpenAt && q.time < st.sessionOpenAt - 60000) return false;
    if (q.freshness?.kind === 'stale') return false;
    return true;
  }

  tryExecute(order, q) {
    if (order.status !== 'pending' || !this.canExecute(q)) return false;
    const { bid, ask } = this.executionPrices(q);
    let px;
    if (order.side === 'buy') {
      px = ask;
      if (order.type === 'limit' && px > order.limitPrice + EPS) return false;
    } else {
      px = bid;
      if (order.type === 'limit' && px < order.limitPrice - EPS) return false;
    }
    return this.fill(order, q, px);
  }

  reject(order, reason) {
    order.status = 'rejected';
    order.statusReason = reason;
    order.reservedEur = 0;
    order.closedAt = Date.now();
    this.emit('notify', { type: 'error', message: `Ordre ${order.side === 'buy' ? "d'achat" : 'de vente'} ${order.name} refusé : ${reason}` });
  }

  fill(order, q, px) {
    const fxRate = q.fxRate;
    if (!fxRate) return false;
    const ex = exchangeForSymbol(order.symbol);
    const grossEur = (order.qty * px) / fxRate;
    const fees = this.computeFees(ex, grossEur, order.quoteType, order.currency);
    const now = Date.now();

    if (order.side === 'buy') {
      const total = grossEur + fees.total;
      const avail = this.p.cash - this.reservedCash(order.id);
      if (total > avail + 0.005) {
        this.reject(order, `liquidités insuffisantes au moment de l'exécution (il fallait ${fmtEur(total)}, disponible ${fmtEur(Math.max(0, avail))}).`);
        return true;
      }
      this.p.cash = round2(this.p.cash - total);
      let pos = this.p.positions[order.symbol];
      if (!pos) {
        pos = {
          symbol: order.symbol,
          name: order.name,
          exchangeId: order.exchangeId,
          currency: order.currency,
          quoteType: order.quoteType,
          qty: 0,
          avgPrice: 0,
          costEur: 0,
          openedAt: now,
          stopLoss: null,
          takeProfit: null,
          sector: null,
          country: null,
        };
        this.p.positions[order.symbol] = pos;
        this.loadProfile(pos);
      }
      pos.avgPrice = (pos.avgPrice * pos.qty + px * order.qty) / (pos.qty + order.qty);
      pos.qty += order.qty;
      pos.costEur += total;
      pos.lastPrice = q.price;
      pos.lastFx = fxRate;
      if (order.stopLoss != null) pos.stopLoss = order.stopLoss;
      if (order.takeProfit != null) pos.takeProfit = order.takeProfit;
      order.cashFlowEur = -round2(total);
    } else {
      const pos = this.p.positions[order.symbol];
      if (!pos || pos.qty < order.qty - EPS) {
        this.reject(order, 'position insuffisante.');
        return true;
      }
      const net = grossEur - fees.total;
      const costPart = (pos.costEur * order.qty) / pos.qty;
      order.costBasisEur = round2(costPart);
      order.avgBuyPrice = pos.avgPrice;
      order.realizedEur = round2(net - costPart);
      order.realizedPct = costPart ? ((net - costPart) / costPart) * 100 : 0;
      order.holdingDays = Math.max(0, Math.round((now - pos.openedAt) / 86400000));
      this.p.cash = round2(this.p.cash + net);
      pos.qty -= order.qty;
      pos.costEur -= costPart;
      if (pos.qty <= EPS) {
        delete this.p.positions[order.symbol];
        for (const o of this.p.orders) {
          if (o.status === 'pending' && o.side === 'sell' && o.symbol === order.symbol && o.id !== order.id) {
            o.status = 'cancelled';
            o.statusReason = 'Annulé automatiquement : position soldée.';
            o.closedAt = now;
          }
        }
      }
      order.cashFlowEur = round2(net);
    }

    order.status = 'filled';
    order.statusReason = null;
    order.filledAt = now;
    order.fillPrice = px;
    order.fxRate = fxRate;
    order.grossEur = round2(grossEur);
    order.fees = fees;
    order.reservedEur = 0;
    order.priceInfo = q.freshness?.label || null;

    const verb = order.side === 'buy' ? 'Achat exécuté' : 'Vente exécutée';
    let msg = `${verb} : ${order.qty} × ${order.name} à ${fmtPrice(px, order.currency)} (frais ${fmtEur(fees.total)}).`;
    if (order.origin === 'stop-loss') msg = `🛑 Stop-loss déclenché : ${msg}`;
    if (order.origin === 'take-profit') msg = `🎯 Take-profit atteint : ${msg}`;
    if (order.side === 'sell') msg += ` Résultat : ${order.realizedEur >= 0 ? '+' : ''}${fmtEur(order.realizedEur)}.`;
    this.emit('notify', { type: order.side === 'sell' && order.realizedEur < 0 ? 'loss' : 'success', message: msg });
    this.snapshot(true);
    return true;
  }

  async loadProfile(pos) {
    try {
      const prof = await this.md.profile(pos.symbol, pos.quoteType);
      const live = this.p.positions[pos.symbol];
      if (live) {
        live.sector = prof.sector;
        live.country = prof.country;
        this.save();
        this.emit('changed');
      }
    } catch {
      /* le secteur restera « Autre » */
    }
  }

  cancelOrder(id) {
    const o = this.p.orders.find((x) => x.id === id);
    if (!o) throw new AppError('NOT_FOUND', 'Ordre introuvable.', { status: 404 });
    if (o.status !== 'pending') throw new AppError('BAD_REQUEST', 'Cet ordre n’est plus en attente.');
    o.status = 'cancelled';
    o.statusReason = 'Annulé par toi.';
    o.reservedEur = 0;
    o.closedAt = Date.now();
    this.save();
    this.emit('changed');
    return o;
  }

  setProtection(symbol, { stopLoss, takeProfit }) {
    const pos = this.p.positions[symbol];
    if (!pos) throw new AppError('NOT_FOUND', 'Position introuvable.', { status: 404 });
    const q = this.md.getQuote(symbol);
    const price = q?.price ?? pos.lastPrice ?? pos.avgPrice;
    const parse = (v) => (v === '' || v == null ? null : Number(v));
    const sl = parse(stopLoss);
    const tp = parse(takeProfit);
    if (sl != null && !(sl > 0)) throw new AppError('BAD_REQUEST', 'Stop-loss invalide.');
    if (tp != null && !(tp > 0)) throw new AppError('BAD_REQUEST', 'Take-profit invalide.');
    if (sl != null && sl >= price) throw new AppError('BAD_REQUEST', `Le stop-loss doit être sous le cours actuel (${fmtPrice(price, pos.currency)}).`);
    if (tp != null && tp <= price) throw new AppError('BAD_REQUEST', `Le take-profit doit être au-dessus du cours actuel (${fmtPrice(price, pos.currency)}).`);
    pos.stopLoss = sl;
    pos.takeProfit = tp;
    this.save();
    this.emit('changed');
    return pos;
  }

  // ---------- Réaction aux nouveaux prix ----------

  onQuotes(quotes) {
    let changed = false;
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    // Dernier prix connu (sert à valoriser le portefeuille au redémarrage)
    for (const pos of Object.values(this.p.positions)) {
      const q = bySymbol.get(pos.symbol);
      if (q?.price != null) {
        pos.lastPrice = q.price;
        if (q.fxRate) pos.lastFx = q.fxRate;
      }
    }
    for (const o of this.p.orders) {
      if (o.status !== 'pending') continue;
      const q = bySymbol.get(o.symbol) || this.md.getQuote(o.symbol);
      if (this.tryExecute(o, q)) changed = true;
    }
    for (const pos of Object.values(this.p.positions)) {
      if (pos.stopLoss == null && pos.takeProfit == null) continue;
      const q = bySymbol.get(pos.symbol);
      if (!q || !this.canExecute(q)) continue;
      let origin = null;
      if (pos.stopLoss != null && q.price <= pos.stopLoss) origin = 'stop-loss';
      else if (pos.takeProfit != null && q.price >= pos.takeProfit) origin = 'take-profit';
      if (!origin) continue;
      for (const o of this.p.orders) {
        if (o.status === 'pending' && o.side === 'sell' && o.symbol === pos.symbol) {
          o.status = 'cancelled';
          o.statusReason = `Annulé : ${origin} déclenché.`;
          o.closedAt = Date.now();
        }
      }
      const order = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        symbol: pos.symbol,
        name: pos.name,
        exchangeId: pos.exchangeId,
        currency: pos.currency,
        quoteType: pos.quoteType,
        side: 'sell',
        type: 'market',
        qty: pos.qty,
        limitPrice: null,
        reason: origin === 'stop-loss'
          ? `Stop-loss automatique à ${fmtPrice(pos.stopLoss, pos.currency)}.`
          : `Take-profit automatique à ${fmtPrice(pos.takeProfit, pos.currency)}.`,
        lesson: '',
        origin,
        status: 'pending',
        statusReason: null,
        reservedEur: 0,
        priceAtOrder: q.price,
      };
      this.p.orders.push(order);
      this.fill(order, q, this.executionPrices(q).bid);
      changed = true;
    }
    if (Date.now() - this.lastSnapshotCheck > 60000) {
      this.lastSnapshotCheck = Date.now();
      this.snapshot(false);
      this.save();
    }
    if (changed) {
      this.save();
      this.emit('changed');
    }
    this.emit('valuation');
  }

  // ---------- Valorisation ----------

  valuation() {
    const positions = Object.values(this.p.positions).map((pos) => {
      const q = this.md.getQuote(pos.symbol);
      const price = q?.price ?? pos.lastPrice ?? pos.avgPrice;
      const fx = q?.fxRate ?? this.md.fx.rate(pos.currency) ?? pos.lastFx ?? 1;
      const valueEur = (pos.qty * price) / fx;
      const pnlEur = valueEur - pos.costEur;
      const ex = EXCHANGE_BY_ID[pos.exchangeId];
      return {
        ...pos,
        exchangeName: ex?.name || pos.exchangeId,
        price,
        fxRate: fx,
        priceEur: price / fx,
        valueEur,
        pnlEur,
        pnlPct: pos.costEur ? (pnlEur / pos.costEur) * 100 : 0,
        avgCostEur: pos.costEur / pos.qty,
        dayChangeEur: q?.change != null ? (pos.qty * q.change) / fx : null,
        dayChangePct: q?.changePct ?? null,
        freshness: q?.freshness || null,
        market: q?.market || null,
        sector: pos.sector || (pos.quoteType === 'ETF' ? 'ETF (diversifié)' : 'Autre'),
        country: pos.country || ex?.country || 'Autre',
      };
    });
    positions.sort((a, b) => b.valueEur - a.valueEur);
    const positionsValue = positions.reduce((s, x) => s + x.valueEur, 0);
    const total = this.p.cash + positionsValue;
    const filled = this.p.orders.filter((o) => o.status === 'filled');
    const realized = filled.reduce((s, o) => s + (o.realizedEur || 0), 0);
    const fees = filled.reduce((s, o) => s + (o.fees?.total || 0), 0);
    const unrealized = positions.reduce((s, x) => s + x.pnlEur, 0);
    const dayChange = positions.reduce((s, x) => s + (x.dayChangeEur || 0), 0);
    const group = (key) => {
      const m = new Map();
      for (const x of positions) m.set(x[key], (m.get(x[key]) || 0) + x.valueEur);
      if (this.p.cash > 0.005) m.set('Liquidités', this.p.cash);
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    return {
      createdAt: this.p.createdAt,
      initialCapital: this.p.initialCapital,
      cash: this.p.cash,
      reserved: this.reservedCash(),
      available: this.availableCash(),
      positionsValue,
      total,
      realized,
      unrealized,
      fees,
      dayChange,
      perfEur: total - this.p.initialCapital,
      perfPct: ((total - this.p.initialCapital) / this.p.initialCapital) * 100,
      positions,
      byCountry: group('country'),
      bySector: group('sector'),
    };
  }

  /** Enregistre la valeur totale (au plus toutes les 5 min, ou immédiatement après un ordre). */
  snapshot(force = false) {
    const snaps = this.p.snapshots;
    const last = snaps.at(-1);
    const v = round2(this.valuation().total);
    const now = Date.now();
    if (!force && last && now - last.t < 5 * 60000) return false;
    if (!force && last && Math.abs(last.v - v) < 0.01 && now - last.t < 3600000) return false;
    snaps.push({ t: now, v, c: round2(this.p.cash) });
    if (snaps.length > 4000) this.thinSnapshots();
    return true;
  }

  thinSnapshots() {
    const now = Date.now();
    const out = [];
    let lastBucket = null;
    for (const s of this.p.snapshots) {
      const age = now - s.t;
      const bucket = age < 7 * 86400000 ? s.t : age < 90 * 86400000 ? Math.floor(s.t / 3600000) : Math.floor(s.t / 86400000);
      if (age < 7 * 86400000 || bucket !== lastBucket) out.push(s);
      else out[out.length - 1] = s;
      lastBucket = bucket;
    }
    this.p.snapshots = out;
  }

  // ---------- Journal & favoris ----------

  updateJournal(id, { reason, lesson }) {
    const o = this.p.orders.find((x) => x.id === id);
    if (!o) throw new AppError('NOT_FOUND', 'Ordre introuvable.', { status: 404 });
    if (reason !== undefined) o.reason = String(reason).slice(0, 2000);
    if (lesson !== undefined) o.lesson = String(lesson).slice(0, 2000);
    this.save();
    this.emit('changed');
    return o;
  }

  async addWatch(symbol) {
    symbol = String(symbol || '').trim().toUpperCase();
    if (!symbol) throw new AppError('BAD_REQUEST', 'Ticker manquant.');
    if (this.p.watchlist.includes(symbol)) return this.p.watchlist;
    await this.md.requireQuote(symbol, 60000);
    this.p.watchlist.push(symbol);
    this.save();
    this.emit('changed');
    return this.p.watchlist;
  }

  removeWatch(symbol) {
    this.p.watchlist = this.p.watchlist.filter((s) => s !== symbol);
    this.save();
    this.emit('changed');
    return this.p.watchlist;
  }

  // ---------- Indice de comparaison & statistiques ----------

  async ensureBenchmarkStart() {
    const symbol = this.settings.benchmark;
    if (!symbol) return null;
    const b = this.p.benchmark;
    if (b && b.symbol === symbol && b.startPrice) return b;
    let startPrice = null;
    let startFx = null;
    const ageDays = (Date.now() - this.p.createdAt) / 86400000;
    try {
      if (ageDays < 0.5) {
        const q = await this.md.requireQuote(symbol, 60000);
        startPrice = q.price;
        startFx = q.fxRate;
      } else {
        const h = await this.md.history(symbol, ageDays < 25 ? '1m' : ageDays < 360 ? '1y' : '5y');
        const first = h.candles.find((c) => c.time * 1000 >= this.p.createdAt) || h.candles.at(-1);
        startPrice = first?.close ?? null;
        const q = this.md.getQuote(symbol);
        startFx = q?.fxRate ?? 1;
      }
    } catch {
      return null;
    }
    if (!startPrice) return null;
    this.p.benchmark = { symbol, startPrice, startFx: startFx || 1, startAt: this.p.createdAt };
    this.save();
    return this.p.benchmark;
  }

  async stats() {
    const v = this.valuation();
    const filled = this.p.orders.filter((o) => o.status === 'filled');
    const sells = filled.filter((o) => o.side === 'sell');
    const wins = sells.filter((o) => o.realizedEur > 0);
    const losses = sells.filter((o) => o.realizedEur <= 0);
    const by = (arr, fn) => (arr.length ? arr.reduce((a, b) => (fn(b) > fn(a) ? b : a)) : null);
    const slim = (o) => o && { id: o.id, symbol: o.symbol, name: o.name, realizedEur: o.realizedEur, realizedPct: o.realizedPct, filledAt: o.filledAt };
    const avg = (arr) => (arr.length ? arr.reduce((s, o) => s + o.realizedEur, 0) / arr.length : null);

    // Baisse maximale et volatilité à partir de l'historique de valeur
    let peak = -Infinity;
    let maxDD = 0;
    for (const s of this.p.snapshots) {
      peak = Math.max(peak, s.v);
      if (peak > 0) maxDD = Math.min(maxDD, (s.v - peak) / peak);
    }
    const daily = new Map();
    for (const s of this.p.snapshots) daily.set(new Date(s.t).toISOString().slice(0, 10), s.v);
    const closes = [...daily.values()];
    let volatility = null;
    if (closes.length >= 6) {
      const rets = [];
      for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
      volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    }

    let benchmark = null;
    const b = await this.ensureBenchmarkStart();
    if (b) {
      const [q] = await this.md.getQuotes([b.symbol], { maxAge: 60000 }).catch(() => []);
      if (q?.price) {
        const fxNow = q.fxRate || 1;
        const pct = ((q.price / fxNow) / (b.startPrice / (b.startFx || 1)) - 1) * 100;
        benchmark = { symbol: b.symbol, name: q.name, startPrice: b.startPrice, price: q.price, currency: q.currency, pct, diff: v.perfPct - pct };
      }
    }

    return {
      since: this.p.createdAt,
      trades: filled.length,
      buys: filled.length - sells.length,
      sells: sells.length,
      pending: this.p.orders.filter((o) => o.status === 'pending').length,
      winRate: sells.length ? (wins.length / sells.length) * 100 : null,
      wins: wins.length,
      losses: losses.length,
      best: slim(by(sells, (o) => o.realizedEur)),
      worst: slim(by(sells, (o) => -o.realizedEur)),
      avgWin: avg(wins),
      avgLoss: avg(losses),
      fees: v.fees,
      realized: v.realized,
      unrealized: v.unrealized,
      perfPct: v.perfPct,
      perfEur: v.perfEur,
      total: v.total,
      maxDrawdownPct: maxDD * 100,
      volatility,
      benchmark,
    };
  }

  /** Historique de la valeur du portefeuille + indice de comparaison ramené au capital de départ. */
  async history() {
    const snaps = this.p.snapshots.map((s) => ({ time: Math.floor(s.t / 1000), value: s.v }));
    let bench = [];
    const b = await this.ensureBenchmarkStart();
    if (b) {
      const ageDays = (Date.now() - this.p.createdAt) / 86400000;
      const range = ageDays < 1 ? '1d' : ageDays < 6 ? '1w' : ageDays < 25 ? '1m' : ageDays < 360 ? '1y' : '5y';
      try {
        const h = await this.md.history(b.symbol, range);
        const factor = this.p.initialCapital / b.startPrice;
        const start = Math.floor(this.p.createdAt / 1000);
        bench = [{ time: start, value: this.p.initialCapital }];
        for (const c of h.candles) if (c.time > start) bench.push({ time: c.time, value: round2(c.close * factor) });
        const q = this.md.getQuote(b.symbol);
        if (q?.price) bench.push({ time: Math.floor(Date.now() / 1000), value: round2(q.price * factor) });
      } catch {
        bench = [];
      }
    }
    // Point « maintenant » pour que la courbe aille jusqu'à la valeur actuelle
    const now = Math.floor(Date.now() / 1000);
    const total = round2(this.valuation().total);
    if (!snaps.length || snaps.at(-1).time < now) snaps.push({ time: now, value: total });
    return { initialCapital: this.p.initialCapital, portfolio: snaps, benchmark: bench, benchmarkSymbol: b?.symbol || null };
  }

  reset(archiveFn) {
    if (archiveFn) archiveFn(this.p);
    const watchlist = [...this.p.watchlist];
    this.store.data = defaultPortfolio(this.settings.initialCapital, watchlist);
    this.store.saveNow();
    this.emit('notify', { type: 'info', message: `Portefeuille réinitialisé : ${fmtEur(this.settings.initialCapital)} de liquidités.` });
    this.emit('changed');
    this.ensureBenchmarkStart().catch(() => {});
  }
}
