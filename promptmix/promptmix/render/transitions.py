"""Les transitions. Chacune modifie en place la couche sortante A et la couche entrante B,
et peut renvoyer des « queues » d'effet (échos, réverb, riser) à ajouter sur la ligne de temps.

Conventions :
- J = échantillon (ligne de temps) où démarre B ; B.t0 == J ; aJ = J - A.t0 est l'indice de J dans A ;
- pour les types à chevauchement, A continue jusqu'à J + overlap ;
- toute coupe reçoit un fondu de quelques ms (aucun clic), un blackout un fondu >= 30 ms.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..config import BLACKOUT_FADE_S, CLICK_FADE_S, SR
from ..plan.schema import Transition
from . import dsp


@dataclass
class Layer:
    audio: np.ndarray        # (n, 2) float64
    t0: int                  # position (échantillon) sur la ligne de temps
    track_id: int
    index: int

    @property
    def end(self) -> int:
        return self.t0 + len(self.audio)


@dataclass
class Ctx:
    bar_n: float
    beat_n: float
    sr: int = SR


FxTail = tuple[int, np.ndarray]   # (position ligne de temps, audio)

CLICK = int(CLICK_FADE_S * SR)


def _overlap(t: Transition, A: Layer, B: Layer, J: int, c: Ctx) -> tuple[int, int]:
    """(aJ, n) : indice de J dans A et longueur commune du chevauchement, robuste aux arrondis d'échantillon."""
    aJ = J - A.t0
    n = min(int(round(t.length_bars * c.bar_n)), len(A.audio) - aJ, len(B.audio))
    A.audio = A.audio[: aJ + n]
    return aJ, n


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2)) + 1e-9)


def _cut_a_at(A: Layer, idx: int, fade_n: int = CLICK) -> None:
    """Coupe A à l'indice local `idx` avec un fondu qui se termine exactement là."""
    dsp.fade_out(A.audio, idx, fade_n)
    A.audio = A.audio[: max(idx, 0)]


# --------------------------------------------------------------------------- types à chevauchement

def t_fondu(t: Transition, A: Layer, B: Layer, J: int, c: Ctx) -> list[FxTail]:
    aJ, n = _overlap(t, A, B, J, c)
    A.audio[aJ:aJ + n] *= dsp.ramp(n, "eqp")[::-1][:, None]
    A.audio = A.audio[: aJ + n]
    B.audio[:n] *= dsp.ramp(n, "eqp")[:, None]
    return []


