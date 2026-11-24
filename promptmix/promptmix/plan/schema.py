"""Schéma du plan de mix (validé par Pydantic) et normalisation déterministe.

Le plan décrit :
- `segments` : l'extrait choisi de chaque morceau, dans l'ordre de lecture (début et longueur en mesures,
  début toujours sur un premier temps de mesure) ;
- `transitions` : une par jonction (type, durée en mesures) ; leur position découle des extraits :
  l'extrait entrant démarre `overlap` mesures avant la fin de l'extrait sortant ;
- `target_bpm` : tempo commun du mix ; `target_duration_s` : durée totale.
"""
from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, Field

from .lexique import TECHNIQUES

TransitionType = Literal[
    "fondu", "bass_swap", "eq_3_bandes", "double_drop", "filtre_passe_haut", "filtre_passe_bas",
    "loop_morph", "loop_roll", "trance_gate", "echo_out", "reverb_out", "tape_stop", "rewind",
    "riser_drop", "build_roll", "blackout", "coupe",
]

# descriptions : source unique = le lexique DJ
TRANSITION_DOC = {t["id"]: t["dj"] for t in TECHNIQUES if t["id"]}

# types pour lesquels les deux extraits jouent ensemble pendant `length_bars` mesures
OVERLAP_TYPES = {"fondu", "filtre_passe_haut", "filtre_passe_bas", "bass_swap", "eq_3_bandes", "double_drop", "loop_morph"}
# types joués sur la fin du sortant (sans chevauchement) : l'extrait doit être assez long
TAIL_EFFECT_TYPES = {"riser_drop", "loop_roll", "trance_gate", "build_roll"}
# bornes (min, max) de length_bars par type
LENGTH_BOUNDS = {"loop_roll": (1, 2), "rewind": (1, 1), "tape_stop": (1, 1), "blackout": (1, 1), "coupe": (1, 1),
                 "trance_gate": (1, 4), "loop_morph": (2, 4), "build_roll": (2, 8), "double_drop": (2, 16),
                 "bass_swap": (2, 32), "eq_3_bandes": (4, 32)}


class Segment(BaseModel):
    track_id: int = Field(description="identifiant du morceau (track_id de l'analyse)")
    start_bar: int = Field(ge=0, description="mesure de début dans le morceau original (indice de mesure de l'analyse, commence à 0)")
    length_bars: int = Field(ge=4, description="longueur de l'extrait en mesures, chevauchements compris")
    reason: str = Field(default="", description="pourquoi cet extrait (en français, une phrase)")


class Transition(BaseModel):
    type: TransitionType
    length_bars: int = Field(ge=1, le=32, description="durée de l'effet en mesures ; pour les types à chevauchement c'est aussi la durée pendant laquelle les deux morceaux jouent ensemble")
    swap_bar: int | None = Field(default=None, description="bass_swap uniquement : mesure (à l'intérieur du chevauchement, à partir de 0) où les basses s'échangent ; par défaut le milieu")


class MixPlan(BaseModel):
    target_bpm: float = Field(gt=60, lt=200, description="tempo commun du mix")
    target_duration_s: float = Field(gt=20, lt=3600, description="durée totale souhaitée en secondes")
    intro: Literal["direct", "fondu"] = "direct"
    ending: Literal["fondu", "reverb_out", "echo_out", "tape_stop", "coupe"] = "fondu"
    segments: list[Segment] = Field(min_length=2, max_length=6)
    transitions: list[Transition] = Field(description="exactement len(segments) - 1 transitions, dans l'ordre")
    explanation: str = Field(default="", description="explication courte du mix, en français, pour le DJ")


def overlap_bars(t: Transition) -> int:
    return t.length_bars if t.type in OVERLAP_TYPES else 0


def min_tail_s(ending: str) -> float:
    return {"fondu": 0.0, "coupe": 0.15, "tape_stop": 0.3, "reverb_out": 2.5, "echo_out": 2.0}[ending]


class PlanError(ValueError):
    pass


