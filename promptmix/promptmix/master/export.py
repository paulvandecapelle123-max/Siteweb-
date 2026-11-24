"""Master final + export MP3 320 kbps avec contrôle du true peak après encodage."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..audio_io import decode, encode_mp3
from ..config import LIMITER_CEILING_DBTP, MP3_BITRATE, TARGET_LUFS, TRUE_PEAK_MAX_DBTP
from .loudness import master, true_peak_dbtp


def master_and_export(mix: np.ndarray, out_path: str | Path, tags: dict[str, str] | None = None,
                      target_lufs: float = TARGET_LUFS) -> dict:
    """L'encodage MP3 peut faire remonter les crêtes de quelques dixièmes de dB : on mesure le true peak
    sur le fichier décodé et on resserre le plafond du limiteur tant que la limite n'est pas tenue."""
    ceiling = LIMITER_CEILING_DBTP
    report: dict = {}
    for attempt in range(4):
        y, report = master(mix, target_lufs, ceiling)
        encode_mp3(y, out_path, MP3_BITRATE, tags=tags)
        tp = true_peak_dbtp(decode(out_path))
        report.update({"ceiling_dbtp": ceiling, "mp3_true_peak_dbtp": round(tp, 2), "attempts": attempt + 1})
        if tp <= TRUE_PEAK_MAX_DBTP - 0.15:  # marge de sécurité
            break
        ceiling -= (tp - TRUE_PEAK_MAX_DBTP) + 0.3
    return report
