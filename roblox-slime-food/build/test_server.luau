-- Test du serveur sans Roblox : un faux joueur achète, cuisine, mélange et vend.
-- Lancer depuis le dossier roblox-slime-food :  lune run build/test_server.luau
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local Env = require("./env")
local roblox = Env.roblox
local Vector3 = roblox.Vector3

local failures = 0
local function check(cond, message)
	if not cond then
		failures += 1
		print("ÉCHEC : " .. message)
	end
end

---------------------------------------------------------------- faux Roblox

local function signal()
	local s = { handlers = {} }
	function s:Connect(fn)
		table.insert(self.handlers, fn)
	end
	function s:Fire(...)
		for _, fn in self.handlers do
			fn(...)
		end
	end
	return s
end

local function fakeInstance(className, name)
	local inst = { ClassName = className, Name = name or className, children = {} }
	function inst:FindFirstChild(childName)
		for _, child in self.children do
			if child.Name == childName then
				return child
			end
		end
		return nil
	end
	function inst:WaitForChild(childName)
		local child = self:FindFirstChild(childName)
		assert(child, "WaitForChild bloquerait : " .. childName)
		return child
	end
	return setmetatable(inst, {
		__newindex = function(t, key, value)
			if key == "Parent" then
				rawset(t, "_parent", value)
				if value then
					table.insert(value.children, t)
				end
			else
				rawset(t, key, value)
			end
		end,
		__index = function(t, key)
			if key == "Parent" then
				return rawget(t, "_parent")
			end
			return nil
		end,
	})
end

-- Modules partagés
local modules = {}
local shared = fakeInstance("Folder", "Shared")
for _, name in { "Config", "Recipes", "Slimes", "FoodModel" } do
	local token = fakeInstance("ModuleScript", name)
	token.Parent = shared
	modules[token] = Env.loadModule("src/shared/" .. name .. ".luau")
end
local Config = modules[shared:FindFirstChild("Config")]

local replicatedStorage = fakeInstance("ReplicatedStorage")
shared.Parent = replicatedStorage

-- Stations de la map (positions)
local stationPositions = {
	Shop = Vector3.new(-15, 2, -65),
	Kitchen = Vector3.new(73, 2, 8),
	Mixer = Vector3.new(-74, 2, -9),
	Merchant = Vector3.new(0, 2, 72),
}
local promptList = {}
for station, pos in stationPositions do
	local partObj = { Position = pos, IsA = function(_, c)
		return c == "BasePart"
	end }
	table.insert(promptList, {
		Parent = partObj,
		IsA = function(_, c)
			return c == "ProximityPrompt"
		end,
		GetAttribute = function(_, key)
			return key == "Station" and station or nil
		end,
	})
end
local workspaceFake = fakeInstance("Workspace")
local mapFake = fakeInstance("Folder", "Map")
mapFake.GetDescendants = function()
	return promptList
end
mapFake.Parent = workspaceFake
workspaceFake.Map = mapFake

-- Sauvegarde en mémoire
local savedData = {}
local dataStoreService = {
	GetDataStore = function()
		return {
			GetAsync = function(_, key)
				return savedData[key]
			end,
			SetAsync = function(_, key, value)
				-- copie profonde via JSON pour simuler un vrai DataStore
				local serde = require("@lune/serde")
				savedData[key] = serde.decode("json", serde.encode("json", value))
			end,
		}
	end,
}

local players = fakeInstance("Players")
players.PlayerAdded = signal()
players.PlayerRemoving = signal()
players.list = {}
players.GetPlayers = function()
	return players.list
end

local services = {
	Players = players,
	ReplicatedStorage = replicatedStorage,
	DataStoreService = dataStoreService,
	RunService = { IsStudio = function()
		return true
	end },
}

local fakeGame = {
	GetService = function(_, name)
		return assert(services[name], "service inconnu " .. name)
	end,
	BindToClose = function() end,
}

