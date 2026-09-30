// Jours fériés boursiers calculés par règles (Pâques, « 3e lundi de… », reports du week-end).
// Pour les bourses sans règle (Hong Kong, Chine, Inde…), le serveur détecte les jours
// fériés à la volée : si l'indice de référence n'a pas coté de la journée, la bourse est
// considérée comme fermée (voir markets.js).

import { civil, civilKey, addDays, weekday } from './time.js';

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher). */
export function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return civil(y, month, day);
}

/** n-ième jour de semaine `wd` (0 = dimanche) du mois ; n = -1 pour le dernier. */
function nthWeekday(y, m, wd, n) {
  if (n > 0) {
    const first = civil(y, m, 1);
    const shift = (wd - weekday(first) + 7) % 7;
    return addDays(first, shift + (n - 1) * 7);
  }
  const last = civil(y, m + 1, 0);
  const shift = (weekday(last) - wd + 7) % 7;
  return addDays(last, -shift);
}

/** Règle américaine : samedi → vendredi, dimanche → lundi. */
function observedUS(ms) {
  const wd = weekday(ms);
  if (wd === 6) return addDays(ms, -1);
  if (wd === 0) return addDays(ms, 1);
  return ms;
}

/** Règle britannique / canadienne : week-end → lundi suivant. */
function observedNextMonday(ms) {
  const wd = weekday(ms);
  if (wd === 6) return addDays(ms, 2);
  if (wd === 0) return addDays(ms, 1);
  return ms;
}

/** Noël + lendemain avec reports (Royaume-Uni, Canada). */
function christmasPair(y) {
  const xmas = civil(y, 12, 25);
  const wd = weekday(xmas);
  if (wd === 5) return [xmas, addDays(xmas, 3)]; // ven. + lun.
  if (wd === 6) return [addDays(xmas, 2), addDays(xmas, 3)]; // lun. + mar.
  if (wd === 0) return [addDays(xmas, 1), addDays(xmas, 2)]; // lun. + mar.
  return [xmas, addDays(xmas, 1)];
}

/** Veille de la Saint-Jean (Suède, Finlande) : le vendredi entre le 19 et le 25 juin. */
function midsummerEve(y) {
  const d19 = civil(y, 6, 19);
  return addDays(d19, (5 - weekday(d19) + 7) % 7);
}

