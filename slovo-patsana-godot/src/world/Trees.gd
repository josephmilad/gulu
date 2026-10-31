class_name Trees
## Winter trees (port of world/Trees.ts): bare birches and poplars grown as branching
## tubes with real bark and snow on top, spruces from jagged drooping tiers. Three
## variants of each kind are generated once and instanced.

var variants := {}
var mats := {}
var placed := {"birch": [[], [], []], "poplar": [[], [], []], "spruce": [[], [], []]}

func _init() -> void:
	variants = {
		"birch": [_deciduous(101, false), _deciduous(202, false), _deciduous(303, false)],
		"poplar": [_deciduous(404, true), _deciduous(505, true), _deciduous(606, true)],
		"spruce": [_spruce(707), _spruce(808), _spruce(909)],
	}
	mats = {
		"birch": _snowy("bark_willow", Color(0.94, 0.925, 0.894), Vector2(1, 0.5), 0.75),
		"poplar": _snowy("pine_bark", Color(0.604, 0.584, 0.549), Vector2(1, 0.4), 0.75),
		"spruce": _snowy("", Color(0.114, 0.208, 0.141), Vector2(1, 1), 0.85),
	}

func _snowy(tex: String, tint: Color, rep: Vector2, amount: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = Shaders.get_shader("snowy")
	if tex != "":
		m.set_shader_parameter("albedo_tex", load(Assets.p("tex/%s_diff.jpg" % tex)))
		m.set_shader_parameter("normal_tex", load(Assets.p("tex/%s_nor.jpg" % tex)))
		m.set_shader_parameter("has_tex", true)
	else:
		m.set_shader_parameter("has_tex", false)
	m.set_shader_parameter("tint", Vector3(tint.r, tint.g, tint.b))
	m.set_shader_parameter("uv_rep", rep)
	m.set_shader_parameter("snow_amount", amount)
	return m

func _deciduous(seed: int, poplar: bool) -> ArrayMesh:
	var r := MeshLib.rng(seed)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var height: float = (13 + r.call() * 5) if poplar else (8 + r.call() * 4)
	_branch(st, r, poplar, Vector3(0, -0.2, 0), Vector3.UP, height, 0.32 if poplar else 0.2, 0)
	return st.commit()

## Slightly crooked limb split into kinked segments; children sprout along the way.
func _branch(st: SurfaceTool, r: Callable, poplar: bool, from: Vector3, dir: Vector3, len: float, rad: float, depth: int) -> void:
	var segs := 5 if depth == 0 else 3
	var p := from
	var d := dir
	var rr := rad
	for s in range(segs):
		var step := len / segs
		d = (d + Vector3((r.call() - 0.5) * 0.25, (0.06 if poplar else 0.02) + (r.call() - 0.5) * 0.1, (r.call() - 0.5) * 0.25)).normalized()
		var q := p + d * step
		var rn: float = rad * (1 - float(s + 1) / (segs + 0.6))
		MeshLib.limb_tris(st, p, q, rr, maxf(0.008, rn), 7 if depth == 0 else (5 if depth == 1 else 3))
		if depth < 3:
			var kids := (3 if s >= 1 else 0) if depth == 0 else 2
			for k in range(kids):
				var t: float = r.call()
				var at := p.lerp(q, t)
				var az: float = r.call() * TAU
				var up: float = (0.75 + r.call() * 0.2) if poplar else ((0.35 + r.call() * 0.35) if depth == 0 else (0.2 + r.call() * 0.5))
				var nd := Vector3(cos(az) * (1 - up), up, sin(az) * (1 - up)).normalized()
				if depth > 0:
					nd = nd.lerp(d, 0.35).normalized()
				var nl: float = len * ((0.38 if poplar else 0.45) if depth == 0 else 0.5) * (0.7 + r.call() * 0.5) * (1 - (float(s) / segs) * 0.4)
				_branch(st, r, poplar, at, nd, nl, rn * (0.45 if depth == 0 else 0.55), depth + 1)
		p = q
		rr = rn

func _spruce(seed: int) -> ArrayMesh:
	var r := MeshLib.rng(seed)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var height: float = 6 + r.call() * 4
	MeshLib.limb_tris(st, Vector3.ZERO, Vector3(0, height, 0), 0.22, 0.04, 6)
	var tiers := floori(height / 0.75)
	for i in range(tiers):
		var t := float(i) / tiers
		var y := 0.9 + t * (height - 1.2)
		var rad: float = (1 - t) * (2.2 + r.call() * 0.4) + 0.25
		var rot: float = r.call() * 6
		var apex := Vector3(0, y + 0.3 + 0.625, 0)
		var segs := 11
		var ring := []
		for k in range(segs):
			var a := TAU * k / segs + rot
			var jag: float = 1 + 0.18 * sin(a * 11 + i) + (r.call() - 0.5) * 0.12
			var yy := -0.625 - 0.15 * absf(sin(a * 5.5 + i))
			ring.append(Vector3(cos(a) * rad * jag, y + 0.3 + yy, sin(a) * rad * jag))
		for k in range(segs):
			var p0: Vector3 = ring[k]
			var p1: Vector3 = ring[(k + 1) % segs]
			var n := (p1 - apex).cross(p0 - apex).normalized()
			for v in [[apex, Vector2(0.5, 1)], [p0, Vector2(0, 0)], [p1, Vector2(1, 0)]]:
				st.set_normal(n)
				st.set_uv(v[1])
				st.add_vertex(v[0])
	return st.commit()

func add(kind: String, x: float, z: float, scale: float, rot: float, variant: int) -> void:
	placed[kind][variant % 3].append(MeshLib.xform(Vector3(x, 0, z), rot, Vector3.ONE * scale))

func build(parent: Node3D) -> void:
	for kind in ["birch", "poplar", "spruce"]:
		for v in range(3):
			var all: Array = placed[kind][v]
			var tiles := {}
			for t in all:
				var tk := MeshLib.tile_of(t)
				if not tiles.has(tk):
					tiles[tk] = []
				tiles[tk].append(t)
			for tk in tiles:
				var list: Array = tiles[tk]
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.mesh = variants[kind][v]
				mm.instance_count = list.size()
				for i in range(list.size()):
					mm.set_instance_transform(i, list[i])
				var mi := MultiMeshInstance3D.new()
				mi.name = "%s_%d_%d_%d" % [kind, v, tk.x, tk.y]
				mi.multimesh = mm
				mi.material_override = mats[kind]
				MeshLib.apply_range(mi, kind)
				parent.add_child(mi)
