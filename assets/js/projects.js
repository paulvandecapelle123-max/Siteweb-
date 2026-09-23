/* =========================================================================
   PORTFOLIO — le seul fichier à modifier pour ajouter tes vidéos.

   1. Dépose ta vidéo dans /videos (mp4 H.264, < 25 Mo) et une image de
      couverture dans /posters (jpg/webp, 9:16).
      Vidéo plus lourde ? Mets-la sur YouTube (non répertoriée), Vimeo ou
      Cloudflare Stream et colle le lien dans "video".
   2. Ajoute une ligne dans PROJECTS ci-dessous.
   3. Une catégorie sans vidéo affiche automatiquement des cartes « À venir ».

   Champs d'un projet :
     cat     : id de la catégorie (voir CATEGORIES)
     title   : { fr, en }
     client  : marque / produit (optionnel)
     video   : "videos/mon-fichier.mp4" OU lien YouTube / Vimeo / Stream
     poster  : "posters/mon-fichier.jpg" (optionnel mais recommandé)
     format  : "9:16" | "4:5" | "1:1" | "16:9"
     length  : durée affichée, ex. "0:28"
     tools   : outils utilisés (liste courte)
     result  : chiffre marquant (optionnel), { fr, en }
     featured: true => passe en premier sur la télé de sa catégorie
   ========================================================================= */

window.CATEGORIES = [
  {
    id: "zack",
    ch: "01",
    color: "#FFD23F",
    glyph: "?",
    name: { fr: "Style Zack D. Films", en: "Zack D. Films style" },
    tag: { fr: "Explainers 3D « Et si… »", en: "3D “What if…” explainers" },
    pitch: {
      fr: "Des mini-films 3D ultra-rythmés qui expliquent un produit comme un fait scientifique fascinant. Rétention maximale, zéro temps mort.",
      en: "Punchy 3D micro-films that explain a product like a fascinating science fact. Maximum retention, zero dead air."
    }
  },
  {
    id: "singing",
    ch: "02",
    color: "#FF5A5F",
    glyph: "♪",
    name: { fr: "Singing Ads", en: "Singing Ads" },
    tag: { fr: "Pubs chantées & jingles IA", en: "AI jingles & sung ads" },
    pitch: {
      fr: "Ta marque devient une chanson qu'on a dans la tête. Paroles, musique, voix et lip-sync générés puis montés au beat.",
      en: "Your brand becomes a song people can't shake. Lyrics, music, vocals and lip-sync generated, then cut to the beat."
    }
  },
  {
    id: "cartoon",
    ch: "03",
    color: "#3DD6F5",
    glyph: "✦",
    name: { fr: "Cartoon Ads", en: "Cartoon Ads" },
    tag: { fr: "Animation style studio 3D", en: "Studio-style 3D animation" },
    pitch: {
      fr: "Mascottes et personnages façon film d'animation, cohérents d'un plan à l'autre. L'émotion d'un long-métrage, le budget d'une pub social.",
      en: "Mascots and characters with a feature-animation look, consistent shot to shot. Feature-film emotion on a social-ad budget."
    }
  },
  {
    id: "skeleton",
    ch: "04",
    color: "#F3F0FF",
    glyph: "☠",
    name: { fr: "Skeleton Ads", en: "Skeleton Ads" },
    tag: { fr: "Squelettes 3D qui parlent", en: "Talking 3D skeletons" },
    pitch: {
      fr: "Le format viral qui montre « ce qui se passe à l'intérieur ». Parfait pour la santé, le sport, la nutrition et tout produit qui agit sur le corps.",
      en: "The viral format that shows “what's happening inside”. Perfect for health, fitness, nutrition and anything that acts on the body."
    }
  },
  {
    id: "objects",
    ch: "05",
    color: "#9BE564",
    glyph: "◉",
    name: { fr: "Objets qui parlent", en: "Talking Objects" },
    tag: { fr: "Fruits, produits & organes animés", en: "Animated fruit, products & organs" },
    pitch: {
      fr: "Le produit prend la parole lui-même. Drôle, absurde, mémorable : le hook parfait pour stopper le scroll.",
      en: "The product speaks for itself. Funny, absurd, memorable: the perfect hook to stop the scroll."
    }
  },
  {
    id: "ugc",
    ch: "06",
    color: "#FF9F43",
    glyph: "◐",
    name: { fr: "UGC & Avatars IA", en: "AI UGC & Avatars" },
    tag: { fr: "Face-cam, témoignages, talking heads", en: "Face-cam, testimonials, talking heads" },
    pitch: {
      fr: "Des créas UGC crédibles et déclinables à l'infini : hooks, angles et avatars différents pour tester vite ce qui convertit.",
      en: "Believable UGC creatives you can scale endlessly: different hooks, angles and avatars to find what converts, fast."
    }
  },
  {
    id: "product",
    ch: "07",
    color: "#C08BFF",
    glyph: "◆",
    name: { fr: "Product Ads IA", en: "AI Product Ads" },
    tag: { fr: "Packshots & mises en scène", en: "Packshots & lifestyle scenes" },
    pitch: {
      fr: "Ton produit dans des décors impossibles à tourner : macro, splash, lévitation, voyage dans le temps. Sans studio, sans shooting.",
      en: "Your product in scenes you could never shoot: macro, splash, levitation, time travel. No studio, no shoot."
    }
  },
  {
    id: "cinematic",
    ch: "08",
    color: "#FF6FB5",
    glyph: "▲",
    name: { fr: "Films cinématiques", en: "Cinematic Films" },
    tag: { fr: "Brand films & trailers IA", en: "AI brand films & trailers" },
    pitch: {
      fr: "Des films de marque à l'esthétique cinéma : étalonnage, sound design et narration pour installer une image premium.",
      en: "Brand films with a cinema look: grading, sound design and storytelling to build a premium image."
    }
  }
];

window.PROJECTS = [
  // ——— EXEMPLES : remplace "video" et "poster" par tes fichiers ———
  // {
  //   cat: "zack",
  //   title: { fr: "Et si tu avalais un chewing-gum ?", en: "What if you swallowed gum?" },
  //   client: "Marque X",
  //   video: "videos/zack-chewing-gum.mp4",
  //   poster: "posters/zack-chewing-gum.jpg",
  //   format: "9:16",
  //   length: "0:34",
  //   tools: ["Kling", "ElevenLabs", "Premiere Pro"],
  //   result: { fr: "Hook rate 41 %", en: "41% hook rate" },
  //   featured: true
  // },
];
