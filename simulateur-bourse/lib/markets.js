// Bourses mondiales : suffixe de ticker Yahoo, devise, fuseau, horaires, jours fériés.

import { zonedParts, zonedToUtc, civil, addDays, weekday, dateKey, brusselsHHMM, brusselsRelative } from './time.js';
import { isHoliday } from './holidays.js';

const EU = 'europe';
const INTL = 'international';

// sessions = heures locales de la bourse (séance continue). Les pauses de midi (Tokyo, Hong Kong…)
// sont représentées par plusieurs sessions.
export const EXCHANGES = [
  { id: 'US', suffix: '', name: 'NYSE / Nasdaq', city: 'New York', country: 'États-Unis', cc: 'US', region: 'Amérique', currency: 'USD', tz: 'America/New_York', sessions: [['09:30', '16:00']], holidays: 'US', feeZone: INTL, index: '^GSPC' },
  { id: 'TO', suffix: '.TO', name: 'Bourse de Toronto (TSX)', city: 'Toronto', country: 'Canada', cc: 'CA', region: 'Amérique', currency: 'CAD', tz: 'America/Toronto', sessions: [['09:30', '16:00']], holidays: 'TSX', feeZone: INTL, index: '^GSPTSE' },
  { id: 'V', suffix: '.V', name: 'TSX Venture', city: 'Toronto', country: 'Canada', cc: 'CA', region: 'Amérique', currency: 'CAD', tz: 'America/Toronto', sessions: [['09:30', '16:00']], holidays: 'TSX', feeZone: INTL, index: '^GSPTSE' },
  { id: 'MX', suffix: '.MX', name: 'Bourse de Mexico', city: 'Mexico', country: 'Mexique', cc: 'MX', region: 'Amérique', currency: 'MXN', tz: 'America/Mexico_City', sessions: [['08:30', '15:00']], holidays: null, feeZone: INTL, index: '^MXX' },
  { id: 'SA', suffix: '.SA', name: 'B3 (São Paulo)', city: 'São Paulo', country: 'Brésil', cc: 'BR', region: 'Amérique', currency: 'BRL', tz: 'America/Sao_Paulo', sessions: [['10:00', '17:00']], holidays: null, feeZone: INTL, index: '^BVSP' },

  { id: 'BR', suffix: '.BR', name: 'Euronext Bruxelles', city: 'Bruxelles', country: 'Belgique', cc: 'BE', region: 'Europe', currency: 'EUR', tz: 'Europe/Brussels', sessions: [['09:00', '17:30']], holidays: 'TARGET', feeZone: EU, index: '^BFX' },
  { id: 'PA', suffix: '.PA', name: 'Euronext Paris', city: 'Paris', country: 'France', cc: 'FR', region: 'Europe', currency: 'EUR', tz: 'Europe/Paris', sessions: [['09:00', '17:30']], holidays: 'TARGET', feeZone: EU, index: '^FCHI' },
  { id: 'AS', suffix: '.AS', name: 'Euronext Amsterdam', city: 'Amsterdam', country: 'Pays-Bas', cc: 'NL', region: 'Europe', currency: 'EUR', tz: 'Europe/Amsterdam', sessions: [['09:00', '17:30']], holidays: 'TARGET', feeZone: EU, index: '^AEX' },
  { id: 'LS', suffix: '.LS', name: 'Euronext Lisbonne', city: 'Lisbonne', country: 'Portugal', cc: 'PT', region: 'Europe', currency: 'EUR', tz: 'Europe/Lisbon', sessions: [['08:00', '16:30']], holidays: 'TARGET', feeZone: EU, index: 'PSI20.LS' },
  { id: 'IR', suffix: '.IR', name: 'Euronext Dublin', city: 'Dublin', country: 'Irlande', cc: 'IE', region: 'Europe', currency: 'EUR', tz: 'Europe/Dublin', sessions: [['08:00', '16:30']], holidays: 'TARGET', feeZone: EU, index: '^ISEQ' },
  { id: 'MI', suffix: '.MI', name: 'Euronext Milan (Borsa Italiana)', city: 'Milan', country: 'Italie', cc: 'IT', region: 'Europe', currency: 'EUR', tz: 'Europe/Rome', sessions: [['09:00', '17:30']], holidays: 'MILAN', feeZone: EU, index: 'FTSEMIB.MI' },
  { id: 'OL', suffix: '.OL', name: 'Euronext Oslo Børs', city: 'Oslo', country: 'Norvège', cc: 'NO', region: 'Europe', currency: 'NOK', tz: 'Europe/Oslo', sessions: [['09:00', '16:20']], holidays: 'OSLO', feeZone: EU, index: 'OSEBX.OL' },
  { id: 'DE', suffix: '.DE', name: 'Xetra (Francfort)', city: 'Francfort', country: 'Allemagne', cc: 'DE', region: 'Europe', currency: 'EUR', tz: 'Europe/Berlin', sessions: [['09:00', '17:30']], holidays: 'XETRA', feeZone: EU, index: '^GDAXI' },
  { id: 'F', suffix: '.F', name: 'Börse Frankfurt', city: 'Francfort', country: 'Allemagne', cc: 'DE', region: 'Europe', currency: 'EUR', tz: 'Europe/Berlin', sessions: [['08:00', '22:00']], holidays: 'XETRA', feeZone: EU, index: '^GDAXI' },
  { id: 'SG', suffix: '.SG', name: 'Börse Stuttgart', city: 'Stuttgart', country: 'Allemagne', cc: 'DE', region: 'Europe', currency: 'EUR', tz: 'Europe/Berlin', sessions: [['08:00', '22:00']], holidays: 'XETRA', feeZone: EU, index: '^GDAXI' },
  { id: 'L', suffix: '.L', name: 'London Stock Exchange', city: 'Londres', country: 'Royaume-Uni', cc: 'GB', region: 'Europe', currency: 'GBP', tz: 'Europe/London', sessions: [['08:00', '16:30']], holidays: 'LSE', feeZone: EU, index: '^FTSE' },
  { id: 'IL', suffix: '.IL', name: 'LSE (carnet international)', city: 'Londres', country: 'Royaume-Uni', cc: 'GB', region: 'Europe', currency: 'USD', tz: 'Europe/London', sessions: [['08:00', '16:30']], holidays: 'LSE', feeZone: EU, index: '^FTSE' },
  { id: 'MC', suffix: '.MC', name: 'Bolsa de Madrid', city: 'Madrid', country: 'Espagne', cc: 'ES', region: 'Europe', currency: 'EUR', tz: 'Europe/Madrid', sessions: [['09:00', '17:30']], holidays: 'TARGET', feeZone: EU, index: '^IBEX' },
  { id: 'SW', suffix: '.SW', name: 'SIX Swiss Exchange', city: 'Zurich', country: 'Suisse', cc: 'CH', region: 'Europe', currency: 'CHF', tz: 'Europe/Zurich', sessions: [['09:00', '17:30']], holidays: 'SIX', feeZone: EU, index: '^SSMI' },
  { id: 'VI', suffix: '.VI', name: 'Wiener Börse', city: 'Vienne', country: 'Autriche', cc: 'AT', region: 'Europe', currency: 'EUR', tz: 'Europe/Vienna', sessions: [['09:00', '17:30']], holidays: 'TARGET', feeZone: EU, index: '^ATX' },
  { id: 'ST', suffix: '.ST', name: 'Nasdaq Stockholm', city: 'Stockholm', country: 'Suède', cc: 'SE', region: 'Europe', currency: 'SEK', tz: 'Europe/Stockholm', sessions: [['09:00', '17:30']], holidays: 'STOCKHOLM', feeZone: EU, index: '^OMX' },
  { id: 'CO', suffix: '.CO', name: 'Nasdaq Copenhague', city: 'Copenhague', country: 'Danemark', cc: 'DK', region: 'Europe', currency: 'DKK', tz: 'Europe/Copenhagen', sessions: [['09:00', '17:00']], holidays: 'COPENHAGEN', feeZone: EU, index: '^OMXC25' },
  { id: 'HE', suffix: '.HE', name: 'Nasdaq Helsinki', city: 'Helsinki', country: 'Finlande', cc: 'FI', region: 'Europe', currency: 'EUR', tz: 'Europe/Helsinki', sessions: [['10:00', '18:30']], holidays: 'HELSINKI', feeZone: EU, index: '^OMXH25' },
  { id: 'WA', suffix: '.WA', name: 'Bourse de Varsovie', city: 'Varsovie', country: 'Pologne', cc: 'PL', region: 'Europe', currency: 'PLN', tz: 'Europe/Warsaw', sessions: [['09:00', '17:00']], holidays: null, feeZone: EU, index: 'WIG20.WA' },

  { id: 'T', suffix: '.T', name: 'Bourse de Tokyo', city: 'Tokyo', country: 'Japon', cc: 'JP', region: 'Asie-Pacifique', currency: 'JPY', tz: 'Asia/Tokyo', sessions: [['09:00', '11:30'], ['12:30', '15:30']], holidays: 'JPX', feeZone: INTL, index: '^N225' },
  { id: 'HK', suffix: '.HK', name: 'Bourse de Hong Kong', city: 'Hong Kong', country: 'Hong Kong', cc: 'HK', region: 'Asie-Pacifique', currency: 'HKD', tz: 'Asia/Hong_Kong', sessions: [['09:30', '12:00'], ['13:00', '16:00']], holidays: null, feeZone: INTL, index: '^HSI' },
  { id: 'SS', suffix: '.SS', name: 'Bourse de Shanghai', city: 'Shanghai', country: 'Chine', cc: 'CN', region: 'Asie-Pacifique', currency: 'CNY', tz: 'Asia/Shanghai', sessions: [['09:30', '11:30'], ['13:00', '15:00']], holidays: null, feeZone: INTL, index: '000001.SS' },
  { id: 'SZ', suffix: '.SZ', name: 'Bourse de Shenzhen', city: 'Shenzhen', country: 'Chine', cc: 'CN', region: 'Asie-Pacifique', currency: 'CNY', tz: 'Asia/Shanghai', sessions: [['09:30', '11:30'], ['13:00', '15:00']], holidays: null, feeZone: INTL, index: '399001.SZ' },
  { id: 'TW', suffix: '.TW', name: 'Bourse de Taïwan', city: 'Taipei', country: 'Taïwan', cc: 'TW', region: 'Asie-Pacifique', currency: 'TWD', tz: 'Asia/Taipei', sessions: [['09:00', '13:30']], holidays: null, feeZone: INTL, index: '^TWII' },
  { id: 'KS', suffix: '.KS', name: 'Bourse de Corée (KOSPI)', city: 'Séoul', country: 'Corée du Sud', cc: 'KR', region: 'Asie-Pacifique', currency: 'KRW', tz: 'Asia/Seoul', sessions: [['09:00', '15:30']], holidays: null, feeZone: INTL, index: '^KS11' },
  { id: 'KQ', suffix: '.KQ', name: 'KOSDAQ', city: 'Séoul', country: 'Corée du Sud', cc: 'KR', region: 'Asie-Pacifique', currency: 'KRW', tz: 'Asia/Seoul', sessions: [['09:00', '15:30']], holidays: null, feeZone: INTL, index: '^KQ11' },
  { id: 'SI', suffix: '.SI', name: 'Bourse de Singapour (SGX)', city: 'Singapour', country: 'Singapour', cc: 'SG', region: 'Asie-Pacifique', currency: 'SGD', tz: 'Asia/Singapore', sessions: [['09:00', '12:00'], ['13:00', '17:00']], holidays: null, feeZone: INTL, index: '^STI' },
  { id: 'NS', suffix: '.NS', name: 'NSE (Inde)', city: 'Bombay', country: 'Inde', cc: 'IN', region: 'Asie-Pacifique', currency: 'INR', tz: 'Asia/Kolkata', sessions: [['09:15', '15:30']], holidays: null, feeZone: INTL, index: '^NSEI' },
  { id: 'BO', suffix: '.BO', name: 'BSE (Inde)', city: 'Bombay', country: 'Inde', cc: 'IN', region: 'Asie-Pacifique', currency: 'INR', tz: 'Asia/Kolkata', sessions: [['09:15', '15:30']], holidays: null, feeZone: INTL, index: '^BSESN' },
  { id: 'AX', suffix: '.AX', name: 'ASX (Australie)', city: 'Sydney', country: 'Australie', cc: 'AU', region: 'Asie-Pacifique', currency: 'AUD', tz: 'Australia/Sydney', sessions: [['10:00', '16:00']], holidays: null, feeZone: INTL, index: '^AXJO' },
  { id: 'NZ', suffix: '.NZ', name: 'NZX (Nouvelle-Zélande)', city: 'Wellington', country: 'Nouvelle-Zélande', cc: 'NZ', region: 'Asie-Pacifique', currency: 'NZD', tz: 'Pacific/Auckland', sessions: [['10:00', '16:45']], holidays: null, feeZone: INTL, index: '^NZ50' },
];

