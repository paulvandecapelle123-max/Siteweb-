"""Lexique des techniques de DJ : source unique pour Claude, le planificateur local et l'interface.

Chaque technique a :
- `id` : type de transition exécuté par le moteur (ou None si la technique n'est pas encore réalisable) ;
- `nom` : nom affiché ; `synonymes` : façons dont les DJ en parlent (français, anglais, argot) ;
- `regex` : motif de reconnaissance pour le planificateur local (sans API) ;
- `dj` : description technique ; `simple` : explication pour quelqu'un qui n'est pas DJ ;
- `quand` : quand l'utiliser ; `mesures` : durée conseillée (en mesures de 4 temps).
"""
from __future__ import annotations

TECHNIQUES: list[dict] = [
    # ------------------------------------------------------------------ enchaînements longs
    {"id": "fondu", "famille": "Enchaînements longs", "nom": "Fondu enchaîné",
     "synonymes": ["fondu", "crossfade", "fade", "blend", "mix long", "transition douce", "smooth"],
     "regex": r"fondu|cross ?fade|\bfade\b|\bblend|mix long|transition douce|\bsmooth",
     "dj": "Les deux morceaux jouent ensemble, volume croisé à puissance constante.",
     "simple": "Un morceau baisse pendant que l'autre monte.",
     "quand": "Morceaux proches en tempo et en tonalité, ambiance calme ou deep.", "mesures": "8 à 32 mesures"},
    {"id": "bass_swap", "famille": "Enchaînements longs", "nom": "Bass swap",
     "synonymes": ["bass swap", "échange des basses", "swap des basses", "switch de basse"],
     "regex": r"bass ?swap|[ée]change (des|de) basses?|swap (des|de) basses?|switch (de|des) basses?",
     "dj": "L'entrant joue sans basses par-dessus le sortant, puis les basses s'échangent net sur un premier temps de mesure.",
     "simple": "Les deux morceaux jouent ensemble, mais un seul a ses basses à la fois : on les échange d'un coup.",
     "quand": "Transition house/techno classique, garde l'énergie sans boue dans les basses.", "mesures": "8 à 16 mesures"},
    {"id": "eq_3_bandes", "famille": "Enchaînements longs", "nom": "Mix aux EQ (3 bandes)",
     "synonymes": ["mix aux EQ", "EQ mixing", "mix à l'égaliseur", "aigus médiums basses", "mix progressif aux EQ", "EQ swap"],
     "regex": r"\beq\b|[ée]galiseur|aigus.*m[ée]diums|mix progressif",
     "dj": "Entrée progressive de l'entrant bande par bande (aigus, puis médiums), bass swap au milieu, puis sortie des médiums et aigus du sortant.",
     "simple": "Le nouveau morceau entre petit à petit, d'abord ses sons aigus, puis le reste, et les basses s'échangent au milieu.",
     "quand": "Long mix très propre, tech house, techno, progressive.", "mesures": "16 à 32 mesures"},
    {"id": "double_drop", "famille": "Enchaînements longs", "nom": "Double drop",
     "synonymes": ["double drop", "drop sur drop", "deux drops en même temps", "drop swap", "mashup de drops"],
     "regex": r"double ?drop|drop sur (le )?drop|deux drops|drop swap|mash ?up de drops",
     "dj": "Les deux drops démarrent ensemble, calés au temps près ; on garde les basses de l'entrant, le sortant s'efface ensuite.",
     "simple": "Les deux moments forts des morceaux explosent en même temps.",
     "quand": "Moment fort, morceaux compatibles en tonalité (EDM, dubstep, drum'n'bass, bass music).", "mesures": "4 à 16 mesures"},
    {"id": "filtre_passe_haut", "famille": "Filtres", "nom": "Filtre passe-haut (HPF)",
     "synonymes": ["passe-haut", "high pass", "HPF", "filtrer les basses", "le son devient fin", "filtre qui monte"],
     "regex": r"passe[- ]haut|high ?pass|\bhpf\b|filtre qui monte|filtr\w* les basses|devient (tout )?fin",
     "dj": "Le sortant monte dans un passe-haut résonant (il perd ses graves et devient « fin ») pendant que l'entrant s'ouvre.",
     "simple": "Le morceau qui part devient de plus en plus fin, comme s'il s'éloignait vers le haut.",
     "quand": "Sortir proprement d'un morceau chargé en basses, créer une tension.", "mesures": "4 à 16 mesures"},
    {"id": "filtre_passe_bas", "famille": "Filtres", "nom": "Filtre passe-bas (LPF)",
     "synonymes": ["passe-bas", "low pass", "LPF", "son étouffé", "comme sous l'eau", "filtre qui se ferme"],
     "regex": r"passe[- ]bas|low ?pass|\blpf\b|[ée]touff|sous l'eau|filtre qui (se )?ferme",
     "dj": "Le sortant se ferme dans un passe-bas résonant (son étouffé) pendant que l'entrant arrive par les aigus.",
     "simple": "Le morceau qui part devient sourd, comme entendu depuis une autre pièce.",
     "quand": "Ambiance qui retombe, passage vers un morceau plus brillant.", "mesures": "4 à 16 mesures"},
    # ------------------------------------------------------------------ boucles et effets rythmiques
    {"id": "loop_morph", "famille": "Boucles", "nom": "Boucle qui se transforme (loop morph)",
     "synonymes": ["boucle qui se transforme", "loop qui devient le rythme du suivant", "loop transition",
                   "boucle de fin qui prend le beat du morceau suivant", "beat juggling", "loop tricks"],
     "regex": r"loop ?morph|beat ?juggl|loop transition|loop tricks|boucle qui (se transforme|devient|prend)|"
              r"loop qui (devient|prend|se transforme)|"
              r"(boucle|loop)[^.;!?]{0,200}(rythm\w*|beat|groove)[^.;!?]{0,80}"
              r"(suivant|ensuite|d'apr[èe]s|prochain|rajoute|ajoute)",
     "dj": "Un petit bout de la fin du sortant (½ temps) est mis en boucle ; la boucle raccourcit, puis est redéclenchée "
           "sur le rythme exact du morceau entrant, qui monte en dessous et finit par prendre le relais.",
     "simple": "On répète en boucle un petit morceau de la fin du son, on change sa façon de se répéter, "
               "et petit à petit cette boucle suit le rythme de la chanson suivante, qui prend la place.",
     "quand": "Transition créative entre deux morceaux de rythmes différents, effet « live ».", "mesures": "2 à 4 mesures"},
    {"id": "loop_roll", "famille": "Boucles", "nom": "Loop roll / beat repeat",
     "synonymes": ["loop roll", "beat repeat", "roll", "stutter", "boucles qui accélèrent", "bégaiement"],
     "regex": r"loop ?roll|beat ?repeat|\broll\b|stutter|b[ée]gai|boucles? qui acc[ée]l[èe]r",
     "dj": "Fin du sortant en boucles de plus en plus courtes : 1/2, 1/4, 1/8 puis 1/16 de temps, puis l'entrant tombe.",
     "simple": "Le son se met à bégayer de plus en plus vite juste avant le morceau suivant.",
     "quand": "Juste avant un drop, effet de tension très court.", "mesures": "1 mesure (2 max)"},
    {"id": "trance_gate", "famille": "Boucles", "nom": "Gate / trance gate",
     "synonymes": ["gate", "trance gate", "hachage", "son haché", "chop", "coupures rythmiques"],
     "regex": r"\bgate\b|trance ?gate|hach(é|e|age)|\bchop|coupures rythmiques",
     "dj": "Le sortant est haché en doubles-croches (motif rythmique on/off), puis l'entrant démarre.",
     "simple": "Le son est découpé en petits morceaux rapides, comme un stroboscope sonore.",
     "quand": "Trance, techno, hard : relancer l'énergie avant un drop.", "mesures": "1 à 4 mesures"},
    {"id": "echo_out", "famille": "Effets de sortie", "nom": "Echo out",
     "synonymes": ["echo out", "écho", "delay", "écho de sortie", "echo freeze"],
     "regex": r"[ée]cho|\bdelay\b",
     "dj": "Le dernier temps du sortant part dans un delay calé sur le tempo, le sortant est coupé, les échos s'éteignent sous l'entrant.",
     "simple": "Le morceau s'arrête et sa dernière note se répète en écho qui s'éloigne.",
     "quand": "Changer de style ou de tempo, sortie élégante.", "mesures": "2 à 8 mesures de queue d'écho"},
    {"id": "reverb_out", "famille": "Effets de sortie", "nom": "Fin dans une réverb (reverb wash)",
     "synonymes": ["réverb", "reverb out", "reverb wash", "fin dans une réverbération", "noyer dans la réverb"],
     "regex": r"r[ée]verb",
     "dj": "La dernière mesure du sortant part dans une grande réverb, le sortant est coupé, la queue passe sous l'entrant.",
     "simple": "Le son s'arrête comme s'il résonnait dans une cathédrale.",
     "quand": "Fin de mix, passage vers un break ou un morceau calme.", "mesures": "2 à 8 mesures de queue"},
    {"id": "tape_stop", "famille": "Effets de sortie", "nom": "Tape stop / brake",
     "synonymes": ["tape stop", "brake", "vinyl brake", "power down", "arrêt de platine", "le son ralentit et s'arrête"],
     "regex": r"tape ?stop|\bbrake|power ?down|arr[êe]t (de )?(la )?platine|ralenti\w* (et|puis) s'arr[êe]t",
     "dj": "Le sortant ralentit jusqu'à l'arrêt (vitesse et hauteur qui chutent, comme une platine qu'on coupe), puis l'entrant démarre.",
     "simple": "Le son ralentit et descend dans les graves jusqu'à s'arrêter, comme une cassette qui meurt.",
     "quand": "Coupure spectaculaire, hip-hop, bass music, changement de tempo.", "mesures": "2 temps"},
    {"id": "rewind", "famille": "Effets de sortie", "nom": "Rewind / spinback",
     "synonymes": ["rewind", "spinback", "backspin", "rembobiner", "à l'envers", "pull up"],
     "regex": r"rewind|spin ?back|back ?spin|[àa] l'envers|rembobin|pull ?up",
     "dj": "Les 2 derniers temps du sortant sont joués à l'envers en accélérant, puis l'entrant démarre.",
     "simple": "Le son repart en arrière très vite, comme un DJ qui fait tourner le disque à l'envers.",
     "quand": "Reggae, dancehall, drum'n'bass, hip-hop ; effet « encore une fois ! ».", "mesures": "2 temps"},
    # ------------------------------------------------------------------ montées et coupures
    {"id": "riser_drop", "famille": "Montées et coupures", "nom": "Riser + coupure sur le drop",
     "synonymes": ["riser", "montée de bruit", "white noise", "uplifter", "sweep", "build-up"],
     "regex": r"riser|white ?noise|bruit blanc|uplifter|\bsweep\b|build[- ]?up|mont[ée]e de bruit",
     "dj": "Montée de bruit filtré sur la fin du sortant, coupure nette, l'entrant démarre sur son drop.",
     "simple": "Un « whoosh » qui monte, monte… puis tout explose sur le refrain du morceau suivant.",
     "quand": "Entrer pile sur un drop, festival, EDM.", "mesures": "4 à 16 mesures"},
    {"id": "build_roll", "famille": "Montées et coupures", "nom": "Roulement de caisse claire",
     "synonymes": ["snare roll", "roulement", "roulement de caisse claire", "caisse claire qui accélère", "snare build"],
     "regex": r"snare ?(roll|build)?|roulement( de caisse claire)?|caisse claire( qui acc[ée]l[èe]re)?",
     "dj": "Coups de caisse claire de plus en plus serrés (noires, croches, doubles, triples) sur la fin du sortant, puis drop.",
     "simple": "Des coups de batterie qui s'accélèrent jusqu'à l'explosion.",
     "quand": "Build-up EDM, trance, hardstyle.", "mesures": "4 à 8 mesures"},
    {"id": "blackout", "famille": "Montées et coupures", "nom": "Blackout",
     "synonymes": ["blackout", "silence avant le drop", "temps de silence", "drop silence", "cut avant le drop"],
     "regex": r"blackout|silence|cut avant",
     "dj": "Un temps de silence complet juste avant l'entrée de l'entrant (idéalement son drop).",
     "simple": "Tout se tait une fraction de seconde, puis le morceau suivant tombe d'un coup.",
     "quand": "Effet de surprise avant un drop.", "mesures": "1 temps"},
    {"id": "coupe", "famille": "Montées et coupures", "nom": "Coupe franche (cut / quick mix)",
     "synonymes": ["coupe franche", "cut", "quick cut", "cut sec", "slam", "drop in", "transition sèche"],
     "regex": r"coupe (franche|s[èe]che|nette)|\bcut\b|quick ?mix|transition s[èe]che|\bslam\b|drop[- ]in",
     "dj": "Passage instantané d'un morceau à l'autre sur un premier temps (fondus anti-clic de 5 ms).",
     "simple": "On passe d'un morceau à l'autre d'un coup, pile dans le rythme.",
     "quand": "Hip-hop, open format, énergie maximale.", "mesures": "instantané"},
    # ------------------------------------------------------------------ pas encore réalisable
    {"id": None, "famille": "Pas encore disponible", "nom": "Acapella / mashup de voix",
     "synonymes": ["acapella", "a cappella", "mashup", "voix d'un morceau sur un autre"],
     "regex": r"a ?cap+el+a|mash ?up|voix d'un morceau sur",
     "dj": "Poser la voix isolée d'un morceau sur l'instrumental d'un autre.",
     "simple": "Mélanger la voix d'une chanson avec la musique d'une autre.",
     "quand": "Nécessite une séparation des pistes (voix / instruments) : prévue dans une version suivante.", "mesures": ""},
    {"id": None, "famille": "Pas encore disponible", "nom": "Scratch",
     "synonymes": ["scratch", "baby scratch", "chirp", "flare"],
     "regex": r"scratch|chirp|flare",
     "dj": "Mouvements de disque rythmés à la main.",
     "simple": "Le « zigazig » du disque frotté à la main.",
     "quand": "Pas encore simulé de façon crédible : PromptMix proposera un rewind ou un loop roll à la place.", "mesures": ""},
]

