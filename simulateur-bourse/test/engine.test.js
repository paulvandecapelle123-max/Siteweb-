// Tests du moteur d'ordres avec une fausse source de prix et une horloge maîtrisée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Engine, defaultPortfolio } from '../lib/engine.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../lib/settings.js';
import { AppError } from '../lib/errors.js';

const FX = { EUR: 1, USD: 1.1, GBP: 0.85 };

class FakeMarket extends EventEmitter {
  constructor() {
    super();
    this.quotes = new Map();
    this.fx = { rate: (c) => FX[c] ?? null };
  }
  addTracker() {}
  set(symbol, fields) {
    const prev = this.quotes.get(symbol) || {};
    const q = { symbol, name: symbol, quoteType: 'EQUITY', freshness: { kind: 'live', label: 'En direct' }, ...prev, ...fields };
    q.fxRate = FX[q.currency];
    this.quotes.set(symbol, q);
    return q;
  }
  getQuote(s) {
    return this.quotes.get(s) || null;
  }
  rawQuote(s) {
    return this.getQuote(s);
  }
  async requireQuote(s) {
    const q = this.quotes.get(s);
    if (!q) throw new AppError('NOT_FOUND', `Ticker introuvable : ${s}`);
    return q;
  }
  async getQuotes(list) {
    return list.map((s) => this.quotes.get(s)).filter(Boolean);
  }
  async profile() {
    return { sector: 'Technologie', country: 'États-Unis' };
  }
  async history() {
    return { candles: [] };
  }
  push(...symbols) {
    this.emit('quotes', symbols.map((s) => this.quotes.get(s)));
  }
}

function setup(nowIso, settingsPatch = {}) {
  const md = new FakeMarket();
  let now = Date.parse(nowIso);
  const store = { data: defaultPortfolio(5000), save() {}, saveNow() {} };
  const settingsStore = { data: mergeSettings(DEFAULT_SETTINGS, settingsPatch) };
  const engine = new Engine({ md, store, settingsStore, now: () => now });
  return { md, engine, store, setNow: (iso) => (now = Date.parse(iso)) };
}

// Mercredi 30/09/2026 : New York ouverte à 16:00 UTC, Bruxelles fermée à 16:00 UTC
const US_OPEN = '2026-09-30T16:00:00Z';

test('achat au marché sur une bourse ouverte : exécution immédiate, frais hors Europe + change', async () => {
  const { md, engine, store } = setup(US_OPEN);
  md.set('AAPL', { currency: 'USD', price: 110, bid: 109.9, ask: 110.1, time: Date.parse(US_OPEN) - 5000 });
  const o = await engine.placeOrder({ symbol: 'AAPL', side: 'buy', type: 'market', qty: 10, reason: 'test' });
  assert.equal(o.status, 'filled');
  assert.equal(o.fillPrice, 110.1); // achat au prix vendeur (ask)
  const gross = (10 * 110.1) / 1.1; // 1000.909…
  assert.equal(o.grossEur, Math.round(gross * 100) / 100);
  assert.equal(o.fees.broker, Math.round((2 + gross * 0.0015) * 100) / 100);
  assert.equal(o.fees.fx, Math.round(gross * 0.0025 * 100) / 100);
  assert.ok(Math.abs(store.data.cash - (5000 - gross - o.fees.total)) < 0.011);
  const pos = store.data.positions.AAPL;
  assert.equal(pos.qty, 10);
  assert.equal(o.reason, 'test');
});

test('bourse fermée : ordre au marché en attente, liquidités réservées, exécuté au premier cours du jour', async () => {
  const { md, engine, store, setNow } = setup('2026-10-03T10:00:00Z'); // samedi
  md.set('ABI.BR', { currency: 'EUR', price: 60, bid: null, ask: null, time: Date.parse('2026-10-02T15:30:00Z') });
  const o = await engine.placeOrder({ symbol: 'ABI.BR', side: 'buy', type: 'market', qty: 10 });
  assert.equal(o.status, 'pending');
  assert.match(o.statusReason, /ouverture/);
  assert.ok(engine.reservedCash() > 600);

  // Lundi 9 h 05 (Bruxelles) : ouverte, mais le cours différé date encore de vendredi → on attend
  setNow('2026-10-05T07:05:00Z');
  md.push('ABI.BR');
  assert.equal(o.status, 'pending');

  // Premier cours du lundi reçu → exécution (fourchette simulée de 0,05 %)
  md.set('ABI.BR', { price: 61, time: Date.parse('2026-10-05T07:01:00Z') });
  md.push('ABI.BR');
  assert.equal(o.status, 'filled');
  assert.ok(Math.abs(o.fillPrice - 61 * 1.00025) < 1e-9);
  assert.equal(o.fees.fx, 0); // pas de change en euros
  assert.equal(o.fees.broker, Math.round((1 + (10 * o.fillPrice) * 0.001) * 100) / 100);
  assert.equal(engine.reservedCash(), 0);
  assert.equal(store.data.positions['ABI.BR'].qty, 10);
});

test('ordre limite : attend que le prix atteigne la limite', async () => {
  const { md, engine } = setup(US_OPEN);
  md.set('MSFT', { currency: 'USD', price: 400, bid: 399.9, ask: 400.1, time: Date.parse(US_OPEN) });
  const o = await engine.placeOrder({ symbol: 'MSFT', side: 'buy', type: 'limit', qty: 2, limitPrice: 390 });
  assert.equal(o.status, 'pending');
  md.set('MSFT', { price: 392, bid: 391.9, ask: 392.1 });
  md.push('MSFT');
  assert.equal(o.status, 'pending');
  md.set('MSFT', { price: 389, bid: 388.9, ask: 389.1 });
  md.push('MSFT');
  assert.equal(o.status, 'filled');
  assert.equal(o.fillPrice, 389.1);
});

