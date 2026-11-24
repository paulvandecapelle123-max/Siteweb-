# PromptMix (prototype)

Un DJ dépose 2 ou 3 MP3, écrit en français le mix qu'il veut, et reçoit le mix en MP3 320 kbps
avec la tracklist minutée (artiste – titre lus dans les tags ID3, sinon dans le nom du fichier).

## Démarrage local

Prérequis : Python ≥ 3.10 et **ffmpeg compilé avec libmp3lame et librubberband**
(vérifier avec `ffmpeg -filters | grep rubberband`).

```bash
cd promptmix
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...        # facultatif : sans clé, un planificateur local par mots-clés prend le relais
uvicorn promptmix.server:app --port 8000
# puis ouvrir http://localhost:8000
```

Au premier lancement, le détecteur `beat_this` télécharge son modèle (~80 Mo). Pour s'en passer :
`PROMPTMIX_BEAT_ENGINE=dsp` (détecteur DSP intégré). Variables disponibles : voir `.env.example`.

Tests : `python -m pytest -q tests` (≈ 3 min, aucun fichier externe ni clé API nécessaires).

## Déroulé dans l'interface

1. **Dépôt** de 2 ou 3 MP3 (≤ 50 Mo chacun), case « J'ai les droits sur ces fichiers » obligatoire.
2. **Analyse** : BPM, tonalité (+ Camelot), sections. Le BPM et la tonalité sont modifiables
   (boutons ÷2 / ×2 pour les versions « sped up » ou demi-tempo) ; une correction de BPM relance la grille.
3. **Prompt** (pré-rempli avec un exemple) puis **Mixer** : barre de progression.
4. **Résultat** : lecteur, téléchargement MP3 et tracklist .txt, explication du plan, transitions,
   contrôles automatiques.

## Architecture : 4 modules testables séparément

```
promptmix/
├── README.md  requirements.txt  .env.example
├── promptmix/
│   ├── config.py            constantes (LUFS, true peak, tolérances, fondus anti-clic, 24 h)
│   ├── audio_io.py          décodage ffmpeg, encodage MP3, time-stretch Rubber Band, tags ID3
│   ├── analysis/            ── 1. ANALYSE
│   │   ├── beats.py         grille des temps / mesures (beat_this + affinage DSP multibande)
│   │   ├── sections.py      intro / groove / break / montée / drop / outro (énergie des basses par mesure)
│   │   ├── key.py           tonalité (Krumhansl) + Camelot + lecture des corrections (« Am », « 8A »…)
│   │   └── analyze.py       analyse complète d'un morceau + résumé envoyé à Claude
│   ├── plan/                ── 2. PLAN
│   │   ├── schema.py        schéma Pydantic MixPlan + normalisation (bornes, durée à l'échantillon)
│   │   └── planner.py       appel API Claude (sortie structurée) ; repli local sans clé
│   ├── render/              ── 3. RENDU (numpy/scipy, sans IA)
│   │   ├── dsp.py           fondus, biquads résonants balayés, split graves, delay, réverb, riser, rewind
│   │   ├── transitions.py   les 11 transitions + début / fin du mix
│   │   └── engine.py        extraction, étirement, égalisation LUFS des extraits, placement, mixage
│   ├── master/              ── 4. MASTER
│   │   ├── loudness.py      LUFS (BS.1770), true peak ×4, limiteur à anticipation
│   │   └── export.py        -11 LUFS, limiteur, MP3 320 kbps, re-mesure du true peak sur le MP3 décodé
│   ├── verify.py            contrôles après rendu
│   ├── pipeline.py          orchestration analyse → plan → rendu → master → contrôles
│   ├── server.py            FastAPI : dépôt, tâches en arrière-plan, téléchargements, purge 24 h
│   └── static/              interface en français (HTML/CSS/JS sans dépendance)
└── tests/                   pistes de clics / « techno » synthétiques à tempo connu
```

