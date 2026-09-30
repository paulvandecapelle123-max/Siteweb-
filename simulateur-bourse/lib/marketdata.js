// Agrégateur de données de marché : choisit la meilleure source pour chaque ticker,
// garde les dernières cotations en mémoire, les rafraîchit en tâche de fond et les diffuse.
//
//  • Yahoo Finance : toutes les bourses, indices, ETF, taux de change (source principale)
//  • Finnhub WebSocket : transactions US en temps réel (si une clé est configurée)
//  • Finnhub REST / Twelve Data : secours pour les actions US si Yahoo ne répond pas
//  • BCE (Frankfurter) : secours pour les taux de change

import { EventEmitter } from 'node:events';
import { YahooProvider, normalizeYahooQuote, normalizeCurrency } from './providers/yahoo.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { TwelveDataProvider } from './providers/twelvedata.js';
import { FxService } from './fx.js';
import {
  EXCHANGES, EXCHANGE_BY_ID, exchangeForSymbol, isTradableSymbol, marketStatus,
  calendarSaysOpenToday, firstSessionStart, localDateKey, setHolidayHint, publicExchangeInfo,
} from './markets.js';
import { INDICES, CATALOG, CATALOG_BY_SYMBOL, searchCatalog, sectorFr } from './catalog.js';
import { AppError } from './errors.js';

const COUNTRY_FR = {
  'United States': 'États-Unis', Belgium: 'Belgique', France: 'France', Netherlands: 'Pays-Bas', Germany: 'Allemagne',
  'United Kingdom': 'Royaume-Uni', Switzerland: 'Suisse', Italy: 'Italie', Spain: 'Espagne', Japan: 'Japon', China: 'Chine',
  'Hong Kong': 'Hong Kong', Canada: 'Canada', Ireland: 'Irlande', Luxembourg: 'Luxembourg', Denmark: 'Danemark',
  Sweden: 'Suède', Norway: 'Norvège', Finland: 'Finlande', Portugal: 'Portugal', Austria: 'Autriche', Australia: 'Australie',
  'South Korea': 'Corée du Sud', Taiwan: 'Taïwan', India: 'Inde', Brazil: 'Brésil', Singapore: 'Singapour', Israel: 'Israël',
  Mexico: 'Mexique', Poland: 'Pologne', Jersey: 'Jersey', Bermuda: 'Bermudes', 'Cayman Islands': 'Îles Caïmans',
  Uruguay: 'Uruguay', Argentina: 'Argentine', 'South Africa': 'Afrique du Sud', 'New Zealand': 'Nouvelle-Zélande',
};

const OTC_CODES = new Set(['PNK', 'OQB', 'OQX', 'OBB', 'OEM', 'OGM', 'OTC']);
const INDEX_BY_SYMBOL = Object.fromEntries(INDICES.map((i) => [i.symbol, i]));
const REFERENCE_INDEX = Object.fromEntries(EXCHANGES.filter((e) => e.index).map((e) => [e.index, e]));

const RANGES = {
  '1d': { days: 5, interval: '5m', intraday: true, lastSession: true, ttl: 60000, td: ['5min', 400] },
  '1w': { days: 7, interval: '30m', intraday: true, ttl: 5 * 60000, td: ['30min', 200] },
  '1m': { days: 31, interval: '60m', intraday: true, ttl: 15 * 60000, td: ['1h', 250] },
  '1y': { days: 366, interval: '1d', ttl: 3600000, td: ['1day', 260] },
  '5y': { days: 5 * 366, interval: '1wk', ttl: 6 * 3600000, td: ['1week', 270] },
};

export function exchangeOf(symbol) {
  const idx = INDEX_BY_SYMBOL[symbol];
  if (idx) return EXCHANGE_BY_ID[idx.exchangeId];
  if (REFERENCE_INDEX[symbol]) return REFERENCE_INDEX[symbol];
  return exchangeForSymbol(symbol);
}

