#!/usr/bin/env python3
"""
Télécharge de VRAIS matchs passés (cotes + résultats) dans un maximum de sports
et fabrique simulateur/data/historique.js, lu par le tableau de bord.

Sources gratuites :
  - tennis-data.co.uk     : tennis ATP + WTA (cotes Bet365, Pinnacle, moyenne, meilleure)
  - football-data.co.uk   : 22 championnats européens + 16 championnats du monde
  - aussportsbetting.com  : NBA, NFL, NHL, MLB, AFL, NRL

On garde seulement les matchs où le favori a au moins SEUIL_INCLUSION de chances
(selon les cotes) : le tableau de bord laisse ensuite choisir le seuil (97 % par défaut).

Fichiers déposés à la main : si un site refuse les téléchargements automatiques,
télécharge ses fichiers depuis ton navigateur et dépose-les dans simulateur/fichiers/.
Le script les reconnaît à leur contenu (le nom du fichier n'a pas d'importance).

Utilisation :
    pip install openpyxl
    python simulateur/tools/historique.py            # tout télécharger
    python simulateur/tools/historique.py --rapide   # seulement les 3 dernières saisons
"""

import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import time
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "data", "historique.js")
CACHE = os.path.join(ICI, ".cache")
FICHIERS = os.path.join(ICI, "..", "fichiers")

SEUIL_INCLUSION = 0.80     # proba minimum du favori pour garder un match dans le fichier
PREMIERE_ANNEE = 2013

FOOT_PRINCIPAL = {
    "E0": "Angleterre · Premier League", "E1": "Angleterre · Championship",
    "E2": "Angleterre · League One", "E3": "Angleterre · League Two",
    "EC": "Angleterre · National League",
    "SC0": "Écosse · Premiership", "SC1": "Écosse · Championship",
    "SC2": "Écosse · League One", "SC3": "Écosse · League Two",
    "D1": "Allemagne · Bundesliga", "D2": "Allemagne · 2. Bundesliga",
    "I1": "Italie · Serie A", "I2": "Italie · Serie B",
    "SP1": "Espagne · LaLiga", "SP2": "Espagne · LaLiga 2",
    "F1": "France · Ligue 1", "F2": "France · Ligue 2",
    "N1": "Pays-Bas · Eredivisie", "B1": "Belgique · Pro League",
    "P1": "Portugal · Primeira Liga", "T1": "Turquie · Süper Lig",
    "G1": "Grèce · Super League",
}
FOOT_MONDE = {
    "ARG": "Argentine", "AUT": "Autriche", "BRA": "Brésil", "CHN": "Chine",
    "DNK": "Danemark", "FIN": "Finlande", "IRL": "Irlande", "JPN": "Japon",
    "MEX": "Mexique", "NOR": "Norvège", "POL": "Pologne", "ROU": "Roumanie",
    "RUS": "Russie", "SWE": "Suède", "SWZ": "Suisse", "USA": "États-Unis · MLS",
}
US_SPORTS = {
    "nba": "Basket (NBA)", "nfl": "Football américain (NFL)",
    "nhl": "Hockey sur glace (NHL)", "mlb": "Baseball (MLB)",
    "afl": "Football australien (AFL)", "nrl": "Rugby à XIII (NRL)",
}


# ---------------------------------------------------------------- outils

def telecharger(urls, nom_cache):
    """Renvoie le contenu (bytes) du premier lien qui répond, avec cache disque."""
    chemin = os.path.join(CACHE, nom_cache)
    if os.path.exists(chemin):
        with open(chemin, "rb") as f:
            return f.read()
    erreurs = []
    for url in urls:
        site = "/".join(url.split("/")[:3]) + "/"
        for essai in range(3):
            try:
                # en-têtes d'un navigateur ordinaire : certains sites refusent les noms de robots inconnus
                req = urllib.request.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                                  "(KHTML, like Gecko) Chrome/129.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
                    "Referer": site,
                })
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                os.makedirs(CACHE, exist_ok=True)
                with open(chemin, "wb") as f:
                    f.write(data)
                time.sleep(0.5)  # politesse envers les sites gratuits
                return data
            except Exception as e:  # noqa: BLE001 - on veut continuer avec les autres sources
                code = getattr(e, "code", None)
                if code in (403, 404, 410) or essai == 2:
                    erreurs.append(f"{url} : {e}")
                    break  # refus ou fichier absent : inutile d'insister
                time.sleep(2 * (essai + 1))
    raise RuntimeError(" | ".join(erreurs))


