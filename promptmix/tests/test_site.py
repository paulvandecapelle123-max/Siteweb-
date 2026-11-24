"""Le site vitrine publie le même lexique que l'appli."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from export_lexique import OUT, build  # noqa: E402


def test_site_lexique_is_up_to_date():
    assert OUT.read_text(encoding="utf-8") == build(), "relancer : python tools/export_lexique.py"


def test_site_files_present():
    pub = ROOT / "site" / "public"
    for f in ("index.html", "style.css", "main.js", "404.html", "mentions-legales.html", "confidentialite.html", "_headers"):
        assert (pub / f).exists(), f
