"""Briques DSP déterministes (numpy/scipy) : fondus, filtres résonants balayés, delay, réverb, riser."""
from __future__ import annotations

import numpy as np
from scipy import signal

from ..config import FILTER_XFADE_S, SR


# --------------------------------------------------------------------------- enveloppes

def ramp(n: int, kind: str = "lin") -> np.ndarray:
    """Rampe 0 -> 1 de n échantillons (lin, eqp = puissance constante, exp)."""
    if n <= 0:
        return np.zeros(0)
    t = (np.arange(n) + 0.5) / n
    if kind == "eqp":
        return np.sin(0.5 * np.pi * t)
    if kind == "exp":
        return (np.exp(4 * t) - 1) / (np.exp(4) - 1)
    return t


def fade_in(x: np.ndarray, start: int, n: int, kind: str = "lin") -> None:
    """Fondu d'entrée en place sur x[start:start+n] ; silence avant `start`."""
    start = max(0, start)
    x[:start] = 0
    n = min(n, len(x) - start)
    if n > 0:
        x[start:start + n] *= ramp(n, kind)[:, None]


def fade_out(x: np.ndarray, end: int, n: int, kind: str = "lin") -> None:
    """Fondu de sortie en place se terminant à `end` ; silence après `end`."""
    end = min(len(x), max(0, end))
    x[end:] = 0
    a = max(0, end - n)
    if end > a:
        x[a:end] *= ramp(end - a, kind)[::-1][:, None]


def ms(t: float, sr: int = SR) -> int:
    return int(round(t * sr))


# --------------------------------------------------------------------------- filtres

def biquad(kind: str, fc: float, q: float, sr: int = SR) -> tuple[np.ndarray, np.ndarray]:
    """Coefficients RBJ (Audio EQ Cookbook) normalisés."""
    fc = float(np.clip(fc, 10.0, 0.45 * sr))
    w0 = 2 * np.pi * fc / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = np.array([(1 - cw) / 2, 1 - cw, (1 - cw) / 2])
    elif kind == "hp":
        b = np.array([(1 + cw) / 2, -(1 + cw), (1 + cw) / 2])
    else:
        raise ValueError(kind)
    a = np.array([1 + alpha, -2 * cw, 1 - alpha])
    return b / a[0], a / a[0]


