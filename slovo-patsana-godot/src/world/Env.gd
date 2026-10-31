class_name Env
extends Node3D
## Winter night (port of world/Environment.ts): HDRI sky and image-based light, fog,
## moonlight with shadows, snowfall around the action, and a budget of real point
## lights that hop between the nearest street lamps.

var moon: DirectionalLight3D
var world_env: WorldEnvironment
var snow: CPUParticles3D
var lamps: Array[OmniLight3D] = []
var lamp_spots: Array = []
var lamp_budget := 10
var _lamp_t := 0.0
var t := 0.0

func _ready() -> void:
	world_env = WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := PanoramaSkyMaterial.new()
	sm.panorama = load("res://assets/hdri/winter_evening_2k.hdr")
	sm.energy_multiplier = 0.55
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.sky_rotation = Vector3(0, 1.2, 0)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_sky_contribution = 1.0
	e.ambient_light_energy = 0.45
	e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	e.fog_enabled = true
	e.fog_mode = Environment.FOG_MODE_DEPTH
	e.fog_depth_begin = 30
	e.fog_depth_end = 260
	e.fog_light_color = Color(0.165, 0.153, 0.2)
	e.fog_density = 1.0
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.tonemap_exposure = 1.05
	e.glow_enabled = true
	e.glow_intensity = 0.55
	e.glow_bloom = 0.08
	e.glow_hdr_threshold = 1.0
	e.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.06
	e.adjustment_saturation = 1.05
	e.ssao_enabled = true
	e.ssao_radius = 1.2
	e.ssao_intensity = 1.5
	world_env.environment = e
	add_child(world_env)

	moon = DirectionalLight3D.new()
	moon.light_color = Color(0.72, 0.78, 1.0)
	moon.light_energy = 1.1
	moon.rotation_degrees = Vector3(-52, 38, 0)
	moon.shadow_enabled = true
	moon.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	moon.directional_shadow_max_distance = 110
	moon.directional_shadow_split_1 = 0.25
	moon.shadow_bias = 0.03
	moon.shadow_normal_bias = 1.2
	add_child(moon)

	snow = CPUParticles3D.new()
	snow.amount = 900 if OS.has_feature("web") else 2600
	snow.lifetime = 14
	snow.preprocess = 14
	snow.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	snow.emission_box_extents = Vector3(36, 2, 36)
	snow.position.y = 22
	snow.direction = Vector3(0.25, -1, 0.1)
	snow.spread = 12
	snow.gravity = Vector3(0, -0.9, 0)
	snow.initial_velocity_min = 1.0
	snow.initial_velocity_max = 1.8
	snow.scale_amount_min = 0.035
	snow.scale_amount_max = 0.07
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.albedo_color = Color(0.95, 0.96, 1.0, 0.85)
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	# Soft round flake.
	var gt := GradientTexture2D.new()
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(0.5, 0.0)
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(1, 1, 1, 0))
	gt.gradient = gr
	gt.width = 32
	gt.height = 32
	fm.albedo_texture = gt
	fm.no_depth_test = false
	fm.render_priority = 1
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	var qm := QuadMesh.new()
	qm.size = Vector2(1, 1)
	qm.material = fm
	snow.mesh = qm
	add_child(snow)

func set_lamp_spots(spots: Array) -> void:
	lamp_spots = spots
	for i in range(10):
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.69, 0.38)
		l.omni_range = 24
		l.omni_attenuation = 1.6
		l.light_energy = 0
		l.shadow_enabled = false
		add_child(l)
		lamps.append(l)

func update(dt: float, focus: Vector3) -> void:
	t += dt
	snow.position = Vector3(focus.x, 22, focus.z)
	_lamp_t -= dt
	if _lamp_t <= 0 and not lamp_spots.is_empty():
		_lamp_t = 0.3
		var near := lamp_spots.duplicate()
		near.sort_custom(func(a: Vector3, b: Vector3) -> bool:
			return (a.x - focus.x) ** 2 + (a.z - focus.z) ** 2 < (b.x - focus.x) ** 2 + (b.z - focus.z) ** 2)
		for i in range(lamps.size()):
			if i < near.size():
				lamps[i].position = near[i]
			lamps[i].light_energy = 7.0 if (i < lamp_budget and i < near.size()) else 0.0
