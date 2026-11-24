import numpy as np
import pytest

from promptmix.analysis.key import detect_key, parse_key

SR = 44100


def chord_track(freqs_list, dur=2.0):
    out = []
    for freqs in freqs_list:
        t = np.arange(int(dur * SR)) / SR
        x = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) for f in freqs)
        out.append(x * np.exp(-t))
    x = np.concatenate(out) * 0.1
    return np.stack([x, x], 1)


def test_a_minor():
    A, C, E, D, F, G, B = 220.0, 261.63, 329.63, 293.66, 349.23, 392.0, 246.94
    prog = [(A, C, E), (D, F, A), (E, G * 1.0595, B), (A, C, E)] * 3   # Am Dm E Am (sol# dans E)
    k = detect_key(chord_track(prog))
    assert k["name"] == "La mineur" and k["camelot"] == "8A"


@pytest.mark.parametrize("txt,name", [("Am", "La mineur"), ("8A", "La mineur"), ("F#m", "Fa# mineur"),
                                      ("C", "Do majeur"), ("la mineur", "La mineur"), ("Bb", "Si♭ majeur"),
                                      ("11B", "La majeur")])
def test_parse_key(txt, name):
    assert parse_key(txt)["name"] == name


def test_parse_key_invalid():
    assert parse_key("banane") is None
