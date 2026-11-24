"""Module 2 — Plan de mix : prompt du DJ + résumé de l'analyse -> plan JSON validé (Pydantic).

Avec ANTHROPIC_API_KEY : appel à l'API Claude (sortie structurée = schéma MixPlan).
Sans clé : planificateur local par règles (mots-clés), pour développer et tester hors ligne.
"""
from __future__ import annotations

import json
import logging
import os
import re

from ..analysis.analyze import TrackAnalysis
from ..config import MODEL
from .lexique import TECHNIQUES, doc_for_prompt
from .schema import MixPlan, Segment, Transition

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es un DJ expert et ingénieur du son. Tu reçois la demande d'un DJ (en français) et \
l'analyse de 2 ou 3 morceaux. Tu produis un plan de mix exécuté ensuite par un moteur audio déterministe.

Règles du moteur :
- Tout est exprimé en mesures de 4 temps. `start_bar` est un indice de mesure de l'analyse (0 = première mesure \
complète du morceau). Le moteur cale chaque extrait sur un premier temps de mesure et étire tous les morceaux \
au `target_bpm` (Rubber Band, tonalité conservée).
- `segments` est dans l'ordre de lecture. Un même morceau peut revenir au plus une fois de plus si la demande le justifie.
- Il y a exactement une transition entre deux extraits consécutifs. Pour les types à chevauchement \
(fondu, filtre_passe_haut, filtre_passe_bas, bass_swap), l'extrait entrant démarre `length_bars` mesures avant la \
fin du sortant : `length_bars` de l'extrait compte ce chevauchement. Pour les autres types, l'entrant démarre \
exactement à la fin du sortant et l'effet se joue sur la fin du sortant (riser, loop roll, rewind, blackout) \
ou déborde sur le début de l'entrant (échos, queue de réverb).
- La durée totale est recalée automatiquement à la seconde près (ajustement de quelques mesures) : vise \
`target_duration_s` = durée demandée ; si aucune durée n'est demandée, choisis-en une raisonnable.

