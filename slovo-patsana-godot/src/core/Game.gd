extends Node
## Global state (autoload "Game"): the shared world, mode switching, quality, hit-stop,
## portraits and settings. Modes are Node3D scenes added under this node.

signal mode_changed

var touch := false
var quality := "high"   # high | medium | low
var lang := "ru"        # ru | en
var world: Node3D
var env: Env
var city: City
var mode: Node3D
var portraits := {}     # char id → Texture2D
var ui_layer: CanvasLayer
var _hit_stop := 0.0
var time_scale := 1.0
var settings := ConfigFile.new()

func _ready() -> void:
	touch = DisplayServer.is_touchscreen_available() or OS.has_feature("web_android") or OS.has_feature("web_ios") or OS.has_feature("mobile")
	if OS.get_cmdline_user_args().has("--touch"):
		touch = true
	settings.load("user://settings.cfg")
	quality = settings.get_value("gfx", "quality", "low" if touch else "high")
	lang = settings.get_value("ui", "lang", "ru")
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	Characters.load_bonus()
	process_mode = Node.PROCESS_MODE_ALWAYS

const STORY_SAVE := "user://story.cfg"
func story_progress() -> int:
	var c := ConfigFile.new()
	if c.load(STORY_SAVE) == OK:
		return int(c.get_value("story", "progress", 0))
	return 0

func set_story_progress(n: int) -> void:
	var c := ConfigFile.new()
	c.set_value("story", "progress", n)
	c.save(STORY_SAVE)

func save_settings() -> void:
	settings.set_value("gfx", "quality", quality)
	settings.set_value("ui", "lang", lang)
	settings.save("user://settings.cfg")

func set_quality(q: String) -> void:
	quality = q
	save_settings()
	apply_quality()

func apply_quality() -> void:
	if env:
		env.lamp_budget = 10 if quality == "high" else (5 if quality == "medium" else 2)
		env.moon.directional_shadow_max_distance = 110 if quality == "high" else (70 if quality == "medium" else 40)
		env.world_env.environment.ssao_enabled = quality == "high"
		env.world_env.environment.glow_enabled = quality != "low"
	var vp := get_viewport()
	vp.scaling_3d_scale = 1.0 if quality != "low" else 0.8
	vp.msaa_3d = Viewport.MSAA_2X if quality == "high" else Viewport.MSAA_DISABLED

## Build the district once; later modes reuse it.
func get_world() -> Node3D:
	if world == null:
		world = Node3D.new()
		world.name = "World"
		add_child(world)
		env = Env.new()
		world.add_child(env)
		city = City.new()
		world.add_child(city)
		env.set_lamp_spots(city.lamp_spots)
		apply_quality()
	return world

func set_mode(m: Node3D) -> void:
	if mode:
		if mode.has_method("dispose"):
			mode.dispose()
		mode.queue_free()
	mode = m
	add_child(m)
	time_scale = 1.0
	Engine.time_scale = 1.0
	mode_changed.emit()

## Hit-stop: a brief slow-down after a solid hit.
func freeze(seconds: float) -> void:
	_hit_stop = maxf(_hit_stop, seconds)

func _process(dt: float) -> void:
	var real_dt := dt / maxf(Engine.time_scale, 1e-3)
	if _hit_stop > 0:
		_hit_stop -= real_dt
		Engine.time_scale = 0.08 * time_scale
	else:
		Engine.time_scale = time_scale
	PlayerInput.end_frame()

func _input(event: InputEvent) -> void:
	PlayerInput.feed(event)

func capture_mouse(on: bool) -> void:
	if touch:
		return
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE
	PlayerInput.mouse_captured = on

## Head-and-shoulders portrait of every playable character, rendered once.
func make_portraits() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(240, 300)
	vp.own_world_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var scene := Node3D.new()
	vp.add_child(scene)
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.1, 0.04, 0.047)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.5, 0.45, 0.5)
	e.ambient_light_energy = 0.8
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	we.environment = e
	scene.add_child(we)
	var key := DirectionalLight3D.new()
	key.light_color = Color(1, 0.886, 0.753)
	key.light_energy = 2.2
	key.rotation_degrees = Vector3(-35, 30, 0)
	scene.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.light_color = Color(1, 0.25, 0.25)
	rim.light_energy = 2.5
	rim.rotation_degrees = Vector3(-30, 200, 0)
	scene.add_child(rim)
	var cam := Camera3D.new()
	cam.fov = 22
	scene.add_child(cam)
	cam.current = true
	var first := true
	for ch in Characters.roster():
		var b := Body.new()
		scene.add_child(b)
		b.setup(Characters.model_path(ch), {"hero": true})
		b.rotation.y = 0.3
		var head := b.model.find_child("Head", true, false)
		var hp := 1.55
		if head:
			hp = head.global_position.y
		elif b.skeleton:
			var hi := b.skeleton.find_bone("Head")
			if hi < 0:
				for i in range(b.skeleton.get_bone_count()):
					if b.skeleton.get_bone_name(i).to_lower().contains("head"):
						hi = i
						break
			if hi >= 0:
				hp = (b.skeleton.global_transform * b.skeleton.get_bone_global_pose(hi)).origin.y
		cam.position = Vector3(0.35, hp - 0.02, 1.45)
		cam.look_at(Vector3(0, hp - 0.12, 0))
		b.tree.advance(0.016)
		# The first render compiles the character shaders; give it time.
		for k in range(40 if first else 6):
			await RenderingServer.frame_post_draw
		first = false
		var img := vp.get_texture().get_image()
		portraits[ch.id] = ImageTexture.create_from_image(img)
		if OS.get_cmdline_user_args().has("--dump-portraits"):
			img.save_png("/tmp/sp/por_%s.png" % ch.id)
			print("portrait ", ch.id, " head_y=%.2f" % hp)
		b.queue_free()
		await get_tree().process_frame
	vp.queue_free()
