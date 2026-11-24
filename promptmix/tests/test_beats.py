"""Grille des temps sur des pistes de clics à tempo connu : précision exigée 10 ms."""
import numpy as np
import pytest

from promptmix.analysis.beats import detect_grid
from tests.conftest import ENGINES
from tests.synth import click_track, techno_track

TOL = 0.010


def max_grid_error(grid, true_beats):
    gb = grid.beats()
    inner = true_beats[2:-2]
    return max(abs(gb[np.argmin(np.abs(gb - b))] - b) for b in inner)


@pytest.mark.parametrize("engine", ENGINES)
@pytest.mark.parametrize("bpm,offset,downbeat", [(128, 0.137, 1), (174, 0.05, 2), (122.5, 0.31, 0),
                                                  (140, 1.0, 3), (95, 0.2, 0), (150.37, 0.0, 1)])
def test_click_grid_within_10ms(engine, bpm, offset, downbeat):
    audio, beats = click_track(bpm, 60, offset=offset, downbeat_index=downbeat)
    g = detect_grid(audio, engine=engine)
    assert abs(g.bpm - bpm) < 0.02, g.bpm
    assert max_grid_error(g, beats) <= TOL
    # premier temps de mesure = clic accentué
    k = int(round((beats[downbeat] - g.first_beat) / g.period))
    assert (k - g.downbeat_offset) % 4 == 0


@pytest.mark.parametrize("bpm,offset", [(124, 0.43), (131, 0.4), (174, 0.3)])
def test_syncopated_bass_does_not_shift_grid(bpm, offset):
    """La basse joue sur les 2e et 4e doubles-croches : la grille doit rester sur la grosse caisse."""
    audio, beats = techno_track(bpm, 60, offset=offset, syncopated_bass=True, offbeat_hats=True)
    g = detect_grid(audio, engine="dsp")
    assert max_grid_error(g, beats) <= TOL
    # le diagnostic montre que la basse seule était décalée
    assert abs(g.band_phases_ms["low"]) > 50


def test_bpm_override_sped_up():
    """Version « sped up » : l'utilisateur impose le BPM, la phase reste mesurée."""
    audio, beats = click_track(132.5, 40, offset=0.21)
    g = detect_grid(audio, engine="dsp", bpm_override=132.5)
    assert abs(g.bpm - 132.5) < 0.02
    assert max_grid_error(g, beats) <= TOL


def test_downbeat_from_bass_entries():
    """Sans accent : le premier temps est retrouvé grâce aux entrées/sorties de la basse (break)."""
    audio, beats = techno_track(126, 90, offset=0.3, breakdown=(16, 24))
    g = detect_grid(audio, engine="dsp")
    k = int(round((beats[0] - g.first_beat) / g.period))
    assert (k - g.downbeat_offset) % 4 == 0
