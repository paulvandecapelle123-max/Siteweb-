"""Module 4 — Mesures et traitements de sonie : LUFS (BS.1770), true peak, limiteur à anticipation."""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d

from ..config import SR

OVERSAMPLE = 4


def lufs(x: np.ndarray, sr: int = SR) -> float:
    if len(x) < int(0.5 * sr):
        x = np.concatenate([x, np.zeros((int(0.5 * sr) - len(x) + 1, x.shape[1]))])
    v = pyln.Meter(sr).integrated_loudness(np.asarray(x, dtype=np.float64))
    return float(v) if np.isfinite(v) else -120.0


def db(x: float) -> float:
    return float(20 * np.log10(max(float(x), 1e-12)))


def undb(d: float) -> float:
    return 10 ** (d / 20)


_TP_FIR = None


def _tp_fir(factor: int) -> np.ndarray:
    """Filtre d'interpolation 48 coefficients (12 par phase), comme l'annexe 2 de BS.1770-4."""
    global _TP_FIR
    if _TP_FIR is None or len(_TP_FIR) != 12 * factor:
        h = signal.firwin(12 * factor, 0.9 / factor, window=("kaiser", 7.0))
        _TP_FIR = (h * factor / h.sum()).astype(np.float32)
    return _TP_FIR


def oversampled_abs(x: np.ndarray, factor: int = OVERSAMPLE) -> np.ndarray:
    """|x| suréchantillonné ×4 (crêtes inter-échantillons), max des canaux, forme (n*factor,).
    Implémentation polyphase : 4 convolutions courtes par canal."""
    x = np.asarray(x, np.float32)
    n = len(x)
    h = _tp_fir(factor)
    taps = len(h) // factor
    delay = taps // 2
    out = np.zeros((n, factor), np.float32)
    for c in range(x.shape[1]):
        for p in range(factor):
            y = np.convolve(x[:, c], h[p::factor])[delay: delay + n]
            np.maximum(out[:, p], np.abs(y), out=out[:, p])
    return out.reshape(-1)


def true_peak_dbtp(x: np.ndarray) -> float:
    return db(float(oversampled_abs(x).max()))


def equalize_segment(x: np.ndarray, target_lufs: float, max_gain_db: float = 12.0) -> tuple[np.ndarray, float]:
    """Met un extrait au niveau `target_lufs` (gain borné). Retourne (audio, gain_dB)."""
    cur = lufs(x)
    if cur < -70:
        return x, 0.0
    g = float(np.clip(target_lufs - cur, -max_gain_db, max_gain_db))
    return x * undb(g), g


def limit(x: np.ndarray, ceiling_dbtp: float, lookahead_s: float = 0.005, release_s: float = 0.12,
          sr: int = SR, block: int = 32) -> np.ndarray:
    """Limiteur true peak à anticipation.

    Gain requis calculé sur le signal suréchantillonné (crêtes inter-échantillons comprises), minimum
    glissant centré (le gain commence à baisser `lookahead_s` avant le pic, sans retarder l'audio),
    lissage d'attaque par moyenne glissante, puis relâchement exponentiel.
    """
    ceil = undb(ceiling_dbtp)
    n = len(x)
    look = max(block, int(lookahead_s * sr))
    peaks = oversampled_abs(x).reshape(-1, OVERSAMPLE).max(axis=1)  # crête vraie par échantillon
    nb = int(np.ceil(n / block))
    pb = np.zeros(nb * block)
    pb[:n] = peaks
    blk_peak = pb.reshape(nb, block).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(blk_peak, 1e-12))
    lb = int(np.ceil(look / block))
    # minimum sur [k - lb, k + lb] : le gain descend avant et reste bas pendant le pic
    g = minimum_filter1d(need, size=2 * lb + 1, mode="nearest")
    # attaque : moyenne glissante ; on reprend le min pour ne jamais dépasser le besoin
    g = np.minimum(g, np.convolve(np.pad(g, (lb, lb), mode="edge"), np.ones(2 * lb + 1) / (2 * lb + 1), "valid"))
    g = np.minimum(g, need)
    # relâchement exponentiel (boucle sur blocs : ~30 000 itérations/minute d'audio)
    rel = np.exp(-block / (release_s * sr))
    out_g = np.empty_like(g)
    cur = 1.0
    for k in range(len(g)):
        tgt = g[k]
        cur = tgt if tgt < cur else tgt + (cur - tgt) * rel
        out_g[k] = cur
    # retour au taux d'échantillonnage (interpolation linéaire entre centres de blocs)
    centers = (np.arange(nb) + 0.5) * block
    gs = np.interp(np.arange(n), centers, out_g)
    # sécurité : l'interpolation ne doit jamais remonter au-dessus du besoin local
    gs = np.minimum(gs, np.repeat(minimum_filter1d(need, size=3, mode="nearest"), block)[:n])
    return x * gs[:, None]


def master(mix: np.ndarray, target_lufs: float, ceiling_dbtp: float, sr: int = SR) -> tuple[np.ndarray, dict]:
    """Gain vers la cible LUFS puis limiteur true peak ; 3 itérations pour compenser la perte de sonie due au limiteur."""
    x = np.asarray(mix, np.float64)
    report = {"lufs_in": round(lufs(x, sr), 2)}
    gain_db = target_lufs - report["lufs_in"]
    y = x
    for _ in range(3):
        y = limit(x * undb(gain_db), ceiling_dbtp, sr=sr)
        cur = lufs(y, sr)
        if abs(cur - target_lufs) < 0.15:
            break
        gain_db += float(np.clip(target_lufs - cur, -3, 6))
    # filet de sécurité (ne devrait pas agir) : écrêtage doux au plafond
    tp = true_peak_dbtp(y)
    if tp > ceiling_dbtp + 0.05:
        y = y * undb(ceiling_dbtp - tp)
    report.update({"gain_db": round(gain_db, 2), "lufs_out": round(lufs(y, sr), 2), "true_peak_dbtp": round(true_peak_dbtp(y), 2)})
    return y.astype(np.float32), report
