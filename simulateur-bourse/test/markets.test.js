// Tests du calendrier des bourses (heures en Bruxelles, jours fériés, pauses, changements d'heure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketStatus, exchangeForSymbol, isTradableSymbol } from '../lib/markets.js';
import { holidaySet, easter } from '../lib/holidays.js';
import { normalizeYahooQuote } from '../lib/providers/yahoo.js';

test('Pâques et jours fériés calculés', () => {
  assert.equal(new Date(easter(2026)).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(new Date(easter(2027)).toISOString().slice(0, 10), '2027-03-28');
  const us = holidaySet('US', 2026);
  assert.ok(us.has('2026-07-03')); // 4 juillet un samedi → vendredi 3
  assert.ok(us.has('2026-11-26')); // Thanksgiving
  assert.ok(holidaySet('TARGET', 2026).has('2026-04-06')); // lundi de Pâques Euronext
  assert.ok(holidaySet('LSE', 2026).has('2026-12-28')); // Boxing Day reporté
  assert.ok(holidaySet('JPX', 2026).has('2026-09-22')); // jour citoyen japonais
});

test('ouverture / fermeture et horaires affichés en heure de Bruxelles', () => {
  const s = marketStatus('BR', Date.parse('2026-09-30T08:00:00Z'));
  assert.equal(s.open, true);
  assert.equal(s.hoursBrussels, '09:00–17:30');
  const ny = marketStatus('US', Date.parse('2026-09-30T12:00:00Z'));
  assert.equal(ny.open, false);
  assert.equal(ny.state, 'preopen');
  assert.equal(ny.hoursBrussels, '15:30–22:00');
  const sat = marketStatus('PA', Date.parse('2026-10-03T10:00:00Z'));
  assert.equal(sat.state, 'weekend');
  assert.match(sat.detail, /lundi à 09:00/);
  const gf = marketStatus('US', Date.parse('2026-04-03T15:00:00Z'));
  assert.equal(gf.state, 'holiday');
});

test('décalage des changements d’heure États-Unis / Europe', () => {
  // Les États-Unis passent à l'heure d'été le 8 mars 2026, l'Europe le 29 mars :
  // entre les deux, Wall Street ouvre à 14:30 heure de Bruxelles.
  const s = marketStatus('US', Date.parse('2026-03-16T13:45:00Z'));
  assert.equal(s.open, true);
  assert.equal(s.hoursBrussels, '14:30–21:00');
});

test('pause de midi à Tokyo et Hong Kong', () => {
  const t = marketStatus('T', Date.parse('2026-09-30T03:00:00Z')); // 12:00 à Tokyo
  assert.equal(t.state, 'break');
  const hk = marketStatus('HK', Date.parse('2026-09-30T02:00:00Z')); // 10:00 à Hong Kong
  assert.equal(hk.open, true);
});

test('bourse déduite du ticker', () => {
  assert.equal(exchangeForSymbol('ABI.BR').id, 'BR');
  assert.equal(exchangeForSymbol('MC.PA').id, 'PA');
  assert.equal(exchangeForSymbol('SAP.DE').id, 'DE');
  assert.equal(exchangeForSymbol('7203.T').id, 'T');
  assert.equal(exchangeForSymbol('BRK-B').id, 'US');
  assert.equal(isTradableSymbol('^GSPC'), false);
  assert.equal(isTradableSymbol('EURUSD=X'), false);
});

test('cotation Yahoo en pence convertie en livres', () => {
  const q = normalizeYahooQuote({ symbol: 'VOD.L', currency: 'GBp', regularMarketPrice: 72.5, regularMarketChange: 1.5, regularMarketChangePercent: 2.1, regularMarketTime: 1790000000, exchangeDataDelayedBy: 20, marketState: 'REGULAR' });
  assert.equal(q.currency, 'GBP');
  assert.equal(q.price, 0.725);
  assert.equal(q.change, 0.015);
  assert.equal(q.changePct, 2.1);
  assert.equal(q.delayMin, 20);
  assert.equal(q.time, 1790000000000);
});
