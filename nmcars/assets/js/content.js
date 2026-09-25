/* Contenu du site NMcars : prestations, réalisations, FAQ, carte d'import. */

window.SERVICES = [
  {
    icon: "wash",
    title: "Lavage détaillé extérieur",
    text: "Prélavage à la mousse, lavage à deux seaux, jantes et passages de roues, séchage sans contact. Zéro nouvelle rayure.",
    tags: ["Mousse active", "Jantes", "Séchage air"]
  },
  {
    icon: "interior",
    title: "Nettoyage intérieur complet",
    text: "Aspiration, shampoing des sièges et tapis à l'injecteur-extracteur, plastiques, vitres, désodorisation.",
    tags: ["Injection-extraction", "Plastiques", "Odeurs"]
  },
  {
    icon: "polish",
    title: "Polissage & correction",
    text: "Suppression des micro-rayures, hologrammes et traces de station de lavage. En une ou plusieurs passes selon l'état du vernis.",
    tags: ["1 à 3 étapes", "Mesure du vernis", "Lumière d'inspection"]
  },
  {
    icon: "ceramic",
    title: "Protection céramique",
    text: "Un revêtement dur et hydrophobe qui protège la peinture pendant des années et rend chaque lavage plus facile.",
    tags: ["Effet perlant", "Anti-UV", "Plusieurs années"]
  },
  {
    icon: "leather",
    title: "Soin du cuir",
    text: "Nettoyage en profondeur, nourrissage et protection des sièges et volants en cuir pour éviter craquelures et brillance.",
    tags: ["Nettoyage pH neutre", "Nourrissant", "Protection"]
  },
  {
    icon: "lights",
    title: "Rénovation des phares",
    text: "Des optiques jaunies redeviennent transparentes : ponçage, polissage et vernis de protection UV.",
    tags: ["Ponçage", "Polissage", "Vernis UV"]
  },
  {
    icon: "engine",
    title: "Compartiment moteur",
    text: "Dégraissage doux et habillage des plastiques : idéal avant une vente ou un contrôle.",
    tags: ["Dégraissage", "Habillage", "Sans risque"]
  },
  {
    icon: "sale",
    title: "Préparation à la vente",
    text: "Intérieur, extérieur et photos soignées : votre voiture se vend plus vite et au meilleur prix.",
    tags: ["Intérieur + extérieur", "Petites retouches", "Valorisation"]
  }
];

/* Réalisations : ajoute tes photos dans /photos et remplis "img".
   before/after : si les deux sont remplis, la carte devient un comparateur avant/après. */
window.GALLERY = [
  { title: "Correction de vernis", car: "Berline noire", before: "", after: "", img: "" },
  { title: "Céramique", car: "SUV blanc", img: "" },
  { title: "Intérieur cuir", car: "Coupé", img: "" },
  { title: "Import Allemagne", car: "Break familial", img: "" },
  { title: "Rénovation phares", car: "Citadine", img: "" },
  { title: "Préparation vente", car: "Compacte", img: "" }
];

window.FAQ = [
  {
    q: "Combien de temps faut-il pour un detailing ?",
    a: "Un lavage détaillé prend quelques heures. Un polissage avec protection céramique demande en général une à trois journées selon l'état du vernis et la taille du véhicule, car la céramique doit aussi sécher dans de bonnes conditions. On vous donne le délai exact au devis."
  },
  {
    q: "Quelle différence entre cire, sealant et céramique ?",
    a: "Une cire donne un bel éclat mais ne tient que quelques semaines. Un sealant synthétique tient plusieurs mois. Un revêtement céramique forme une couche dure qui dure plusieurs années, protège mieux des UV, des fientes et des produits de salage, et rend l'entretien beaucoup plus simple."
  },
  {
    q: "Le polissage abîme-t-il la peinture ?",
    a: "Un polissage retire une très fine épaisseur de vernis. C'est pour ça qu'on mesure d'abord l'épaisseur de peinture et qu'on choisit la méthode la moins agressive qui donne le résultat voulu. Bien fait, il n'y a aucun risque pour la carrosserie."
  },
  {
    q: "Pourquoi importer une voiture d'Allemagne ou des Pays-Bas ?",
    a: "Le marché y est bien plus grand : plus de choix en finitions, en options et en kilométrages, et souvent des prix intéressants. Depuis Aubel, Aachen est à environ 20 minutes et Maastricht à 25, ce qui permet d'aller voir les voitures en vrai avant d'acheter."
  },
  {
    q: "Quelles formalités pour immatriculer une voiture importée en Belgique ?",
    a: "Il faut en général le certificat de conformité européen (COC), le document d'immatriculation étranger, la preuve d'achat, un contrôle technique spécifique pour véhicule importé, puis une demande d'immatriculation à la DIV via l'assureur. En Wallonie, la taxe de mise en circulation est calculée à ce moment-là. On s'en occupe pour vous."
  },
  {
    q: "Et la TVA sur une voiture importée ?",
    a: "Pour une voiture d'occasion achetée dans un autre pays de l'UE, la TVA n'est normalement pas due une seconde fois. Une voiture est toutefois considérée comme « neuve » au sens de la TVA si elle a moins de 6 mois ou moins de 6 000 km : dans ce cas, la TVA belge est due en Belgique. On vérifie ce point avant tout achat."
  },
  {
    q: "Comment se passe le paiement d'un import ?",
    a: "Rien n'est payé avant que la voiture ait été vérifiée et que vous ayez validé le prix total rendu Belgique. Tous les frais (transport, contrôle technique, formalités, notre prestation) sont annoncés à l'avance."
  },
  {
    q: "Faut-il prendre rendez-vous ?",
    a: "Oui, toutes les prestations se font sur rendez-vous pour pouvoir consacrer le temps nécessaire à chaque voiture. Écrivez-nous sur Instagram ou via le formulaire en bas de page."
  }
];

/* Carte d'import (schéma, pas à l'échelle). x/y dans un repère 600 × 460. */
window.ORIGINS = [
  { city: "Aachen", country: "DE", x: 340, y: 292, km: 20, time: "≈ 20 min" },
  { city: "Maastricht", country: "NL", x: 168, y: 196, km: 25, time: "≈ 25 min" },
  { city: "Köln", country: "DE", x: 520, y: 300, km: 95, time: "≈ 1 h" },
  { city: "Düsseldorf", country: "DE", x: 492, y: 150, km: 115, time: "≈ 1 h 15" },
  { city: "Eindhoven", country: "NL", x: 150, y: 60, km: 105, time: "≈ 1 h 10" },
  { city: "München", country: "DE", x: 560, y: 430, km: 650, time: "transport camion" }
];
window.AUBEL = { x: 230, y: 300 };
