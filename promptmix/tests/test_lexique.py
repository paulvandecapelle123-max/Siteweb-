import re
from typing import get_args

import pytest

from promptmix.plan.lexique import TECHNIQUES, doc_for_prompt
from promptmix.plan.planner import SYSTEM_PROMPT, plan_locally
from promptmix.plan.schema import TransitionType
from promptmix.render.transitions import TRANSITIONS


def test_every_technique_is_wired():
    ids = {t["id"] for t in TECHNIQUES if t["id"]}
    assert ids == set(get_args(TransitionType)) == set(TRANSITIONS)


@pytest.mark.parametrize("t", TECHNIQUES, ids=lambda t: t["nom"])
def test_synonyms_are_recognised(t):
    for syn in t["synonymes"]:
        assert re.search(t["regex"], syn.lower()), syn


def test_claude_prompt_contains_vocabulary():
    assert "loop_morph" in SYSTEM_PROMPT and "tape stop" in SYSTEM_PROMPT and "Camelot" in doc_for_prompt()


PHRASES = [
    ("à la fin du son tu prends une partie, tu la répètes en boucle, tu changes comment ça se répète, "
     "et après ça devient la même rythmique que la chanson que tu veux rajouter ensuite", ["loop_morph"]),
    ("fais un bass swap puis un brake", ["bass_swap", "tape_stop"]),
    ("je veux que le son devienne étouffé comme sous l'eau, puis un spinback", ["filtre_passe_bas", "rewind"]),
    ("un snare roll avant le drop puis double drop", ["build_roll", "double_drop"]),
    ("mix aux EQ bien long puis un stutter", ["eq_3_bandes", "loop_roll"]),
]


@pytest.mark.parametrize("phrase,expected", PHRASES)
def test_local_planner_understands_dj_slang(three_tracks, phrase, expected):
    analyses, _ = three_tracks
    plan = plan_locally("4 minutes. " + phrase, list(analyses.values()))
    got = [t.type for t in plan.transitions]
    n = min(len(got), len(expected))
    assert got[:n] == expected[:n]


def test_unavailable_technique_is_reported(three_tracks):
    analyses, _ = three_tracks
    plan = plan_locally("3 minutes, un mashup acapella et du scratch", list(analyses.values()))
    assert "Non disponible" in plan.explanation and "Scratch" in plan.explanation
