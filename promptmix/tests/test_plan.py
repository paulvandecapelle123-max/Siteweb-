import math

import pytest
from pydantic import ValidationError

from promptmix.plan.planner import parse_duration_s, parse_order, plan_locally
from promptmix.plan.schema import MixPlan, normalize_plan, overlap_bars, timeline


def mk(**kw):
    base = dict(target_bpm=125, target_duration_s=180, segments=[
        {"track_id": 1, "start_bar": 8, "length_bars": 32}, {"track_id": 2, "start_bar": 16, "length_bars": 32},
        {"track_id": 3, "start_bar": 40, "length_bars": 32}],
        transitions=[{"type": "bass_swap", "length_bars": 8}, {"type": "riser_drop", "length_bars": 8}])
    base.update(kw)
    return MixPlan.model_validate(base)


def test_schema_rejects_unknown_transition():
    with pytest.raises(ValidationError):
        mk(transitions=[{"type": "scratch", "length_bars": 4}, {"type": "fondu", "length_bars": 4}])


@pytest.mark.parametrize("dur", [95.0, 180.0, 241.3, 300.0])
@pytest.mark.parametrize("ending", ["fondu", "reverb_out", "echo_out", "coupe"])
def test_normalize_hits_duration(dur, ending):
    p, tail, w = normalize_plan(mk(target_duration_s=dur, ending=ending), {1: 120, 2: 120, 3: 120})
    bars = sum(s.length_bars for s in p.segments) - sum(overlap_bars(t) for t in p.transitions)
    bar_s = 240 / p.target_bpm
    assert math.isclose(bars * bar_s + tail, dur, abs_tol=1e-6)
    assert 0 <= tail < bar_s + 3.0
    assert not w


def test_drop_start_is_pinned():
    """L'extrait qui entre après un riser commence sur son drop : la normalisation ne le déplace pas."""
    p, _, _ = normalize_plan(mk(target_duration_s=400), {1: 200, 2: 200, 3: 200})
    assert p.segments[2].start_bar == 40


def test_bass_swap_defaults_and_bounds():
    p, _, _ = normalize_plan(mk(), {1: 120, 2: 120, 3: 120})
    t = p.transitions[0]
    assert t.swap_bar == 4
    tl = timeline(p)
    assert tl[1]["mix_start_bar"] == p.segments[0].length_bars - 8


def test_segment_clamped_to_track():
    p, _, w = normalize_plan(mk(target_duration_s=60), {1: 30, 2: 120, 3: 120})
    s = p.segments[0]
    assert s.start_bar + s.length_bars <= 30
    assert w


def test_parsers():
    assert parse_duration_s("un mix de 5 minutes") == 300
    assert parse_duration_s("durée 3:30 max") == 210
    assert parse_duration_s("4 min 20") == 260
    assert parse_order("commence par le morceau 3 puis le morceau 1", 3) == [2, 0, 1]


def test_local_planner(three_tracks):
    analyses, _ = three_tracks
    plan = plan_locally("3 minutes, morceau 2 puis morceau 1 puis 3, bass swap puis blackout, fin en écho",
                        list(analyses.values()))
    assert [s.track_id for s in plan.segments] == [2, 1, 3]
    assert [t.type for t in plan.transitions] == ["bass_swap", "blackout"]
    assert plan.ending == "echo_out" and plan.target_duration_s == 180
    assert plan.segments[2].start_bar in analyses[3].sections["drops"]
