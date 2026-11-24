"""Contrôles après chaque rendu : durée, true peak (sur le MP3 décodé), sonie, alignement des temps."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .analysis.analyze import TrackAnalysis
from .analysis.beats import measure_phase
from .audio_io import decode
from .config import BEAT_ALIGN_TOLERANCE_S, DURATION_TOLERANCE_S, SR, TARGET_LUFS, TRUE_PEAK_MAX_DBTP
from .master.loudness import lufs, true_peak_dbtp
from .plan.schema import MixPlan, overlap_bars
from .render.engine import RenderResult


def _circ(d: float, p: float) -> float:
    return ((d + p / 2) % p) - p / 2


def _bass_bars(an: TrackAnalysis, start_bar: int, length: int) -> list[bool]:
    db = an.sections.get("bass_db") or []
    return [(start_bar + i < len(db) and db[start_bar + i] > -9.0) for i in range(length)]


def _pick_window(flags: list[bool], lo: int, hi: int, from_end: bool, n: int = 2) -> tuple[int, int] | None:
    """Fenêtre de `n` mesures avec grosse caisse/basse, la plus proche de la transition.
    Les parties sans attaques graves (break, charleys seuls sur les contretemps) donnent une phase trompeuse."""
    rng = range(hi - n, lo - 1, -1) if from_end else range(lo, hi - n + 1)
    for a in rng:
        if 0 <= a and a + n <= len(flags) and all(flags[a:a + n]):
            return a, a + n
    return None


def beat_alignment(plan: MixPlan, rr: RenderResult, analyses: dict[int, TrackAnalysis] | None = None,
                   sr: int = SR) -> list[dict]:
    """Pour chaque transition, mesure la phase des temps de l'extrait sortant et de l'entrant par rapport
    à la grille du mix (temps = multiples de la période). La mesure se fait sur les mesures de la transition
    qui ont des attaques graves ; à défaut, sur les plus proches (jusqu'à 16 mesures), le tempo étant constant."""
    period = 60.0 / plan.target_bpm
    out = []
    for k, (t, J) in enumerate(zip(plan.transitions, rr.junctions)):
        A, B = rr.raw_layers[k], rr.raw_layers[k + 1]
        sa, sb = plan.segments[k], plan.segments[k + 1]
        ovb = overlap_bars(t)
        res = {"transition": k + 1, "type": t.type}
        a_end = sa.length_bars                       # en mesures, relatif au début de l'extrait A
        j_bar = sa.length_bars - ovb                 # jonction dans A
        specs = [("sortant", A, sa, max(0, j_bar - 16), a_end, True, (max(0, j_bar - 2), a_end)),
                 ("entrant", B, sb, 0, min(sb.length_bars, max(ovb, 2) + 16), False, (0, max(2, ovb)))]
        for name, L, seg, lo, hi, from_end, default in specs:
            win = None
            if analyses is not None:
                flags = _bass_bars(analyses[seg.track_id], seg.start_bar, seg.length_bars)
                win = _pick_window(flags, default[0], default[1], from_end) or _pick_window(flags, lo, hi, from_end)
            win = win or default
            i0, i1 = int(round(win[0] * rr.bar_n)), min(len(L.audio), int(round(win[1] * rr.bar_n)))
            ph, src, conf = measure_phase(L.audio[i0:i1], period, sr)
            abs_phase = (L.t0 + i0) / sr + ph
            res[f"ecart_{name}_ms"] = round(1000 * _circ(abs_phase, period), 1)
            res[f"confiance_{name}"] = round(conf, 2)
            res[f"mesures_{name}"] = f"{win[0]}–{win[1] - 1}"
        measurable = min(res["confiance_sortant"], res["confiance_entrant"]) >= 0.3
        diff = abs(_circ((res["ecart_sortant_ms"] - res["ecart_entrant_ms"]) / 1000, period))
        res["ecart_entre_morceaux_ms"] = round(1000 * diff, 1)
        res["ok"] = bool(not measurable) or (diff <= BEAT_ALIGN_TOLERANCE_S and
                                              abs(res["ecart_entrant_ms"]) <= 1000 * BEAT_ALIGN_TOLERANCE_S)
        res["mesurable"] = bool(measurable)
        out.append(res)
    return out


def verify(mp3_path: str | Path, plan: MixPlan, rr: RenderResult,
           analyses: dict[int, TrackAnalysis] | None = None) -> dict:
    audio = decode(mp3_path)
    dur = len(audio) / SR
    tp = true_peak_dbtp(audio)
    lo = lufs(audio)
    align = beat_alignment(plan, rr, analyses)
    checks = {
        "duree": {"demande_s": round(plan.target_duration_s, 2), "obtenu_s": round(dur, 3),
                  "ok": bool(abs(dur - plan.target_duration_s) <= DURATION_TOLERANCE_S)},
        "true_peak": {"dbtp": round(tp, 2), "max": TRUE_PEAK_MAX_DBTP, "ok": bool(tp <= TRUE_PEAK_MAX_DBTP)},
        "sonie": {"lufs": round(lo, 2), "cible": TARGET_LUFS, "ok": bool(abs(lo - TARGET_LUFS) <= 1.0)},
        "alignement": {"transitions": align, "ok": all(a["ok"] for a in align)},
    }
    checks["ok"] = bool(all(v["ok"] for v in checks.values() if isinstance(v, dict)))
    return checks
