import numpy as np

from promptmix.master.loudness import limit, lufs, master, true_peak_dbtp

SR = 44100


def test_true_peak_intersample():
    t = np.arange(SR) / SR
    s = np.sin(2 * np.pi * SR / 4 * t + np.pi / 4)  # échantillons à ±0,707, crête vraie 1,0
    x = np.stack([s, s], 1)
    assert abs(true_peak_dbtp(x) - 0.0) < 0.2


def test_limiter_respects_ceiling():
    rng = np.random.default_rng(0)
    x = rng.standard_normal((SR * 10, 2)) * 0.3
    x[SR * 3: SR * 3 + 200] *= 8  # transitoires
    y = limit(x, -1.6)
    assert true_peak_dbtp(y) <= -1.55


def test_master_reaches_target():
    rng = np.random.default_rng(1)
    t = np.arange(SR * 20) / SR
    x = 0.05 * np.sin(2 * np.pi * 110 * t) * (1 + np.sign(np.sin(2 * np.pi * 2 * t)))
    x = np.stack([x + 0.01 * rng.standard_normal(len(t)), x], 1)
    y, rep = master(x, -11.0, -1.6)
    assert abs(lufs(y) + 11.0) < 0.5
    assert true_peak_dbtp(y) <= -1.55
