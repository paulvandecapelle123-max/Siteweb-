--[[
	MapBuilder (ModuleScript)
	Construit toute la map : la place avec la fontaine, le Marché, la Cuisine,
	le Labo à slime, le Marchand, la zone d'échange et la zone des mini-jeux.

	La map est déjà construite dans le fichier .rbxl. Si tu supprimes le dossier
	"Map" du Workspace, le jeu la reconstruit tout seul au lancement.
	Pour la reconstruire dans Studio sans lancer le jeu, colle ceci dans la barre de commande :
	  require(game.ServerScriptService.MapBuilder).rebuild()
]]

local MapBuilder = {}

local FONT = nil -- défini dans build()

local function rgb(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local C = {
	grass = rgb(126, 204, 104),
	path = rgb(246, 226, 192),
	plaza = rgb(255, 238, 210),
	pink = rgb(255, 105, 180),
	lightPink = rgb(255, 182, 215),
	yellow = rgb(255, 222, 70),
	cream = rgb(255, 244, 214),
	white = rgb(255, 253, 248),
	slime = rgb(125, 232, 115),
	purple = rgb(160, 100, 240),
	lavender = rgb(228, 210, 255),
	orange = rgb(255, 160, 60),
	red = rgb(240, 80, 90),
	wood = rgb(176, 120, 72),
	dark = rgb(55, 45, 65),
	gold = rgb(255, 205, 50),
	sky = rgb(190, 230, 255),
}

---------------------------------------------------------------- outils de construction

local function part(parent, props)
	local p = Instance.new("Part")
	if props.Shape then
		p.Shape = props.Shape
	end
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for key, value in props do
		if key ~= "Shape" then
			p[key] = value
		end
	end
	p.Parent = parent
	return p
end

local function block(parent, name, size, pos, color, extra)
	local props = extra or {}
	props.Name = name
	props.Size = size
	props.CFrame = props.CFrame or CFrame.new(pos)
	props.Color = color
	return part(parent, props)
end

-- Cylindre debout (h = hauteur, d = diamètre)
local function cylinder(parent, name, pos, h, d, color, extra)
	local props = extra or {}
	props.Name = name
	props.Shape = Enum.PartType.Cylinder
	props.Size = Vector3.new(h, d, d)
	props.CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2)
	props.Color = color
	return part(parent, props)
end

local function ball(parent, name, pos, d, color, extra)
	local props = extra or {}
	props.Name = name
	props.Shape = Enum.PartType.Ball
	props.Size = Vector3.new(d, d, d)
	props.CFrame = CFrame.new(pos)
	props.Color = color
	return part(parent, props)
end

local function ellipsoid(parent, name, size, cf, color, extra)
	local props = extra or {}
	props.Name = name
	props.Size = size
	props.CFrame = cf
	props.Color = color
	local p = part(parent, props)
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = p
	return p
end

local function folder(parent, name)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

local function model(parent, name)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

-- Rotation autour de l'axe vertical. angle = 0 : la face avant regarde vers -Z
local function facing(pos, angle)
	return CFrame.new(pos) * CFrame.Angles(0, angle, 0)
end

local FACE_PLUS_Z = math.pi -- regarde vers +Z
local FACE_MINUS_Z = 0 -- regarde vers -Z
local FACE_PLUS_X = -math.pi / 2 -- regarde vers +X
local FACE_MINUS_X = math.pi / 2 -- regarde vers -X

-- Panneau avec du texte sur la face avant
local function sign(parent, text, cf, size, background, textColor, extra)
	local props = extra or {}
	props.Name = "Panneau"
	props.Size = size
	props.CFrame = cf
	props.Color = background
	local p = part(parent, props)
	local gui = Instance.new("SurfaceGui")
	gui.Name = "Texte"
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.LightInfluence = 0
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.new(0.94, 0, 0.86, 0)
	label.Position = UDim2.new(0.03, 0, 0.07, 0)
	label.Text = text
	label.TextScaled = true
	label.TextWrapped = true
	label.TextColor3 = textColor
	label.TextStrokeTransparency = 0.75
	label.FontFace = FONT
	label.Parent = gui
	gui.Parent = p
	return p
end

local function prompt(parentPart, station, actionText, objectText)
	local pp = Instance.new("ProximityPrompt")
	pp.Name = "Station"
	pp.ActionText = actionText
	pp.ObjectText = objectText
	pp.HoldDuration = 0
	pp.MaxActivationDistance = 12
	pp.RequiresLineOfSight = false
	pp:SetAttribute("Station", station)
	pp.Parent = parentPart
	return pp
end

local function light(parentPart, range, brightness, color)
	local l = Instance.new("PointLight")
	l.Range = range
	l.Brightness = brightness
	l.Color = color or rgb(255, 240, 220)
	l.Parent = parentPart
	return l
end

