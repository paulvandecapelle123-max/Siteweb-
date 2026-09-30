// Twelve Data (clé gratuite) : source de secours pour les actions américaines.
// Offre gratuite « Basic » : 800 crédits/jour, 8/minute, marchés US (les bourses hors US sont payantes).

import { AppError, explainError, withTimeout } from '../errors.js';

const BASE = 'https://api.twelvedata.com';

export class TwelveDataProvider {
  constructor() {
    this.key = '';
    this.calls = [];
    this.blockedUntil = 0;
    this.status = { state: 'no-key', message: 'Aucune clé (facultatif) : source de secours pour les actions US.' };
  }

  setKey(key) {
    this.key = (key || '').trim();
    this.status = this.key
      ? { state: 'ready', message: 'Clé Twelve Data enregistrée (utilisée en secours).' }
      : { state: 'no-key', message: 'Aucune clé (facultatif) : source de secours pour les actions US.' };
  }

  get available() {
    return !!this.key && Date.now() > this.blockedUntil;
  }

  async call(path, params = {}, key = this.key) {
    if (!key) throw new AppError('NO_KEY', 'Aucune clé Twelve Data configurée.', { source: 'twelvedata' });
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < 60000);
    if (now < this.blockedUntil || this.calls.length >= 8) {
      throw new AppError('RATE_LIMIT', "Limite d'appels Twelve Data atteinte (8/min en gratuit). Nouvelle tentative dans une minute.", { source: 'twelvedata', status: 429 });
    }
    this.calls.push(now);
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('apikey', key);
    let res;
    try {
      res = await withTimeout(fetch(url), 10000, 'Twelve Data');
    } catch (err) {
      throw explainError(err, 'twelvedata');
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* rien */
    }
    if (!res.ok || !body || body.status === 'error') {
      const e = new Error(body?.message || res.statusText || 'erreur');
      e.status = body?.code || res.status;
      const err = explainError(e, 'twelvedata', params.symbol);
      if (err.code === 'RATE_LIMIT') this.blockedUntil = Date.now() + 60000;
      this.status = { state: err.code === 'INVALID_KEY' ? 'invalid-key' : 'error', message: err.message };
      throw err;
    }
    this.status = { state: 'ready', message: 'Twelve Data opérationnel (secours).' };
    return body;
  }

  async testKey(key) {
    const b = await this.call('/quote', { symbol: 'AAPL' }, key);
    if (!b?.close) throw new AppError('UNAVAILABLE', 'Réponse inattendue de Twelve Data.', { source: 'twelvedata' });
    return true;
  }

  async quote(symbol) {
    const b = await this.call('/quote', { symbol: symbol.replace(/-/g, '.') });
    const num = (v) => (v == null || v === '' ? null : Number(v));
    return {
      symbol,
      name: b.name,
      currency: b.currency,
      price: num(b.close),
      change: num(b.change),
      changePct: num(b.percent_change),
      prevClose: num(b.previous_close),
      open: num(b.open),
      dayHigh: num(b.high),
      dayLow: num(b.low),
      volume: num(b.volume),
      time: b.timestamp ? Number(b.timestamp) * 1000 : Date.now(),
      delayMin: 0,
      source: 'twelvedata',
    };
  }

  /** Historique : interval parmi 5min, 30min, 1h, 1day, 1week. */
  async timeSeries(symbol, interval, outputsize) {
    const b = await this.call('/time_series', { symbol: symbol.replace(/-/g, '.'), interval, outputsize, timezone: 'UTC', order: 'ASC' });
    const candles = (b.values || []).map((v) => ({
      time: Math.floor(Date.parse(v.datetime.replace(' ', 'T') + (v.datetime.length > 10 ? 'Z' : 'T00:00:00Z')) / 1000),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume || 0),
    }));
    return { meta: { currency: b.meta?.currency }, candles };
  }
}
