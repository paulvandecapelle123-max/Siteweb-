// Mode démo : imite les réponses HTTP de Yahoo Finance avec des prix simulés.
// Utile pour découvrir l'appli hors connexion et pour les tests automatiques.
// Les prix suivent une courbe déterministe (fonction du temps) : historique et « direct » concordent.

import { CATALOG, INDEX_ETFS, INDICES, SECTORS_FR } from '../catalog.js';
import { EXCHANGES, exchangeForSymbol, isOpenAt } from '../markets.js';

const SECTOR_EN = Object.fromEntries(Object.entries(SECTORS_FR).map(([en, fr]) => [fr, en]));
const COUNTRY_EN = {
  US: 'United States', BE: 'Belgium', FR: 'France', NL: 'Netherlands', DE: 'Germany', GB: 'United Kingdom', CH: 'Switzerland',
  IT: 'Italy', ES: 'Spain', JP: 'Japan', HK: 'Hong Kong', CA: 'Canada', IE: 'Ireland', PT: 'Portugal', SE: 'Sweden',
  DK: 'Denmark', FI: 'Finland', NO: 'Norway', AU: 'Australia', KR: 'South Korea', TW: 'Taiwan', IN: 'India', CN: 'China',
  BR: 'Brazil', SG: 'Singapore',
};
const FX = {
  USD: 1.08, GBP: 0.85, CHF: 0.94, JPY: 162, HKD: 8.45, CAD: 1.47, SEK: 11.3, DKK: 7.46, NOK: 11.6, PLN: 4.3, AUD: 1.63,
  NZD: 1.8, SGD: 1.45, KRW: 1480, INR: 92, BRL: 5.9, MXN: 19.5, CNY: 7.8, TWD: 34.5, ZAR: 19.8,
};
const SCALE = { JPY: 150, KRW: 1400, HKD: 8, INR: 90, TWD: 33, SEK: 11, NOK: 11, DKK: 7.5, MXN: 19, BRL: 5.5, CNY: 7, GBP: 100 };
const YAHOO_CODE = { US: 'NMS', BR: 'BRU', PA: 'PAR', AS: 'AMS', DE: 'GER', L: 'LSE', MI: 'MIL', MC: 'MCE', SW: 'EBS', T: 'JPX', HK: 'HKG', TO: 'TOR' };

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// Univers de la démo : catalogue + ETF d'indices + indices + indices de référence
const UNIVERSE = new Map();
for (const c of CATALOG) UNIVERSE.set(c.symbol, { symbol: c.symbol, name: c.name, quoteType: c.quoteType, sector: c.sector });
for (const group of Object.values(INDEX_ETFS)) {
  for (const e of group.etfs) if (!UNIVERSE.has(e.symbol)) UNIVERSE.set(e.symbol, { symbol: e.symbol, name: e.name, quoteType: 'ETF', sector: 'ETF (diversifié)' });
}
for (const i of INDICES) UNIVERSE.set(i.symbol, { symbol: i.symbol, name: i.name, quoteType: 'INDEX', exchangeId: i.exchangeId });
for (const ex of EXCHANGES) if (ex.index && !UNIVERSE.has(ex.index)) UNIVERSE.set(ex.index, { symbol: ex.index, name: `Indice ${ex.city}`, quoteType: 'INDEX', exchangeId: ex.id });

function exchangeOf(item) {
  if (item.exchangeId) return EXCHANGES.find((e) => e.id === item.exchangeId);
  return exchangeForSymbol(item.symbol);
}

function currencyOf(item, ex) {
  if (ex?.id === 'L' && item.quoteType !== 'INDEX') return 'GBp';
  return ex?.currency || 'USD';
}

function basePrice(item, ex) {
  const h = hash(item.symbol);
  if (item.quoteType === 'INDEX') return 4000 + h * 36000;
  const cur = ex?.currency || 'USD';
  return (15 + h * 400) * (SCALE[cur] || 1);
}

/** Prix simulé à l'instant t (ms) : tendance + cycles + bruit déterministe. */
function priceAt(item, ex, t) {
  const h = hash(item.symbol);
  const days = t / 86400000;
  const trend = 1 + 0.12 * Math.sin(days / 60 + h * 6.28);
  const swing = 0.05 * Math.sin(days / 9 + h * 12.1) + 0.02 * Math.sin(days * 1.7 + h * 3);
  const intraday = 0.006 * Math.sin(t / 1800000 + h * 40) + 0.003 * Math.sin(t / 240000 + h * 7);
  const noise = 0.002 * Math.sin(t / 37000 + h * 99) * Math.cos(t / 91000);
  return basePrice(item, ex) * trend * (1 + swing + intraday + noise);
}

