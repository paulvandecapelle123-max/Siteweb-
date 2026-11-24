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

# --------------------------------------------------------------------------- crédits et paiement
# PROMPTMIX_BILLING=on : compte obligatoire, chaque mix consomme des crédits achetés par carte (Stripe).
# Sans cette variable (développement local), tout est gratuit et sans compte.
BILLING = os.environ.get("PROMPTMIX_BILLING", "off").lower() in ("1", "on", "true", "oui")
PUBLIC_URL = os.environ.get("PROMPTMIX_PUBLIC_URL", "http://localhost:8000").rstrip("/")
SITE_URL = os.environ.get("PROMPTMIX_SITE_URL", "").rstrip("/")          # site vitrine (liens CGV)
WELCOME_CREDITS = int(os.environ.get("PROMPTMIX_WELCOME_CREDITS", "1"))  # premier mix offert
SECONDS_PER_CREDIT = 600                                                 # 1 crédit = un mix jusqu'à 10 min
# STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET : dans l'environnement uniquement, jamais dans le code.
# Packs proposés (prix en centimes d'euro). Modifiables sans toucher au code via PROMPTMIX_PACKS (JSON).
DEFAULT_PACKS = [
    {"id": "pack5", "name": "Pack 5 mix", "credits": 5, "price_cents": 699},
    {"id": "pack15", "name": "Pack 15 mix", "credits": 15, "price_cents": 1799},
    {"id": "pack40", "name": "Pack 40 mix", "credits": 40, "price_cents": 3999},
]