### 1. Analyse
- Décodage ffmpeg en 44,1 kHz stéréo float.
- Grille : estimation par **beat_this** (réseau de neurones temps + premiers temps de mesure), puis
  affinage DSP en supposant un tempo constant : la période retenue est celle qui « replie » le plus
  nettement l'enveloppe d'attaques (précision < 0,01 BPM). Sans beat_this : autocorrélation + correction d'octave.
- **Basse syncopée** : la phase est mesurée sur 3 bandes (< 150 Hz, complète, > 4 kHz). On choisit la phase
  portée par les attaques les plus fortes de la bande complète, validée par les aigus (charleys sur le temps
  ou le contretemps) ; les basses seules ne décident jamais. L'écart de chaque bande est affiché.
- Premier temps de mesure : vote du réseau ; s'il hésite, accents + entrées/sorties franches de la basse.
- Sections et repères fiables : débuts de drop et reprises de la grosse caisse après un break.

### 2. Plan
Le prompt + le résumé d'analyse partent à Claude (`claude-opus-5-5`, réflexion adaptative, sortie structurée
validée par le schéma Pydantic `MixPlan`, repli serveur en cas de refus). Le plan contient : tempo cible,
durée, extraits (début et longueur **en mesures**), ordre, et pour chaque jonction le type de transition et sa
durée en mesures ; la position découle du chevauchement. Une normalisation déterministe borne tout
aux morceaux, ne déplace jamais un extrait censé entrer sur son drop, et cale la durée à l'échantillon près.

### 3. Rendu
Chaque extrait est découpé sur un premier temps de mesure, étiré au tempo cible par Rubber Band (tonalité
conservée), mis à -14 LUFS, puis placé à la mesure près sur la ligne de temps. Transitions :
fondu, filtre passe-haut / passe-bas résonant balayé, bass swap (échange des graves sur le premier temps),
echo out (delay à 3/4 de temps), riser + coupure nette sur le drop, rewind accéléré, loop roll
(1/2 → 1/4 → 1/8 → 1/16 de temps), blackout (un temps de silence), réverb, coupe franche.
Anti-clic : 5 ms de fondu à chaque coupe, fondu enchaîné sec↔filtré de 60 ms en début et fin de filtre,
35 ms avant un blackout.

### 4. Master
Gain vers -11 LUFS, limiteur true peak (suréchantillonnage ×4, anticipation 5 ms), export MP3 320 kbps ;
le true peak est re-mesuré **sur le MP3 décodé** et le plafond est resserré si l'encodeur l'a fait dépasser -1 dBTP.

### Contrôles automatiques
- **Tests** : pistes de clics générées à tempo connu (95 à 174 BPM, décalages et premiers temps variés) :
  grille juste à 10 ms près, avec les deux détecteurs ; basse syncopée ; BPM imposé.
- **Après chaque rendu** : durée (±0,5 s), true peak ≤ -1 dBTP, sonie, et alignement des temps de chaque
  transition (phase mesurée sur les deux extraits, sur des mesures avec grosse caisse, tolérance 20 ms).
  Les résultats s'affichent dans l'interface et dans `result.json`.

## Règles
- Uniquement des fichiers déposés par l'utilisateur ; aucun téléchargement depuis un site.
- Contrôles au dépôt : extension, type, signature MP3, codec (ffprobe), 50 Mo, 2–3 fichiers, case des droits.
- Fichiers supprimés 24 h après le rendu (et 24 h après le dépôt s'il n'y a pas eu de rendu).
- Clé API uniquement dans `ANTHROPIC_API_KEY` (jamais dans le code ; `.env` est ignoré par git).

## Limites connues de cette première version
- Tempo supposé constant dans chaque morceau (adapté à la musique électronique, pas aux enregistrements live).
- Mesures à 4 temps uniquement. Pas de changement de tonalité (seulement le choix de l'ordre selon Camelot).
- Tâches gérées en mémoire + JSON sur disque, 2 rendus en parallèle : suffisant en local, pas pour un service public.
- Un mix de 5 minutes prend environ 1 minute de calcul sur CPU.
