/* =========================================================================
   RÉGLAGES DU SITE — tout ce qui change souvent est ici.
   Les prix sont des exemples : modifie-les librement.
   ========================================================================= */

window.SITE = {
  name: "Chapiteau'bel",
  tagline: "Location & montage de chapiteaux",
  city: "Aubel",
  region: "Province de Liège",
  phone: "+32 471 63 90 04",
  whatsapp: "32471639004",               // laisse vide pour désactiver WhatsApp
  email: "chapiteaubel@gmail.com",
  facebook: "",
  instagram: "https://www.instagram.com/chapiteaubel/",
  bce: "",                            // numéro d'entreprise
  radiusKm: 25                        // livraison & montage compris dans ce rayon
};

/* Chapiteaux disponibles (reproduits en 3D d'après les photos).
   bay   : largeur d'un panneau / entre deux poteaux (m)
   walls : type de bâche de chaque côté
     "solid" = bâche blanche pleine
     "clear" = bâche blanche avec grande fenêtre transparente
     "arch"  = bâche à fenêtre en arcade avec croisillons
   front / back = pignons (6 m) · left / right = longs côtés.  */
window.TENTS = {
  "6x6": {
    label: "Chapiteau 6 × 6 m",
    short: "6 × 6",
    width: 6, length: 6, surface: 36,
    seated: 30, standing: 50,
    prices: { weekend: 200, week: 600 },
    bay: 3,
    blurb: "Le format idéal pour un anniversaire, une communion, une soirée ou un bar extérieur. Trois côtés en bâche blanche et une façade à grandes fenêtres transparentes pour garder la vue.",
    walls: { front: "clear", back: "solid", left: "solid", right: "solid" },
    photo: "photos/6x6-facade-transparente.jpg"
  },
  "6x12": {
    label: "Chapiteau 6 × 12 m",
    short: "6 × 12",
    width: 6, length: 12, surface: 72,
    seated: 60, standing: 100,
    prices: { weekend: 350, week: 1000 },
    bay: 2,
    blurb: "82 m² pour les mariages, fêtes de famille, fêtes de village et événements d'entreprise. Bâches à fenêtres en arcade, amovibles panneau par panneau.",
    walls: { front: "solid", back: "solid", left: "arch", right: "arch" },
    photo: "photos/6x12-arcades.jpg"
  }
};

window.DURATIONS = {
  weekend: { label: "Week-end", detail: "livré le vendredi, repris le lundi" },
  week: { label: "Semaine", detail: "7 jours" }
};

/* Options (prix par location). */
window.OPTIONS = [
  { id: "lights", label: "Guirlandes lumineuses", price: 25, unit: "forfait" },
  { id: "tables", label: "Set brasserie (1 table + 2 bancs, 8 pers.)", price: 12, unit: "par set", qty: true, max: 12 },
  { id: "floor", label: "Tapis de sol", price: 40, unit: "forfait" }
];

/* Avis clients : ajoute les vrais avis ici (ils s'affichent automatiquement).
   { name: "Prénom N.", place: "Aubel", event: "Mariage", text: "…", tent: "6x12", photo: "photos/xxx.jpg" } */
window.REVIEWS = [];

/* Réalisations : photos de chapiteaux montés.
   { img: "photos/mariage-aubel.jpg", place: "Aubel", event: "Mariage", tent: "6x12" } */
window.GALLERY = [
  { img: "photos/6x12-pignon-ouvert.jpg", place: "", event: "Pignon ouvert", tent: "6x12" },
  { img: "photos/6x6-facade-transparente.jpg", place: "", event: "Façade transparente", tent: "6x6" },
  { img: "photos/6x12-ferme.jpg", place: "", event: "Entrée ouverte", tent: "6x12" },
  { img: "photos/6x6-jardin-ouvert.jpg", place: "", event: "Cocktail au jardin", tent: "6x6" },
  { img: "photos/6x12-interieur-ouvert.jpg", place: "", event: "Structure", tent: "6x12" },
  { img: "photos/6x6-interieur.jpg", place: "", event: "Intérieur", tent: "6x6" }
];

window.ZONE = ["Aubel", "Thimister-Clermont", "Plombières", "Welkenraedt", "Herve", "Dalhem", "Visé", "Blegny", "Limbourg", "Baelen", "Eupen", "Verviers", "Battice", "Fourons"];
