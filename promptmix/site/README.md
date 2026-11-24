# Site vitrine PromptMix (Cloudflare)

Site statique (HTML/CSS/JS, aucune compilation) qui présente PromptMix. Seul le dossier `public/` est publié.

## Mettre en ligne sur Cloudflare

1. Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → choisis ce dépôt GitHub.
2. Nom du projet : `promptmix`. Dans **Settings → Build** : *Root directory* = `promptmix/site`,
   *Build command* vide, *Deploy command* `npx wrangler deploy` (valeur par défaut).
3. **Deploy** : le site est en ligne sur `promptmix.<ton-compte>.workers.dev`.
4. **Settings → Domains & Routes → Add → Custom domain** pour brancher ton domaine (ex. `promptmix.fr`).
5. Chaque `git push` sur la branche de production redéploie le site.

C'est le même fonctionnement que le site Chapiteau'bel (`chapiteaux/`), dans un projet Cloudflare séparé.

## À faire avant l'ouverture

- `public/mentions-legales.html` et `public/confidentialite.html` : compléter les passages surlignés `[À COMPLÉTER]`
  (identité de l'éditeur, contact, hébergeur de l'application, prestataire de paiement).
- `public/main.js`, tout en haut : mettre l'adresse de l'application dans `APP_URL`
  (ex. `"https://app.promptmix.fr"`). Tant que c'est vide, les boutons affichent « Bientôt disponible ».
- Section Tarifs de `public/index.html` : ajouter les prix une fois décidés.

## Modifier

- Textes : `public/index.html`. Couleurs et mise en page : `public/style.css`.
- Exemples de demandes (onglets « Parle comme un DJ ») : tableau `EXAMPLES` dans `public/main.js`.
- Liste des techniques : générée depuis l'appli, ne pas éditer `lexique.json` à la main :
  modifier `promptmix/plan/lexique.py` puis lancer `python tools/export_lexique.py`.

## Tester en local

```
cd promptmix/site && npx wrangler dev     # http://localhost:8787
```
