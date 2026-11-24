import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.synth import techno_track  # noqa: E402


def _has_beat_this() -> bool:
    try:
        import beat_this  # noqa: F401
        return True
    except Exception:
        return False


ENGINES = ["dsp"] + (["beat_this"] if _has_beat_this() else [])


@pytest.fixture(scope="session")
def three_tracks(tmp_path_factory):
    """3 pistes « techno » MP3 à tempos différents, analysées une fois pour toute la session."""
    from promptmix.analysis.analyze import analyze_track
    from promptmix.audio_io import decode, encode_mp3
    d = tmp_path_factory.mktemp("tracks")
    specs = [(124, 0.2, 55.0, (24, 32)), (128, 0.05, 61.7, (24, 32)), (131, 0.4, 49.0, (24, 32))]
    analyses, audios = {}, {}
    for i, (bpm, off, root, br) in enumerate(specs, start=1):
        a, _ = techno_track(bpm, 100, offset=off, breakdown=br, root_hz=root, seed=i)
        p = d / f"Artiste {i} - Titre {i}.mp3"
        encode_mp3(a * 0.5, p)
        audios[i] = decode(p)
        analyses[i] = analyze_track(p, i, p.name, audio=audios[i], engine="dsp")
    return analyses, audios
