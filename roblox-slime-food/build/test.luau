-- Tests : vérifie les recettes et construit tous les plats et slimes en 3D (sans Roblox)
-- Lancer depuis le dossier roblox-slime-food :  lune run build/test.luau
local Env = require("./env")

local failures = 0
local function check(cond, message)
	if not cond then
		failures += 1
		print("ÉCHEC : " .. message)
	end
end

local Config = Env.loadModule("src/shared/Config.luau")
local Recipes = Env.loadModule("src/shared/Recipes.luau")
local Slimes = Env.loadModule("src/shared/Slimes.luau")
local FoodModel = Env.loadModule("src/shared/FoodModel.luau")

-- Recettes
local seen = {}
for _, recipe in Recipes.List do
	check(type(recipe.id) == "string" and not recipe.id:find("[^%w_]"), "id invalide : " .. tostring(recipe.id))
	check(not seen[recipe.id], "id en double : " .. recipe.id)
	seen[recipe.id] = true
	check(type(recipe.name) == "string", recipe.id .. " : nom manquant")
	check(Config.Rarities[recipe.rarity] ~= nil, recipe.id .. " : rareté inconnue " .. tostring(recipe.rarity))
	check(type(recipe.price) == "number" and recipe.price > 0, recipe.id .. " : prix invalide")
	check(typeof(recipe.slimeColor) == "Color3", recipe.id .. " : slimeColor manquante")
	check(#recipe.steps >= 3, recipe.id .. " : il faut au moins 3 étapes")
	local names = {}
	for i, step in recipe.steps do
		check(FoodModel.Kinds[step.kind] ~= nil, recipe.id .. " étape " .. i .. " : type inconnu " .. tostring(step.kind))
		check(type(step.name) == "string", recipe.id .. " étape " .. i .. " : nom manquant")
		check(not names[step.name], recipe.id .. " : deux étapes ont le même nom (" .. step.name .. ")")
		names[step.name] = true
		if step.kind == "pieces" then
			check(step.piece == nil or FoodModel.Pieces[step.piece] ~= nil, recipe.id .. " : morceau inconnu " .. tostring(step.piece))
		end
		if step.kind == "recolor" then
			check(type(step.target) == "number" and step.target < i, recipe.id .. " : recolor doit viser une étape précédente")
		end
		if step.kind == "liquid" or step.kind == "lid" then
			local hasCup = false
			for j = 1, i - 1 do
				if recipe.steps[j].kind == "cup" then
					hasCup = true
				end
			end
			check(hasCup, recipe.id .. " : " .. step.kind .. " sans récipient avant")
		end
	end
end

-- Construction 3D de chaque plat, étape par étape
local totalParts = 0
for _, recipe in Recipes.List do
	local previous = -1
	for n = 0, #recipe.steps do
		local ok, model, extra = pcall(FoodModel.build, recipe, { steps = n })
		check(ok, recipe.id .. " : erreur à l'étape " .. n .. " : " .. tostring(model))
		check(extra == nil, "FoodModel.build doit renvoyer un seul résultat")
		if ok then
			local count = #model:GetChildren()
			check(count >= previous, recipe.id .. " : le nombre de morceaux diminue à l'étape " .. n)
			previous = count
			for _, part in model:GetChildren() do
				local s = part.Size
				check(s.X > 0 and s.Y > 0 and s.Z > 0, recipe.id .. " : morceau de taille nulle")
				local p = part.CFrame.Position
				check(p.Y > -0.5 and p.Y < 6, recipe.id .. " : morceau trop haut/bas (" .. p.Y .. ")")
				check(math.abs(p.X) < 2.6 and math.abs(p.Z) < 2.6, recipe.id .. " : morceau hors de l'assiette")
			end
		end
	end
	totalParts += previous
	print(string.format("%-20s %-11s %4d pièces  %2d étapes  %3d 🪙", recipe.id, recipe.rarity, previous, #recipe.steps, recipe.price))
end

-- Slimes
for _, recipe in Recipes.List do
	for _, texture in Slimes.Textures do
		local ok, model, extra = pcall(FoodModel.buildSlime, recipe, texture.id)
		check(ok, recipe.id .. "/" .. texture.id .. " : " .. tostring(model))
		check(extra == nil, "FoodModel.buildSlime doit renvoyer un seul résultat")
		check(not ok or #model:GetChildren() > 10, recipe.id .. "/" .. texture.id .. " : slime vide")
		check(Slimes.value(recipe, texture.id, Config.SlimeValueMultiplier) > 0, "valeur nulle")
	end
end

-- Tirage des textures : vérifie les pourcentages
local counts = {}
local seed = 12345
local function rand()
	seed = (seed * 16807) % 2147483647
	return (seed - 1) / 2147483646
end
for _ = 1, 100000 do
	local id = Slimes.roll(rand)
	counts[id] = (counts[id] or 0) + 1
end
for _, texture in Slimes.Textures do
	local got = (counts[texture.id] or 0) / 1000
	local expected = Slimes.percent(texture.id)
	check(math.abs(got - expected) < 0.6, "tirage " .. texture.id .. " : " .. got .. "% au lieu de " .. expected .. "%")
end

-- Rentabilité moyenne : un slime doit rapporter plus que le prix du kit
local average = 0
for _, texture in Slimes.Textures do
	average += texture.mult * Slimes.percent(texture.id) / 100
end
print(string.format("Gain moyen d'un slime : x%.2f le prix du kit", average * Config.SlimeValueMultiplier))
check(average * Config.SlimeValueMultiplier > 1.1, "les slimes ne rapportent pas assez")

print(string.format("%d recettes, %d morceaux au total", #Recipes.List, totalParts))
if failures > 0 then
	print(failures .. " test(s) en échec")
	error("tests en échec")
end
print("Tous les tests sont OK ✅")
