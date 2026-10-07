#!/usr/bin/env python3
"""
Robot quotidien du simulateur : l'IA « parie » en ARGENT FICTIF sur de vrais matchs à venir.

À chaque exécution :
  1. règle les paris en cours avec les vrais résultats (The Odds API, sinon Claude + recherche web)
  2. scanne les matchs des prochaines heures dans tous les sports proposés par The Odds API
  3. garde ceux où le favori a au moins `proba_min` de chances selon le consensus des bookmakers
  4. Claude vérifie l'actualité (blessures, rotation, enjeu…) et décide PARIER ou PASSER
  5. enregistre tout dans simulateur/data/journal.js, affiché par le tableau de bord

Variables d'environnement :
  ODDS_API_KEY       clé gratuite sur https://the-odds-api.com (obligatoire)
  ANTHROPIC_API_KEY  clé sur https://console.anthropic.com (pour l'IA ; sinon règle simple)

Réglages : simulateur/config.json
"""

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, ".."))
CONFIG = os.path.join(RACINE, "config.json")
JOURNAL = os.path.join(RACINE, "data", "journal.js")
API = "https://api.the-odds-api.com/v4"

GROUPES_FR = {
    "Soccer": "Football", "Tennis": "Tennis", "Basketball": "Basket",
    "Ice Hockey": "Hockey sur glace", "Baseball": "Baseball",
    "American Football": "Football américain", "Rugby League": "Rugby à XIII",
    "Rugby Union": "Rugby à XV", "Aussie Rules": "Football australien",
    "Cricket": "Cricket", "Mixed Martial Arts": "MMA", "Boxing": "Boxe",
    "Handball": "Handball", "Lacrosse": "Crosse", "Volleyball": "Volley-ball",
    "Darts": "Fléchettes", "Snooker": "Snooker", "Table Tennis": "Tennis de table",
    "Esports": "E-sport", "Golf": "Golf",
}

MAINTENANT = dt.datetime.now(dt.timezone.utc)


# ---------------------------------------------------------------- fichiers

def charger_config():
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def charger_journal(cfg):
    vide = {"capital_depart": cfg["capital_depart"], "maj": None, "credits_odds_api": None,
            "paris": [], "refus": [], "scans": {}, "sans_scores": [], "executions": []}
    if not os.path.exists(JOURNAL):
        return vide
    with open(JOURNAL, encoding="utf-8") as f:
        texte = f.read()
    debut, fin = texte.find("{"), texte.rfind("}")
    if debut < 0 or fin < 0:
        return vide
    j = json.loads(texte[debut:fin + 1])
    for k, v in vide.items():
        j.setdefault(k, v)
    if not j["paris"]:
        j["capital_depart"] = cfg["capital_depart"]
    return j


def sauver_journal(j):
    j["maj"] = MAINTENANT.isoformat(timespec="seconds")
    os.makedirs(os.path.dirname(JOURNAL), exist_ok=True)
    with open(JOURNAL, "w", encoding="utf-8") as f:
        f.write("// Généré par simulateur/tools/live.py — argent fictif.\n")
        f.write("window.JOURNAL = ")
        json.dump(j, f, ensure_ascii=False, indent=1)
        f.write(";\n")


# ---------------------------------------------------------------- argent fictif

def capital_actuel(j):
    return j["capital_depart"] + sum(p.get("gain") or 0 for p in j["paris"] if p["statut"] != "en_cours")


def mises_en_cours(j):
    return sum(p["mise"] for p in j["paris"] if p["statut"] == "en_cours")


def regler(p, statut, score, par, note=None):
    p["statut"] = statut
    p["score"] = score
    p["regle_par"] = par
    p["regle_le"] = MAINTENANT.isoformat(timespec="seconds")
    if note:
        p["note_reglement"] = note
    if statut == "gagne":
        p["gain"] = round(p["mise"] * (p["cote"] - 1), 2)
    elif statut == "perdu":
        p["gain"] = -p["mise"]
    else:
        p["gain"] = 0.0


