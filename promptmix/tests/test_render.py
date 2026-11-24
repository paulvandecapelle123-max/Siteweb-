"""Rendu complet (plan -> rendu -> master -> MP3) et contrôles exigés après chaque rendu."""
import numpy as np
import pytest

from promptmix.config import TRUE_PEAK_MAX_DBTP
from promptmix.master.export import master_and_export
from promptmix.plan.schema import MixPlan, normalize_plan
from promptmix.render.engine import render
from promptmix.verify import verify

# les 11 transitions réparties sur 4 rendus (+ toutes les fins)
CASES = [
    (["fondu", "bass_swap"], "fondu", "fondu", 70.0),
    (["filtre_passe_haut", "filtre_passe_bas"], "reverb_out", "direct", 75.5),
    (["echo_out", "riser_drop", "rewind"], "echo_out", "direct", 80.0),
    (["loop_roll", "blackout", "reverb_out", "coupe"], "coupe", "fondu", 90.25),
    (["loop_morph", "eq_3_bandes", "double_drop"], "tape_stop", "direct", 85.0),
    (["trance_gate", "build_roll", "tape_stop"], "fondu", "direct", 80.0),
]


def build(types, ending, intro, dur, analyses):
    segs = [{"track_id": (i % 3) + 1, "start_bar": 32 if i else 4, "length_bars": 12} for i in range(len(types) + 1)]
    trans = [{"type": t, "length_bars": 8 if t == "eq_3_bandes" else 4} for t in types]
    plan = MixPlan(target_bpm=127.0, target_duration_s=dur, ending=ending, intro=intro, segments=segs, transitions=trans)
    return normalize_plan(plan, {k: a.grid.n_bars for k, a in analyses.items()})


@pytest.mark.parametrize("types,ending,intro,dur", CASES)
def test_render_checks(tmp_path, three_tracks, types, ending, intro, dur):
    analyses, audios = three_tracks
    plan, tail, warnings = build(types, ending, intro, dur, analyses)
    rr = render(plan, tail, analyses, audios)
    assert np.isfinite(rr.mix).all()
    out = tmp_path / "mix.mp3"
    rep = master_and_export(rr.mix, out)
    checks = verify(out, plan, rr, analyses)
    assert checks["duree"]["ok"], checks["duree"]                 # ±0,5 s
    assert checks["true_peak"]["dbtp"] <= TRUE_PEAK_MAX_DBTP        # <= -1 dBTP sur le MP3 décodé
    assert checks["sonie"]["ok"], checks["sonie"]                 # ~ -11 LUFS
    for a in checks["alignement"]["transitions"]:                 # temps alignés
        assert a["mesurable"] and a["ok"], a
    assert rep["mp3_true_peak_dbtp"] <= TRUE_PEAK_MAX_DBTP


@pytest.mark.parametrize("types,ending,intro,dur", CASES)
def test_no_clicks_at_junctions(three_tracks, types, ending, intro, dur):
    """Aucun saut d'échantillon anormal autour des coupes (fondus anti-clic)."""
    analyses, audios = three_tracks
    plan, tail, _ = build(types, ending, intro, dur, analyses)
    rr = render(plan, tail, analyses, audios)
    m = rr.mix.mean(axis=1)
    d = np.abs(np.diff(m))
    ref = np.percentile(d, 99.99)
    for J in rr.junctions:
        w = slice(max(0, J - 4410), J + 4410)
        assert d[w].max() <= 1.5 * ref + 1e-6
    assert abs(m[-1]) < 1e-3 and abs(m[0]) < 1e-3


@pytest.mark.parametrize("bpm", [119.3, 124.0, 126.7, 133.1])
@pytest.mark.parametrize("ttype", ["fondu", "bass_swap", "filtre_passe_haut", "filtre_passe_bas"])
def test_overlap_rounding(three_tracks, ttype, bpm):
    """Tempos « non ronds » : les longueurs en échantillons ne tombent pas juste, le rendu doit tenir."""
    analyses, audios = three_tracks
    segs = [{"track_id": 1, "start_bar": 4, "length_bars": 13}, {"track_id": 2, "start_bar": 32, "length_bars": 11}]
    plan = MixPlan(target_bpm=bpm, target_duration_s=40.3, segments=segs,
                   transitions=[{"type": ttype, "length_bars": 7}])
    plan, tail, _ = normalize_plan(plan, {k: a.grid.n_bars for k, a in analyses.items()})
    rr = render(plan, tail, analyses, audios)
    assert len(rr.mix) == round(40.3 * 44100)


def test_loop_morph_follows_incoming_rhythm(three_tracks):
    """La boucle du sortant est redéclenchée sur le motif rythmique de l'entrant."""
    from promptmix.render.transitions import Ctx, Layer, rhythm_steps, t_loop_morph
    from promptmix.plan.schema import Transition
    sr, bar_n = 44100, 240 / 125 * 44100
    c = Ctx(bar_n=bar_n, beat_n=bar_n / 4)
    # entrant : clics sur les doubles-croches 0, 3, 6, 10, 12 de chaque mesure
    pattern = [0, 3, 6, 10, 12]
    n = int(4 * bar_n)
    b = np.zeros((n, 2))
    for bar in range(4):
        for k in pattern:
            i = int(round(bar * bar_n + k * c.beat_n / 4))
            b[i:i + 300] += np.sin(np.arange(300) * 0.3)[:, None] * np.exp(-np.arange(300) / 60)[:, None]
    assert rhythm_steps(b, c.beat_n) == pattern
    a = np.random.default_rng(0).standard_normal((n, 2)) * 0.2   # sortant : son continu
    A, B = Layer(a.copy(), 0, 1, 0), Layer(b.copy(), int(2 * bar_n), 2, 1)
    t_loop_morph(Transition(type="loop_morph", length_bars=2), A, B, int(2 * bar_n), c)
    # phase 2 (dernière mesure) : le son du sortant n'est présent qu'aux pas du motif
    seg = A.audio[int(3 * bar_n): int(4 * bar_n)].mean(axis=1)
    step = c.beat_n / 4
    energy = [np.abs(seg[int(k * step) + 50: int(k * step) + 400]).mean() for k in range(16)]
    on = [k for k in range(16) if energy[k] > 0.3 * max(energy)]
    assert on == pattern
