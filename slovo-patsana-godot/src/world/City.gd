class_name City
extends Node3D
## The district (port of world/City.ts): a 6×6 grid of blocks with panel housing, the
## Универсам, the rink, the video salon, the school, the market, the garages and the
## gym; roads, sidewalks, snowbanks, lamps, bus stops, courtyards. Colliders go into a
## StaticBody3D and a BoxGrid for quick queries.

const N := 6
const BLOCK := 64.0
const ROAD := 14.0
const PITCH := BLOCK + ROAD
const HALF := (N * PITCH) / 2
const SIDEWALK := 2.6
const H_MARKET := 27.0

const ZONE_NAMES := {"universam": "Универсам", "razezd": "Разъезд", "hadi": "Хади Такташ"}
const ZONE_COLORS := {"universam": Color("#d23b3b"), "razezd": Color("#3b7bd2"), "hadi": Color("#d2a23b")}

var grid := BoxGrid.new(24)
var boxes: Array = []
var landmarks: Array = []   # {name, x, z}
var hangouts: Array = []    # {x, z, zone}
var walk_nodes: Array = []  # {x, z, next: []}
var spawn := {"x": 0.0, "z": 0.0, "heading": 0.0}
var lamp_spots: Array = []
var facade_kit := Facades.new()
var trees := Trees.new()
var inst := MeshLib.Batcher.new()
var props := MeshLib.PropBatcher.new()
var rnd := MeshLib.rng(1989)
var colliders := StaticBody3D.new()
var _mats := {}
var roof_mat := Facades._std(Color(0.902, 0.922, 0.949), 0.85)
var glow_quad := QuadMesh.new()
var pool_quad := PlaneMesh.new()
var sign_font: Font = load("res://assets/fonts/RussoOne-Regular.ttf")

static func block_center(i: int, j: int) -> Vector2:
	return Vector2(-HALF + ROAD / 2 + BLOCK / 2 + i * PITCH, -HALF + ROAD / 2 + BLOCK / 2 + j * PITCH)

static func zone_of_block(i: int, j: int) -> String:
	if j <= 1:
		return "hadi"
	return "universam" if i <= 2 else "razezd"

static func zone_at(x: float, z: float) -> String:
	var i := clampi(floori((x + HALF) / PITCH), 0, N - 1)
	var j := clampi(floori((z + HALF) / PITCH), 0, N - 1)
	return zone_of_block(i, j)

func _ready() -> void:
	var t0 := Time.get_ticks_msec()
	colliders.name = "Colliders"
	colliders.collision_layer = 1
	colliders.collision_mask = 0
	add_child(colliders)
	glow_quad.size = Vector2(1, 1)
	pool_quad.size = Vector2(1, 1)
	_ground()
	_roads()
	for i in range(N):
		for j in range(N):
			_block(i, j)
	_lights()
	_bus_stops()
	_walk_graph()
	inst.build(self)
	props.build(self)
	facade_kit.build(self)
	trees.build(self)
	print("city built in %d ms: %d colliders, %d children" % [Time.get_ticks_msec() - t0, boxes.size(), get_child_count()])

