// Outils de dates et fuseaux horaires (sans dépendance, basés sur Intl).

const formatters = new Map();

function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Date « murale » d'un instant dans un fuseau : { y, m, d, hh, mm, ss, wd } */
export function zonedParts(ms, tz) {
  const p = {};
  for (const part of formatter(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour) % 24,
    mm: Number(p.minute),
    ss: Number(p.second),
    wd: WEEKDAYS[p.weekday],
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à cet instant. */
export function tzOffset(ms, tz) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convertit une heure murale (y, m, d, hh:mm) d'un fuseau en instant UTC (ms). */
export function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffset(guess, tz);
  let ms = guess - off1;
  const off2 = tzOffset(ms, tz);
  if (off2 !== off1) ms = guess - off2;
  return ms;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Date civile (sans heure) représentée par un timestamp UTC à minuit. */
export function civil(y, m, d) {
  return Date.UTC(y, m - 1, d);
}

export function civilKey(ms) {
  const dt = new Date(ms);
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(ms, n) {
  return ms + n * 86400000;
}

export function weekday(ms) {
  return new Date(ms).getUTCDay();
}

/** Convertit un horodatage Yahoo (Date, secondes, millisecondes ou texte) en ms. */
export function toMs(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v < 1e11 ? v * 1000 : v;
  const n = Date.parse(v);
  return Number.isNaN(n) ? null : n;
}

export const BRUSSELS_TZ = 'Europe/Brussels';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « 15:30 » en heure de Bruxelles */
export function brusselsHHMM(ms) {
  const p = zonedParts(ms, BRUSSELS_TZ);
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** « aujourd'hui à 15:30 », « demain à 09:00 », « lundi à 15:30 », « lundi 6/4 à 09:00 » (heure de Bruxelles). */
export function brusselsRelative(ms, now = Date.now()) {
  const a = zonedParts(now, BRUSSELS_TZ);
  const b = zonedParts(ms, BRUSSELS_TZ);
  const dayDiff = Math.round((civil(b.y, b.m, b.d) - civil(a.y, a.m, a.d)) / 86400000);
  const hhmm = `${pad2(b.hh)}:${pad2(b.mm)}`;
  if (dayDiff === 0) return `aujourd'hui à ${hhmm}`;
  if (dayDiff === 1) return `demain à ${hhmm}`;
  if (dayDiff > 1 && dayDiff < 7) return `${JOURS[b.wd]} à ${hhmm}`;
  return `${JOURS[b.wd]} ${b.d}/${b.m} à ${hhmm}`;
}
