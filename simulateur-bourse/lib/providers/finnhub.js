// Finnhub (clé gratuite) : flux WebSocket temps réel des transactions sur les actions américaines.
// Offre gratuite : 60 appels REST/minute, 50 symboles en WebSocket, actions US uniquement.

import { EventEmitter } from 'node:events';
import { AppError, explainError, withTimeout } from '../errors.js';

const REST = 'https://finnhub.io/api/v1';
const WS_URL = 'wss://ws.finnhub.io';
export const FINNHUB_WS_LIMIT = 50;

// Yahoo écrit BRK-B, Finnhub BRK.B
const toFinnhub = (s) => s.replace(/-/g, '.');

export class FinnhubProvider extends EventEmitter {
  constructor() {
    super();
    this.key = '';
    this.ws = null;
    this.subscribed = new Set();
    this.wanted = new Set();
    this.fromFinnhub = new Map();
    this.status = { state: 'no-key', message: 'Aucune clé : le temps réel US passe par Yahoo (actualisé toutes les quelques secondes).' };
    this.retryDelay = 5000;
    this.retryTimer = null;
    this.restCalls = [];
    this.disabled = false;
  }

  setStatus(state, message) {
    this.status = { state, message, at: Date.now() };
    this.emit('status', this.status);
  }

  async setKey(key) {
    key = (key || '').trim();
    if (key === this.key && this.status.state !== 'invalid-key') return;
    this.key = key;
    this.disconnect();
    if (!key) {
      this.setStatus('no-key', 'Aucune clé : le temps réel US passe par Yahoo (actualisé toutes les quelques secondes).');
      return;
    }
    if (this.disabled) return;
    try {
      await this.testKey(key);
      this.connect();
    } catch (err) {
      if (err.code === 'INVALID_KEY') this.setStatus('invalid-key', err.message);
      else {
        this.setStatus('error', err.message);
        this.scheduleReconnect();
      }
    }
  }

  async rest(path, params = {}, key = this.key) {
    if (!key) throw new AppError('NO_KEY', 'Aucune clé Finnhub configurée.', { source: 'finnhub' });
    // Limiteur local : 55 appels par minute maximum
    const now = Date.now();
    this.restCalls = this.restCalls.filter((t) => now - t < 60000);
    if (this.restCalls.length >= 55) {
      throw new AppError('RATE_LIMIT', "Limite d'appels Finnhub atteinte (60/min en gratuit). Nouvelle tentative dans une minute.", { source: 'finnhub', status: 429 });
    }
    this.restCalls.push(now);
    const url = new URL(REST + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('token', key);
    let res;
    try {
      res = await withTimeout(fetch(url), 10000, 'Finnhub');
    } catch (err) {
      throw explainError(err, 'finnhub');
    }
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* réponse non JSON */
    }
    if (!res.ok) {
      const e = new Error((body && body.error) || text || res.statusText);
      e.status = res.status;
      throw explainError(e, 'finnhub', params.symbol);
    }
    return body;
  }

  async testKey(key = this.key) {
    const body = await this.rest('/quote', { symbol: 'AAPL' }, key);
    if (!body || typeof body.c !== 'number') throw new AppError('UNAVAILABLE', 'Réponse inattendue de Finnhub.', { source: 'finnhub' });
    return true;
  }

  /** Cotation REST (secours pour les actions US). */
  async quote(symbol) {
    const b = await this.rest('/quote', { symbol: toFinnhub(symbol) });
    if (!b || !b.t || !b.c) throw new AppError('NOT_FOUND', `Ticker introuvable chez Finnhub : ${symbol}`, { source: 'finnhub', status: 404 });
    return {
      symbol,
      price: b.c,
      change: b.d,
      changePct: b.dp,
      prevClose: b.pc,
      open: b.o,
      dayHigh: b.h,
      dayLow: b.l,
      time: b.t * 1000,
      delayMin: 0,
      source: 'finnhub',
    };
  }

  async search(q) {
    const b = await this.rest('/search', { q });
    return (b?.result || []).map((r) => ({ symbol: r.symbol.replace(/\./g, '-'), name: r.description, type: r.type }));
  }

  // ---------- WebSocket ----------

  connect() {
    if (!this.key || this.ws || this.disabled) return;
    if (typeof WebSocket === 'undefined') {
      this.setStatus('error', 'Ta version de Node.js ne gère pas les WebSocket : installe Node.js 22.4 ou plus récent.');
      return;
    }
    this.setStatus('connecting', 'Connexion au flux temps réel Finnhub…');
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.key)}`);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.retryDelay = 5000;
      this.subscribed.clear();
      this.setStatus('connected', 'Flux temps réel Finnhub connecté (actions US).');
      this.syncSubscriptions();
    });
    ws.addEventListener('message', (ev) => this.onMessage(ev.data));
    ws.addEventListener('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.subscribed.clear();
      if (this.key && this.status.state !== 'invalid-key') {
        this.setStatus('error', 'Flux Finnhub déconnecté, reconnexion automatique…');
        this.scheduleReconnect();
      }
    });
    ws.addEventListener('error', () => {
      /* l'événement « close » suit toujours */
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.ws && this.key) this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 120000);
  }

  disconnect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.subscribed.clear();
    if (ws) {
      try {
        ws.close();
      } catch {
        /* rien */
      }
    }
  }

  onMessage(data) {
    let msg;
    try {
      msg = JSON.parse(typeof data === 'string' ? data : data.toString());
    } catch {
      return;
    }
    if (msg.type === 'trade' && Array.isArray(msg.data)) {
      // On ne garde que la dernière transaction de chaque symbole
      const last = new Map();
      for (const t of msg.data) last.set(t.s, t);
      for (const t of last.values()) {
        const symbol = this.fromFinnhub.get(t.s) || t.s.replace(/\./g, '-');
        this.emit('trade', { symbol, price: t.p, time: t.t, volume: t.v });
      }
    } else if (msg.type === 'error') {
      const text = String(msg.msg || '');
      if (/limit|subscribe/i.test(text)) this.setStatus('error', `Finnhub : ${text} (50 symboles max. en gratuit).`);
      else this.setStatus('error', `Finnhub : ${text}`);
    }
  }

  /** Symboles US à suivre en temps réel (priorité dans l'ordre donné, 50 max). */
  setSubscriptions(symbols) {
    this.wanted = new Set(symbols.slice(0, FINNHUB_WS_LIMIT));
    this.syncSubscriptions();
  }

  syncSubscriptions() {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    for (const s of this.subscribed) {
      if (!this.wanted.has(s)) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbol: toFinnhub(s) }));
        this.subscribed.delete(s);
      }
    }
    for (const s of this.wanted) {
      if (!this.subscribed.has(s)) {
        const fs = toFinnhub(s);
        this.fromFinnhub.set(fs, s);
        ws.send(JSON.stringify({ type: 'subscribe', symbol: fs }));
        this.subscribed.add(s);
      }
    }
  }
}