# ---------- helpers ----------
func _std(c: Color, rough := 0.9, metal := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f" % [c.to_html(), rough, metal]
	if not _mats.has(key):
		_mats[key] = Facades._std(c, rough, metal)
	return _mats[key]

## Textured PBR material with the texture tiled every `meters` metres over a mesh of `size`.
func _pbr(tex: String, rep: Vector2, extra := {}) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(Assets.p("tex/%s_diff.jpg" % tex))
	m.normal_enabled = true
	m.normal_texture = load(Assets.p("tex/%s_nor.jpg" % tex))
	var rp := Assets.p("tex/%s_rough.jpg" % tex)
	if ResourceLoader.exists(rp):
		m.roughness_texture = load(rp)
	m.roughness = extra.get("roughness", 1.0)
	m.albedo_color = extra.get("color", Color.WHITE)
	m.uv1_scale = Vector3(rep.x, rep.y, 1)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m

func _add_box(min_x: float, max_x: float, min_z: float, max_z: float, h: float) -> void:
	var b := BoxGrid.box(min_x, max_x, min_z, max_z, h)
	boxes.append(b)
	grid.add(b)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(max_x - min_x, h, max_z - min_z)
	cs.shape = shape
	cs.position = Vector3((min_x + max_x) / 2, h / 2, (min_z + max_z) / 2)
	colliders.add_child(cs)

func _mesh(mesh: Mesh, mat: Material, pos: Vector3, ry := 0.0, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if mat:
		mi.material_override = mat
	mi.position = pos
	mi.rotation.y = ry
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi

func _box_mesh(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b

func _cyl(r: float, h: float, segs := 6) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = segs
	return c

var _glow_mats := {}
func _glow_mat(color: Color, opacity: float) -> ShaderMaterial:
	var key := color.to_html() + str(opacity)
	if not _glow_mats.has(key):
		var m := ShaderMaterial.new()
		m.shader = Shaders.get_shader("glow")
		m.set_shader_parameter("color", Vector3(color.r, color.g, color.b))
		m.set_shader_parameter("opacity", opacity)
		_glow_mats[key] = m
	return _glow_mats[key]

## Soft light blob: three crossed quads approximate a billboard.
func _glow(x: float, y: float, z: float, size: float, color: Color) -> void:
	var mat := _glow_mat(color, 0.9)
	for ry in [0.0, PI / 3, 2 * PI / 3]:
		inst.add("glow" + color.to_html(), glow_quad, mat, MeshLib.xform(Vector3(x, y, z), ry, Vector3(size, size, 1)), false)

## Light pool on the snow.
func _pool(x: float, z: float, size: float, color: Color) -> void:
	inst.add("pool" + color.to_html(), pool_quad, _glow_mat(color, 0.38), MeshLib.xform(Vector3(x, 0.16, z), 0, Vector3(size * 2, 1, size * 2)), false)

func _sign(text: String, x: float, y: float, z: float, w: float, h: float, ry: float, fg: Color, bg := Color(0.04, 0.04, 0.055)) -> void:
	var l := Label3D.new()
	l.text = text
	l.font = sign_font
	l.font_size = 96
	l.modulate = fg
	l.outline_size = 0
	l.pixel_size = h * 0.0088
	l.position = Vector3(x, y, z)
	l.rotation.y = ry
	l.shaded = false
	l.double_sided = false
	l.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
	add_child(l)
	var back := _mesh(_box_mesh(Vector3(w + 0.2, h + 0.2, 0.15)), _std(bg, 0.8), Vector3(x - sin(ry) * 0.1, y, z - cos(ry) * 0.1), ry, false)
	back.name = "signback"

func _building(cx: float, cz: float, w: float, d: float, floors: int, facade: int, entrance_side := 0) -> float:
	var style: String = ["panel", "panelBeige", "brick", "panelBlue", "brick"][facade % 5]
	var h := facade_kit.add_building({"cx": cx, "cz": cz, "w": w, "d": d, "floors": floors, "style": style, "entrance": entrance_side, "seed": floori(rnd.call() * 1e6)}, self)
	_add_box(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h)
	if entrance_side != 0:
		var along_x := w >= d
		var len := w if along_x else d
		var n := maxi(1, floori(len / 14))
		for k in range(n):
			var t := -len / 2 + (len / n) * (k + 0.5)
			var ex := cx + t if along_x else cx + entrance_side * (w / 2 + 0.05)
			var ez := cz + entrance_side * (d / 2 + 0.05) if along_x else cz + t
			var ry := 0.0 if along_x else PI / 2
			inst.add("door", _box_mesh(Vector3(1.6, 2.3, 0.2)), _std(Color(0.302, 0.227, 0.165), 0.8), MeshLib.xform(Vector3(ex, 1.15, ez), ry), false)
			var cox := ex if along_x else ex + entrance_side * 0.7
			var coz := ez + entrance_side * 0.7 if along_x else ez
			inst.add("canopy", _box_mesh(Vector3(2.4, 0.15, 1.4)), _std(Color(0.549, 0.561, 0.58)), MeshLib.xform(Vector3(cox, 2.7, coz), ry))
			inst.add("canopySnow", _box_mesh(Vector3(2.4, 0.12, 1.4)), roof_mat, MeshLib.xform(Vector3(cox, 2.83, coz), ry), false)
			var lx := ex if along_x else ex + entrance_side * 0.25
			var lz := ez + entrance_side * 0.25 if along_x else ez
			var sph := SphereMesh.new()
			sph.radius = 0.12
			sph.height = 0.24
			var lamp_mat := StandardMaterial3D.new()
			lamp_mat.albedo_color = Color(1, 0.83, 0.54)
			lamp_mat.emission_enabled = true
			lamp_mat.emission = Color(1, 0.83, 0.54)
			lamp_mat.emission_energy_multiplier = 3.0
			inst.add("doorLamp", sph, lamp_mat, MeshLib.xform(Vector3(lx, 2.5, lz)), false)
			_glow(ex if along_x else ex + entrance_side * 0.3, 2.5, ez + entrance_side * 0.3 if along_x else ez, 1.6, Color(1, 0.75, 0.44))
			_pool(ex if along_x else ex + entrance_side * 1.5, ez + entrance_side * 1.5 if along_x else ez, 3.5, Color(1, 0.69, 0.38))
	return h

# ---------- the district ----------
func _ground() -> void:
	var size := HALF * 2 + 400
	var pm := PlaneMesh.new()
	pm.size = Vector2(size, size)
	var g := _mesh(pm, _pbr("snow_01", Vector2(size / 2.2, size / 2.2), {"roughness": 0.9, "color": Color(0.949, 0.961, 0.98)}), Vector3.ZERO, 0, false)
	g.name = "Ground"
	# Distant skyline so the world doesn't end in a void.
	var far := ShaderMaterial.new()
	far.shader = Shaders.get_shader("skyline")
	var r := MeshLib.rng(7)
	for k in range(70):
		var a := TAU * k / 70
		var dist: float = HALF + 90 + r.call() * 80
		var w: float = 20 + r.call() * 30
		var h: float = 20 + r.call() * 40
		var m := _mesh(_box_mesh(Vector3(w, h, 14)), far, Vector3(cos(a) * dist, h / 2, sin(a) * dist), 0, false)
		m.look_at(Vector3(0, h / 2, 0))
	# Invisible walls at the district edge.
	var e := HALF + 6
	_add_box(-e - 5, -e, -e - 5, e + 5, 30)
	_add_box(e, e + 5, -e - 5, e + 5, 30)
	_add_box(-e - 5, e + 5, -e - 5, -e, 30)
	_add_box(-e - 5, e + 5, e, e + 5, 30)
	# Ground collision: one big slab under everything.
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(size, 2, size)
	cs.shape = shape
	cs.position.y = -1
	colliders.add_child(cs)

func _roads() -> void:
	var len := N * PITCH + ROAD
	var asphalt := _pbr("asphalt_snow", Vector2((ROAD - SIDEWALK * 2) / 4, len / 4), {"roughness": 0.72})
	var sw_mat := _pbr("concrete_pavement", Vector2(SIDEWALK / 2, len / 2))
	for k in range(N + 1):
		var c := -HALF + k * PITCH
		for vertical in [true, false]:
			var pm := PlaneMesh.new()
			pm.size = Vector2(ROAD - SIDEWALK * 2, len)
			var road := _mesh(pm, asphalt, Vector3(c if vertical else 0.0, 0.02 if vertical else 0.025, 0.0 if vertical else c), 0.0 if vertical else PI / 2, false)
			road.name = "road"
			for s in [-1, 1]:
				var off: float = c + s * (ROAD / 2 - SIDEWALK / 2)
				var bm := _box_mesh(Vector3(SIDEWALK, 0.14, len))
				if vertical:
					_mesh(bm, sw_mat, Vector3(off, 0.07, 0), 0, false)
				else:
					_mesh(bm, sw_mat, Vector3(0, 0.071, off), PI / 2, false)
	# Snowbanks pushed to the kerbs by the ploughs.
	var bank := SphereMesh.new()
	bank.radius = 1
	bank.height = 2
	bank.radial_segments = 8
	bank.rings = 5
	var bank_mat := _pbr("snow_01", Vector2(1, 1), {"color": Color(0.94, 0.953, 0.973)})
	for k in range(N + 1):
		var c := -HALF + k * PITCH
		var s := -HALF
		while s < HALF:
			s += 5 + rnd.call() * 8
			if absf(fmod(s + HALF, PITCH)) < ROAD:
				continue
			var side := -1 if rnd.call() < 0.5 else 1
			var o := c + side * (ROAD / 2 - SIDEWALK - 0.6)
			var sx: float = 0.8 + rnd.call() * 0.6
			var sl: float = 1.5 + rnd.call() * 2.5
			if rnd.call() < 0.5:
				inst.add("bank", bank, bank_mat, MeshLib.xform(Vector3(o, 0, s), 0, Vector3(sx, 0.45, sl)), false)
			else:
				inst.add("bank", bank, bank_mat, MeshLib.xform(Vector3(s, 0, o), 0, Vector3(sl, 0.45, sx)), false)

func _bus_stops() -> void:
	for k in range(1, N):
		for seg in range(N):
			if rnd.call() < 0.6:
				continue
			var vertical: bool = rnd.call() < 0.5
			var side := 1 if rnd.call() < 0.5 else -1
			var along: float = -HALF + seg * PITCH + PITCH / 2 + (rnd.call() - 0.5) * 16
			var off: float = -HALF + k * PITCH + side * (ROAD / 2 - SIDEWALK / 2 + 0.3)
			var x := off if vertical else along
			var z := along if vertical else off
			var ry: float = (-PI / 2 if side > 0 else PI / 2) if vertical else (PI if side > 0 else 0.0)
			props.add("bus_stop", Vector3(x, 0.14, z), ry, 1)
			var lx := 0.9 if vertical else 1.9
			var lz := 1.9 if vertical else 0.9
			_add_box(x - lx, x + lx, z - lz, z + lz, 2.6)
			if rnd.call() < 0.5:
				var ka := along + 4.6
				var kx := off + side * 0.2 if vertical else ka
				var kz := ka if vertical else off + side * 0.2
				props.add("kiosk", Vector3(kx, 0.14, kz), ry, 0.85)
				_add_box(kx - 1.3, kx + 1.3, kz - 1.3, kz + 1.3, 2.6)

func _lights() -> void:
	for k in range(N + 1):
		var c := -HALF + k * PITCH
		var s := -HALF + 12
		while s < HALF:
			for vertical in [true, false]:
				var side := 1 if (floori(s / 26) + k) % 2 != 0 else -1
				var o := c + side * (ROAD / 2 - 0.7)
				var x := o if vertical else s
				var z := s if vertical else o
				# Local -Z of the lamp model points from the pole out over the road.
				var lr: float = side * PI / 2 if vertical else (0.0 if side > 0 else PI)
				props.add("sov_lamp", Vector3(x, 0, z), lr, 1)
				var hx := x - sin(lr) * 5.3
				var hz := z - cos(lr) * 5.3
				lamp_spots.append(Vector3(hx, 6.3, hz))
				_glow(hx, 6.45, hz, 3, Color(1, 0.63, 0.25))
				_pool(hx, hz, 7, Color(1, 0.6, 0.25))
				_add_box(x - 0.15, x + 0.15, z - 0.15, z + 0.15, 7.5)
			s += 26

func _tree(x: float, z: float, birch: bool) -> void:
	var kind := ("birch" if rnd.call() < 0.55 else "poplar") if birch else "spruce"
	trees.add(kind, x, z, 0.85 + rnd.call() * 0.35, rnd.call() * 6.28, floori(rnd.call() * 3))
	var rad := 0.6 if kind == "spruce" else 0.3
	_add_box(x - rad, x + rad, z - rad, z + rad, 8)

func _bench(x: float, z: float, ry: float) -> void:
	props.add("sov_bench", Vector3(x, 0, z), ry + PI / 2, 1)
	props.add("sov_bin", Vector3(x + cos(ry) * 1.4, 0, z - sin(ry) * 1.4), 0, 0.75)
	_add_box(x - 0.9, x + 0.9, z - 0.9, z + 0.9, 0.9)

func _dress_yard(cx: float, cz: float, layout: int) -> void:
	var bx := cx + 18
	var bz := cz + 2
	if grid.is_free(bx, bz, 2):
		props.add("metal_trash_can", Vector3(bx, 0, bz), PI, 1)
		props.add("trashbag", Vector3(bx - 1.6, 0, bz + 0.6), rnd.call() * 6, 1.1)
		props.add("trashbag", Vector3(bx + 1.4, 0, bz + 0.8), rnd.call() * 6, 0.9)
		_add_box(bx - 1, bx + 1, bz - 0.4, bz + 0.4, 1)
	var car_z := cz - 9 if layout == 0 else cz - 14
	for k in range(3):
		var x: float = cx - 20 + k * 6 + rnd.call() * 2
		if not grid.is_free(x, car_z, 2.5) or rnd.call() < 0.25:
			continue
		props.add("covered_car", Vector3(x, 0, car_z), PI / 2 + (rnd.call() - 0.5) * 0.15, 1)
		_add_box(x - 2.2, x + 2.2, car_z - 0.95, car_z + 0.95, 1.4)
	for k in range(4):
		var x: float = cx + (rnd.call() * 52 - 26)
		var z: float = cz + (rnd.call() * 52 - 26)
		if not grid.is_free(x, z, 1.2):
			continue
		var what: String = ["old_tyre", "old_tyre", "wooden_crate_01", "trashbag", "dead_tree_trunk", "utility_box_01"][floori(rnd.call() * 6)]
		props.add(what, Vector3(x, 0.08 if what == "old_tyre" else 0.0, z), rnd.call() * 6, 1.2 if what == "dead_tree_trunk" else 1.0)
		if what == "utility_box_01" or what == "wooden_crate_01":
			_add_box(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 1)

func _playground(x: float, z: float) -> void:
	props.add("rocket", Vector3(x + 1, 0, z), 0.0 if rnd.call() < 0.5 else PI, 1)
	_add_box(x - 2.6, x + 4.6, z - 0.9, z + 0.9, 4.7)
	props.add("seesaw", Vector3(x - 1, 0, z + 4), PI / 2 * roundf(rnd.call()), 1)
	_add_box(x - 2.6, x + 0.6, z + 3.4, z + 4.6, 1.8)
	var ball := SphereMesh.new()
	ball.radius = 1
	ball.height = 2
	ball.radial_segments = 10
	ball.rings = 8
	inst.add("snowman", ball, roof_mat, MeshLib.xform(Vector3(x - 4, 0.45, z + 1), 0, Vector3(0.55, 0.5, 0.55)))
	inst.add("snowman", ball, roof_mat, MeshLib.xform(Vector3(x - 4, 1.15, z + 1), 0, Vector3(0.4, 0.38, 0.4)))
	inst.add("snowman", ball, roof_mat, MeshLib.xform(Vector3(x - 4, 1.65, z + 1), 0, Vector3(0.27, 0.27, 0.27)))
	var carrot := CylinderMesh.new()
	carrot.top_radius = 0.0
	carrot.bottom_radius = 0.04
	carrot.height = 0.25
	carrot.radial_segments = 5
	inst.add("carrot", carrot, _std(Color(0.878, 0.416, 0.102)), MeshLib.xform(Vector3(x - 4, 1.65, z + 1.32), 0, Vector3.ONE, PI / 2), false)

func _garages(x0: float, z0: float, count: int, along_x: bool, face_dir: int) -> void:
	var len := count * 3.5
	var n := maxi(1, roundi(len / 16.56))
	var PL := 16.56
	var PD := 7.12
	for k in range(n):
		var t := -1.75 + PL * (k + 0.5)
		var x := x0 + t if along_x else x0
		var z := z0 if along_x else z0 + t
		var ry: float = (PI / 2 if along_x else 0.0) + (0.0 if face_dir > 0 else PI)
		props.add("garages", Vector3(x, 0, z), ry, 1)
	var span := n * PL
	if along_x:
		_add_box(x0 - 1.75, x0 - 1.75 + span, z0 - PD / 2, z0 + PD / 2, 2.8)
	else:
		_add_box(x0 - PD / 2, x0 + PD / 2, z0 - 1.75, z0 - 1.75 + span, 2.8)

func _block(i: int, j: int) -> void:
	var c := block_center(i, j)
	var cx := c.x
	var cz := c.y
	var zone := zone_of_block(i, j)
	var H := BLOCK / 2
	match "%d,%d" % [i, j]:
		"2,3":
			_universam(cx, cz)
			return
		"1,4":
			_rink(cx, cz)
			return
		"4,3":
			_video_salon(cx, cz)
			return
		"1,2":
			_school(cx, cz)
			return
		"3,1":
			_market(cx, cz)
			return
		"5,5":
			_garage_block(cx, cz, zone)
			return
		"0,3":
			_gym(cx, cz)
			return
	var layout := floori(rnd.call() * 3)
	var fac := 0
	if layout == 0:
		var floors := 9 if rnd.call() < 0.5 else 5
		_building(cx, cz - H + 9, 56, 13, floors, fac, 1)
		_building(cx, cz + H - 9, 56, 13, floors, fac + 1, -1)
	elif layout == 1:
		_building(cx, cz - H + 8, 52, 12, 5, fac, 1)
		_building(cx - H + 8, cz + 6, 12, 36, 5, fac, 1)
		_building(cx + H - 8, cz + 6, 12, 36, 5, fac + 2, -1)
	else:
		var fl := 12 + floori(rnd.call() * 5)
		_building(cx - 16, cz - 16, 18, 18, fl, 3, 1)
		_building(cx + 16, cz + 14, 18, 18, fl, 0, -1)
		_building(cx + 14, cz - 18, 24, 12, 5, 2, 1)
	_playground(cx - 6 + rnd.call() * 4, cz + (14 if layout == 1 else 0))
	_bench(cx + 8, cz - 4, PI)
	_bench(cx - 12, cz + 6, 0)
	for t in range(9):
		var x: float = cx + (rnd.call() * (BLOCK - 6) - H + 3)
		var z: float = cz + (rnd.call() * (BLOCK - 6) - H + 3)
		if not grid.is_free(x, z, 2):
			continue
		_tree(x, z, rnd.call() < 0.6)
	_dress_yard(cx, cz, layout)
	hangouts.append({"x": cx + 2, "z": cz + (0 if layout == 1 else 8), "zone": zone})

func _universam(cx: float, cz: float) -> void:
	var w := 46.0
	var d := 22.0
	var h := 7.0
	var wall := _std(Color(0.784, 0.765, 0.722), 0.9)
	var body := _mesh(_box_mesh(Vector3(w, h, d)), wall, Vector3(cx, h / 2, cz - 8))
	body.name = "universam"
	# Glass shopfront along the south face.
	var glass := ShaderMaterial.new()
	glass.shader = Shaders.get_shader("shopfront")
	glass.set_shader_parameter("repeat_x", w / 9.2)
	var qm := QuadMesh.new()
	qm.size = Vector2(w - 0.4, h - 1.8)
	_mesh(qm, glass, Vector3(cx, (h - 1.8) / 2, cz - 8 + d / 2 + 0.03), 0, false)
	_mesh(_box_mesh(Vector3(w + 0.4, 1.6, 0.6)), wall, Vector3(cx, h - 0.8, cz - 8 + d / 2))
	_add_box(cx - w / 2, cx + w / 2, cz - 8 - d / 2, cz - 8 + d / 2, h)
	_sign("УНИВЕРСАМ", cx, h + 1.6, cz - 8 + d / 2 - 1, 22, 3.2, 0, Color("#ff3b30"))
	_pool(cx, cz + 5, 9, Color(1, 0.19, 0.125))
	_pool(cx - 14, cz + 5, 6, Color(0.416, 0.565, 0.816))
	_pool(cx + 14, cz + 5, 6, Color(0.416, 0.565, 0.816))
	props.add("kiosk", Vector3(cx + 24, 0, cz + 20), 0, 1)
	props.add("kvass", Vector3(cx - 22, 0, cz + 19), 0.3, 1)
	_add_box(cx - 24, cx - 20, cz + 18, cz + 20, 2.1)
	_add_box(cx + 22.5, cx + 25.5, cz + 18.8, cz + 21.2, 2.6)
	_sign("СОЮЗПЕЧАТЬ", cx + 24, 2.9, cz + 21.3, 3, 0.55, 0, Color.WHITE, Color("#1a4f99"))
	for k in range(6):
		_tree(cx - 28 + k * 11, cz + 28, true)
	landmarks.append({"name": "Универсам", "x": cx, "z": cz + 6})
	spawn = {"x": cx + 4, "z": cz + 10, "heading": 0.0}
	hangouts.append({"x": cx - 12, "z": cz + 10, "zone": "universam"})

func _rink(cx: float, cz: float) -> void:
	var ice := ShaderMaterial.new()
	ice.shader = Shaders.get_shader("ice")
	var pm := PlaneMesh.new()
	pm.size = Vector2(44, 26)
	_mesh(pm, ice, Vector3(cx, 0.05, cz), 0, false)
	var board := _std(Color(0.91, 0.91, 0.91), 0.6)
	var blue := _std(Color(0.157, 0.337, 0.659), 0.6)
	for seg in [[cx, cz - 13, 44, 0.2], [cx - 12, cz + 13, 20, 0.2], [cx + 12, cz + 13, 20, 0.2], [cx - 22, cz, 0.2, 26], [cx + 22, cz, 0.2, 26]]:
		var x: float = seg[0]
		var z: float = seg[1]
		var w: float = seg[2]
		var d: float = seg[3]
		_mesh(_box_mesh(Vector3(w, 1.1, d)), board, Vector3(x, 0.55, z))
		_mesh(_box_mesh(Vector3(w + 0.02, 0.2, d + 0.02)), blue, Vector3(x, 0.95, z), 0, false)
		_add_box(x - w / 2 - 0.1, x + w / 2 + 0.1, z - d / 2 - 0.1, z + d / 2 + 0.1, 1.1)
	for k in range(-2, 3):
		for q in [-1, 1]:
			_glow(cx + k * 10, 6, cz + q * 9, 3, Color(1, 0.416, 0.835) if k % 2 != 0 else Color(0.416, 0.835, 1))
	_pool(cx, cz, 18, Color(0.5, 0.565, 1))
	_sign("КАТОК", cx, 4, cz + 16, 8, 1.6, 0, Color("#7fd4ff"))
	for s in [-1, 1]:
		_mesh(_cyl(0.12, 4.8), board, Vector3(cx + s * 4.2, 2.4, cz + 16))
	for k in range(10):
		_tree(cx - 28 + (k % 5) * 14, cz + (-26 if k < 5 else 26), k % 3 != 0)
	landmarks.append({"name": "Каток", "x": cx, "z": cz})
	hangouts.append({"x": cx + 26, "z": cz + 6, "zone": "universam"})

func _video_salon(cx: float, cz: float) -> void:
	_building(cx, cz - 18, 56, 13, 9, 1, 1)
	_mesh(_box_mesh(Vector3(12, 4, 9)), _std(Color(0.353, 0.314, 0.282), 0.9), Vector3(cx + 8, 2, cz + 12))
	_add_box(cx + 2, cx + 14, cz + 7.5, cz + 16.5, 4)
	_sign("ВИДЕОСАЛОН", cx + 8, 4.9, cz + 16.6, 9, 1.4, 0, Color("#ffe24a"))
	_sign("ВИДЕО", cx + 14.1, 2.2, cz + 12, 3, 0.8, PI / 2, Color("#ff5af0"))
	_pool(cx + 8, cz + 19, 6, Color(1, 0.816, 0.25))
	_garages(cx - 26, cz + 24, 8, true, -1)
	for t in range(6):
		_tree(cx - 20 + t * 5, cz + 4, true)
	landmarks.append({"name": "Видеосалон", "x": cx + 8, "z": cz + 20})
	hangouts.append({"x": cx + 6, "z": cz + 21, "zone": "razezd"})
	hangouts.append({"x": cx - 12, "z": cz + 17, "zone": "razezd"})

func _school(cx: float, cz: float) -> void:
	_building(cx, cz - 6, 54, 14, 3, 4, 1)
	_building(cx - 20, cz + 12, 14, 22, 3, 4, 0)
	_sign("ШКОЛА № 42", cx, 9.6, cz + 1.05, 10, 1.3, 0, Color.WHITE, Color("#1d3d7a"))
	var fence := _std(Color(0.176, 0.208, 0.251), 0.5, 0.5)
	inst.add("fence", _box_mesh(Vector3(60, 1.4, 0.08)), fence, MeshLib.xform(Vector3(cx, 0.7, cz + 30)), false)
	_add_box(cx - 30, cx - 3, cz + 29.8, cz + 30.2, 1.4)
	_add_box(cx + 3, cx + 30, cz + 29.8, cz + 30.2, 1.4)
	for t in range(8):
		_tree(cx - 2 + (t % 4) * 7, cz + 14 + floori(t / 4) * 8, true)
	landmarks.append({"name": "Школа", "x": cx, "z": cz + 6})
	hangouts.append({"x": cx + 22, "z": cz + 22, "zone": "universam"})

func _market(cx: float, cz: float) -> void:
	var cols := [Color("#c23a2a"), Color("#2a7ac2"), Color("#e0b030"), Color("#3aa055")]
	var stall_body := _box_mesh(Vector3(5, 1.1, 2.2))
	var stall_roof := _box_mesh(Vector3(5.6, 0.12, 3))
	var post := _cyl(0.05, 2.3, 4)
	for row in range(3):
		for k in range(6):
			var x := cx - 22 + k * 8.8
			var z := cz - 14 + row * 12
			var c: Color = cols[(row + k) % cols.size()]
			inst.add("stallBody", stall_body, _std(Color(0.42, 0.29, 0.188)), MeshLib.xform(Vector3(x, 0.55, z)))
			inst.add("stallRoof" + c.to_html(), stall_roof, _std(c, 0.8), MeshLib.xform(Vector3(x, 2.4, z), 0, Vector3.ONE, 0.15))
			inst.add("stallSnow", stall_roof, roof_mat, MeshLib.xform(Vector3(x, 2.52, z), 0, Vector3.ONE, 0.15), false)
			for s in [-1, 1]:
				inst.add("stallPost", post, _std(Color(0.267, 0.267, 0.267)), MeshLib.xform(Vector3(x + s * 2.6, 1.15, z + 1.3)))
			_add_box(x - 2.5, x + 2.5, z - 1.1, z + 1.1, 1.1)
	_sign("РЫНОК", cx, 5, cz - 26, 8, 1.6, 0, Color.WHITE, Color("#7a1d1d"))
	props.add("kvass", Vector3(cx + 26, 0, cz - 20), -0.4, 1)
	_add_box(cx + 24, cx + 28, cz - 21, cz - 19, 2.1)
	for s in [-1, 1]:
		_mesh(_cyl(0.15, 5.8), _std(Color(0.333, 0.333, 0.333)), Vector3(cx + s * 4.2, 2.9, cz - 26.2))
	for k in range(-2, 3):
		_glow(cx + k * 10, 4, cz - 2, 2.5, Color(1, 0.816, 0.5))
	_building(cx, cz + H_MARKET, 50, 10, 2, 2, -1)
	landmarks.append({"name": "Рынок", "x": cx, "z": cz})
	hangouts.append({"x": cx + 26, "z": cz - 4, "zone": "hadi"})
	hangouts.append({"x": cx - 26, "z": cz + 6, "zone": "hadi"})

func _garage_block(cx: float, cz: float, zone: String) -> void:
	for row in range(3):
		_garages(cx - 26, cz - 22 + row * 18, 15, true, -1 if row % 2 != 0 else 1)
	landmarks.append({"name": "Гаражи", "x": cx, "z": cz})
	hangouts.append({"x": cx, "z": cz - 13, "zone": zone})
	hangouts.append({"x": cx + 5, "z": cz + 14, "zone": zone})
	for t in range(6):
		_tree(cx + 30, cz - 25 + t * 10, false)

func _gym(cx: float, cz: float) -> void:
	_building(cx, cz - 16, 52, 13, 5, 2, 1)
	_mesh(_box_mesh(Vector3(14, 3.6, 10)), _std(Color(0.541, 0.29, 0.227), 0.95), Vector3(cx + 6, 1.8, cz + 12))
	_add_box(cx - 1, cx + 13, cz + 7, cz + 17, 3.6)
	_sign("КАЧАЛКА", cx + 6, 4.3, cz + 17.1, 6, 1.1, 0, Color("#ff8a3a"))
	_pool(cx + 6, cz + 19, 5, Color(1, 0.541, 0.227))
	_playground(cx - 14, cz + 14)
	for t in range(5):
		_tree(cx - 26 + t * 6, cz + 26, false)
	landmarks.append({"name": "Качалка", "x": cx + 6, "z": cz + 19})
	hangouts.append({"x": cx + 6, "z": cz + 21, "zone": "universam"})

func _walk_graph() -> void:
	var id := func(i: int, j: int, c: int) -> int:
		return (j * N + i) * 4 + c
	var inset := BLOCK / 2 + SIDEWALK * 0.5 + 0.4
	for j in range(N):
		for i in range(N):
			var c := block_center(i, j)
			for p in [[-1, -1], [1, -1], [1, 1], [-1, 1]]:
				walk_nodes.append({"x": c.x + p[0] * inset, "z": c.y + p[1] * inset, "next": []})
	for j in range(N):
		for i in range(N):
			for c in range(4):
				var n: Dictionary = walk_nodes[id.call(i, j, c)]
				n.next.append(id.call(i, j, (c + 1) % 4))
				n.next.append(id.call(i, j, (c + 3) % 4))
			if i + 1 < N:
				walk_nodes[id.call(i, j, 1)].next.append(id.call(i + 1, j, 0))
				walk_nodes[id.call(i + 1, j, 0)].next.append(id.call(i, j, 1))
				walk_nodes[id.call(i, j, 2)].next.append(id.call(i + 1, j, 3))
				walk_nodes[id.call(i + 1, j, 3)].next.append(id.call(i, j, 2))
			if j + 1 < N:
				walk_nodes[id.call(i, j, 3)].next.append(id.call(i, j + 1, 0))
				walk_nodes[id.call(i, j + 1, 0)].next.append(id.call(i, j, 3))
				walk_nodes[id.call(i, j, 2)].next.append(id.call(i, j + 1, 1))
				walk_nodes[id.call(i, j + 1, 1)].next.append(id.call(i, j, 2))

func random_walk_node() -> int:
	return randi() % walk_nodes.size()

func pick_hangout(zone: String) -> Dictionary:
	var list := hangouts.filter(func(h): return h.zone == zone)
	return list[randi() % list.size()]

func update(t: float) -> void:
	facade_kit.update(t)
