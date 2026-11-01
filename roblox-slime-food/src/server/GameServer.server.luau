--[[
	GameServer (Script)
	Le "cerveau" du jeu côté serveur : pièces, sac des joueurs, achats au Marché,
	cuisine des kits, mélange en slime, vente au marchand et sauvegarde.
	Toutes les actions sont vérifiées ici pour éviter la triche.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Recipes = require(Shared:WaitForChild("Recipes"))
local Slimes = require(Shared:WaitForChild("Slimes"))
local FoodModel = require(Shared:WaitForChild("FoodModel"))
local KitBox = require(Shared:WaitForChild("KitBox"))

---------------------------------------------------------------- map

-- La map est déjà dans le fichier. Si elle a été supprimée, on la reconstruit.
if not workspace:FindFirstChild("Map") then
	local MapBuilder = require(script.Parent:WaitForChild("MapBuilder"))
	MapBuilder.build(workspace, { Recipes = Recipes, FoodModel = FoodModel, KitBox = KitBox, Config = Config })
end

---------------------------------------------------------------- communication

local Remotes = ReplicatedStorage:FindFirstChild("Remotes")
if not Remotes then
	Remotes = Instance.new("Folder")
	Remotes.Name = "Remotes"
	Remotes.Parent = ReplicatedStorage
end

local function ensureRemote(className, name)
	local remote = Remotes:FindFirstChild(name)
	if not remote then
		remote = Instance.new(className)
		remote.Name = name
		remote.Parent = Remotes
	end
	return remote
end

local Request = ensureRemote("RemoteFunction", "Request")
local DataChanged = ensureRemote("RemoteEvent", "DataChanged")

---------------------------------------------------------------- stations

-- Les stations sont les ProximityPrompt de la map qui ont l'attribut "Station"
local stations = {}
for _, descendant in workspace.Map:GetDescendants() do
	if descendant:IsA("ProximityPrompt") then
		local stationType = descendant:GetAttribute("Station")
		if stationType and descendant.Parent:IsA("BasePart") then
			stations[stationType] = stations[stationType] or {}
			table.insert(stations[stationType], descendant.Parent)
		end
	end
end

local function isNear(player, stationType)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root then
		return false
	end
	for _, stationPart in stations[stationType] or {} do
		if (stationPart.Position - root.Position).Magnitude <= Config.StationRange then
			return true
		end
	end
	return false
end

---------------------------------------------------------------- données des joueurs

local store = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[Marché Gluant] Sauvegarde indisponible : " .. tostring(result))
	end
end

local profiles = {} -- [player] = données
local canSave = {} -- [player] = true si on peut sauvegarder sans écraser une vieille sauvegarde
local lastRequest = {} -- [player] = os.clock() de la dernière action

local function newData()
	return {
		coins = Config.StartCoins,
		inventory = {},
		nextId = 1,
		stats = { built = 0, mixed = 0, sold = 0, earned = 0 },
	}
end

-- Nettoie une sauvegarde (au cas où des recettes ont été supprimées depuis)
local function cleanData(raw)
	local data = newData()
	if type(raw) ~= "table" then
		return data
	end
	if type(raw.coins) == "number" then
		data.coins = math.max(0, math.floor(raw.coins))
	end
	if type(raw.nextId) == "number" then
		data.nextId = math.max(1, math.floor(raw.nextId))
	end
	if type(raw.stats) == "table" then
		for key in data.stats do
			if type(raw.stats[key]) == "number" then
				data.stats[key] = raw.stats[key]
			end
		end
	end
	if type(raw.inventory) == "table" then
		for id, item in raw.inventory do
			local valid = type(id) == "string" and type(item) == "table" and Recipes.ById[item.recipe] ~= nil
			if valid and (item.kind == "kit" or item.kind == "food" or item.kind == "slime") then
				local clean = { kind = item.kind, recipe = item.recipe }
				if item.kind == "slime" then
					clean.texture = Slimes.ById[item.texture] and item.texture or "classique"
				end
				data.inventory[id] = clean
			end
		end
	end
	return data
end

local function itemCount(data)
	local n = 0
	for _ in data.inventory do
		n += 1
	end
	return n
end

local function slimeValue(item)
	return Slimes.value(Recipes.ById[item.recipe], item.texture, Config.SlimeValueMultiplier)
end

-- Ce que le joueur reçoit pour afficher son interface
local function publicData(data)
	local items = {}
	for id, item in data.inventory do
		table.insert(items, {
			id = id,
			kind = item.kind,
			recipe = item.recipe,
			texture = item.texture,
			value = item.kind == "slime" and slimeValue(item) or nil,
		})
	end
	return { coins = data.coins, items = items, stats = data.stats, maxItems = Config.MaxInventory }
end

local function push(player)
	local data = profiles[player]
	if not data then
		return
	end
	local leaderstats = player:FindFirstChild("leaderstats")
	local coins = leaderstats and leaderstats:FindFirstChild("Pièces")
	if coins then
		coins.Value = data.coins
	end
	DataChanged:FireClient(player, publicData(data))
end

local function addItem(data, kind, recipeId)
	local id = "i" .. data.nextId
	data.nextId += 1
	data.inventory[id] = { kind = kind, recipe = recipeId }
	return id
end

---------------------------------------------------------------- sauvegarde

local function keyFor(player)
	return "joueur_" .. player.UserId
end

local function loadPlayer(player)
	local data = nil
	local saveAllowed = false
	if store then
		local ok, result = pcall(function()
			return store:GetAsync(keyFor(player))
		end)
		if ok then
			data = cleanData(result)
			saveAllowed = true
		else
			warn("[Marché Gluant] Impossible de charger " .. player.Name .. " : " .. tostring(result))
			if RunService:IsStudio() then
				warn("[Marché Gluant] Dans Studio : publie le jeu puis active « Enable Studio Access to API Services » pour tester la sauvegarde.")
			end
		end
	end
	return data or newData(), saveAllowed
end

local function savePlayer(player)
	local data = profiles[player]
	if not data or not store or not canSave[player] then
		return
	end
	for attempt = 1, 3 do
		local ok, err = pcall(function()
			store:SetAsync(keyFor(player), data)
		end)
		if ok then
			return
		end
		warn(("[Marché Gluant] Sauvegarde ratée pour %s (essai %d) : %s"):format(player.Name, attempt, tostring(err)))
		task.wait(1)
	end
end

---------------------------------------------------------------- actions des joueurs

local function fail(message)
	return { ok = false, msg = message }
end

local random = Random.new()
local Actions = {}

function Actions.GetData(_player, data)
	return { ok = true, data = publicData(data) }
end

function Actions.BuyKit(player, data, recipeId)
	local recipe = type(recipeId) == "string" and Recipes.ById[recipeId]
	if not recipe then
		return fail("Ce kit n'existe pas.")
	end
	if not isNear(player, "Shop") then
		return fail("Approche-toi d'une caisse du Marché !")
	end
	if itemCount(data) >= Config.MaxInventory then
		return fail("Ton sac est plein ! Vends des slimes au marchand.")
	end
	if data.coins < recipe.price then
		return fail(("Il te manque %d pièces pour ce kit."):format(recipe.price - data.coins))
	end
	data.coins -= recipe.price
	local id = addItem(data, "kit", recipe.id)
	push(player)
	return { ok = true, id = id, msg = ("Kit %s %s acheté ! Va le préparer à la Cuisine 🍳"):format(recipe.emoji, recipe.name) }
end

function Actions.BuildFood(player, data, itemId)
	local item = type(itemId) == "string" and data.inventory[itemId]
	if not item or item.kind ~= "kit" then
		return fail("Tu n'as pas ce kit.")
	end
	if not isNear(player, "Kitchen") then
		return fail("Approche-toi d'un plan de travail de la Cuisine !")
	end
	item.kind = "food"
	data.stats.built += 1
	push(player)
	local recipe = Recipes.ById[item.recipe]
	return { ok = true, id = itemId, msg = ("%s %s est prêt(e) !"):format(recipe.emoji, recipe.name) }
end

function Actions.MixFood(player, data, itemId)
	local item = type(itemId) == "string" and data.inventory[itemId]
	if not item or item.kind ~= "food" then
		return fail("Tu n'as pas ce plat.")
	end
	if not isNear(player, "Mixer") then
		return fail("Approche-toi d'un bol géant du Labo !")
	end
	item.kind = "slime"
	item.texture = Slimes.roll(function()
		return random:NextNumber()
	end)
	data.stats.mixed += 1
	push(player)
	return { ok = true, id = itemId, texture = item.texture, value = slimeValue(item) }
end

function Actions.SellSlime(player, data, itemId)
	local item = type(itemId) == "string" and data.inventory[itemId]
	if not item or item.kind ~= "slime" then
		return fail("Tu n'as pas ce slime.")
	end
	if not isNear(player, "Merchant") then
		return fail("Approche-toi du marchand !")
	end
	local value = slimeValue(item)
	data.inventory[itemId] = nil
	data.coins += value
	data.stats.sold += 1
	data.stats.earned += value
	push(player)
	return { ok = true, msg = ("+%d pièces 🪙"):format(value) }
end

function Actions.SellAllSlimes(player, data)
	if not isNear(player, "Merchant") then
		return fail("Approche-toi du marchand !")
	end
	local total, count = 0, 0
	for id, item in data.inventory do
		if item.kind == "slime" then
			total += slimeValue(item)
			count += 1
			data.inventory[id] = nil
		end
	end
	if count == 0 then
		return fail("Tu n'as aucun slime à vendre.")
	end
	data.coins += total
	data.stats.sold += count
	data.stats.earned += total
	push(player)
	return { ok = true, msg = ("%d slime(s) vendu(s) : +%d pièces 🪙"):format(count, total) }
end

Request.OnServerInvoke = function(player, action, argument)
	local data = profiles[player]
	if not data then
		return { ok = false, loading = true }
	end
	local handler = type(action) == "string" and Actions[action]
	if not handler then
		return fail("Action inconnue.")
	end
	-- anti-spam : une action toutes les 0,15 seconde maximum
	local now = os.clock()
	if action ~= "GetData" and lastRequest[player] and now - lastRequest[player] < 0.15 then
		return fail("Doucement !")
	end
	lastRequest[player] = now
	local ok, result = pcall(handler, player, data, argument)
	if not ok then
		warn("[Marché Gluant] Erreur pendant " .. action .. " : " .. tostring(result))
		return fail("Oups, une erreur est arrivée.")
	end
	return result
end

---------------------------------------------------------------- arrivée et départ des joueurs

local function onPlayerAdded(player)
	local data, saveAllowed = loadPlayer(player)
	if not player.Parent then
		return -- le joueur est parti pendant le chargement
	end
	profiles[player] = data
	canSave[player] = saveAllowed

	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Pièces"
	coins.Value = data.coins
	coins.Parent = leaderstats
	leaderstats.Parent = player

	push(player)
end

local function onPlayerRemoving(player)
	savePlayer(player)
	profiles[player] = nil
	canSave[player] = nil
	lastRequest[player] = nil
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

-- sauvegarde automatique
task.spawn(function()
	while true do
		task.wait(Config.AutoSaveInterval)
		for player in profiles do
			task.spawn(savePlayer, player)
		end
	end
end)

-- sauvegarde quand le serveur s'arrête
game:BindToClose(function()
	if not store then
		return
	end
	local pending = 0
	for player in profiles do
		pending += 1
		task.spawn(function()
			savePlayer(player)
			pending -= 1
		end)
	end
	local start = os.clock()
	while pending > 0 and os.clock() - start < 20 do
		task.wait(0.2)
	end
end)