test('stop-loss : vente automatique de toute la position', async () => {
  const { md, engine, store } = setup(US_OPEN);
  md.set('TSLA', { currency: 'USD', price: 200, bid: 199.9, ask: 200.1, time: Date.parse(US_OPEN) });
  await engine.placeOrder({ symbol: 'TSLA', side: 'buy', type: 'market', qty: 5, stopLoss: 180, takeProfit: 250 });
  assert.equal(store.data.positions.TSLA.stopLoss, 180);
  md.set('TSLA', { price: 179, bid: 178.9, ask: 179.1 });
  md.push('TSLA');
  assert.equal(store.data.positions.TSLA, undefined);
  const sl = store.data.orders.find((o) => o.origin === 'stop-loss');
  assert.equal(sl.status, 'filled');
  assert.equal(sl.qty, 5);
  assert.ok(sl.realizedEur < 0);
});

test('take-profit : vente automatique quand l’objectif est atteint', async () => {
  const { md, engine, store } = setup(US_OPEN);
  md.set('NVDA', { currency: 'USD', price: 100, bid: 99.95, ask: 100.05, time: Date.parse(US_OPEN) });
  await engine.placeOrder({ symbol: 'NVDA', side: 'buy', type: 'market', qty: 10, takeProfit: 120 });
  md.set('NVDA', { price: 121, bid: 120.9, ask: 121.1 });
  md.push('NVDA');
  const tp = store.data.orders.find((o) => o.origin === 'take-profit');
  assert.equal(tp.status, 'filled');
  assert.ok(tp.realizedEur > 0);
  const stats = await engine.stats();
  assert.equal(stats.sells, 1);
  assert.equal(stats.winRate, 100);
});

test('vente : résultat réalisé calculé frais compris, position partiellement soldée', async () => {
  const { md, engine, store } = setup(US_OPEN);
  md.set('AMZN', { currency: 'USD', price: 100, bid: 100, ask: 100, time: Date.parse(US_OPEN) });
  await engine.placeOrder({ symbol: 'AMZN', side: 'buy', type: 'market', qty: 10 });
  const cost = store.data.positions.AMZN.costEur;
  const sell = await engine.placeOrder({ symbol: 'AMZN', side: 'sell', type: 'market', qty: 4 });
  assert.equal(sell.status, 'filled');
  const net = sell.grossEur - sell.fees.total;
  assert.ok(Math.abs(sell.realizedEur - (net - cost * 0.4)) < 0.011);
  assert.equal(store.data.positions.AMZN.qty, 6);
  assert.ok(Math.abs(store.data.positions.AMZN.costEur - cost * 0.6) < 1e-6);
});

test('refus clairs : vente à découvert, quantité trop grande, liquidités insuffisantes, indice', async () => {
  const { md, engine } = setup(US_OPEN);
  md.set('AAPL', { currency: 'USD', price: 100, bid: 100, ask: 100, time: Date.parse(US_OPEN) });
  await assert.rejects(engine.placeOrder({ symbol: 'AAPL', side: 'sell', type: 'market', qty: 1 }), /ne possèdes pas/);
  await assert.rejects(engine.placeOrder({ symbol: 'AAPL', side: 'buy', type: 'market', qty: 1000 }), /Liquidités insuffisantes/);
  await assert.rejects(engine.placeOrder({ symbol: 'AAPL', side: 'buy', type: 'market', qty: 1.5 }), /entière/);
  await assert.rejects(engine.placeOrder({ symbol: '^GSPC', side: 'buy', type: 'market', qty: 1 }), /ETF/);
  await assert.rejects(engine.placeOrder({ symbol: 'ZZZZ', side: 'buy', type: 'market', qty: 1 }), /introuvable/);
  await engine.placeOrder({ symbol: 'AAPL', side: 'buy', type: 'market', qty: 3 });
  await assert.rejects(engine.placeOrder({ symbol: 'AAPL', side: 'sell', type: 'market', qty: 4 }), /que 3/);
  await assert.rejects(engine.placeOrder({ symbol: 'AAPL', side: 'buy', type: 'market', qty: 1, stopLoss: 120 }), /stop-loss/);
});

test('TOB belge plafonnée et frais de change sur une action londonienne', async () => {
  const { md, engine } = setup('2026-09-30T10:00:00Z', { fees: { tob: { enabled: true } } });
  md.set('SHEL.L', { currency: 'GBP', price: 25, bid: 25, ask: 25, time: Date.parse('2026-09-30T09:59:00Z') });
  const o = await engine.placeOrder({ symbol: 'SHEL.L', side: 'buy', type: 'market', qty: 100 });
  assert.equal(o.status, 'filled');
  const gross = (100 * 25) / 0.85;
  assert.equal(o.fees.zone, 'Europe');
  assert.equal(o.fees.tob, Math.round(gross * 0.0035 * 100) / 100);
  assert.equal(o.fees.fx, Math.round(gross * 0.0025 * 100) / 100);
});

test('annulation d’un ordre en attente : réservation libérée', async () => {
  const { md, engine } = setup('2026-10-03T10:00:00Z');
  md.set('MC.PA', { currency: 'EUR', price: 600, time: Date.parse('2026-10-02T15:30:00Z') });
  const o = await engine.placeOrder({ symbol: 'MC.PA', side: 'buy', type: 'market', qty: 2 });
  assert.ok(engine.reservedCash() > 1200);
  engine.cancelOrder(o.id);
  assert.equal(o.status, 'cancelled');
  assert.equal(engine.reservedCash(), 0);
});