export const EXCHANGE_BY_ID = Object.fromEntries(EXCHANGES.map((e) => [e.id, e]));
const BY_SUFFIX = Object.fromEntries(EXCHANGES.filter((e) => e.suffix).map((e) => [e.suffix.slice(1), e]));

// Autres places allemandes régionales → mêmes caractéristiques que Stuttgart
for (const s of ['BE', 'MU', 'DU', 'HM', 'HA']) BY_SUFFIX[s] = EXCHANGE_BY_ID.SG;

/** Retrouve la bourse d'un ticker Yahoo (ABI.BR → Euronext Bruxelles, AAPL → US). */
export function exchangeForSymbol(symbol) {
  if (!symbol) return null;
  const m = /\.([A-Z]{1,3})$/.exec(symbol);
  if (m) return BY_SUFFIX[m[1]] || null;
  if (/^[A-Z][A-Z0-9-]{0,9}$/.test(symbol)) return EXCHANGE_BY_ID.US;
  return null;
}

export function isTradableSymbol(symbol) {
  return !!symbol && !symbol.startsWith('^') && !symbol.endsWith('=X') && !!exchangeForSymbol(symbol);
}

function hm(s) {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
}

/** Indices « jours fériés détectés » : exchangeId → date locale (AAAA-MM-JJ) jugée fermée. */
const holidayHints = new Map();

