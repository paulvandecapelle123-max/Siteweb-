"""Tonalité (profils de Krumhansl-Kessler sur un chromagramme) + notation Camelot."""
from __future__ import annotations

import numpy as np
from scipy import signal

from ..config import SR
from .beats import to_mono

NOTES_FR = ["Do", "Do#", "Ré", "Mi♭", "Mi", "Fa", "Fa#", "Sol", "La♭", "La", "Si♭", "Si"]
NOTES_EN = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
# Camelot : index = tonique (0 = C)
CAMELOT_MAJ = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"]
CAMELOT_MIN = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"]


def chroma(audio: np.ndarray, sr: int = SR) -> np.ndarray:
    x = to_mono(audio)
    x = signal.resample_poly(x, 1, 4)  # 11 025 Hz
    fs = sr / 4
    f, _, Z = signal.stft(x, fs=fs, nperseg=4096, noverlap=2048)
    mag = np.log1p(100 * np.abs(Z))
    sel = (f > 60) & (f < 2000)
    pc = np.mod(np.round(12 * np.log2(f[sel] / 261.6256)), 12).astype(int)
    c = np.zeros(12)
    np.add.at(c, pc, mag[sel].sum(axis=1))
    return c / (c.sum() + 1e-12)


def detect_key(audio: np.ndarray, sr: int = SR) -> dict:
    c = chroma(audio, sr)
    best = None
    for tonic in range(12):
        for mode, prof in (("majeur", MAJOR), ("mineur", MINOR)):
            r = np.corrcoef(c, np.roll(prof, tonic))[0, 1]
            if best is None or r > best[0]:
                best = (r, tonic, mode)
    r, tonic, mode = best
    return key_info(tonic, mode, float(r))


def key_info(tonic: int, mode: str, confidence: float = 1.0) -> dict:
    camelot = (CAMELOT_MAJ if mode == "majeur" else CAMELOT_MIN)[tonic]
    return {"tonic": tonic, "mode": mode, "name": f"{NOTES_FR[tonic]} {mode}",
            "short": NOTES_EN[tonic] + ("m" if mode == "mineur" else ""), "camelot": camelot,
            "confidence": round(confidence, 3)}


def parse_key(text: str) -> dict | None:
    """Accepte « Am », « F#m », « C », « 8A », « La mineur »..."""
    t = text.strip()
    if not t:
        return None
    up = t.upper()
    for i in range(12):
        if up == CAMELOT_MAJ[i]:
            return key_info(i, "majeur")
        if up == CAMELOT_MIN[i]:
            return key_info(i, "mineur")
    low = t.lower().replace("♭", "b")
    mode = "mineur" if (low.endswith("m") and not low.endswith("maj")) or "min" in low else "majeur"
    head = low.replace("mineur", "").replace("majeur", "").replace("minor", "").replace("major", "").strip()
    if head.endswith("m"):
        head = head[:-1]
    fr = {n.lower().replace("♭", "b"): i for i, n in enumerate(NOTES_FR)}
    fr.update({"reb": 1, "ré#": 3, "re": 2, "réb": 1, "fa#": 6, "solb": 6, "sol#": 8, "lab": 8, "la#": 10, "sib": 10})
    en = {n.lower(): i for i, n in enumerate(NOTES_EN)}
    en.update({"db": 1, "d#": 3, "gb": 6, "g#": 8, "a#": 10})
    head = head.strip()
    if head in fr:
        return key_info(fr[head], mode)
    if head in en:
        return key_info(en[head], mode)
    return None
