// Reconstitue un portefeuille à partir d'achats passés (par exemple pour retrouver sur un
// deuxième ordinateur les positions prises sur le premier).
//
// Pour chaque achat, le script va chercher chez Yahoo Finance le vrai cours de l'action et
// le vrai taux de change au moment indiqué, calcule la quantité correspondant au montant
// investi, applique les mêmes frais que l'appli, puis écrit data/portefeuille.json.
//
// Utilisation (appli arrêtée) :
//   npm run reconstituer                 → achats ci-dessous
//   npm run reconstituer -- ONON=16 TSLA=1   → impose les quantités si tu les connais
//   npm run reconstituer -- AAPL:500 MC.PA:800 --date="2026-10-01 15:30"   → autres achats

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { JsonStore } from '../lib/storage.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../lib/settings.js';
import { Engine, defaultPortfolio } from '../lib/engine.js';
import { MarketData } from '../lib/marketdata.js';
import { exchangeForSymbol } from '../lib/markets.js';
import { zonedToUtc } from '../lib/time.js';

// Achats à reconstituer : date et heure de Bruxelles, montant total débité (frais compris)
export const ACHATS = {
  date: '2026-09-30 19:00',
  achats: [
    { symbol: 'ONON', montantEur: 700 },
    { symbol: 'TSLA', montantEur: 300 },
  ],
  valeurConnue: 5046, // valeur du compte affichée sur l'autre ordinateur (pour comparaison)
};

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const eur = (x) => `${x.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (x, d = 2) => x.toLocaleString('fr-BE', { minimumFractionDigits: d, maximumFractionDigits: d });
const round2 = (x) => Math.round(x * 100) / 100;

function parseBrussels(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2})[:h](\d{2})$/.exec(s);
  if (!m) throw new Error(`Date invalide : ${s} (format attendu : AAAA-MM-JJ HH:MM)`);
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], 'Europe/Brussels');
}

/** Cours au moment `at` : dernière bougie commencée avant `at` (5 min, sinon 1 h, sinon jour). */
async function priceAt(yahoo, symbol, at) {
  for (const interval of ['5m', '60m', '1d']) {
    const back = interval === '1d' ? 10 * 86400000 : 3 * 86400000;
    let res;
    try {
      res = await yahoo.chart(symbol, { period1: new Date(at - back), interval });
    } catch {
      continue;
    }
    const before = res.candles.filter((c) => c.time * 1000 <= at);
    const c = before.at(-1);
    if (c) {
      const divisor = /^(GBp|GBX|ZAc|ILA)$/.test(res.meta?.currency || '') ? 100 : 1;
      return { price: c.close / divisor, time: c.time * 1000, interval, currency: res.meta?.currency };
    }
  }
  throw new Error(`Impossible de trouver le cours de ${symbol} à cette date chez Yahoo Finance.`);
}

/**
 * Construit le portefeuille. `quantites` permet d'imposer une quantité par ticker.
 * Renvoie { portfolio, lignes, valeurActuelle }.
 */
export async function reconstituer({ md, settings, date, achats, quantites = {} }) {
  const at = parseBrussels(date);
  const feeCtx = { settings };
  const portfolio = defaultPortfolio(settings.initialCapital, []);
  portfolio.createdAt = at - 10 * 60000;
  portfolio.snapshots = [{ t: portfolio.createdAt, v: settings.initialCapital, c: settings.initialCapital }];

  const symbols = achats.map((a) => a.symbol);
  const now = await md.getQuotes(symbols, { maxAge: 0, track: false });
  const nowBySymbol = new Map(now.map((q) => [q.symbol, q]));
  const lignes = [];

  for (const a of achats) {
    const ex = exchangeForSymbol(a.symbol);
    const qNow = nowBySymbol.get(a.symbol);
    if (!ex || !qNow) throw new Error(`Ticker introuvable chez Yahoo Finance : ${a.symbol}`);
    const hist = await priceAt(md.yahoo, a.symbol, at);
    let fxRate = 1;
    if (qNow.currency !== 'EUR') {
      try {
        fxRate = (await priceAt(md.yahoo, `EUR${qNow.currency}=X`, at)).price;
      } catch {
        fxRate = qNow.fxRate; // taux historique introuvable : taux du jour (écart minime)
      }
      if (!fxRate) throw new Error(`Taux de change ${qNow.currency}/EUR introuvable.`);
    }

    // Même logique que l'appli : achat au prix vendeur simulé (cours + demi-fourchette)
    const fillPrice = hist.price * (1 + (settings.fees.spreadPct || 0) / 200);
    const pxEur = fillPrice / fxRate;
    let qty = quantites[a.symbol];
    if (!qty) {
      const zone = ex.feeZone === 'europe' ? settings.fees.europe : settings.fees.international;
      const pct = zone.pct / 100 + (qNow.currency !== 'EUR' ? settings.fees.fxPct / 100 : 0);
      const exact = (a.montantEur - zone.fixed) / (pxEur * (1 + pct));
      qty = settings.allowFractional ? Math.round(exact * 10000) / 10000 : Math.max(1, Math.round(exact));
    }
    const grossEur = qty * pxEur;
    const fees = Engine.prototype.computeFees.call(feeCtx, ex, grossEur, qNow.quoteType, qNow.currency);
    const total = round2(grossEur + fees.total);
    const profil = await md.profile(a.symbol, qNow.quoteType).catch(() => null);

    portfolio.cash = round2(portfolio.cash - total);
    portfolio.positions[a.symbol] = {
      symbol: a.symbol,
      name: qNow.name,
      exchangeId: ex.id,
      currency: qNow.currency,
      quoteType: qNow.quoteType || 'EQUITY',
      qty,
      avgPrice: fillPrice,
      costEur: total,
      openedAt: at,
      stopLoss: null,
      takeProfit: null,
      sector: profil?.sector || null,
      country: profil?.country || null,
      lastPrice: qNow.price,
      lastFx: qNow.fxRate,
    };
    portfolio.orders.push({
      id: crypto.randomUUID(),
      createdAt: at,
      symbol: a.symbol,
      name: qNow.name,
      exchangeId: ex.id,
      currency: qNow.currency,
      quoteType: qNow.quoteType || 'EQUITY',
      side: 'buy',
      type: 'market',
      qty,
      limitPrice: null,
      stopLoss: null,
      takeProfit: null,
      reason: `Achat reconstitué (pris sur mon autre ordinateur le ${date.replace(/[ T]/, ' à ')}).`,
      lesson: '',
      origin: 'user',
      status: 'filled',
      statusReason: null,
      reservedEur: 0,
      priceAtOrder: hist.price,
      cashFlowEur: -total,
      filledAt: at,
      fillPrice,
      fxRate,
      grossEur: round2(grossEur),
      fees,
      priceInfo: `Cours historique Yahoo (${hist.interval})`,
    });
    lignes.push({ symbol: a.symbol, name: qNow.name, qty, fillPrice, currency: qNow.currency, fxRate, total, fees: fees.total, priceNow: qNow.price, fxNow: qNow.fxRate, coursAt: hist.time, valueNow: (qty * qNow.price) / qNow.fxRate });
  }

  const valeurInvestie = portfolio.cash + lignes.reduce((s, l) => s + l.total - l.fees, 0);
  portfolio.snapshots.push({ t: at, v: round2(valeurInvestie), c: portfolio.cash });
  const valeurActuelle = portfolio.cash + lignes.reduce((s, l) => s + l.valueNow, 0);
  return { portfolio, lignes, valeurActuelle };
}

async function appliTourne(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/settings`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const dataDir = process.env.DATA_DIR || path.join(ROOT, 'data');
  const quantites = {};
  const achats = [];
  let date = ACHATS.date;
  for (const arg of argv) {
    let m = /^([A-Z0-9.^-]+)=(\d+(?:[.,]\d+)?)$/i.exec(arg);
    if (m) quantites[m[1].toUpperCase()] = Number(m[2].replace(',', '.'));
    m = /^([A-Z0-9.^-]+):(\d+(?:[.,]\d+)?)$/i.exec(arg);
    if (m) achats.push({ symbol: m[1].toUpperCase(), montantEur: Number(m[2].replace(',', '.')) });
    m = /^--date=(.+)$/.exec(arg);
    if (m) date = m[1].trim();
  }
  const custom = achats.length > 0;
  if (!custom) achats.push(...ACHATS.achats);

  for (const port of [Number(process.env.PORT) || 3000, 3001, 3002]) {
    if (await appliTourne(port)) {
      console.error(`\n❌  L'appli tourne encore (port ${port}). Arrête-la d'abord avec Ctrl+C dans son Terminal, puis relance « npm run reconstituer ».\n`);
      process.exit(1);
    }
  }

  const settingsStore = new JsonStore(path.join(dataDir, 'reglages.json'), DEFAULT_SETTINGS);
  const settings = mergeSettings(settingsStore.data, {});
  const cacheStore = new JsonStore(path.join(dataDir, 'cache.json'), { fx: null, profiles: {} });
  let fetchImpl = null;
  if (process.env.DEMO === '1') fetchImpl = (await import('../lib/providers/demoYahoo.js')).createDemoFetch();
  const md = new MarketData({ cacheStore, fetchImpl, demo: !!fetchImpl });

  console.log(`\n🔎  Recherche des cours du ${date.replace(/[ T]/, ' à ')} (heure de Bruxelles) chez Yahoo Finance…\n`);
  let result;
  try {
    result = await reconstituer({ md, settings, date, achats, quantites });
  } catch (err) {
    console.error(`❌  ${err.message}\n`);
    process.exit(1);
  }

  const file = path.join(dataDir, 'portefeuille.json');
  if (fs.existsSync(file)) {
    const dir = path.join(dataDir, 'archives');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.copyFileSync(file, path.join(dir, `portefeuille-avant-reconstitution-${stamp}.json`));
  }
  const store = new JsonStore(file, result.portfolio);
  store.data = result.portfolio;
  store.saveNow();
  settingsStore.data = settings;
  settingsStore.saveNow();
  cacheStore.saveNow();

  for (const l of result.lignes) {
    console.log(`  ✔ ${l.name} (${l.symbol}) : ${l.qty} action(s) à ${num(l.fillPrice)} ${l.currency} → ${eur(l.total)} débités (dont ${eur(l.fees)} de frais)`);
  }
  console.log(`\n  Liquidités restantes : ${eur(result.portfolio.cash)}`);
  console.log(`  Valeur du compte aux prix d'aujourd'hui : ${eur(result.valeurActuelle)}`);
  if (ACHATS.valeurConnue && !custom) console.log(`  (ton autre ordinateur affichait environ ${eur(ACHATS.valeurConnue)})`);
  console.log('\n  Si tu connais les quantités exactes, tu peux les imposer, par exemple :');
  console.log(`    npm run reconstituer -- ${custom ? `${achats.map((a) => `${a.symbol}:${a.montantEur}`).join(' ')} ` : ''}${result.lignes.map((l) => `${l.symbol}=${l.qty}`).join(' ')}`);
  console.log('\n✅  Portefeuille reconstitué. Lance maintenant l’appli avec « npm start ».\n');
  md.stop();
}
