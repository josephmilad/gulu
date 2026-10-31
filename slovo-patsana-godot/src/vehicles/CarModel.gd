class_name CarModel
## Realistic Soviet cars from Sketchfab (CC-BY): LADA 2107, VAZ-2106 militsiya, GAZ-24
## Volga (also as a taxi), UAZ-469, ZiL-130. Paint is recoloured per car in a shader so
## one model gives a street of different 80s colours. The car faces +Z; y = 0 is the ground.

const KINDS := {
	"zhiguli": {"model": "zhiguli", "paint_hue": 0.61, "wheel_r": 0.3, "lamp_y": 0.66,
		"paints": [[0.0, 0.75, 1.0], [0.61, 0.7, 1.0], [0.08, 0.25, 2.6], [0.13, 0.15, 3.2], [0.33, 0.5, 1.1], [0.11, 0.75, 2.0], [0.95, 0.6, 1.0], [0.55, 0.2, 2.2], [0.0, 0.0, 3.4]]},
	"volga": {"model": "volga", "paint_hue": 0.38, "wheel_r": 0.34, "lamp_y": 0.7,
		"paints": [[0.38, 0.5, 1.0], [0.0, 0.0, 0.35], [0.6, 0.45, 0.9], [0.0, 0.0, 3.0], [0.02, 0.6, 0.8], [0.1, 0.2, 2.4]]},
	"taxi": {"model": "volga", "paint_hue": 0.38, "wheel_r": 0.34, "lamp_y": 0.7, "paints": [[0.13, 0.75, 2.2]]},
	"uaz": {"model": "uaz", "paint_hue": 0.22, "wheel_r": 0.4, "lamp_y": 0.95, "paints": [[0.22, 0.4, 1.0], [0.3, 0.3, 0.9]]},
	"zil": {"model": "zil", "paint_hue": 0.48, "wheel_r": 0.48, "lamp_y": 1.0, "paints": [[0.48, 0.35, 1.0], [0.6, 0.5, 1.0], [0.07, 0.65, 1.3], [0.3, 0.45, 0.9]]},
	"police": {"model": "zhiguli_police", "paint_hue": -1.0, "wheel_r": 0.3, "lamp_y": 0.66, "paints": [[0, 0, 1]]},
}

const PAINT_SHADER := """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap;
uniform bool has_normal = false;
uniform bool has_orm = false;
uniform vec4 albedo_col : source_color = vec4(1.0);
uniform float rough = 0.5;
uniform float metal = 0.0;
uniform float from_hue = 0.6;
uniform vec3 to_hsv = vec3(0.0, 0.75, 1.0);
vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
	vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
	return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
void fragment() {
	vec4 c = texture(albedo_tex, UV) * albedo_col;
	vec3 hsv = rgb2hsv(c.rgb);
	float dh = abs(fract(hsv.x - from_hue + 0.5) - 0.5);
	float paint = smoothstep(0.12, 0.25, hsv.y) * (1.0 - smoothstep(0.07, 0.12, dh));
	vec3 t = hsv2rgb(vec3(to_hsv.x, mix(hsv.y, to_hsv.y, 0.85), clamp(hsv.z * to_hsv.z, 0.0, 0.95)));
	ALBEDO = mix(c.rgb, t, paint);
	float r = rough;
	float m = metal;
	if (has_orm) {
		vec4 orm = texture(orm_tex, UV);
		r *= orm.g;
		m *= orm.b;
	}
	ROUGHNESS = mix(r, 0.25, paint);
	METALLIC = mix(m, 0.35, paint);
	SPECULAR = 0.5;
	if (has_normal) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
	}
}
"""
static var _paint_shader: Shader
static var _scenes := {}
static var _head_mat: StandardMaterial3D
static var _tail_mat: StandardMaterial3D
static var _brake_mat: StandardMaterial3D

