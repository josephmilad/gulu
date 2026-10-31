class_name MeshLib
## Geometry helpers for the procedural city: quad lists → ArrayMesh, merged part
## kits, tapered limbs, and MultiMesh batching (one draw call per repeated part).

static func rng(seed: int) -> Callable:
	var state := [seed & 0xFFFFFFFF]
	return func() -> float:
		state[0] = (state[0] * 1664525 + 1013904223) & 0xFFFFFFFF
		return float(state[0]) / 4294967296.0

## Each quad: 4 corners, CCW seen from outside. UVs in metres (× uv_scale).
static func quads(list: Array, uv_scale := 1.0) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in list:
		var p0: Vector3 = q[0]
		var p1: Vector3 = q[1]
		var p2: Vector3 = q[2]
		var p3: Vector3 = q[3]
		var n := (p1 - p0).cross(p3 - p0).normalized()
		var lu := p0.distance_to(p1) * uv_scale
		var lv := p0.distance_to(p3) * uv_scale
		var uvs := [Vector2(0, 0), Vector2(lu, 0), Vector2(lu, lv), Vector2(0, lv)]
		var pts := [p0, p1, p2, p3]
		# Godot front faces are clockwise when seen from the front, so wind 0-2-1.
		for i in [0, 2, 1, 0, 3, 2]:
			st.set_normal(n)
			st.set_uv(uvs[i])
			st.add_vertex(pts[i])
	st.generate_tangents()
	return st.commit()

static func V(x: float, y: float, z: float) -> Vector3:
	return Vector3(x, y, z)

## Box made only of the listed faces ("front top bottom left right back").
static func open_box_quads(w: float, h: float, d: float, faces := "front top bottom left right", off := Vector3.ZERO) -> Array:
	var x0 := -w / 2 + off.x
	var x1 := w / 2 + off.x
	var y0 := -h / 2 + off.y
	var y1 := h / 2 + off.y
	var z0 := -d / 2 + off.z
	var z1 := d / 2 + off.z
	var q := []
	if faces.contains("front"):
		q.append([V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)])
	if faces.contains("back"):
		q.append([V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0)])
	if faces.contains("top"):
		q.append([V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0)])
	if faces.contains("bottom"):
		q.append([V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)])
	if faces.contains("left"):
		q.append([V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0)])
	if faces.contains("right"):
		q.append([V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1)])
	return q

static func open_box(w: float, h: float, d: float, faces := "front top bottom left right", off := Vector3.ZERO) -> ArrayMesh:
	return quads(open_box_quads(w, h, d, faces, off))

## Merge several quad lists (already placed) into one mesh.
static func merged(parts: Array) -> ArrayMesh:
	var all := []
	for p in parts:
		all.append_array(p)
	return quads(all)

## Tapered open tube from a to b (bark UVs: around once, along in metres).
static func limb_tris(st: SurfaceTool, a: Vector3, b: Vector3, r0: float, r1: float, sides: int) -> void:
	var dir := (b - a).normalized()
	var up := Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT
	var t := up.cross(dir).normalized()
	var bt := dir.cross(t).normalized()
	var len := a.distance_to(b)
	for i in range(sides):
		var a0 := TAU * i / sides
		var a1 := TAU * (i + 1) / sides
		var n0 := (t * cos(a0) + bt * sin(a0))
		var n1 := (t * cos(a1) + bt * sin(a1))
		var p00 := a + n0 * r0
		var p01 := a + n1 * r0
		var p10 := b + n0 * r1
		var p11 := b + n1 * r1
		var u0 := float(i) / sides
		var u1 := float(i + 1) / sides
		for tri in [[p00, Vector2(u0, 0), n0], [p10, Vector2(u0, len), n0], [p11, Vector2(u1, len), n1], [p00, Vector2(u0, 0), n0], [p11, Vector2(u1, len), n1], [p01, Vector2(u1, 0), n1]]:
			st.set_normal(tri[2])
			st.set_uv(tri[1])
			st.add_vertex(tri[0])

## A transform from position, Y rotation and scale (plus optional X/Z tilt).
static func xform(pos: Vector3, ry := 0.0, s := Vector3.ONE, rx := 0.0, rz := 0.0) -> Transform3D:
	var b := Basis.from_euler(Vector3(rx, ry, rz)).scaled(s)
	return Transform3D(b, pos)

## Collects instance transforms per key and builds MultiMeshInstance3D nodes.
class Batcher:
	var sets := {}
	func add(key: String, mesh: Mesh, mat: Material, t: Transform3D, shadow := true, custom := -1.0) -> void:
		if not sets.has(key):
			sets[key] = {"mesh": mesh, "mat": mat, "t": [], "shadow": shadow, "custom": []}
		var s: Dictionary = sets[key]
		s.t.append(t)
		if custom >= 0:
			s.custom.append(custom)
	func build(parent: Node3D) -> void:
		for key in sets:
			var s: Dictionary = sets[key]
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_custom_data = s.custom.size() > 0
			mm.mesh = s.mesh
			mm.instance_count = s.t.size()
			for i in range(s.t.size()):
				mm.set_instance_transform(i, s.t[i])
				if mm.use_custom_data:
					mm.set_instance_custom_data(i, Color(s.custom[i], 0, 0, 0))
			var mi := MultiMeshInstance3D.new()
			mi.name = key
			mi.multimesh = mm
			if s.mat:
				mi.material_override = s.mat
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if s.shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			parent.add_child(mi)

## Places imported GLB props as MultiMeshes: one per sub-mesh of each prop.
class PropBatcher:
	var placed := {}
	func add(name: String, pos: Vector3, ry := 0.0, scale := 1.0) -> void:
		if not placed.has(name):
			placed[name] = []
		placed[name].append(MeshLib.xform(pos, ry, Vector3.ONE * scale))
	func build(parent: Node3D) -> void:
		for name in placed:
			var path := "res://assets/props/%s.glb" % name
			if not ResourceLoader.exists(path):
				push_warning("prop missing: " + name)
				continue
			var inst: Node3D = (load(path) as PackedScene).instantiate()
			parent.add_child(inst)
			var list: Array = placed[name]
			var k := 0
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				var m := mi as MeshInstance3D
				var local := inst.global_transform.affine_inverse() * m.global_transform
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.mesh = m.mesh
				mm.instance_count = list.size()
				for i in range(list.size()):
					mm.set_instance_transform(i, list[i] * local)
				var out := MultiMeshInstance3D.new()
				out.name = "%s_%d" % [name, k]
				k += 1
				out.multimesh = mm
				# A material override on the instance applies when the GLB set it per instance.
				if m.material_override:
					out.material_override = m.material_override
				out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if name == "water_manhole_cover" else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
				parent.add_child(out)
			inst.queue_free()
