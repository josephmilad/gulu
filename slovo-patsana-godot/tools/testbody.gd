extends SceneTree
## Renders three bodies mid-animation and saves screenshots (run under xvfb).
var bodies := []
var t := 0.0
var shots := 0
func _init():
	process_frame.connect(_setup, CONNECT_ONE_SHOT)

func _setup():
	var root3d := Node3D.new()
	get_root().add_child(root3d)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.35, 0.4, 0.5)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.6, 0.65, 0.8)
	e.ambient_light_energy = 0.8
	env.environment = e
	root3d.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, 35, 0)
	sun.shadow_enabled = true
	sun.light_energy = 1.5
	root3d.add_child(sun)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.9, 0.92, 0.95)
	floor.material_override = fm
	root3d.add_child(floor)
	var cam := Camera3D.new()
	root3d.add_child(cam)
	cam.position = Vector3(0, 1.3, 4.2)
	cam.look_at(Vector3(0, 1.0, 0))
	cam.current = true
	var specs := [
		["res://assets/characters/vova.glb", {}, -1.6],
		["res://assets/characters/npc/eric.glb", {"tint": Color(0.18, 0.37, 0.72), "tint_amt": 0.8}, 0.0],
		["res://assets/characters/bonus1.glb", {}, 1.6],
	]
	for sp in specs:
		var b := Body.new()
		root3d.add_child(b)
		b.setup(sp[0], sp[1])
		b.position.x = sp[2]
		bodies.append(b)
		print("body ", sp[0].get_file(), " lift=", "%.3f" % b.model.position.y, " clips=", b._clip_lengths.size())
	bodies[0].speed = 1.4
	bodies[2].speed = 0.0
	t = 0.0
	process_frame.connect(_tick)
var did := {}
func _once(key: String, at: float) -> bool:
	if t >= at and not did.has(key):
		did[key] = true
		return true
	return false
func _tick():
	var dt := get_root().get_process_delta_time()
	t += dt
	if _once("jab", 0.5):
		bodies[2].play("jab")
		bodies[1].play("taunt")
		print("played jab: current=", bodies[2].current, " len=", bodies[2]._one_len, " scale=", bodies[2]._one_scale, " act=", (bodies[2].tree.tree_root as AnimationNodeBlendTree).get_node("act").animation)
	if _once("sprint", 1.0):
		bodies[0].speed = 6.4
	if _once("s0", 0.62) or _once("s1", 1.3):
		var img := get_root().get_viewport().get_texture().get_image()
		img.save_png("/tmp/sp/body_%d.png" % shots)
		shots += 1
		print("shot at t=%.2f  bonus1.current=%s mix=%.2f" % [t, bodies[2].current, bodies[2]._mix])
	if t > 1.4:
		quit()
