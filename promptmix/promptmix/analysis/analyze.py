"""Module 1 — Analyse complète d'un morceau."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..audio_io import TrackTags, decode, read_tags
from ..config import SR
from .beats import BeatGrid, detect_grid
from .key import detect_key
from .sections import detect_sections


@dataclass
class TrackAnalysis:
    track_id: int
    filename: str
    tags: TrackTags
    grid: BeatGrid
    key: dict
    sections: dict
    bpm_corrected: bool = False
    key_corrected: bool = False

    def to_dict(self) -> dict:
        return {
            "track_id": self.track_id, "filename": self.filename,
            "artist": self.tags.artist, "title": self.tags.title, "display": self.tags.display,
            "tag_source": self.tags.source,
            "duration_s": round(self.grid.duration, 2),
            "bpm": round(self.grid.bpm, 3), "bpm_corrected": self.bpm_corrected,
            "key": self.key, "key_corrected": self.key_corrected,
            "grid": self.grid.to_dict(), "sections": self.sections,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "TrackAnalysis":
        return cls(track_id=d["track_id"], filename=d["filename"],
                   tags=TrackTags(d["artist"], d["title"], d["tag_source"]),
                   grid=BeatGrid.from_dict(d["grid"]), key=d["key"], sections=d["sections"],
                   bpm_corrected=d.get("bpm_corrected", False), key_corrected=d.get("key_corrected", False))

    def summary_for_planner(self) -> dict:
        """Résumé compact envoyé à Claude (positions en mesures)."""
        g = self.grid
        return {
            "track_id": self.track_id, "titre": self.tags.display, "bpm": round(g.bpm, 2),
            "tonalite": f'{self.key["name"]} ({self.key["camelot"]})',
            "duree_s": round(g.duration, 1), "nb_mesures": g.n_bars,
            "duree_mesure_s_au_tempo_original": round(g.bar_s, 3),
            "sections": [f'{s["label"]}: mesures {s["start_bar"]}–{s["start_bar"] + s["length_bars"] - 1}'
                         for s in self.sections.get("sections", [])],
            "debuts_de_drop": self.sections.get("drops", []),
            "reprises_grosse_caisse": self.sections.get("kick_returns", []),
        }


def analyze_track(path: str | Path, track_id: int, original_name: str, audio: np.ndarray | None = None,
                  bpm_override: float | None = None, key_override: dict | None = None,
                  engine: str | None = None) -> TrackAnalysis:
    if audio is None:
        audio = decode(path)
    grid = detect_grid(audio, SR, engine=engine, bpm_override=bpm_override)
    key = key_override or detect_key(audio)
    sections = detect_sections(audio, grid)
    return TrackAnalysis(track_id, original_name, read_tags(path, original_name), grid, key, sections,
                         bpm_corrected=bpm_override is not None, key_corrected=key_override is not None)