export function setHolidayHint(exId, localDateKey, closed) {
  if (closed) holidayHints.set(exId, localDateKey);
  else if (holidayHints.get(exId) === localDateKey) holidayHints.delete(exId);
}

function isTradingDay(ex, y, m, d, { withHints = true } = {}) {
  const wd = weekday(civil(y, m, d));
  if (wd === 0 || wd === 6) return false;
  if (isHoliday(ex.holidays, y, m, d)) return false;
  if (withHints && holidayHints.get(ex.id) === dateKey(y, m, d)) return false;
  return true;
}

function sessionsFor(ex, y, m, d) {
  return ex.sessions.map(([a, b]) => {
    const s = hm(a);
    const e = hm(b);
    return [zonedToUtc(y, m, d, s.h, s.m, ex.tz), zonedToUtc(y, m, d, e.h, e.m, ex.tz)];
  });
}

function nextTradingDay(ex, y, m, d) {
  let day = civil(y, m, d);
  for (let i = 0; i < 15; i++) {
    day = addDays(day, 1);
    const dt = new Date(day);
    const yy = dt.getUTCFullYear();
    const mm = dt.getUTCMonth() + 1;
    const dd = dt.getUTCDate();
    if (isTradingDay(ex, yy, mm, dd, { withHints: false })) return { y: yy, m: mm, d: dd };
  }
  return null;
}