def date_iso(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


# ---------------------------------------------------------------- The Odds API

class Budget:
    def __init__(self, cfg):
        self.max = cfg["credits_max_par_execution"]
        self.reserve = cfg["credits_reserve"]
        self.utilises = 0
        self.restants = None

    def peut(self, cout):
        if self.utilises + cout > self.max:
            return False
        return self.restants is None or self.restants - cout >= self.reserve


def odds_api(budget, chemin, cout=0, **params):
    params["apiKey"] = os.environ["ODDS_API_KEY"]
    url = f"{API}{chemin}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "simulateur-paris"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode("utf-8"))
        restants = r.headers.get("x-requests-remaining")
    budget.utilises += cout
    if restants is not None:
        budget.restants = int(float(restants))
    return data


def probas_sans_marge(cotes):
    """Retire la marge du bookmaker (méthode « puissance ») : trouve k tel que
    somme((1/cote)^k) = 1. Contrairement à la méthode proportionnelle, elle tient
    compte du fait que les bookmakers prennent surtout leur marge sur l'outsider,
    ce qui compte beaucoup pour les très grands favoris."""
    inv = [1 / c for c in cotes]
    bas, haut = 0.5, 5.0
    for _ in range(60):
        k = (bas + haut) / 2
        if sum(i ** k for i in inv) > 1:
            bas = k
        else:
            haut = k
    p = [i ** k for i in inv]
    s = sum(p)
    return [x / s for x in p]


def consensus(evt, cfg):
    """Probabilité « juste » de chaque issue = moyenne des bookmakers, marge retirée."""
    livres = []
    for b in evt.get("bookmakers", []):
        m = next((m for m in b.get("markets", []) if m.get("key") == "h2h"), None)
        if not m:
            continue
        issues = [(o["name"], float(o["price"])) for o in m.get("outcomes", []) if float(o.get("price") or 0) > 1]
        if len(issues) >= 2:
            livres.append((b["key"], b.get("title", b["key"]), issues))
    if not livres:
        return None
    n_issues = max(len(i) for _, _, i in livres)
    livres = [l for l in livres if len(l[2]) == n_issues]
    probas, prix = {}, {}
    for cle, titre, issues in livres:
        for (nom, cote), p in zip(issues, probas_sans_marge([c for _, c in issues])):
            probas.setdefault(nom, []).append(p)
            prix.setdefault(nom, {})[titre] = cote
    moy = {nom: sum(v) / len(v) for nom, v in probas.items()}
    fav = max(moy, key=moy.get)
    if fav == "Draw" or len(probas[fav]) < cfg["bookmakers_min"]:
        return None
    choisis = cfg.get("bookmakers_pour_parier") or []
    if choisis:
        offres = {t: c for t, c in prix[fav].items() if t.lower() in [x.lower() for x in choisis]}
        if not offres:
            return None
        cote, ou = max(offres.values()), max(offres, key=offres.get)
    else:
        cote, ou = sum(prix[fav].values()) / len(prix[fav]), "moyenne des bookmakers"
    meilleur = max(prix[fav], key=prix[fav].get)
    adversaire = evt["away_team"] if fav == evt["home_team"] else evt["home_team"]
    return {
        "favori": fav, "adversaire": adversaire, "proba_marche": round(moy[fav], 4),
        "cote": round(cote, 3), "cote_ou": ou, "meilleure_cote": prix[fav][meilleur],
        "meilleur_bookmaker": meilleur, "nb_bookmakers": len(probas[fav]),
    }


# ---------------------------------------------------------------- Claude

def appeler_claude(cfg, systeme, texte, outil):
    """Claude cherche sur le web puis répond via `outil` (schéma strict). None si échec."""
    import anthropic

    ia = cfg["ia"]
    client = anthropic.Anthropic()
    outils = [{"type": "web_search_20260209", "name": "web_search", "max_uses": ia["recherches_web_max"]}, outil]
    messages = [{"role": "user", "content": texte}]
    try:
        for _ in range(6):
            r = client.beta.messages.create(
                model=ia["modele"],
                max_tokens=16000,
                system=systeme,
                messages=messages,
                tools=outils,
                output_config={"effort": ia["effort"]},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",  # si le modèle refuse, l'API relance sur un autre modèle
            )
            if r.stop_reason == "refusal":
                print(f"  IA : refus ({r.stop_details})")
                return None
            for bloc in r.content:
                if bloc.type == "tool_use" and bloc.name == outil["name"]:
                    return bloc.input
            messages.append({"role": "assistant", "content": r.content})
            if r.stop_reason != "pause_turn":  # pause_turn : la recherche web continue
                messages.append({"role": "user",
                                 "content": f"Appelle maintenant l'outil {outil['name']} avec tes conclusions."})
    except anthropic.AuthenticationError:
        print("  IA : clé ANTHROPIC_API_KEY invalide")
    except anthropic.RateLimitError:
        print("  IA : limite de requêtes atteinte, on réessaiera demain")
    except anthropic.APIStatusError as e:
        print(f"  IA : erreur API {e.status_code} {e.message}")
    except anthropic.APIConnectionError:
        print("  IA : connexion impossible")
    return None


OUTIL_DECISIONS = {
    "name": "enregistrer_decisions",
    "description": "Enregistre la décision PARIER ou PASSER pour chaque match proposé.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {"decisions": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "identifiant exact du match"},
                "decision": {"type": "string", "enum": ["PARIER", "PASSER"]},
                "proba_estimee": {"type": "number", "description": "ta probabilité que le favori gagne, entre 0 et 1"},
                "raison": {"type": "string", "description": "1 à 2 phrases en français"},
            },
            "required": ["id", "decision", "proba_estimee", "raison"],
            "additionalProperties": False,
        }}},
        "required": ["decisions"],
        "additionalProperties": False,
    },
}

