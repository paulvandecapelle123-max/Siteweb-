--[[
	KitBox (ModuleScript)
	La boîte jaune en forme de panier dans laquelle les kits sont vendus.

	KitBox.drawFront(container, recipe, opts) -> Frame
		Dessine la face avant de la boîte dans "container" (dans l'interface ou sur une SurfaceGui).
		Renvoie le cadre où mettre l'image du plat.
		opts.gameName   : le nom écrit dans le logo rose
		opts.handle     : true pour dessiner aussi la poignée et la fenêtre transparente (interface)
		opts.picture    : false pour ne pas mettre l'emoji du plat (on y met un aperçu 3D à la place)
		opts.pixelScale : épaisseur des contours de texte

	KitBox.buildModel(recipe, opts) -> Model
		Construit la boîte en 3D (étagères du Marché). opts.origin = CFrame du bas de la boîte.
]]

local KitBox = {}

local YELLOW = Color3.fromRGB(255, 221, 0)
local YELLOW_DARK = Color3.fromRGB(240, 190, 0)
local PINK = Color3.fromRGB(232, 24, 132)
local PINK_DARK = Color3.fromRGB(140, 0, 75)
local RED = Color3.fromRGB(226, 32, 44)
local WHITE = Color3.fromRGB(255, 255, 255)
local BLACK = Color3.fromRGB(25, 20, 30)

KitBox.Yellow = YELLOW
KitBox.Pink = PINK

-- Met en majuscules, y compris les lettres accentuées
local ACCENTS = { ["é"] = "É", ["è"] = "È", ["ê"] = "Ê", ["à"] = "À", ["â"] = "Â", ["ç"] = "Ç", ["ô"] = "Ô", ["û"] = "Û", ["î"] = "Î", ["ï"] = "Ï", ["œ"] = "Œ", ["ù"] = "Ù" }
function KitBox.upper(s)
	s = string.upper(s)
	for lower, upper in ACCENTS do
		s = string.gsub(s, lower, upper)
	end
	return s
end

local function new(className, props, parent)
	local inst = Instance.new(className)
	for key, value in props do
		inst[key] = value
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function rounded(parent, scale)
	new("UICorner", { CornerRadius = UDim.new(scale, 0) }, parent)
end

local function square(parent)
	new("UIAspectRatioConstraint", { AspectRatio = 1 }, parent)
end

local function box(parent, x, y, w, h, color, z, extra)
	local f = new("Frame", {
		Position = UDim2.fromScale(x, y),
		Size = UDim2.fromScale(w, h),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		ZIndex = z or 1,
	}, nil)
	if extra then
		for key, value in extra do
			f[key] = value
		end
	end
	f.Parent = parent
	return f
end

local function words(parent, text, x, y, w, h, color, font, z, outline, thickness, rotation)
	local label = new("TextLabel", {
		BackgroundTransparency = 1,
		Position = UDim2.fromScale(x, y),
		Size = UDim2.fromScale(w, h),
		Text = text,
		TextColor3 = color,
		TextScaled = true,
		TextWrapped = true,
		FontFace = font,
		Rotation = rotation or 0,
		ZIndex = z or 1,
	}, parent)
	if outline then
		new("UIStroke", { Color = outline, Thickness = thickness, LineJoinMode = Enum.LineJoinMode.Round }, label)
	end
	return label
end

-- Les couleurs des ingrédients (pour les petits paquets visibles dans la boîte)
local function ingredientColors(recipe, max)
	local list = {}
	for _, step in recipe.steps do
		local c = step.color or (step.colors and step.colors[1])
		if c and step.kind ~= "recolor" then
			table.insert(list, c)
			if #list >= max then
				break
			end
		end
	end
	return list
end

function KitBox.drawFront(container, recipe, opts)
	opts = opts or {}
	local k = opts.pixelScale or 1
	local titleFont = Font.fromEnum(Enum.Font.LuckiestGuy)
	local roundFont = Font.fromEnum(Enum.Font.FredokaOne)
	local gameName = opts.gameName or "Le Marché Gluant"

	local face = container
	if opts.handle then
		-- poignée du panier
		box(container, 0.2, 0, 0.6, 0.06, YELLOW, 1, { BorderSizePixel = 0 })
		box(container, 0.2, 0, 0.05, 0.2, YELLOW, 1)
		box(container, 0.75, 0, 0.05, 0.2, YELLOW, 1)
		local body = box(container, 0, 0.12, 1, 0.88, YELLOW, 2)
		rounded(body, 0.06)
		-- fenêtre transparente avec les ingrédients emballés
		local window = box(body, 0.03, 0.02, 0.94, 0.14, Color3.fromRGB(235, 245, 255), 2)
		rounded(window, 0.3)
		for i, c in ingredientColors(recipe, 7) do
			local pack = box(window, 0.04 + (i - 1) * 0.135, 0.18, 0.11, 0.64, c, 3)
			rounded(pack, 0.25)
		end
		face = box(body, 0, 0.17, 1, 0.83, YELLOW, 2, { BackgroundTransparency = 1 })
	else
		face = box(container, 0, 0, 1, 1, YELLOW, 1)
	end

	-- rayures du carton
	for i = 0, 9 do
		box(face, 0.03 + i * 0.1, 0, 0.035, 1, YELLOW_DARK, 1, { BackgroundTransparency = 0.4 })
	end

	-- nappe à carreaux et image du plat
	local cloth = box(face, 0.46, 0.36, 0.52, 0.3, RED, 2)
	for row = 0, 2 do
		for col = 0, 5 do
			if (row + col) % 2 == 0 then
				box(cloth, col / 6, row / 3, 1 / 6, 1 / 3, WHITE, 2)
			end
		end
	end
	local picture = box(face, 0.47, 0.02, 0.5, 0.6, YELLOW, 3, { BackgroundTransparency = 1, Name = "Image" })
	if opts.picture ~= false then
		words(picture, recipe.emoji or "🍽️", 0.1, 0.1, 0.8, 0.8, BLACK, roundFont, 3)
	end

	-- badge 6+
	local age = box(face, 0.015, 0.01, 0.09, 0.2, WHITE, 5)
	square(age)
	rounded(age, 0.5)
	new("UIStroke", { Color = PINK, Thickness = 1.5 * k }, age)
	words(age, "6+", 0.12, 0.15, 0.76, 0.7, PINK, titleFont, 6)

	-- logo rose qui coule
	for _, drip in { { 0.07, 0.11 }, { 0.16, 0.16 }, { 0.27, 0.09 }, { 0.36, 0.14 } } do
		local d = box(face, drip[1], 0.45, 0.045, drip[2] + 0.06, PINK, 3)
		rounded(d, 0.5)
	end
	local logo = box(face, 0.03, 0.2, 0.41, 0.33, PINK, 4)
	rounded(logo, 0.22)
	new("UIStroke", { Color = WHITE, Thickness = 2 * k }, logo)
	local first, last = string.match(gameName, "^(.*)%s+(%S+)$")
	if not first then
		first, last = gameName, ""
	end
	words(logo, KitBox.upper(first), 0.05, 0.04, 0.9, 0.42, WHITE, titleFont, 5, PINK_DARK, 1.5 * k, -3)
	words(logo, KitBox.upper(last), 0.05, 0.46, 0.9, 0.5, YELLOW, titleFont, 5, PINK_DARK, 1.5 * k, -5)

	-- étoile rouge : nombre d'ingrédients
	local star = box(face, 0.82, -0.02, 0.17, 0.42, RED, 6, { Rotation = 45 })
	square(star)
	local star2 = box(face, 0.82, -0.02, 0.17, 0.42, RED, 6, { Rotation = 22 })
	square(star2)
	words(face, #recipe.steps .. "\nINGRÉDIENTS\nINCLUS", 0.825, 0.02, 0.16, 0.3, WHITE, roundFont, 7, nil, nil, 12)

	-- slogan avec le nom du plat
	local banner = box(face, 0.5, 0.64, 0.42, 0.1, BLACK, 5, { Rotation = -4 })
	rounded(banner, 0.35)
	words(banner, "FABRIQUE TOI-MÊME", 0.04, 0.08, 0.92, 0.84, WHITE, titleFont, 6)
	words(face, KitBox.upper(recipe.name), 0.44, 0.735, 0.55, 0.15, RED, titleFont, 6, WHITE, 2.5 * k, -4)
	words(face, "EN SLIME !", 0.53, 0.875, 0.4, 0.11, WHITE, titleFont, 6, RED, 2 * k, -4)

	-- les trois ronds en bas
	local circles = { { "📦", "DÉBALLE !" }, { "🥄", "CRÉE !" }, { "✋", "ÉCRASE !" } }
	for i, c in circles do
		local circle = box(face, 0.02 + (i - 1) * 0.14, 0.63, 0.13, 0.34, WHITE, 4)
		square(circle)
		rounded(circle, 0.5)
		new("UIStroke", { Color = PINK, Thickness = 1.5 * k }, circle)
		words(circle, c[1], 0.2, 0.08, 0.6, 0.48, BLACK, roundFont, 5)
		words(circle, c[2], 0.06, 0.56, 0.88, 0.3, BLACK, titleFont, 5)
	end

	return picture
end

---------------------------------------------------------------- boîte en 3D

function KitBox.buildModel(recipe, opts)
	opts = opts or {}
	local origin = opts.origin or CFrame.new()
	local s = opts.scale or 1
	local W, H, D = 3.6 * s, 2.4 * s, 2.0 * s
	local model = Instance.new("Model")
	model.Name = "Kit_" .. recipe.id

	local function part(name, size, cf, color, extra)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored = true
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Material = Enum.Material.SmoothPlastic
		p.Size = size
		p.CFrame = cf
		p.Color = color
		if extra then
			for key, value in extra do
				p[key] = value
			end
		end
		p.Parent = model
		return p
	end

	local function surface(target, face, pixelsPerStud)
		local gui = Instance.new("SurfaceGui")
		gui.Name = "Face" .. face.Name
		gui.Face = face
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = pixelsPerStud
		gui.LightInfluence = 0.15
		gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
		gui.Parent = target
		return gui
	end

	local body = part("Boite", Vector3.new(W, H, D), origin * CFrame.new(0, H / 2, 0), YELLOW)

	-- face avant imprimée
	local front = surface(body, Enum.NormalId.Front, 70 / s)
	KitBox.drawFront(front, recipe, { gameName = opts.gameName, pixelScale = 1.6 })

	-- côtés : le logo
	local titleFont = Font.fromEnum(Enum.Font.LuckiestGuy)
	for _, face in { Enum.NormalId.Left, Enum.NormalId.Right } do
		local gui = surface(body, face, 60 / s)
		local logo = box(gui, 0.1, 0.25, 0.8, 0.5, PINK, 1)
		rounded(logo, 0.2)
		words(logo, KitBox.upper(opts.gameName or "Le Marché Gluant"), 0.05, 0.05, 0.9, 0.9, WHITE, titleFont, 2)
	end

	-- dessus transparent avec les ingrédients emballés
	part("Fenetre", Vector3.new(W - 0.1 * s, 0.7 * s, D - 0.1 * s), origin * CFrame.new(0, H + 0.35 * s, 0), Color3.fromRGB(235, 245, 255), { Transparency = 0.55, CanCollide = false })
	local colors = ingredientColors(recipe, 6)
	for i, c in colors do
		local x = -W / 2 + 0.45 * s + (i - 1) * (W - 0.9 * s) / math.max(#colors - 1, 1)
		local z = (i % 2 == 0) and 0.35 * s or -0.35 * s
		part("Paquet", Vector3.new(0.45 * s, 0.5 * s, 0.4 * s), origin * CFrame.new(x, H + 0.28 * s, z), c, { CanCollide = false })
	end

	-- poignée du panier
	for _, side in { -1, 1 } do
		part("Poignee", Vector3.new(0.22 * s, 1.7 * s, 0.3 * s), origin * CFrame.new(side * (W / 2 - 0.45 * s), H + 0.85 * s, 0), YELLOW)
	end
	part("Poignee", Vector3.new(W - 0.68 * s, 0.28 * s, 0.34 * s), origin * CFrame.new(0, H + 1.6 * s, 0), YELLOW)

	return model
end

return KitBox
