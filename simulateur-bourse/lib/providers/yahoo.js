// Yahoo Finance via la bibliothèque yahoo-finance2 (sans clé API).
// Couverture : quasiment toutes les bourses mondiales, indices, ETF et taux de change.
// Délais : temps réel pour les actions US (flux « Nasdaq Real Time »), souvent 15–20 min ailleurs ;
// Yahoo l'indique pour chaque cotation dans le champ exchangeDataDelayedBy.

import YahooFinance from 'yahoo-finance2';
import { explainError, withTimeout } from '../errors.js';
import { toMs } from '../time.js';

const quietLogger = {
  info() {},
  debug() {},
  dir() {},
  warn(...args) {
    if (process.env.DEBUG) console.warn('[yahoo]', ...args);
  },
  error(...args) {
    if (process.env.DEBUG) console.error('[yahoo]', ...args);
  },
};

const TIMEOUT = 15000;

export class YahooProvider {
  constructor({ fetchImpl } = {}) {
    this.yf = new YahooFinance({
      suppressNotices: ['yahooSurvey', 'ripHistorical'],
      versionCheck: false,
      logger: quietLogger,
      queue: { concurrency: 4 },
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
  }

  /** Cotations brutes Yahoo pour une liste de tickers (découpée par paquets). */
  async rawQuotes(symbols) {
    const unique = [...new Set(symbols)].filter(Boolean);
    const out = [];
    for (let i = 0; i < unique.length; i += 40) {
      const chunk = unique.slice(i, i + 40);
      try {
        const res = await withTimeout(
          this.yf.quote(chunk, { return: 'array' }, { validateResult: false }),
          TIMEOUT,
          'cotations Yahoo',
        );
        if (Array.isArray(res)) out.push(...res);
      } catch (err) {
        throw explainError(err, 'yahoo');
      }
    }
    return out;
  }

  async search(q) {
    try {
      const res = await withTimeout(
        this.yf.search(q, { quotesCount: 25, newsCount: 0, enableFuzzyQuery: true, enableNavLinks: false }, { validateResult: false }),
        TIMEOUT,
        'recherche Yahoo',
      );
      return Array.isArray(res?.quotes) ? res.quotes : [];
    } catch (err) {
      throw explainError(err, 'yahoo', q);
    }
  }

  /**
   * Historique de prix. Renvoie { meta, candles: [{ time (s), open, high, low, close, volume }] }.
   */
  async chart(symbol, { period1, interval }) {
    try {
      const res = await withTimeout(
        this.yf.chart(symbol, { period1, interval, includePrePost: false, return: 'object' }, { validateResult: false }),
        TIMEOUT,
        'historique Yahoo',
      );
      const ts = res?.timestamp || [];
      const q = res?.indicators?.quote?.[0] || {};
      const candles = [];
      for (let i = 0; i < ts.length; i++) {
        const close = q.close?.[i];
        if (close == null || Number.isNaN(close)) continue;
        candles.push({
          time: Math.floor(toMs(ts[i]) / 1000),
          open: q.open?.[i] ?? close,
          high: q.high?.[i] ?? close,
          low: q.low?.[i] ?? close,
          close,
          volume: q.volume?.[i] ?? 0,
        });
      }
      return { meta: res?.meta || {}, candles };
    } catch (err) {
      throw explainError(err, 'yahoo', symbol);
    }
  }

  /** Profil (secteur, pays) d'une société. */
  async profile(symbol) {
    try {
      const res = await withTimeout(
        this.yf.quoteSummary(symbol, { modules: ['assetProfile', 'quoteType'] }, { validateResult: false }),
        TIMEOUT,
        'profil Yahoo',
      );
      return {
        sector: res?.assetProfile?.sector || null,
        industry: res?.assetProfile?.industry || null,
        country: res?.assetProfile?.country || null,
        quoteType: res?.quoteType?.quoteType || null,
      };
    } catch (err) {
      throw explainError(err, 'yahoo', symbol);
    }
  }
}

// Certaines bourses cotent en centimes : pence (Londres), cents sud-africains, agorot (Tel-Aviv)
const MINOR_UNITS = { GBp: ['GBP', 'pence (GBp)'], GBX: ['GBP', 'pence (GBp)'], ZAc: ['ZAR', 'cents (ZAc)'], ILA: ['ILS', 'agorot (ILA)'] };

export function normalizeCurrency(cur) {
  if (cur && MINOR_UNITS[cur]) return { currency: MINOR_UNITS[cur][0], divisor: 100, unitNote: `coté en ${MINOR_UNITS[cur][1]}` };
  return { currency: cur ? cur.toUpperCase() : null, divisor: 1, unitNote: null };
}

/** Convertit une cotation Yahoo brute dans le format interne. */
export function normalizeYahooQuote(q) {
  const { currency, divisor, unitNote } = normalizeCurrency(q.currency);
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v / divisor : null);
  const positive = (v) => {
    const x = n(v);
    return x && x > 0 ? x : null;
  };
  let ext = null;
  if (q.marketState === 'PRE' && typeof q.preMarketPrice === 'number') {
    ext = { label: 'Avant-Bourse', price: n(q.preMarketPrice), changePct: q.preMarketChangePercent ?? null, time: toMs(q.preMarketTime) };
  } else if ((q.marketState === 'POST' || q.marketState === 'POSTPOST') && typeof q.postMarketPrice === 'number') {
    ext = { label: 'Après-Bourse', price: n(q.postMarketPrice), changePct: q.postMarketChangePercent ?? null, time: toMs(q.postMarketTime) };
  }
  return {
    symbol: q.symbol,
    name: q.longName || q.shortName || q.displayName || q.symbol,
    shortName: q.shortName || null,
    quoteType: q.quoteType || null,
    yahooExchange: q.fullExchangeName || q.exchange || null,
    currency,
    unitNote,
    price: n(q.regularMarketPrice),
    change: n(q.regularMarketChange),
    changePct: typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : null,
    prevClose: n(q.regularMarketPreviousClose),
    open: n(q.regularMarketOpen),
    dayHigh: n(q.regularMarketDayHigh),
    dayLow: n(q.regularMarketDayLow),
    volume: q.regularMarketVolume ?? null,
    bid: positive(q.bid),
    ask: positive(q.ask),
    week52Low: n(q.fiftyTwoWeekLow),
    week52High: n(q.fiftyTwoWeekHigh),
    marketCap: q.marketCap ?? null,
    pe: q.trailingPE ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    time: toMs(q.regularMarketTime),
    marketState: q.marketState || null,
    delayMin: typeof q.exchangeDataDelayedBy === 'number' ? q.exchangeDataDelayedBy : null,
    sourceNote: q.quoteSourceName || null,
    ext,
    source: 'yahoo',
  };
}
