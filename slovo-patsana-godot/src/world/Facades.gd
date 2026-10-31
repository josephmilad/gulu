class_name Facades
## Real 3D facades for the panel blocks and khrushchevkas (port of world/Facades.ts):
## walls with true-scale brick/plaster, seams and grime; recessed windows with sashes,
## sills and snow; interior-mapped glass; balconies; roof machine rooms, antennas,
## drainpipes. Everything repeated goes through one MultiMesh per part.

const FLOOR_H := 2.8
const PLINTH := 0.9

var batch := MeshLib.Batcher.new()
var window_mat: ShaderMaterial
var wall_mats := {}
var roof_mat: StandardMaterial3D
var mats := {}
var geos := {}

func _init() -> void:
	window_mat = ShaderMaterial.new()
	window_mat.shader = Shaders.get_shader("window")
	wall_mats = {
		"panel": _wall("plastered_wall", 2.0, Color(0.788, 0.769, 0.722), true),
		"panelBlue": _wall("plastered_wall", 2.0, Color(0.702, 0.753, 0.8), true),
		"panelBeige": _wall("plastered_wall", 2.0, Color(0.847, 0.784, 0.659), true),
		"brick": _wall("red_brick", 1.4, Color(1, 1, 1), false),
	}
	roof_mat = _std(Color(0.91, 0.93, 0.95), 0.85)
	mats = {
		"surround": _std(Color(0.722, 0.698, 0.651), 0.9),
		"sash": _std(Color(0.91, 0.894, 0.855), 0.6),
		"sill": _std(Color(0.549, 0.561, 0.58), 0.5, 0.4),
		"snow": _std(Color(0.949, 0.961, 0.98), 0.8),
		"concrete": _std(Color(0.659, 0.643, 0.604), 0.9),
		"rail": _std(Color(0.369, 0.416, 0.388), 0.55, 0.5),
		"railAlt": _std(Color(0.478, 0.29, 0.204), 0.7),
		"glazing": _std(Color(0.1, 0.133, 0.173), 0.08, 0.2),
		"wood": _std(Color(0.851, 0.824, 0.753), 0.6),
		"metal": _std(Color(0.333, 0.349, 0.369), 0.5, 0.7),
		"dark": _std(Color(0.106, 0.11, 0.122), 0.6, 0.5),
	}
	var pane := QuadMesh.new()
	pane.size = Vector2(1, 1)
	var box := BoxMesh.new()
	var pipe := CylinderMesh.new()
	pipe.top_radius = 0.06
	pipe.bottom_radius = 0.06
	pipe.height = 1
	pipe.radial_segments = 6
	geos = {
		"pane": pane,
		"surround": _surround(),
		"sash": _sash(),
		"sill": MeshLib.open_box(1, 0.05, 0.28),
		"snow": MeshLib.open_box(1, 0.06, 0.22, "front top left right"),
		"slab": MeshLib.open_box(1, 1, 1),
		"box": box,
		"pipe": pipe,
		"antenna": _antenna(),
	}