def sweep_filter(x: np.ndarray, kind: str, f_start: float, f_end: float, q: float = 2.0,
                 sr: int = SR, block: int = 128, xfade_s: float = FILTER_XFADE_S) -> np.ndarray:
    """Filtre résonant dont la coupure balaie (exponentiellement) de f_start à f_end.

    Mise à jour des coefficients tous les `block` échantillons, état conservé entre blocs.
    Fondu enchaîné sec -> filtré au début et filtré -> sec à la fin pour éviter tout clic.
    """
    n = len(x)
    y = np.empty_like(x, dtype=np.float64)
    zi = np.zeros((2, x.shape[1]))
    nblocks = int(np.ceil(n / block))
    for k in range(nblocks):
        a0, a1 = k * block, min(n, (k + 1) * block)
        frac = (a0 + a1) / 2 / max(1, n)
        fc = f_start * (f_end / f_start) ** frac
        b, a = biquad(kind, fc, q, sr)
        y[a0:a1], zi = signal.lfilter(b, a, x[a0:a1], axis=0, zi=zi)
    nx = min(int(xfade_s * sr), n // 4)
    if nx > 0:
        r = ramp(nx, "eqp")[:, None]
        y[:nx] = x[:nx] * np.sqrt(1 - r ** 2) + y[:nx] * r
        if f_end_is_transparent(kind, f_end):
            # filtre grand ouvert en fin de balayage : retour au signal sec sans discontinuité
            y[-nx:] = y[-nx:] * np.sqrt(1 - r ** 2) + x[-nx:] * r
        # sinon le signal est déjà en train de s'éteindre (fondu de volume géré par l'appelant)
    return y


def f_end_is_transparent(kind: str, f_end: float) -> bool:
    return (kind == "lp" and f_end >= 15000) or (kind == "hp" and f_end <= 25)


def split_bands(x: np.ndarray, fc: float = 150.0, sr: int = SR) -> tuple[np.ndarray, np.ndarray]:
    """Séparation graves/reste à phase nulle ; low + high == x exactement (reconstruction parfaite)."""
    sos = signal.butter(4, fc, "low", fs=sr, output="sos")
    low = signal.sosfiltfilt(sos, x, axis=0)
    return low, x - low


def split_3(x: np.ndarray, f_lo: float = 150.0, f_hi: float = 2500.0, sr: int = SR):
    """Graves / médiums / aigus à phase nulle ; la somme redonne exactement x (comme les EQ d'une table de mixage)."""
    low, rest = split_bands(x, f_lo, sr)
    sos = signal.butter(4, f_hi, "low", fs=sr, output="sos")
    mid = signal.sosfiltfilt(sos, rest, axis=0)
    return low, mid, rest - mid


def static_filter(x: np.ndarray, kind: str, fc: float, order: int = 2, sr: int = SR) -> np.ndarray:
    sos = signal.butter(order, fc, "low" if kind == "lp" else "high", fs=sr, output="sos")
    return signal.sosfilt(sos, x, axis=0)


# --------------------------------------------------------------------------- effets

def tempo_delay(send: np.ndarray, delay_n: float, feedback: float, total_n: int,
                hp: float = 250.0, lp: float = 7000.0, sr: int = SR) -> np.ndarray:
    """Delay calé sur le tempo : répétitions de `send` tous les `delay_n` échantillons
    (positions arrondies sans accumulation d'erreur), chaque répétition filtrée un peu plus."""
    out = np.zeros((total_n, send.shape[1]))
    tap = send.astype(np.float64)
    gain = 1.0
    k = 1
    while True:
        pos = int(round(k * delay_n))
        gain *= feedback
        if pos >= total_n or gain < 0.01:
            break
        tap = static_filter(static_filter(tap, "hp", hp, 1, sr), "lp", lp, 1, sr)
        m = min(len(tap), total_n - pos)
        out[pos:pos + m] += gain * tap[:m]
        k += 1
    return out


def reverb_ir(rt60: float, sr: int = SR, seed: int = 7) -> np.ndarray:
    """Réponse impulsionnelle synthétique stéréo (bruit décorrélé à décroissance exponentielle,
    amortissement des aigus progressif)."""
    rng = np.random.default_rng(seed)
    n = int(rt60 * sr)
    t = np.arange(n) / sr
    decay = np.exp(-6.9 * t / rt60)
    ir = rng.standard_normal((n, 2)) * decay[:, None]
    # amortissement : on mélange une version passe-bas qui domine en fin de queue
    lp = signal.sosfilt(signal.butter(1, 2500, "low", fs=sr, output="sos"), ir, axis=0)
    w = np.clip(t / rt60 * 2, 0, 1)[:, None]
    ir = (1 - w) * ir + w * lp
    pre = int(0.012 * sr)  # pré-délai
    ir = np.concatenate([np.zeros((pre, 2)), ir])
    ir[pre:pre + 64] *= ramp(64)[:, None]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverb(send: np.ndarray, rt60: float, total_n: int, sr: int = SR) -> np.ndarray:
    ir = reverb_ir(rt60, sr)
    mono = send.mean(axis=1) if send.ndim == 2 else send
    wet = np.stack([signal.oaconvolve(mono, ir[:, c]) for c in range(2)], 1)
    wet = static_filter(wet, "hp", 180.0, 2, sr)
    out = np.zeros((total_n, 2))
    m = min(total_n, len(wet))
    out[:m] = wet[:m]
    return out


def riser(n: int, level: float, sr: int = SR, seed: int = 3) -> np.ndarray:
    """Montée : bruit blanc dans un passe-haut résonant qui monte + sinus en glissando, volume croissant."""
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal((n, 2)) * 0.5
    noise = sweep_filter(noise, "hp", 300.0, 7000.0, q=4.0, sr=sr, block=256, xfade_s=0.0)
    t = np.arange(n) / sr
    f = 180.0 * (1200.0 / 180.0) ** (t / max(t[-1], 1e-6))
    tone = 0.25 * np.sin(2 * np.pi * np.cumsum(f) / sr)
    x = noise + tone[:, None]
    env = ramp(n, "exp")[:, None] * 0.97 + 0.03
    x = x * env
    peak = np.sqrt(np.mean(x[-max(1, n // 8):] ** 2)) + 1e-12
    return x * (level / peak)


def rewind(source: np.ndarray, end_idx: int, out_n: int, speed_start: float = 1.0,
           speed_end: float = 5.0) -> np.ndarray:
    """Lecture à l'envers qui accélère : part de `end_idx` dans `source` et recule,
    la vitesse passant de speed_start à speed_end (effet « rewind » de platine)."""
    t = np.arange(out_n) / max(1, out_n - 1)
    speed = speed_start + (speed_end - speed_start) * t ** 2
    pos = end_idx - np.cumsum(speed)
    pos = np.clip(pos, 0, len(source) - 1)
    idx = np.arange(len(source))
    out = np.stack([np.interp(pos, idx, source[:, c]) for c in range(source.shape[1])], 1)
    # un léger passe-bas qui se ferme renforce l'effet « vinyle »
    return out