SYSTEME_DECISIONS = """Tu es l'analyste d'un simulateur de paris sportifs en argent FICTIF : aucun argent réel n'est engagé, le but est de mesurer honnêtement si une stratégie « grands favoris » gagne sur la durée.

Pour chaque match proposé :
- cherche sur le web les dernières informations utiles : blessures, forfaits, retour de blessure, état de forme, rotation ou équipe remaniée, enjeu (match sans enjeu, qualification déjà acquise), fatigue, voyage, météo, conditions. Pour le tennis : abandons récents, surface, enchaînement de tournois ;
- estime toi-même la probabilité que le favori GAGNE. Au football, un match nul compte comme perdu ;
- PARIER seulement si ta probabilité est au moins égale au seuil indiqué ET que rien d'inquiétant n'apparaît. Sinon PASSER ;
- sois honnête et calibré : sans information nouvelle, reste proche de la probabilité du marché ;
- donne la raison en français, en une ou deux phrases.

Termine toujours en appelant l'outil enregistrer_decisions, avec exactement une décision par identifiant reçu."""

OUTIL_RESULTATS = {
    "name": "enregistrer_resultats",
    "description": "Enregistre le résultat réel de chaque match.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {"resultats": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "statut": {"type": "string", "enum": ["gagne", "perdu", "annule", "inconnu"]},
                "score": {"type": "string", "description": "score final, ex. 2-0 ou 6-3 6-4"},
                "explication": {"type": "string", "description": "1 phrase en français"},
            },
            "required": ["id", "statut", "score", "explication"],
            "additionalProperties": False,
        }}},
        "required": ["resultats"],
        "additionalProperties": False,
    },
}

SYSTEME_RESULTATS = """Tu règles les paris d'un simulateur en argent fictif. Pour chaque match, trouve sur le web le résultat final réel.
- gagne : le favori indiqué a gagné ; au tennis, aussi si l'adversaire abandonne en cours de match ;
- perdu : le favori n'a pas gagné (défaite, ou match nul au football), ou il a abandonné en cours de match ;
- annule : match annulé, reporté, ou forfait avant le début ;
- inconnu : tu ne trouves pas de résultat fiable, ou le match n'a pas encore eu lieu. Ne devine jamais.
Termine toujours en appelant l'outil enregistrer_resultats, avec une ligne par identifiant reçu."""


# ---------------------------------------------------------------- étapes

def regler_avec_scores(j, budget):
    a_regler = [p for p in j["paris"] if p["statut"] == "en_cours"
                and date_iso(p["debut"]) < MAINTENANT - dt.timedelta(hours=3)
                and date_iso(p["debut"]) > MAINTENANT - dt.timedelta(days=3)]
    par_sport = {}
    for p in a_regler:
        par_sport.setdefault(p["sport_key"], []).append(p)
    regles = 0
    for cle, paris in par_sport.items():
        if cle in j["sans_scores"]:
            continue  # ce sport n'a pas de résultats sur The Odds API : Claude s'en charge
        if not budget.peut(2):
            break
        try:
            evts = odds_api(budget, f"/sports/{cle}/scores", cout=2, daysFrom=3, dateFormat="iso")
        except urllib.error.HTTPError as e:
            budget.utilises += 2
            print(f"  scores {cle} indisponibles ({e.code})")
            if e.code in (404, 422):
                j["sans_scores"].append(cle)
            continue
        par_id = {e["id"]: e for e in evts}
        for p in paris:
            e = par_id.get(p["id"])
            if not e or not e.get("completed") or not e.get("scores"):
                continue
            sc = {s["name"]: s["score"] for s in e["scores"]}
            try:
                f, a = float(sc[p["favori"]]), float(sc[p["adversaire"]])
            except (KeyError, TypeError, ValueError):
                continue
            regler(p, "gagne" if f > a else "perdu", f"{sc[p['favori']]}-{sc[p['adversaire']]}", "scores")
            regles += 1
    return regles