export class MarketData extends EventEmitter {
  constructor({ cacheStore, fetchImpl = null, demo = false }) {
    super();
    this.demo = demo;
    this.cache = cacheStore;
    if (!cacheStore.data.profiles) cacheStore.data.profiles = {};
    this.yahoo = new YahooProvider({ fetchImpl });
    this.finnhub = new FinnhubProvider();
    this.twelve = new TwelveDataProvider();
    if (demo) this.finnhub.disabled = true;
    this.fx = new FxService(cacheStore, { offline: demo });
    this.quotes = new Map();
    this.live = new Map();
    this.notFound = new Map();
    this.focus = new Map();
    this.trackers = [];
    this.historyCache = new Map();
    this.statusCache = new Map();
    this.refreshMs = 15000;
    this.sources = { yahoo: { state: 'unknown', message: 'En attente de la première cotation…' } };
    this.pendingEmit = new Set();
    this.emitTimer = null;
    this.refreshing = null;
    this.finnhub.on('trade', (t) => this.onTrade(t));
    this.finnhub.on('status', () => this.emit('sources', this.sourceStatus()));
  }

  applySettings(settings) {
    this.refreshMs = Math.max(5, Number(settings.refreshSeconds) || 15) * 1000;
    if (!this.demo) {
      this.finnhub.setKey(settings.finnhubKey || '').catch(() => {});
      this.twelve.setKey(settings.twelveDataKey || '');
    }
    this.emit('sources', this.sourceStatus());
  }

  /** Fonction renvoyant des tickers à suivre en permanence (positions, ordres, favoris…). */
  addTracker(fn) {
    this.trackers.push(fn);
  }

  touchFocus(symbols, ttl = 180000) {
    const exp = Date.now() + ttl;
    for (const s of symbols) if (s) this.focus.set(s, exp);
  }

