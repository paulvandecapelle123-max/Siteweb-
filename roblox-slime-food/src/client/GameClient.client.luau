--[[
	GameClient (LocalScript)
	Toute l'interface du joueur : pièces, sac, Marché, Cuisine, Labo à slime, Marchand et aide.
	Les fenêtres s'ouvrent quand on utilise une station (touche E ou bouton sur mobile).
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ProximityPromptService = game:GetService("ProximityPromptService")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Recipes = require(Shared:WaitForChild("Recipes"))
local Slimes = require(Shared:WaitForChild("Slimes"))
local FoodModel = require(Shared:WaitForChild("FoodModel"))
local KitBox = require(Shared:WaitForChild("KitBox"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local Request = Remotes:WaitForChild("Request")
local DataChanged = Remotes:WaitForChild("DataChanged")

---------------------------------------------------------------- tailles et couleurs

local camera = workspace.CurrentCamera
while not camera or camera.ViewportSize.X < 10 do
	task.wait()
	camera = workspace.CurrentCamera
end

-- Agrandit ou réduit toute l'interface selon la taille de l'écran (téléphone, tablette, PC)
local S = math.clamp(math.min(camera.ViewportSize.X / 1050, camera.ViewportSize.Y / 680), 0.55, 1.2)
local function px(n)
	return math.floor(n * S + 0.5)
end

local FONT = Enum.Font.FredokaOne
local COLORS = {
	bg = Color3.fromRGB(255, 249, 240),
	card = Color3.fromRGB(255, 255, 255),
	pink = Color3.fromRGB(255, 92, 170),
	yellow = Color3.fromRGB(255, 210, 60),
	orange = Color3.fromRGB(255, 150, 50),
	green = Color3.fromRGB(70, 195, 105),
	blue = Color3.fromRGB(70, 150, 255),
	purple = Color3.fromRGB(150, 90, 235),
	red = Color3.fromRGB(235, 75, 85),
	text = Color3.fromRGB(70, 45, 85),
	soft = Color3.fromRGB(140, 125, 150),
	disabled = Color3.fromRGB(195, 190, 200),
	done = Color3.fromRGB(215, 245, 215),
	white = Color3.new(1, 1, 1),
}

---------------------------------------------------------------- petits outils d'interface

local function create(className, props, children)
	local inst = Instance.new(className)
	local parent = nil
	if props then
		for key, value in props do
			if key == "Parent" then
				parent = value
			else
				inst[key] = value
			end
		end
	end
	if children then
		for _, child in children do
			child.Parent = inst
		end
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function corner(radius)
	return create("UICorner", { CornerRadius = UDim.new(0, px(radius or 14)) })
end

local function stroke(color, thickness)
	return create("UIStroke", { Color = color, Thickness = math.max(1, px(thickness or 3)), ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
end

local function pad(n)
	local u = UDim.new(0, px(n))
	return create("UIPadding", { PaddingTop = u, PaddingBottom = u, PaddingLeft = u, PaddingRight = u })
end

local function withDefaults(props, defaults)
	for key, value in defaults do
		if props[key] == nil then
			props[key] = value
		end
	end
	return props
end

local function text(props)
	local maxSize = props.MaxSize or 28
	props.MaxSize = nil
	withDefaults(props, { BackgroundTransparency = 1, Font = FONT, TextColor3 = COLORS.text, TextScaled = true, TextWrapped = true })
	return create("TextLabel", props, { create("UITextSizeConstraint", { MaxTextSize = px(maxSize) }) })
end

local function button(props, onClick)
	local maxSize = props.MaxSize or 26
	props.MaxSize = nil
	withDefaults(props, { AutoButtonColor = true, Font = FONT, TextColor3 = COLORS.white, TextScaled = true, TextWrapped = true, BackgroundColor3 = COLORS.pink })
	local b = create("TextButton", props, { corner(12), pad(4), create("UITextSizeConstraint", { MaxTextSize = px(maxSize) }) })
	if onClick then
		b.Activated:Connect(onClick)
	end
	return b
end

local function shake(guiObject)
	task.spawn(function()
		for _, angle in { 7, -7, 5, -5, 0 } do
			guiObject.Rotation = angle
			task.wait(0.04)
		end
	end)
end

local baseSizes = setmetatable({}, { __mode = "k" })
local function pop(guiObject)
	local original = baseSizes[guiObject] or guiObject.Size
	baseSizes[guiObject] = original
	local bigger = UDim2.new(original.X.Scale * 1.1, original.X.Offset * 1.1, original.Y.Scale * 1.1, original.Y.Offset * 1.1)
	local tween = TweenService:Create(guiObject, TweenInfo.new(0.08), { Size = bigger })
	tween:Play()
	tween.Completed:Wait()
	TweenService:Create(guiObject, TweenInfo.new(0.12), { Size = original }):Play()
end

---------------------------------------------------------------- écran principal

local gui = create("ScreenGui", {
	Name = "MarcheGluantUI",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	Parent = player:WaitForChild("PlayerGui"),
})

local state = { data = nil }

-- Les objets du sac d'un certain type ("kit", "food" ou "slime"), triés
local function itemsOf(kind)
	local list = {}
	if state.data then
		for _, item in state.data.items do
			if item.kind == kind and Recipes.ById[item.recipe] then
				table.insert(list, item)
			end
		end
	end
	table.sort(list, function(a, b)
		local ra, rb = Recipes.ById[a.recipe], Recipes.ById[b.recipe]
		if ra.order ~= rb.order then
			return ra.order < rb.order
		end
		return a.id < b.id
	end)
	return list
end

-- Les pièces en haut de l'écran
local coinBar = create("Frame", {
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, px(6)),
	Size = UDim2.fromOffset(px(210), px(52)),
	BackgroundColor3 = COLORS.yellow,
	Parent = gui,
}, { corner(26), stroke(Color3.fromRGB(230, 160, 30), 3) })
local coinLabel = text({ Size = UDim2.fromScale(1, 1), Text = "🪙 ...", MaxSize = 32, Parent = coinBar })
pad(6).Parent = coinLabel

-- Messages temporaires
local toastArea = create("Frame", {
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, px(66)),
	Size = UDim2.fromOffset(px(560), px(200)),
	BackgroundTransparency = 1,
	ZIndex = 50,
	Parent = gui,
}, { create("UIListLayout", { Padding = UDim.new(0, px(6)), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }) })

local toastCount = 0
local function toast(message, color)
	toastCount += 1
	local frame = create("Frame", {
		Size = UDim2.fromOffset(px(540), px(44)),
		BackgroundColor3 = color or COLORS.text,
		LayoutOrder = toastCount,
		ZIndex = 50,
		Parent = toastArea,
	}, { corner(14) })
	local label = text({ Size = UDim2.fromScale(1, 1), Text = message, TextColor3 = COLORS.white, MaxSize = 22, ZIndex = 51, Parent = frame })
	pad(6).Parent = label
	-- 3 messages maximum à l'écran
	local frames = {}
	for _, child in toastArea:GetChildren() do
		if child:IsA("Frame") then
			table.insert(frames, child)
		end
	end
	table.sort(frames, function(a, b)
		return a.LayoutOrder < b.LayoutOrder
	end)
	for i = 1, #frames - 3 do
		frames[i]:Destroy()
	end
	task.delay(3, function()
		if frame.Parent then
			TweenService:Create(frame, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
			TweenService:Create(label, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
			task.wait(0.45)
			frame:Destroy()
		end
	end)
end

-- Envoie une action au serveur
local busy = false
local function call(action, argument)
	if busy then
		return nil
	end
	busy = true
	local ok, result = pcall(function()
		return Request:InvokeServer(action, argument)
	end)
	busy = false
	if not ok then
		toast("Problème de connexion, réessaie !", COLORS.red)
		return nil
	end
	if type(result) ~= "table" then
		return nil
	end
	if result.msg then
		toast(result.msg, result.ok and COLORS.green or COLORS.red)
	end
	return result
end

---------------------------------------------------------------- aperçus 3D

local spinning = {} -- les aperçus qui tournent

local function boundsOf(model)
	local minX, minY, minZ = math.huge, math.huge, math.huge
	local maxX, maxY, maxZ = -math.huge, -math.huge, -math.huge
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") then
			local cf, half = p.CFrame, p.Size / 2
			local r, u, l = cf.RightVector, cf.UpVector, cf.LookVector
			local ex = math.abs(r.X) * half.X + math.abs(u.X) * half.Y + math.abs(l.X) * half.Z
			local ey = math.abs(r.Y) * half.X + math.abs(u.Y) * half.Y + math.abs(l.Y) * half.Z
			local ez = math.abs(r.Z) * half.X + math.abs(u.Z) * half.Y + math.abs(l.Z) * half.Z
			local pos = cf.Position
			minX, minY, minZ = math.min(minX, pos.X - ex), math.min(minY, pos.Y - ey), math.min(minZ, pos.Z - ez)
			maxX, maxY, maxZ = math.max(maxX, pos.X + ex), math.max(maxY, pos.Y + ey), math.max(maxZ, pos.Z + ez)
		end
	end
	if minX == math.huge then
		return Vector3.zero, 2
	end
	local lo, hi = Vector3.new(minX, minY, minZ), Vector3.new(maxX, maxY, maxZ)
	return (lo + hi) / 2, math.max((hi - lo).Magnitude / 2, 1)
end

local function newView(parent, props)
	local frame = create("ViewportFrame", {
		BackgroundColor3 = Color3.fromRGB(255, 236, 247),
		Ambient = Color3.fromRGB(175, 170, 185),
		LightColor = Color3.fromRGB(255, 255, 255),
		LightDirection = Vector3.new(-0.5, -1, -0.6),
	}, { corner(14) })
	for key, value in props do
		frame[key] = value
	end
	frame.Parent = parent
	local cam = Instance.new("Camera")
	cam.FieldOfView = 32
	cam.Parent = frame
	frame.CurrentCamera = cam

	local view = { frame = frame, model = nil, angle = 0.5, center = Vector3.zero, radius = 2 }
	function view.update()
		local direction = Vector3.new(math.sin(view.angle), 0.8, math.cos(view.angle)).Unit
		local distance = view.radius / math.sin(math.rad(cam.FieldOfView / 2)) * 0.95
		cam.CFrame = CFrame.lookAt(view.center + direction * distance, view.center)
	end
	-- keepFrame = true : garde le même cadrage (pour voir le plat grandir étape par étape)
	function view.set(model, keepFrame)
		if view.model then
			view.model:Destroy()
		end
		view.model = model
		model.Parent = frame
		if not keepFrame then
			view.center, view.radius = boundsOf(model)
		end
		view.update()
	end
	return view
end

RunService.RenderStepped:Connect(function(dt)
	for view in spinning do
		view.angle += dt * 0.7
		view.update()
	end
end)

---------------------------------------------------------------- fenêtres

local currentWindow = nil

local function releaseViews(w)
	for _, view in w.views do
		spinning[view] = nil
	end
	w.views = {}
end

local function closeWindow()
	local w = currentWindow
	if not w then
		return
	end
	currentWindow = nil
	releaseViews(w)
	w.frame:Destroy()
end

local function openWindow(title, color, stationPart)
	closeWindow()
	local frame = create("Frame", {
		Name = "Fenetre",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.54),
		Size = UDim2.fromScale(0.86, 0.8),
		BackgroundColor3 = COLORS.bg,
		ZIndex = 10,
		Parent = gui,
	}, { corner(22), stroke(color, 5), create("UISizeConstraint", { MaxSize = Vector2.new(px(1000), px(660)) }) })
	local header = create("Frame", { Size = UDim2.new(1, 0, 0, px(58)), BackgroundColor3 = color, Parent = frame }, { corner(22) })
	create("Frame", { Position = UDim2.new(0, 0, 1, -px(22)), Size = UDim2.new(1, 0, 0, px(22)), BackgroundColor3 = color, BorderSizePixel = 0, Parent = header })
	text({
		Position = UDim2.new(0, px(18), 0, px(8)),
		Size = UDim2.new(1, -px(90), 1, -px(16)),
		Text = title,
		TextColor3 = COLORS.white,
		TextXAlignment = Enum.TextXAlignment.Left,
		MaxSize = 34,
		Parent = header,
	})
	button({
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -px(10), 0.5, 0),
		Size = UDim2.fromOffset(px(44), px(44)),
		Text = "✕",
		BackgroundColor3 = COLORS.red,
		MaxSize = 26,
		Parent = header,
	}, closeWindow)
	local body = create("Frame", {
		BackgroundTransparency = 1,
		Position = UDim2.new(0, px(14), 0, px(68)),
		Size = UDim2.new(1, -px(28), 1, -px(80)),
		Parent = frame,
	})
	local w = { frame = frame, body = body, station = stationPart, views = {}, mode = "list", refresh = nil }
	currentWindow = w
	return w
end

local function clearBody(w)
	releaseViews(w)
	for _, child in w.body:GetChildren() do
		child:Destroy()
	end
end

local function addView(w, parent, props, spin)
	local view = newView(parent, props)
	table.insert(w.views, view)
	if spin then
		spinning[view] = true
	end
	return view
end

local function emptyMessage(w, message)
	text({
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.45),
		Size = UDim2.fromScale(0.85, 0.4),
		Text = message,
		MaxSize = 30,
		Parent = w.body,
	})
end

local function topLine(w, message)
	return text({ Size = UDim2.new(1, 0, 0, px(32)), Text = message, TextColor3 = COLORS.soft, MaxSize = 22, Parent = w.body })
end

local function grid(parent, cellWidth, cellHeight, top)
	return create("ScrollingFrame", {
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 0, 0, px(top)),
		Size = UDim2.new(1, 0, 1, -px(top)),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = px(8),
		ScrollingDirection = Enum.ScrollingDirection.Y,
		ScrollBarImageColor3 = COLORS.soft,
		Parent = parent,
	}, {
		create("UIGridLayout", {
			CellSize = UDim2.fromOffset(px(cellWidth), px(cellHeight)),
			CellPadding = UDim2.fromOffset(px(12), px(12)),
			HorizontalAlignment = Enum.HorizontalAlignment.Center,
			SortOrder = Enum.SortOrder.LayoutOrder,
		}),
		create("UIPadding", { PaddingTop = UDim.new(0, px(6)), PaddingBottom = UDim.new(0, px(12)) }),
	})
end

-- La boîte jaune d'un kit, avec le plat en 3D dessiné dessus
local function kitBoxVisual(w, parent, recipe, props)
	local holder = create("Frame", withDefaults(props, { BackgroundTransparency = 1 }))
	holder.Parent = parent
	local picture = KitBox.drawFront(holder, recipe, { handle = true, picture = false, gameName = Config.GameName, pixelScale = S })
	local view = addView(w, picture, { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1 }, false)
	view.set(FoodModel.build(recipe))
	return holder
end

-- Une carte avec un aperçu, un titre, un sous-titre et un bouton.
-- visual = un modèle 3D (plat ou slime), ou { kit = recette } pour afficher la boîte jaune du kit
local function itemCard(w, parent, order, borderColor, visual, title, subtitle, subtitleColor, buttonText, buttonColor, onClick)
	local card = create("Frame", { LayoutOrder = order, BackgroundColor3 = COLORS.card, Parent = parent }, { corner(16), stroke(borderColor, 3) })
	local visualProps = { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, px(6)), Size = UDim2.new(1, -px(12), 0, px(118)) }
	if type(visual) == "table" and visual.kit then
		kitBoxVisual(w, card, visual.kit, visualProps)
	else
		local view = addView(w, card, visualProps, false)
		view.set(visual)
	end
	text({ Position = UDim2.new(0, px(6), 0, px(128)), Size = UDim2.new(1, -px(12), 0, px(42)), Text = title, MaxSize = 21, Parent = card })
	text({ Position = UDim2.new(0, px(6), 0, px(170)), Size = UDim2.new(1, -px(12), 0, px(20)), Text = subtitle, TextColor3 = subtitleColor, MaxSize = 17, Parent = card })
	local b = nil
	if buttonText then
		b = button({
			AnchorPoint = Vector2.new(0.5, 1),
			Position = UDim2.new(0.5, 0, 1, -px(8)),
			Size = UDim2.new(1, -px(16), 0, px(40)),
			Text = buttonText,
			BackgroundColor3 = buttonColor,
			MaxSize = 22,
			Parent = card,
		}, onClick)
	end
	return card, b
end

local function rarityOf(recipe)
	return Config.Rarities[recipe.rarity]
end

-- Barre de progression
local function progressBar(parent, position, color)
	local back = create("Frame", { Position = position, Size = UDim2.new(1, 0, 0, px(16)), BackgroundColor3 = Color3.fromRGB(238, 225, 235), Parent = parent }, { corner(8) })
	local fill = create("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = color, Parent = back }, { corner(8) })
	return fill
end

-- Déclarées plus bas
local openInventory, openHelp

---------------------------------------------------------------- 🛒 le Marché

local function openShop(stationPart)
	local w = openWindow("🛒 Le Marché — choisis ton kit", COLORS.pink, stationPart)
	topLine(w, "Achète un kit, puis prépare-le à la Cuisine 🍳")
	local list = grid(w.body, 170, 250, 40)
	local buyButtons = {}
	for i, recipe in Recipes.List do
		local rarity = rarityOf(recipe)
		local _, buy = itemCard(
			w,
			list,
			i,
			rarity.color,
			{ kit = recipe },
			recipe.emoji .. " " .. recipe.name,
			rarity.label .. " · " .. #recipe.steps .. " ingrédients",
			rarity.color,
			"Acheter " .. recipe.price .. " 🪙",
			COLORS.green,
			function()
				call("BuyKit", recipe.id)
			end
		)
		buyButtons[recipe.id] = buy
	end
	w.refresh = function()
		local coins = state.data and state.data.coins or 0
		for id, b in buyButtons do
			b.BackgroundColor3 = coins >= Recipes.ById[id].price and COLORS.green or COLORS.disabled
		end
	end
	w.refresh()
end

---------------------------------------------------------------- 🍳 la Cuisine

local function openKitchen(stationPart)
	local w = openWindow("🍳 La Cuisine", COLORS.orange, stationPart)
	local showList, showAssembly

	showList = function()
		clearBody(w)
		w.mode = "list"
		local kits = itemsOf("kit")
		if #kits == 0 then
			emptyMessage(w, "Tu n'as aucun kit à préparer.\nVa en acheter au Marché 🛒 !")
			return
		end
		topLine(w, "Choisis le kit à préparer :")
		local list = grid(w.body, 170, 250, 40)
		for i, item in kits do
			local recipe = Recipes.ById[item.recipe]
			local rarity = rarityOf(recipe)
			itemCard(w, list, i, rarity.color, { kit = recipe }, recipe.emoji .. " " .. recipe.name, "Kit · " .. #recipe.steps .. " ingrédients", rarity.color, "Cuisiner !", COLORS.orange, function()
				showAssembly(item)
			end)
		end
	end

	showAssembly = function(item)
		clearBody(w)
		w.mode = "build"
		local recipe = Recipes.ById[item.recipe]
		local total = #recipe.steps
		local done = 0
		local finished = false

		-- aperçu du plat qui se construit
		local view = addView(w, w.body, { Size = UDim2.new(0.46, 0, 1, 0) }, true)
		local fullModel = FoodModel.build(recipe)
		view.center, view.radius = boundsOf(fullModel)
		fullModel:Destroy()
		view.set(FoodModel.build(recipe, { steps = 0 }), true)

		local right = create("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0.49, 0, 0, 0), Size = UDim2.new(0.51, 0, 1, 0), Parent = w.body })
		text({ Size = UDim2.new(1, 0, 0, px(36)), Text = recipe.emoji .. " " .. recipe.name, MaxSize = 30, Parent = right })
		local stepLabel = text({ Position = UDim2.new(0, 0, 0, px(38)), Size = UDim2.new(1, 0, 0, px(30)), Text = "", TextColor3 = COLORS.orange, MaxSize = 24, Parent = right })
		local fill = progressBar(right, UDim2.new(0, 0, 0, px(74)), COLORS.orange)
		text({ Position = UDim2.new(0, 0, 0, px(96)), Size = UDim2.new(1, 0, 0, px(22)), Text = "Clique sur les ingrédients dans l'ordre de la recette :", TextColor3 = COLORS.soft, MaxSize = 18, Parent = right })
		local ingredients = create("ScrollingFrame", {
			BackgroundTransparency = 1,
			BorderSizePixel = 0,
			Position = UDim2.new(0, 0, 0, px(124)),
			Size = UDim2.new(1, 0, 1, -px(124)),
			CanvasSize = UDim2.new(),
			AutomaticCanvasSize = Enum.AutomaticSize.Y,
			ScrollBarThickness = px(6),
			Parent = right,
		}, {
			create("UIGridLayout", { CellSize = UDim2.new(0.5, -px(6), 0, px(52)), CellPadding = UDim2.fromOffset(px(8), px(8)), SortOrder = Enum.SortOrder.LayoutOrder }),
			create("UIPadding", { PaddingTop = UDim.new(0, px(4)), PaddingLeft = UDim.new(0, px(4)), PaddingRight = UDim.new(0, px(4)) }),
		})

		local function updateTexts()
			fill.Size = UDim2.fromScale(done / total, 1)
			if done < total then
				stepLabel.Text = ("Étape %d / %d : %s"):format(done + 1, total, recipe.steps[done + 1].name)
			else
				stepLabel.Text = "Terminé ! 🎉"
			end
		end

		local function finish()
			task.wait(0.5)
			local result = call("BuildFood", item.id)
			if w ~= currentWindow then
				return
			end
			if not (result and result.ok) then
				showList()
				return
			end
			right:Destroy()
			local panel = create("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0.49, 0, 0, 0), Size = UDim2.new(0.51, 0, 1, 0), Parent = w.body })
			text({ Position = UDim2.fromScale(0, 0.05), Size = UDim2.fromScale(1, 0.22), Text = "🎉 Bravo !\n" .. recipe.name .. " est prêt(e) !", TextColor3 = COLORS.orange, MaxSize = 36, Parent = panel })
			text({
				Position = UDim2.fromScale(0, 0.3),
				Size = UDim2.fromScale(1, 0.25),
				Text = "Ton plat est dans ton sac 🎒.\nTu pourras bientôt l'échanger avec d'autres joueurs, ou le transformer en slime au Labo 🧪 !",
				TextColor3 = COLORS.soft,
				MaxSize = 22,
				Parent = panel,
			})
			button({ Position = UDim2.fromScale(0.05, 0.62), Size = UDim2.fromScale(0.9, 0.14), Text = "Préparer un autre kit", BackgroundColor3 = COLORS.orange, Parent = panel }, showList)
			button({ Position = UDim2.fromScale(0.05, 0.8), Size = UDim2.fromScale(0.9, 0.14), Text = "Fermer", BackgroundColor3 = COLORS.soft, Parent = panel }, closeWindow)
		end

		-- les boutons d'ingrédients, mélangés
		local order = {}
		for i = 1, total do
			order[i] = i
		end
		for i = total, 2, -1 do
			local j = math.random(1, i)
			order[i], order[j] = order[j], order[i]
		end
		for position, stepIndex in order do
			local step = recipe.steps[stepIndex]
			local swatchColor = step.color or (step.colors and step.colors[1]) or FoodModel.RainbowColors[(stepIndex % 6) + 1]
			local b = button({ LayoutOrder = position, Text = "", BackgroundColor3 = COLORS.card, Parent = ingredients })
			stroke(Color3.fromRGB(235, 215, 230), 2).Parent = b
			create("Frame", {
				AnchorPoint = Vector2.new(0, 0.5),
				Position = UDim2.new(0, px(4), 0.5, 0),
				Size = UDim2.fromOffset(px(30), px(30)),
				BackgroundColor3 = swatchColor,
				Parent = b,
			}, { corner(15), stroke(Color3.fromRGB(200, 190, 205), 1) })
			local label = text({
				Position = UDim2.new(0, px(40), 0, 0),
				Size = UDim2.new(1, -px(42), 1, 0),
				Text = step.name,
				TextXAlignment = Enum.TextXAlignment.Left,
				MaxSize = 19,
				Parent = b,
			})
			local used = false
			b.Activated:Connect(function()
				if finished or used then
					return
				end
				if stepIndex == done + 1 then
					used = true
					done += 1
					b.BackgroundColor3 = COLORS.done
					label.Text = "✔ " .. step.name
					view.set(FoodModel.build(recipe, { steps = done }), true)
					updateTexts()
					if done == total then
						finished = true
						finish()
					end
				else
					shake(b)
					toast("Pas encore ! D'abord : " .. recipe.steps[done + 1].name, COLORS.red)
				end
			end)
		end
		updateTexts()
	end

	w.refresh = function()
		if w.mode == "list" then
			showList()
		end
	end
	showList()
end

---------------------------------------------------------------- 🧪 le Labo à slime

local function openMixer(stationPart)
	local w = openWindow("🧪 Le Labo à Slime", COLORS.green, stationPart)
	local showList, showMix

	showList = function()
		clearBody(w)
		w.mode = "list"
		local foods = itemsOf("food")
		if #foods == 0 then
			emptyMessage(w, "Tu n'as aucun plat à mélanger.\nPrépare d'abord un kit à la Cuisine 🍳 !")
			return
		end
		topLine(w, "Choisis le plat à transformer en slime :")
		local list = grid(w.body, 170, 250, 40)
		for i, item in foods do
			local recipe = Recipes.ById[item.recipe]
			local rarity = rarityOf(recipe)
			itemCard(w, list, i, rarity.color, FoodModel.build(recipe), recipe.emoji .. " " .. recipe.name, "Plat prêt", rarity.color, "Mélanger !", COLORS.green, function()
				showMix(item)
			end)
		end
	end

	showMix = function(item)
		clearBody(w)
		w.mode = "mix"
		local recipe = Recipes.ById[item.recipe]
		local view = addView(w, w.body, { Size = UDim2.new(0.46, 0, 1, 0) }, true)
		local model = FoodModel.build(recipe)
		view.set(model)
		local originals = {}
		for _, p in model:GetDescendants() do
			if p:IsA("BasePart") then
				originals[p] = { color = p.Color, cframe = p.CFrame }
			end
		end

		local right = create("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0.49, 0, 0, 0), Size = UDim2.new(0.51, 0, 1, 0), Parent = w.body })
		text({ Size = UDim2.new(1, 0, 0, px(40)), Text = "🥄 Mélange : " .. recipe.name, MaxSize = 30, Parent = right })
		text({ Position = UDim2.new(0, 0, 0, px(44)), Size = UDim2.new(1, 0, 0, px(44)), Text = "Clique vite sur le bouton pour tout mélanger et créer ton slime !", TextColor3 = COLORS.soft, MaxSize = 20, Parent = right })
		local fill = progressBar(right, UDim2.new(0, 0, 0, px(96)), COLORS.green)
		local clicks, needed = 0, Config.MixClicks
		local finished = false

		local function reveal(result)
			local texture = Slimes.ById[result.texture] or Slimes.Textures[1]
			view.set(FoodModel.buildSlime(recipe, texture.id))
			right:Destroy()
			local panel = create("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0.49, 0, 0, 0), Size = UDim2.new(0.51, 0, 1, 0), Parent = w.body })
			text({ Position = UDim2.fromScale(0, 0.02), Size = UDim2.fromScale(1, 0.1), Text = "✨ Ton slime est prêt ! ✨", TextColor3 = COLORS.green, MaxSize = 32, Parent = panel })
			text({ Position = UDim2.fromScale(0, 0.14), Size = UDim2.fromScale(1, 0.16), Text = Slimes.name(recipe, texture.id), MaxSize = 30, Parent = panel })
			text({
				Position = UDim2.fromScale(0, 0.32),
				Size = UDim2.fromScale(1, 0.1),
				Text = ("Texture %s (%.1f %% de chance)"):format(texture.name, Slimes.percent(texture.id)),
				TextColor3 = texture.color,
				MaxSize = 24,
				Parent = panel,
			})
			text({ Position = UDim2.fromScale(0, 0.44), Size = UDim2.fromScale(1, 0.1), Text = "Valeur : " .. tostring(result.value) .. " 🪙", TextColor3 = COLORS.orange, MaxSize = 30, Parent = panel })
			button({ Position = UDim2.fromScale(0.05, 0.62), Size = UDim2.fromScale(0.9, 0.14), Text = "Mélanger un autre plat", BackgroundColor3 = COLORS.green, Parent = panel }, showList)
			button({ Position = UDim2.fromScale(0.05, 0.8), Size = UDim2.fromScale(0.9, 0.14), Text = "Fermer", BackgroundColor3 = COLORS.soft, Parent = panel }, closeWindow)
			if texture.mult >= 2.5 then
				toast("WOW ! Texture super rare : " .. texture.name .. " !", texture.color)
			end
		end

		local mixButton
		mixButton = button({
			AnchorPoint = Vector2.new(0.5, 0),
			Position = UDim2.new(0.5, 0, 0, px(130)),
			Size = UDim2.new(0.8, 0, 0, px(110)),
			Text = "🥄 MÉLANGER !",
			BackgroundColor3 = COLORS.green,
			MaxSize = 40,
			Parent = right,
		}, function()
			if finished then
				return
			end
			clicks += 1
			local t = math.min(clicks / needed, 1)
			fill.Size = UDim2.fromScale(t, 1)
			view.angle += 0.9
			-- les morceaux se rapprochent et prennent la couleur du slime
			for p, original in originals do
				if p.Parent then
					p.Color = FoodModel.lerpColor(original.color, recipe.slimeColor, t)
					p.CFrame = original.cframe.Rotation + original.cframe.Position:Lerp(view.center, t * 0.6)
				end
			end
			task.spawn(pop, mixButton)
			if clicks >= needed then
				finished = true
				mixButton.Text = "..."
				local result = call("MixFood", item.id)
				if w ~= currentWindow then
					return
				end
				if result and result.ok then
					reveal(result)
				else
					showList()
				end
			end
		end)
	end

	w.refresh = function()
		if w.mode == "list" then
			showList()
		end
	end
	showList()
end

---------------------------------------------------------------- 💰 le Marchand

local function openMerchant(stationPart)
	local w = openWindow("💰 Le Marchand de slimes", COLORS.purple, stationPart)
	local cards = {}
	local sellAll = nil

	local function totalValue()
		local total = 0
		for _, item in itemsOf("slime") do
			total += item.value or 0
		end
		return total
	end

	local function showList()
		clearBody(w)
		cards = {}
		sellAll = nil
		local slimes = itemsOf("slime")
		if #slimes == 0 then
			emptyMessage(w, "« Bonjour ! Moi, je n'achète que des slimes. »\nTransforme un plat en slime au Labo 🧪 !")
			return
		end
		text({ Size = UDim2.new(0.6, 0, 0, px(44)), Text = "« Je t'achète tous tes slimes ! »", TextColor3 = COLORS.soft, TextXAlignment = Enum.TextXAlignment.Left, MaxSize = 24, Parent = w.body })
		sellAll = button({
			AnchorPoint = Vector2.new(1, 0),
			Position = UDim2.new(1, 0, 0, 0),
			Size = UDim2.new(0.38, 0, 0, px(44)),
			Text = "",
			BackgroundColor3 = COLORS.orange,
			Parent = w.body,
		}, function()
			call("SellAllSlimes")
		end)
		local list = grid(w.body, 170, 250, 54)
		for i, item in slimes do
			local recipe = Recipes.ById[item.recipe]
			local texture = Slimes.ById[item.texture] or Slimes.Textures[1]
			local card = itemCard(w, list, i, texture.color, FoodModel.buildSlime(recipe, texture.id), "Slime " .. recipe.name, "Texture " .. texture.name, texture.color, "Vendre " .. tostring(item.value) .. " 🪙", COLORS.purple, function()
				call("SellSlime", item.id)
			end)
			cards[item.id] = card
		end
		sellAll.Text = "Tout vendre (" .. totalValue() .. " 🪙)"
	end

	-- après une vente, on enlève seulement les cartes vendues
	w.refresh = function()
		local current = {}
		for _, item in itemsOf("slime") do
			current[item.id] = true
			if not cards[item.id] then
				showList()
				return
			end
		end
		for id, card in cards do
			if not current[id] then
				card:Destroy()
				cards[id] = nil
			end
		end
		if next(current) == nil then
			showList()
		elseif sellAll then
			sellAll.Text = "Tout vendre (" .. totalValue() .. " 🪙)"
		end
	end
	showList()
end

---------------------------------------------------------------- 🎒 le sac

openInventory = function()
	local w = openWindow("🎒 Mon sac", COLORS.purple, nil)
	local tab = "kit"
	local tabs = {
		{ id = "kit", label = "📦 Kits", hint = "Prépare tes kits sur un plan de travail de la Cuisine 🍳" },
		{ id = "food", label = "🍽️ Plats", hint = "Transforme tes plats en slime au Labo 🧪 (échanges bientôt !)" },
		{ id = "slime", label = "🫧 Slimes", hint = "Vends tes slimes au Marchand 💰" },
	}

	local function show()
		clearBody(w)
		local tabBar = create("Frame", { Size = UDim2.new(1, 0, 0, px(46)), BackgroundTransparency = 1, Parent = w.body }, {
			create("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, px(8)), SortOrder = Enum.SortOrder.LayoutOrder }),
		})
		local currentHint = ""
		for i, t in tabs do
			local count = #itemsOf(t.id)
			if t.id == tab then
				currentHint = t.hint
			end
			button({
				LayoutOrder = i,
				Size = UDim2.new(1 / 3, -px(6), 1, 0),
				Text = ("%s (%d)"):format(t.label, count),
				BackgroundColor3 = t.id == tab and COLORS.purple or COLORS.disabled,
				MaxSize = 22,
				Parent = tabBar,
			}, function()
				tab = t.id
				show()
			end)
		end
		local total = state.data and #state.data.items or 0
		text({
			Position = UDim2.new(0, 0, 0, px(50)),
			Size = UDim2.new(1, 0, 0, px(26)),
			Text = currentHint .. ("   ·   Sac : %d / %d"):format(total, Config.MaxInventory),
			TextColor3 = COLORS.soft,
			MaxSize = 19,
			Parent = w.body,
		})
		local items = itemsOf(tab)
		if #items == 0 then
			text({ Position = UDim2.fromScale(0.1, 0.4), Size = UDim2.fromScale(0.8, 0.2), Text = "Rien ici pour l'instant !", MaxSize = 28, Parent = w.body })
			return
		end
		local list = grid(w.body, 160, 205, 82)
		for i, item in items do
			local recipe = Recipes.ById[item.recipe]
			local rarity = rarityOf(recipe)
			if item.kind == "slime" then
				local texture = Slimes.ById[item.texture] or Slimes.Textures[1]
				itemCard(w, list, i, texture.color, FoodModel.buildSlime(recipe, texture.id), "Slime " .. recipe.name, texture.name .. " · " .. tostring(item.value) .. " 🪙", texture.color)
			else
				if item.kind == "kit" then
					itemCard(w, list, i, rarity.color, { kit = recipe }, recipe.emoji .. " " .. recipe.name, "Kit à préparer", rarity.color)
				else
					itemCard(w, list, i, rarity.color, FoodModel.build(recipe), recipe.emoji .. " " .. recipe.name, "Plat prêt", rarity.color)
				end
			end
		end
	end

	w.refresh = show
	show()
end

---------------------------------------------------------------- ❓ l'aide

openHelp = function()
	local w = openWindow("❓ Comment jouer", COLORS.blue, nil)
	w.mode = "help"
	local steps = {
		{ "🛒", "Achète un kit au Marché, le grand bâtiment jaune.", COLORS.pink },
		{ "🍳", "Prépare-le à la Cuisine : ajoute les ingrédients dans le bon ordre.", COLORS.orange },
		{ "🧪", "Transforme ton plat en slime au Labo : mélange le plus vite possible !", COLORS.green },
		{ "💰", "Vends ton slime au Marchand pour gagner des pièces, puis recommence !", COLORS.purple },
	}
	local listFrame = create("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0.62, 0), Parent = w.body }, {
		create("UIListLayout", { Padding = UDim.new(0, px(8)), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	for i, s in steps do
		local row = create("Frame", { LayoutOrder = i, Size = UDim2.new(1, 0, 0.25, -px(6)), BackgroundColor3 = COLORS.card, Parent = listFrame }, { corner(14), stroke(s[3], 3) })
		text({ Size = UDim2.new(0, px(60), 1, 0), Text = s[1], MaxSize = 34, Parent = row })
		text({ Position = UDim2.new(0, px(64), 0, 0), Size = UDim2.new(1, -px(74), 1, 0), Text = i .. ". " .. s[2], TextXAlignment = Enum.TextXAlignment.Left, MaxSize = 22, Parent = row })
	end
	local chances = {}
	for _, texture in Slimes.Textures do
		table.insert(chances, ("%s x%s"):format(texture.name, tostring(texture.mult)))
	end
	text({
		Position = UDim2.fromScale(0, 0.64),
		Size = UDim2.fromScale(1, 0.16),
		Text = "Textures de slime : " .. table.concat(chances, " · ") .. "\nPlus elle est rare, plus ton slime vaut cher ! Bientôt : échanges de plats et mini-jeux.",
		TextColor3 = COLORS.soft,
		MaxSize = 19,
		Parent = w.body,
	})
	button({ AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(0.5, 1), Size = UDim2.new(0.4, 0, 0.14, 0), Text = "C'est parti !", BackgroundColor3 = COLORS.blue, Parent = w.body }, closeWindow)
end

---------------------------------------------------------------- boutons sur le côté

local sideBar = create("Frame", {
	AnchorPoint = Vector2.new(0, 0.5),
	Position = UDim2.new(0, px(10), 0.5, 0),
	Size = UDim2.fromOffset(px(130), px(124)),
	BackgroundTransparency = 1,
	Parent = gui,
}, { create("UIListLayout", { Padding = UDim.new(0, px(10)), SortOrder = Enum.SortOrder.LayoutOrder }) })

local bagButton = button({ LayoutOrder = 1, Size = UDim2.fromOffset(px(130), px(54)), Text = "🎒 Sac", BackgroundColor3 = COLORS.purple, Parent = sideBar }, function()
	openInventory()
end)
button({ LayoutOrder = 2, Size = UDim2.fromOffset(px(130), px(54)), Text = "❓ Aide", BackgroundColor3 = COLORS.blue, Parent = sideBar }, function()
	openHelp()
end)

---------------------------------------------------------------- stations de la map

local openers = { Shop = openShop, Kitchen = openKitchen, Mixer = openMixer, Merchant = openMerchant }

ProximityPromptService.PromptTriggered:Connect(function(prompt, who)
	if who ~= player then
		return
	end
	local opener = openers[prompt:GetAttribute("Station")]
	if opener then
		opener(prompt.Parent)
	end
end)

-- Ferme la fenêtre si le joueur s'éloigne de la station
task.spawn(function()
	while true do
		task.wait(0.5)
		local w = currentWindow
		if w and w.station then
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			if root and (root.Position - w.station.Position).Magnitude > Config.StationRange then
				closeWindow()
			end
		end
	end
end)

---------------------------------------------------------------- données reçues du serveur

local firstData = true
local lastCoins = nil

local function applyData(data)
	state.data = data
	coinLabel.Text = "🪙 " .. tostring(data.coins)
	bagButton.Text = ("🎒 Sac (%d)"):format(#data.items)
	if lastCoins and data.coins > lastCoins then
		task.spawn(pop, coinBar)
	end
	lastCoins = data.coins
	local w = currentWindow
	if w and w.refresh and w.mode == "list" then
		w.refresh()
	end
	if firstData then
		firstData = false
		local s = data.stats
		if s.built == 0 and s.mixed == 0 and s.sold == 0 and #data.items == 0 then
			task.defer(openHelp)
		end
	end
end

DataChanged.OnClientEvent:Connect(applyData)

task.spawn(function()
	for _ = 1, 30 do
		local ok, result = pcall(function()
			return Request:InvokeServer("GetData")
		end)
		if ok and type(result) == "table" and result.ok then
			if firstData then
				applyData(result.data)
			end
			return
		end
		task.wait(1)
	end
end)
