# Simulateur IA · grands favoris

Tester **en argent fictif** l'idée : « placer 10 000 € sur des centaines de matchs où le favori a 97 % de chances de gagner, dans tous les sports pariables en ligne ».

Deux tests complémentaires :

| Onglet | Ce qu'il fait | Données |
|---|---|---|
| **Test sur le passé** | Rejoue la stratégie sur des dizaines de milliers de **vrais matchs** depuis 2013. Tu changes le seuil (80 → 99,5 %), la mise, le bookmaker, les sports, les années : tout se recalcule. | tennis-data.co.uk (ATP, WTA), football-data.co.uk (38 championnats), aussportsbetting.com (NBA, NFL, NHL, MLB, AFL, NRL) |
| **Paris de l'IA en direct** | **Toutes les heures**, un moteur repère les favoris ≥ 97 % dans **tous les sports pariables** de The Odds API (football, tennis, basket, hockey, baseball, football américain, MMA, boxe, rugby, cricket…) et les met en surveillance. Environ 1 h avant chaque match, il rafraîchit la cote et **Claude** fait une dernière recherche web (composition, blessures, forfaits, problèmes personnels, enjeu) avant de décider PARIER ou PASSER. Les paris sont réglés avec les vrais résultats, et le résultat des matchs écartés est vérifié aussi : si ces favoris perdent plus souvent que prévu, Claude a vraiment du flair. | The Odds API (cotes en direct) + Claude |

Aucun argent réel n'est jamais engagé : il n'y a aucun lien avec un compte de bookmaker.

## Structure

```
simulateur/
  index.html              le tableau de bord (s'ouvre aussi en double-cliquant)
  assets/app.js           calculs + graphiques (aucune dépendance)
  assets/style.css        style clair / sombre
  data/historique.js      vrais matchs passés (généré par tools/historique.py)
  data/journal.js         paris de l'IA en direct (généré par tools/live.py)
  config.json             réglages du robot IA (capital, seuil, mise, sports, modèle…)
  tools/historique.py     télécharge les matchs passés
  tools/live.py           robot quotidien (cotes du jour + décisions de Claude + résultats)
  PROMPT.md               le prompt complet pour recréer ce simulateur
.github/workflows/
  simulateur-historique.yml   met à jour les matchs passés (le 2 de chaque mois)
  simulateur-ia.yml           robot IA (chaque matin)
```

## 1. Les matchs passés

Le plus simple : **GitHub → onglet Actions → « Simulateur · matchs passés » → Run workflow**. En 10 à 20 minutes, `data/historique.js` est créé et commité. Il se met ensuite à jour tout seul chaque mois.

Sur ton ordinateur :

```
pip install -r simulateur/tools/requirements.txt
python simulateur/tools/historique.py          # tout depuis 2013
python simulateur/tools/historique.py --rapide # les 3 dernières saisons
```

Puis ouvre `simulateur/index.html`.

**Tennis et sports US :** tennis-data.co.uk et aussportsbetting.com refusent les serveurs de GitHub (erreur 403). Deux solutions :
- **Depuis n'importe quel navigateur (même un Chromebook) :** télécharge les fichiers `.xlsx` de ces sites et dépose-les dans `simulateur/fichiers/` sur GitHub (Add file → Upload files). GitHub relance le calcul tout seul. Les liens sont dans `simulateur/fichiers/LISEZMOI.md`.
- **Depuis un ordinateur avec Python :** lance le script, puis dépose le nouveau `simulateur/data/historique.js` sur GitHub. Les mises à jour automatiques suivantes gardent ces matchs : quand un site refuse le téléchargement, le script reprend les matchs de ce sport déjà présents dans le fichier. Pour ajouter les nouveaux matchs de tennis, relance le script sur ton ordinateur de temps en temps.

## 2. Le moteur IA en direct (toutes les heures)