const lastCloseCache = new Map();
/** Dernier instant (≤ now) où la bourse était ouverte. */
function lastOpenTime(ex, now) {
  const key = `${ex.id}|${Math.floor(now / 60000)}`;
  if (lastCloseCache.has(key)) return lastCloseCache.get(key);
  let t = Math.floor(now / 60000) * 60000;
  for (let i = 0; i < 14 * 96 && !isOpenAt(ex, t); i++) t -= 15 * 60000;
  // affiner à la minute
  let fine = t;
  while (isOpenAt(ex, fine + 60000) && fine + 60000 <= now) fine += 60000;
  lastCloseCache.set(key, fine);
  return fine;
}

function yahooQuote(item) {
  const ex = exchangeOf(item);
  const now = Date.now();
  const open = ex ? isOpenAt(ex, now) : true;
  const delay = !ex || ex.id === 'US' ? 0 : ex.id === 'L' || ex.region === 'Asie-Pacifique' ? 20 : 15;
  const t = open ? now - delay * 60000 : ex ? lastOpenTime(ex, now) : now;
  const price = priceAt(item, ex, t);
  // Clôture de la veille : dernier instant ouvert avant le début de la séance du jour de t
  let prevT = t - 86400000;
  if (ex) prevT = lastOpenTime(ex, Math.min(prevT, t - 12 * 3600000));
  const prev = priceAt(item, ex, prevT);
  const cur = currencyOf(item, ex);
  const spread = price * 0.0004;
  return {
    language: 'en-US',
    region: 'US',
    quoteType: item.quoteType,
    currency: cur,
    marketState: open ? 'REGULAR' : 'CLOSED',
    exchange: YAHOO_CODE[ex?.id] || ex?.id || 'NMS',
    fullExchangeName: ex?.name || 'Demo',
    exchangeTimezoneName: ex?.tz || 'America/New_York',
    shortName: item.name,
    longName: item.name,
    symbol: item.symbol,
    regularMarketPrice: price,
    regularMarketChange: price - prev,
    regularMarketChangePercent: ((price - prev) / prev) * 100,
    regularMarketPreviousClose: prev,
    regularMarketOpen: prev * (1 + 0.003 * Math.sin(hash(item.symbol) * 50)),
    regularMarketDayHigh: Math.max(price, prev) * 1.006,
    regularMarketDayLow: Math.min(price, prev) * 0.994,
    regularMarketVolume: Math.floor(100000 + hash(item.symbol) * 5e6),
    regularMarketTime: Math.floor(t / 1000),
    bid: item.quoteType === 'INDEX' ? 0 : price - spread,
    ask: item.quoteType === 'INDEX' ? 0 : price + spread,
    fiftyTwoWeekLow: price * 0.78,
    fiftyTwoWeekHigh: price * 1.19,
    trailingPE: item.quoteType === 'EQUITY' ? 8 + hash(item.symbol) * 30 : undefined,
    marketCap: item.quoteType === 'EQUITY' ? Math.floor(1e9 + hash(item.symbol) * 5e11) : undefined,
    exchangeDataDelayedBy: delay,
    quoteSourceName: delay ? 'Delayed Quote' : 'Nasdaq Real Time Price',
    sourceInterval: 15,
  };
}

function fxQuote(cur) {
  const base = FX[cur];
  if (!base) return null;
  const t = Date.now();
  const rate = base * (1 + 0.004 * Math.sin(t / 3600000 + hash(cur) * 10));
  return { symbol: `EUR${cur}=X`, quoteType: 'CURRENCY', currency: cur, regularMarketPrice: rate, regularMarketTime: Math.floor(t / 1000), marketState: 'REGULAR', exchangeDataDelayedBy: 0 };
}