static func _emissive(color: Color, emission: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = emission
	m.emission_energy_multiplier = energy
	m.roughness = 0.25
	return m

static func tail_mat() -> StandardMaterial3D:
	if _tail_mat == null:
		_tail_mat = _emissive(Color("#6a0a0a"), Color("#ff1a10"), 0.8)
	return _tail_mat

static func brake_mat() -> StandardMaterial3D:
	if _brake_mat == null:
		_brake_mat = _emissive(Color("#6a0a0a"), Color("#ff1a10"), 4.0)
	return _brake_mat

## Shift the body paint to another colour, leaving chrome, glass and tyres alone.
static func _recolor(src: StandardMaterial3D, from_hue: float, to: Array) -> ShaderMaterial:
	if _paint_shader == null:
		_paint_shader = Shader.new()
		_paint_shader.code = PAINT_SHADER
	var m := ShaderMaterial.new()
	m.shader = _paint_shader
	if src.albedo_texture:
		m.set_shader_parameter("albedo_tex", src.albedo_texture)
	m.set_shader_parameter("albedo_col", src.albedo_color)
	m.set_shader_parameter("rough", src.roughness)
	m.set_shader_parameter("metal", src.metallic)
	if src.normal_enabled and src.normal_texture:
		m.set_shader_parameter("normal_tex", src.normal_texture)
		m.set_shader_parameter("has_normal", true)
	if src.roughness_texture:
		m.set_shader_parameter("orm_tex", src.roughness_texture)
		m.set_shader_parameter("has_orm", true)
	m.set_shader_parameter("from_hue", from_hue)
	m.set_shader_parameter("to_hsv", Vector3(to[0], to[1], to[2]))
	return m

## Returns {root, body, wheels, steer, brake, headlights, beacons, length, width, wheel_r, base_mats}
static func build(kind: String) -> Dictionary:
	var info: Dictionary = KINDS[kind]
	var path := Assets.p("vehicles/%s.glb" % info.model)
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var root := Node3D.new()
	var body := Node3D.new()
	body.name = "body"
	root.add_child(body)
	var car: Node3D = (_scenes[path] as PackedScene).instantiate()
	body.add_child(car)
	var paint: Array = info.paints[randi() % info.paints.size()]
	var cache := {}
	var aabb := AABB()
	var first := true
	# The importer turns some wheel nodes into VehicleWheel3D; swap them for plain nodes.
	for n in car.find_children("*", "VehicleWheel3D", true, false):
		var plain := Node3D.new()
		plain.transform = (n as Node3D).transform
		var parent := n.get_parent()
		parent.add_child(plain)
		for ch in n.get_children():
			n.remove_child(ch)
			plain.add_child(ch)
		var nm := n.name
		parent.remove_child(n)
		n.queue_free()
		plain.name = nm
	for mi in car.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		for i in range(m.mesh.get_surface_count()):
			var src := m.get_active_material(i)
			if src == null:
				continue
			if not cache.has(src):
				var mat: Material
				if info.paint_hue >= 0 and src is StandardMaterial3D:
					mat = _recolor(src, info.paint_hue, paint)
				elif src is StandardMaterial3D:
					var sm := (src as StandardMaterial3D).duplicate() as StandardMaterial3D
					# The militsiya model uses one alpha-blended atlas; draw it opaque so it sorts properly.
					sm.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
					mat = sm
				else:
					mat = src
				cache[src] = mat
			m.set_surface_override_material(i, cache[src])
		var box := m.get_aabb()
		var gt := m.global_transform if m.is_inside_tree() else _local_to(car, m)
		var tb := gt * box
		aabb = tb if first else aabb.merge(tb)
		first = false
	var W := aabb.size.x
	var L := aabb.size.z
	var wheels := []
	var steer := []
	for wn in ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]:
		var w := car.find_child(wn, true, false)
		if w:
			w.rotation_order = EULER_ORDER_YXZ
			wheels.append(w)
			if wn.contains("_F"):
				steer.append(w)
	var headlights := []
	var brake := []
	for sx in [-1, 1]:
		var hl := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.085
		cm.bottom_radius = 0.085
		cm.height = 0.02
		cm.radial_segments = 14
		hl.mesh = cm
		if _head_mat == null:
			_head_mat = _emissive(Color("#fff6e0"), Color("#fff1c8"), 3.0)
		hl.material_override = _head_mat
		hl.position = Vector3(sx * (W / 2 - 0.3), info.lamp_y, aabb.end.z + 0.01)
		hl.rotation_degrees.x = 90
		body.add_child(hl)
		headlights.append(hl)
		var tl := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(0.26, 0.1)
		tl.mesh = qm
		tl.material_override = tail_mat()
		tl.position = Vector3(sx * (W / 2 - 0.25), info.lamp_y + 0.02, aabb.position.z - 0.01)
		tl.rotation.y = PI
		body.add_child(tl)
		brake.append(tl)
	var beacons := []
	if kind == "police":
		for sx in [-1, 1]:
			var b := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.1
			sm.height = 0.2
			b.mesh = sm
			b.material_override = _emissive(Color("#1030a0"), Color("#2050ff"), 0.0)
			b.position = Vector3(sx * 0.22, aabb.end.y - 0.12, -0.15)
			body.add_child(b)
			beacons.append(b)
	if kind == "taxi":
		var sign := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.5, 0.15, 0.16)
		sign.mesh = bm
		sign.material_override = _emissive(Color("#ffd84a"), Color("#ffc030"), 0.6)
		sign.position = Vector3(0, aabb.end.y + 0.07, -0.2)
		body.add_child(sign)
		for side in [1, -1]:
			var l := Label3D.new()
			l.text = "ТАКСИ"
			l.font = UI.text_font(true)
			l.font_size = 48
			l.pixel_size = 0.0022
			l.modulate = Color("#111111")
			l.position = Vector3(0, 0, side * 0.085)
			l.rotation.y = 0.0 if side > 0 else PI
			sign.add_child(l)
	return {"root": root, "body": body, "wheels": wheels, "steer": steer, "brake": brake, "headlights": headlights,
		"beacons": beacons, "length": L, "width": W, "wheel_r": info.wheel_r}

static func _local_to(root: Node3D, n: Node3D) -> Transform3D:
	var t := n.transform
	var p := n.get_parent()
	while p != null and p != root and p is Node3D:
		t = (p as Node3D).transform * t
		p = p.get_parent()
	return t
