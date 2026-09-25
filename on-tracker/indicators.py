"""Indicateurs d'analyse technique, calculés avec pandas uniquement.

Toutes les fonctions prennent un DataFrame OHLCV avec les colonnes
Open, High, Low, Close, Volume et sont causales (aucune donnée du futur).
"""
import numpy as np
import pandas as pd


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    rs = gain / loss.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    # Aucune perte sur la période => RSI = 100
    return out.where(loss != 0, 100.0)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def bollinger(close: pd.Series, period: int = 20, width: float = 2.0):
    mid = close.rolling(period).mean()
    std = close.rolling(period).std(ddof=0)
    upper = mid + width * std
    lower = mid - width * std
    pct_b = (close - lower) / (upper - lower)
    bandwidth = (upper - lower) / mid
    return mid, upper, lower, pct_b, bandwidth


def stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    low = df["Low"].rolling(k_period).min()
    high = df["High"].rolling(k_period).max()
    k = 100 * (df["Close"] - low) / (high - low).replace(0, np.nan)
    d = k.rolling(d_period).mean()
    return k, d


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    prev_close = df["Close"].shift()
    tr = pd.concat(
        [
            df["High"] - df["Low"],
            (df["High"] - prev_close).abs(),
            (df["Low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def adx(df: pd.DataFrame, period: int = 14):
    up = df["High"].diff()
    down = -df["Low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)
    tr = atr(df, period)
    plus_di = 100 * plus_dm.ewm(alpha=1 / period, adjust=False).mean() / tr
    minus_di = 100 * minus_dm.ewm(alpha=1 / period, adjust=False).mean() / tr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return dx.ewm(alpha=1 / period, adjust=False).mean(), plus_di, minus_di


def obv(df: pd.DataFrame) -> pd.Series:
    direction = np.sign(df["Close"].diff()).fillna(0)
    return (direction * df["Volume"]).cumsum()


def vwap(df: pd.DataFrame) -> pd.Series:
    """VWAP réinitialisé chaque jour (utile en intraday)."""
    typical = (df["High"] + df["Low"] + df["Close"]) / 3
    pv = typical * df["Volume"]
    day = df.index.normalize() if isinstance(df.index, pd.DatetimeIndex) else 0
    cum_pv = pv.groupby(day).cumsum()
    cum_v = df["Volume"].groupby(day).cumsum().replace(0, np.nan)
    return cum_pv / cum_v


def rsi_divergence(close: pd.Series, rsi_series: pd.Series, lookback: int = 20) -> int:
    """+1 divergence haussière, -1 baissière, 0 sinon (sur les `lookback` dernières bougies).

    Haussière : le prix fait un plus bas plus bas, mais le RSI un plus bas plus haut.
    """
    if len(close) < 2 * lookback:
        return 0
    recent_c, prev_c = close.iloc[-lookback:], close.iloc[-2 * lookback : -lookback]
    recent_r, prev_r = rsi_series.iloc[-lookback:], rsi_series.iloc[-2 * lookback : -lookback]
    if recent_c.min() < prev_c.min() and recent_r.min() > prev_r.min() and recent_r.min() < 40:
        return 1
    if recent_c.max() > prev_c.max() and recent_r.max() < prev_r.max() and recent_r.max() > 60:
        return -1
    return 0
