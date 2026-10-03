"""Moteur de signaux : combine les indicateurs en un score de -100 à +100.

Chaque indicateur vote entre -1 (vendre) et +1 (acheter), pondéré.
Les unités de temps (jour, heure, 5 min) sont ensuite combinées :
la tendance de fond (jour) pèse le plus, le 5 min sert à affiner le timing.
"""
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

import indicators as ind

# Poids de chaque famille d'indicateurs dans le score d'une unité de temps
WEIGHTS = {
    "tendance_ema": 1.5,
    "macd": 1.2,
    "adx": 0.8,
    "rsi": 1.2,
    "divergence_rsi": 1.0,
    "stochastique": 0.8,
    "bollinger": 1.0,
    "volume_obv": 0.7,
    "vwap": 0.6,
    "cassure_donchian": 0.8,
}


@dataclass
class TimeframeAnalysis:
    score: float  # -100..100
    votes: dict = field(default_factory=dict)  # nom -> (vote, explication)
    atr: float = float("nan")
    last_close: float = float("nan")


def _clip(x: float) -> float:
    if x is None or np.isnan(x):
        return 0.0
    return float(max(-1.0, min(1.0, x)))


def _oscillator_vote(mean_rev: float, level: float, trend_dir: float, trend_strength: float,
                     low: float, high: float) -> float:
    """Vote d'un oscillateur (RSI, stochastique, %B) adapté au régime de marché.

    En range, logique de retour à la moyenne : survendu = achat, suracheté = vente.
    En tendance forte, un oscillateur « suracheté » est normal : on achète plutôt
    les replis dans le sens de la tendance, et on ne vend pas contre elle.
    """
    mid = (low + high) / 2
    against_trend = (level - mid) * trend_dir < 0  # repli dans une tendance
    exhausted = level > high + (high - mid) * 0.3 if trend_dir > 0 else level < low - (mid - low) * 0.3
    if exhausted:
        trend_vote = 0.0
    else:
        trend_vote = trend_dir * (1.0 if against_trend else 0.4)
    return (1 - trend_strength) * _clip(mean_rev) + trend_strength * trend_vote