# vocabulaire général que Claude doit comprendre (non exécuté directement, guide les choix du plan)
GLOSSAIRE: dict[str, str] = {
    "drop": "moment fort où la basse et le kick reviennent après une montée",
    "build-up / montée": "passage qui fait monter la tension avant le drop",
    "break / breakdown": "passage sans kick ni basse lourde",
    "intro / outro (DJ friendly)": "début/fin rythmiques faits pour être mixés",
    "phrase": "bloc de 8, 16 ou 32 mesures ; on enchaîne aux débuts de phrase",
    "kick / grosse caisse": "le « boum » sur chaque temps", "hats / charleys": "les « tss » aigus",
    "mix harmonique / in key / Camelot": "enchaîner des tonalités compatibles (même nombre, ±1, ou A↔B)",
    "pitch / tempo / BPM": "vitesse du morceau ; on cale les tempos (beatmatching)",
    "sped up / nightcore / slowed": "versions accélérées ou ralenties ; le BPM affiché peut être à corriger",
    "warm-up": "début de soirée, énergie qui monte doucement",
    "peak time / prime time": "moment le plus intense de la soirée", "banger": "morceau très efficace, à garder pour le pic",
    "closing / after": "fin de soirée, plus calme ou plus profond",
    "energy / montée en pression": "augmenter progressivement l'intensité (tempo, morceaux plus durs, transitions plus courtes)",
    "long mix / short mix": "transition longue (16-32 mesures) ou courte (1-4 mesures)",
    "back to back (B2B)": "deux DJ qui alternent ; ici : alterner les morceaux",
}


def by_id() -> dict[str, dict]:
    return {t["id"]: t for t in TECHNIQUES if t["id"]}


def doc_for_prompt() -> str:
    """Texte injecté dans le prompt système de Claude."""
    lines = ["Techniques disponibles (champ `type`) — avec les mots que les DJ utilisent pour les demander :"]
    for t in TECHNIQUES:
        if t["id"]:
            lines.append(f"- {t['id']} = {t['nom']} ; on dit aussi : {', '.join(t['synonymes'])}. "
                         f"{t['dj']} Quand : {t['quand']} Durée conseillée : {t['mesures']}.")
    lines.append("\nTechniques NON disponibles (propose l'équivalent le plus proche et dis-le dans `explanation`) :")
    for t in TECHNIQUES:
        if not t["id"]:
            lines.append(f"- {t['nom']} ({', '.join(t['synonymes'])}) : {t['quand']}")
    lines.append("\nVocabulaire DJ à comprendre :")
    lines += [f"- {k} : {v}" for k, v in GLOSSAIRE.items()]
    return "\n".join(lines)
