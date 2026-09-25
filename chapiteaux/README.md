# Chapiteau'bel — site vitrine (Aubel)

Site statique (HTML/CSS/JS, sans compilation), prêt pour Cloudflare Pages.

## Modifier les prix, les coordonnées, les photos, les avis
Tout est dans `assets/js/config.js` :
- `SITE` : nom, GSM, WhatsApp, e-mail, Instagram, numéro d'entreprise, rayon de montage compris.
- `TENTS` : prix week-end / semaine de chaque chapiteau, capacité, texte, type de bâche de chaque côté.
- `OPTIONS` : options et leurs prix.
- `GALLERY` : photos (dans `photos/`), avec le lieu et le type d'événement.
- `REVIEWS` : avis clients réels (la section s'affiche dès qu'il y en a un).

## Configurateur 3D
`assets/js/tent3d.js`. Reproduit d'après les photos :
- 6 × 6 : travées de 3 m, 3 côtés pleins + façade à fenêtres transparentes.
- 6 × 12 : travées de 2 m, bâches à fenêtres en arcade sur les longs côtés, pignons pleins.
Chaque bâche s'enroule au clic (dans la 3D ou sur le plan). Hauteurs : `H` (gouttière) et `R` (faîte) en haut du fichier.

## Déployer sur Cloudflare Pages
Workers & Pages → Create → Pages → Connect to Git → ce dépôt.
Framework preset **None**, build command **vide**, build output directory **chapiteaux**.
Puis Custom domains → ajouter le domaine.
