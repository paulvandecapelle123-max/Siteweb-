# Portfolio — Monteur vidéo IA

Site vitrine statique (HTML/CSS/JS, aucune compilation) prêt à être déployé sur **Cloudflare Pages**.

## Structure

```
index.html              page unique (hero 3D, portfolio "TV", savoir-faire, méthode, FAQ, contact)
assets/css/style.css    tout le style
assets/js/projects.js   ⭐ TES CATÉGORIES ET TES VIDÉOS (le seul fichier à modifier au quotidien)
assets/js/i18n.js       textes FR / EN + FAQ
assets/js/main.js       logique (télé, filtres, lecteur vidéo, langue, formulaire)
assets/js/scene3d.js    scène 3D du hero (Three.js, hébergé en local dans assets/vendor)
videos/                 tes .mp4
posters/                images de couverture (1080×1920 jpg/webp)
_headers                en-têtes HTTP Cloudflare (cache, sécurité)
```

## Ajouter une vidéo

1. Compresse la vidéo en MP4 H.264, 1080×1920, **moins de 25 Mo** (limite par fichier de Cloudflare Pages).
   Exemple : `ffmpeg -i source.mov -vf scale=1080:-2 -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 128k -movflags +faststart videos/mon-ad.mp4`
2. Exporte une image de couverture dans `posters/mon-ad.jpg`.
3. Dans `assets/js/projects.js`, ajoute un objet dans `PROJECTS` (un exemple commenté y est déjà).
4. Pour une vidéo plus lourde, mets un lien YouTube (non répertorié), Vimeo ou Cloudflare Stream dans `video` : le lecteur l'intègre automatiquement.

Les catégories sans vidéo affichent des cartes « À venir » : tu peux mettre le site en ligne tout de suite.

## Changer ton nom et ton e-mail

En bas de `index.html`, bloc `window.SITE = { brand, email }`. Pense aussi au `<title>` et aux balises `og:` dans le `<head>`.

## Tester en local

```
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Déployer sur Cloudflare Pages

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choisis ce dépôt GitHub.
2. Réglages de build : *Framework preset* **None**, *Build command* **vide**, *Build output directory* **/** .
3. **Save and Deploy** → le site est en ligne sur `xxx.pages.dev`.
4. Onglet **Custom domains** → **Set up a custom domain** → ton domaine (déjà chez Cloudflare = DNS configuré automatiquement).
5. Chaque `git push` sur la branche de production redéploie le site tout seul.