Bonnes pratiques :
- Choisis des extraits qui respectent les phrases musicales (8, 16, 32 mesures) et commencent sur un repère \
fiable : un début de drop ou une reprise de la grosse caisse après un break.
- riser_drop, build_roll, blackout, coupe : l'extrait entrant commence pile sur un drop (`debuts_de_drop`).
- double_drop : l'extrait entrant commence sur son drop ET les `length_bars` dernières mesures du sortant \
commencent sur un drop du sortant (choisis start_bar et length_bars du sortant en conséquence).
- bass_swap, eq_3_bandes et fondus longs : fais entrer le morceau suivant sur une intro ou une partie sans basse \
lourde, pendant que le sortant joue une partie stable ; 8 à 32 mesures.
- loop_morph : 2 à 4 mesures ; idéal quand les deux morceaux ont des rythmes différents.
- `target_bpm` : en général le tempo du premier morceau ou une valeur intermédiaire ; évite d'étirer un morceau \
de plus de ±8 % (au-delà le son se dégrade) sauf demande explicite.
- Tiens compte des tonalités (roue Camelot : même nombre, ±1, ou A↔B même nombre sont compatibles) pour \
choisir l'ordre et les passages où deux morceaux jouent ensemble (double_drop, fondus longs).
- Le DJ parle comme un DJ : interprète son vocabulaire (liste ci-dessous) et ses images (« le son devient fin », \
« comme sous l'eau », « ça bégaie », « la boucle prend le rythme du suivant »). S'il ne nomme aucune technique, \
choisis celles qui servent l'ambiance demandée et varie-les.
- Respecte en priorité les demandes explicites du DJ (ordre, durée, ambiance, techniques).
- `explanation` : 2 à 4 phrases en français qui expliquent tes choix au DJ, en nommant les techniques.

""" + doc_for_prompt()


class PlannerError(RuntimeError):
    pass


def build_user_message(prompt: str, analyses: list[TrackAnalysis]) -> str:
    summary = [a.summary_for_planner() for a in analyses]
    return (
        "Demande du DJ :\n<<<\n" + prompt.strip() + "\n>>>\n\n"
        "Analyse des morceaux (JSON) :\n" + json.dumps(summary, ensure_ascii=False, indent=1) +
        "\n\nProduis le plan de mix."
    )


def plan_with_claude(prompt: str, analyses: list[TrackAnalysis]) -> MixPlan:
    import anthropic

    client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY dans l'environnement
    try:
        response = client.beta.messages.parse(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",            # si le modèle refuse, l'API relance sur un modèle de repli
            thinking={"type": "adaptive"},
            output_config={"effort": os.environ.get("PROMPTMIX_EFFORT", "high")},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_user_message(prompt, analyses)}],
            output_format=MixPlan,
        )
    except anthropic.AuthenticationError as exc:
        raise PlannerError("Clé API Claude refusée (ANTHROPIC_API_KEY).") from exc
    except anthropic.RateLimitError as exc:
        raise PlannerError("API Claude saturée, réessaie dans un instant.") from exc
    except anthropic.APIStatusError as exc:
        raise PlannerError(f"Erreur API Claude ({exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        raise PlannerError("Impossible de joindre l'API Claude.") from exc
    if response.stop_reason == "refusal":
        raise PlannerError("La demande a été refusée par le modèle.")
    if response.stop_reason == "max_tokens":
        raise PlannerError("Réponse du modèle tronquée.")
    plan = response.parsed_output
    if plan is None:
        raise PlannerError("Le modèle n'a pas renvoyé de plan valide.")
    return plan


# --------------------------------------------------------------------------- repli local (sans API)

# reconnaissance des techniques dans le prompt (planificateur local) : générée depuis le lexique.
# Ordre : les motifs les plus spécifiques d'abord (« boucle qui devient le rythme… » avant « boucle »).
KEYWORDS = [(t["id"], t["regex"]) for t in TECHNIQUES if t["id"]]


def parse_duration_s(prompt: str) -> float | None:
    p = prompt.lower()
    m = re.search(r"(\d{1,2})\s*[:']\s*(\d{2})", p)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:min|minutes?|mn)\b(?:\s*(\d{1,2})\s*(?:s|sec|secondes?)?)?", p)
    if m:
        return float(m.group(1).replace(",", ".")) * 60 + (int(m.group(2)) if m.group(2) else 0)
    m = re.search(r"(\d+)\s*(?:s|sec|secondes?)\b", p)
    if m:
        return float(m.group(1))
    return None


def parse_order(prompt: str, n: int) -> list[int]:
    p = prompt.lower()
    found = [int(x) - 1 for x in re.findall(r"(?:morceau|piste|titre|track|fichier)\s*(?:n°|no|#)?\s*(\d)", p)]
    order = []
    for i in found:
        if 0 <= i < n and i not in order:
            order.append(i)
    return order + [i for i in range(n) if i not in order]


def plan_locally(prompt: str, analyses: list[TrackAnalysis]) -> MixPlan:
    """Planificateur par règles : ordre, durée, BPM et transitions lus dans le prompt."""
    n = len(analyses)
    by_id = {a.track_id: a for a in analyses}
    order = [analyses[i].track_id for i in parse_order(prompt, n)]
    duration = parse_duration_s(prompt) or 60.0 * (2 + n)
    m = re.search(r"(\d{2,3}(?:[.,]\d+)?)\s*bpm", prompt.lower())
    bpm = float(m.group(1).replace(",", ".")) if m else by_id[order[0]].grid.bpm
    text = prompt.lower()
    ending = "fondu"
    for sent in re.split(r"[.!?;,\n]", text):
        if re.search(r"\b(fin|finir|termine|terminer|finis)\b", sent):
            if re.search(r"r[ée]verb", sent):
                ending, text = "reverb_out", text.replace(sent, " ")
            elif re.search(r"[ée]cho", sent):
                ending, text = "echo_out", text.replace(sent, " ")
            elif re.search(r"tape ?stop|brake|ralenti", sent):
                ending, text = "tape_stop", text.replace(sent, " ")
            elif re.search(r"coupe", sent):
                ending, text = "coupe", text.replace(sent, " ")
            elif re.search(r"fondu|fade", sent):
                ending, text = "fondu", text.replace(sent, " ")
    # transitions dans l'ordre où elles apparaissent dans le texte
    matches = sorted(((m.start(), -(m.end() - m.start()), m.end(), t) for t, rx in KEYWORDS
                      for m in re.finditer(rx, text)), key=lambda r: (r[0], r[1]))
    wanted, last_end = [], -1
    for start, _, end, t in matches:   # une même expression ne compte qu'une fois (la plus longue)
        if start >= last_end:
            if not wanted or wanted[-1] != t:   # « étouffé, comme sous l'eau » = une seule technique
                wanted.append(t)
            last_end = end
    wanted = wanted or ["bass_swap", "filtre_passe_haut"]
    unavailable = [t["nom"] for t in TECHNIQUES if not t["id"] and re.search(t["regex"], text)]
    transitions = []
    for k in range(n - 1):
        t = wanted[k % len(wanted)]
        length = {"fondu": 8, "bass_swap": 8, "eq_3_bandes": 16, "double_drop": 8, "filtre_passe_haut": 8,
                  "filtre_passe_bas": 8, "echo_out": 4, "riser_drop": 8, "build_roll": 4, "loop_roll": 1,
                  "loop_morph": 2, "trance_gate": 2, "reverb_out": 4}.get(t, 1)
        transitions.append(Transition(type=t, length_bars=length))
    bar_s = 240.0 / bpm
    per = max(16, int(duration / bar_s / n) // 4 * 4)
    segments = []
    for k, tid in enumerate(order):
        a = by_id[tid]
        drops = a.sections.get("drops") or a.sections.get("kick_returns") or [0]
        incoming = transitions[k - 1].type if k > 0 else None
        # entrée sur un drop pour les transitions « coupées », sinon 8 mesures avant le 1er drop
        start = drops[0] if incoming in ("riser_drop", "blackout", "coupe", "rewind", "loop_roll", "echo_out") \
            else max(0, drops[0] - 8)
        if k == 0:
            start = max(0, drops[0] - 16)
        on_drop = incoming in ("riser_drop", "build_roll", "blackout", "coupe", "rewind", "loop_roll", "echo_out",
                               "tape_stop", "trance_gate", "double_drop")
        if not on_drop:  # sinon on garde le drop comme début, quitte à raccourcir l'extrait
            start = min(start, max(0, a.grid.n_bars - per))
        segments.append(Segment(track_id=tid, start_bar=start, length_bars=min(per, a.grid.n_bars - start),
                                reason="choix automatique (planificateur local)"))
    return MixPlan(target_bpm=round(bpm, 2), target_duration_s=duration, intro="fondu", ending=ending,
                   segments=segments, transitions=transitions,
                   explanation=("Non disponible pour l'instant : " + ", ".join(unavailable) + ". " if unavailable else "") +
                   "Plan généré localement (aucune clé API Claude configurée) : ordre, durée, tempo "
                               "et transitions déduits des mots-clés de ta demande.")


def make_plan(prompt: str, analyses: list[TrackAnalysis]) -> tuple[MixPlan, str]:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return plan_with_claude(prompt, analyses), f"Claude ({MODEL})"
    log.warning("ANTHROPIC_API_KEY absente : planificateur local")
    return plan_locally(prompt, analyses), "planificateur local (sans clé API)"
