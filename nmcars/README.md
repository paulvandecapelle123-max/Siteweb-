# NMcars — site vitrine (Detailing & Import · Aubel)

Site statique (HTML/CSS/JS, sans compilation), prêt pour Cloudflare Pages.

## À compléter avant la mise en ligne
En bas de `index.html`, bloc `window.NM` : téléphone, WhatsApp, e-mail, horaires, numéro d'entreprise (BCE).
Les champs vides ne s'affichent pas. Sans WhatsApp ni e-mail, le formulaire copie le message et renvoie vers Instagram.

## Contenu
- `assets/js/content.js` : prestations, réalisations (photos), FAQ, villes de la carte d'import.
- Photos : dépose-les dans `photos/` puis renseigne `img` (ou `before` + `after` pour un comparateur avant/après) dans `GALLERY`.
- `assets/js/car3d.js` : voiture 3D du hero (teintes dans `PAINTS`).

## Déployer sur Cloudflare Pages
Workers & Pages → Create → Pages → Connect to Git → ce dépôt.
Framework preset **None**, build command **vide**, build output directory **nmcars**.
Puis Custom domains → ajouter le domaine (ex. nmcars.be).