1. Clé sur [the-odds-api.com](https://the-odds-api.com). Le moteur répartit tout seul les crédits du mois heure par heure, quelle que soit l'offre (vérifie les prix sur leur site) :
   - **offre gratuite** (environ 500 crédits par mois) : environ 16 compétitions scannées par jour, donc chaque compétition revue tous les quelques jours. Bien pour tester ;
   - **offre payante** (par ex. 20 000 crédits par mois) : toutes les compétitions de tous les sports revues toutes les 8 h (le tennis toutes les 4 h), plus la cote remise à jour juste avant chaque décision.
2. Clé API Claude sur [console.anthropic.com](https://console.anthropic.com). Mets une **limite de dépense** dans la console. Claude n'est appelé que quand un match surveillé approche (et pour retrouver les résultats introuvables) : compte environ 0,20 à 0,40 $ par appel, soit de quelques centimes à quelques dollars par jour selon le nombre de grands favoris. `"modele": "claude-sonnet-5-5"` divise environ le coût par deux.
3. GitHub → ton dépôt → **Settings → Secrets and variables → Actions → New repository secret** : `ODDS_API_KEY` puis `ANTHROPIC_API_KEY`.
4. Onglet **Actions → « Simulateur · moteur IA (toutes les heures) » → Run workflow**. Ensuite il tourne seul toutes les heures (à hh:17 UTC). Il ne commite `data/journal.js` que quand il s'est passé quelque chose. GitHub Actions est gratuit pour un dépôt public ; pour un dépôt privé, une exécution par heure reste dans les 2 000 minutes gratuites par mois.

Pourquoi décider 1 h avant le match : c'est là qu'on connaît les compositions officielles, les forfaits de dernière minute et les mauvaises nouvelles personnelles. Une recherche faite la veille les raterait.

Sans `ANTHROPIC_API_KEY`, le robot parie sur tous les favoris au-dessus du seuil (règle simple), ce qui sert de point de comparaison.

En local : `ODDS_API_KEY=... ANTHROPIC_API_KEY=... python simulateur/tools/live.py`.

### Réglages (`config.json`)

| Clé | Rôle |
|---|---|
| `capital_depart` | 10 000 € fictifs |
| `proba_min` | 0.97 : chances minimum du favori selon le consensus des bookmakers |
| `mise_pourcent_du_capital` | 2 : chaque pari = 2 % du capital du moment |
| `exposition_max_pourcent` | 60 : jamais plus de 60 % du capital en jeu en même temps |
| `horizon_heures` | 36 : favoris mis en surveillance s'ils jouent dans les 36 prochaines heures |
| `fenetre_decision_heures` | 1.5 : Claude décide quand le match commence dans moins d'1 h 30 (le moteur passe chaque heure, donc entre 30 min et 1 h 30 avant) |
| `rafraichir_cotes` | true : remet la cote à jour juste avant la décision (1 crédit par match) |
| `intervalle_scan_heures` | 8 : chaque compétition est revue au plus toutes les 8 h |
| `sports_prioritaires` | `["Tennis"]` : revus deux fois plus souvent (là où les favoris à 97 % sont les plus fréquents) |
| `bookmakers_min` | 3 : ignorer les matchs cotés par moins de 3 bookmakers |
| `bookmakers_pour_parier` | vide = cote moyenne des bookmakers ; sinon par ex. `["Unibet", "Betclic"]` pour prendre la meilleure cote de ceux-là |
| `credits_max_par_execution` | 40 : crédits The Odds API utilisés par heure au maximum (en plus du rythme mensuel automatique) |
| `ia.modele` | `claude-opus-5-5` par défaut ; `claude-sonnet-5-5` coûte environ deux fois moins cher |
| `ia.effort` | `medium` : profondeur de réflexion de Claude |

## Comment sont calculées les « chances »

Les cotes contiennent la marge du bookmaker. On la retire avec la **méthode « puissance »** (on cherche k tel que la somme des (1/cote)^k fasse 1). Elle tient compte du fait que les bookmakers prennent surtout leur marge sur l'outsider, ce qui compte beaucoup pour les très grands favoris : avec cette méthode, une cote de 1,02 contre 17 donne environ 97,5 %.

- Sur le passé : la probabilité vient de Pinnacle (le bookmaker le plus précis) quand il est disponible, sinon de la moyenne du marché. On parie à la cote Bet365, à la moyenne ou à la meilleure cote, selon ton choix.
- **Claude n'est pas utilisé sur le passé** : il connaît le résultat de beaucoup d'anciens matchs et tricherait sans le vouloir. Le vrai test de l'IA, c'est l'onglet en direct.
- Football : un match nul = pari perdu. Tennis : forfait avant le match = remboursé ; abandon en cours de match = le joueur qui passe au tour suivant gagne (règle Bet365).

## Mettre en ligne (Cloudflare)

Comme NMcars : Workers & Pages → Create → Connect to Git → ce dépôt → **Root directory = `simulateur`**. Le dossier `tools/` n'est pas publié.

Le robot commite chaque jour : pour éviter de reconstruire aussi les autres sites, règle **Build watch paths** dans les projets Cloudflare des autres sites (par ex. `nmcars/*` pour NMcars, `chapiteaux/*` pour Chapiteau'bel).

La page n'est pas indexée par Google (`noindex`). Si le portfolio est publié depuis la racine du dépôt, elle sera aussi visible sur `/simulateur/` : protège-la avec Cloudflare Access si tu veux qu'elle reste privée.
