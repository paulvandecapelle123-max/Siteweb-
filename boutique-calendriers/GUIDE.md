# Boutique de calendriers de l'Avent — guide de mise en ligne

Ce dossier contient un thème Shopify sur mesure, « Avent ».

```
boutique-calendriers/
  avent-theme.zip   ← le fichier à importer dans Shopify
  theme/            ← le code source du thème (le même contenu que le zip)
  apercu/           ← captures d'écran (avec des produits d'exemple)
```

## Ce que fait le thème

- **Accueil** : un grand calendrier de 24 cases qui s'ouvrent au clic. En décembre, les cases des jours passés sont déjà ouvertes et celle du jour s'entrouvre. Il y a aussi un compte à rebours avant le 1er décembre, les produits vedettes, les catégories, « Comment ça marche », la réassurance, la FAQ et la newsletter.
- **Bandeau de date limite**, calculé tout seul : « Commandez avant le samedi 14 novembre pour être livré avant le 1er décembre — Plus que 28 jours ».
- **Fiche produit** : galerie photo, variantes, ajout au panier, Apple Pay / Google Pay / Shop Pay, et **date de livraison estimée** avec un voyant :
  - vert « Arrive avant le 1er décembre »,
  - orange « Arrivée possible juste autour du 1er décembre »,
  - rouge « Arrivera après le 1er décembre ».
- **Panier latéral** avec la barre « Plus que X € pour la livraison offerte » et un message cadeau.
- **Collections** avec filtres et tri, plus la recherche, les pages, le contact, le blog et une page 404.
- **Page d'attente** (boutique protégée par mot de passe) avec inscription « Me prévenir ».
- Polices hébergées dans le thème (aucun appel à Google), en français et en anglais, adapté aux mobiles.

## 1. Créer la boutique

1. Va sur shopify.com/fr et lance l'essai gratuit. L'abonnement devient payant ensuite.
2. Choisis le nom de la boutique. Dans les captures, j'ai mis « Les 24 Cases » juste pour l'exemple.
3. Dans **Paramètres → Langues**, mets le **français** comme langue principale.

## 2. Installer le thème

1. **Boutique en ligne → Thèmes → Ajouter un thème → Importer un fichier zip** → choisis `avent-theme.zip`.
2. Clique sur **Personnaliser** pour voir le résultat, puis sur **Publier** quand tout est prêt.

## 3. Régler le thème (Personnaliser)

- **Paramètres du thème** (icône engrenage) :
  - **Couleurs** : vert sapin, rouge, doré… tout est modifiable.
  - **Livraison et 1er décembre** : le délai de préparation et le délai de transport le plus court / le plus long. **Mets les vrais délais de ton fournisseur.** Ils servent à calculer la date affichée sur les produits et la date limite du bandeau.
  - **Panier** : le seuil de livraison offerte (39 € par défaut). Il doit correspondre à ta règle dans *Paramètres → Expédition*.
  - **Réseaux sociaux**, **Favicon**.
- **En-tête** : ton logo (sinon, le nom de la boutique s'affiche avec une icône cadeau).
- **Calendrier (bannière)** : titre, texte, boutons, et une image facultative qui apparaît derrière les cases quand on les ouvre.
- Chaque section se déplace, se masque ou se duplique depuis la colonne de gauche.

## 4. Menus et collections

**Boutique en ligne → Navigation** :

- **Menu principal** (`main-menu`) : Calendriers (→ collection « Tous »), Comment ça marche (→ `/#comment-ca-marche`), FAQ (→ `/#faq`).
- **Pied de page** (`footer`) : Livraison, Retours, Contact, Mentions légales.

**Produits → Collections** : crée par exemple *Beauté*, *Gourmand*, *Enfants* et *Bijoux*, puis relie-les dans la section **Catégories** de l'accueil.

Pour les filtres de la page collection (prix, disponibilité, catégorie…), installe l'application gratuite **Shopify Search & Discovery**.

## 5. Importer les calendriers AliExpress

L'outil le plus courant est l'application **DSers** (partenaire officiel d'AliExpress, gratuite pour commencer) :

1. Installe DSers depuis l'App Store Shopify et relie ton compte AliExpress.
2. Colle le lien du produit AliExpress dans DSers → **Import**.
3. Modifie le titre, la description et le prix, puis **Push to Shopify**.
4. Quand un client commande, DSers passe la commande chez le fournisseur avec l'adresse du client.

Les fiches produit (titres, descriptions, prix conseillés), je peux les rédiger à partir des liens ou des captures que tu m'envoies.

**Délai propre à un produit** (par exemple un produit expédié depuis un entrepôt en Europe) : dans **Paramètres → Données personnalisées → Produits**, crée deux métachamps de type *Nombre entier* :

- `custom.delai_min_jours`
- `custom.delai_max_jours`

Remplis-les sur le produit concerné : ils remplacent les délais de transport du thème pour ce produit.

## 6. Paiement, livraison, pages légales

- **Paramètres → Paiements** : Shopify Payments (carte bancaire, Apple Pay, Google Pay) et PayPal.
- **Paramètres → Expédition et livraison** : un tarif standard et la livraison offerte à partir de 39 € (ou le montant que tu choisis).
- **Paramètres → Politiques** (Shopify propose des modèles) : politique de retour (14 jours de rétractation), confidentialité, conditions générales de vente, coordonnées/mentions légales, expédition. Elles s'affichent automatiquement en bas du site.
- Pour vendre, il te faut un statut (micro-entreprise en France, indépendant en Belgique…).

## 7. Points d'attention pour des calendriers AliExpress

- **Le temps presse** : on est mi-octobre. Le bandeau calcule la dernière date de commande, et chaque fiche indique honnêtement si le colis arrivera avant le 1er décembre. Ne promets jamais un délai plus court que celui du fournisseur : c'est la première cause de litiges et de remboursements.
- **Commande un exemplaire de chaque calendrier pour toi** : tu vérifies la qualité, le contenu et le vrai délai de livraison.
- **Pas de marques ni de licences** (Disney, Pokémon, LEGO, Harry Potter, Marvel, marques de cosmétiques…) : sur AliExpress, ce sont presque toujours des contrefaçons. Tu risques la fermeture de la boutique et des poursuites.
- **Jouets pour enfants** : marquage CE obligatoire (norme EN 71). **Cosmétiques** : règles européennes strictes. Les bijoux fantaisie, chaussettes, déco, thés en vrac, outils ou puzzles sont plus simples à vendre.
- **Avis clients** : pas de faux avis. C'est interdit dans l'UE.

## Tester le thème sans Shopify

Le thème a passé **Shopify Theme Check** (l'outil officiel de vérification) **sans aucune erreur ni avertissement**. Les captures du dossier `apercu/` viennent d'un rendu local avec des produits d'exemple, pas tes vrais produits.
