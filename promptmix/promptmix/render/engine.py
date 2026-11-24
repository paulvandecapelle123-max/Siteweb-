"""Module 3 — Moteur de rendu déterministe : exécute un plan normalisé, sans IA."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from ..analysis.analyze import TrackAnalysis
from ..audio_io import time_stretch
from ..config import SEGMENT_LUFS, SR
from ..master.loudness import equalize_segment
from ..plan.schema import MixPlan, overlap_bars, timeline
from . import dsp
from .transitions import CLICK, Ctx, Layer, apply_ending, apply_intro, apply_transition

PRE_S = 1.0     # marge avant/après chaque extrait pour Rubber Band (effets de bord)
POST_S = 1.0


@dataclass
class RenderResult:
    mix: np.ndarray
    total_n: int
    bar_n: float
    raw_layers: list[Layer]                       # extraits étirés et égalisés, avant transitions
    junctions: list[int]                          # J de chaque transition (échantillons)
    tracklist: list[dict] = field(default_factory=list)
    segment_gains_db: list[float] = field(default_factory=list)


def extract_segment(audio: np.ndarray, an: TrackAnalysis, start_bar: int, length_bars: int,
                    target_bpm: float, extra_after_s: float, sr: int = SR) -> np.ndarray:
    """Extrait [start_bar, start_bar+length_bars) + `extra_after_s` (temps cible), étiré au tempo cible.
    L'échantillon 0 du résultat tombe exactement sur le premier temps de la mesure `start_bar`."""
    g = an.grid
    ratio = target_bpm / g.bpm
    src0 = int(round(g.bar_time(start_bar) * sr))
    pre = int(PRE_S * sr)
    src_len = int(round(length_bars * g.bar_s * sr + (extra_after_s * ratio + POST_S) * sr))
    a, b = src0 - pre, src0 + src_len
    chunk = np.zeros((b - a, 2), np.float32)
    ia, ib = max(a, 0), min(b, len(audio))
    if ib > ia:
        chunk[ia - a: ib - a] = audio[ia:ib]
    st = time_stretch(chunk, ratio)
    off = int(round(pre / ratio))
    out_len = int(round((length_bars * 240.0 / target_bpm + extra_after_s) * sr))
    seg = st[off: off + out_len].astype(np.float64)
    if len(seg) < out_len:
        seg = np.concatenate([seg, np.zeros((out_len - len(seg), 2))])
    return seg


def render(plan: MixPlan, tail_s: float, analyses: dict[int, TrackAnalysis], audios: dict[int, np.ndarray],
           progress: Callable[[float, str], None] | None = None, sr: int = SR) -> RenderResult:
    progress = progress or (lambda *_: None)
    bar_n = 240.0 / plan.target_bpm * sr
    c = Ctx(bar_n=bar_n, beat_n=bar_n / 4, sr=sr)
    tl = timeline(plan)
    music_bars = tl[-1]["mix_end_bar"]
    music_end = int(round(music_bars * bar_n))
    total_n = int(round(plan.target_duration_s * sr))
    total_n = max(total_n, music_end + 1)

    layers: list[Layer] = []
    gains = []
    n_seg = len(plan.segments)
    for i, (s, pos) in enumerate(zip(plan.segments, tl)):
        progress(0.05 + 0.55 * i / n_seg, f"Calage du tempo : extrait {i + 1}/{n_seg} (Rubber Band)")
        last = i == n_seg - 1
        extra = (total_n - music_end) / sr + 0.05 if last else 0.0
        seg = extract_segment(audios[s.track_id], analyses[s.track_id], s.start_bar, s.length_bars,
                              plan.target_bpm, extra, sr)
        body = int(round(s.length_bars * bar_n))
        _, gdb = equalize_segment(seg[:body], SEGMENT_LUFS)
        seg *= 10 ** (gdb / 20)
        gains.append(round(gdb, 2))
        layers.append(Layer(seg, int(round(pos["mix_start_bar"] * bar_n)), s.track_id, i))
    raw = [Layer(L.audio.copy(), L.t0, L.track_id, L.index) for L in layers]

    # anti-clic par défaut aux deux bouts de chaque extrait
    for L in layers:
        dsp.fade_in(L.audio, 0, CLICK)
        dsp.fade_out(L.audio, len(L.audio), CLICK)

    progress(0.62, "Transitions")
    fx_tails = []
    junctions = []
    for k, t in enumerate(plan.transitions):
        A, B = layers[k], layers[k + 1]
        J = B.t0
        junctions.append(J)
        # A s'arrête à J + chevauchement (sa longueur nominale)
        A.audio = A.audio[: J + int(round(overlap_bars(t) * bar_n)) - A.t0]
        fx_tails += apply_transition(t, A, B, J, c)
    apply_intro(plan.intro, layers[0], c)
    fx_tails += apply_ending(plan.ending, layers[-1], music_end, total_n, c)

    progress(0.75, "Mixage")
    mix = np.zeros((total_n, 2))
    for L in layers:
        a, b = L.t0, min(L.end, total_n)
        if b > a:
            mix[a:b] += L.audio[: b - a]
    for pos, fx in fx_tails:
        a, b = max(pos, 0), min(pos + len(fx), total_n)
        if b > a:
            mix[a:b] += fx[a - pos: b - pos]
    # derniers millisecondes : fondu de sécurité
    dsp.fade_out(mix, total_n, CLICK)

    tracklist = []
    for i, (s, pos) in enumerate(zip(plan.segments, tl)):
        an = analyses[s.track_id]
        end_s = (layers[i].t0 + len(layers[i].audio)) / sr
        tracklist.append({
            "index": i + 1, "track_id": s.track_id, "display": an.tags.display, "artist": an.tags.artist,
            "title": an.tags.title, "start_s": round(pos["mix_start_s"], 2), "end_s": round(min(end_s, total_n / sr), 2),
            "src_start_s": round(an.grid.bar_time(s.start_bar), 2), "src_start_bar": s.start_bar,
            "length_bars": s.length_bars, "original_bpm": round(an.grid.bpm, 2),
            "stretch_pct": round((plan.target_bpm / an.grid.bpm - 1) * 100, 2), "key": an.key["name"],
            "camelot": an.key["camelot"],
            "transition_out": plan.transitions[i].type if i < len(plan.transitions) else plan.ending,
        })
    return RenderResult(mix=mix, total_n=total_n, bar_n=bar_n, raw_layers=raw, junctions=junctions,
                        tracklist=tracklist, segment_gains_db=gains)
