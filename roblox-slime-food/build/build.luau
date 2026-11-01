-- Fabrique le fichier Roblox (dist/LeMarcheGluant.rbxl) à partir des fichiers de src/
-- Lancer depuis le dossier roblox-slime-food :  lune run build/build.luau
local fs = require("@lune/fs")
local Env = require("./env")
local roblox = Env.roblox
local Instance = roblox.Instance

local game = Instance.new("DataModel")
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")
local StarterPlayer = game:GetService("StarterPlayer")
local Lighting = game:GetService("Lighting")

local function addScript(className, name, parent, path)
	local script = Instance.new(className)
	script.Name = name
	script.Source = fs.readFile(path)
	script.Parent = parent
	return script
end

-- Code partagé (serveur + joueurs)
local shared = Instance.new("Folder")
shared.Name = "Shared"
shared.Parent = ReplicatedStorage
for _, name in { "Config", "Recipes", "Slimes", "FoodModel", "KitBox" } do
	addScript("ModuleScript", name, shared, "src/shared/" .. name .. ".luau")
end

-- Communication serveur <-> joueurs
local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage
local request = Instance.new("RemoteFunction")
request.Name = "Request"
request.Parent = remotes
local dataChanged = Instance.new("RemoteEvent")
dataChanged.Name = "DataChanged"
dataChanged.Parent = remotes

-- Serveur
addScript("Script", "GameServer", ServerScriptService, "src/server/GameServer.server.luau")
addScript("ModuleScript", "MapBuilder", ServerScriptService, "src/server/MapBuilder.luau")

-- Joueur
local starterPlayerScripts = Instance.new("StarterPlayerScripts")
starterPlayerScripts.Name = "StarterPlayerScripts"
starterPlayerScripts.Parent = StarterPlayer
addScript("LocalScript", "GameClient", starterPlayerScripts, "src/client/GameClient.client.luau")

-- La map, construite à l'avance pour la voir et la modifier dans Studio
local Config = Env.loadModule("src/shared/Config.luau")
local Recipes = Env.loadModule("src/shared/Recipes.luau")
local FoodModel = Env.loadModule("src/shared/FoodModel.luau")
local KitBox = Env.loadModule("src/shared/KitBox.luau")
local MapBuilder = Env.loadModule("src/server/MapBuilder.luau")
local map = MapBuilder.build(Workspace, { Config = Config, Recipes = Recipes, FoodModel = FoodModel, KitBox = KitBox })
MapBuilder.setupLighting(Lighting)

local count = 0
for _, d in map:GetDescendants() do
	if d:IsA("BasePart") then
		count += 1
	end
end
print(("Map : %d pièces"):format(count))

fs.writeDir("dist")
local placeFile = "dist/LeMarcheGluant.rbxl"
fs.writeFile(placeFile, roblox.serializePlace(game))
print("Fichier créé : " .. placeFile)
