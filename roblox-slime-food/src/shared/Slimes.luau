--[[
	Slimes (ModuleScript)
	Les textures de slime qu'on peut obtenir en mélangeant un plat, et le calcul de leur valeur.

	chance : plus le nombre est grand, plus la texture tombe souvent
	mult   : multiplie la valeur du slime chez le marchand
]]

local Slimes = {}

Slimes.Textures = {
	{ id = "classique", name = "Classique", chance = 50, mult = 1.0, color = Color3.fromRGB(150, 150, 160) },
	{ id = "brillant", name = "Pailleté", chance = 22, mult = 1.3, color = Color3.fromRGB(240, 190, 40) },
	{ id = "nuage", name = "Nuage", chance = 14, mult = 1.5, color = Color3.fromRGB(110, 190, 255) },
	{ id = "croquant", name = "Croquant", chance = 8, mult = 1.8, color = Color3.fromRGB(255, 130, 70) },
	{ id = "arcenciel", name = "Arc-en-ciel", chance = 4.5, mult = 2.5, color = Color3.fromRGB(255, 80, 170) },
	{ id = "galaxie", name = "Galaxie", chance = 1.5, mult = 4.0, color = Color3.fromRGB(120, 70, 230) },
}

Slimes.ById = {}
local totalChance = 0
for _, texture in Slimes.Textures do
	Slimes.ById[texture.id] = texture
	totalChance += texture.chance
end

-- Tire une texture au hasard. randomNumber() doit renvoyer un nombre entre 0 et 1.
function Slimes.roll(randomNumber)
	local x = randomNumber() * totalChance
	for _, texture in Slimes.Textures do
		x -= texture.chance
		if x < 0 then
			return texture.id
		end
	end
	return Slimes.Textures[1].id
end

-- Pourcentage de chance d'une texture (pour l'afficher aux joueurs)
function Slimes.percent(textureId)
	local texture = Slimes.ById[textureId]
	if not texture then
		return 0
	end
	return texture.chance / totalChance * 100
end

-- Valeur d'un slime chez le marchand
function Slimes.value(recipe, textureId, multiplier)
	local texture = Slimes.ById[textureId] or Slimes.Textures[1]
	return math.floor(recipe.price * (multiplier or 1.25) * texture.mult + 0.5)
end

-- Nom affiché d'un slime, par exemple "Slime Pizza pepperoni (Nuage)"
function Slimes.name(recipe, textureId)
	local texture = Slimes.ById[textureId] or Slimes.Textures[1]
	return "Slime " .. recipe.name .. " (" .. texture.name .. ")"
end

return Slimes
