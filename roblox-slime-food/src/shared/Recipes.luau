--[[
	Recipes (ModuleScript)
	La liste de tous les kits de nourriture en slime vendus au Marché.

	Chaque recette a :
	  id         : identifiant unique (sans espace ni accent)
	  name       : nom affiché
	  emoji      : petit dessin affiché dans l'interface
	  rarity     : "Commun", "Rare", "Epique" ou "Legendaire"
	  price      : prix du kit en pièces
	  plate      : rayon de l'assiette (false = pas d'assiette)
	  slimeColor : couleur du slime obtenu après le mélange
	  steps      : les ingrédients, dans l'ordre où il faut les ajouter

	Pour ajouter une recette : copie un bloc { ... } existant, change l'id et les ingrédients.
	Les types d'ingrédients possibles ("kind") sont expliqués en haut de FoodModel.
]]

local function rgb(r, g, b)
	return Color3.fromRGB(r, g, b)
end

-- Couleurs qui reviennent souvent
local WHITE = rgb(252, 252, 248)
local RED = rgb(220, 35, 50)
local GREEN_LEAF = rgb(70, 165, 60)

local Recipes = {}

Recipes.List = {
	------------------------------------------------------------------ COMMUNS
	{
		id = "donut",
		name = "Donut rose",
		emoji = "🍩",
		rarity = "Commun",
		price = 25,
		plate = 1.8,
		slimeColor = rgb(250, 140, 190),
		steps = {
			{ name = "Pâte à donut", kind = "ring", R = 0.95, t = 0.75, color = rgb(232, 180, 110) },
			{ name = "Cuisson", kind = "recolor", target = 1, color = rgb(205, 135, 65) },
			{ name = "Glaçage rose", kind = "ring", R = 0.95, t = 0.66, lift = 0.13, color = rgb(250, 135, 185) },
			{ name = "Vermicelles", kind = "sprinkles", count = 18, ring = 0.95, ringWidth = 0.22 },
		},
	},
	{
		id = "cookie",
		name = "Cookie géant",
		emoji = "🍪",
		rarity = "Commun",
		price = 25,
		plate = 1.6,
		slimeColor = rgb(200, 140, 75),
		steps = {
			{ name = "Pâte à cookie", kind = "disc", r = 1.15, h = 0.22, color = rgb(238, 205, 145) },
			{ name = "Pépites de chocolat", kind = "pieces", piece = "cube", count = 10, size = 0.2, spread = 0.85, color = rgb(80, 45, 25) },
			{ name = "Pépites blanches", kind = "pieces", piece = "cube", count = 6, size = 0.18, spread = 0.85, color = rgb(250, 245, 230) },
			{ name = "Cuisson au four", kind = "recolor", target = 1, color = rgb(205, 145, 75) },
		},
	},
	{
		id = "frites",
		name = "Cornet de frites",
		emoji = "🍟",
		rarity = "Commun",
		price = 25,
		plate = 1.7,
		slimeColor = rgb(250, 205, 80),
		steps = {
			{ name = "Cornet rouge", kind = "cup", r = 0.7, h = 1.1, color = rgb(220, 40, 40) },
			{ name = "Frites", kind = "sticks", count = 16, length = 1.5, color = rgb(250, 205, 80) },
			{ name = "Pot à sauce", kind = "cup", r = 0.35, h = 0.3, at = { x = 1.05, z = 0.75 }, color = WHITE },
			{ name = "Ketchup", kind = "liquid", fill = 0.9, color = rgb(205, 30, 30) },
		},
	},
	{
		id = "hotdog",
		name = "Hot-dog",
		emoji = "🌭",
		rarity = "Commun",
		price = 30,
		plate = 1.8,
		slimeColor = rgb(215, 95, 60),
		steps = {
			{ name = "Pain à hot-dog", kind = "pill", size = { 3.0, 0.7, 1.1 }, color = rgb(228, 165, 90) },
			{ name = "Saucisse", kind = "log", length = 3.2, d = 0.5, lift = -0.3, color = rgb(190, 75, 55) },
			{ name = "Ketchup", kind = "line", length = 2.6, amp = 0.1, d = 0.14, waves = 4, color = rgb(210, 30, 30) },
			{ name = "Moutarde", kind = "line", length = 2.6, amp = 0.1, d = 0.12, waves = 4, phase = math.pi, color = rgb(240, 200, 30) },
		},
	},
	{
		id = "pancakes",
		name = "Pancakes",
		emoji = "🥞",
		rarity = "Commun",
		price = 30,
		plate = 1.8,
		slimeColor = rgb(215, 145, 60),
		steps = {
			{ name = "Pancakes", kind = "stack", count = 3, r = 1.25, h = 0.2, color = rgb(225, 165, 85) },
			{ name = "Sirop d'érable", kind = "drizzle", r = 1.12, color = rgb(165, 85, 20) },
			{ name = "Beurre", kind = "block", size = { 0.5, 0.22, 0.5 }, rot = 20, color = rgb(250, 230, 130) },
			{ name = "Fraises", kind = "pieces", piece = "ball", count = 4, size = 0.32, spread = 0.75, color = RED },
		},
	},
	{
		id = "cupcake",
		name = "Cupcake",
		emoji = "🧁",
		rarity = "Commun",
		price = 30,
		plate = 1.3,
		slimeColor = rgb(250, 175, 210),
		steps = {
			{ name = "Caissette", kind = "cup", r = 0.75, h = 0.65, color = rgb(245, 125, 175) },
			{ name = "Gâteau", kind = "liquid", fill = 1, color = rgb(165, 100, 60) },
			{ name = "Crème", kind = "swirl", r = 0.75, layers = 3, color = rgb(252, 205, 230) },
			{ name = "Vermicelles", kind = "sprinkles", count = 14, spread = 0.6 },
			{ name = "Cerise", kind = "ball", r = 0.17, color = rgb(210, 20, 40) },
		},
	},
	{
		id = "croissant",
		name = "Croissant",
		emoji = "🥐",
		rarity = "Commun",
		price = 30,
		plate = 1.7,
		slimeColor = rgb(225, 165, 85),
		steps = {
			{ name = "Pâte feuilletée", kind = "crescent", size = 1, color = rgb(245, 222, 175) },
			{ name = "Dorure à l'œuf", kind = "recolor", target = 1, color = rgb(240, 200, 120) },
			{ name = "Cuisson au four", kind = "recolor", target = 1, color = rgb(215, 150, 70) },
			{ name = "Pot de confiture", kind = "cup", r = 0.35, h = 0.35, at = { x = 0.9, z = 0.95 }, glass = true },
			{ name = "Confiture", kind = "liquid", fill = 0.85, color = rgb(200, 30, 60) },
		},
	},
	{
		id = "pizza",
		name = "Pizza pepperoni",
		emoji = "🍕",
		rarity = "Commun",
		price = 35,
		plate = 1.9,
		slimeColor = rgb(230, 95, 55),
		steps = {
			{ name = "Pâte à pizza", kind = "disc", r = 1.65, h = 0.22, color = rgb(232, 196, 140) },
			{ name = "Sauce tomate", kind = "disc", r = 1.5, h = 0.06, color = rgb(205, 45, 35) },
			{ name = "Mozzarella", kind = "disc", r = 1.4, h = 0.06, color = rgb(250, 236, 175) },
			{ name = "Pepperoni", kind = "pieces", piece = "disc", count = 8, size = 0.42, spread = 1.1, color = rgb(175, 30, 35) },
			{ name = "Basilic", kind = "pieces", piece = "leaf", count = 5, size = 0.24, spread = 1.1, color = GREEN_LEAF },
		},
	},
	{
		id = "tacos",
		name = "Tacos",
		emoji = "🌮",
		rarity = "Commun",
		price = 35,
		plate = 1.9,
		slimeColor = rgb(230, 170, 80),
		steps = {
			{ name = "Tortilla", kind = "disc", r = 1.5, h = 0.07, color = rgb(240, 210, 150) },
			{ name = "Viande", kind = "pieces", piece = "ball", count = 12, size = 0.3, spread = 0.9, color = rgb(125, 70, 40) },
			{ name = "Salade", kind = "pieces", piece = "leaf", count = 9, size = 0.26, spread = 0.95, color = rgb(110, 190, 60) },
			{ name = "Fromage râpé", kind = "pieces", piece = "strip", count = 14, size = 0.2, spread = 0.9, color = rgb(250, 205, 60) },
			{ name = "Salsa", kind = "pieces", piece = "cube", count = 8, size = 0.17, spread = 0.9, color = rgb(220, 45, 40) },
		},
	},
	{
		id = "salade_fruits",
		name = "Salade de fruits",
		emoji = "🍓",
		rarity = "Commun",
		price = 40,
		plate = 1.6,
		slimeColor = rgb(240, 95, 115),
		steps = {
			{ name = "Saladier en verre", kind = "cup", r = 1.25, h = 0.75, glass = true },
			{ name = "Fraises", kind = "pieces", piece = "ball", count = 5, size = 0.38, spread = 0.8, color = RED },
			{ name = "Kiwi", kind = "pieces", piece = "disc", count = 4, size = 0.5, spread = 0.8, color = rgb(130, 195, 55) },
			{ name = "Banane", kind = "pieces", piece = "disc", count = 5, size = 0.38, spread = 0.85, color = rgb(250, 240, 170) },
			{ name = "Myrtilles", kind = "pieces", piece = "ball", count = 9, size = 0.2, spread = 0.9, color = rgb(60, 60, 165) },
		},
	},

	------------------------------------------------------------------ RARES
	{
		id = "burger",
		name = "Burger",
		emoji = "🍔",
		rarity = "Rare",
		price = 60,
		plate = 1.8,
		slimeColor = rgb(205, 135, 65),
		steps = {
			{ name = "Pain du bas", kind = "disc", r = 1.2, h = 0.35, color = rgb(220, 155, 80) },
			{ name = "Steak", kind = "disc", r = 1.28, h = 0.32, color = rgb(105, 58, 35) },
			{ name = "Cheddar", kind = "block", size = { 2.2, 0.07, 2.2 }, rot = 45, color = rgb(250, 195, 40) },
			{ name = "Salade", kind = "disc", r = 1.38, h = 0.07, color = rgb(110, 195, 60) },
			{ name = "Tomate", kind = "disc", r = 1.05, h = 0.14, color = rgb(225, 50, 40) },
			{ name = "Pain du haut", kind = "dome", r = 1.25, h = 0.9, color = rgb(220, 155, 80) },
			{ name = "Graines de sésame", kind = "pieces", piece = "ball", count = 9, size = 0.11, spread = 0.75, color = rgb(250, 240, 210) },
		},
	},
	{
		id = "sushi",
		name = "Makis",
		emoji = "🍣",
		rarity = "Rare",
		price = 60,
		plate = 1.9,
		slimeColor = rgb(250, 145, 115),
		steps = {
			{ name = "Feuille de nori", kind = "disc", r = 0.5, h = 0.7, ats = { { x = -1.1, z = 0 }, { x = 0, z = 0 }, { x = 1.1, z = 0 } }, color = rgb(30, 55, 35) },
			{ name = "Riz", kind = "disc", r = 0.42, h = 0.03, ats = { { x = -1.1, z = 0 }, { x = 0, z = 0 }, { x = 1.1, z = 0 } }, color = WHITE },
			{ name = "Saumon", kind = "disc", r = 0.18, h = 0.03, ats = { { x = -1.1, z = 0 }, { x = 0, z = 0 }, { x = 1.1, z = 0 } }, color = rgb(250, 130, 85) },
			{ name = "Avocat", kind = "disc", r = 0.1, h = 0.035, ats = { { x = -0.93, z = 0.08 }, { x = 0.17, z = 0.08 }, { x = 1.27, z = 0.08 } }, color = rgb(140, 200, 70) },
			{ name = "Wasabi", kind = "ball", r = 0.22, at = { x = 0, z = 1.0 }, color = rgb(140, 200, 80) },
		},
	},
	{
		id = "macarons",
		name = "Macarons",
		emoji = "🌸",
		rarity = "Rare",
		price = 60,
		plate = 1.6,
		slimeColor = rgb(230, 170, 220),
		steps = {
			{
				name = "Coques du bas",
				kind = "disc",
				r = 0.55,
				h = 0.22,
				ats = { { x = -0.6, z = 0.35 }, { x = 0.6, z = 0.35 }, { x = 0, z = -0.65 } },
				colors = { rgb(250, 165, 200), rgb(170, 220, 140), rgb(190, 160, 240) },
			},
			{ name = "Ganache", kind = "disc", r = 0.47, h = 0.16, ats = { { x = -0.6, z = 0.35 }, { x = 0.6, z = 0.35 }, { x = 0, z = -0.65 } }, color = rgb(255, 245, 240) },
			{
				name = "Coques du haut",
				kind = "dome",
				r = 0.55,
				h = 0.32,
				ats = { { x = -0.6, z = 0.35 }, { x = 0.6, z = 0.35 }, { x = 0, z = -0.65 } },
				colors = { rgb(250, 165, 200), rgb(170, 220, 140), rgb(190, 160, 240) },
			},
			{ name = "Sucre glace", kind = "sprinkles", count = 14, spread = 1.1, colors = { WHITE } },
		},
	},
	{
		id = "petit_dej",
		name = "Petit-déjeuner",
		emoji = "🍳",
		rarity = "Rare",
		price = 70,
		plate = 2.0,
		slimeColor = rgb(250, 190, 80),
		steps = {
			{ name = "Toast", kind = "block", size = { 1.2, 0.25, 1.2 }, at = { x = -0.8, z = -0.5 }, color = rgb(225, 170, 95) },
			{ name = "Beurre", kind = "block", size = { 0.45, 0.08, 0.45 }, at = { x = -0.8, z = -0.5 }, color = rgb(250, 230, 140) },
			{ name = "Œuf au plat", kind = "pieces", piece = "friedegg", points = { { x = 0.7, z = -0.5 } }, size = 0.55 },
			{ name = "Bacon", kind = "block", size = { 1.3, 0.06, 0.22 }, ats = { { x = 0.3, z = 0.75 }, { x = 0.3, z = 1.05 } }, color = rgb(185, 70, 55) },
			{ name = "Verre", kind = "cup", r = 0.38, h = 0.9, at = { x = -1.2, z = 0.8 }, glass = true },
			{ name = "Jus d'orange", kind = "liquid", fill = 0.85, color = rgb(250, 160, 30) },
		},
	},
	{
		id = "spaghetti",
		name = "Spaghetti bolognaise",
		emoji = "🍝",
		rarity = "Rare",
		price = 70,
		plate = 1.8,
		slimeColor = rgb(225, 125, 60),
		steps = {
			{ name = "Spaghetti", kind = "nest", r = 1.1, h = 0.6, count = 45, color = rgb(245, 215, 120) },
			{ name = "Sauce bolognaise", kind = "dome", r = 0.75, h = 0.35, sink = 0.12, color = rgb(160, 50, 30) },
			{ name = "Parmesan", kind = "sprinkles", count = 16, spread = 0.7, colors = { rgb(252, 250, 235) } },
			{ name = "Basilic", kind = "pieces", piece = "leaf", count = 2, size = 0.3, spread = 0.3, color = GREEN_LEAF },
		},
	},
	{
		id = "coupe_glacee",
		name = "Coupe glacée",
		emoji = "🍨",
		rarity = "Rare",
		price = 75,
		plate = 1.4,
		slimeColor = rgb(250, 195, 205),
		steps = {
			{ name = "Coupe en verre", kind = "cup", r = 0.95, h = 0.75, glass = true },
			{ name = "Boule vanille", kind = "ball", r = 0.5, at = { x = -0.3, z = 0 }, color = rgb(250, 240, 205) },
			{ name = "Boule fraise", kind = "ball", r = 0.5, at = { x = 0.3, z = 0 }, color = rgb(250, 155, 175) },
			{ name = "Boule chocolat", kind = "ball", r = 0.48, at = { x = 0, z = 0.05 }, color = rgb(125, 75, 45) },
			{ name = "Chantilly", kind = "swirl", r = 0.38, layers = 2, color = WHITE },
			{ name = "Cerise", kind = "ball", r = 0.17, color = rgb(210, 20, 40) },
		},
	},
	{
		id = "ramen",
		name = "Ramen",
		emoji = "🍜",
		rarity = "Rare",
		price = 80,
		plate = 1.8,
		slimeColor = rgb(240, 180, 95),
		steps = {
			{ name = "Bol", kind = "cup", r = 1.4, h = 0.9, color = rgb(215, 50, 45) },
			{ name = "Bouillon", kind = "liquid", fill = 0.8, color = rgb(235, 175, 95) },
			{ name = "Nouilles", kind = "pieces", piece = "strip", count = 14, size = 0.35, spread = 1.0, color = rgb(250, 225, 130) },
			{ name = "Œuf mollet", kind = "pieces", piece = "egg", count = 2, size = 0.45, spread = 0.8 },
			{ name = "Chashu", kind = "pieces", piece = "disc", count = 2, size = 0.6, spread = 0.8, color = rgb(205, 140, 110) },
			{ name = "Ciboule", kind = "pieces", piece = "disc", count = 10, size = 0.14, spread = 1.0, color = rgb(90, 185, 60) },
		},
	},
	{
		id = "bubble_tea",
		name = "Bubble tea",
		emoji = "🧋",
		rarity = "Rare",
		price = 80,
		plate = 1.2,
		slimeColor = rgb(205, 155, 115),
		steps = {
			{ name = "Gobelet", kind = "cup", r = 0.65, h = 1.9, glass = true },
			{ name = "Perles de tapioca", kind = "pieces", piece = "ball", count = 14, size = 0.22, spread = 0.42, color = rgb(45, 28, 22) },
			{ name = "Thé au lait", kind = "liquid", fill = 0.85, transparency = 0.3, color = rgb(210, 170, 130) },
			{ name = "Couvercle", kind = "lid" },
			{ name = "Paille", kind = "straw", length = 2.6, tilt = 10, color = rgb(250, 120, 170) },
		},
	},
	{
		id = "milkshake",
		name = "Milkshake fraise",
		emoji = "🥤",
		rarity = "Rare",
		price = 75,
		plate = 1.2,
		slimeColor = rgb(250, 170, 200),
		steps = {
			{ name = "Grand verre", kind = "cup", r = 0.62, h = 1.7, glass = true },
			{ name = "Milkshake fraise", kind = "liquid", fill = 0.95, color = rgb(250, 165, 195) },
			{ name = "Chantilly", kind = "swirl", r = 0.6, layers = 3, color = WHITE },
			{ name = "Coulis de chocolat", kind = "pieces", piece = "ball", count = 8, size = 0.12, spread = 0.45, color = rgb(90, 50, 30) },
			{ name = "Cerise", kind = "ball", r = 0.15, color = rgb(210, 20, 40) },
			{ name = "Paille", kind = "straw", length = 2.6, tilt = 14, color = rgb(120, 200, 250) },
		},
	},

	------------------------------------------------------------------ ÉPIQUES
	{
		id = "gateau_anniv",
		name = "Gâteau d'anniversaire",
		emoji = "🎂",
		rarity = "Epique",
		price = 180,
		plate = 2.0,
		slimeColor = rgb(250, 200, 215),
		steps = {
			{ name = "Génoise", kind = "disc", r = 1.45, h = 0.7, color = rgb(240, 210, 160) },
			{ name = "Crème", kind = "disc", r = 1.47, h = 0.1, color = WHITE },
			{ name = "Deuxième étage", kind = "disc", r = 1.0, h = 0.6, color = rgb(240, 210, 160) },
			{ name = "Glaçage rose", kind = "disc", r = 1.02, h = 0.1, color = rgb(250, 180, 205) },
			{ name = "Fraises", kind = "pieces", piece = "ball", count = 8, size = 0.3, ring = 1.25, ringWidth = 0.05, color = RED },
			{ name = "Vermicelles", kind = "sprinkles", count = 14, spread = 0.85 },
			{ name = "Bougie", kind = "candle", h = 0.8, color = rgb(120, 180, 250) },
		},
	},
	{
		id = "burger_geant",
		name = "Burger géant",
		emoji = "🍔",
		rarity = "Epique",
		price = 220,
		plate = 2.0,
		slimeColor = rgb(190, 120, 60),
		steps = {
			{ name = "Pain du bas", kind = "disc", r = 1.25, h = 0.35, color = rgb(220, 155, 80) },
			{ name = "Steak n°1", kind = "disc", r = 1.3, h = 0.3, color = rgb(105, 58, 35) },
			{ name = "Cheddar", kind = "block", size = { 2.3, 0.07, 2.3 }, rot = 45, color = rgb(250, 195, 40) },
			{ name = "Steak n°2", kind = "disc", r = 1.3, h = 0.3, color = rgb(105, 58, 35) },
			{ name = "Cheddar fondu", kind = "block", size = { 2.3, 0.07, 2.3 }, rot = 15, color = rgb(250, 175, 30) },
			{ name = "Bacon", kind = "pieces", piece = "strip", count = 4, size = 0.5, spread = 0.6, color = rgb(185, 70, 55) },
			{ name = "Steak n°3", kind = "disc", r = 1.3, h = 0.3, color = rgb(105, 58, 35) },
			{ name = "Salade", kind = "disc", r = 1.4, h = 0.07, color = rgb(110, 195, 60) },
			{ name = "Tomate", kind = "disc", r = 1.05, h = 0.14, color = rgb(225, 50, 40) },
			{ name = "Pain du haut", kind = "dome", r = 1.3, h = 0.9, color = rgb(220, 155, 80) },
			{ name = "Pique avec olive", kind = "candle", h = 1.0, d = 0.08, flame = false, topColor = rgb(60, 110, 40), color = rgb(200, 160, 110) },
		},
	},
	{
		id = "fondue",
		name = "Fondue au chocolat",
		emoji = "🍫",
		rarity = "Epique",
		price = 200,
		plate = 2.0,
		slimeColor = rgb(120, 70, 40),
		steps = {
			{ name = "Caquelon", kind = "cup", r = 0.9, h = 0.8, color = rgb(200, 60, 50) },
			{ name = "Chocolat fondu", kind = "liquid", fill = 0.85, color = rgb(95, 55, 30) },
			{ name = "Fraises", kind = "pieces", piece = "ball", count = 5, size = 0.35, ring = 1.5, ringWidth = 0.05, color = RED },
			{ name = "Bananes", kind = "pieces", piece = "disc", count = 5, size = 0.42, ring = 1.5, ringWidth = 0.05, color = rgb(250, 235, 160) },
			{ name = "Guimauves", kind = "pieces", piece = "cube", count = 5, size = 0.3, ring = 1.5, ringWidth = 0.05, color = rgb(255, 240, 250) },
			{ name = "Brochettes", kind = "skewers", count = 3, length = 2.0, colors = { RED, rgb(250, 235, 160), rgb(255, 240, 250) } },
		},
	},
	{
		id = "bento",
		name = "Bento",
		emoji = "🍱",
		rarity = "Epique",
		price = 240,
		plate = 2.1,
		slimeColor = rgb(240, 120, 100),
		steps = {
			{ name = "Boîte à bento", kind = "tray", sx = 3.2, sz = 2.2, h = 0.45, dividers = { 0.4 }, color = rgb(45, 40, 50), innerColor = rgb(200, 60, 55) },
			{ name = "Riz", kind = "block", size = { 1.8, 0.25, 1.9 }, at = { x = -0.6, z = 0 }, color = WHITE },
			{ name = "Saumon grillé", kind = "block", size = { 0.8, 0.2, 0.5 }, at = { x = -0.6, z = 0.4 }, color = rgb(250, 140, 90) },
			{ name = "Tamagoyaki", kind = "block", size = { 0.9, 0.3, 0.4 }, ats = { { x = 0.97, z = -0.6 }, { x = 0.97, z = -0.1 } }, color = rgb(250, 215, 80) },
			{ name = "Brocolis", kind = "pieces", piece = "ball", count = 3, size = 0.3, spread = 0.25, center = { x = 0.97, z = 0.6 }, color = rgb(70, 150, 60) },
			{ name = "Tomates cerises", kind = "pieces", piece = "ball", count = 2, size = 0.25, spread = 0.3, center = { x = 0.97, z = 0.6 }, color = RED },
			{ name = "Umeboshi", kind = "ball", r = 0.15, at = { x = -0.95, z = -0.45 }, color = rgb(190, 40, 80) },
		},
	},

	------------------------------------------------------------------ LÉGENDAIRES
	{
		id = "gateau_arc_en_ciel",
		name = "Gâteau arc-en-ciel",
		emoji = "🌈",
		rarity = "Legendaire",
		price = 500,
		plate = 2.0,
		slimeColor = rgb(200, 120, 230),
		steps = {
			{ name = "Couche rouge", kind = "disc", r = 1.35, h = 0.25, color = rgb(235, 60, 60) },
			{ name = "Couche orange", kind = "disc", r = 1.35, h = 0.25, color = rgb(245, 150, 50) },
			{ name = "Couche jaune", kind = "disc", r = 1.35, h = 0.25, color = rgb(250, 220, 60) },
			{ name = "Couche verte", kind = "disc", r = 1.35, h = 0.25, color = rgb(90, 200, 90) },
			{ name = "Couche bleue", kind = "disc", r = 1.35, h = 0.25, color = rgb(70, 140, 240) },
			{ name = "Couche violette", kind = "disc", r = 1.35, h = 0.25, color = rgb(160, 90, 220) },
			{ name = "Glaçage blanc", kind = "disc", r = 1.38, h = 0.12, color = WHITE },
			{ name = "Nuages de chantilly", kind = "pieces", piece = "ball", count = 8, size = 0.38, ring = 1.05, ringWidth = 0.05, color = WHITE },
			{ name = "Vermicelles arc-en-ciel", kind = "sprinkles", count = 20, spread = 0.75 },
			{ name = "Corne de licorne", kind = "horn", h = 1.1, r = 0.22, color = rgb(250, 210, 80) },
		},
	},
	{
		id = "plateau_sushi",
		name = "Plateau royal de sushis",
		emoji = "👑",
		rarity = "Legendaire",
		price = 450,
		plate = false,
		slimeColor = rgb(245, 120, 110),
		steps = {
			{ name = "Planche en bois", kind = "block", size = { 4.0, 0.3, 2.8 }, material = "Wood", color = rgb(190, 140, 90) },
			{
				name = "Makis",
				kind = "pieces",
				piece = "maki",
				size = 0.55,
				points = { { x = -1.5, z = -0.4 }, { x = -0.9, z = -0.4 }, { x = -0.3, z = -0.4 }, { x = -1.5, z = 0.25 }, { x = -0.9, z = 0.25 }, { x = -0.3, z = 0.25 } },
				color = rgb(250, 130, 85),
			},
			{ name = "Nigiris saumon", kind = "pieces", piece = "nigiri", size = 0.45, points = { { x = 0.5, z = -0.6 }, { x = 0.5, z = 0 }, { x = 0.5, z = 0.6 } }, color = rgb(250, 140, 95) },
			{ name = "Nigiris thon", kind = "pieces", piece = "nigiri", size = 0.45, points = { { x = 1.4, z = -0.6 }, { x = 1.4, z = 0 }, { x = 1.4, z = 0.6 } }, color = rgb(210, 60, 70) },
			{ name = "Wasabi", kind = "ball", r = 0.2, at = { x = -1.6, z = 1.0 }, color = rgb(140, 200, 80) },
			{ name = "Gingembre", kind = "pieces", piece = "leaf", count = 4, size = 0.3, spread = 0.2, center = { x = -0.8, z = 1.0 }, color = rgb(250, 190, 180) },
			{ name = "Coupelle", kind = "cup", r = 0.3, h = 0.2, at = { x = -1.0, z = -1.05 }, color = WHITE },
			{ name = "Sauce soja", kind = "liquid", fill = 0.8, color = rgb(50, 25, 15) },
			{ name = "Baguettes", kind = "log", length = 2.3, d = 0.08, lift = 0.5, ats = { { x = 0.75, z = 1.05 }, { x = 0.75, z = 1.2 } }, color = rgb(160, 100, 60) },
		},
	},
}

Recipes.ById = {}
for index, recipe in Recipes.List do
	recipe.order = index
	Recipes.ById[recipe.id] = recipe
end

function Recipes.get(id)
	return Recipes.ById[id]
end

return Recipes
