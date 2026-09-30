// Serveur local du simulateur : sert la page web, interroge les sources de données
// (les clés API restent ici, jamais dans la page) et exécute les ordres fictifs.

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { JsonStore } from './lib/storage.js';
import { DEFAULT_SETTINGS, mergeSettings, publicSettings } from './lib/settings.js';
import { MarketData } from './lib/marketdata.js';
import { Engine, defaultPortfolio } from './lib/engine.js';
import { allMarketStatuses, EXCHANGES } from './lib/markets.js';
import { INDICES, INDEX_ETFS } from './lib/catalog.js';
import { AppError } from './lib/errors.js';
import { createDemoFetch } from './lib/providers/demoYahoo.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEMO = process.argv.includes('--demo') || process.env.DEMO === '1';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data', DEMO ? 'demo' : '');
const LAN = process.argv.includes('--reseau');
const HOST = process.env.HOST || (LAN ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(ROOT, 'public');
const CHARTS_LIB = path.join(ROOT, 'node_modules', 'lightweight-charts', 'dist', 'lightweight-charts.standalone.production.mjs');

// ---------- État ----------

const settingsStore = new JsonStore(path.join(DATA_DIR, 'reglages.json'), DEFAULT_SETTINGS);
settingsStore.data = mergeSettings(settingsStore.data, {});
settingsStore.saveNow();

const firstRun = !fs.existsSync(path.join(DATA_DIR, 'portefeuille.json'));
const portfolioStore = new JsonStore(path.join(DATA_DIR, 'portefeuille.json'), defaultPortfolio(settingsStore.data.initialCapital));
if (firstRun) portfolioStore.saveNow();
const cacheStore = new JsonStore(path.join(DATA_DIR, 'cache.json'), { fx: null, profiles: {} });

const md = new MarketData({ cacheStore, fetchImpl: DEMO ? createDemoFetch() : null, demo: DEMO });
md.applySettings(settingsStore.data);
const engine = new Engine({ md, store: portfolioStore, settingsStore });

// ---------- Flux temps réel vers la page (Server-Sent Events) ----------

const clients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function portfolioPayload() {
  const p = engine.p;
  return {
    valuation: engine.valuation(),
    orders: p.orders.slice(-1000),
    watchlist: p.watchlist,
  };
}

let valuationTimer = null;
function scheduleValuation() {
  if (valuationTimer) return;
  valuationTimer = setTimeout(() => {
    valuationTimer = null;
    broadcast('valuation', engine.valuation());
  }, 1000);
}

md.on('quotes', (quotes) => broadcast('quotes', quotes));
md.on('sources', (s) => broadcast('sources', s));
engine.on('changed', () => broadcast('portfolio', portfolioPayload()));
engine.on('valuation', scheduleValuation);
engine.on('notify', (n) => broadcast('notify', { ...n, at: Date.now() }));
setInterval(() => {
  md.invalidateStatuses();
  broadcast('markets', allMarketStatuses());
}, 60000);
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

// ---------- Utilitaires HTTP ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function sendError(res, err) {
  if (err instanceof AppError) return sendJson(res, err.status || 400, { error: err.message, code: err.code });
  console.error(err);
  return sendJson(res, 500, { error: `Erreur interne du simulateur : ${err.message}`, code: 'INTERNAL' });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1e6) throw new AppError('BAD_REQUEST', 'Requête trop volumineuse.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('BAD_REQUEST', 'Requête illisible (JSON invalide).');
  }
}

// Protection : seule la page locale peut piloter l'appli (anti « DNS rebinding » et anti formulaires tiers)
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
function hostAllowed(req) {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') return true; // accès réseau local choisi explicitement
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  return LOCAL_HOSTS.has(host);
}

