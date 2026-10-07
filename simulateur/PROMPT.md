# Prompt complet pour recréer ce simulateur

Copie-colle le texte ci-dessous dans Claude Code (ou un autre assistant de code) dans un dépôt GitHub vide ou existant.

---

Construis-moi un **simulateur de paris sportifs en argent fictif** pour tester cette stratégie : placer un capital de 10 000 € sur un très grand nombre de matchs où le favori a au moins 97 % de chances de gagner, dans **le plus de sports possible** tant qu'on peut parier dessus en ligne. Aucun argent réel, aucun lien avec un bookmaker. Tout en français.

## 1. Test sur le passé (backtest) avec de vrais matchs

Écris `simulateur/tools/historique.py` (Python 3, seule dépendance : `openpyxl`) qui télécharge des matchs réels avec leurs cotes d'avant-match et leurs résultats :
- **Tennis** ATP et WTA depuis 2013 sur tennis-data.co.uk (`/{année}/{année}.xlsx` et `/{année}w/{année}.xlsx`), colonnes Winner, Loser, B365W/L, PSW/L (Pinnacle), AvgW/L, MaxW/L, Comment (exclure les « Walkover »).
- **Football** sur football-data.co.uk : les 22 championnats européens (`/mmz4281/{saison}/{code}.csv`, codes E0 à EC, SC0 à SC3, D1, D2, I1, I2, SP1, SP2, F1, F2, N1, B1, P1, T1, G1, saisons depuis 2012/13) et les 16 championnats du monde (`/new/{code}.csv` : ARG, AUT, BRA, CHN, DNK, FIN, IRL, JPN, MEX, NOR, POL, ROU, RUS, SWE, SWZ, USA). Gérer les anciens noms de colonnes (BbAvH, BbMxH) et les nouveaux (AvgH, MaxH, PSCH…). Un nul = pari sur le favori perdu.
- **Sports US / Australie** sur aussportsbetting.com (`/historical_data/{nba,nfl,nhl,mlb,afl,nrl}.xlsx`) : détecter automatiquement la ligne d'en-tête et les colonnes « Home/Away Odds (Close) ».
- Chaque source qui échoue est notée et ignorée, sans bloquer les autres. Cache disque des téléchargements.
- Certains sites refusent les serveurs de GitHub (403) : accepter aussi des fichiers `.xlsx` téléchargés à la main et déposés dans `simulateur/fichiers/`, reconnus par leur contenu (colonne ATP/WTA + année des dates) quel que soit leur nom ; si toutes les sources d'un sport échouent, garder les matchs de ce sport déjà présents dans `historique.js`.

Pour chaque match : favori = cote la plus basse ; probabilité « juste » du favori = cotes Pinnacle (sinon moyenne du marché) **sans la marge du bookmaker, calculée avec la méthode « puissance »** (trouver k tel que somme((1/cote)^k) = 1), parce que la méthode proportionnelle sous-estime les très grands favoris. Garder seulement les matchs où le favori a au moins 80 %. Écrire `simulateur/data/historique.js` sous la forme `window.HISTORIQUE = {sources, sports, competitions, matchs: [[date AAAAMMJJ, sport, compétition, favori, outsider, proba, cote Bet365, cote moyenne, cote max, favori gagné 0/1], …]}` pour que la page marche même ouverte en double-cliquant (sans serveur).

## 2. Robot IA en direct (argent fictif)

