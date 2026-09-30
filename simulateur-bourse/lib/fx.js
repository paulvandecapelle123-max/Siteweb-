// Taux de change EUR → devise.
// Source principale : Yahoo (paires EURUSD=X…, mises à jour en continu pendant la journée).
// Secours : taux de référence quotidiens de la BCE via l'API gratuite Frankfurter (sans clé).

import { withTimeout } from './errors.js';
import { toMs } from './time.js';

export const BASE_CURRENCIES = ['USD', 'GBP', 'CHF', 'JPY', 'HKD', 'CAD'];

const FRANKFURTER_URLS = ['https://api.frankfurter.dev/v1/latest?base=EUR', 'https://api.frankfurter.app/latest?from=EUR'];

export class FxService {
  constructor(cacheStore, { offline = false } = {}) {
    this.cache = cacheStore;
    this.offline = offline;
    const saved = cacheStore.data.fx || {};
    this.rates = saved.rates || {};
    this.meta = saved.meta || {};
    this.lastFallback = 0;
    this.status = { state: Object.keys(this.rates).length ? 'cache' : 'unknown', message: '' };
  }

  yahooSymbol(cur) {
    return `EUR${cur}=X`;
  }

  yahooSymbols(currencies) {
    const set = new Set([...BASE_CURRENCIES, ...currencies]);
    set.delete('EUR');
    return [...set].filter(Boolean).map((c) => this.yahooSymbol(c));
  }

  /** Intègre les cotations Yahoo « EURxxx=X ». */
  ingestYahoo(rawQuotes) {
    let n = 0;
    for (const q of rawQuotes) {
      const m = /^EUR([A-Z]{3})=X$/.exec(q.symbol || '');
      if (!m || !(q.regularMarketPrice > 0)) continue;
      this.rates[m[1]] = q.regularMarketPrice;
      this.meta[m[1]] = { source: 'Yahoo Finance', time: toMs(q.regularMarketTime) || Date.now() };
      n++;
    }
    if (n) {
      this.status = { state: 'ok', message: 'Taux de change Yahoo (en continu).' };
      this.persist();
    }
    return n;
  }

  /** Secours : taux BCE du jour (au plus toutes les 30 min, ou 5 min si une devise manque). */
  async refreshFallback(urgent = false) {
    if (this.offline) return false;
    if (Date.now() - this.lastFallback < (urgent ? 5 : 30) * 60000) return false;
    this.lastFallback = Date.now();
    for (const url of FRANKFURTER_URLS) {
      try {
        const res = await withTimeout(fetch(url), 10000, 'Frankfurter');
        if (!res.ok) continue;
        const body = await res.json();
        if (!body?.rates) continue;
        const time = body.date ? Date.parse(`${body.date}T16:00:00+01:00`) : Date.now();
        for (const [cur, rate] of Object.entries(body.rates)) {
          // On ne remplace pas un taux Yahoo récent par le taux BCE de la veille
          const m = this.meta[cur];
          if (m && m.source === 'Yahoo Finance' && Date.now() - m.time < 6 * 3600000) continue;
          this.rates[cur] = rate;
          this.meta[cur] = { source: 'BCE (taux de référence du jour)', time };
        }
        this.status = { state: 'fallback', message: 'Taux de change de secours : référence BCE du jour.' };
        this.persist();
        return true;
      } catch {
        /* essai de l'URL suivante */
      }
    }
    this.status = { state: 'error', message: 'Taux de change indisponibles : derniers taux connus utilisés.' };
    return false;
  }

  persist() {
    this.cache.data.fx = { rates: this.rates, meta: this.meta };
    this.cache.save();
  }

  /** Nombre d'unités de devise pour 1 € (1 pour l'euro, null si inconnu). */
  rate(cur) {
    if (!cur || cur === 'EUR') return 1;
    return this.rates[cur] || null;
  }

  toEur(amount, cur) {
    const r = this.rate(cur);
    return r ? amount / r : null;
  }

  snapshot() {
    return { rates: { EUR: 1, ...this.rates }, meta: this.meta, status: this.status };
  }
}