def regler_avec_ia(j, cfg):
    a_regler = [p for p in j["paris"] if p["statut"] == "en_cours"
                and date_iso(p["debut"]) < MAINTENANT - dt.timedelta(hours=6)]
    regles = 0
    if a_regler and cfg["ia"]["active"] and os.environ.get("ANTHROPIC_API_KEY"):
        taille = cfg["ia"]["matchs_par_appel"]
        for k in range(0, len(a_regler), taille):
            lot = a_regler[k:k + taille]
            texte = "Matchs à régler :\n" + "\n".join(
                f"- id={p['id']} | {p['sport']} · {p['competition']} | début {p['debut']} | "
                f"favori : {p['favori']} | adversaire : {p['adversaire']}" for p in lot)
            rep = appeler_claude(cfg, SYSTEME_RESULTATS, texte, OUTIL_RESULTATS)
            for r in (rep or {}).get("resultats", []):
                p = next((x for x in lot if x["id"] == r["id"]), None)
                if p and r["statut"] in ("gagne", "perdu", "annule"):
                    regler(p, r["statut"], r["score"], "ia", r["explication"])
                    regles += 1
    # au-delà de 10 jours sans résultat fiable : pari remboursé
    for p in j["paris"]:
        if p["statut"] == "en_cours" and date_iso(p["debut"]) < MAINTENANT - dt.timedelta(days=10):
            regler(p, "annule", "", "delai", "résultat introuvable après 10 jours : mise remboursée")
            regles += 1
    return regles