Écris `simulateur/tools/live.py` + `simulateur/config.json` (capital 10 000, proba_min 0.97, mise 2 % du capital, exposition max 60 %, horizon 36 h, 3 bookmakers minimum, budget de crédits par jour). Chaque exécution :
1. **Règle les paris en cours, et vérifie aussi le résultat des matchs que Claude a écartés** (pour mesurer s'il avait raison), avec The Odds API `/v4/sports/{sport}/scores` ; mémorise les sports sans résultats ; sinon demande à Claude avec la recherche web (gagné / perdu / annulé / inconnu, ne jamais deviner) ; rembourse après 10 jours sans résultat.
2. **Scanne** `/v4/sports` (compétitions actives sans « outrights »), puis `/odds` (marché h2h, région eu, cotes décimales) en respectant le budget de crédits (lire l'en-tête `x-requests-remaining`). Le tennis est scanné chaque jour, les autres sports tournent (le moins récemment scanné d'abord).
3. **Consensus** : probabilité sans marge (méthode puissance) moyennée sur tous les bookmakers ; garder les favoris ≥ proba_min qui commencent dans l'horizon ; cote du pari = moyenne des bookmakers (ou meilleure cote d'une liste de bookmakers choisie).
4. **Claude décide** (SDK Python `anthropic`, modèle `claude-opus-5-5`, effort `medium`, outil serveur `web_search_20260209`, en-tête bêta `server-side-fallback-2026-07-01` avec `fallbacks="default"`, gérer `pause_turn` et `refusal`) : il cherche blessures, forfaits, rotation, enjeu, fatigue, météo, puis répond via un outil `strict` `enregistrer_decisions` (id, PARIER/PASSER, proba estimée, raison en français). Lots de 12 matchs. Sans clé API : parier sur tous les favoris au-dessus du seuil.
5. **Place** les paris (2 % du capital, plafond d'exposition) et écrit tout dans `simulateur/data/journal.js` (`window.JOURNAL = {…}`) : paris, matchs écartés avec la raison, journal des exécutions, crédits restants.

## 3. Tableau de bord `simulateur/index.html`

HTML/CSS/JS sans aucune dépendance ni compilation, graphiques en SVG faits à la main, thème clair et sombre (variables CSS + `prefers-color-scheme`), lisible sur mobile, `noindex`. Deux onglets :
- **Test sur le passé** : une rangée de filtres (capital, curseur « chances minimum » de 80 à 99,5 % réglé sur 97 %, mise 1/2/5/10 % du capital ou 100 € fixes, bookmaker Bet365 / moyenne / meilleure cote, stratégie « tous les favoris » ou « seulement si la cote est trop belle » (proba × cote > 1), années, sports en puces avec le nombre de matchs). Simulation jour par jour (on ne mise jamais plus que le capital). Afficher : grand chiffre du capital final avec gain/perte, une phrase claire, tuiles (paris simulés, réussite réelle contre réussite promise, rendement par euro misé, favoris battus, « une défaite efface N victoires », pire chute), courbe du capital avec réticule et bulle au survol et au clavier, graphique en colonnes du rendement par niveau de favori (80–85 %, …, 99+ %) en bleu/rouge avec la zone du filtre grisée et le tableau des chiffres en dessous, tableau par sport, « les surprises qui ont coûté cher », les 100 derniers paris, la liste des sources. Expliquer pourquoi Claude n'est pas utilisé sur le passé (il connaît les résultats).
- **Paris de l'IA en direct** : capital fictif, tuiles, courbe, tableau des paris avec la raison de Claude, journal du robot, et une carte « Matchs écartés par l'IA : avait-elle raison ? » (matchs vérifiés, % de favoris battus comparé au % prévu par les cotes et aux paris placés, résultat si on avait misé 100 € sur chacun, verdict seulement à partir de 30 matchs vérifiés). Si le robot n'a jamais tourné : les étapes pour l'activer.
- Tous les textes venant des données sont insérés avec `textContent`. Un message de jeu responsable en bas de page.

## 4. Automatisation

Deux workflows GitHub Actions qui commitent les fichiers de données : « matchs passés » (à la main, le 2 de chaque mois, et quand `historique.py` change) et « paris IA du jour » (chaque matin, secrets `ODDS_API_KEY` et `ANTHROPIC_API_KEY`). Un `README.md` en français qui explique tout pas à pas, plus un `wrangler.jsonc` pour publier le dossier sur Cloudflare.

Teste tout avant de terminer : les parseurs avec des fichiers d'exemple au format exact des sources, le robot avec une fausse API, la page dans un vrai navigateur (clair, sombre, mobile, sans erreur console).

---

*Astuce : si tu veux changer la stratégie (autre seuil, mise différente, d'autres sports), modifie surtout `config.json` et les filtres du tableau de bord ; le reste n'a pas besoin de bouger.*
