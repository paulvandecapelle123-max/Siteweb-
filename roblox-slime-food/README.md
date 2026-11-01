# Le Marché Gluant (jeu Roblox)

Un jeu Roblox de nourriture en slime :

1. 🛒 **Le Marché** : achète un kit parmi 25 recettes (pizza, burger, sushis, ramen, bubble tea, gâteau arc-en-ciel…). Chaque kit est vendu dans une boîte-panier jaune avec le nom du plat dessus.
2. 🍳 **La Cuisine** : construis ton plat en ajoutant les ingrédients dans le bon ordre. Le plat se construit en 3D sous tes yeux.
3. 🧪 **Le Labo à slime** : clique vite pour tout mélanger, et ton plat devient un slime. La texture est tirée au hasard : Classique, Pailleté, Nuage, Croquant, Arc-en-ciel ou Galaxie.
4. 💰 **Le Marchand** : vends tes slimes pour gagner des pièces, puis recommence avec des kits plus chers.

La zone d'échange et la zone des mini-jeux sont déjà sur la map. Leur fonctionnement arrive dans les prochaines étapes.

## Ouvrir le jeu dans Roblox Studio

1. Télécharge le fichier `dist/LeMarcheGluant.rbxl`.
2. Ouvre **Roblox Studio**, puis **Fichier → Ouvrir depuis un fichier** (*File → Open from File*), et choisis le fichier.
3. Clique sur **Play** (ou appuie sur F5) pour tester.
4. Approche-toi d'une caisse, d'un plan de travail, d'un bol géant ou du marchand, puis appuie sur **E** (ou sur le bouton qui apparaît sur mobile).

## Activer la sauvegarde

Sans ces étapes, le jeu marche quand même, mais les pièces et le sac repartent de zéro à chaque partie.

1. **Fichier → Publier sur Roblox** (*File → Publish to Roblox*).
2. **Accueil → Paramètres du jeu → Sécurité** (*Home → Game Settings → Security*).
3. Active **Enable Studio Access to API Services**.

## Où modifier quoi

| Je veux…                                   | Fichier dans Studio                           |
| ------------------------------------------ | --------------------------------------------- |
| Ajouter ou changer une recette             | `ReplicatedStorage > Shared > Recipes`        |
| Changer le nom du jeu, l'argent de départ… | `ReplicatedStorage > Shared > Config`         |
| Changer les textures de slime et leur prix | `ReplicatedStorage > Shared > Slimes`         |
| Changer la forme des ingrédients           | `ReplicatedStorage > Shared > FoodModel`      |
| Changer le dessin des boîtes jaunes        | `ReplicatedStorage > Shared > KitBox`         |
| Modifier la map                            | Directement dans le Workspace (dossier `Map`) |
| Règles du jeu (prix, vérifications)        | `ServerScriptService > GameServer`            |
| Interface du joueur                        | `StarterPlayer > StarterPlayerScripts > GameClient` |

Si tu ajoutes une recette, la vitrine du Marché n'a pas encore sa place : supprime le dossier `Map` du Workspace et le jeu la reconstruit au lancement. Tu peux aussi coller ceci dans la barre de commande (*View → Command Bar*) :

```lua
require(game.ServerScriptService.MapBuilder).rebuild()
```

## Pour les développeurs

Le code source est dans `src/`. Le fichier `.rbxl` est fabriqué avec [Lune](https://github.com/lune-org/lune) :

```sh
lune run build/test.luau          # vérifie les 25 recettes et construit tous les plats/slimes
lune run build/test_server.luau   # simule un joueur : achat, cuisine, mélange, vente, sauvegarde
lune run build/build.luau         # fabrique dist/LeMarcheGluant.rbxl
```