def scanner(j, cfg, budget, sports):
    deja = {p["id"] for p in j["paris"]} | {r["id"] for r in j["refus"]}
    toujours = [s for s in sports if s["group"] in cfg["sports_toujours_scannes"]]
    autres = sorted((s for s in sports if s not in toujours), key=lambda s: j["scans"].get(s["key"], ""))
    moitie = max(1, budget.max // 2)
    ordre = toujours[:moitie] + autres + toujours[moitie:]
    fin = MAINTENANT + dt.timedelta(hours=cfg["horizon_heures"])
    candidats, scannes = [], []
    for s in ordre:
        if not budget.peut(1):
            break
        try:
            evts = odds_api(budget, f"/sports/{s['key']}/odds", cout=1, regions=cfg["regions"],
                            markets="h2h", oddsFormat="decimal", dateFormat="iso")
        except urllib.error.HTTPError as e:
            budget.utilises += 1
            print(f"  {s['key']} : erreur {e.code}")
            continue
        j["scans"][s["key"]] = MAINTENANT.isoformat(timespec="seconds")
        scannes.append(s["key"])
        for e in evts:
            debut = date_iso(e["commence_time"])
            if e["id"] in deja or not (MAINTENANT + dt.timedelta(minutes=20) < debut < fin):
                continue
            c = consensus(e, cfg)
            if not c or c["proba_marche"] < cfg["proba_min"]:
                continue
            c.update({
                "id": e["id"], "sport_key": s["key"],
                "sport": GROUPES_FR.get(s["group"], s["group"]),
                "competition": e.get("sport_title") or s["title"],
                "debut": e["commence_time"], "domicile": e["home_team"], "exterieur": e["away_team"],
            })
            candidats.append(c)
    return candidats, scannes


def decider(candidats, cfg):
    """Renvoie {id: décision}. Sans IA : on parie sur tous les favoris au-dessus du seuil."""
    decisions = {}
    ia_ok = cfg["ia"]["active"] and os.environ.get("ANTHROPIC_API_KEY")
    if ia_ok:
        taille = cfg["ia"]["matchs_par_appel"]
        for k in range(0, len(candidats), taille):
            lot = candidats[k:k + taille]
            texte = (f"Date du jour (UTC) : {MAINTENANT:%Y-%m-%d %H:%M}\n"
                     f"Seuil : PARIER seulement si ta probabilité ≥ {cfg['proba_min']:.0%}\n\nMatchs :\n" +
                     "\n".join(
                         f"- id={c['id']} | {c['sport']} · {c['competition']} | début {c['debut']} | "
                         f"{c['domicile']} (domicile) contre {c['exterieur']} | favori : {c['favori']} | "
                         f"cote {c['cote']} | probabilité selon {c['nb_bookmakers']} bookmakers : "
                         f"{c['proba_marche']:.1%}" for c in lot))
            rep = appeler_claude(cfg, SYSTEME_DECISIONS, texte, OUTIL_DECISIONS)
            for d in (rep or {}).get("decisions", []):
                d["par"] = "ia"
                decisions[d["id"]] = d
    for c in candidats:
        if c["id"] not in decisions:
            decisions[c["id"]] = {
                "decision": "PARIER", "proba_estimee": None, "par": "regle",
                "raison": "IA non utilisée : pari placé d'après les cotes seulement." if not ia_ok
                else "L'IA n'a pas répondu pour ce match : pari placé d'après les cotes seulement.",
            }
    return decisions


def placer(j, candidats, decisions, cfg):
    places = 0
    for c in sorted(candidats, key=lambda c: c["debut"]):
        d = decisions[c["id"]]
        entree = dict(c, proba_ia=d.get("proba_estimee"), raison_ia=d["raison"], decide_par=d["par"],
                      date_decision=MAINTENANT.isoformat(timespec="seconds"))
        if d["decision"] != "PARIER":
            j["refus"].insert(0, entree)
            continue
        capital = capital_actuel(j)
        plafond = capital * cfg["exposition_max_pourcent"] / 100 - mises_en_cours(j)
        mise = round(min(capital * cfg["mise_pourcent_du_capital"] / 100, plafond), 2)
        if mise < 1:
            entree["raison_ia"] += " (Non placé : plus assez de capital disponible.)"
            j["refus"].insert(0, entree)
            continue
        entree.update({"mise": mise, "statut": "en_cours", "gain": None, "score": None})
        j["paris"].append(entree)
        places += 1
    del j["refus"][500:]
    return places


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sans-ia", action="store_true", help="ne pas appeler Claude (règle simple)")
    args = ap.parse_args()

    cfg = charger_config()
    if args.sans_ia:
        cfg["ia"]["active"] = False
    j = charger_journal(cfg)

    if not os.environ.get("ODDS_API_KEY"):
        print("ODDS_API_KEY manquante : crée une clé gratuite sur https://the-odds-api.com "
              "puis ajoute-la (voir simulateur/README.md). Rien à faire pour aujourd'hui.")
        return

    budget = Budget(cfg)
    sports = [s for s in odds_api(budget, "/sports") if s.get("active") and not s.get("has_outrights")]
    print(f"{len(sports)} compétitions ouvertes aux paris en ce moment, "
          f"{budget.restants} crédits The Odds API restants ce mois-ci")

    regles = regler_avec_scores(j, budget) + regler_avec_ia(j, cfg)
    candidats, scannes = scanner(j, cfg, budget, sports)
    print(f"{len(scannes)} compétitions scannées, {len(candidats)} favori(s) ≥ {cfg['proba_min']:.0%}")
    decisions = decider(candidats, cfg)
    places = placer(j, candidats, decisions, cfg)

    j["credits_odds_api"] = budget.restants
    j["executions"].insert(0, {
        "date": MAINTENANT.isoformat(timespec="seconds"), "competitions_ouvertes": len(sports),
        "competitions_scannees": len(scannes), "candidats": len(candidats), "paris_places": places,
        "paris_regles": regles, "credits_utilises": budget.utilises, "credits_restants": budget.restants,
        "capital": round(capital_actuel(j), 2),
    })
    del j["executions"][120:]
    sauver_journal(j)
    capital = f"{capital_actuel(j):,.2f}".replace(",", " ")
    print(f"{regles} pari(s) réglé(s), {places} nouveau(x) pari(s). Capital fictif : {capital} €")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(f"The Odds API a répondu {e.code} : {e.read()[:300]!r}", file=sys.stderr)
        sys.exit(1)