local fired = {}
local fakeInstanceNew = function(className)
	local inst = fakeInstance(className)
	if className == "RemoteEvent" then
		inst.FireClient = function(_, player, data)
			table.insert(fired, { player = player, data = data })
		end
	end
	return inst
end

local now = 0
local env = {
	game = fakeGame,
	workspace = workspaceFake,
	script = { Parent = fakeInstance("ServerScriptService") },
	Instance = { new = fakeInstanceNew },
	Random = { new = function()
		return { NextNumber = function()
			return math.random()
		end }
	end },
	task = {
		spawn = function(fn, ...)
			local co = coroutine.create(fn)
			coroutine.resume(co, ...)
		end,
		wait = function()
			coroutine.yield()
		end,
		defer = function() end,
		delay = function() end,
	},
	os = { clock = function()
		return now
	end, time = os.time },
	require = function(token)
		return assert(modules[token], "module inconnu")
	end,
	warn = function(...)
		print("[warn]", ...)
	end,
	Vector3 = Vector3,
}

local source = fs.readFile("src/server/GameServer.server.luau")
luau.load(source, { debugName = "GameServer", environment = env })()

local remotes = replicatedStorage:FindFirstChild("Remotes")
local request = remotes:FindFirstChild("Request")
check(type(request.OnServerInvoke) == "function", "OnServerInvoke non défini")

---------------------------------------------------------------- faux joueur

local root = { Position = Vector3.new(0, 3, 0) }
local character = { FindFirstChild = function(_, n)
	return n == "HumanoidRootPart" and root or nil
end }
local player = fakeInstance("Player", "Testeur")
player.UserId = 42
player.Character = character
player.Parent = players
table.insert(players.list, player)
players.PlayerAdded:Fire(player)

local function invoke(action, arg)
	now += 1
	return request.OnServerInvoke(player, action, arg)
end
local function goTo(station)
	root.Position = stationPositions[station] + Vector3.new(3, 0, 3)
end
local function coins()
	return invoke("GetData").data.coins
end
local function items(kind)
	local list = {}
	for _, item in invoke("GetData").data.items do
		if item.kind == kind then
			table.insert(list, item)
		end
	end
	return list
end

check(coins() == Config.StartCoins, "pièces de départ")
local leaderstats = player:FindFirstChild("leaderstats")
check(leaderstats and leaderstats:FindFirstChild("Pièces"), "leaderstats manquant")

-- Acheter loin de la caisse : refusé
root.Position = Vector3.new(0, 3, 0)
check(invoke("BuyKit", "pizza").ok == false, "achat loin de la caisse accepté")

-- Mauvais arguments
goTo("Shop")
check(invoke("BuyKit", "nexistepas").ok == false, "recette inconnue acceptée")
check(invoke("BuyKit", 123).ok == false, "argument nombre accepté")
check(invoke("BuyKit", nil).ok == false, "argument nil accepté")
check(invoke("Pirater").ok == false, "action inconnue acceptée")
check(invoke(nil).ok == false, "action nil acceptée")
check(invoke("BuyKit", "gateau_arc_en_ciel").ok == false, "kit trop cher accepté")

