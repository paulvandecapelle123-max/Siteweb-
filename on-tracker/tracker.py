"""Suivi en temps réel d'On Holding (ONON) et de l'or, avec alertes achat / vente.

Lancement :  python tracker.py            (tableau de bord sur http://127.0.0.1:8765)
"""
import json
import logging
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

import strategy
from notifier import Notifier

HERE = Path(__file__).parent
CHART_JS = HERE / "static" / "lightweight-charts.standalone.production.js"
log = logging.getLogger("tracker")

# unité de temps -> (période téléchargée, rafraîchissement complet en secondes)
TIMEFRAMES = {"1d": ("2y", 1800), "1h": ("60d", 300), "5m": ("5d", 60)}


def load_config() -> dict:
    path = HERE / "config.json"
    if not path.exists():
        path = HERE / "config.example.json"
        log.warning("config.json absent : utilisation de config.example.json (aucune notification mobile)")
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_history(symbol: str, tf: str) -> pd.DataFrame:
    period, _ = TIMEFRAMES[tf]
    df = yf.Ticker(symbol).history(period=period, interval=tf, auto_adjust=False)
    return df[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"])


def fetch_price(symbol: str):
    try:
        p = yf.Ticker(symbol).fast_info["lastPrice"]
        return float(p) if p and not np.isnan(p) else None
    except Exception:  # noqa: BLE001 — Yahoo renvoie parfois des erreurs variées
        return None


def with_live_price(df: pd.DataFrame, price) -> pd.DataFrame:
    """Remplace la clôture de la dernière bougie par le dernier prix connu."""
    if price is None or df.empty:
        return df
    df = df.copy()
    i = df.index[-1]
    df.loc[i, "Close"] = price
    df.loc[i, "High"] = max(df.loc[i, "High"], price)
    df.loc[i, "Low"] = min(df.loc[i, "Low"], price)
    return df


class AssetTracker:
    def __init__(self, asset: dict, cfg: dict, notifier: Notifier):
        self.symbol = asset["symbole"]
        self.name = asset["nom"]
        self.currency = asset.get("devise", "USD")
        self.notifier = notifier
        self.signal = strategy.SignalState(cfg.get("seuil_achat", 35), cfg.get("seuil_vente", -35))
        self.cooldown = cfg.get("delai_min_entre_alertes_minutes", 15) * 60
        pos = (cfg.get("positions") or {}).get(self.symbol) or {}
        self.entry = pos.get("prix_achat")
        self.peak = self.entry
        self.stop_alerted = False
        self.histories: dict = {}
        self.fetched_at: dict = {}
        self.price = None
        self.analyses: dict = {}
        self.score = 0.0
        self.last_alert = 0.0
        self.alerts: list = []
        self.updated = None

    # --- données -------------------------------------------------------
    def refresh(self, force=False):
        now = time.time()
        for tf, (_, every) in TIMEFRAMES.items():
            if force or now - self.fetched_at.get(tf, 0) >= every:
                try:
                    self.histories[tf] = fetch_history(self.symbol, tf)
                    self.fetched_at[tf] = now
                except Exception as e:  # noqa: BLE001
                    log.warning("%s %s : téléchargement impossible (%s)", self.symbol, tf, e)
        price = fetch_price(self.symbol)
        if price is None and "5m" in self.histories and not self.histories["5m"].empty:
            price = float(self.histories["5m"]["Close"].iloc[-1])
        self.price = price

    # --- analyse -------------------------------------------------------
    def evaluate(self):
        self.analyses = {
            tf: strategy.analyze(with_live_price(df, self.price), intraday=(tf != "1d"))
            for tf, df in self.histories.items()
            if not df.empty
        }
        if not self.analyses:
            return
        self.score = strategy.combine(self.analyses)
        self.updated = datetime.now(timezone.utc).isoformat()

        changed = self.signal.update(self.score)
        if changed in ("ACHAT", "VENTE") and time.time() - self.last_alert >= self.cooldown:
            self._alert_signal(changed)
        self._check_position()

    def _atr_daily(self):
        a = self.analyses.get("1d")
        return a.atr if a else float("nan")

    def _alert_signal(self, side: str):
        self.last_alert = time.time()
        levels = strategy.risk_levels(self.price, self._atr_daily(), side)
        top = sorted(
            ((n, v, note) for tf in ("1d", "1h") if tf in self.analyses for n, (v, note) in self.analyses[tf].votes.items()),
            key=lambda x: -abs(x[1]),
        )[:4]
        lines = [
            f"{self.name} ({self.symbol}) : {self.price:.2f} {self.currency}",
            f"Score global : {self.score:+.0f}/100",
            "Scores : " + ", ".join(f"{tf} {a.score:+.0f}" for tf, a in self.analyses.items()),
        ]
        if levels:
            lines.append(
                f"Stop {levels['stop']:.2f} · Objectif 1 {levels['objectif_1']:.2f} · Objectif 2 {levels['objectif_2']:.2f}"
            )
        lines.append("Raisons : " + "; ".join(f"{n} ({note})" for n, _, note in top))
        emoji = "🟢" if side == "ACHAT" else "🔴"
        title = f"{emoji} {side} probable — {self.name}"
        msg = "\n".join(lines)
        self.notifier.send(title, msg, urgent=True, tags=["chart_with_upwards_trend" if side == "ACHAT" else "chart_with_downwards_trend"])
        self._log(title, msg)

    def _check_position(self):
        """Stop suiveur (chandelier) : plus haut depuis l'achat − 3 × ATR journalier."""
        if not self.entry or self.price is None:
            return
        self.peak = max(self.peak or self.price, self.price)
        atr_d = self._atr_daily()
        if np.isnan(atr_d):
            return
        trail = self.peak - 3 * atr_d
        if self.price <= trail and not self.stop_alerted:
            self.stop_alerted = True
            pnl = (self.price / self.entry - 1) * 100
            title = f"⛔ Stop suiveur touché — {self.name}"
            msg = f"Prix {self.price:.2f} ≤ stop {trail:.2f} (plus haut {self.peak:.2f}). Résultat : {pnl:+.1f} %"
            self.notifier.send(title, msg, urgent=True, tags=["warning"])
            self._log(title, msg)
        elif self.price > trail + atr_d:
            self.stop_alerted = False

    def _log(self, title, msg):
        self.alerts.insert(0, {"heure": datetime.now(timezone.utc).isoformat(), "titre": title, "message": msg})
        del self.alerts[50:]

    # --- export pour le tableau de bord --------------------------------
    def state(self) -> dict:
        candles = []
        df = self.histories.get("5m")
        if df is not None and not df.empty:
            df = with_live_price(df, self.price).iloc[-200:]
            candles = [
                {"t": int(ts.timestamp()), "o": r.Open, "h": r.High, "l": r.Low, "c": r.Close}
                for ts, r in df.iterrows()
            ]
        daily = self.histories.get("1d")
        prev_close = float(daily["Close"].iloc[-2]) if daily is not None and len(daily) > 1 else None
        side = self.signal.current if self.signal.current != "NEUTRE" else "ACHAT"
        return {
            "symbole": self.symbol,
            "nom": self.name,
            "devise": self.currency,
            "prix": self.price,
            "variation_jour": (self.price / prev_close - 1) * 100 if self.price and prev_close else None,
            "score": self.score,
            "signal": self.signal.current,
            "niveaux": strategy.risk_levels(self.price, self._atr_daily(), side) if self.price else None,
            "unites": {
                tf: {"score": a.score, "votes": {n: {"vote": v, "detail": note} for n, (v, note) in a.votes.items()}}
                for tf, a in self.analyses.items()
            },
            "position": {"prix_achat": self.entry, "plus_haut": self.peak} if self.entry else None,
            "bougies": candles,
            "alertes": self.alerts,
            "maj": self.updated,
        }


def _json_default(o):
    if isinstance(o, (np.floating, np.integer)):
        return None if np.isnan(o) else o.item()
    raise TypeError(type(o))


def _clean(obj):
    """Remplace NaN / inf par None pour produire du JSON valide."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, float) and not np.isfinite(obj):
        return None
    return obj


def serve(trackers, host, port):
    page = (HERE / "dashboard.html").read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith("/api/state"):
                body = json.dumps(_clean([t.state() for t in trackers]), default=_json_default).encode()
                ctype = "application/json"
            elif self.path in ("/", "/index.html"):
                body, ctype = page, "text/html; charset=utf-8"
            elif self.path == "/static/" + CHART_JS.name:
                body, ctype = CHART_JS.read_bytes(), "text/javascript"
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer((host, port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Tableau de bord : http://{host}:{port}", flush=True)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config()
    notifier = Notifier(cfg.get("notifications") or {})
    trackers = [AssetTracker(a, cfg, notifier) for a in cfg["actifs"]]
    dash = cfg.get("tableau_de_bord") or {}
    serve(trackers, dash.get("hote", "127.0.0.1"), dash.get("port", 8765))
    interval = max(1, cfg.get("intervalle_secondes", 5))

    notifier.send("📡 Suivi démarré", "Actifs : " + ", ".join(t.name for t in trackers))
    for t in trackers:
        t.refresh(force=True)
    while True:
        start = time.time()
        for t in trackers:
            try:
                t.refresh()
                t.evaluate()
            except Exception:  # noqa: BLE001 — le suivi ne doit jamais s'arrêter
                log.exception("%s : erreur pendant l'analyse", t.symbol)
        time.sleep(max(0.0, interval - (time.time() - start)))


if __name__ == "__main__":
    main()