/**
 * État d'une bourse à l'instant `now`.
 * @returns {{ open, state, label, detail, opensAt, closesAt, sessionOpenAt, hoursBrussels, localDate }}
 */
export function marketStatus(exOrId, now = Date.now()) {
  const ex = typeof exOrId === 'string' ? EXCHANGE_BY_ID[exOrId] : exOrId;
  if (!ex) return { open: false, state: 'unknown', label: 'Inconnue', detail: '' };
  const p = zonedParts(now, ex.tz);
  const localDate = dateKey(p.y, p.m, p.d);
  const tradingToday = isTradingDay(ex, p.y, p.m, p.d);
  const today = sessionsFor(ex, p.y, p.m, p.d);
  const hoursOf = (sessions) => sessions.map(([a, b]) => `${brusselsHHMM(a)}–${brusselsHHMM(b)}`).join(' · ');

  const nextOpen = () => {
    const n = nextTradingDay(ex, p.y, p.m, p.d);
    return n ? sessionsFor(ex, n.y, n.m, n.d)[0][0] : null;
  };

  let res;
  if (!tradingToday) {
    const wd = p.wd;
    const reason = wd === 0 || wd === 6 ? 'week-end' : 'jour férié';
    const opensAt = nextOpen();
    res = {
      open: false,
      state: reason === 'week-end' ? 'weekend' : 'holiday',
      label: 'Fermée',
      detail: `Fermée (${reason})${opensAt ? ` · ouvre ${brusselsRelative(opensAt, now)}` : ''}`,
      opensAt,
      closesAt: null,
      sessionOpenAt: null,
    };
  } else {
    const first = today[0][0];
    const last = today[today.length - 1][1];
    const current = today.find(([a, b]) => now >= a && now < b);
    if (current) {
      res = {
        open: true,
        state: 'open',
        label: 'Ouverte',
        detail: `Ouverte · ferme ${brusselsRelative(current[1], now)}`,
        opensAt: null,
        closesAt: current[1],
        sessionOpenAt: first,
      };
    } else if (now < first) {
      res = {
        open: false,
        state: 'preopen',
        label: 'Fermée',
        detail: `Fermée · ouvre ${brusselsRelative(first, now)}`,
        opensAt: first,
        closesAt: null,
        sessionOpenAt: first,
      };
    } else if (now >= last) {
      const opensAt = nextOpen();
      res = {
        open: false,
        state: 'closed',
        label: 'Fermée',
        detail: `Fermée · ouvre ${opensAt ? brusselsRelative(opensAt, now) : '—'}`,
        opensAt,
        closesAt: null,
        sessionOpenAt: first,
      };
    } else {
      const next = today.find(([a]) => a > now);
      res = {
        open: false,
        state: 'break',
        label: 'Pause',
        detail: `Pause de midi · reprise ${brusselsRelative(next[0], now)}`,
        opensAt: next[0],
        closesAt: null,
        sessionOpenAt: first,
      };
    }
  }
  // Horaires affichés en heure de Bruxelles (ceux du jour, sinon du prochain jour de cotation)
  let ref = today;
  if (!tradingToday) {
    const n = nextTradingDay(ex, p.y, p.m, p.d);
    if (n) ref = sessionsFor(ex, n.y, n.m, n.d);
  }
  res.hoursBrussels = hoursOf(ref);
  res.localDate = localDate;
  res.localTime = `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
  return res;
}

/** Version légère : la bourse est-elle en séance à cet instant ? */
export function isOpenAt(ex, ms) {
  const p = zonedParts(ms, ex.tz);
  if (!isTradingDay(ex, p.y, p.m, p.d, { withHints: false })) return false;
  const minutes = p.hh * 60 + p.mm;
  return ex.sessions.some(([a, b]) => {
    const s = hm(a);
    const e = hm(b);
    return minutes >= s.h * 60 + s.m && minutes < e.h * 60 + e.m;
  });
}

/** Vrai si la journée locale est un jour ouvré selon le calendrier (sans les indices dynamiques). */
export function calendarSaysOpenToday(ex, now = Date.now()) {
  const p = zonedParts(now, ex.tz);
  return isTradingDay(ex, p.y, p.m, p.d, { withHints: false });
}

export function localDateKey(ex, ms) {
  const p = zonedParts(ms, ex.tz);
  return dateKey(p.y, p.m, p.d);
}

export function firstSessionStart(ex, now = Date.now()) {
  const p = zonedParts(now, ex.tz);
  return sessionsFor(ex, p.y, p.m, p.d)[0][0];
}

export function allMarketStatuses(now = Date.now()) {
  return EXCHANGES.map((ex) => ({
    id: ex.id,
    name: ex.name,
    city: ex.city,
    country: ex.country,
    cc: ex.cc,
    region: ex.region,
    currency: ex.currency,
    suffix: ex.suffix,
    tz: ex.tz,
    ...marketStatus(ex, now),
  }));
}

export function publicExchangeInfo(ex) {
  if (!ex) return null;
  const { id, suffix, name, city, country, cc, region, currency, tz, feeZone } = ex;
  return { id, suffix, name, city, country, cc, region, currency, tz, feeZone };
}