-- Petit générateur pseudo-aléatoire pour la déco (toujours la même map)
local seed = 1
local function rand(a, b)
	seed = (seed * 16807) % 2147483647
	local f = (seed - 1) / 2147483646
	return a + (b - a) * f
end

---------------------------------------------------------------- décor réutilisable

local function tree(parent, x, z, s)
	local m = model(parent, "Arbre")
	cylinder(m, "Tronc", Vector3.new(x, 4 * s, z), 8 * s, 1.8 * s, rgb(140, 95, 60), { Material = Enum.Material.Wood })
	ball(m, "Feuilles", Vector3.new(x, 9.5 * s, z), 7.5 * s, rgb(92, 182, 92), { Material = Enum.Material.Grass })
	ball(m, "Feuilles", Vector3.new(x + 2 * s, 11.5 * s, z + 0.6 * s), 5.5 * s, rgb(112, 200, 100), { Material = Enum.Material.Grass })
	ball(m, "Feuilles", Vector3.new(x - 1.8 * s, 11 * s, z - 1.2 * s), 5 * s, rgb(100, 190, 96), { Material = Enum.Material.Grass })
end

local LOLLIPOP_COLORS = { rgb(255, 105, 180), rgb(120, 200, 255), rgb(255, 200, 60), rgb(170, 120, 255), rgb(120, 230, 140) }

