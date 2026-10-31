class_name BuildingKit
## Photo-textured Soviet apartment blocks from Sketchfab (CC-BY, see assets/CREDITS.txt),
## normalised to metres by tools/prep_building.py. Each model is drawn as MultiMeshes
## (one per sub-mesh), with a shader that lights random windows at night and settles
## snow on roofs, ledges and balconies.

## floors is used only to pick a model for a slot; size comes from the mesh itself.
const MODELS := {
	"khrushchevka": {"floors": 5},
	"panel_c01": {"floors": 5},
	"lowpoly_apt": {"floors": 9},
	"panel12": {"floors": 12},
}

const SHADER := """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform bool has_normal = false;
uniform vec4 albedo_col : source_color = vec4(1.0);
uniform float rough = 0.85;
uniform float lit_share = 0.42;
varying vec3 wpos;
varying vec3 wnorm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec4 c = texture(albedo_tex, UV) * albedo_col;
	vec3 n = normalize(wnorm);
	float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
	// Windows: dark, unsaturated texels on the walls, above the ground floor plinth.
	float vertical = 1.0 - abs(n.y);
	float glass = (1.0 - smoothstep(0.10, 0.26, lum)) * (1.0 - smoothstep(0.08, 0.2, sat)) * step(0.85, vertical) * step(1.6, wpos.y);
	// One random state per window: a cell 1.5 m along the wall by one floor.
	float along = dot(wpos.xz, vec2(-n.z, n.x));
	vec2 cell = vec2(floor(along / 1.5), floor((wpos.y - 0.4) / 2.8)) + floor(wpos.xz / 97.0) * 13.0;
	float r = hash(cell);
	float lit = step(1.0 - lit_share, r);
	float tv = (1.0 - lit) * step(0.93, hash(cell + 7.3));
	vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(1.0, 0.88, 0.68), hash(cell + 3.1));
	vec3 glow = warm * lit * 2.4 + vec3(0.3, 0.42, 0.85) * tv * (0.6 + 0.4 * sin(TIME * 7.0 + r * 30.0));
	// Snow on everything facing up.
	float snow = smoothstep(0.55, 0.85, n.y);
	ALBEDO = mix(c.rgb, vec3(0.92, 0.94, 0.97), snow);
	ROUGHNESS = mix(rough, 0.9, snow);
	METALLIC = 0.0;
	EMISSION = glow * glass;
	if (has_normal) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
	}
}
"""

static var _shader: Shader
var kits := {}      # name → {parts: [{mesh, local, mats}], size: Vector3}
var placed := {}    # name → [Transform3D]

static func _mat(src: Material) -> Material:
	if not (src is StandardMaterial3D):
		return src
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var s := src as StandardMaterial3D
	var m := ShaderMaterial.new()
	m.shader = _shader
	if s.albedo_texture:
		m.set_shader_parameter("albedo_tex", s.albedo_texture)
	m.set_shader_parameter("albedo_col", s.albedo_color)
	m.set_shader_parameter("rough", s.roughness)
	if s.normal_enabled and s.normal_texture:
		m.set_shader_parameter("normal_tex", s.normal_texture)
		m.set_shader_parameter("has_normal", true)
	return m

## Props: cut-out transparency (sign faces, chain-link mesh) sorts and shadows cleanly.
static func _prop_mat(src: Material) -> Material:
	if src is StandardMaterial3D and (src as StandardMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
		var m := (src as StandardMaterial3D).duplicate() as StandardMaterial3D
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		m.alpha_scissor_threshold = 0.5
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		return m
	return src

## Load a model once; returns its size in metres (x = length, y = height, z = depth).
func kit(name: String) -> Dictionary:
	if kits.has(name):
		return kits[name]
	var path := Assets.p("buildings/%s.glb" % name)
	var inst: Node3D = (load(path) as PackedScene).instantiate()
	var parts := []
	var aabb := AABB()
	var first := true
	var cache := {}
	var lit := MODELS.has(name)
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var local := CarModel._local_to(inst, m)
		var mats := []
		for i in range(m.mesh.get_surface_count()):
			var src := m.get_active_material(i)
			if not cache.has(src):
				cache[src] = _mat(src) if lit else _prop_mat(src)
			mats.append(cache[src])
		parts.append({"mesh": m.mesh, "local": local, "mats": mats})
		var b := local * m.get_aabb()
		aabb = b if first else aabb.merge(b)
		first = false
	inst.free()
	kits[name] = {"parts": parts, "size": aabb.size, "aabb": aabb}
	return kits[name]

## Place a model centred at (x, z), turned by ry (0 or a multiple of PI/2). Returns the
## axis-aligned footprint {min_x, max_x, min_z, max_z, h} for collisions.
func add(name: String, x: float, z: float, ry: float) -> Dictionary:
	var k := kit(name)
	if not placed.has(name):
		placed[name] = []
	placed[name].append(MeshLib.xform(Vector3(x, 0, z), ry))
	var a: AABB = k.aabb
	var turned := absf(sin(ry)) > 0.5
	var hx: float = (a.size.z if turned else a.size.x) / 2
	var hz: float = (a.size.x if turned else a.size.z) / 2
	return BoxGrid.box(x - hx, x + hx, z - hz, z + hz, a.size.y)

## Street furniture from the same folder (payphone, fences): placed like buildings.
func add_prop(name: String, x: float, z: float, ry: float) -> void:
	kit(name)
	if not placed.has(name):
		placed[name] = []
	placed[name].append(MeshLib.xform(Vector3(x, 0, z), ry))

func build(parent: Node3D) -> void:
	for name in placed:
		var all: Array = placed[name]
		var k: Dictionary = kits[name]
		var tiles := {}
		for t in all:
			var tk := MeshLib.tile_of(t)
			if not tiles.has(tk):
				tiles[tk] = []
			tiles[tk].append(t)
		var i := 0
		for part in k.parts:
			for tk in tiles:
				var list: Array = tiles[tk]
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.mesh = part.mesh
				mm.instance_count = list.size()
				for j in range(list.size()):
					mm.set_instance_transform(j, list[j] * part.local)
				var mi := MultiMeshInstance3D.new()
				mi.name = "%s_%d_%d_%d" % [name, i, tk.x, tk.y]
				mi.multimesh = mm
				# A MultiMesh has no per-surface overrides; one surface per part is the norm
				# for these exports, so the first material stands for the part.
				if part.mats.size() > 0 and part.mats[0]:
					mi.material_override = part.mats[0]
				MeshLib.apply_range(mi, name)
				parent.add_child(mi)
			i += 1