function serveStatic(req, res, pathname) {
  if (pathname === '/vendor/lightweight-charts.mjs') {
    return fs.readFile(CHARTS_LIB, (err, buf) => {
      if (err) return send(res, 404, 'Bibliothèque de graphiques introuvable : lance « npm install ».', { 'Content-Type': 'text/plain; charset=utf-8' });
      send(res, 200, buf, { 'Content-Type': MIME['.mjs'], 'Cache-Control': 'public, max-age=86400' });
    });
  }
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, decodeURIComponent(rel)));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Interdit');
  fs.readFile(file, (err, buf) => {
    if (err) {
      // Application monopage : on renvoie index.html pour les chemins inconnus sans extension
      if (!path.extname(rel)) return serveStatic(req, res, '/');
      return send(res, 404, 'Introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

function archivePortfolio(p) {
  const dir = path.join(DATA_DIR, 'archives');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(dir, `portefeuille-${stamp}.json`), JSON.stringify(p, null, 2));
}

// ---------- Routes de l'API ----------

async function handleApi(req, res, url) {
  const method = req.method;
  const p = url.pathname;
  const q = url.searchParams;

  if (method !== 'GET' && req.headers['x-simulateur'] !== '1') {
    throw new AppError('BAD_REQUEST', 'Requête refusée (origine inconnue).', { status: 403 });
  }

  if (method === 'GET' && p === '/api/stream') {
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    const quotes = md.trackedSymbols().map((s) => md.getQuote(s)).filter(Boolean);
    res.write(`event: quotes\ndata: ${JSON.stringify(quotes)}\n\n`);
    return;
  }

  if (method === 'GET' && p === '/api/bootstrap') {
    return sendJson(res, 200, {
      demo: DEMO,
      settings: publicSettings(settingsStore.data),
      portfolio: portfolioPayload(),
      markets: allMarketStatuses(),
      exchanges: EXCHANGES.map(({ id, name, city, country, cc, region, currency, suffix }) => ({ id, name, city, country, cc, region, currency, suffix })),
      indices: INDICES,
      indexEtfs: Object.fromEntries(Object.entries(INDEX_ETFS).map(([k, v]) => [k, { title: v.title, note: v.note }])),
      sources: md.sourceStatus(),
      fx: md.fx.snapshot(),
      quotes: md.trackedSymbols().map((s) => md.getQuote(s)).filter(Boolean),
    });
  }

  if (method === 'GET' && p === '/api/portfolio') return sendJson(res, 200, portfolioPayload());

  if (method === 'GET' && p === '/api/quotes') {
    const symbols = (q.get('symbols') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 60);
    const quotes = await md.getQuotes(symbols, { maxAge: 15000 });
    const missing = symbols.filter((s) => !quotes.some((x) => x.symbol === s));
    return sendJson(res, 200, { quotes, missing, sources: md.sourceStatus() });
  }

  if (method === 'POST' && p === '/api/focus') {
    const body = await readBody(req);
    const symbols = (Array.isArray(body.symbols) ? body.symbols : []).map((s) => String(s).toUpperCase()).slice(0, 60);
    md.touchFocus(symbols);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && p === '/api/search') {
    const result = await md.search(q.get('q') || '', { exchangeId: q.get('exchange') || '', region: q.get('region') || '' });
    return sendJson(res, 200, result);
  }

  if (method === 'GET' && p === '/api/history') {
    const symbol = (q.get('symbol') || '').toUpperCase();
    if (!symbol) throw new AppError('BAD_REQUEST', 'Ticker manquant.');
    return sendJson(res, 200, await md.history(symbol, q.get('range') || '1m'));
  }

  if (method === 'GET' && p === '/api/profile') {
    const symbol = (q.get('symbol') || '').toUpperCase();
    return sendJson(res, 200, await md.profile(symbol));
  }

  if (method === 'GET' && p === '/api/markets') return sendJson(res, 200, allMarketStatuses());

  if (method === 'GET' && p === '/api/etfs') {
    const group = INDEX_ETFS[q.get('key')];
    if (!group) throw new AppError('NOT_FOUND', 'Indice inconnu.', { status: 404 });
    const quotes = await md.getQuotes(group.etfs.map((e) => e.symbol), { maxAge: 30000 });
    const bySym = new Map(quotes.map((x) => [x.symbol, x]));
    const etfs = group.etfs.filter((e) => bySym.has(e.symbol)).map((e) => ({ ...e, quote: bySym.get(e.symbol) }));
    return sendJson(res, 200, { title: group.title, note: group.note, etfs, unavailable: group.etfs.length - etfs.length });
  }

  if (method === 'GET' && p === '/api/stats') return sendJson(res, 200, await engine.stats());
  if (method === 'GET' && p === '/api/portfolio/history') return sendJson(res, 200, await engine.history());

  if (method === 'POST' && p === '/api/orders/preview') return sendJson(res, 200, await engine.preview(await readBody(req)));
  if (method === 'POST' && p === '/api/orders') return sendJson(res, 200, await engine.placeOrder(await readBody(req)));

  let m = /^\/api\/orders\/([\w-]+)\/cancel$/.exec(p);
  if (method === 'POST' && m) return sendJson(res, 200, engine.cancelOrder(m[1]));

  m = /^\/api\/positions\/([^/]+)\/protection$/.exec(p);
  if (method === 'POST' && m) return sendJson(res, 200, engine.setProtection(decodeURIComponent(m[1]), await readBody(req)));

  if (method === 'POST' && p === '/api/watchlist') return sendJson(res, 200, { watchlist: await engine.addWatch((await readBody(req)).symbol) });
  m = /^\/api\/watchlist\/([^/]+)$/.exec(p);
  if (method === 'DELETE' && m) return sendJson(res, 200, { watchlist: engine.removeWatch(decodeURIComponent(m[1])) });

  m = /^\/api\/journal\/([\w-]+)$/.exec(p);
  if (method === 'PATCH' && m) return sendJson(res, 200, engine.updateJournal(m[1], await readBody(req)));

  if (method === 'GET' && p === '/api/settings') return sendJson(res, 200, publicSettings(settingsStore.data));

  if (method === 'PUT' && p === '/api/settings') {
    const patch = await readBody(req);
    for (const k of ['finnhubKey', 'twelveDataKey']) {
      if (typeof patch[k] === 'string' && patch[k].includes('•')) delete patch[k];
    }
    const before = settingsStore.data;
    const next = mergeSettings(before, patch);
    settingsStore.data = next;
    settingsStore.saveNow();
    if (next.benchmark !== before.benchmark) engine.p.benchmark = null;
    md.applySettings(next);
    broadcast('settings', publicSettings(next));
    engine.emit('changed');
    return sendJson(res, 200, publicSettings(next));
  }

  if (method === 'POST' && p === '/api/settings/test') {
    const body = await readBody(req);
    if (DEMO) throw new AppError('BAD_REQUEST', 'Mode démo : le test des clés est désactivé (lance « npm start »).');
    const typed = typeof body.key === 'string' && body.key && !body.key.includes('•') ? body.key.trim() : null;
    if (body.provider === 'finnhub') {
      const key = typed || settingsStore.data.finnhubKey;
      if (!key) throw new AppError('NO_KEY', 'Saisis d’abord une clé Finnhub.');
      await md.finnhub.testKey(key);
      return sendJson(res, 200, { ok: true, message: 'Clé Finnhub valide ✔ (temps réel US activé une fois enregistrée).' });
    }
    if (body.provider === 'twelvedata') {
      const key = typed || settingsStore.data.twelveDataKey;
      if (!key) throw new AppError('NO_KEY', 'Saisis d’abord une clé Twelve Data.');
      await md.twelve.testKey(key);
      return sendJson(res, 200, { ok: true, message: 'Clé Twelve Data valide ✔' });
    }
    throw new AppError('BAD_REQUEST', 'Fournisseur inconnu.');
  }

  if (method === 'POST' && p === '/api/reset') {
    const body = await readBody(req);
    if (body.confirm !== true) throw new AppError('BAD_REQUEST', 'Confirmation manquante.');
    engine.reset(archivePortfolio);
    return sendJson(res, 200, portfolioPayload());
  }

  throw new AppError('NOT_FOUND', 'Route inconnue.', { status: 404 });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!hostAllowed(req)) return send(res, 403, 'Accès refusé : ouvre l’appli via http://localhost', { 'Content-Type': 'text/plain; charset=utf-8' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée');
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    if (!res.headersSent) sendError(res, err);
    else res.end();
  }
});

// ---------- Démarrage ----------

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* pas de navigateur : l'adresse est affichée dans le terminal */
  }
}