const INTERVAL_MS = { '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000, '30m': 1800000, '60m': 3600000, '90m': 5400000, '1h': 3600000, '1d': 86400000, '5d': 5 * 86400000, '1wk': 7 * 86400000, '1mo': 30 * 86400000 };

function chart(item, p1, p2, interval) {
  const ex = exchangeOf(item);
  const step = INTERVAL_MS[interval] || 86400000;
  const daily = step >= 86400000;
  const timestamps = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];
  const v = [];
  const start = Math.floor(p1 / step) * step;
  for (let t = start; t <= p2; t += step) {
    let ts = t;
    if (daily) {
      // cotation quotidienne : on prend la clôture de la séance (s'il y en a une ce jour-là)
      const [hh, mm] = (ex?.sessions.at(-1)[1] || '16:00').split(':').map(Number);
      const d = new Date(t);
      ts = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh - 1, mm - 1);
      if (ex && step === 86400000 && !isOpenAt(ex, ts)) continue;
    } else if (ex && !isOpenAt(ex, t)) continue;
    if (ts > Date.now()) break;
    const close = priceAt(item, ex, ts);
    const openP = priceAt(item, ex, ts - step * 0.9);
    timestamps.push(Math.floor(ts / 1000));
    o.push(openP);
    c.push(close);
    h.push(Math.max(openP, close) * 1.002);
    l.push(Math.min(openP, close) * 0.998);
    v.push(Math.floor(1000 + hash(item.symbol + ts) * 50000));
  }
  const cur = currencyOf(item, ex);
  return {
    meta: { currency: cur, symbol: item.symbol, exchangeTimezoneName: ex?.tz, chartPreviousClose: o[0], regularMarketPrice: c.at(-1) },
    timestamp: timestamps.length ? timestamps : undefined,
    indicators: { quote: [timestamps.length ? { open: o, high: h, low: l, close: c, volume: v } : {}] },
  };
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Remplace fetch() pour yahoo-finance2. */
export function createDemoFetch() {
  return async function demoFetch(input) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    await new Promise((r) => setTimeout(r, 30));

    if (url.hostname === 'finance.yahoo.com') {
      const headers = new Headers({ 'content-type': 'text/html' });
      headers.append('set-cookie', `A3=demo; Domain=.yahoo.com; Path=/; Expires=${new Date(Date.now() + 365 * 86400000).toUTCString()}; Secure`);
      return new Response('<html></html>', { status: 200, headers });
    }
    if (url.pathname === '/v1/test/getcrumb') return new Response('demoCrumb', { status: 200 });

    if (url.pathname === '/v7/finance/quote') {
      const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
      const result = [];
      for (const s of symbols) {
        const fx = /^EUR([A-Z]{3})=X$/.exec(s);
        if (fx) {
          const q = fxQuote(fx[1]);
          if (q) result.push(q);
          continue;
        }
        const item = UNIVERSE.get(s);
        if (item) result.push(yahooQuote(item));
      }
      return json({ quoteResponse: { result, error: null } });
    }

    if (url.pathname === '/v1/finance/search') {
      const q = norm(url.searchParams.get('q'));
      const quotes = [...UNIVERSE.values()]
        .filter((i) => i.quoteType !== 'INDEX' && (norm(i.name).includes(q) || norm(i.symbol).startsWith(q)))
        .slice(0, 20)
        .map((i, idx) => {
          const ex = exchangeOf(i);
          return {
            exchange: YAHOO_CODE[ex?.id] || ex?.id, shortname: i.name, longname: i.name, quoteType: i.quoteType, symbol: i.symbol,
            index: 'quotes', score: 1000 - idx, typeDisp: i.quoteType === 'ETF' ? 'ETF' : 'Equity', exchDisp: ex?.name, isYahooFinance: true,
            sector: SECTOR_EN[i.sector],
          };
        });
      return json({ explains: [], count: quotes.length, quotes, news: [], nav: [], lists: [], researchReports: [], totalTime: 1, timeTakenForQuotes: 1, timeTakenForNews: 0, timeTakenForAlgowatchlist: 0, timeTakenForPredefinedScreener: 0, timeTakenForCrunchbase: 0, timeTakenForNav: 0, timeTakenForResearchReports: 0 });
    }

    let m = /^\/v8\/finance\/chart\/(.+)$/.exec(url.pathname);
    if (m) {
      const symbol = decodeURIComponent(m[1]);
      const item = UNIVERSE.get(symbol);
      if (!item) return json({ chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } }, 404);
      const p1 = Number(url.searchParams.get('period1')) * 1000;
      const p2 = Number(url.searchParams.get('period2')) * 1000 || Date.now();
      return json({ chart: { result: [chart(item, p1, p2, url.searchParams.get('interval') || '1d')], error: null } });
    }

    m = /^\/v10\/finance\/quoteSummary\/(.+)$/.exec(url.pathname);
    if (m) {
      const symbol = decodeURIComponent(m[1]);
      const item = UNIVERSE.get(symbol);
      if (!item) return json({ quoteSummary: { result: null, error: { code: 'Not Found', description: 'Quote not found for symbol: ' + symbol } } }, 404);
      const ex = exchangeOf(item);
      return json({
        quoteSummary: {
          result: [{ assetProfile: item.quoteType === 'EQUITY' ? { sector: SECTOR_EN[item.sector] || item.sector, country: COUNTRY_EN[ex?.cc] || 'United States', industry: 'Demo' } : {}, quoteType: { quoteType: item.quoteType, symbol } }],
          error: null,
        },
      });
    }

    return json({ finance: { result: null, error: { code: 'Not Found', description: 'Demo: route inconnue' } } }, 404);
  };
}