def cote(v):
    try:
        x = float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return x if x > 1.0 else None


def premiere_cote(ligne, noms):
    for n in noms:
        c = cote(ligne.get(n))
        if c:
            return c
    return None


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


def date_en_entier(d):
    return d.year * 10000 + d.month * 100 + d.day


def lire_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, (int, float)) and 20000 < v < 80000:  # numéro de série Excel
        return dt.date(1899, 12, 30) + dt.timedelta(days=int(v))
    s = str(v or "").strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def lire_xlsx(data):
    """Lit la première feuille d'un .xlsx en liste de dicts (détecte la ligne d'en-tête)."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    ws.reset_dimensions()  # certains fichiers annoncent une taille fausse : on lit tout
    lignes = ws.iter_rows(values_only=True)
    entete = None
    for _ in range(10):
        row = next(lignes, None)
        if row is None:
            return []
        if any(str(c).strip().lower() == "date" for c in row if c is not None):
            entete = [str(c).strip() if c is not None else "" for c in row]
            break
    if entete is None:
        return []
    out = [dict(zip(entete, row)) for row in lignes if row and any(c is not None for c in row)]
    wb.close()
    return out


def lire_csv(data):
    texte = data.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(texte)))


class Collecteur:
    def __init__(self):
        self.sports, self.competitions, self.matchs, self.sources = [], [], [], []
        self._idx_s, self._idx_c = {}, {}

    def _index(self, valeur, liste, idx):
        if valeur not in idx:
            idx[valeur] = len(liste)
            liste.append(valeur)
        return idx[valeur]

    def ajouter(self, date, sport, competition, favori, outsider, proba, b365, moy, maxi, gagne):
        """Un match = le favori, sa proba « juste », ses cotes et le résultat (1 = gagné)."""
        if proba < SEUIL_INCLUSION or date is None:
            return False
        self.matchs.append([
            date_en_entier(date),
            self._index(sport, self.sports, self._idx_s),
            self._index(competition, self.competitions, self._idx_c),
            str(favori).strip(), str(outsider).strip(),
            round(proba, 4),
            round(b365, 3) if b365 else None,
            round(moy, 3) if moy else None,
            round(maxi, 3) if maxi else None,
            1 if gagne else 0,
        ])
        return True

    def source(self, nom, sport, total, gardes, erreur=None):
        self.sources.append({"nom": nom, "sport": sport, "matchs_analyses": total,
                             "matchs_gardes": gardes, "erreur": erreur})
        etat = f"ERREUR {erreur}" if erreur else f"{total} matchs, {gardes} gardés"
        print(f"  {nom:<45} {etat}", flush=True)


# ---------------------------------------------------------------- fichiers déposés à la main

def fichiers_deposes():
    """Lit les .xlsx déposés dans simulateur/fichiers/ et reconnaît chacun par son contenu :
    tennis ATP ou WTA (colonne « ATP » ou « WTA » + année des dates) ou sport US (nom nba, nfl…)."""
    trouves = {}
    if not os.path.isdir(FICHIERS):
        return trouves
    for nom in sorted(os.listdir(FICHIERS)):
        if not nom.lower().endswith(".xlsx"):
            continue
        with open(os.path.join(FICHIERS, nom), "rb") as f:
            data = f.read()
        try:
            lignes = lire_xlsx(data)
        except Exception as e:  # noqa: BLE001
            print(f"  {nom} : illisible ({e}), ignoré")
            continue
        if not lignes:
            print(f"  {nom} : vide, ignoré")
            continue
        entete = set(lignes[0])
        us = next((c for c in US_SPORTS if nom.lower().startswith(c)), None)
        circuit = "ATP" if "ATP" in entete else "WTA" if "WTA" in entete else None
        if circuit and "Winner" in entete:
            annees = {}
            for l in lignes:
                d = lire_date(l.get("Date"))
                if d:
                    annees[d.year] = annees.get(d.year, 0) + 1
            if annees:
                an = max(annees, key=annees.get)
                trouves[("tennis", circuit, an)] = lignes
                print(f"  {nom} : tennis {circuit} {an} ({len(lignes)} matchs)")
                continue
        elif us:
            trouves[("us", us)] = lignes
            print(f"  {nom} : {US_SPORTS[us]} ({len(lignes)} matchs)")
            continue
        print(f"  {nom} : pas reconnu, ignoré")
    return trouves


# ---------------------------------------------------------------- tennis

def tennis(col, annees, deposes):
    for circuit, suffixe, sport in (("ATP", "", "Tennis ATP"), ("WTA", "w", "Tennis WTA")):
        for an in annees:
            nom = f"Tennis {circuit} {an}"
            lignes = deposes.get(("tennis", circuit, an))
            if lignes is not None:
                nom += " (fichier déposé)"
            else:
                try:
                    data = telecharger([
                        f"https://www.tennis-data.co.uk/{an}{suffixe}/{an}.xlsx",
                        f"http://www.tennis-data.co.uk/{an}{suffixe}/{an}.xlsx",
                    ], f"tennis_{circuit}_{an}.xlsx")
                    lignes = lire_xlsx(data)
                except Exception as e:  # noqa: BLE001
                    col.source(nom, sport, 0, 0, str(e)[:120])
                    continue
            total = gardes = 0
            for l in lignes:
                if str(l.get("Comment", "")).strip().lower().startswith("walkover"):
                    continue  # forfait avant le match : pari remboursé
                gagnant, perdant = l.get("Winner"), l.get("Loser")
                if not gagnant or not perdant:
                    continue
                paires = {
                    "ps": (cote(l.get("PSW")), cote(l.get("PSL"))),
                    "b365": (cote(l.get("B365W")), cote(l.get("B365L"))),
                    "moy": (cote(l.get("AvgW")), cote(l.get("AvgL"))),
                    "max": (cote(l.get("MaxW")), cote(l.get("MaxL"))),
                }
                ref = next((paires[k] for k in ("ps", "moy", "b365") if all(paires[k])), None)
                if not ref:
                    continue
                total += 1
                fav_est_gagnant = ref[0] <= ref[1]
                i = 0 if fav_est_gagnant else 1
                proba = probas_sans_marge(ref)[i]
                if col.ajouter(
                    lire_date(l.get("Date")), sport, str(l.get("Tournament") or "?").strip(),
                    gagnant if fav_est_gagnant else perdant,
                    perdant if fav_est_gagnant else gagnant,
                    proba, paires["b365"][i], paires["moy"][i] or ref[i], paires["max"][i],
                    fav_est_gagnant,
                ):
                    gardes += 1
            col.source(nom, sport, total, gardes)


# ---------------------------------------------------------------- football

def _match_foot(col, l, competition):
    def trio(*prefixes_suffixes):
        for noms in prefixes_suffixes:
            t = [premiere_cote(l, [n]) for n in noms]
            if all(t):
                return t
        return None

    ps = trio(("PSH", "PSD", "PSA"), ("PSCH", "PSCD", "PSCA"), ("PH", "PD", "PA"))
    b365 = trio(("B365H", "B365D", "B365A"), ("B365CH", "B365CD", "B365CA"))
    moy = trio(("AvgH", "AvgD", "AvgA"), ("BbAvH", "BbAvD", "BbAvA"), ("AvgCH", "AvgCD", "AvgCA"))
    maxi = trio(("MaxH", "MaxD", "MaxA"), ("BbMxH", "BbMxD", "BbMxA"), ("MaxCH", "MaxCD", "MaxCA"))
    ref = ps or moy or b365
    res = str(l.get("FTR") or l.get("Res") or "").strip().upper()
    dom = l.get("HomeTeam") or l.get("Home")
    ext = l.get("AwayTeam") or l.get("Away")
    if not ref or res not in ("H", "D", "A") or not dom or not ext:
        return None
    i = 0 if ref[0] <= ref[2] else 2          # le favori est domicile (0) ou extérieur (2)
    proba = probas_sans_marge(ref)[i]
    gagne = res == ("H" if i == 0 else "A")   # un nul = pari perdu
    fav, adv = (dom, ext) if i == 0 else (ext, dom)
    ok = col.ajouter(lire_date(l.get("Date")), "Football", competition, fav, adv, proba,
                     b365[i] if b365 else None, (moy or ref)[i], maxi[i] if maxi else None, gagne)
    return ok


def football(col, saisons):
    for code, nom_ligue in FOOT_PRINCIPAL.items():
        for s in saisons:
            nom = f"Foot {nom_ligue} {s[:2]}/{s[2:]}"
            try:
                lignes = lire_csv(telecharger(
                    [f"https://www.football-data.co.uk/mmz4281/{s}/{code}.csv"],
                    f"foot_{code}_{s}.csv"))
            except Exception as e:  # noqa: BLE001
                col.source(nom, "Football", 0, 0, str(e)[:120])
                continue
            total = gardes = 0
            for l in lignes:
                r = _match_foot(col, l, nom_ligue)
                if r is not None:
                    total += 1
                    gardes += 1 if r else 0
            col.source(nom, "Football", total, gardes)

    for code, pays in FOOT_MONDE.items():
        nom = f"Foot {pays}"
        try:
            lignes = lire_csv(telecharger(
                [f"https://www.football-data.co.uk/new/{code}.csv"], f"foot_monde_{code}.csv"))
        except Exception as e:  # noqa: BLE001
            col.source(nom, "Football", 0, 0, str(e)[:120])
            continue
        total = gardes = 0
        for l in lignes:
            d = lire_date(l.get("Date"))
            if not d or d.year < PREMIERE_ANNEE:
                continue
            ligue = (l.get("League") or "").strip()
            competition = pays if not ligue or ligue in pays else f"{pays} · {ligue}"
            r = _match_foot(col, l, competition)
            if r is not None:
                total += 1
                gardes += 1 if r else 0
        col.source(nom, "Football", total, gardes)


# ---------------------------------------------------------------- sports US / Australie

def _colonne(entete, *candidats):
    bas = {h.lower(): h for h in entete if h}
    for c in candidats:
        if c in bas:
            return bas[c]
    return None


def sports_us(col, deposes):
    for code, sport in US_SPORTS.items():
        nom = sport
        lignes = deposes.get(("us", code))
        if lignes is not None:
            nom += " (fichier déposé)"
        else:
            try:
                lignes = lire_xlsx(telecharger(
                    [f"https://www.aussportsbetting.com/historical_data/{code}.xlsx"], f"us_{code}.xlsx"))
            except Exception as e:  # noqa: BLE001
                col.source(nom, sport, 0, 0, str(e)[:120])
                continue
        if not lignes:
            col.source(nom, sport, 0, 0, "fichier vide")
            continue
        h = list(lignes[0].keys())
        c_dom = _colonne(h, "home team")
        c_ext = _colonne(h, "away team")
        c_sd = _colonne(h, "home score")
        c_se = _colonne(h, "away score")
        c_od = _colonne(h, "home odds close", "home odds")
        c_oe = _colonne(h, "away odds close", "away odds")
        c_on = _colonne(h, "draw odds close", "draw odds")
        if not all((c_dom, c_ext, c_sd, c_se, c_od, c_oe)):
            col.source(nom, sport, 0, 0, "colonnes introuvables : " + ", ".join(h[:12]))
            continue
        total = gardes = 0
        for l in lignes:
            d = lire_date(l.get("Date"))
            od, oe, on = cote(l.get(c_od)), cote(l.get(c_oe)), cote(l.get(c_on)) if c_on else None
            try:
                sd, se = float(l.get(c_sd)), float(l.get(c_se))
            except (TypeError, ValueError):
                continue
            if not d or d.year < PREMIERE_ANNEE or not od or not oe:
                continue
            cotes = [od, oe] + ([on] if on else [])
            total += 1
            i = 0 if od <= oe else 1
            proba = probas_sans_marge(cotes)[i]
            gagne = sd > se if i == 0 else se > sd
            fav, adv = (l[c_dom], l[c_ext]) if i == 0 else (l[c_ext], l[c_dom])
            if col.ajouter(d, sport, sport, fav, adv, proba, None, cotes[i], None, gagne):
                gardes += 1
        col.source(nom, sport, total, gardes)


# ---------------------------------------------------------------- reprise

def reprendre_anciens(col):
    """Si le site d'un sport a refusé tous les téléchargements (par ex. depuis les serveurs de GitHub),
    garde les matchs de ce sport déjà présents dans historique.js au lieu de les effacer."""
    echoues = {s["sport"] for s in col.sources} - {s["sport"] for s in col.sources if not s["erreur"]}
    if not echoues or not os.path.exists(SORTIE):
        return
    with open(SORTIE, encoding="utf-8") as f:
        texte = f.read()
    try:
        ancien = json.loads(texte[texte.find("{"):texte.rfind("}") + 1])
    except ValueError:
        return
    for sport in sorted(echoues):
        anciennes_sources = [s for s in ancien.get("sources", []) if s["sport"] == sport and not s["erreur"]]
        if not anciennes_sources or sport not in ancien["sports"]:
            continue
        i_ancien = ancien["sports"].index(sport)
        i_sport = col._index(sport, col.sports, col._idx_s)
        n = 0
        for m in ancien["matchs"]:
            if m[1] == i_ancien:
                i_comp = col._index(ancien["competitions"][m[2]], col.competitions, col._idx_c)
                col.matchs.append([m[0], i_sport, i_comp] + m[3:])
                n += 1
        col.sources = [s for s in col.sources if s["sport"] != sport] + anciennes_sources
        print(f"  {sport} : site indisponible, {n} matchs repris du fichier précédent", flush=True)


# ---------------------------------------------------------------- principal

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rapide", action="store_true", help="seulement les 3 dernières saisons")
    p.add_argument("--sans-cache", action="store_true", help="re-télécharger tous les fichiers")
    args = p.parse_args()

    if args.sans_cache and os.path.isdir(CACHE):
        for f in os.listdir(CACHE):
            os.remove(os.path.join(CACHE, f))

    aujourd_hui = dt.date.today()
    debut = aujourd_hui.year - 2 if args.rapide else PREMIERE_ANNEE
    annees = list(range(debut, aujourd_hui.year + 1))
    derniere_saison = aujourd_hui.year if aujourd_hui.month >= 7 else aujourd_hui.year - 1
    saisons = [f"{a % 100:02d}{(a + 1) % 100:02d}" for a in range(debut, derniere_saison + 1)]

    col = Collecteur()
    deposes = fichiers_deposes()
    print("Tennis…", flush=True)
    tennis(col, annees, deposes)
    print("Football…", flush=True)
    football(col, saisons)
    print("Sports US / Australie…", flush=True)
    sports_us(col, deposes)
    reprendre_anciens(col)

    col.matchs.sort(key=lambda m: m[0])
    total = sum(s["matchs_analyses"] for s in col.sources)
    erreurs = sum(1 for s in col.sources if s["erreur"])
    if not col.matchs:
        print("Aucun match récupéré : vérifie ta connexion internet.", file=sys.stderr)
        sys.exit(1)

    entete = {
        "genere_le": aujourd_hui.isoformat(),
        "seuil_inclusion": SEUIL_INCLUSION,
        "matchs_analyses": total,
        "sources": col.sources,
        "sports": col.sports,
        "competitions": col.competitions,
        "colonnes": ["date", "sport", "competition", "favori", "outsider",
                     "proba_juste", "cote_bet365", "cote_moyenne", "cote_max", "favori_gagne"],
    }
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("// Fichier généré par simulateur/tools/historique.py — ne pas modifier à la main.\n")
        f.write("window.HISTORIQUE = ")
        corps = json.dumps(entete, ensure_ascii=False, separators=(",", ":"))
        f.write(corps[:-1] + ',"matchs":[\n')
        f.write(",\n".join(json.dumps(m, ensure_ascii=False, separators=(",", ":")) for m in col.matchs))
        f.write("\n]};\n")
    print(f"\n{total} matchs réels analysés, {len(col.matchs)} avec un favori ≥ "
          f"{SEUIL_INCLUSION:.0%} → {os.path.relpath(SORTIE)}  ({erreurs} source(s) en erreur)")


if __name__ == "__main__":
    main()
