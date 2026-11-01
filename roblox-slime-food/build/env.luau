-- Charge les ModuleScripts du jeu dans Lune, avec les types Roblox (Instance, Vector3, ...)
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")

local Env = {}

Env.roblox = roblox

local function makeEnvironment()
	return {
		Instance = roblox.Instance,
		Vector3 = roblox.Vector3,
		Vector2 = roblox.Vector2,
		CFrame = roblox.CFrame,
		Color3 = roblox.Color3,
		ColorSequence = roblox.ColorSequence,
		ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
		NumberSequence = roblox.NumberSequence,
		NumberRange = roblox.NumberRange,
		UDim = roblox.UDim,
		UDim2 = roblox.UDim2,
		Font = roblox.Font,
		Enum = roblox.Enum,
		BrickColor = roblox.BrickColor,
		warn = function(...)
			print("[warn]", ...)
		end,
	}
end

function Env.loadModule(path)
	local source = fs.readFile(path)
	local chunk = luau.load(source, { debugName = path, environment = makeEnvironment() })
	return chunk()
end

function Env.checkSyntax(path)
	local source = fs.readFile(path)
	local ok, err = pcall(luau.compile, source)
	return ok, err
end

return Env
