"""Configuration centrale (lue dans l'environnement, jamais de secret dans le code)."""
from __future__ import annotations

import os
from pathlib import Path

SR = 44100                      # fréquence d'échantillonnage interne
CHANNELS = 2
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MIN_TRACKS, MAX_TRACKS = 2, 3
RETENTION_SECONDS = 24 * 3600   # suppression 24 h après le rendu

TARGET_LUFS = -11.0             # mix final
SEGMENT_LUFS = -14.0            # égalisation des extraits avant mixage
TRUE_PEAK_MAX_DBTP = -1.0       # contrainte vérifiée sur le MP3 décodé
LIMITER_CEILING_DBTP = -1.6     # marge pour l'encodeur MP3
MP3_BITRATE = "320k"

CLICK_FADE_S = 0.005            # fondu anti-clic à chaque coupe
BLACKOUT_FADE_S = 0.035         # >= 30 ms avant un blackout
FILTER_XFADE_S = 0.060          # fondu enchaîné sec/filtré en début et fin de filtre

DURATION_TOLERANCE_S = 0.5
BEAT_ALIGN_TOLERANCE_S = 0.020

MODEL = os.environ.get("PROMPTMIX_MODEL", "claude-opus-5-5")
BEAT_ENGINE = os.environ.get("PROMPTMIX_BEAT_ENGINE", "auto")
DATA_DIR = Path(os.environ.get("PROMPTMIX_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
