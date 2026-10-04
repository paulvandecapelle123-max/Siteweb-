# 📈 Simulateur de bourse (paper trading)

Application web locale pour apprendre à trader avec **5 000 € fictifs** sur les bourses du monde entier :
Nasdaq, NYSE, Euronext (Bruxelles, Paris, Amsterdam, Lisbonne, Dublin, Milan, Oslo), Xetra/Francfort, Londres,
Madrid, Zurich, Stockholm, Copenhague, Helsinki, Vienne, Varsovie, Tokyo, Hong Kong, Shanghai, Shenzhen, Toronto,
Sydney, Séoul, Taïwan, Singapour, Inde, São Paulo, Mexico…

Tout tourne sur ton ordinateur : un petit serveur Node.js interroge les sources de données (tes clés API restent
chez toi, jamais dans la page) et une page web affiche le tout. Aucun compte à créer, à part deux clés API
gratuites **facultatives**.

## Installation et lancement

1. Installe **Node.js 22 ou plus récent** (version « LTS ») depuis <https://nodejs.org>.
2. Récupère ce dossier (`git clone` du dépôt ou « Download ZIP » sur GitHub), puis ouvre un terminal dans `simulateur-bourse/`.
3. Lance :

   ```bash
   npm start
   ```

   Au premier lancement, les dépendances s'installent toutes seules (une minute environ), puis le navigateur
   s'ouvre sur <http://localhost:3000>. `Ctrl+C` dans le terminal pour arrêter.

   Sous Windows, tu peux aussi double-cliquer sur `demarrer-windows.bat` ; sous macOS, sur `demarrer-mac.command`.

Autres commandes :

