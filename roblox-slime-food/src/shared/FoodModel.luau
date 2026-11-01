--[[
	FoodModel (ModuleScript)
	Construit en 3D les plats (étape par étape) et les slimes.
	Utilisé par la map (la vitrine du Marché) et par l'interface (les aperçus 3D).

	FoodModel.build(recipe, { steps = n, origin = CFrame, scale = nombre }) -> Model (un seul résultat)
	FoodModel.buildSlime(recipe, textureId, { origin = CFrame, scale = nombre }) -> Model

	Types d'ingrédients ("kind") utilisables dans Recipes :
	  disc      : galette ronde (r = rayon, h = épaisseur)
	  stack     : plusieurs galettes empilées (count, r, h)
	  dome      : demi-boule aplatie, comme un pain de burger (r, h)
	  ball      : boule (r)
	  swirl     : tourbillon de crème (r, layers)
	  block     : pavé (size = { x, y, z }, rot = angle en degrés)
	  pill      : forme allongée et arrondie (size = { x, y, z })
	  ring      : anneau, comme un donut (R = rayon de l'anneau, t = épaisseur, lift = décalage vers le haut)
	  pieces    : petits morceaux posés dessus (piece = "disc", "ball", "cube", "leaf", "strip",
	              "egg", "friedegg", "maki", "nigiri" ; count, size, spread, ring, center, points)
	  sprinkles : vermicelles (count, spread, colors)
	  cup       : récipient creux : bol, verre, gobelet (r, h, glass = true pour un verre transparent)
	  liquid    : remplit le dernier récipient (fill = 0 à 1)
	  lid       : couvercle sur le dernier récipient
	  straw     : paille (length, tilt)
	  sticks    : frites (count, length)
	  log       : cylindre couché, comme une saucisse (length, d)
	  line      : filet de sauce en zigzag (length, amp, d)
	  drizzle   : nappage qui coule sur les bords (r)
	  nest      : nid de spaghetti (r, h, count)
	  crescent  : croissant (size)
	  recolor   : change la couleur d'une étape précédente, par exemple la cuisson (target = numéro d'étape)
	  candle    : bougie ou pique (h, d, flame = false pour enlever la flamme, topColor)
	  horn      : corne de licorne (h, r)
	  skewers   : brochettes plantées dans le dernier récipient (count, length, colors)
	  tray      : boîte à compartiments, comme un bento (sx, sz, h, dividers)
	Options communes : color, colors (une couleur par position), at = { x, z }, ats = { {x, z}, ... }
]]

local FoodModel = {}

local VERTICAL = CFrame.Angles(0, 0, math.pi / 2) -- met un cylindre debout
local TWO_PI = math.pi * 2
local WHITE = Color3.fromRGB(252, 252, 248)
local RAINBOW = {
	Color3.fromRGB(255, 80, 80),
	Color3.fromRGB(255, 170, 60),
	Color3.fromRGB(255, 230, 80),
	Color3.fromRGB(100, 210, 100),
	Color3.fromRGB(80, 160, 255),
	Color3.fromRGB(180, 110, 255),
}

FoodModel.RainbowColors = RAINBOW

---------------------------------------------------------------- outils

