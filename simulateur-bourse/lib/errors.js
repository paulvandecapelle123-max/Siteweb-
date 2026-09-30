// Erreurs « métier » avec un message compréhensible en français.

export class AppError extends Error {
  /**
   * @param {string} code INVALID_KEY | RATE_LIMIT | NOT_FOUND | UNAVAILABLE | PLAN | BAD_REQUEST | NO_KEY
   * @param {string} message message lisible par l'utilisateur
   */
  constructor(code, message, { source = null, status = 400, cause } = {}) {
    super(message);
    this.code = code;
    this.source = source;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

const SOURCE_NAMES = { yahoo: 'Yahoo Finance', finnhub: 'Finnhub', twelvedata: 'Twelve Data', frankfurter: 'la BCE (Frankfurter)' };

export function sourceName(source) {
  return SOURCE_NAMES[source] || source;
}

/** Traduit une erreur technique (réseau, HTTP, bibliothèque) en AppError lisible. */
export function explainError(err, source, context = '') {
  if (err instanceof AppError) return err;
  const name = sourceName(source);
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.response?.status || (/\b(4\d\d|5\d\d)\b/.exec(msg) || [])[1];

  if (/invalid api key|api key.*(invalid|incorrect)|apikey.*incorrect|unauthori[sz]ed|\b401\b/i.test(msg) || status == 401) {
    return new AppError('INVALID_KEY', `Clé API ${name} invalide. Vérifie-la dans les Réglages.`, { source, status: 401, cause: err });
  }
  if (/too many requests|rate limit|run out of api credits|\b429\b|limit reached/i.test(msg) || status == 429) {
    return new AppError('RATE_LIMIT', `Limite d'appels atteinte chez ${name}. Nouvelle tentative automatique dans une minute ; les prix peuvent dater un peu.`, { source, status: 429, cause: err });
  }
  if (/don't have access|not available (on|with) your plan|upgrade|grow plan|pro plan|\b403\b/i.test(msg) || status == 403) {
    return new AppError('PLAN', `Donnée non incluse dans l'offre gratuite de ${name}${context ? ` (${context})` : ''}.`, { source, status: 403, cause: err });
  }
  if (/no data found|not found|delisted|symbol.*(invalid|not exist)|quote not found|\b404\b/i.test(msg) || status == 404) {
    return new AppError('NOT_FOUND', `Ticker introuvable${context ? ` : ${context}` : ''}. Vérifie l'orthographe ou cherche par nom d'entreprise.`, { source, status: 404, cause: err });
  }
  if (/fetch failed|enotfound|eai_again|econnrefused|econnreset|etimedout|timeout|network|socket|certificate/i.test(msg)) {
    return new AppError('UNAVAILABLE', `Impossible de joindre ${name}. Vérifie ta connexion Internet ; nouvelle tentative automatique.`, { source, status: 503, cause: err });
  }
  return new AppError('UNAVAILABLE', `${name} est momentanément indisponible (${msg.slice(0, 140) || 'erreur inconnue'}).`, { source, status: 502, cause: err });
}

export function withTimeout(promise, ms, label = 'requête') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout: ${label} (> ${ms / 1000} s)`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
