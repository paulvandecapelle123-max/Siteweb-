# Simulateur IA · grands favoris

Tester **en argent fictif** l'idée : « placer 10 000 € sur des centaines de matchs où le favori a 97 % de chances de gagner, dans tous les sports pariables en ligne ».

Deux tests complémentaires :

| Onglet | Ce qu'il fait | Données |
|---|---|---|
| **Test sur le passé** | Rejoue la stratégie sur des dizaines de milliers de **vrais matchs** depuis 2013. Tu changes le seuil (80 → 99,5 %), la mise, le bookmaker, les sports, les années : tout se recalcule. | tennis-data.co.uk (ATP, WTA), football-data.co.uk (38 championnats), aussportsbetting.com (NBA, NFL, NHL, MLB, AFL, NRL) |
| **Paris de l'IA en direct** | Chaque matin, un robot scanne les matchs à venir dans **tous les sports** de The Odds API, garde les favoris ≥ 97 %, et **Claude** (avec recherche web) décide PARIER ou PASSER. Les paris sont réglés avec les vrais résultats, et le résultat des matchs écartés est vérifié aussi : si ces favoris perdent plus souvent que prévu, Claude a vraiment du flair. | The Odds API (cotes en direct) + Claude |

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

Si un site refuse les serveurs de GitHub (le détail est dans « D'où viennent les données » en bas du tableau de bord), lance le script sur ton ordinateur, puis commite `simulateur/data/historique.js`.

## 2. Le robot IA en direct

1. Clé gratuite sur [the-odds-api.com](https://the-odds-api.com). L'offre gratuite donne environ 500 crédits par mois ; le robot en utilise 12 par jour au maximum (réglable). Avec l'offre payante, monte `credits_max_par_execution` (par ex. 600) pour scanner **toutes** les compétitions chaque jour.
2. Clé API Claude sur [console.anthropic.com](https://console.anthropic.com). Mets une **limite de dépense** dans la console. Compte environ 0,30 à 0,60 $ par lot de 12 matchs analysés : selon le nombre de grands favoris, de quelques centimes à environ 1 $ par jour.
3. GitHub → ton dépôt → **Settings → Secrets and variables → Actions → New repository secret** : `ODDS_API_KEY` puis `ANTHROPIC_API_KEY`.
4. Onglet **Actions → « Simulateur · paris IA du jour » → Run workflow**. Ensuite il tourne seul chaque matin (06:41 UTC) et commite `data/journal.js`.

Sans `ANTHROPIC_API_KEY`, le robot parie sur tous les favoris au-dessus du seuil (règle simple), ce qui sert de point de comparaison.

En local : `ODDS_API_KEY=... ANTHROPIC_API_KEY=... python simulateur/tools/live.py`.

### Réglages (`config.json`)

| Clé | Rôle |
|---|---|
| `capital_depart` | 10 000 € fictifs |
| `proba_min` | 0.97 : chances minimum du favori selon le consensus des bookmakers |
| `mise_pourcent_du_capital` | 2 : chaque pari = 2 % du capital du moment |
| `exposition_max_pourcent` | 60 : jamais plus de 60 % du capital en jeu en même temps |
| `horizon_heures` | 36 : matchs qui commencent dans les 36 prochaines heures |
| `bookmakers_min` | 3 : ignorer les matchs cotés par moins de 3 bookmakers |
| `bookmakers_pour_parier` | vide = cote moyenne des bookmakers ; sinon par ex. `["Unibet", "Betclic"]` pour prendre la meilleure cote de ceux-là |
| `credits_max_par_execution` | crédits The Odds API utilisés par jour au maximum |
| `sports_toujours_scannes` | `["Tennis"]` : le tennis (où les favoris à 97 % sont les plus fréquents) est scanné chaque jour, les autres sports tournent |
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
