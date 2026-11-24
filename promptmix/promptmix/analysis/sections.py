"""Sections (intro, break, montée, drop, outro) à partir de l'énergie des basses par mesure."""
from __future__ import annotations

import numpy as np
from scipy import signal

from ..config import SR
from .beats import BeatGrid, to_mono


def bar_energies(audio: np.ndarray, grid: BeatGrid, sr: int = SR) -> dict[str, np.ndarray]:
    mono = to_mono(audio).astype(np.float64)
    low = signal.sosfiltfilt(signal.butter(4, 150, "low", fs=sr, output="sos"), mono)
    high = signal.sosfiltfilt(signal.butter(4, 4000, "high", fs=sr, output="sos"), mono)
    out = {"low": [], "high": [], "full": []}
    for b in range(grid.n_bars):
        i, j = int(grid.bar_time(b) * sr), int(grid.bar_time(b + 1) * sr)
        i, j = max(0, i), min(len(mono), j)
        for name, x in (("low", low), ("high", high), ("full", mono)):
            seg = x[i:j]
            out[name].append(10 * np.log10(np.mean(seg ** 2) + 1e-12) if len(seg) else -120.0)
    return {k: np.asarray(v) for k, v in out.items()}


def detect_sections(audio: np.ndarray, grid: BeatGrid, sr: int = SR) -> dict:
    """Retourne les sections (en mesures) et les repères fiables pour caler un extrait :
    débuts de drop et reprises de la grosse caisse après un break."""
    if grid.n_bars < 4:
        return {"sections": [], "drops": [], "kick_returns": [], "bass_db": []}
    e = bar_energies(audio, grid, sr)
    low = e["low"] - np.percentile(e["low"], 90)
    high = e["high"] - np.percentile(e["high"], 90)
    bass_on = low > -9.0
    # lissage : une mesure isolée ne change pas d'état
    bass_on = signal.medfilt(bass_on.astype(float), 3) > 0.5
    n = len(bass_on)

    # segments de même état, bornes recalées sur des groupes de 4 mesures quand c'est proche
    bounds = [0] + [i for i in range(1, n) if bass_on[i] != bass_on[i - 1]] + [n]
    segs = []
    first_on = next((i for i in range(n) if bass_on[i]), n)
    last_on = max((i for i in range(n) if bass_on[i]), default=-1)
    for a, b in zip(bounds[:-1], bounds[1:]):
        on = bool(bass_on[a])
        if on:
            label = "drop" if a > first_on or (a == first_on and a > 0) else "groove"
        elif b <= first_on:
            label = "intro"
        elif a > last_on:
            label = "outro"
        else:
            label = "break"
        segs.append({"label": label, "start_bar": int(a), "length_bars": int(b - a)})

    # montée : fin d'un break où les aigus remontent
    out = []
    for s in segs:
        if s["label"] in ("break", "intro") and s["length_bars"] >= 4 and s["start_bar"] + s["length_bars"] < n:
            a, L = s["start_bar"], s["length_bars"]
            tail = min(8, L // 2) if L >= 8 else 0
            if tail:
                h = high[a: a + L]
                if h[-tail:].mean() > h[: L - tail].mean() + 2.0:
                    out.append({**s, "length_bars": L - tail})
                    out.append({"label": "montée", "start_bar": a + L - tail, "length_bars": tail})
                    continue
        out.append(s)

    drops = [s["start_bar"] for s in out if s["label"] == "drop"]
    kick_returns = [s["start_bar"] for s in out if s["label"] in ("drop", "groove") and s["start_bar"] > 0]
    return {"sections": out, "drops": drops, "kick_returns": kick_returns,
            "bass_db": [round(float(x), 1) for x in low]}
