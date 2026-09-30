// Réglages par défaut et validation des réglages envoyés par la page.

export const DEFAULT_SETTINGS = {
  finnhubKey: '',
  twelveDataKey: '',
  initialCapital: 5000,
  refreshSeconds: 15,
  allowFractional: false,
  benchmark: 'IWDA.AS',
  theme: 'dark',
  fees: {
    europe: { fixed: 1, pct: 0.1 },
    international: { fixed: 2, pct: 0.15 },
    fxPct: 0.25,
    spreadPct: 0.05,
    tob: { enabled: false, stockPct: 0.35, stockCap: 1600, etfPct: 0.12, etfCap: 1300 },
  },
};

function num(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function key(v, fallback) {
  if (v === undefined) return fallback;
  const s = String(v).trim();
  if (s.length > 100 || /\s/.test(s)) return fallback;
  return s;
}

/** Fusionne des réglages partiels (depuis la page) avec les réglages actuels, en bornant les valeurs. */
export function mergeSettings(current, patch = {}) {
  const c = structuredClone({ ...DEFAULT_SETTINGS, ...current, fees: { ...DEFAULT_SETTINGS.fees, ...(current?.fees || {}) } });
  const f = patch.fees || {};
  const out = {
    ...c,
    finnhubKey: key(patch.finnhubKey, c.finnhubKey),
    twelveDataKey: key(patch.twelveDataKey, c.twelveDataKey),
    initialCapital: num(patch.initialCapital ?? c.initialCapital, 100, 10_000_000, 5000),
    refreshSeconds: num(patch.refreshSeconds ?? c.refreshSeconds, 5, 300, 15),
    allowFractional: patch.allowFractional !== undefined ? !!patch.allowFractional : !!c.allowFractional,
    benchmark: patch.benchmark !== undefined ? String(patch.benchmark).trim().toUpperCase().slice(0, 20) || 'IWDA.AS' : c.benchmark,
    theme: ['dark', 'light', 'auto'].includes(patch.theme) ? patch.theme : c.theme,
    fees: {
      europe: {
        fixed: num(f.europe?.fixed ?? c.fees.europe.fixed, 0, 100, 1),
        pct: num(f.europe?.pct ?? c.fees.europe.pct, 0, 5, 0.1),
      },
      international: {
        fixed: num(f.international?.fixed ?? c.fees.international.fixed, 0, 100, 2),
        pct: num(f.international?.pct ?? c.fees.international.pct, 0, 5, 0.15),
      },
      fxPct: num(f.fxPct ?? c.fees.fxPct, 0, 5, 0.25),
      spreadPct: num(f.spreadPct ?? c.fees.spreadPct, 0, 5, 0.05),
      tob: {
        enabled: f.tob?.enabled !== undefined ? !!f.tob.enabled : !!c.fees.tob?.enabled,
        stockPct: num(f.tob?.stockPct ?? c.fees.tob?.stockPct, 0, 5, 0.35),
        stockCap: num(f.tob?.stockCap ?? c.fees.tob?.stockCap, 0, 100000, 1600),
        etfPct: num(f.tob?.etfPct ?? c.fees.tob?.etfPct, 0, 5, 0.12),
        etfCap: num(f.tob?.etfCap ?? c.fees.tob?.etfCap, 0, 100000, 1300),
      },
    },
  };
  return out;
}

function mask(k) {
  if (!k) return '';
  return k.length <= 4 ? '••••' : `••••••${k.slice(-4)}`;
}

/** Version envoyée à la page : les clés ne quittent jamais le serveur en clair. */
export function publicSettings(s) {
  const { finnhubKey, twelveDataKey, ...rest } = s;
  return { ...rest, finnhubKey: mask(finnhubKey), twelveDataKey: mask(twelveDataKey), hasFinnhubKey: !!finnhubKey, hasTwelveDataKey: !!twelveDataKey };
}
