import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import backtest  # noqa: E402
import indicators as ind  # noqa: E402
import strategy  # noqa: E402


def make_df(closes, freq="D"):
    closes = np.asarray(closes, dtype=float)
    idx = pd.date_range("2025-01-01", periods=len(closes), freq=freq, tz="America/New_York")
    return pd.DataFrame(
        {"Open": closes, "High": closes * 1.01, "Low": closes * 0.99, "Close": closes, "Volume": 1_000_000},
        index=idx,
    )


def test_rsi_bounds():
    rng = np.random.default_rng(0)
    r = ind.rsi(pd.Series(100 + rng.normal(0, 1, 300).cumsum())).dropna()
    assert ((r >= 0) & (r <= 100)).all()
    assert ind.rsi(pd.Series(np.arange(1, 50, dtype=float))).iloc[-1] == 100


def test_uptrend_scores_positive_downtrend_negative():
    up = strategy.analyze(make_df(np.linspace(50, 100, 250)))
    down = strategy.analyze(make_df(np.linspace(100, 50, 250)))
    assert up.votes["tendance_ema"][0] > 0 > down.votes["tendance_ema"][0]
    assert -100 <= down.score < 0 < up.score <= 100


def test_short_history_is_neutral():
    assert strategy.analyze(make_df([10] * 10)).score == 0


def test_intraday_includes_vwap():
    a = strategy.analyze(make_df(np.linspace(50, 60, 100), freq="5min"), intraday=True)
    assert "vwap" in a.votes


def test_signal_hysteresis():
    s = strategy.SignalState(35, -35, 15)
    assert s.update(40) == "ACHAT"
    assert s.update(30) is None  # reste ACHAT dans la bande
    assert s.update(10) == "NEUTRE"
    assert s.update(-50) == "VENTE"
    assert s.update(-40) is None


def test_combine_weights():
    a = {"1d": strategy.TimeframeAnalysis(100), "1h": strategy.TimeframeAnalysis(0)}
    assert round(strategy.combine(a), 2) == round(100 * 0.45 / 0.80, 2)


def test_risk_levels():
    lv = strategy.risk_levels(100, 5)
    assert lv == {"stop": 90, "objectif_1": 110, "objectif_2": 120}


def test_backtest_runs():
    rng = np.random.default_rng(1)
    res = backtest.run(make_df(50 * np.exp(rng.normal(0, 0.02, 300).cumsum())))
    assert set(res) >= {"trades", "rendement_strategie_%", "rendement_achat_conservation_%"}


def _breakout(direction):
    base = np.full(260, 40.0) + np.sin(np.arange(260)) * 0.3
    df = make_df(np.concatenate([base, np.linspace(40, 40 + 4 * direction, 40)]))
    df.iloc[-5:, df.columns.get_loc("Volume")] = 3_000_000
    return strategy.analyze(df)


def test_breakout_triggers_signals_despite_overbought_oscillators():
    s = strategy.SignalState()
    assert s.update(_breakout(+1).score) == "ACHAT"
    assert s.update(_breakout(-1).score) == "VENTE"


def test_random_walk_is_not_biased():
    rng = np.random.default_rng(7)
    scores = [strategy.analyze(make_df(50 * np.exp(rng.normal(0, 0.015, 300).cumsum()))).score for _ in range(30)]
    assert abs(np.mean(scores)) < 10