static func _std(c: Color, rough := 0.9, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

## PBR wall with world-scale UVs (metres), grime toward the ground, optional seams.
func _wall(tex: String, tex_meters: float, tint: Color, seams: bool) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = Shaders.get_shader("wall")
	m.set_shader_parameter("albedo_tex", load(Assets.p("tex/%s_diff.jpg" % tex)))
	m.set_shader_parameter("normal_tex", load(Assets.p("tex/%s_nor.jpg" % tex)))
	var rp := Assets.p("tex/%s_rough.jpg" % tex)
	if ResourceLoader.exists(rp):
		m.set_shader_parameter("rough_tex", load(rp))
	m.set_shader_parameter("tint", Vector3(tint.r, tint.g, tint.b))
	m.set_shader_parameter("tex_meters", tex_meters)
	m.set_shader_parameter("seams", seams)
	return m

func _surround() -> ArrayMesh:
	var t := 0.11
	var dep := 0.2
	return MeshLib.merged([
		MeshLib.open_box_quads(1 + t * 2, t, dep, "front top bottom left right", Vector3(0, 0.5 + t / 2, dep / 2)),
		MeshLib.open_box_quads(1 + t * 2, t, dep, "front top bottom left right", Vector3(0, -0.5 - t / 2, dep / 2)),
		MeshLib.open_box_quads(t, 1, dep, "front left right", Vector3(-0.5 - t / 2, 0, dep / 2)),
		MeshLib.open_box_quads(t, 1, dep, "front left right", Vector3(0.5 + t / 2, 0, dep / 2)),
	])

func _sash() -> ArrayMesh:
	var b := 0.05
	var dep := 0.06
	var f := "front top bottom left right"
	return MeshLib.merged([
		MeshLib.open_box_quads(b, 1, dep, f, Vector3(0, 0, 0.04)),
		MeshLib.open_box_quads(1, b, dep, f, Vector3(0, 0.22, 0.04)),
		MeshLib.open_box_quads(b, 0.28, dep, f, Vector3(0.25, 0.36, 0.04)),
		MeshLib.open_box_quads(1, b, dep, f, Vector3(0, -0.48, 0.04)),
		MeshLib.open_box_quads(1, b, dep, f, Vector3(0, 0.48, 0.04)),
		MeshLib.open_box_quads(b, 1, dep, f, Vector3(-0.48, 0, 0.04)),
		MeshLib.open_box_quads(b, 1, dep, f, Vector3(0.48, 0, 0.04)),
	])

func _antenna() -> ArrayMesh:
	var f := "front back top bottom left right"
	var parts := [MeshLib.open_box_quads(0.04, 2.6, 0.04, f, Vector3(0, 1.3, 0)), MeshLib.open_box_quads(0.02, 0.02, 1.2, f, Vector3(0, 2.2, 0))]
	var i := 0
	for l in [0.6, 0.9, 1.2]:
		parts.append(MeshLib.open_box_quads(l, 0.02, 0.02, f, Vector3(0, 1.9 + i * 0.25, 0)))
		i += 1
	return MeshLib.merged(parts)

func _add(key: String, geo: Mesh, mat: Material, pos: Vector3, ry: float, s := Vector3.ONE, shadow := false, seed := -1.0) -> void:
	batch.add(key, geo, mat, MeshLib.xform(pos, ry, s), shadow, seed)

## b: {cx, cz, w, d, floors, style, entrance (0/1/-1), seed}
func _faces(b: Dictionary) -> Array:
	var out := []
	var cell := 3.0 if b.style == "brick" else 3.2
	for nn in [[0, 1], [0, -1], [1, 0], [-1, 0]]:
		var n := Vector3(nn[0], 0, nn[1])
		var t := Vector3.UP.cross(n)
		var len: float = b.w if nn[0] == 0 else b.d
		var half: float = b.d / 2 if nn[0] == 0 else b.w / 2
		var start := Vector3(b.cx + n.x * half - t.x * len / 2, 0, b.cz + n.z * half - t.z * len / 2)
		var cols := maxi(1, floori(len / cell))
		var margin := (len - cols * cell) / 2
		var long_x: bool = b.w >= b.d
		var is_long: bool = (nn[0] == 0) if long_x else (nn[1] == 0)
		var side: int = nn[1] if long_x else nn[0]
		out.append({"n": n, "t": t, "start": start, "len": len, "long": is_long, "side": side, "margin": margin, "cols": cols, "cell": cell})
	return out

## The wall shell: four sides (UVs in metres, aligned to the window grid) + roof.
func _shell(b: Dictionary, h: float, parent: Node3D) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for f in _faces(b):
		var p0: Vector3 = f.start
		var t: Vector3 = f.t
		var n: Vector3 = f.n
		var corners := [Vector2(0, 0), Vector2(f.len, 0), Vector2(f.len, h), Vector2(0, h)]
		for i in [0, 2, 1, 0, 3, 2]:
			var c: Vector2 = corners[i]
			st.set_normal(n)
			st.set_uv(Vector2(c.x - f.margin, c.y - PLINTH))
			st.add_vertex(Vector3(p0.x + t.x * c.x, c.y, p0.z + t.z * c.x))
	st.generate_tangents()
	var wall := MeshInstance3D.new()
	wall.mesh = st.commit()
	wall.material_override = wall_mats[b.style]
	parent.add_child(wall)
	var roof := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(b.w, b.d)
	roof.mesh = pm
	roof.material_override = roof_mat
	roof.position = Vector3(b.cx, h, b.cz)
	parent.add_child(roof)

func add_building(b: Dictionary, parent: Node3D) -> float:
	var r := MeshLib.rng(b.seed)
	var h: float = b.floors * FLOOR_H + PLINTH + 0.4
	_shell(b, h, parent)
	var brick: bool = b.style == "brick"
	var ww := 1.35 if brick else 1.5
	var wh := 1.45
	for f in _faces(b):
		var ry := atan2(f.n.x, f.n.z)
		var entrance_side: bool = f.long and f.side == b.entrance
		var balcony_side: bool = f.long and b.entrance != 0 and f.side == -b.entrance and not brick
		var end_wall: bool = not f.long
		var n_entr := maxi(1, floori(f.len / 14))
		var entr_cols := []
		for k in range(n_entr):
			var a: float = -f.len / 2 + (f.len / n_entr) * (k + 0.5)
			entr_cols.append(floori((a + f.len / 2 - f.margin) / f.cell))
		for c in range(f.cols):
			if end_wall and c != floori(f.cols / 2) and not brick:
				continue
			var u: float = f.margin + f.cell * (c + 0.5)
			var entr_col: bool = entrance_side and entr_cols.has(c)
			for fl in range(b.floors):
				if entr_col and fl == 0:
					continue
				var y: float = PLINTH + fl * FLOOR_H + (FLOOR_H * 0.95 if entr_col else FLOOR_H * 0.55)
				var base := Vector3(f.start.x + f.t.x * u, y, f.start.z + f.t.z * u)
				var sw: float = ww * 0.6 if (end_wall and not brick) else (ww * 0.7 if entr_col else ww)
				var sh: float = wh * 0.6 if entr_col else wh
				var nrm: Vector3 = f.n
				_add("pane", geos.pane, window_mat, base + nrm * 0.02, ry, Vector3(sw, sh, 1), false, floor(r.call() * 997) / 997)
				_add("surround", geos.surround, mats.surround, base, ry, Vector3(sw, sh, 1))
				_add("sash", geos.sash, mats.sash, base, ry, Vector3(sw, sh, 1))
				var sill := Vector3(base.x + nrm.x * 0.14, y - sh / 2 - 0.08, base.z + nrm.z * 0.14)
				_add("sill", geos.sill, mats.sill, sill, ry, Vector3(sw + 0.2, 1, 1))
				_add("sillSnow", geos.snow, mats.snow, Vector3(sill.x, sill.y + 0.055, sill.z), ry, Vector3(sw + 0.1, 1, 1))
				if balcony_side and fl >= 1 and c % 2 == 1:
					_balcony(base, nrm, f.t, ry, PLINTH + fl * FLOOR_H, f.cell, r)
		if f.long:
			for u in [0.25, f.len - 0.25]:
				var p := Vector3(f.start.x + f.t.x * u + f.n.x * 0.12, h / 2, f.start.z + f.t.z * u + f.n.z * 0.12)
				_add("pipe", geos.pipe, mats.metal, p, 0, Vector3(1, h, 1), true)
		var mid := Vector3(f.start.x + f.t.x * f.len / 2 + f.n.x * 0.06, PLINTH / 2, f.start.z + f.t.z * f.len / 2 + f.n.z * 0.06)
		_add("plinth", geos.slab, mats.concrete, mid, ry, Vector3(f.len + 0.12, PLINTH, 0.12))
	# Roof: parapet, machine rooms over the stairwells, antennas.
	var long_x: bool = b.w >= b.d
	var len: float = b.w if long_x else b.d
	var n_rooms := maxi(1, floori(len / 14))
	for k in range(n_rooms):
		var a: float = -len / 2 + (len / n_rooms) * (k + 0.5)
		var x: float = b.cx + (a if long_x else 0.0)
		var z: float = b.cz + (0.0 if long_x else a)
		if b.floors >= 9:
			_add("machine_" + b.style, geos.box, wall_mats[b.style], Vector3(x, h + 1.2, z), 0.0 if long_x else PI / 2, Vector3(3.4, 2.4, 2.6), true)
		for i in range(2):
			var ox: float = (r.call() - 0.5) * (8.0 if long_x else b.w - 3)
			var oz: float = (r.call() - 0.5) * (b.d - 3 if long_x else 8.0)
			_add("antenna", geos.antenna, mats.dark, Vector3(x + ox, h, z + oz), r.call() * 6, Vector3(1, 0.8 + r.call() * 0.5, 1))
		_add("vent", geos.box, mats.concrete, Vector3(x + (4.0 if long_x else 1.5), h + 0.4, z + (1.5 if long_x else 4.0)), 0, Vector3(0.8, 0.8, 0.8), true)
	for p in [[0, b.d / 2, b.w, 0.25], [0, -b.d / 2, b.w, 0.25], [b.w / 2, 0, 0.25, b.d], [-b.w / 2, 0, 0.25, b.d]]:
		_add("parapet", geos.box, mats.concrete, Vector3(b.cx + p[0], h + 0.25, b.cz + p[1]), 0, Vector3(p[2] + 0.1, 0.5, p[3] + 0.1), true)
		_add("parapetSnow", geos.box, mats.snow, Vector3(b.cx + p[0], h + 0.53, b.cz + p[1]), 0, Vector3(p[2] + 0.1, 0.06, p[3] + 0.05))
	return h

func _balcony(base: Vector3, n: Vector3, t: Vector3, ry: float, floor_y: float, cell: float, r: Callable) -> void:
	var W := cell - 0.3
	var D := 1.15
	var at := func(out: float, y: float, along := 0.0) -> Vector3:
		return Vector3(base.x + n.x * out + t.x * along, y, base.z + n.z * out + t.z * along)
	_add("balSlab", geos.box, mats.concrete, at.call(D / 2, floor_y + 0.07), ry, Vector3(W, 0.14, D), true)
	_add("balSlabSnow", geos.box, mats.snow, at.call(D / 2, floor_y + 0.15), ry, Vector3(W - 0.1, 0.03, D - 0.1))
	var glazed: bool = r.call() < 0.4
	var rail := "rail" if r.call() < 0.7 else "railAlt"
	_add("balFront" + rail, geos.box, mats[rail], at.call(D - 0.03, floor_y + 0.6), ry, Vector3(W, 1.0, 0.05), true)
	for s in [-1, 1]:
		_add("balSide" + rail, geos.box, mats[rail], at.call(D / 2, floor_y + 0.6, s * (W / 2 - 0.03)), ry, Vector3(0.05, 1.0, D), true)
	_add("balRailSnow", geos.box, mats.snow, at.call(D - 0.03, floor_y + 1.12), ry, Vector3(W, 0.05, 0.1))
	if glazed:
		_add("glazing", geos.box, mats.glazing, at.call(D - 0.04, floor_y + 1.75), ry, Vector3(W, 1.25, 0.04))
		for i in range(5):
			_add("glazeFrame", geos.box, mats.wood, at.call(D - 0.02, floor_y + 1.75, -W / 2 + (W / 4) * i), ry, Vector3(0.06, 1.25, 0.06))
		_add("balRoof", geos.box, mats.rail, at.call(D / 2, floor_y + 2.42), ry, Vector3(W + 0.1, 0.05, D + 0.05), true)
		_add("balRoofSnow", geos.box, mats.snow, at.call(D / 2, floor_y + 2.48), ry, Vector3(W, 0.06, D))
	elif r.call() < 0.35:
		_add("junk", geos.box, mats.railAlt, at.call(D - 0.3, floor_y + 0.5, (r.call() - 0.5) * W * 0.6), ry, Vector3(0.5, 0.7, 0.35))

func build(parent: Node3D) -> void:
	batch.build(parent)

func update(t: float) -> void:
	window_mat.set_shader_parameter("t_time", t)