def _filter_pair(t, A, B, J, c, a_kind, a_f, b_kind, b_f, q):
    aJ, n = _overlap(t, A, B, J, c)
    seg = A.audio[aJ:aJ + n]
    seg[:] = dsp.sweep_filter(seg, a_kind, a_f[0], a_f[1], q=q)
    # A s'éteint sur le dernier quart du balayage
    q4 = max(1, n // 4)
    seg[-q4:] *= dsp.ramp(q4, "eqp")[::-1][:, None]
    A.audio = A.audio[: aJ + n]
    headb = B.audio[:n]
    headb[:] = dsp.sweep_filter(headb, b_kind, b_f[0], b_f[1], q=1.2)
    headb[:q4] *= dsp.ramp(q4, "eqp")[:, None]
    return []


def t_filtre_passe_haut(t, A, B, J, c):
    # A monte dans un passe-haut résonant ; B s'ouvre (passe-bas 300 Hz -> 20 kHz)
    return _filter_pair(t, A, B, J, c, "hp", (30.0, 2000.0), "lp", (300.0, 20000.0), q=3.0)


def t_filtre_passe_bas(t, A, B, J, c):
    # A se ferme dans un passe-bas résonant ; B arrive par les aigus (passe-haut 1,2 kHz -> 20 Hz)
    return _filter_pair(t, A, B, J, c, "lp", (20000.0, 180.0), "hp", (1200.0, 20.0), q=3.0)


def t_bass_swap(t, A, B, J, c):
    """Chevauchement complet ; B sans basses, échange des basses net sur le premier temps `swap_bar`."""
    aJ, n = _overlap(t, A, B, J, c)
    sw = int(round((t.swap_bar or t.length_bars // 2) * c.bar_n))
    xs = int(0.008 * c.sr)  # échange en 8 ms, centré juste avant le premier temps
    a_seg, b_seg = A.audio[aJ:aJ + n], B.audio[:n]
    a_lo, a_hi = dsp.split_bands(a_seg)
    b_lo, b_hi = dsp.split_bands(b_seg)
    # gain des basses de A : 1 jusqu'au swap, puis 0 ; celles de B : l'inverse
    g = np.ones(n)
    s0 = max(0, sw - xs)
    g[s0:sw] = dsp.ramp(sw - s0)[::-1]
    g[sw:] = 0
    # médiums/aigus : B monte sur la 1re moitié, A descend après le swap
    gb_hi = np.ones(n)
    gb_hi[:sw] = dsp.ramp(sw, "eqp")
    ga_hi = np.ones(n)
    ga_hi[sw:] = dsp.ramp(n - sw, "eqp")[::-1]
    a_seg[:] = a_lo * g[:, None] * ga_hi[:, None] + a_hi * ga_hi[:, None]
    b_seg[:] = b_lo * (1 - g)[:, None] + b_hi * gb_hi[:, None]
    A.audio = A.audio[: aJ + n]
    dsp.fade_out(A.audio, len(A.audio), CLICK)
    return []


# --------------------------------------------------------------------------- types sans chevauchement

def t_echo_out(t, A, B, J, c):
    aJ = J - A.t0
    beat = int(round(c.beat_n))
    send = A.audio[aJ - beat:aJ].copy()
    send[:CLICK] *= dsp.ramp(CLICK)[:, None]
    send[-CLICK:] *= dsp.ramp(CLICK)[::-1][:, None]
    total = int(round(t.length_bars * c.bar_n)) + beat
    tail = dsp.tempo_delay(send, 0.75 * c.beat_n, feedback=0.55, total_n=total)
    dsp.fade_out(tail, len(tail), int(min(len(tail) // 3, c.bar_n)))
    _cut_a_at(A, aJ)
    return [(J - beat, tail * 0.9)]


def t_riser_drop(t, A, B, J, c):
    aJ = J - A.t0
    n = int(round(t.length_bars * c.bar_n))
    a0 = max(0, aJ - n)
    seg = A.audio[a0:aJ]
    seg[:] = dsp.sweep_filter(seg, "hp", 25.0, 900.0, q=1.5)
    level = _rms(seg) * 1.4
    r = dsp.riser(aJ - a0, level)
    dsp.fade_out(r, len(r), CLICK)      # coupure nette sur le drop, sans clic
    _cut_a_at(A, aJ)
    dsp.fade_in(B.audio, 0, int(0.002 * c.sr))
    return [(A.t0 + a0, r)]


def t_rewind(t, A, B, J, c):
    aJ = J - A.t0
    d = int(round(2 * c.beat_n))
    start = aJ - d
    src = A.audio[: start].copy()
    rw = dsp.rewind(src, len(src) - 1, d)
    rw[:CLICK] *= dsp.ramp(CLICK)[:, None]
    dsp.fade_out(rw, len(rw), int(0.015 * c.sr))
    # petite rampe de volume pour accompagner l'accélération
    rw *= np.linspace(1.0, 0.8, len(rw))[:, None]
    _cut_a_at(A, start)
    return [(A.t0 + start, rw)]


def t_loop_roll(t, A, B, J, c):
    aJ = J - A.t0
    n = int(round(t.length_bars * c.bar_n))
    a0 = aJ - n
    stage_n = n / 4
    out = np.zeros((n, 2))
    edge = int(0.002 * c.sr)
    for k in range(4):
        s0, s1 = int(round(k * stage_n)), int(round((k + 1) * stage_n))
        loop_len = int(round(c.beat_n / (2 ** (k + 1))))
        sl = A.audio[a0 + s0:a0 + s0 + loop_len].copy()
        e = min(edge, loop_len // 4)
        sl[:e] *= dsp.ramp(e)[:, None]
        sl[-e:] *= dsp.ramp(e)[::-1][:, None]
        reps = int(np.ceil((s1 - s0) / loop_len))
        out[s0:s1] = np.tile(sl, (reps, 1))[: s1 - s0]
    A.audio[a0:aJ] = out
    _cut_a_at(A, aJ)
    return []


def t_blackout(t, A, B, J, c):
    aJ = J - A.t0
    beat = int(round(c.beat_n))
    _cut_a_at(A, aJ - beat, int(BLACKOUT_FADE_S * c.sr))
    dsp.fade_in(B.audio, 0, int(0.002 * c.sr))
    return []


def t_reverb_out(t, A, B, J, c):
    aJ = J - A.t0
    bar = int(round(c.bar_n))
    send = A.audio[max(0, aJ - bar):aJ].copy()
    send *= dsp.ramp(len(send), "exp")[:, None]  # on « ouvre » l'envoi sur la dernière mesure
    rt = float(np.clip(t.length_bars * c.bar_n / c.sr, 1.5, 6.0))
    total = len(send) + int(rt * c.sr)
    wet = dsp.reverb(send, rt, total)
    wet *= _rms(A.audio[max(0, aJ - bar):aJ]) / (_rms(wet[len(send) - bar // 2: len(send) + bar // 2]) + 1e-9) * 0.7
    dsp.fade_out(wet, len(wet), int(0.3 * c.sr))
    _cut_a_at(A, aJ)
    return [(J - len(send), wet)]


def t_coupe(t, A, B, J, c):
    _cut_a_at(A, J - A.t0)
    return []


TRANSITIONS = {
    "fondu": t_fondu, "filtre_passe_haut": t_filtre_passe_haut, "filtre_passe_bas": t_filtre_passe_bas,
    "bass_swap": t_bass_swap, "echo_out": t_echo_out, "riser_drop": t_riser_drop, "rewind": t_rewind,
    "loop_roll": t_loop_roll, "blackout": t_blackout, "reverb_out": t_reverb_out, "coupe": t_coupe,
}


def apply_transition(t: Transition, A: Layer, B: Layer, J: int, c: Ctx) -> list[FxTail]:
    return TRANSITIONS[t.type](t, A, B, J, c)


# --------------------------------------------------------------------------- début / fin du mix

def apply_intro(kind: str, L: Layer, c: Ctx) -> None:
    dsp.fade_in(L.audio, 0, int(2 * c.bar_n) if kind == "fondu" else CLICK, "eqp" if kind == "fondu" else "lin")


def apply_ending(kind: str, L: Layer, music_end: int, total_n: int, c: Ctx) -> list[FxTail]:
    """`music_end` : fin de la dernière mesure (ligne de temps) ; `total_n` : durée finale exacte."""
    e = music_end - L.t0
    end_local = total_n - L.t0
    if kind == "fondu":
        n = int(min(4 * c.bar_n, e)) + (end_local - e)
        L.audio = L.audio[:end_local]
        dsp.fade_out(L.audio, end_local, n, "eqp")
        return []
    if kind == "coupe":
        _cut_a_at(L, e)
        return []
    fake = Transition(type="reverb_out" if kind == "reverb_out" else "echo_out", length_bars=8)
    tail_n = total_n - music_end
    if kind == "reverb_out":
        fx = t_reverb_out(fake, L, Layer(np.zeros((1, 2)), music_end, -1, -1), music_end, c)
    else:
        fx = t_echo_out(fake, L, Layer(np.zeros((1, 2)), music_end, -1, -1), music_end, c)
    out = []
    for pos, a in fx:
        a = a[: total_n - pos].copy()
        # la queue s'éteint exactement à la fin du mix
        dsp.fade_out(a, len(a), int(min(len(a), max(tail_n * 0.6, 0.3 * c.sr))), "eqp")
        out.append((pos, a))
    return out
