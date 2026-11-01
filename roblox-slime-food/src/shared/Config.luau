--[[
	Config (ModuleScript)
	Les réglages généraux du jeu. Tu peux changer les valeurs ici sans toucher au reste.
]]

local Config = {}

-- Nom affiché sur les panneaux et dans l'interface
Config.GameName = "Le Marché Gluant"

-- Pièces données à un nouveau joueur
Config.StartCoins = 100

-- Nombre maximum d'objets dans le sac (kits + plats + slimes)
Config.MaxInventory = 60

-- Sauvegarde (change le nom pour repartir de zéro)
Config.DataStoreName = "MarcheGluant_v1"
Config.AutoSaveInterval = 120 -- secondes

-- Distance max (en studs) pour utiliser une station (caisse, cuisine, labo, marchand)
Config.StationRange = 22

-- Nombre de clics pour mélanger un plat en slime
Config.MixClicks = 12

-- Valeur d'un slime = prix du kit x ce multiplicateur x bonus de texture
Config.SlimeValueMultiplier = 1.25

-- Les raretés des kits
Config.Rarities = {
	Commun = { order = 1, label = "Commun", color = Color3.fromRGB(96, 196, 110) },
	Rare = { order = 2, label = "Rare", color = Color3.fromRGB(70, 150, 255) },
	Epique = { order = 3, label = "Épique", color = Color3.fromRGB(176, 92, 255) },
	Legendaire = { order = 4, label = "Légendaire", color = Color3.fromRGB(255, 176, 30) },
}

return Config