let started = false;

function listen(port, attemptsLeft = 10) {
  const onError = (err) => {
    server.off('listening', onListening);
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`Le port ${port} est occupé, essai du port ${port + 1}…`);
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(`Impossible de démarrer le serveur : ${err.message}`);
      process.exit(1);
    }
  };
  const onListening = () => {
    server.off('error', onError);
    if (started) return;
    started = true;
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  📈  Simulateur de bourse prêt' + (DEMO ? ' — MODE DÉMO (prix simulés)' : ''));
    console.log(`  👉  Ouvre ${url} dans ton navigateur`);
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
      const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
      console.log(`  📱  Sur ton téléphone (même Wi-Fi) : ${ips.map((ip) => `http://${ip}:${port}`).join('  ou  ') || `port ${port}`}`);
      console.log('      ⚠️  Toute personne connectée à ce réseau peut ouvrir l’appli : à n’utiliser que chez toi.');
    }
    console.log(`  💾  Données enregistrées dans ${DATA_DIR}`);
    console.log('  ⏹   Ctrl+C pour arrêter');
    console.log('');
    if (process.env.SIM_OPEN_BROWSER === '1') openBrowser(url);
    md.start();
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

function shutdown() {
  console.log('\nArrêt du simulateur, sauvegarde…');
  try {
    portfolioStore.flush();
    settingsStore.flush();
    cacheStore.flush();
  } catch (err) {
    console.error(err.message);
  }
  md.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

listen(PORT);
