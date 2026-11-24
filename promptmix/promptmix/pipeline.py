"""Orchestration des 4 modules pour une tâche : analyse -> plan -> rendu -> master + contrôles."""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Callable

from .analysis.analyze import TrackAnalysis, analyze_track
from .analysis.key import parse_key
from .audio_io import decode
from .master.export import master_and_export
from .plan.planner import make_plan
from .plan.schema import normalize_plan, overlap_bars, timeline
from .render.engine import render
from .verify import verify

log = logging.getLogger(__name__)
Progress = Callable[[float, str], None]


def fmt_time(s: float) -> str:
    s = max(0, int(round(s)))
    return f"{s // 60:02d}:{s % 60:02d}"


def analyze_job(job_dir: Path, tracks: list[dict], progress: Progress) -> list[dict]:
    """tracks : [{track_id, path, original_name}]"""
    out = []
    for i, t in enumerate(tracks):
        progress(0.05 + 0.9 * i / len(tracks), f"Analyse de « {t['original_name']} » ({i + 1}/{len(tracks)})")
        an = analyze_track(t["path"], t["track_id"], t["original_name"])
        out.append(an.to_dict())
    (job_dir / "analysis.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    return out


def apply_corrections(job_dir: Path, tracks: list[dict], analyses: list[dict], corrections: dict,
                      audios: dict, progress: Progress) -> list[TrackAnalysis]:
    """Corrections du DJ : BPM (version « sped up », demi/double tempo...) et tonalité."""
    result = []
    for t, a in zip(tracks, analyses):
        an = TrackAnalysis.from_dict(a)
        corr = corrections.get(str(t["track_id"])) or corrections.get(t["track_id"]) or {}
        bpm = corr.get("bpm")
        key_txt = (corr.get("key") or "").strip()
        if bpm and abs(float(bpm) - an.grid.bpm) > 0.05:
            progress(0.02, f"Nouvelle grille pour « {t['original_name']} » à {float(bpm):g} BPM")
            an = analyze_track(t["path"], t["track_id"], t["original_name"], audio=audios[t["track_id"]],
                               bpm_override=float(bpm), key_override=an.key if an.key_corrected else None)
        if key_txt and key_txt not in (an.key["name"], an.key["short"], an.key["camelot"]):
            k = parse_key(key_txt)
            if k is None:
                raise ValueError(f"Tonalité non reconnue : « {key_txt} » (ex. Am, F#, 8A, La mineur)")
            an.key, an.key_corrected = k, True
        result.append(an)
    (job_dir / "analysis.json").write_text(json.dumps([a.to_dict() for a in result], ensure_ascii=False, indent=1))
    return result


def mix_job(job_dir: Path, tracks: list[dict], analyses: list[dict], prompt: str, corrections: dict,
            progress: Progress, max_duration_s: float | None = None) -> dict:
    t_start = time.time()
    progress(0.01, "Décodage des fichiers")
    audios = {t["track_id"]: decode(t["path"]) for t in tracks}
    ans = apply_corrections(job_dir, tracks, analyses, corrections or {}, audios, progress)
    by_id = {a.track_id: a for a in ans}

    progress(0.04, "Plan de mix (Claude)")
    plan, planner_name = make_plan(prompt, ans)
    (job_dir / "plan_brut.json").write_text(plan.model_dump_json(indent=1))
    paid_limit_note = None
    if max_duration_s and plan.target_duration_s > max_duration_s:
        paid_limit_note = (f"durée ramenée de {fmt_time(plan.target_duration_s)} à {fmt_time(max_duration_s)} "
                           f"(crédits utilisés pour ce mix)")
        plan.target_duration_s = float(max_duration_s)
    plan, tail_s, warnings = normalize_plan(plan, {a.track_id: a.grid.n_bars for a in ans})
    if paid_limit_note:
        warnings.insert(0, paid_limit_note)
    (job_dir / "plan.json").write_text(plan.model_dump_json(indent=1))

    def sub(lo, hi):
        return lambda f, msg: progress(lo + (hi - lo) * f, msg)

    rr = render(plan, tail_s, by_id, audios, progress=sub(0.08, 0.7))
    progress(0.72, "Master : sonie -11 LUFS, limiteur true peak, export MP3 320 kbps")
    out = job_dir / "mix.mp3"
    comment = " | ".join(f"{fmt_time(t['start_s'])} {t['display']}" for t in rr.tracklist)
    master_report = master_and_export(rr.mix, out, tags={"title": "PromptMix", "artist": "PromptMix",
                                                          "comment": comment[:250]})
    progress(0.9, "Contrôles : durée, true peak, alignement des temps")
    checks = verify(out, plan, rr, by_id)

    tl = timeline(plan)
    transitions = []
    for k, t in enumerate(plan.transitions):
        J = tl[k + 1]["mix_start_s"]
        transitions.append({"index": k + 1, "type": t.type, "length_bars": t.length_bars,
                            "overlap_bars": overlap_bars(t), "at_s": round(J, 2), "at": fmt_time(J),
                            "position_bar": tl[k + 1]["mix_start_bar"]})
    tracklist_txt = "\n".join(f"{fmt_time(t['start_s'])}  {t['display']}" for t in rr.tracklist)
    (job_dir / "tracklist.txt").write_text(
        f"PromptMix — {fmt_time(plan.target_duration_s)} — {plan.target_bpm:g} BPM\n\n{tracklist_txt}\n")
    result = {
        "planner": planner_name, "plan": json.loads(plan.model_dump_json()), "warnings": warnings,
        "tracklist": [{**t, "start": fmt_time(t["start_s"]), "end": fmt_time(t["end_s"])} for t in rr.tracklist],
        "tracklist_text": tracklist_txt, "transitions": transitions, "segment_gains_db": rr.segment_gains_db,
        "master": master_report, "checks": checks, "render_seconds": round(time.time() - t_start, 1),
    }
    (job_dir / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    return result