local function lollipop(parent, x, z, index)
	local m = model(parent, "Sucette")
	local color = LOLLIPOP_COLORS[(index % #LOLLIPOP_COLORS) + 1]
	cylinder(m, "Baton", Vector3.new(x, 5, z), 10, 0.8, C.white)
	local candy = CFrame.new(x, 12.5, z) * CFrame.Angles(0, index * 0.7, 0)
	block(m, "Bonbon", Vector3.new(1.2, 6, 6), Vector3.zero, color, { Shape = Enum.PartType.Cylinder, CFrame = candy })
	block(m, "Spirale", Vector3.new(1.3, 4, 4), Vector3.zero, C.white, { Shape = Enum.PartType.Cylinder, CFrame = candy })
	block(m, "Centre", Vector3.new(1.4, 2, 2), Vector3.zero, color, { Shape = Enum.PartType.Cylinder, CFrame = candy })
end

local function lamp(parent, x, z)
	local m = model(parent, "Lampadaire")
	cylinder(m, "Poteau", Vector3.new(x, 5, z), 10, 0.6, rgb(90, 80, 110), { Material = Enum.Material.Metal })
	local bulb = ball(m, "Ampoule", Vector3.new(x, 10.6, z), 1.8, rgb(255, 240, 200), { Material = Enum.Material.Neon })
	light(bulb, 20, 1.2, rgb(255, 225, 180))
end

local function bench(parent, x, z, lookAt)
	local m = model(parent, "Banc")
	local base = CFrame.lookAt(Vector3.new(x, 0, z), Vector3.new(lookAt.X, 0, lookAt.Z))
	block(m, "Assise", Vector3.new(6, 0.5, 2), Vector3.zero, C.wood, { CFrame = base * CFrame.new(0, 1.6, 0), Material = Enum.Material.Wood })
	block(m, "Dossier", Vector3.new(6, 2, 0.4), Vector3.zero, C.wood, { CFrame = base * CFrame.new(0, 2.9, 0.9), Material = Enum.Material.Wood })
	block(m, "Pied", Vector3.new(0.4, 1.4, 1.8), Vector3.zero, C.dark, { CFrame = base * CFrame.new(-2.6, 0.7, 0) })
	block(m, "Pied", Vector3.new(0.4, 1.4, 1.8), Vector3.zero, C.dark, { CFrame = base * CFrame.new(2.6, 0.7, 0) })
end

-- Coulures de slime le long d'un bord (pour décorer les toits)
local function drips(parent, from, to, y, colors, size)
	size = size or 1
	local length = (to - from).Magnitude
	local count = math.floor(length / (4 * size))
	for i = 0, count do
		local pos = from:Lerp(to, i / count)
		local h = (2 + (i * 37 % 5) * 0.7) * size
		local color = colors[(i % #colors) + 1]
		ellipsoid(parent, "Coulure", Vector3.new(3.4 * size, h, 1.6 * size), CFrame.new(pos.X, y - h / 2 + 0.6 * size, pos.Z), color)
	end
end

---------------------------------------------------------------- zones

local function buildGround(map)
	local ground = folder(map, "Sol")
	block(ground, "Herbe", Vector3.new(420, 4, 420), Vector3.new(0, -2, 0), C.grass, { Material = Enum.Material.Grass })
	-- murs invisibles pour ne pas tomber de la map
	local walls = {
		{ Vector3.new(330, 80, 2), Vector3.new(0, 40, -165) },
		{ Vector3.new(330, 80, 2), Vector3.new(0, 40, 165) },
		{ Vector3.new(2, 80, 330), Vector3.new(-165, 40, 0) },
		{ Vector3.new(2, 80, 330), Vector3.new(165, 40, 0) },
	}
	for _, w in walls do
		block(ground, "MurInvisible", w[1], w[2], C.white, { Transparency = 1 })
	end
	-- chemins
	local paths = folder(map, "Chemins")
	block(paths, "CheminNord", Vector3.new(12, 0.2, 30), Vector3.new(0, 0.1, -46), C.path)
	block(paths, "CheminEst", Vector3.new(30, 0.2, 12), Vector3.new(46, 0.1, 0), C.path)
	block(paths, "CheminOuest", Vector3.new(30, 0.2, 12), Vector3.new(-46, 0.1, 0), C.path)
	block(paths, "CheminSud", Vector3.new(12, 0.2, 36), Vector3.new(0, 0.1, 48), C.path)
	block(paths, "CheminSudEst", Vector3.new(12, 0.2, 30), Vector3.zero, C.path, { CFrame = facing(Vector3.new(34, 0.1, 34), math.pi / 4) })
	block(paths, "CheminSudOuest", Vector3.new(12, 0.2, 30), Vector3.zero, C.path, { CFrame = facing(Vector3.new(-34, 0.1, 34), -math.pi / 4) })
end

local function buildPlaza(map, config)
	local plaza = folder(map, "Place")
	cylinder(plaza, "Bordure", Vector3.new(0, 0.15, 0), 0.3, 67, C.lightPink)
	cylinder(plaza, "Dalles", Vector3.new(0, 0.2, 0), 0.4, 64, C.plaza)

	-- fontaine à slime
	local fountain = model(plaza, "FontaineASlime")
	cylinder(fountain, "Bassin", Vector3.new(0, 1.05, 0), 1.6, 18, C.lightPink)
	cylinder(fountain, "Slime", Vector3.new(0, 1.9, 0), 0.2, 16, C.slime, { Reflectance = 0.1 })
	cylinder(fountain, "Colonne", Vector3.new(0, 4.35, 0), 5, 3, C.white)
	cylinder(fountain, "Vasque", Vector3.new(0, 7.2, 0), 0.8, 7, C.pink)
	ellipsoid(fountain, "GrosSlime", Vector3.new(6.5, 3.2, 6.5), CFrame.new(0, 8.2, 0), C.slime)
	for k = 0, 5 do
		local a = k / 6 * math.pi * 2
		ellipsoid(fountain, "Goutte", Vector3.new(0.9, 3, 0.9), CFrame.new(math.cos(a) * 3.3, 6.4, math.sin(a) * 3.3), C.slime)
		ellipsoid(fountain, "Flaque", Vector3.new(2.2, 0.6, 1.6), CFrame.new(math.cos(a + 0.5) * 5.5, 2.05, math.sin(a + 0.5) * 5.5), C.slime)
	end

	-- point d'apparition
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Apparition"
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Size = Vector3.new(8, 0.6, 8)
	spawn.CFrame = CFrame.new(0, 0.3, 16)
	spawn.Color = C.pink
	spawn.Material = Enum.Material.SmoothPlastic
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Parent = plaza

	-- arche de bienvenue au-dessus du chemin du Marché
	local arch = model(plaza, "Arche")
	block(arch, "Pilier", Vector3.new(2, 15, 2), Vector3.new(-10, 7.5, -33), C.pink)
	block(arch, "Pilier", Vector3.new(2, 15, 2), Vector3.new(10, 7.5, -33), C.pink)
	sign(arch, "✨ " .. config.GameName .. " ✨", facing(Vector3.new(0, 16.5, -33), FACE_PLUS_Z), Vector3.new(24, 4, 1.5), C.yellow, C.pink)

	-- bancs
	for _, a in { 205, 245, 295, 335 } do
		local rad = math.rad(a)
		bench(plaza, math.cos(rad) * 23, math.sin(rad) * 23, Vector3.zero)
	end
end

local function buildMarket(map, recipes, foodModel, kitBox, config, rarities)
	local market = folder(map, "Marche")
	local floorY = 0.4

	-- bâtiment (70 x 48, porte face à la place)
	local building = model(market, "Batiment")
	block(building, "Sol", Vector3.new(70, 0.8, 48), Vector3.new(0, 0, -80), rgb(255, 248, 236))
	block(building, "Tapis", Vector3.new(12, 0.06, 26), Vector3.new(0, floorY + 0.03, -70), C.lightPink)
	block(building, "MurFond", Vector3.new(70, 20, 2), Vector3.new(0, 10, -103), C.cream)
	block(building, "MurGauche", Vector3.new(2, 20, 48), Vector3.new(-34, 10, -80), C.cream)
	block(building, "MurDroit", Vector3.new(2, 20, 48), Vector3.new(34, 10, -80), C.cream)
	block(building, "Facade", Vector3.new(26, 20, 2), Vector3.new(-22, 10, -57), C.cream)
	block(building, "Facade", Vector3.new(26, 20, 2), Vector3.new(22, 10, -57), C.cream)
	block(building, "DessusPorte", Vector3.new(18, 7, 2), Vector3.new(0, 16.5, -57), C.cream)
	block(building, "Bande", Vector3.new(26.2, 2.4, 2.2), Vector3.new(-22, 1.2, -57), C.pink)
	block(building, "Bande", Vector3.new(26.2, 2.4, 2.2), Vector3.new(22, 1.2, -57), C.pink)
	block(building, "Vitre", Vector3.new(16, 8, 0.3), Vector3.new(-22, 8, -55.85), C.sky, { Transparency = 0.2, Reflectance = 0.2 })
	block(building, "Vitre", Vector3.new(16, 8, 0.3), Vector3.new(22, 8, -55.85), C.sky, { Transparency = 0.2, Reflectance = 0.2 })
	block(building, "Toit", Vector3.new(72, 1.5, 50), Vector3.new(0, 20.75, -80), C.yellow)
	drips(building, Vector3.new(-35, 0, -55.1), Vector3.new(35, 0, -55.1), 20.2, { C.pink, C.slime, C.lightPink })
	sign(building, kitBox.upper(config.GameName), facing(Vector3.new(0, 26, -56.5), FACE_PLUS_Z), Vector3.new(44, 9, 1), C.pink, C.white)

	-- lumières au plafond
	for _, x in { -20, 0, 20 } do
		for _, z in { -92, -72 } do
			local panel = block(building, "Neon", Vector3.new(8, 0.3, 2), Vector3.new(x, 19.85, z), rgb(255, 250, 235), { Material = Enum.Material.Neon })
			light(panel, 34, 0.8)
		end
	end

	-- caisses (stations pour acheter les kits)
	for _, x in { -15, 15 } do
		local counter = model(market, "Caisse")
		local body = block(counter, "Comptoir", Vector3.new(10, 3.4, 3), Vector3.new(x, floorY + 1.7, -63.5), C.pink)
		block(counter, "Plateau", Vector3.new(10.4, 0.3, 3.4), Vector3.new(x, floorY + 3.55, -63.5), C.white)
		block(counter, "Caisse", Vector3.new(1.8, 1.4, 1.4), Vector3.new(x - 3, floorY + 4.4, -63.5), rgb(90, 90, 110))
		block(counter, "Ecran", Vector3.new(1.4, 0.9, 0.2), Vector3.new(x - 3, floorY + 5.4, -63.1), rgb(120, 230, 255), { Material = Enum.Material.Neon })
		sign(counter, "🛒 CAISSE", facing(Vector3.new(x, 10, -63.5), FACE_PLUS_Z), Vector3.new(7, 1.8, 0.3), C.yellow, C.pink)
		prompt(body, "Shop", "Acheter des kits", "Caisse")
	end

	-- îlots : tous les kits dans leur boîte jaune, avec une étiquette de prix
	local kitSlots = {}
	for _, x in { -13, 13 } do
		local island = model(market, "IlotKits")
		block(island, "Meuble", Vector3.new(5, 4, 26), Vector3.new(x, floorY + 2, -82.2), C.white)
		sign(island, "KITS", facing(Vector3.new(x, floorY + 2.2, -69.1), FACE_PLUS_Z), Vector3.new(4.6, 2.4, 0.2), C.pink, C.white)
		for _, side in { -1, 1 } do
			for k = 0, 6 do
				table.insert(kitSlots, { parent = island, x = x, z = -93.3 + k * 3.7, side = side })
			end
		end
	end
	for i, recipe in recipes.List do
		local slot = kitSlots[i]
		if slot then
			local angle = slot.side < 0 and FACE_MINUS_X or FACE_PLUS_X
			local origin = CFrame.new(slot.x + slot.side * 1.2, floorY + 4, slot.z) * CFrame.Angles(0, angle, 0)
			local kit = kitBox.buildModel(recipe, { origin = origin, gameName = config.GameName })
			kit.Parent = slot.parent
			local tagPos = Vector3.new(slot.x + slot.side * 2.58, floorY + 3, slot.z)
			sign(slot.parent, recipe.emoji .. " " .. recipe.price .. " pièces", facing(tagPos, angle), Vector3.new(3.2, 1.3, 0.15), rarities[recipe.rarity].color, C.white)
		end
	end

	-- vitrine : un exemplaire de chaque plat, avec son nom et son prix
	local vitrine = folder(market, "Vitrine")
	local slots = {}
	for k = 0, 8 do
		table.insert(slots, { pos = Vector3.new(-30 + k * 7.5, 0, -99.5), angle = 0, label = Vector3.new(-30 + k * 7.5, 2.2, -96.85), labelAngle = FACE_PLUS_Z, scale = 0.85 })
	end
	for k = 0, 7 do
		local z = -93.5 + k * 4.2
		table.insert(slots, { pos = Vector3.new(-30.5, 0, z), angle = -math.pi / 2, label = Vector3.new(-27.85, 2.2, z), labelAngle = FACE_PLUS_X, scale = 0.75 })
		table.insert(slots, { pos = Vector3.new(30.5, 0, z), angle = math.pi / 2, label = Vector3.new(27.85, 2.2, z), labelAngle = FACE_MINUS_X, scale = 0.75 })
	end
	block(vitrine, "MeubleFond", Vector3.new(66, 3, 5), Vector3.new(0, floorY + 1.5, -99.5), C.white)
	block(vitrine, "MeubleGauche", Vector3.new(5, 3, 34), Vector3.new(-30.5, floorY + 1.5, -78.8), C.white)
	block(vitrine, "MeubleDroit", Vector3.new(5, 3, 34), Vector3.new(30.5, floorY + 1.5, -78.8), C.white)
	for i, recipe in recipes.List do
		local slot = slots[i]
		if slot then
			local origin = CFrame.new(slot.pos.X, floorY + 3, slot.pos.Z) * CFrame.Angles(0, slot.angle, 0)
			local food = foodModel.build(recipe, { origin = origin, scale = slot.scale })
			food.Parent = vitrine
			local rarity = rarities[recipe.rarity]
			local width = slot.scale > 0.8 and 6.4 or 3.9
			sign(vitrine, recipe.emoji .. " " .. recipe.name .. "\n" .. recipe.price .. " pièces", facing(slot.label, slot.labelAngle), Vector3.new(width, 1.8, 0.2), rarity.color, C.white)
		end
	end
end

local function buildKitchen(map)
	local kitchen = folder(map, "Cuisine")
	local cx = 82
	local floorY = 0.4
	-- carrelage
	for i = 0, 7 do
		for j = 0, 5 do
			local color = (i + j) % 2 == 0 and C.white or rgb(255, 196, 210)
			block(kitchen, "Carreau", Vector3.new(5.5, 0.8, 6), Vector3.new(62.75 + i * 5.5, 0, -15 + j * 6), color)
		end
	end
	-- piliers et toit rayé
	for _, x in { 61, 103 } do
		for _, z in { -17, 17 } do
			cylinder(kitchen, "Pilier", Vector3.new(x, 7, z), 14, 1.6, C.white)
		end
	end
	for i = 0, 7 do
		block(kitchen, "Toile", Vector3.new(5.5, 0.6, 38), Vector3.new(62.75 + i * 5.5, 14.3, 0), i % 2 == 0 and C.red or C.white)
	end
	sign(kitchen, "🍳 LA CUISINE", facing(Vector3.new(59.5, 17.6, 0), FACE_MINUS_X), Vector3.new(30, 6, 1), C.orange, C.white)

	-- mur du fond avec four et frigo
	block(kitchen, "MurFond", Vector3.new(1, 13, 36), Vector3.new(104.5, floorY + 6.5, 0), C.cream)
	local oven = model(kitchen, "Four")
	block(oven, "Corps", Vector3.new(3, 4.5, 5), Vector3.new(102.4, floorY + 2.25, -10), rgb(70, 70, 85))
	block(oven, "Vitre", Vector3.new(0.2, 2.2, 3.4), Vector3.new(100.85, floorY + 2, -10), C.orange, { Material = Enum.Material.Neon })
	local fridge = model(kitchen, "Frigo")
	block(fridge, "Corps", Vector3.new(3, 8, 5), Vector3.new(102.4, floorY + 4, 10), rgb(215, 240, 255))
	block(fridge, "Poignee", Vector3.new(0.3, 2.5, 0.3), Vector3.new(100.8, floorY + 5, 8), rgb(150, 160, 180))

	-- plans de travail (stations pour cuisiner les kits)
	for _, x in { cx - 9, cx + 9 } do
		for _, z in { -8, 8 } do
			local counter = model(kitchen, "PlanDeTravail")
			local body = block(counter, "Meuble", Vector3.new(9, 3.4, 5), Vector3.new(x, floorY + 1.7, z), C.orange)
			block(counter, "Plateau", Vector3.new(9.4, 0.3, 5.4), Vector3.new(x, floorY + 3.55, z), C.white)
			block(counter, "Planche", Vector3.new(3, 0.15, 2.2), Vector3.new(x - 2, floorY + 3.78, z), C.wood, { Material = Enum.Material.Wood })
			cylinder(counter, "Assiette", Vector3.new(x + 2, floorY + 3.8, z), 0.2, 2.8, C.white)
			prompt(body, "Kitchen", "Cuisiner", "Plan de travail")
		end
	end
end

local function buildLab(map)
	local lab = folder(map, "Labo")
	local floorY = 0.4
	block(lab, "Sol", Vector3.new(44, 0.8, 36), Vector3.new(-82, 0, 0), C.lavender)
	local puddleColors = { C.slime, rgb(255, 140, 200), rgb(120, 190, 255) }
	for k = 1, 6 do
		ellipsoid(lab, "Flaque", Vector3.new(rand(3, 6), 0.3, rand(2, 4)), CFrame.new(rand(-100, -64), floorY + 0.05, rand(-15, 15)) * CFrame.Angles(0, rand(0, 3), 0), puddleColors[(k % 3) + 1])
	end
	for _, x in { -61, -103 } do
		for _, z in { -17, 17 } do
			cylinder(lab, "Pilier", Vector3.new(x, 7, z), 14, 1.6, C.white)
		end
	end
	block(lab, "Toit", Vector3.new(46, 1, 38), Vector3.new(-82, 14.5, 0), C.purple)
	drips(lab, Vector3.new(-59.2, 0, -18), Vector3.new(-59.2, 0, 18), 14.1, { C.slime, rgb(255, 140, 200), rgb(120, 190, 255) }, 0.55)
	sign(lab, "🧪 LE LABO À SLIME", facing(Vector3.new(-59.5, 18, 0), FACE_PLUS_X), Vector3.new(32, 6, 1), C.purple, C.white)

	-- étagère à potions au fond
	block(lab, "MurFond", Vector3.new(1, 13, 36), Vector3.new(-104.5, floorY + 6.5, 0), C.lavender)
	local potionColors = { C.slime, rgb(255, 120, 200), rgb(120, 190, 255), rgb(255, 220, 80) }
	for row = 0, 2 do
		local y = floorY + 3 + row * 3
		block(lab, "Etagere", Vector3.new(2.2, 0.3, 30), Vector3.new(-103, y, 0), C.wood, { Material = Enum.Material.Wood })
		for k = 0, 7 do
			local z = -13 + k * 3.7
			cylinder(lab, "Flacon", Vector3.new(-103, y + 0.95, z), 1.6, 1, C.white, { Transparency = 0.5 })
			cylinder(lab, "Potion", Vector3.new(-103, y + 0.75, z), 1.1, 0.8, potionColors[((k + row) % 4) + 1], { Material = Enum.Material.Neon })
		end
	end

	-- bols géants (stations pour mélanger)
	local bowls = {
		{ x = -74, z = -9, color = C.slime },
		{ x = -74, z = 9, color = rgb(255, 140, 200) },
		{ x = -92, z = 0, color = rgb(120, 190, 255) },
	}
	for i, b in bowls do
		local bowl = model(lab, "BolGeant")
		local body = cylinder(bowl, "Bol", Vector3.new(b.x, floorY + 1.8, b.z), 3.6, 9, rgb(255, 238, 250))
		cylinder(bowl, "Bord", Vector3.new(b.x, floorY + 3.6, b.z), 0.5, 9.6, C.pink)
		cylinder(bowl, "Slime", Vector3.new(b.x, floorY + 3.75, b.z), 0.3, 8.2, b.color)
		ellipsoid(bowl, "Bulle", Vector3.new(3, 1.4, 2.4), CFrame.new(b.x + 1, floorY + 4, b.z - 1), b.color)
		ellipsoid(bowl, "Bulle", Vector3.new(2, 1, 2), CFrame.new(b.x - 1.6, floorY + 3.9, b.z + 1.4), b.color)
		-- grande cuillère
		local spoonAngle = i * 2.1
		local tilt = math.rad(30)
		local dir = Vector3.new(math.cos(spoonAngle) * math.sin(tilt), math.cos(tilt), math.sin(spoonAngle) * math.sin(tilt))
		local bottom = Vector3.new(b.x, floorY + 3.2, b.z)
		local rot = CFrame.Angles(0, -spoonAngle, 0) * CFrame.Angles(0, 0, -tilt) * CFrame.Angles(0, 0, math.pi / 2)
		block(bowl, "Cuillere", Vector3.new(8, 0.6, 0.6), Vector3.zero, C.wood, { Shape = Enum.PartType.Cylinder, CFrame = CFrame.new(bottom + dir * 4) * rot, Material = Enum.Material.Wood })
		prompt(body, "Mixer", "Mélanger", "Bol géant")
	end
end

local function buildMerchant(map)
	local shop = folder(map, "Marchand")
	local floorY = 0.4
	cylinder(shop, "Estrade", Vector3.new(0, 0.2, 80), 0.4, 32, C.lavender)
	-- comptoir
	local body = block(shop, "Comptoir", Vector3.new(16, 3.4, 4), Vector3.new(0, floorY + 1.7, 72), C.purple)
	block(shop, "Plateau", Vector3.new(16.4, 0.3, 4.4), Vector3.new(0, floorY + 3.55, 72), C.gold)
	prompt(body, "Merchant", "Vendre mes slimes", "Marchand")
	-- piles de pièces sur le comptoir
	for k, x in { -6, -4.5, 5, 6.3 } do
		for level = 0, k % 3 + 1 do
			cylinder(shop, "Piece", Vector3.new(x, floorY + 3.85 + level * 0.3, 72), 0.3, 1.4, C.gold, { Material = Enum.Material.Metal })
		end
	end

	-- le marchand : un gros slime avec un chapeau
	local npc = model(shop, "SlimeMarchand")
	local skin = rgb(130, 220, 140)
	ellipsoid(npc, "Corps", Vector3.new(8, 7, 7), CFrame.new(0, floorY + 3.3, 79), skin)
	for _, side in { -1, 1 } do
		ball(npc, "Oeil", Vector3.new(side * 1.4, floorY + 4.9, 75.9), 1.8, C.white)
		ball(npc, "Pupille", Vector3.new(side * 1.4, floorY + 4.9, 75.15), 0.9, C.dark)
		ellipsoid(npc, "Joue", Vector3.new(1.2, 0.6, 0.4), CFrame.new(side * 2.4, floorY + 3.8, 75.9), C.lightPink)
	end
	block(npc, "Sourire", Vector3.new(2.2, 0.35, 0.3), Vector3.new(0, floorY + 3.4, 75.6), C.dark)
	cylinder(npc, "BordChapeau", Vector3.new(0, floorY + 6.9, 79), 0.3, 5.2, C.dark)
	cylinder(npc, "Chapeau", Vector3.new(0, floorY + 8.5, 79), 3, 3.4, C.dark)
	cylinder(npc, "Ruban", Vector3.new(0, floorY + 7.5, 79), 0.6, 3.5, C.purple)

	-- auvent rayé
	for _, x in { -8.5, 8.5 } do
		for _, z in { 70, 86 } do
			cylinder(shop, "Poteau", Vector3.new(x, 6, z), 12, 0.8, C.white)
		end
	end
	for k = 0, 5 do
		block(shop, "Toile", Vector3.new(18, 0.5, 3), Vector3.new(0, 12.2, 70.5 + k * 3), k % 2 == 0 and C.purple or C.white)
	end
	sign(shop, "💰 LE MARCHAND DE SLIMES", facing(Vector3.new(0, 15.6, 69.5), FACE_MINUS_Z), Vector3.new(26, 5, 1), C.gold, C.purple)
	-- coffre au trésor
	block(shop, "Coffre", Vector3.new(4, 2.6, 2.6), Vector3.new(7, floorY + 1.3, 83), C.wood, { Material = Enum.Material.Wood })
	block(shop, "Or", Vector3.new(3.6, 0.6, 2.2), Vector3.new(7, floorY + 2.8, 83), C.gold, { Material = Enum.Material.Metal })
end

local function buildTradeZone(map)
	local zone = folder(map, "ZoneEchange")
	local cx, cz = 55, 55
	cylinder(zone, "Estrade", Vector3.new(cx, 0.2, cz), 0.4, 32, rgb(190, 230, 255))
	cylinder(zone, "Centre", Vector3.new(cx, 0.25, cz), 0.4, 10, C.white)
	for _, ox in { -8, 8 } do
		for _, oz in { -8, 8 } do
			local tx, tz = cx + ox, cz + oz
			cylinder(zone, "PiedTable", Vector3.new(tx, 1.9, tz), 3, 0.6, C.dark)
			cylinder(zone, "Table", Vector3.new(tx, 3.5, tz), 0.3, 5, C.white)
			cylinder(zone, "Tabouret", Vector3.new(tx - 3.6, 1.3, tz), 1.8, 2, C.pink)
			cylinder(zone, "Tabouret", Vector3.new(tx + 3.6, 1.3, tz), 1.8, 2, C.pink)
		end
	end
	local signCF = facing(Vector3.new(44, 10, 44), math.pi / 4)
	sign(zone, "🤝 ZONE D'ÉCHANGE\nBientôt !", signCF, Vector3.new(14, 5, 0.8), rgb(80, 160, 255), C.white)
	cylinder(zone, "Poteau", (signCF * CFrame.new(-6, -5, 0.6)).Position, 10, 0.6, C.white)
	cylinder(zone, "Poteau", (signCF * CFrame.new(6, -5, 0.6)).Position, 10, 0.6, C.white)
end

local function buildMiniGames(map)
	local zone = folder(map, "MiniJeux")
	local cx, cz = -55, 55
	local colors = { rgb(255, 120, 120), rgb(255, 200, 80), rgb(120, 220, 130), rgb(110, 180, 255), rgb(190, 130, 255) }
	for i = 0, 4 do
		for j = 0, 4 do
			block(zone, "Dalle", Vector3.new(6, 0.4, 6), Vector3.new(cx - 12 + i * 6, 0.2, cz - 12 + j * 6), colors[((i + j) % #colors) + 1])
		end
	end
	local archCF = facing(Vector3.new(-44, 0, 44), -math.pi / 4)
	block(zone, "Pilier", Vector3.new(2, 14, 2), Vector3.zero, C.yellow, { CFrame = archCF * CFrame.new(-7, 7, 0) })
	block(zone, "Pilier", Vector3.new(2, 14, 2), Vector3.zero, C.yellow, { CFrame = archCF * CFrame.new(7, 7, 0) })
	sign(zone, "🎮 MINI-JEUX\nBientôt !", archCF * CFrame.new(0, 15.5, 0), Vector3.new(17, 5, 1), C.pink, C.white)
	ball(zone, "GrosseBalle", Vector3.new(cx + 4, 3, cz + 4), 6, rgb(255, 120, 200))
	for k = 0, 3 do
		local a = k / 4 * math.pi * 2
		cylinder(zone, "Plot", Vector3.new(cx + math.cos(a) * 10, 1, cz + math.sin(a) * 10), 2, 1.4, C.orange)
	end
end

local function buildDecor(map)
	local decor = folder(map, "Deco")
	local trees = {
		{ -42, -28 }, { 42, -28 }, { -48, -50 }, { 48, -50 }, { -80, -42 }, { 80, -42 }, { -80, 42 }, { 80, 40 },
		{ -120, -62 }, { 120, -62 }, { -122, 40 }, { 122, 40 }, { -100, -112 }, { 100, -112 }, { -60, -126 },
		{ 60, -126 }, { 0, -132 }, { -134, 0 }, { 134, 0 }, { -30, 112 }, { 30, 112 }, { -92, 100 }, { 92, 100 },
		{ 0, 128 }, { -128, -126 }, { 128, -126 }, { -128, 128 }, { 128, 128 }, { -140, 80 }, { 140, -90 },
	}
	for i, t in trees do
		tree(decor, t[1], t[2], 0.9 + (i % 4) * 0.12)
	end
	local lollipops = { { -55, -28 }, { 55, -28 }, { -24, -44 }, { 24, -44 }, { -110, 72 }, { 110, 72 }, { 0, 105 }, { -140, -40 }, { 140, 40 }, { -60, 100 }, { 60, 100 } }
	for i, l in lollipops do
		lollipop(decor, l[1], l[2], i)
	end
	for _, z in { -38, -50 } do
		lamp(decor, -8, z)
		lamp(decor, 8, z)
	end
	for _, x in { 38, 50 } do
		lamp(decor, x, -8)
		lamp(decor, x, 8)
		lamp(decor, -x, -8)
		lamp(decor, -x, 8)
	end
	for _, z in { 40, 54 } do
		lamp(decor, -8, z)
		lamp(decor, 8, z)
	end
	-- fleurs
	local flowerColors = { rgb(255, 120, 180), rgb(255, 220, 80), rgb(170, 130, 255), rgb(255, 255, 255) }
	for k = 1, 60 do
		local a = rand(0, math.pi * 2)
		local r = rand(36, 140)
		local x, z = math.cos(a) * r, math.sin(a) * r
		local onPath = math.abs(x) < 9 or math.abs(z) < 9 or math.abs(math.abs(x) - z) < 9
		local inBuilding = (math.abs(x) < 38 and z < -52) or (math.abs(x) > 56 and math.abs(x) < 108 and math.abs(z) < 20) or (math.abs(x) < 18 and z > 62 and z < 98)
		local inZone = (Vector3.new(math.abs(x), 0, z) - Vector3.new(55, 0, 55)).Magnitude < 20
		if not onPath and not inBuilding and not inZone then
			ball(decor, "Fleur", Vector3.new(x, 0.5, z), 1.1, flowerColors[(k % #flowerColors) + 1])
		end
	end
end

---------------------------------------------------------------- point d'entrée

function MapBuilder.setupLighting(lighting)
	lighting.TimeOfDay = "14:00:00"
	lighting.Brightness = 2
	lighting.Ambient = rgb(110, 100, 125)
	lighting.OutdoorAmbient = rgb(150, 140, 165)
	lighting.GlobalShadows = true
end

-- deps = { Recipes = ..., FoodModel = ..., KitBox = ..., Config = ... }
function MapBuilder.build(parent, deps)
	FONT = Font.fromEnum(Enum.Font.FredokaOne)
	seed = 1
	local map = Instance.new("Folder")
	map.Name = "Map"
	buildGround(map)
	buildPlaza(map, deps.Config)
	buildMarket(map, deps.Recipes, deps.FoodModel, deps.KitBox, deps.Config, deps.Config.Rarities)
	buildKitchen(map)
	buildLab(map)
	buildMerchant(map)
	buildTradeZone(map)
	buildMiniGames(map)
	buildDecor(map)
	map.Parent = parent
	return map
end

-- À utiliser dans la barre de commande de Studio pour reconstruire la map
function MapBuilder.rebuild()
	local shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
	local old = workspace:FindFirstChild("Map")
	if old then
		old:Destroy()
	end
	return MapBuilder.build(workspace, {
		Recipes = require(shared.Recipes),
		FoodModel = require(shared.FoodModel),
		Config = require(shared.Config),
		KitBox = require(shared.KitBox),
	})
end

return MapBuilder
