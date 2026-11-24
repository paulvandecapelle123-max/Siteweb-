"""Générateurs de pistes de test à tempo connu (aucun fichier externe)."""
from __future__ import annotations

import numpy as np

SR = 44100


def _place(buf: np.ndarray, t: float, snd: np.ndarray, sr: int = SR) -> None:
    i = int(round(t * sr))
    if i >= len(buf) or i < 0:
        return
    j = min(len(buf), i + len(snd))
    buf[i:j] += snd[: j - i]


def click(sr=SR, freq=2000.0, dur=0.012, amp=0.8):
    n = int(dur * sr)
    t = np.arange(n) / sr
    return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t / (dur / 4))


def kick(sr=SR, dur=0.25, amp=0.9):
    n = int(dur * sr)
    t = np.arange(n) / sr
    f = 50 + 120 * np.exp(-t * 35)
    ph = 2 * np.pi * np.cumsum(f) / sr
    return amp * np.sin(ph) * np.exp(-t * 9)


def hat(sr=SR, dur=0.05, amp=0.25, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = rng.standard_normal(n)
    x = np.diff(x, prepend=0)  # passe-haut simple
    return amp * x * np.exp(-t * 60)


def bass_note(freq, dur, sr=SR, amp=0.5):
    n = int(dur * sr)
    t = np.arange(n) / sr
    env = np.minimum(1, t / 0.004) * np.exp(-t * 4)
    return amp * np.sin(2 * np.pi * freq * t) * env


def click_track(bpm: float, duration: float, offset: float = 0.0, accent_every: int = 4,
                downbeat_index: int = 0, sr: int = SR) -> tuple[np.ndarray, np.ndarray]:
    """Clics à tempo connu ; un clic grave accentué sur chaque premier temps.
    Retourne (audio stéréo, instants des temps)."""
    n = int(duration * sr)
    buf = np.zeros(n)
    period = 60.0 / bpm
    beats = offset + np.arange(int((duration - offset) / period) + 1) * period
    beats = beats[beats < duration - 0.02]
    for k, t in enumerate(beats):
        if (k - downbeat_index) % accent_every == 0:
            _place(buf, t, click(sr, 1000.0, amp=0.95), sr)
        else:
            _place(buf, t, click(sr, 2000.0, amp=0.5), sr)
    return np.stack([buf, buf], 1).astype(np.float32), beats


def techno_track(bpm: float, duration: float, offset: float = 0.0, syncopated_bass: bool = True,
                 offbeat_hats: bool = True, breakdown: tuple[int, int] | None = None, root_hz: float = 55.0,
                 sr: int = SR, seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Piste « techno » : kick sur les temps, basse syncopée (doubles-croches 2 et 4 de chaque temps),
    charleys sur les contretemps. `breakdown=(bar_start, bar_end)` retire kick et basse."""
    n = int(duration * sr)
    buf = np.zeros(n)
    period = 60.0 / bpm
    beats = offset + np.arange(int((duration - offset) / period) + 1) * period
    beats = beats[beats < duration - 0.02]
    k_snd, h_snd = kick(sr), hat(sr, seed=seed)
    for k, t in enumerate(beats):
        bar = k // 4
        in_break = breakdown is not None and breakdown[0] <= bar < breakdown[1]
        if not in_break:
            _place(buf, t, k_snd, sr)
            if syncopated_bass:
                for frac in (0.25, 0.75):
                    _place(buf, t + frac * period, bass_note(root_hz * (1.5 if bar % 2 else 1), period * 0.2, sr, 0.6), sr)
        if offbeat_hats:
            _place(buf, t + 0.5 * period, h_snd, sr)
        if in_break:  # nappe pendant le break
            pass
    if breakdown is not None:
        a, b = beats[breakdown[0] * 4] if breakdown[0] * 4 < len(beats) else duration, \
            beats[breakdown[1] * 4] if breakdown[1] * 4 < len(beats) else duration
        i, j = int(a * sr), int(b * sr)
        t = np.arange(j - i) / sr
        buf[i:j] += 0.15 * np.sin(2 * np.pi * 440 * t) * np.sin(np.pi * t / max(t[-1], 1e-3))
    return np.stack([buf, buf], 1).astype(np.float32), beats