const RULES = {
  // Euronext (Bruxelles, Paris, Amsterdam, Lisbonne, Dublin) et Madrid : calendrier TARGET
  TARGET(y) {
    const e = easter(y);
    return [civil(y, 1, 1), addDays(e, -2), addDays(e, 1), civil(y, 5, 1), civil(y, 12, 25), civil(y, 12, 26)];
  },
  XETRA(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), addDays(e, -2), addDays(e, 1), civil(y, 5, 1),
      civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  MILAN(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), addDays(e, -2), addDays(e, 1), civil(y, 5, 1), civil(y, 8, 15),
      civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  SIX(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), civil(y, 1, 2), addDays(e, -2), addDays(e, 1), addDays(e, 39), addDays(e, 50),
      civil(y, 5, 1), civil(y, 8, 1), civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  STOCKHOLM(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), civil(y, 1, 6), addDays(e, -2), addDays(e, 1), civil(y, 5, 1), addDays(e, 39),
      civil(y, 6, 6), midsummerEve(y), civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  COPENHAGEN(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), addDays(e, -3), addDays(e, -2), addDays(e, 1), addDays(e, 39), addDays(e, 40),
      addDays(e, 50), civil(y, 6, 5), civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  HELSINKI(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), civil(y, 1, 6), addDays(e, -2), addDays(e, 1), civil(y, 5, 1), addDays(e, 39),
      midsummerEve(y), civil(y, 12, 6), civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  OSLO(y) {
    const e = easter(y);
    return [
      civil(y, 1, 1), addDays(e, -3), addDays(e, -2), addDays(e, 1), civil(y, 5, 1), civil(y, 5, 17),
      addDays(e, 39), addDays(e, 50), civil(y, 12, 24), civil(y, 12, 25), civil(y, 12, 26), civil(y, 12, 31),
    ];
  },
  LSE(y) {
    const e = easter(y);
    return [
      observedNextMonday(civil(y, 1, 1)),
      addDays(e, -2),
      addDays(e, 1),
      nthWeekday(y, 5, 1, 1), // Early May bank holiday
      nthWeekday(y, 5, 1, -1), // Spring bank holiday
      nthWeekday(y, 8, 1, -1), // Summer bank holiday
      ...christmasPair(y),
    ];
  },
  US(y) {
    const e = easter(y);
    const list = [
      nthWeekday(y, 1, 1, 3), // Martin Luther King Jr. Day
      nthWeekday(y, 2, 1, 3), // Presidents' Day
      addDays(e, -2), // Good Friday
      nthWeekday(y, 5, 1, -1), // Memorial Day
      observedUS(civil(y, 6, 19)), // Juneteenth
      observedUS(civil(y, 7, 4)), // Independence Day
      nthWeekday(y, 9, 1, 1), // Labor Day
      nthWeekday(y, 11, 4, 4), // Thanksgiving
      observedUS(civil(y, 12, 25)),
    ];
    // Le NYSE ne reporte pas le 1er janvier tombant un samedi sur le 31 décembre.
    const ny = civil(y, 1, 1);
    if (weekday(ny) !== 6) list.push(observedUS(ny));
    return list;
  },
  TSX(y) {
    const e = easter(y);
    const may25 = civil(y, 5, 25);
    const victoria = addDays(may25, -(((weekday(may25) - 1 + 7) % 7) || 7)); // lundi précédant le 25 mai
    return [
      observedNextMonday(civil(y, 1, 1)),
      nthWeekday(y, 2, 1, 3), // Family Day
      addDays(e, -2),
      victoria,
      observedNextMonday(civil(y, 7, 1)), // Canada Day
      nthWeekday(y, 8, 1, 1), // Civic Holiday
      nthWeekday(y, 9, 1, 1), // Labour Day
      nthWeekday(y, 10, 1, 2), // Thanksgiving
      ...christmasPair(y),
    ];
  },
  JPX(y) {
    const k = y - 1980;
    const vernal = Math.floor(20.8431 + 0.242194 * k - Math.floor(k / 4));
    const autumn = Math.floor(23.2488 + 0.242194 * k - Math.floor(k / 4));
    const national = [
      civil(y, 1, 1), nthWeekday(y, 1, 1, 2), civil(y, 2, 11), civil(y, 2, 23), civil(y, 3, vernal),
      civil(y, 4, 29), civil(y, 5, 3), civil(y, 5, 4), civil(y, 5, 5), nthWeekday(y, 7, 1, 3),
      civil(y, 8, 11), nthWeekday(y, 9, 1, 3), civil(y, 9, autumn), nthWeekday(y, 10, 1, 2),
      civil(y, 11, 3), civil(y, 11, 23),
    ];
    const set = new Set(national.map(civilKey));
    // Jour férié tombant un dimanche → reporté au prochain jour non férié
    for (const h of national) {
      if (weekday(h) === 0) {
        let d = addDays(h, 1);
        while (set.has(civilKey(d))) d = addDays(d, 1);
        set.add(civilKey(d));
      }
    }
    // « Jour citoyen » : jour ouvré coincé entre deux jours fériés
    for (let d = civil(y, 1, 2); d < civil(y, 12, 31); d = addDays(d, 1)) {
      const key = civilKey(d);
      if (!set.has(key) && weekday(d) !== 0 && set.has(civilKey(addDays(d, -1))) && set.has(civilKey(addDays(d, 1)))) {
        set.add(key);
      }
    }
    // Fermetures propres à la bourse de Tokyo
    for (const d of [civil(y, 1, 2), civil(y, 1, 3), civil(y, 12, 31)]) set.add(civilKey(d));
    return [...set];
  },
};

const cache = new Map();

/** Ensemble des jours fériés (clés AAAA-MM-JJ) d'un calendrier pour une année. */
export function holidaySet(ruleId, y) {
  if (!ruleId || !RULES[ruleId]) return null;
  const key = `${ruleId}-${y}`;
  let set = cache.get(key);
  if (!set) {
    const days = RULES[ruleId](y).map((d) => (typeof d === 'string' ? d : civilKey(d)));
    set = new Set(days);
    cache.set(key, set);
  }
  return set;
}

export function isHoliday(ruleId, y, m, d) {
  const set = holidaySet(ruleId, y);
  return set ? set.has(civilKey(civil(y, m, d))) : false;
}