def normalize_plan(plan: MixPlan, track_bars: dict[int, int]) -> tuple[MixPlan, float, list[str]]:
    """Rend le plan exécutable et cale la durée.

    - vérifie les identifiants, borne les extraits au morceau, limite les chevauchements ;
    - ajuste les longueurs (par blocs de 4 mesures puis à la mesure) pour que
      durée = mesures × durée_mesure + queue, la queue (fin) absorbant le reste à l'échantillon près.
    Retourne (plan, queue_s, avertissements).
    """
    warnings: list[str] = []
    p = plan.model_copy(deep=True)
    for s in p.segments:
        if s.track_id not in track_bars:
            raise PlanError(f"track_id inconnu : {s.track_id}")
    if len(p.transitions) != len(p.segments) - 1:
        if len(p.transitions) > len(p.segments) - 1:
            p.transitions = p.transitions[: len(p.segments) - 1]
        else:
            p.transitions += [Transition(type="fondu", length_bars=8)] * (len(p.segments) - 1 - len(p.transitions))
        warnings.append("nombre de transitions corrigé")

    def min_len(i: int) -> int:
        ov_in = overlap_bars(p.transitions[i - 1]) if i > 0 else 0
        ov_out = overlap_bars(p.transitions[i]) if i < len(p.transitions) else 0
        eff = p.transitions[i].length_bars if i < len(p.transitions) and p.transitions[i].type in TAIL_EFFECT_TYPES else 0
        return max(4, ov_in + max(ov_out, eff) + 1)

    for i, s in enumerate(p.segments):
        nb = track_bars[s.track_id]
        if s.start_bar >= nb - 4:
            s.start_bar = max(0, nb - 16)
            warnings.append(f"extrait {i + 1} : début ramené à la mesure {s.start_bar}")
        if s.start_bar + s.length_bars > nb:
            s.length_bars = nb - s.start_bar
            warnings.append(f"extrait {i + 1} : longueur bornée à {s.length_bars} mesures (fin du morceau)")
    for i, t in enumerate(p.transitions):
        lo, hi = LENGTH_BOUNDS.get(t.type, (1, 32))
        t.length_bars = max(lo, min(hi, t.length_bars))
        if t.type in OVERLAP_TYPES:
            room = min(p.segments[i].length_bars, p.segments[i + 1].length_bars) - 2
            if t.length_bars > room:
                t.length_bars = max(1, room)
                warnings.append(f"transition {i + 1} : chevauchement réduit à {t.length_bars} mesures")
        if t.type in ("bass_swap", "eq_3_bandes"):
            if t.swap_bar is None or not (1 <= t.swap_bar < t.length_bars):
                t.swap_bar = t.length_bars // 2

    bar_s = 240.0 / p.target_bpm
    tail_min = min_tail_s(p.ending)
    want = math.floor((p.target_duration_s - tail_min) / bar_s + 1e-9)

    # extraits dont le début est un repère imposé (drop) : on ne déplace jamais leur début
    pinned = {i + 1 for i, t in enumerate(p.transitions) if t.type not in OVERLAP_TYPES or t.type == "double_drop"}

    def total() -> int:
        return sum(s.length_bars for s in p.segments) - sum(overlap_bars(t) for t in p.transitions)

    # ajustement : d'abord des blocs de 4 mesures répartis, puis à la mesure sur le dernier extrait
    for step in (4, 1):
        guard = 0
        while total() != want and guard < 500:
            guard += 1
            diff = want - total()
            if abs(diff) < step and step == 4:
                break
            d = step if diff > 0 else -step
            # extrait le plus apte : de la marge dans le morceau (ajout) ou de la longueur (retrait)
            order = sorted(range(len(p.segments)), key=lambda i: (-p.segments[i].length_bars if d < 0 else p.segments[i].length_bars))
            if step == 1:
                order = list(reversed(range(len(p.segments))))
            done = False
            if d > 0:  # priorité : prolonger un extrait par sa fin
                for i in order:
                    s = p.segments[i]
                    if s.start_bar + s.length_bars + d <= track_bars[s.track_id]:
                        s.length_bars += d
                        done = True
                        break
            for i in ([] if done else order):
                s = p.segments[i]
                nb = track_bars[s.track_id]
                if d > 0 and s.start_bar + s.length_bars + d <= nb:
                    s.length_bars += d
                    done = True
                elif d > 0 and s.start_bar - d >= 0 and step == 4 and i not in pinned:
                    s.start_bar -= d
                    s.length_bars += d
                    done = True
                elif d < 0 and s.length_bars + d >= min_len(i):
                    s.length_bars += d
                    done = True
                if done:
                    break
            if not done:
                break
    tail = p.target_duration_s - total() * bar_s
    if total() != want:
        warnings.append("les morceaux sont trop courts (ou trop longs) pour la durée demandée : durée la plus proche possible")
        tail = max(tail_min, min(tail, tail_min + bar_s))
    return p, tail, warnings


def timeline(p: MixPlan) -> list[dict]:
    """Position de chaque extrait sur la ligne de temps du mix (en mesures et en secondes)."""
    bar_s = 240.0 / p.target_bpm
    out, pos = [], 0
    for i, s in enumerate(p.segments):
        out.append({"index": i, "track_id": s.track_id, "mix_start_bar": pos, "mix_start_s": pos * bar_s,
                    "mix_end_bar": pos + s.length_bars, "src_start_bar": s.start_bar, "length_bars": s.length_bars})
        if i < len(p.transitions):
            pos += s.length_bars - overlap_bars(p.transitions[i])
    return out
