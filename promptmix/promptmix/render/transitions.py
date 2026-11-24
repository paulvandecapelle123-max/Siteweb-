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


# --------------------------------------------------------------------------- techniques avancées

def rhythm_steps(x: np.ndarray, beat_n: float, sr: int = SR, steps_per_beat: int = 4) -> list[int]:
    """Motif rythmique d'une mesure : indices des doubles-croches (0..15) qui portent une attaque."""
    from ..analysis.beats import band_envelopes, to_mono
    bar = int(round(4 * beat_n))
    seg = x[:bar]
    if len(seg) < bar // 2 or _rms(seg) < 1e-5:
        return [0, 4, 8, 12]
    envs, env_sr = band_envelopes(to_mono(seg).astype(np.float64), sr)
    env = envs["full"] + envs["low"]
    vals = []
    for k in range(4 * steps_per_beat):
        c = int(k * beat_n / steps_per_beat / sr * env_sr)
        w = max(2, int(0.012 * env_sr))
        vals.append(env[max(0, c - w): c + w + 1].max() if c < len(env) else 0.0)
    vals = np.asarray(vals)
    steps = [k for k in range(len(vals)) if vals[k] >= 0.35 * vals.max()]
    return steps if 0 in steps else [0] + steps


def _slice(src: np.ndarray, a: int, n: int, edge: int) -> np.ndarray:
    sl = src[a:a + n].copy()
    e = min(edge, max(1, len(sl) // 4))
    sl[:e] *= dsp.ramp(e)[:, None]
    sl[-e:] *= dsp.ramp(e)[::-1][:, None]
    return sl


def t_loop_morph(t, A, B, J, c):
    """Boucle qui se transforme : un ½ temps de la fin du sortant est bouclé (½ puis ¼ de temps),
    puis redéclenché sur le motif rythmique de l'entrant pendant que celui-ci monte en dessous."""
    steps = rhythm_steps(B.audio, c.beat_n, c.sr)        # rythme de l'entrant (avant modification)
    aJ, n = _overlap(t, A, B, J, c)
    n1 = int(round(n / 2 / c.bar_n)) * int(round(c.bar_n)) or n // 2   # phase 1 = première moitié, en mesures entières
    edge = int(0.002 * c.sr)
    src_n = int(round(c.beat_n / 2))
    sl = _slice(A.audio, aJ, src_n, edge)
    out = np.zeros((n, 2))
    # phase 1 : boucle de ½ temps puis ¼ de temps
    half = n1 // 2
    for a0, a1, ln in ((0, half, src_n), (half, n1, max(1, src_n // 2))):
        piece = sl[:ln].copy()
        e = min(edge, ln // 4)
        piece[-e:] *= dsp.ramp(e)[::-1][:, None]
        reps = int(np.ceil((a1 - a0) / ln))
        out[a0:a1] = np.tile(piece, (reps, 1))[: a1 - a0]
    # phase 2 : le même bout de son rejoue le rythme du morceau entrant
    step_n = c.beat_n / 4
    bar = 0
    while True:
        base = n1 + bar * c.bar_n
        if base >= n:
            break
        trig = [int(round(base + k * step_n)) for k in steps]
        for i, p0 in enumerate(trig):
            if p0 >= n:
                break
            nxt = trig[i + 1] if i + 1 < len(trig) else int(round(base + c.bar_n))
            ln = min(src_n, nxt - p0, n - p0, int(round(step_n)))  # coups courts : le rythme de l'entrant s'entend
            if ln <= 2 * edge:
                continue
            hit = sl[:ln].copy() * np.exp(-np.arange(ln) / (0.6 * ln))[:, None]
            hit[-edge:] *= dsp.ramp(edge)[::-1][:, None]
            out[p0:p0 + ln] += hit
        bar += 1
    n2 = n - n1
    out[n1:] *= np.linspace(1.0, 0.35, n2)[:, None]
    dsp.fade_out(out, n, int(0.01 * c.sr))
    A.audio[aJ:aJ + n] = out
    # l'entrant : silencieux en phase 1, puis monte en s'ouvrant (passe-haut qui descend)
    head = B.audio[:n]
    head[:n1] = 0
    rest = head[n1:]
    rest[:] = dsp.sweep_filter(rest, "hp", 900.0, 20.0, q=0.9)
    rest *= dsp.ramp(len(rest), "eqp")[:, None]
    return []


def t_tape_stop(t, A, B, J, c):
    """Arrêt de platine : vitesse (et hauteur) qui tombent à zéro sur 2 temps."""
    aJ = J - A.t0
    d = int(round(2 * c.beat_n))
    start = aJ - d
    tt = np.arange(d) / d
    speed = (1 - tt) ** 1.6
    pos = start + np.cumsum(speed)
    idx = np.arange(len(A.audio))
    fx = np.stack([np.interp(pos, idx, A.audio[:, ch]) for ch in range(2)], 1)
    fx = dsp.sweep_filter(fx, "lp", 18000.0, 400.0, q=0.7, xfade_s=0.0)
    fx[:CLICK] *= dsp.ramp(CLICK)[:, None]
    dsp.fade_out(fx, len(fx), int(0.03 * c.sr))
    _cut_a_at(A, start + CLICK)
    return [(A.t0 + start, fx)]


def t_double_drop(t, A, B, J, c):
    """Double drop : les deux drops ensemble, basses de l'entrant seulement, le sortant s'efface sur la dernière mesure."""
    aJ, n = _overlap(t, A, B, J, c)
    a_seg = A.audio[aJ:aJ + n]
    a_lo, a_hi = dsp.split_bands(a_seg)
    xs = int(0.008 * c.sr)
    g_lo = np.zeros(n)
    g_lo[:xs] = dsp.ramp(xs)[::-1]
    g_hi = np.full(n, 0.8)
    last = min(n, int(round(c.bar_n)))
    g_hi[n - last:] *= dsp.ramp(last, "eqp")[::-1]
    a_seg[:] = a_lo * g_lo[:, None] + a_hi * g_hi[:, None]
    return []


def t_eq_3_bandes(t, A, B, J, c):
    """Mix aux EQ : aigus de l'entrant, puis ses médiums, bass swap au milieu sur un premier temps,
    puis sortie des médiums et des aigus du sortant."""
    aJ, n = _overlap(t, A, B, J, c)
    sw = min(n - 1, int(round((t.swap_bar or t.length_bars // 2) * c.bar_n)))
    a_seg, b_seg = A.audio[aJ:aJ + n], B.audio[:n]
    a_lo, a_mi, a_hi = dsp.split_3(a_seg)
    b_lo, b_mi, b_hi = dsp.split_3(b_seg)

    def env(points):
        x = np.array([p for p, _ in points], float) * n
        return np.interp(np.arange(n), x, [v for _, v in points])

    q = sw / n
    b_hi_g = env([(0, 0), (q / 2, 1), (1, 1)])
    b_mi_g = env([(0, 0), (q / 2, 0), (q, 1), (1, 1)])
    a_mi_g = env([(0, 1), (q, 1), (q + (1 - q) / 2, 0), (1, 0)])
    a_hi_g = env([(0, 1), (q + (1 - q) / 2, 1), (1, 0)])
    xs = int(0.008 * c.sr)
    a_lo_g = np.ones(n)
    a_lo_g[max(0, sw - xs):sw] = dsp.ramp(sw - max(0, sw - xs))[::-1]
    a_lo_g[sw:] = 0
    b_lo_g = 1 - a_lo_g
    a_seg[:] = a_lo * a_lo_g[:, None] + a_mi * a_mi_g[:, None] + a_hi * a_hi_g[:, None]
    b_seg[:] = b_lo * b_lo_g[:, None] + b_mi * b_mi_g[:, None] + b_hi * b_hi_g[:, None]
    dsp.fade_out(A.audio, len(A.audio), CLICK)
    return []


GATE_PATTERN = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]


def t_trance_gate(t, A, B, J, c):
    """Sortant haché en doubles-croches (dernière mesure en triples-croches), puis l'entrant démarre."""
    aJ = J - A.t0
    n = int(round(t.length_bars * c.bar_n))
    a0 = max(0, aJ - n)
    g = np.zeros(aJ - a0)
    edge = int(0.003 * c.sr)
    # construction pas à pas : doubles-croches, puis triples-croches sur la dernière mesure
    pos, step_i = 0.0, 0
    total = aJ - a0
    while pos < total:
        in_last = pos >= total - c.bar_n
        step = c.beat_n / (8 if in_last else 4)
        on = (step_i % 2 == 0) if in_last else GATE_PATTERN[step_i % 16]
        s0, s1 = int(round(pos)), min(total, int(round(pos + step)))
        if on and s1 - s0 > 2 * edge:
            g[s0:s1] = 1
            g[s0:s0 + edge] = dsp.ramp(edge)
            g[s1 - edge:s1] = dsp.ramp(edge)[::-1]
        pos += step
        step_i += 1
    A.audio[a0:aJ] *= g[:, None]
    _cut_a_at(A, aJ)
    return []


def snare_hit(sr: int = SR, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(0.12 * sr)
    tt = np.arange(n) / sr
    noise = rng.standard_normal(n)
    noise = dsp.static_filter(np.stack([noise, noise], 1), "hp", 1200.0, 2, sr)[:, 0]
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 40)
    x = (0.7 * noise * np.exp(-tt * 28) + 0.6 * body)
    x[:32] *= dsp.ramp(32)
    return np.stack([x, x], 1)


def t_build_roll(t, A, B, J, c):
    """Roulement de caisse claire : noires, croches, doubles puis triples-croches, volume croissant, puis drop."""
    aJ = J - A.t0
    n = int(round(t.length_bars * c.bar_n))
    a0 = max(0, aJ - n)
    seg = A.audio[a0:aJ]
    seg[:] = dsp.sweep_filter(seg, "hp", 25.0, 500.0, q=1.2)
    roll = np.zeros((aJ - a0, 2))
    hit = snare_hit(c.sr)
    hit /= np.abs(hit).max()
    level = _rms(seg) * 3.0
    quarter = (aJ - a0) / 4
    for qi, div in enumerate((1, 2, 4, 8)):
        step = c.beat_n / div
        p = qi * quarter
        while p < (qi + 1) * quarter - 1:
            i = int(round(p))
            vel = 0.35 + 0.65 * (i / max(1, aJ - a0))
            m = min(len(hit), len(roll) - i)
            roll[i:i + m] += hit[:m] * vel * level
            p += step
    dsp.fade_out(roll, len(roll), CLICK)
    _cut_a_at(A, aJ)
    dsp.fade_in(B.audio, 0, int(0.002 * c.sr))
    return [(A.t0 + a0, roll)]


TRANSITIONS = {
    "fondu": t_fondu, "filtre_passe_haut": t_filtre_passe_haut, "filtre_passe_bas": t_filtre_passe_bas,
    "bass_swap": t_bass_swap, "echo_out": t_echo_out, "riser_drop": t_riser_drop, "rewind": t_rewind,
    "loop_roll": t_loop_roll, "blackout": t_blackout, "reverb_out": t_reverb_out, "coupe": t_coupe,
    "loop_morph": t_loop_morph, "tape_stop": t_tape_stop, "double_drop": t_double_drop,
    "eq_3_bandes": t_eq_3_bandes, "trance_gate": t_trance_gate, "build_roll": t_build_roll,
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
    if kind == "tape_stop":
        L.audio = L.audio[:e]
        fx = t_tape_stop(Transition(type="tape_stop", length_bars=1), L, Layer(np.zeros((1, 2)), music_end, -1, -1),
                         music_end, c)
        return fx
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