def analyze(df: pd.DataFrame, intraday: bool = False) -> TimeframeAnalysis:
    """Analyse une série OHLCV et renvoie un score avec le détail des votes."""
    df = df.dropna(subset=["Close"])
    if len(df) < 35:
        return TimeframeAnalysis(score=0.0, votes={"données": (0.0, "historique insuffisant")})

    close = df["Close"]
    c = close.iloc[-1]
    votes = {}

    # 1. Tendance : EMA 20 / 50 / 200
    e20, e50 = ind.ema(close, 20).iloc[-1], ind.ema(close, 50).iloc[-1]
    e200 = ind.ema(close, 200).iloc[-1] if len(close) >= 200 else e50
    v = 0.4 * np.sign(e20 - e50) + 0.3 * np.sign(c - e50) + 0.3 * np.sign(c - e200)
    votes["tendance_ema"] = (v, f"prix {c:.2f} / EMA20 {e20:.2f} / EMA50 {e50:.2f} / EMA200 {e200:.2f}")
    trend_dir = float(np.sign(e20 - e50))

    # 2. MACD : sens de l'histogramme et croisement récent
    _, _, hist = ind.macd(close)
    h, h_prev = hist.iloc[-1], hist.iloc[-2]
    v = 0.6 * np.sign(h) + 0.4 * np.sign(h - h_prev)
    if h > 0 >= h_prev:
        v, note = 1.0, "croisement haussier"
    elif h < 0 <= h_prev:
        v, note = -1.0, "croisement baissier"
    else:
        note = "histogramme " + ("en hausse" if h > h_prev else "en baisse")
    votes["macd"] = (v, note)

    # 3. ADX : force de la tendance (direction par +DI / -DI). Détermine aussi le
    #    régime tendance / range utilisé par les oscillateurs ci-dessous.
    adx_v, pdi, mdi = ind.adx(df)
    a = adx_v.iloc[-1]
    strength = min(max((a - 15) / 25, 0), 1) if not np.isnan(a) else 0.0  # 0 sous ADX 15, 1 au-dessus de 40
    regime = "tendance" if strength >= 0.5 else "range"
    votes["adx"] = (np.sign(pdi.iloc[-1] - mdi.iloc[-1]) * strength, f"ADX {a:.0f} ({regime})")

    # 4. RSI : survente / surachat en range, achat des replis en tendance
    r_series = ind.rsi(close)
    r = r_series.iloc[-1]
    mean_rev = 1.0 if r < 30 else -1.0 if r > 70 else (50 - r) / 40
    votes["rsi"] = (_oscillator_vote(mean_rev, r, trend_dir, strength, 30, 70), f"RSI {r:.0f}")

    # 5. Divergence RSI / prix
    d = ind.rsi_divergence(close, r_series)
    votes["divergence_rsi"] = (float(d), {1: "divergence haussière", -1: "divergence baissière", 0: "aucune"}[d])

    # 6. Stochastique : croisement %K/%D dans les zones extrêmes
    k, dd = ind.stochastic(df)
    kv, dv = k.iloc[-1], dd.iloc[-1]
    if np.isnan(kv):
        v = 0.0
    else:
        if kv < 20 and kv > dv:
            mean_rev = 1.0
        elif kv > 80 and kv < dv:
            mean_rev = -1.0
        else:
            mean_rev = (50 - kv) / 100
        v = _oscillator_vote(mean_rev, kv, trend_dir, strength, 20, 80)
    votes["stochastique"] = (v, f"%K {kv:.0f} / %D {dv:.0f}")

    # 7. Bollinger : position dans les bandes
    _, _, _, pct_b, _ = ind.bollinger(close)
    b = pct_b.iloc[-1]
    v = 0.0 if np.isnan(b) else _oscillator_vote((0.5 - b) * 2, b, trend_dir, strength, 0.0, 1.0)
    votes["bollinger"] = (v, f"%B {b:.2f}")

    # 8. Volume : pente de l'OBV confirmée par un pic de volume
    o = ind.obv(df)
    slope = o.iloc[-1] - o.iloc[-10]
    vol_ratio = df["Volume"].iloc[-1] / max(df["Volume"].iloc[-21:-1].mean(), 1)
    v = np.sign(slope) * (0.5 + 0.5 * min(vol_ratio, 2) / 2)
    votes["volume_obv"] = (v, f"OBV {'↑' if slope > 0 else '↓'}, volume x{vol_ratio:.1f}")

    # 9. VWAP (intraday uniquement)
    if intraday:
        w = ind.vwap(df).iloc[-1]
        votes["vwap"] = (_clip((c - w) / w * 100), f"VWAP {w:.2f}")

    # 10. Cassure de canal de Donchian (plus haut / plus bas 20 périodes)
    hi20, lo20 = df["High"].iloc[-21:-1].max(), df["Low"].iloc[-21:-1].min()
    if c > hi20:
        v, note = 1.0, f"cassure au-dessus de {hi20:.2f}"
    elif c < lo20:
        v, note = -1.0, f"cassure sous {lo20:.2f}"
    else:
        v, note = 0.0, f"dans le canal {lo20:.2f}–{hi20:.2f}"
    votes["cassure_donchian"] = (v, note)

    total_w = sum(WEIGHTS[n] for n in votes)
    score = sum(_clip(v) * WEIGHTS[n] for n, (v, _) in votes.items()) / total_w * 100
    return TimeframeAnalysis(
        score=score,
        votes={n: (_clip(v), note) for n, (v, note) in votes.items()},
        atr=float(ind.atr(df).iloc[-1]),
        last_close=float(c),
    )


TIMEFRAME_WEIGHTS = {"1d": 0.45, "1h": 0.35, "5m": 0.20}


def combine(analyses: dict) -> float:
    """Score global pondéré sur les unités de temps disponibles."""
    num = sum(TIMEFRAME_WEIGHTS[tf] * a.score for tf, a in analyses.items() if tf in TIMEFRAME_WEIGHTS)
    den = sum(TIMEFRAME_WEIGHTS[tf] for tf in analyses if tf in TIMEFRAME_WEIGHTS)
    return num / den if den else 0.0


@dataclass
class SignalState:
    """Machine à états avec hystérésis : évite de recevoir 50 alertes quand le score oscille."""

    buy_threshold: float = 35.0
    sell_threshold: float = -35.0
    reset_band: float = 15.0
    current: str = "NEUTRE"

    def update(self, score: float):
        """Renvoie le nouveau signal s'il vient de changer, sinon None."""
        new = self.current
        if score >= self.buy_threshold:
            new = "ACHAT"
        elif score <= self.sell_threshold:
            new = "VENTE"
        elif self.current == "ACHAT" and score < self.buy_threshold - self.reset_band:
            new = "NEUTRE"
        elif self.current == "VENTE" and score > self.sell_threshold + self.reset_band:
            new = "NEUTRE"
        if new != self.current:
            self.current = new
            return new
        return None


def risk_levels(price: float, atr_daily: float, side: str = "ACHAT"):
    """Stop-loss et objectifs basés sur l'ATR journalier (ratio gain/risque 2:1)."""
    if np.isnan(atr_daily) or atr_daily <= 0:
        return None
    if side == "ACHAT":
        return {"stop": price - 2 * atr_daily, "objectif_1": price + 2 * atr_daily, "objectif_2": price + 4 * atr_daily}
    return {"stop": price + 2 * atr_daily, "objectif_1": price - 2 * atr_daily, "objectif_2": price - 4 * atr_daily}