local function lerpColor(a, b, t)
	return Color3.new(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end
FoodModel.lerpColor = lerpColor

local function hashString(s)
	local h = 7
	for i = 1, #s do
		h = (h * 31 + string.byte(s, i)) % 2147483646
	end
	return h + 1
end

-- Petit générateur de nombres aléatoires : le même plat est toujours construit pareil
local function newRandom(seed)
	local state = seed % 2147483647
	if state <= 0 then
		state += 2147483646
	end
	return function(a, b)
		state = (state * 16807) % 2147483647
		local f = (state - 1) / 2147483646
		if a ~= nil then
			return a + (b - a) * f
		end
		return f
	end
end

local function v3(t)
	return Vector3.new(t[1], t[2], t[3])
end

local function newContext(model, origin, scale, seed)
	return {
		model = model,
		origin = origin,
		scale = scale,
		rand = newRandom(seed),
		heights = {},
		floor = 0,
		stepParts = {},
		currentParts = nil,
		lastCup = nil,
		lastRing = nil,
	}
end

-- Hauteur de la surface du plat à la position (x, z)
local function heightAt(ctx, x, z)
	local best = ctx.floor
	for _, fn in ctx.heights do
		local h = fn(x, z)
		if h and h > best then
			best = h
		end
	end
	return best
end

local function addHeight(ctx, fn)
	table.insert(ctx.heights, fn)
end

local function discHeight(cx, cz, r, top)
	local r2 = r * r
	return function(x, z)
		local dx, dz = x - cx, z - cz
		if dx * dx + dz * dz <= r2 then
			return top
		end
		return nil
	end
end

local function domeHeight(cx, cz, rx, rz, centerY, h)
	return function(x, z)
		local u, v = (x - cx) / rx, (z - cz) / rz
		local q = u * u + v * v
		if q <= 1 then
			return centerY + h * math.sqrt(1 - q)
		end
		return nil
	end
end

local function boxHeight(cx, cz, hx, hz, top)
	return function(x, z)
		if math.abs(x - cx) <= hx and math.abs(z - cz) <= hz then
			return top
		end
		return nil
	end
end

-- Crée une pièce du plat. shape = "block", "cyl", "ball" ou "ellipsoid"
local function newPart(ctx, shape, size, pos, rot, color, props)
	local p = Instance.new("Part")
	if shape == "cyl" then
		p.Shape = Enum.PartType.Cylinder
	elseif shape == "ball" then
		p.Shape = Enum.PartType.Ball
	end
	p.Name = "Morceau"
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	p.Color = color
	p.Size = size * ctx.scale
	local cf = CFrame.new(pos * ctx.scale)
	if rot then
		cf = cf * rot
	end
	p.CFrame = ctx.origin * cf
	if shape == "ellipsoid" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = p
	end
	if props then
		for key, value in props do
			p[key] = value
		end
	end
	p.Parent = ctx.model
	if ctx.currentParts then
		table.insert(ctx.currentParts, p)
	end
	return p
end

local function stepColor(step, index)
	if step.colors then
		return step.colors[((index - 1) % #step.colors) + 1]
	end
	return step.color or WHITE
end

local function centers(step)
	if step.ats then
		return step.ats
	end
	if step.at then
		return { step.at }
	end
	return { { x = 0, z = 0 } }
end

local function transparencyProps(step)
	if step.transparency then
		return { Transparency = step.transparency }
	end
	return nil
end

---------------------------------------------------------------- petits morceaux

local Pieces = {}

function Pieces.disc(ctx, step, x, z, color)
	local d = step.size
	local h = math.max(d * 0.22, 0.05)
	local base = heightAt(ctx, x, z)
	newPart(ctx, "cyl", Vector3.new(h, d, d), Vector3.new(x, base + h / 2, z), VERTICAL, color)
	addHeight(ctx, discHeight(x, z, d / 2, base + h))
end

function Pieces.ball(ctx, step, x, z, color)
	local d = step.size
	local cy = heightAt(ctx, x, z) + d * 0.35
	newPart(ctx, "ball", Vector3.new(d, d, d), Vector3.new(x, cy, z), nil, color)
	addHeight(ctx, domeHeight(x, z, d / 2, d / 2, cy, d / 2))
end

function Pieces.cube(ctx, step, x, z, color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	local rot = CFrame.Angles(ctx.rand(0, 0.6), ctx.rand(0, TWO_PI), ctx.rand(0, 0.6))
	newPart(ctx, "block", Vector3.new(d, d, d), Vector3.new(x, base + d * 0.4, z), rot, color)
	addHeight(ctx, boxHeight(x, z, d / 2, d / 2, base + d * 0.85))
end

function Pieces.leaf(ctx, step, x, z, color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	local rot = CFrame.Angles(0, ctx.rand(0, TWO_PI), 0)
	newPart(ctx, "ellipsoid", Vector3.new(d * 1.8, d * 0.25, d), Vector3.new(x, base + 0.03, z), rot, color)
end

function Pieces.strip(ctx, step, x, z, color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	local rot = CFrame.Angles(0, ctx.rand(0, TWO_PI), 0)
	newPart(ctx, "block", Vector3.new(d * 2.2, d * 0.22, d * 0.3), Vector3.new(x, base + d * 0.1, z), rot, color)
end

function Pieces.egg(ctx, step, x, z, _color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	local rot = CFrame.Angles(0, ctx.rand(0, TWO_PI), 0)
	newPart(ctx, "ellipsoid", Vector3.new(d * 1.3, d * 0.6, d), Vector3.new(x, base + d * 0.15, z), rot, WHITE)
	newPart(ctx, "ellipsoid", Vector3.new(d * 0.55, d * 0.3, d * 0.55), Vector3.new(x, base + d * 0.4, z), nil, Color3.fromRGB(250, 175, 30))
	addHeight(ctx, discHeight(x, z, d * 0.5, base + d * 0.45))
end

function Pieces.friedegg(ctx, step, x, z, _color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	newPart(ctx, "cyl", Vector3.new(0.06, d * 2, d * 2), Vector3.new(x, base + 0.03, z), VERTICAL, WHITE)
	newPart(ctx, "ellipsoid", Vector3.new(d * 0.8, d * 0.45, d * 0.8), Vector3.new(x + d * 0.1, base + 0.08, z - d * 0.1), nil, Color3.fromRGB(255, 185, 30))
	addHeight(ctx, discHeight(x, z, d, base + 0.06))
end

function Pieces.maki(ctx, step, x, z, color)
	local d = step.size
	local h = d * 0.75
	local base = heightAt(ctx, x, z)
	newPart(ctx, "cyl", Vector3.new(h, d, d), Vector3.new(x, base + h / 2, z), VERTICAL, Color3.fromRGB(30, 55, 35))
	newPart(ctx, "cyl", Vector3.new(0.03, d * 0.84, d * 0.84), Vector3.new(x, base + h + 0.01, z), VERTICAL, WHITE)
	newPart(ctx, "cyl", Vector3.new(0.04, d * 0.35, d * 0.35), Vector3.new(x, base + h + 0.02, z), VERTICAL, color)
	addHeight(ctx, discHeight(x, z, d / 2, base + h + 0.04))
end

function Pieces.nigiri(ctx, step, x, z, color)
	local d = step.size
	local base = heightAt(ctx, x, z)
	newPart(ctx, "ellipsoid", Vector3.new(d * 1.8, d * 0.7, d), Vector3.new(x, base + d * 0.3, z), nil, WHITE)
	newPart(ctx, "ellipsoid", Vector3.new(d * 2.0, d * 0.3, d * 1.05), Vector3.new(x, base + d * 0.6, z), nil, color)
	addHeight(ctx, boxHeight(x, z, d, d / 2, base + d * 0.75))
end

local function piecePositions(ctx, step)
	if step.points then
		return step.points
	end
	local cx = step.center and step.center.x or 0
	local cz = step.center and step.center.z or 0
	local count = step.count or 1
	local list = {}
	for k = 1, count do
		local x, z
		if step.ring then
			local a = (k - 1) / count * TWO_PI + ctx.rand(-0.2, 0.2)
			local rr = step.ring + ctx.rand(-1, 1) * (step.ringWidth or 0.1)
			x, z = math.cos(a) * rr, math.sin(a) * rr
		else
			local a = ctx.rand() * TWO_PI
			local rr = math.sqrt(ctx.rand()) * (step.spread or 1)
			x, z = math.cos(a) * rr, math.sin(a) * rr
		end
		table.insert(list, { x = cx + x, z = cz + z })
	end
	return list
end

---------------------------------------------------------------- types d'ingrédients

local Kinds = {}

function Kinds.disc(ctx, step)
	for i, c in centers(step) do
		local base = heightAt(ctx, c.x, c.z)
		newPart(ctx, "cyl", Vector3.new(step.h, step.r * 2, step.r * 2), Vector3.new(c.x, base + step.h / 2, c.z), VERTICAL, stepColor(step, i), transparencyProps(step))
		addHeight(ctx, discHeight(c.x, c.z, step.r, base + step.h))
	end
end

function Kinds.stack(ctx, step)
	for n = 1, step.count or 2 do
		Kinds.disc(ctx, { r = step.r * (1 - 0.03 * (n - 1)), h = step.h, color = step.color, at = step.at })
	end
end

function Kinds.dome(ctx, step)
	for i, c in centers(step) do
		local base = heightAt(ctx, c.x, c.z) - (step.sink or 0)
		local fullHeight = step.h * 1.3
		local cy = base + step.h - fullHeight / 2
		newPart(ctx, "ellipsoid", Vector3.new(step.r * 2, fullHeight, step.r * 2), Vector3.new(c.x, cy, c.z), nil, stepColor(step, i), transparencyProps(step))
		addHeight(ctx, domeHeight(c.x, c.z, step.r, step.r, cy, fullHeight / 2))
	end
end

function Kinds.ball(ctx, step)
	for i, c in centers(step) do
		local cy = heightAt(ctx, c.x, c.z) + step.r * (step.lift or 0.7)
		newPart(ctx, "ball", Vector3.new(step.r * 2, step.r * 2, step.r * 2), Vector3.new(c.x, cy, c.z), nil, stepColor(step, i))
		addHeight(ctx, domeHeight(c.x, c.z, step.r, step.r, cy, step.r))
	end
end

function Kinds.swirl(ctx, step)
	local c = step.at or { x = 0, z = 0 }
	for n = 1, step.layers or 3 do
		local r = step.r * (1 - (n - 1) * 0.28)
		local cy = heightAt(ctx, c.x, c.z) + r * 0.45
		newPart(ctx, "ellipsoid", Vector3.new(r * 2, r * 1.3, r * 2), Vector3.new(c.x, cy, c.z), nil, step.color or WHITE)
		addHeight(ctx, domeHeight(c.x, c.z, r, r, cy, r * 0.65))
	end
end

function Kinds.block(ctx, step)
	local size = v3(step.size)
	local props = nil
	if step.material then
		props = { Material = Enum.Material[step.material] }
	end
	for i, c in centers(step) do
		local base = heightAt(ctx, c.x, c.z)
		local rot = step.rot and CFrame.Angles(0, math.rad(step.rot), 0) or nil
		newPart(ctx, "block", size, Vector3.new(c.x, base + size.Y / 2, c.z), rot, stepColor(step, i), props)
		addHeight(ctx, boxHeight(c.x, c.z, size.X / 2, size.Z / 2, base + size.Y))
	end
end

function Kinds.pill(ctx, step)
	local size = v3(step.size)
	for i, c in centers(step) do
		local base = heightAt(ctx, c.x, c.z)
		local cy = base + size.Y * 0.4
		newPart(ctx, "ellipsoid", size, Vector3.new(c.x, cy, c.z), nil, stepColor(step, i))
		addHeight(ctx, domeHeight(c.x, c.z, size.X / 2, size.Z / 2, cy, size.Y / 2))
	end
end

function Kinds.ring(ctx, step)
	local count = step.count or 16
	local R, d = step.R, step.t
	local cy
	if step.lift and ctx.lastRing then
		cy = ctx.lastRing.cy + step.lift
	else
		cy = heightAt(ctx, R, 0) + d * 0.5
	end
	for k = 0, count - 1 do
		local a = k / count * TWO_PI
		newPart(ctx, "ball", Vector3.new(d, d, d), Vector3.new(math.cos(a) * R, cy, math.sin(a) * R), nil, step.color or WHITE)
	end
	local half = d / 2
	addHeight(ctx, function(x, z)
		local off = math.sqrt(x * x + z * z) - R
		if math.abs(off) <= half then
			return cy + math.sqrt(half * half - off * off)
		end
		return nil
	end)
	ctx.lastRing = { cy = cy }
end

function Kinds.pieces(ctx, step)
	local maker = Pieces[step.piece or "ball"] or Pieces.ball
	for i, pos in piecePositions(ctx, step) do
		maker(ctx, step, pos.x, pos.z, stepColor(step, i))
	end
end

function Kinds.sprinkles(ctx, step)
	local colors = step.colors or RAINBOW
	for i, pos in piecePositions(ctx, step) do
		local base = heightAt(ctx, pos.x, pos.z)
		local rot = CFrame.Angles(0, ctx.rand(0, TWO_PI), 0)
		newPart(ctx, "block", Vector3.new(0.2, 0.06, 0.06), Vector3.new(pos.x, base + 0.02, pos.z), rot, colors[((i - 1) % #colors) + 1])
	end
end

function Kinds.cup(ctx, step)
	local c = step.at or { x = 0, z = 0 }
	local base = heightAt(ctx, c.x, c.z)
	local r, h = step.r, step.h
	local wall = step.wall or math.max(0.06, r * 0.08)
	local color = step.color or Color3.fromRGB(215, 235, 255)
	local props = step.glass and { Transparency = 0.55 } or nil
	-- fond
	newPart(ctx, "cyl", Vector3.new(0.1, r * 2, r * 2), Vector3.new(c.x, base + 0.05, c.z), VERTICAL, color, props)
	-- parois (plusieurs plaques en cercle pour que le récipient soit creux)
	local n = math.clamp(math.floor(r * 12), 10, 24)
	local mid = r - wall / 2
	local segmentWidth = TWO_PI * mid / n * 1.08
	for k = 0, n - 1 do
		local a = k / n * TWO_PI
		local px, pz = c.x + math.cos(a) * mid, c.z + math.sin(a) * mid
		newPart(ctx, "block", Vector3.new(wall, h, segmentWidth), Vector3.new(px, base + h / 2, pz), CFrame.Angles(0, -a, 0), color, props)
	end
	local floorY = base + 0.1
	local inner = r - wall
	addHeight(ctx, function(x, z)
		local dx, dz = x - c.x, z - c.z
		local d2 = dx * dx + dz * dz
		if d2 <= inner * inner then
			return floorY
		elseif d2 <= r * r then
			return base + h
		end
		return nil
	end)
	ctx.lastCup = { x = c.x, z = c.z, r = r, inner = inner, h = h, base = base, floor = floorY }
end

function Kinds.liquid(ctx, step)
	local cup = ctx.lastCup
	if not cup then
		return
	end
	local hh = (cup.h - 0.1) * (step.fill or 0.8)
	local d = cup.inner * 2 - 0.02
	newPart(ctx, "cyl", Vector3.new(hh, d, d), Vector3.new(cup.x, cup.floor + hh / 2, cup.z), VERTICAL, step.color or WHITE, transparencyProps(step))
	addHeight(ctx, discHeight(cup.x, cup.z, cup.inner, cup.floor + hh))
end

function Kinds.lid(ctx, step)
	local cup = ctx.lastCup
	if not cup then
		return
	end
	local top = cup.base + cup.h
	local d = cup.r * 2 + 0.06
	newPart(ctx, "ellipsoid", Vector3.new(d, 0.5, d), Vector3.new(cup.x, top, cup.z), nil, step.color or Color3.fromRGB(235, 245, 255), { Transparency = 0.45 })
	addHeight(ctx, domeHeight(cup.x, cup.z, cup.r, cup.r, top, 0.25))
end

-- Oriente un cylindre (axe X) dans la direction : penché de "tilt" vers l'angle "a"
local function tiltedRotation(a, tilt)
	return CFrame.Angles(0, -a, 0) * CFrame.Angles(0, 0, -tilt) * VERTICAL
end

local function tiltedDirection(a, tilt)
	return Vector3.new(math.cos(a) * math.sin(tilt), math.cos(tilt), math.sin(a) * math.sin(tilt))
end

function Kinds.straw(ctx, step)
	local cup = ctx.lastCup
	local bottom
	if cup then
		bottom = Vector3.new(cup.x + cup.inner * 0.35, cup.floor, cup.z)
	else
		bottom = Vector3.new(0, ctx.floor, 0)
	end
	local L = step.length or 2.5
	local tilt = math.rad(step.tilt or 12)
	local center = bottom + tiltedDirection(0, tilt) * (L / 2)
	newPart(ctx, "cyl", Vector3.new(L, 0.16, 0.16), center, tiltedRotation(0, tilt), step.color or WHITE)
end

function Kinds.sticks(ctx, step)
	local cup = ctx.lastCup
	local cx, cz, base, radius = 0, 0, ctx.floor, 0.5
	if cup then
		cx, cz, base, radius = cup.x, cup.z, cup.floor, cup.inner * 0.75
	end
	local L = step.length or 1.4
	local w = step.width or 0.17
	local color = step.color or WHITE
	for _ = 1, step.count or 12 do
		local a = ctx.rand() * TWO_PI
		local rr = math.sqrt(ctx.rand()) * radius
		local x, z = cx + math.cos(a) * rr, cz + math.sin(a) * rr
		local rot = CFrame.Angles(ctx.rand(-0.2, 0.2), ctx.rand(0, 1.5), ctx.rand(-0.2, 0.2))
		local shade = lerpColor(color, Color3.fromRGB(255, 240, 170), ctx.rand(0, 0.4))
		newPart(ctx, "block", Vector3.new(w, L, w), Vector3.new(x, base + L / 2 + ctx.rand(0, 0.3), z), rot, shade)
	end
end

function Kinds.log(ctx, step)
	for i, c in centers(step) do
		local d = step.d
		local base = heightAt(ctx, c.x, c.z)
		local cy = base + d * (step.lift or 0.15)
		newPart(ctx, "cyl", Vector3.new(step.length, d, d), Vector3.new(c.x, cy, c.z), nil, stepColor(step, i))
		addHeight(ctx, boxHeight(c.x, c.z, step.length / 2, d / 2, cy + d / 2))
	end
end

function Kinds.line(ctx, step)
	local n = step.dots or 16
	local d = step.d or 0.12
	for k = 0, n - 1 do
		local t = k / (n - 1)
		local x = -step.length / 2 + step.length * t
		local z = math.sin(t * math.pi * (step.waves or 4) + (step.phase or 0)) * (step.amp or 0.12)
		local base = heightAt(ctx, x, z)
		newPart(ctx, "ball", Vector3.new(d, d, d), Vector3.new(x, base + d * 0.15, z), nil, step.color or WHITE)
	end
end

function Kinds.drizzle(ctx, step)
	local base = heightAt(ctx, 0, 0)
	local r = step.r
	newPart(ctx, "cyl", Vector3.new(0.06, r * 2, r * 2), Vector3.new(0, base + 0.03, 0), VERTICAL, step.color, { Transparency = 0.1 })
	local drips = step.drips or 6
	for k = 0, drips - 1 do
		local a = k / drips * TWO_PI + 0.3
		newPart(ctx, "ellipsoid", Vector3.new(0.22, 0.45, 0.22), Vector3.new(math.cos(a) * r * 0.98, base - 0.12, math.sin(a) * r * 0.98), nil, step.color)
	end
	addHeight(ctx, discHeight(0, 0, r, base + 0.06))
end

function Kinds.nest(ctx, step)
	local base = heightAt(ctx, 0, 0)
	local r, h = step.r, step.h
	newPart(ctx, "ellipsoid", Vector3.new(r * 1.8, h * 1.6, r * 1.8), Vector3.new(0, base, 0), nil, step.color)
	for _ = 1, step.count or 40 do
		local a = ctx.rand() * TWO_PI
		local rr = math.sqrt(ctx.rand()) * r
		local x, z = math.cos(a) * rr, math.sin(a) * rr
		local maxY = h * math.sqrt(math.max(0, 1 - (rr / r) ^ 2))
		local y = base + ctx.rand(0.05, 1) * maxY
		local rot = CFrame.Angles(ctx.rand(-0.4, 0.4), ctx.rand(0, TWO_PI), ctx.rand(-0.3, 0.3))
		newPart(ctx, "cyl", Vector3.new(1.1, 0.08, 0.08), Vector3.new(x, y, z), rot, step.color)
	end
	addHeight(ctx, domeHeight(0, 0, r, r, base, h))
end

function Kinds.crescent(ctx, step)
	local base = heightAt(ctx, 0, 0)
	local s = step.size or 1
	local R = 1.1 * s
	for i = 1, 5 do
		local t = (-0.5 + (i - 1) / 4) * 2.2
		local k = 1 - 0.42 * math.abs(i - 3) / 2
		local x, z = math.sin(t) * R, ((1 - math.cos(t)) * R - 0.45) * s
		local size = Vector3.new(0.75 * k + 0.25, 0.75 * k, 1.0 * k) * s
		newPart(ctx, "ellipsoid", size, Vector3.new(x, base + size.Y * 0.45, z), CFrame.Angles(0, -t, 0), step.color)
		addHeight(ctx, domeHeight(x, z, size.X / 2, size.Z / 2, base + size.Y * 0.45, size.Y / 2))
	end
end

function Kinds.recolor(ctx, step)
	local parts = ctx.stepParts[step.target]
	if parts then
		for _, p in parts do
			p.Color = step.color
		end
	end
end

function Kinds.candle(ctx, step)
	local c = step.at or { x = 0, z = 0 }
	local base = heightAt(ctx, c.x, c.z)
	local h, d = step.h or 0.8, step.d or 0.14
	newPart(ctx, "cyl", Vector3.new(h, d, d), Vector3.new(c.x, base + h / 2 - 0.05, c.z), VERTICAL, step.color or WHITE)
	if step.flame ~= false then
		newPart(ctx, "ellipsoid", Vector3.new(0.16, 0.3, 0.16), Vector3.new(c.x, base + h + 0.1, c.z), nil, Color3.fromRGB(255, 170, 40), { Material = Enum.Material.Neon })
	end
	if step.topColor then
		newPart(ctx, "ball", Vector3.new(0.3, 0.3, 0.3), Vector3.new(c.x, base + h - 0.2, c.z), nil, step.topColor)
	end
	addHeight(ctx, discHeight(c.x, c.z, d / 2, base + h))
end

function Kinds.horn(ctx, step)
	local base = heightAt(ctx, 0, 0)
	local segments = 5
	local h, r0 = step.h or 1.0, step.r or 0.22
	for k = 0, segments - 1 do
		local rr = r0 * (1 - k / segments)
		local d = math.max(rr * 2, 0.05)
		newPart(ctx, "cyl", Vector3.new(h / segments, d, d), Vector3.new(0, base + (k + 0.5) * h / segments, 0), VERTICAL, step.color or WHITE)
	end
end

function Kinds.skewers(ctx, step)
	local cup = ctx.lastCup
	local cx, cz, base = 0, 0, ctx.floor
	if cup then
		cx, cz, base = cup.x, cup.z, cup.floor + (cup.h - 0.1) * 0.4
	end
	local count = step.count or 3
	local L = step.length or 2.0
	local tilt = math.rad(35)
	local colors = step.colors or RAINBOW
	for k = 0, count - 1 do
		local a = k / count * TWO_PI + 0.4
		local dir = tiltedDirection(a, tilt)
		local bottom = Vector3.new(cx + math.cos(a) * 0.15, base, cz + math.sin(a) * 0.15)
		newPart(ctx, "cyl", Vector3.new(L, 0.07, 0.07), bottom + dir * (L / 2), tiltedRotation(a, tilt), Color3.fromRGB(200, 160, 110))
		for j, f in { 0.55, 0.72, 0.89 } do
			newPart(ctx, "ball", Vector3.new(0.3, 0.3, 0.3), bottom + dir * (L * f), nil, colors[((j + k - 1) % #colors) + 1])
		end
	end
end

function Kinds.tray(ctx, step)
	local sx, sz, h = step.sx, step.sz, step.h
	local base = heightAt(ctx, 0, 0)
	local w = 0.12
	local color = step.color or Color3.fromRGB(40, 40, 45)
	newPart(ctx, "block", Vector3.new(sx, 0.1, sz), Vector3.new(0, base + 0.05, 0), nil, step.innerColor or color)
	newPart(ctx, "block", Vector3.new(sx, h, w), Vector3.new(0, base + h / 2, -sz / 2 + w / 2), nil, color)
	newPart(ctx, "block", Vector3.new(sx, h, w), Vector3.new(0, base + h / 2, sz / 2 - w / 2), nil, color)
	newPart(ctx, "block", Vector3.new(w, h, sz), Vector3.new(-sx / 2 + w / 2, base + h / 2, 0), nil, color)
	newPart(ctx, "block", Vector3.new(w, h, sz), Vector3.new(sx / 2 - w / 2, base + h / 2, 0), nil, color)
	for _, dx in step.dividers or {} do
		newPart(ctx, "block", Vector3.new(w, h, sz - 2 * w), Vector3.new(dx, base + h / 2, 0), nil, color)
	end
	addHeight(ctx, boxHeight(0, 0, sx / 2, sz / 2, base + 0.1))
end

FoodModel.Kinds = Kinds
FoodModel.Pieces = Pieces

---------------------------------------------------------------- plats

local function addPlate(ctx, radius)
	local d = radius * 2
	newPart(ctx, "cyl", Vector3.new(0.2, d, d), Vector3.new(0, 0.1, 0), VERTICAL, Color3.fromRGB(250, 250, 252))
	newPart(ctx, "cyl", Vector3.new(0.22, d * 0.72, d * 0.72), Vector3.new(0, 0.11, 0), VERTICAL, Color3.fromRGB(236, 238, 246))
	ctx.floor = 0.22
end

function FoodModel.build(recipe, opts)
	opts = opts or {}
	local model = Instance.new("Model")
	model.Name = recipe.id
	local ctx = newContext(model, opts.origin or CFrame.new(), opts.scale or 1, hashString(recipe.id))
	if recipe.plate ~= false then
		addPlate(ctx, recipe.plate or 1.9)
	end
	local count = math.min(opts.steps or #recipe.steps, #recipe.steps)
	for i = 1, count do
		local step = recipe.steps[i]
		local kind = Kinds[step.kind]
		ctx.currentParts = {}
		if kind then
			kind(ctx, step)
		else
			warn("[FoodModel] Type d'ingrédient inconnu : " .. tostring(step.kind) .. " (" .. recipe.id .. ")")
		end
		ctx.stepParts[i] = ctx.currentParts
	end
	ctx.currentParts = nil
	return model
end

---------------------------------------------------------------- slimes

-- Les couleurs des ingrédients, pour décorer le slime avec des petits morceaux
local function charmColors(recipe, max)
	local list = {}
	for _, step in recipe.steps do
		local c = step.color or (step.colors and step.colors[1])
		if c and step.kind ~= "cup" and step.kind ~= "tray" and step.kind ~= "recolor" then
			local duplicate = false
			for _, other in list do
				if math.abs(other.R - c.R) + math.abs(other.G - c.G) + math.abs(other.B - c.B) < 0.15 then
					duplicate = true
					break
				end
			end
			if not duplicate then
				table.insert(list, c)
				if #list >= max then
					break
				end
			end
		end
	end
	return list
end

function FoodModel.buildSlime(recipe, textureId, opts)
	opts = opts or {}
	local model = Instance.new("Model")
	model.Name = "Slime_" .. recipe.id
	local ctx = newContext(model, opts.origin or CFrame.new(), opts.scale or 1, hashString(recipe.id .. "/" .. tostring(textureId)))

	-- le pot transparent
	Kinds.cup(ctx, { r = 1.5, h = 1.0, glass = true, color = Color3.fromRGB(220, 235, 255) })
	local cup = ctx.lastCup
	local floorY = cup.floor

	local color = recipe.slimeColor or Color3.fromRGB(120, 220, 120)
	local blobProps = nil
	if textureId == "nuage" then
		color = lerpColor(color, WHITE, 0.45)
	elseif textureId == "galaxie" then
		color = Color3.fromRGB(45, 30, 95)
	elseif textureId == "brillant" then
		blobProps = { Reflectance = 0.25 }
	end

	-- le slime qui déborde du pot
	newPart(ctx, "ellipsoid", Vector3.new(2.7, 1.6, 2.7), Vector3.new(0, floorY + 0.75, 0), nil, color, blobProps)
	newPart(ctx, "ellipsoid", Vector3.new(1.6, 0.9, 1.6), Vector3.new(0.2, floorY + 1.35, -0.1), nil, color, blobProps)
	addHeight(ctx, domeHeight(0, 0, 1.35, 1.35, floorY + 0.75, 0.8))
	addHeight(ctx, domeHeight(0.2, -0.1, 0.8, 0.8, floorY + 1.35, 0.45))

	if textureId == "arcenciel" then
		for k, c in RAINBOW do
			local a = k / #RAINBOW * TWO_PI
			local x, z = math.cos(a) * 0.75, math.sin(a) * 0.75
			newPart(ctx, "ellipsoid", Vector3.new(0.95, 0.5, 0.95), Vector3.new(x, heightAt(ctx, x, z) - 0.1, z), nil, c)
		end
	elseif textureId == "nuage" then
		Kinds.pieces(ctx, { piece = "ball", count = 6, size = 0.55, spread = 1.0, color = WHITE })
	elseif textureId == "brillant" then
		local sparkle = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(255, 215, 80), Color3.fromRGB(210, 220, 240) }
		for i, pos in piecePositions(ctx, { count = 26, spread = 1.15 }) do
			local base = heightAt(ctx, pos.x, pos.z)
			newPart(ctx, "block", Vector3.new(0.12, 0.12, 0.12), Vector3.new(pos.x, base, pos.z), CFrame.Angles(0.6, ctx.rand(0, TWO_PI), 0.6), sparkle[(i % 3) + 1], { Material = Enum.Material.Neon })
		end
	elseif textureId == "croquant" then
		local beads = { Color3.fromRGB(255, 180, 200), Color3.fromRGB(180, 230, 255), Color3.fromRGB(255, 240, 160), Color3.fromRGB(200, 255, 190) }
		for i, pos in piecePositions(ctx, { count = 24, spread = 1.15 }) do
			local base = heightAt(ctx, pos.x, pos.z)
			newPart(ctx, "ball", Vector3.new(0.18, 0.18, 0.18), Vector3.new(pos.x, base, pos.z), nil, beads[(i % #beads) + 1])
		end
	elseif textureId == "galaxie" then
		local swirls = { Color3.fromRGB(150, 70, 220), Color3.fromRGB(60, 120, 230), Color3.fromRGB(230, 90, 190) }
		for k, c in swirls do
			local a = k / #swirls * TWO_PI + 0.5
			local x, z = math.cos(a) * 0.65, math.sin(a) * 0.65
			newPart(ctx, "ellipsoid", Vector3.new(1.0, 0.45, 0.7), Vector3.new(x, heightAt(ctx, x, z) - 0.12, z), CFrame.Angles(0, -a, 0), c)
		end
		for _, pos in piecePositions(ctx, { count = 20, spread = 1.2 }) do
			local base = heightAt(ctx, pos.x, pos.z)
			newPart(ctx, "ball", Vector3.new(0.1, 0.1, 0.1), Vector3.new(pos.x, base, pos.z), nil, Color3.fromRGB(255, 255, 255), { Material = Enum.Material.Neon })
		end
	end

	-- les petits morceaux de nourriture (charms) posés sur le slime
	local charms = charmColors(recipe, 4)
	local shapes = { Pieces.ball, Pieces.disc, Pieces.cube, Pieces.ball }
	for i, c in charms do
		local a = i / math.max(#charms, 1) * TWO_PI + 0.8
		local x, z = math.cos(a) * 0.6, math.sin(a) * 0.6
		shapes[i](ctx, { size = 0.38 }, x, z, c)
	end

	return model
end

return FoodModel
