"""Test de la stratégie sur l'historique : aurait-elle battu un simple achat-conservation ?

Usage :  python backtest.py ONON            (bougies journalières, 5 ans)
         python backtest.py GC=F --tf 1h    (bougies horaires, 2 ans)
"""
import argparse

import numpy as np
import pandas as pd

import strategy


def run(df: pd.DataFrame, buy=35.0, sell=-35.0, intraday=False, fee=0.001):
    """Stratégie acheteuse uniquement : entrée sur ACHAT, sortie sur VENTE ou stop suiveur 3 × ATR."""
    state = strategy.SignalState(buy, sell)
    trades, equity = [], [1.0]
    entry = peak = None
    cash = 1.0
    for i in range(60, len(df)):
        window = df.iloc[: i + 1]
        a = strategy.analyze(window, intraday=intraday)
        price = window["Close"].iloc[-1]
        state.update(a.score)
        if entry is None and state.current == "ACHAT":
            entry, peak = price, price
        elif entry is not None:
            peak = max(peak, price)
            if state.current == "VENTE" or price <= peak - 3 * a.atr:
                ret = price / entry * (1 - fee) ** 2 - 1
                trades.append(ret)
                cash *= 1 + ret
                entry = None
        equity.append(cash * (price / entry if entry else 1))
    if entry is not None:  # position encore ouverte à la fin
        ret = df["Close"].iloc[-1] / entry * (1 - fee) ** 2 - 1
        trades.append(ret)
        cash *= 1 + ret
    eq = pd.Series(equity)
    drawdown = (eq / eq.cummax() - 1).min()
    bh = df["Close"].iloc[-1] / df["Close"].iloc[60] - 1
    return {
        "trades": len(trades),
        "gagnants_%": 100 * np.mean([t > 0 for t in trades]) if trades else 0.0,
        "gain_moyen_%": 100 * np.mean(trades) if trades else 0.0,
        "rendement_strategie_%": 100 * (cash - 1),
        "rendement_achat_conservation_%": 100 * bh,
        "perte_max_%": 100 * drawdown,
    }


def main():
    import yfinance as yf

    p = argparse.ArgumentParser()
    p.add_argument("symbole", nargs="?", default="ONON")
    p.add_argument("--tf", default="1d", choices=["1d", "1h"])
    args = p.parse_args()
    period = "5y" if args.tf == "1d" else "730d"
    df = yf.Ticker(args.symbole).history(period=period, interval=args.tf, auto_adjust=False)
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"])
    print(f"{args.symbole} — {len(df)} bougies {args.tf} ({df.index[0]:%Y-%m-%d} → {df.index[-1]:%Y-%m-%d})")
    for k, v in run(df, intraday=args.tf != "1d").items():
        print(f"  {k:32s} {v:8.1f}")


if __name__ == "__main__":
    main()