-- Achat normal
local buy = invoke("BuyKit", "pizza")
check(buy.ok == true, "achat pizza refusé : " .. tostring(buy.msg))
check(coins() == Config.StartCoins - 35, "prix de la pizza mal retiré")
check(#items("kit") == 1, "le kit n'est pas dans le sac")
check(#fired > 0, "le client n'a pas reçu ses données")

-- Anti-spam
local spam = request.OnServerInvoke(player, "BuyKit", "donut")
check(spam.ok == false, "anti-spam inactif")

-- Cuisiner
local kitId = items("kit")[1].id
check(invoke("BuildFood", kitId).ok == false, "cuisine loin du plan de travail acceptée")
goTo("Kitchen")
check(invoke("BuildFood", "faux_id").ok == false, "faux kit accepté")
check(invoke("BuildFood", kitId).ok == true, "cuisine refusée")
check(invoke("BuildFood", kitId).ok == false, "le même kit cuisiné deux fois")
check(#items("food") == 1 and #items("kit") == 0, "le kit n'est pas devenu un plat")

-- Mélanger
check(invoke("MixFood", kitId).ok == false, "mélange loin du labo accepté")
goTo("Mixer")
local mix = invoke("MixFood", kitId)
check(mix.ok == true, "mélange refusé")
check(type(mix.texture) == "string" and type(mix.value) == "number" and mix.value > 0, "résultat du mélange incomplet")
check(#items("slime") == 1 and #items("food") == 0, "le plat n'est pas devenu un slime")

-- Vendre
check(invoke("SellSlime", kitId).ok == false, "vente loin du marchand acceptée")
goTo("Merchant")
local before = coins()
check(invoke("SellSlime", kitId).ok == true, "vente refusée")
check(coins() == before + mix.value, "mauvais montant après la vente")
check(invoke("SellSlime", kitId).ok == false, "slime vendu deux fois")
check(invoke("SellAllSlimes").ok == false, "tout vendre sans slime accepté")

-- Plusieurs slimes + tout vendre
for _ = 1, 3 do
	goTo("Shop")
	check(invoke("BuyKit", "donut").ok, "achat donut")
end
for _, item in items("kit") do
	goTo("Kitchen")
	invoke("BuildFood", item.id)
	goTo("Mixer")
	invoke("MixFood", item.id)
end
check(#items("slime") == 3, "3 slimes attendus")
goTo("Merchant")
before = coins()
local expected = 0
for _, item in items("slime") do
	expected += item.value
end
check(invoke("SellAllSlimes").ok, "tout vendre refusé")
check(coins() == before + expected, "mauvais total après tout vendre")

-- Sac plein
goTo("Shop")
local data = invoke("GetData").data
local buyable = math.min(Config.MaxInventory, math.floor(data.coins / 25))
for _ = 1, Config.MaxInventory + 2 do
	invoke("BuyKit", "donut")
end
check(#items("kit") <= Config.MaxInventory, "le sac dépasse la limite")
check(#items("kit") == math.min(buyable, Config.MaxInventory), "nombre de kits achetés inattendu")

-- Sauvegarde et rechargement
local coinsBefore, kitsBefore = coins(), #items("kit")
players.PlayerRemoving:Fire(player)
check(savedData["joueur_42"] ~= nil, "les données n'ont pas été sauvegardées")
local player2 = fakeInstance("Player", "Testeur")
player2.UserId = 42
player2.Character = character
player2.Parent = players
players.PlayerAdded:Fire(player2)
now += 1
local reloaded = request.OnServerInvoke(player2, "GetData").data
check(reloaded.coins == coinsBefore, "pièces perdues après rechargement")
local kitCount = 0
for _, item in reloaded.items do
	if item.kind == "kit" then
		kitCount += 1
	end
end
check(kitCount == kitsBefore, "kits perdus après rechargement")

-- Une sauvegarde abîmée ne casse pas le jeu
savedData["joueur_7"] = { coins = "beaucoup", inventory = { i1 = { kind = "slime", recipe = "supprimee" }, i2 = { kind = "food", recipe = "pizza" }, [3] = "x" } }
local player3 = fakeInstance("Player", "Abime")
player3.UserId = 7
player3.Character = character
player3.Parent = players
players.PlayerAdded:Fire(player3)
now += 1
local cleaned = request.OnServerInvoke(player3, "GetData").data
check(cleaned.coins == Config.StartCoins, "pièces invalides non corrigées")
check(#cleaned.items == 1 and cleaned.items[1].recipe == "pizza", "inventaire abîmé mal nettoyé")

if failures > 0 then
	print(failures .. " test(s) serveur en échec")
	error("tests serveur en échec")
end
print("Tests du serveur OK ✅")
