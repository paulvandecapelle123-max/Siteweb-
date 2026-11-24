"""Exporte le lexique des techniques DJ vers le site vitrine (site/public/lexique.json).

À relancer après toute modification de promptmix/plan/lexique.py :
    python tools/export_lexique.py
(un test vérifie que le fichier publié est à jour).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from promptmix.plan.lexique import GLOSSAIRE, TECHNIQUES  # noqa: E402

OUT = ROOT / "site" / "public" / "lexique.json"
KEEP = ("id", "famille", "nom", "synonymes", "simple", "quand", "mesures")


def build() -> str:
    data = {"techniques": [{k: t[k] for k in KEEP} for t in TECHNIQUES], "glossaire": GLOSSAIRE}
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"écrit : {OUT.relative_to(ROOT)}")