  trackedSymbols() {
    const list = [];
    const seen = new Set();
    const add = (s) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        list.push(s);
      }
    };
    for (const fn of this.trackers) for (const s of fn()) add(s);
    const now = Date.now();
    for (const [s, exp] of this.focus) {
      if (exp < now) this.focus.delete(s);
      else add(s);
    }
    for (const i of INDICES) add(i.symbol);
    for (const s of [...list]) add(exchangeForSymbol(s)?.index);
    return list;
  }

  setSource(name, state, message) {
    const prev = this.sources[name];
    this.sources[name] = { state, message, at: Date.now() };
    if (!prev || prev.state !== state || prev.message !== message) this.emit('sources', this.sourceStatus());
  }

  sourceStatus() {
    return {
      demo: this.demo,
      yahoo: this.sources.yahoo,
      finnhub: this.demo ? { state: 'demo', message: 'Mode démo : pas de flux réel.' } : this.finnhub.status,
      twelvedata: this.twelve.status,
      fx: this.fx.status,
      refreshSeconds: this.refreshMs / 1000,
    };
  }

  statusFor(exId) {
    const now = Date.now();
    const c = this.statusCache.get(exId);
    if (c && now - c.at < 15000) return c.status;
    const status = marketStatus(exId, now);
    this.statusCache.set(exId, { at: now, status });
    return status;
  }

  invalidateStatuses() {
    this.statusCache.clear();
  }

  /** Ajoute bourse, état du marché, fraîcheur du prix et conversion en euros. */
  decorate(q) {
    if (!q) return null;
    const ex = exchangeOf(q.symbol);
    const st = ex ? this.statusFor(ex.id) : null;
    const rate = this.fx.rate(q.currency);
    const now = Date.now();
    let freshness;
    const refresh = `actualisé toutes les ${this.refreshMs / 1000} s`;
    if (st && !st.open) {
      freshness = { kind: 'closed', label: 'Marché fermé', note: 'Dernier cours connu ; les ordres au marché attendront l’ouverture.' };
    } else if (q.fetchedAt && now - q.fetchedAt > Math.max(3 * this.refreshMs, 90000)) {
      freshness = { kind: 'stale', label: 'Non actualisé', note: 'La source ne répond plus : ce prix peut être ancien.' };
    } else if (q.source === 'finnhub-ws' && now - (q.liveAt || 0) < 120000) {
      freshness = { kind: 'live', label: 'En direct', note: 'Flux temps réel Finnhub (transactions US).' };
    } else if (q.delayMin > 0) {
      freshness = { kind: 'delayed', label: `Différé de ${q.delayMin} min`, note: `Offre gratuite : la bourse impose un délai de ${q.delayMin} minutes (${refresh}).` };
    } else if (/delayed/i.test(q.sourceNote || '')) {
      freshness = { kind: 'delayed', label: 'Différé', note: `Cotation différée (${refresh}).` };
    } else {
      const src = q.source === 'yahoo' ? 'Yahoo Finance' : q.source === 'twelvedata' ? 'Twelve Data' : 'Finnhub';
      freshness = { kind: 'live', label: 'En direct', note: `Temps réel ${src} (${refresh}).` };
    }
    const catalog = CATALOG_BY_SYMBOL[q.symbol];
    return {
      ...q,
      name: q.name || catalog?.name || q.symbol,
      isIndex: q.symbol.startsWith('^') || !!REFERENCE_INDEX[q.symbol] || q.quoteType === 'INDEX',
      exchange: publicExchangeInfo(ex),
      market: st ? { open: st.open, state: st.state, detail: st.detail, hoursBrussels: st.hoursBrussels } : null,
      freshness,
      fxRate: rate,
      priceEur: rate && q.price != null ? q.price / rate : null,
      changeEur: rate && q.change != null ? q.change / rate : null,
    };
  }

  getQuote(symbol) {
    return this.decorate(this.quotes.get(symbol));
  }

  rawQuote(symbol) {
    return this.quotes.get(symbol) || null;
  }

  queueEmit(symbols) {
    for (const s of symbols) this.pendingEmit.add(s);
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      const list = [...this.pendingEmit].map((s) => this.getQuote(s)).filter(Boolean);
      this.pendingEmit.clear();
      if (list.length) this.emit('quotes', list);
    }, 300);
  }

  // ---------- Temps réel Finnhub ----------

  onTrade({ symbol, price, time }) {
    const q = this.quotes.get(symbol);
    if (!q || !(price > 0)) return;
    if (!this.statusFor('US').open) return; // on ignore l'avant/après-Bourse
    this.live.set(symbol, { price, time, at: Date.now() });
    this.mergeLive(q);
    this.queueEmit([symbol]);
  }

  mergeLive(q) {
    const l = this.live.get(q.symbol);
    if (!l) return;
    if (Date.now() - l.at > 5 * 60000) {
      this.live.delete(q.symbol);
      return;
    }
    if (q.time && l.time < q.time) return; // la cotation Yahoo est plus récente
    q.price = l.price;
    if (q.prevClose) {
      q.change = l.price - q.prevClose;
      q.changePct = (q.change / q.prevClose) * 100;
    }
    if (q.dayHigh != null && l.price > q.dayHigh) q.dayHigh = l.price;
    if (q.dayLow != null && l.price < q.dayLow) q.dayLow = l.price;
    q.time = l.time;
    q.source = 'finnhub-ws';
    q.liveAt = l.at;
    q.delayMin = 0;
  }

  updateFinnhubSubs() {
    if (this.demo) return;
    const us = this.trackedSymbols().filter((s) => isTradableSymbol(s) && exchangeForSymbol(s)?.id === 'US');
    this.finnhub.setSubscriptions(us);
  }

  // ---------- Cotations ----------

  async fetchQuotes(symbols, extra = []) {
    const all = [...new Set([...symbols, ...extra])].filter(Boolean);
    if (!all.length) return [];
    const updated = [];
    let raw = null;
    try {
      raw = await this.yahoo.rawQuotes(all);
      this.setSource('yahoo', 'ok', 'Yahoo Finance répond normalement.');
    } catch (err) {
      this.setSource('yahoo', err.code === 'RATE_LIMIT' ? 'rate-limit' : 'error', err.message);
    }

    if (raw) {
      this.fx.ingestYahoo(raw);
      const got = new Set();
      const now = Date.now();
      for (const r of raw) {
        if (!r?.symbol || /=X$/.test(r.symbol)) continue;
        const q = normalizeYahooQuote(r);
        if (q.price == null) continue;
        q.fetchedAt = now;
        this.mergeLive(q);
        this.quotes.set(q.symbol, q);
        this.notFound.delete(q.symbol);
        got.add(q.symbol);
        updated.push(q.symbol);
      }
      for (const s of symbols) if (!got.has(s)) this.notFound.set(s, now);
    } else {
      // Secours pour les actions américaines
      const us = symbols.filter((s) => isTradableSymbol(s) && exchangeForSymbol(s)?.id === 'US');
      for (const s of us.slice(0, 15)) {
        const ok = await this.fallbackQuote(s).catch(() => false);
        if (ok) updated.push(s);
      }
    }

    // Devises manquantes → paire Yahoo dédiée, sinon taux BCE
    const missing = new Set();
    for (const s of updated) {
      const cur = this.quotes.get(s)?.currency;
      if (cur && !this.fx.rate(cur)) missing.add(cur);
    }
    if (missing.size && raw) {
      try {
        this.fx.ingestYahoo(await this.yahoo.rawQuotes([...missing].map((c) => this.fx.yahooSymbol(c))));
      } catch {
        /* secours ci-dessous */
      }
    }
    const stillMissing = [...missing].some((c) => !this.fx.rate(c));
    if (stillMissing || !raw) await this.fx.refreshFallback(stillMissing);

    if (updated.length) this.queueEmit(updated);
    return updated;
  }

  async fallbackQuote(symbol) {
    let f = null;
    if (this.finnhub.key && this.finnhub.status.state !== 'invalid-key') {
      try {
        f = await this.finnhub.quote(symbol);
      } catch {
        f = null;
      }
    }
    if (!f && this.twelve.available) {
      try {
        f = await this.twelve.quote(symbol);
      } catch {
        f = null;
      }
    }
    if (!f) return false;
    const prev = this.quotes.get(symbol) || {
      symbol,
      name: CATALOG_BY_SYMBOL[symbol]?.name || f.name || symbol,
      quoteType: CATALOG_BY_SYMBOL[symbol]?.quoteType || 'EQUITY',
      currency: 'USD',
    };
    const q = { ...prev, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v != null)), bid: null, ask: null, fetchedAt: Date.now(), currency: 'USD' };
    this.mergeLive(q);
    this.quotes.set(symbol, q);
    return true;
  }

  /** Cotations à jour (au besoin interrogées immédiatement). */
  async getQuotes(symbols, { maxAge = 20000, track = true } = {}) {
    symbols = [...new Set(symbols.filter(Boolean))];
    if (track) this.touchFocus(symbols);
    const now = Date.now();
    const stale = symbols.filter((s) => {
      const q = this.quotes.get(s);
      return !q || now - (q.fetchedAt || 0) > maxAge;
    });
    if (stale.length) await this.fetchQuotes(stale);
    return symbols.map((s) => this.getQuote(s)).filter(Boolean);
  }

  /** Cotation fraîche obligatoire (passage d'ordre). */
  async requireQuote(symbol, maxAge = 10000) {
    const [q] = await this.getQuotes([symbol], { maxAge });
    if (q) return q;
    const src = this.sources.yahoo;
    if (src?.state === 'error' || src?.state === 'rate-limit') throw new AppError('UNAVAILABLE', src.message, { source: 'yahoo', status: 503 });
    throw new AppError('NOT_FOUND', `Ticker introuvable : ${symbol}. Vérifie l'orthographe ou cherche par nom d'entreprise.`, { status: 404 });
  }

  // ---------- Jours fériés détectés ----------

  updateHolidayHints() {
    const now = Date.now();
    for (const ex of EXCHANGES) {
      if (!ex.index || !calendarSaysOpenToday(ex, now)) continue;
      const today = localDateKey(ex, now);
      if (now < firstSessionStart(ex, now) + 45 * 60000) {
        setHolidayHint(ex.id, today, false);
        continue;
      }
      const q = this.quotes.get(ex.index);
      if (!q?.time || now - (q.fetchedAt || 0) > 10 * 60000) continue;
      const closed = localDateKey(ex, q.time) !== today && q.marketState !== 'REGULAR';
      setHolidayHint(ex.id, today, closed);
    }
    this.invalidateStatuses();
  }

  // ---------- Boucle de rafraîchissement ----------

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const symbols = this.trackedSymbols();
      const currencies = new Set([...this.quotes.values()].map((q) => q.currency).filter(Boolean));
      await this.fetchQuotes(symbols, this.fx.yahooSymbols([...currencies]));
      this.updateHolidayHints();
      this.updateFinnhubSubs();
      this.emit('refreshed');
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  nextDelay() {
    const src = this.sources.yahoo?.state;
    if (src === 'rate-limit') return 60000;
    if (src === 'error') return Math.max(this.refreshMs, 30000);
    const exIds = new Set(this.trackedSymbols().map((s) => exchangeOf(s)?.id).filter(Boolean));
    const anyOpen = [...exIds].some((id) => this.statusFor(id).open);
    return anyOpen ? this.refreshMs : Math.max(this.refreshMs, 60000);
  }

  start() {
    const loop = async () => {
      try {
        await this.refresh();
      } catch (err) {
        console.error('Rafraîchissement :', err.message);
      }
      this.loopTimer = setTimeout(loop, this.nextDelay());
    };
    loop();
  }

  stop() {
    clearTimeout(this.loopTimer);
    this.finnhub.disconnect();
  }

  // ---------- Recherche ----------

  async search(query, { exchangeId = '', region = '' } = {}) {
    query = String(query || '').trim().slice(0, 60);
    const matchEx = (ex) => !!ex && (!exchangeId || ex.id === exchangeId) && (!region || ex.region === region);
    const items = [];
    const seen = new Set();
    const push = (it) => {
      if (!it?.symbol || seen.has(it.symbol)) return;
      if (!matchEx(exchangeForSymbol(it.symbol))) return;
      seen.add(it.symbol);
      items.push(it);
    };
    let warning = null;

    if (!query) {
      for (const c of CATALOG) push({ symbol: c.symbol, name: c.name, quoteType: c.quoteType, sector: c.sector });
    } else {
      let remote = [];
      try {
        remote = await this.yahoo.search(query);
        this.setSource('yahoo', 'ok', 'Yahoo Finance répond normalement.');
      } catch (err) {
        warning = `${err.message} Résultats limités au catalogue local.`;
        if (this.finnhub.key && !this.demo) {
          try {
            remote = (await this.finnhub.search(query)).map((r) => ({ symbol: r.symbol, longname: r.name, quoteType: r.type === 'ETP' ? 'ETF' : 'EQUITY' }));
          } catch {
            /* rien */
          }
        }
      }
      const upper = query.toUpperCase();
      if (/^[A-Z0-9-]{1,12}(\.[A-Z]{1,3})?$/.test(upper) && isTradableSymbol(upper)) {
        const c = CATALOG_BY_SYMBOL[upper];
        if (c) push({ symbol: c.symbol, name: c.name, quoteType: c.quoteType, sector: c.sector });
      }
      for (const r of remote) {
        if (r.quoteType && !['EQUITY', 'ETF'].includes(r.quoteType)) continue;
        if (OTC_CODES.has(r.exchange)) continue; // marchés de gré à gré américains (ADR peu liquides) exclus
        if (!isTradableSymbol(r.symbol)) continue;
        const cat = CATALOG_BY_SYMBOL[r.symbol];
        push({
          symbol: r.symbol,
          name: r.longname || r.shortname || cat?.name || r.symbol,
          quoteType: r.quoteType || 'EQUITY',
          sector: sectorFr(r.sector) || cat?.sector || null,
        });
      }
      for (const c of searchCatalog(query)) push({ symbol: c.symbol, name: c.name, quoteType: c.quoteType, sector: c.sector });
      if (/^[A-Z0-9-]{1,12}(\.[A-Z]{1,3})?$/.test(upper) && isTradableSymbol(upper)) push({ symbol: upper, name: upper, direct: true });
    }

    const list = items.slice(0, 30);
    let quotes = [];
    try {
      quotes = await this.getQuotes(list.map((i) => i.symbol), { maxAge: 30000 });
    } catch (err) {
      warning = warning || err.message;
    }
    if (!quotes.length && list.length && this.sources.yahoo?.state !== 'ok') warning = warning || this.sources.yahoo?.message;
    const bySym = new Map(quotes.map((q) => [q.symbol, q]));
    const results = list
      .map((it) => {
        const q = bySym.get(it.symbol) || null;
        if (it.direct && !q) return null;
        return {
          symbol: it.symbol,
          name: q?.name || it.name,
          quoteType: q?.quoteType || it.quoteType,
          sector: it.sector || null,
          exchange: publicExchangeInfo(exchangeForSymbol(it.symbol)),
          quote: q,
        };
      })
      .filter(Boolean);
    if (!results.length && query && !warning) {
      warning = `Aucun résultat pour « ${query} »${exchangeId || region ? ' avec ce filtre' : ''}. Essaie le nom de l'entreprise ou un ticker complet (ex. ABI.BR, MC.PA, 7203.T).`;
    }
    return { results, warning };
  }

  // ---------- Historique ----------

  async history(symbol, range = '1m') {
    const r = RANGES[range] || RANGES['1m'];
    const key = `${symbol}|${range}`;
    const cached = this.historyCache.get(key);
    if (cached && Date.now() - cached.at < r.ttl) return cached.data;

    const period1 = new Date(Date.now() - r.days * 86400000);
    let data;
    let source = 'yahoo';
    try {
      data = await this.yahoo.chart(symbol, { period1, interval: r.interval });
    } catch (err) {
      const isUS = exchangeForSymbol(symbol)?.id === 'US' && isTradableSymbol(symbol);
      if (!isUS || !this.twelve.available) throw err;
      data = await this.twelve.timeSeries(symbol, r.td[0], r.td[1]);
      source = 'twelvedata';
    }
    const { divisor, currency } = normalizeCurrency(data.meta?.currency);
    let candles = data.candles;
    if (divisor !== 1) {
      candles = candles.map((c) => ({ ...c, open: c.open / divisor, high: c.high / divisor, low: c.low / divisor, close: c.close / divisor }));
    }
    const ex = exchangeOf(symbol);
    const tz = ex?.tz || data.meta?.exchangeTimezoneName || 'UTC';
    if (r.lastSession && candles.length) {
      const lastDay = localDateKey({ tz }, candles.at(-1).time * 1000);
      candles = candles.filter((c) => localDateKey({ tz }, c.time * 1000) === lastDay);
    }
    // Horodatages en ordre strictement croissant (exigé par le graphique)
    const clean = [];
    for (const c of candles) {
      if (!clean.length || c.time > clean.at(-1).time) clean.push(c);
    }
    const prevCloseRaw = data.meta?.chartPreviousClose ?? data.meta?.previousClose;
    const result = {
      symbol,
      range,
      interval: r.interval,
      intraday: !!r.intraday,
      currency,
      tz,
      source,
      prevClose: typeof prevCloseRaw === 'number' ? prevCloseRaw / divisor : null,
      candles: clean,
    };
    this.historyCache.set(key, { at: Date.now(), data: result });
    if (this.historyCache.size > 300) this.historyCache.delete(this.historyCache.keys().next().value);
    return result;
  }

  // ---------- Profil (secteur, pays) ----------

  async profile(symbol, quoteType = null) {
    const cached = this.cache.data.profiles[symbol];
    if (cached && Date.now() - cached.at < 30 * 86400000) return cached;
    const cat = CATALOG_BY_SYMBOL[symbol];
    const ex = exchangeForSymbol(symbol);
    const p = { sector: cat?.sector || null, country: ex?.country || null, industry: null, at: Date.now() };
    try {
      const y = await this.yahoo.profile(symbol);
      if (y.sector) p.sector = sectorFr(y.sector);
      if (y.country) p.country = COUNTRY_FR[y.country] || y.country;
      p.industry = y.industry;
      quoteType = quoteType || y.quoteType;
    } catch {
      p.at = Date.now() - 29 * 86400000; // on réessaiera demain
    }
    if (!p.sector) p.sector = quoteType === 'ETF' ? 'ETF (diversifié)' : 'Autre';
    if (!p.country) p.country = 'Autre';
    this.cache.data.profiles[symbol] = p;
    this.cache.save();
    return p;
  }
}
