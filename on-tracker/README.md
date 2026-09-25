# Suivi On Holding (ONON) + Or, avec alertes achat / vente

Petit programme qui surveille **On Holding AG (NYSE : ONON)** et **l'or (GC=F, once en USD)**,
calcule en continu un score d'analyse technique de −100 à +100, et t'envoie une
**notification sur ton téléphone** quand le signal passe à **ACHAT** ou **VENTE**.
Un tableau de bord web affiche tout en direct.

> ⚠️ Aucun indicateur ne prédit le marché avec certitude. Le programme ne sait pas
> « le » meilleur moment : il signale le moment où **la majorité des indicateurs
> techniques** sont d'accord. Les annonces (résultats trimestriels, contrats de sponsoring,
> news) peuvent tout faire basculer en quelques secondes. Ce n'est pas un conseil en investissement.

## Installation (une fois)

Il faut Python 3.10 ou plus récent.

```bash
cd on-tracker
pip install -r requirements.txt
cp config.example.json config.json
```

## Recevoir les notifications sur ton téléphone (gratuit, 2 minutes)

1. Installe l'appli **ntfy** (App Store / Play Store).
2. Dans l'appli, « S'abonner à un sujet » et invente un nom difficile à deviner,
   par ex. `paul-onon-7g4k2`.
3. Mets ce même nom dans `config.json` → `"ntfy_topic": "paul-onon-7g4k2"`.

Option Telegram : crée un bot avec @BotFather, puis remplis `telegram_bot_token`
et `telegram_chat_id`.

## Lancer

```bash
python tracker.py
```

Puis ouvre **http://127.0.0.1:8765** dans ton navigateur. Le programme doit rester
allumé pour envoyer les alertes (sur ton PC, ou sur un petit serveur / VPS pour du 24h/24).

- ONON cote à New York : **15h30 – 22h00 heure de Paris**. En dehors, le prix ne bouge pas.
- L'or (contrat à terme COMEX) cote presque 24h/24 du dimanche soir au vendredi soir.

## Ce que fait l'analyse

Pour chaque actif, 10 familles d'indicateurs votent sur **3 unités de temps** :

| Indicateur | Ce qu'il mesure |
|---|---|
| EMA 20 / 50 / 200 | direction de la tendance |
| MACD | élan, croisements haussiers / baissiers |
| ADX (+DI / −DI) | force de la tendance → décide si on est en **tendance** ou en **range** |
| RSI 14 | survente / surachat |
| Divergence RSI | essoufflement d'un mouvement |
| Stochastique | retournements dans les zones extrêmes |
| Bandes de Bollinger | position par rapport à la volatilité |
| OBV + volume | les gros volumes confirment-ils le mouvement ? |
| VWAP | prix moyen pondéré du jour (intraday) |
| Canal de Donchian | cassure du plus haut / plus bas des 20 dernières bougies |

Les oscillateurs (RSI, stochastique, Bollinger) changent de logique selon le régime :
en **range**, « suracheté » = vendre ; en **tendance forte**, « suracheté » est normal,
donc on achète plutôt les replis et on ne vend pas contre la tendance.

Score global = jour 45 % + heure 35 % + 5 min 20 %.

- Score ≥ **+35** → notification 🟢 **ACHAT probable**
- Score ≤ **−35** → notification 🔴 **VENTE probable**
- Chaque alerte donne un **stop-loss** (prix − 2 × ATR journalier) et deux **objectifs**.
- Une hystérésis + un délai minimum de 15 min évitent d'être spammé quand le score hésite.

### Si tu as déjà acheté

Renseigne ton prix d'achat dans `config.json` :

```json
"positions": { "ONON": {"prix_achat": 42.50, "quantite": 20} }
```

Le programme surveille alors un **stop suiveur** (plus haut atteint − 3 × ATR) et
t'envoie ⛔ quand il est touché : c'est le signal classique pour sortir et protéger tes gains.

## Vérifier la stratégie sur le passé (à faire !)

```bash
python backtest.py ONON            # 5 ans de bougies journalières
python backtest.py GC=F --tf 1h    # 2 ans de bougies horaires
```

Tu obtiens le nombre de trades, le % de gagnants, la perte maximale, et la comparaison
avec le fait d'avoir simplement acheté et gardé. Si la stratégie ne bat pas
l'achat-conservation, ajuste `seuil_achat` / `seuil_vente` dans `config.json`.

## Réglages (`config.json`)

| Clé | Rôle |
|---|---|
| `intervalle_secondes` | fréquence de mise à jour du prix (5 s par défaut). Descendre à 1–2 s est possible, mais Yahoo peut bloquer temporairement si on l'interroge trop souvent. |
| `seuil_achat` / `seuil_vente` | plus loin de 0 = moins d'alertes mais plus fiables |
| `delai_min_entre_alertes_minutes` | anti-spam |
| `actifs` | ajouter / retirer des symboles Yahoo Finance (ex. `SI=F` argent, `PAXG-USD` or tokenisé 24/7) |

## Données

Prix fournis gratuitement par Yahoo Finance (via `yfinance`). Pour ONON, le prix
peut avoir quelques secondes de retard ; pour de la vraie donnée « tick par tick »,
il faut un fournisseur payant ou à clé API (Finnhub, Polygon, Interactive Brokers…).

## Tests

```bash
pip install pytest && python -m pytest tests
```