| Commande | Effet |
|---|---|
| `npm run demo` | Mode démo : prix **simulés**, fonctionne sans Internet (données séparées dans `data/demo/`) |
| `npm run reseau` | Rend l'appli accessible depuis ton téléphone sur le même Wi-Fi (adresse affichée dans le terminal) |
| `npm run reconstituer` | Recrée un portefeuille à partir d'achats passés (vrais cours Yahoo du moment de l'achat), par exemple sur un deuxième ordinateur ; voir `outils/reconstituer.js` |
| `npm test` | Tests automatiques (moteur d'ordres, calendrier des bourses) |
| `PORT=4000 npm start` | Autre port (si 3000 est pris, le serveur essaie automatiquement 3001, 3002…) |

## Clés API gratuites (facultatives)

Sans aucune clé, l'appli fonctionne déjà avec Yahoo Finance pour toutes les bourses. Les clés améliorent les
actions américaines. Colle-les dans l'onglet **Réglages** (bouton « Tester » pour vérifier) : elles sont
enregistrées dans `data/reglages.json`, sur ton ordinateur uniquement.

- **Finnhub** — temps réel US par WebSocket : crée un compte sur <https://finnhub.io/register>, la clé est
  affichée sur ton tableau de bord (<https://finnhub.io/dashboard>).
- **Twelve Data** — source de secours US : crée un compte sur <https://twelvedata.com/register>, puis
  *Account → API Keys* (<https://twelvedata.com/account/api-keys>).

## Sources de données : comparaison et choix

| Source | Clé | Couverture | Fraîcheur | Limites de l'offre gratuite | Rôle dans l'appli |
|---|---|---|---|---|---|
| **Yahoo Finance** (bibliothèque `yahoo-finance2` v4) | non | quasi toutes les bourses mondiales, indices, ETF, devises | temps réel pour les actions US, 15–20 min de différé pour la plupart des autres bourses (indiqué pour chaque cotation) | API non officielle, pas de quota publié (Yahoo peut ralentir en cas d'abus) | **source principale** : cotations, recherche par nom, historiques, taux de change |
| **Finnhub** | oui (gratuite) | actions US uniquement en gratuit (les autres bourses sont payantes) | temps réel (WebSocket, transactions une par une) | 60 appels/min, 50 symboles en WebSocket | **temps réel US** des positions, ordres et favoris ; secours US |
| **Twelve Data** | oui (gratuite) | actions US, forex, crypto en gratuit (Europe/Asie payantes) | temps réel US | 800 crédits/jour, 8/min | **secours** US (cotations, historiques) si Yahoo ne répond pas |
| **Frankfurter** (taux de référence BCE) | non | ~30 devises face à l'euro | 1 fois par jour ouvré | aucune | **secours** pour les taux de change |

Chaque prix affiche une pastille **En direct**, **Différé de X min** ou **Marché fermé**, et la source utilisée.
Le serveur actualise les prix toutes les 15 s (réglable) et pousse les changements vers la page en continu.

## Ce que fait l'appli

- **Portefeuille** : liquidités (dont réservées par les ordres en attente), positions, prix moyen d'achat, valeur,
  plus/moins-value latente et réalisée en € et %, variation du jour, frais payés, répartition par pays et par
  secteur, courbe de la valeur du compte comparée à un ETF MSCI World (`IWDA.AS`, réglable).
- **Marchés** : recherche par nom ou ticker avec filtre par pays/bourse/région, prix en devise d'origine et en €.
- **Fiche action** : graphique TradingView (1 jour, 1 semaine, 1 mois, 1 an, 5 ans ; ligne ou bougies),
  chiffres clés (52 semaines, volume, PER, volatilité…), horaires de la bourse en heure de Bruxelles.
- **Ordres** : achat/vente au marché, ordres limite, stop-loss et take-profit (à l'achat ou sur une position
  existante). Si la bourse est fermée, l'ordre attend l'ouverture et s'exécute au premier cours du jour.
- **Frais réalistes** (modifiables) : 1 € + 0,10 % en Europe, 2 € + 0,15 % ailleurs, 0,25 % de frais de change,
  fourchette achat/vente, et en option la **TOB** belge.
- **Devises** : conversion automatique (USD, GBP — y compris les cours en pence de Londres —, CHF, JPY, HKD, CAD…).
- **Horaires** : ouverture/fermeture de chaque bourse (pauses de midi en Asie, changements d'heure, principaux
  jours fériés ; les jours fériés non prévus sont détectés quand l'indice local ne cote pas).
- **Historique** de toutes les transactions (export CSV), **favoris**, **journal de trading** (« Pourquoi je
  prends cette position ? » + « Ce que j'en retiens »), **statistiques** (nombre de trades, % de gagnants,
  meilleur/pire trade, baisse maximale, volatilité, comparaison avec l'indice mondial).
- **Bulles d'aide (?)** sur chaque terme, lexique complet dans l'onglet Aide. Mode sombre (et clair), utilisable sur téléphone.
- **Réinitialisation** du portefeuille (avec confirmation ; l'ancien est archivé dans `data/archives/`).

Limites volontaires : pas de vente à découvert, ni levier, ni options ; dividendes non versés ; lots minimum
de Tokyo/Hong Kong ignorés ; ordres exécutés au dernier cours connu (qui peut être différé).

## Où sont mes données ?

Tout est dans le dossier `data/` (ignoré par git) :

- `data/portefeuille.json` — liquidités, positions, ordres, journal, favoris, historique de valeur
- `data/reglages.json` — clés API et réglages
- `data/cache.json` — derniers taux de change, secteurs et pays des sociétés
- `data/archives/` — anciens portefeuilles après réinitialisation

## Organisation du code

```
start.js                 lanceur (vérifie Node, installe les dépendances, ouvre le navigateur)
server.js                serveur HTTP : API, flux temps réel (SSE), fichiers de la page
lib/marketdata.js        agrégation des sources, cache, rafraîchissement, recherche, historiques
lib/providers/           Yahoo, Finnhub (REST + WebSocket), Twelve Data, mode démo
lib/fx.js                taux de change (Yahoo + secours BCE)
lib/markets.js           bourses : suffixes de ticker, devises, horaires, états ouverte/fermée
lib/holidays.js          jours fériés boursiers
lib/engine.js            moteur d'ordres, frais, positions, statistiques
lib/catalog.js           indices du bandeau, ETF associés, catalogue d'actions connues
public/                  page web (HTML, CSS, JavaScript sans compilation)
test/                    tests automatiques (node --test)
```

Données fournies à titre indicatif, sans garantie : ce simulateur sert à apprendre, pas à conseiller des investissements.
