class_name Body
extends Node3D
## A character model with the shared retargeted clips (port of actors/SkinnedBody.ts).
## Locomotion is a speed-driven blend (idle → walk → jog → sprint); actions are
## one-shots mixed on top, with their speed scaled so the impact lands on the attack's
## hit time. `speed` is set by the owner every frame.

const LOOPS := ["idle", "walk", "jog", "sprint", "folded", "talk", "crouch", "sit", "dance", "yes"]
## Logical names used by the combat code → clip names in the GLB.
const ALIAS := {"fall": "knockback", "down": "knockback", "blockHit": "block", "dodge": "roll", "taunt": "folded",
	"victory": "dance", "scared": "crouch", "smoke": "talk"}

static var _lift_cache := {}
static var _scene_cache := {}

var speed := 0.0
var current := ""        ## logical name of the playing action ("" when none)
var clip_time := 0.0
var on_step: Callable = Callable()

var model: Node3D
var skeleton: Skeleton3D
var player: AnimationPlayer
var tree: AnimationTree
var marker: MeshInstance3D
var _mix := 0.0           ## current action weight
var _hold := false
var _one_len := 0.0
var _one_scale := 1.0
var _step_dist := 0.0
var _flurry: Dictionary = {}
var _clip_lengths := {}

static func load_model(path: String) -> PackedScene:
	if not _scene_cache.has(path):
		_scene_cache[path] = load(path)
	return _scene_cache[path]

## Build a body from a GLB path. opts: tint (Color), tint_amt, scale, hero.
func setup(path: String, opts: Dictionary = {}) -> Body:
	var ps := load_model(path)
	model = ps.instantiate()
	add_child(model)
	skeleton = model.find_child("Skeleton3D", true, false)
	player = model.find_child("AnimationPlayer", true, false)
	var sc: float = opts.get("scale", 1.0)
	model.scale = Vector3.ONE * sc
	_prepare_meshes(opts)
	for lib in player.get_animation_library_list():
		var l := player.get_animation_library(lib)
		for n in l.get_animation_list():
			var anim := l.get_animation(n)
			_clip_lengths[n] = anim.length
			anim.loop_mode = Animation.LOOP_LINEAR if n in LOOPS else Animation.LOOP_NONE
	model.position.y = _foot_lift(path) * sc
	_build_tree()
	# Ring under the feet (lock-on marker), hidden until used.
	marker = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 0.42
	ring.outer_radius = 0.5
	ring.rings = 24
	ring.ring_segments = 4
	marker.mesh = ring
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mm.albedo_color = Color(1, 1, 1, 0)
	marker.material_override = mm
	marker.position.y = 0.03
	marker.scale = Vector3(1, 0.08, 1)
	add_child(marker)
	return self

func set_marker(alpha: float, color := Color.WHITE) -> void:
	var m := marker.material_override as StandardMaterial3D
	m.albedo_color = Color(color.r, color.g, color.b, alpha)

func _prepare_meshes(opts: Dictionary) -> void:
	var tint = opts.get("tint", null)
	var amt: float = opts.get("tint_amt", 0.75)
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		# Meshy leaves a stray helper sphere in the export.
		if m.name.begins_with("Icosphere"):
			m.visible = false
			continue
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		# Animated meshes move outside their rest-pose bounds; keep them from being culled.
		m.custom_aabb = AABB(Vector3(-1.5, -0.5, -1.5), Vector3(3, 3, 3))
		for i in range(m.mesh.get_surface_count()):
			var mat := m.get_active_material(i)
			if mat is StandardMaterial3D:
				var sm := mat as StandardMaterial3D
				if tint != null:
					m.set_surface_override_material(i, Tint.make(sm, tint, amt))
				else:
					sm.cull_mode = BaseMaterial3D.CULL_BACK
					sm.emission_enabled = false

## How far to raise the model so its feet rest on the ground: compare the lowest foot
## joint over the idle loop with the bind pose, where every model stands on y = 0.
func _foot_lift(path: String) -> float:
	if _lift_cache.has(path):
		return _lift_cache[path]
	var lift := 0.0
	if skeleton and player and player.has_animation("idle"):
		var feet := []
		for i in range(skeleton.get_bone_count()):
			var n := skeleton.get_bone_name(i).to_lower()
			if n.contains("foot") or n.contains("toe") or n.contains("ball"):
				feet.append(i)
		if feet.size() > 0:
			var lowest := func() -> float:
				var mn := INF
				for b in feet:
					mn = minf(mn, (skeleton.global_transform * skeleton.get_bone_global_pose(b)).origin.y - global_position.y)
				return mn
			# Bind pose.
			skeleton.reset_bone_poses()
			var bind: float = lowest.call()
			var posed := INF
			player.play("idle")
			var len: float = _clip_lengths.get("idle", 2.5)
			for k in range(12):
				player.seek(len * k / 12.0, true)
				posed = minf(posed, lowest.call())
			player.stop()
			skeleton.reset_bone_poses()
			if is_finite(bind) and is_finite(posed):
				lift = bind - posed
	_lift_cache[path] = lift
	return lift

func _build_tree() -> void:
	tree = AnimationTree.new()
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	var root := AnimationNodeBlendTree.new()
	var loco := AnimationNodeBlendSpace1D.new()
	loco.sync = true
	loco.min_space = 0.0
	loco.max_space = 6.4
	for pair in [["idle", 0.0], ["walk", 1.4], ["jog", 3.6], ["sprint", 6.4]]:
		var a := AnimationNodeAnimation.new()
		a.animation = pair[0]
		loco.add_blend_point(a, pair[1])
	root.add_node("loco", loco, Vector2(0, 0))
	var act := AnimationNodeAnimation.new()
	act.animation = "idle"
	root.add_node("act", act, Vector2(0, 200))
	var ts := AnimationNodeTimeScale.new()
	root.add_node("act_ts", ts, Vector2(200, 200))
	var seek := AnimationNodeTimeSeek.new()
	root.add_node("act_seek", seek, Vector2(400, 200))
	var mix := AnimationNodeBlend2.new()
	root.add_node("mix", mix, Vector2(600, 100))
	root.connect_node("act_ts", 0, "act")
	root.connect_node("act_seek", 0, "act_ts")
	root.connect_node("mix", 0, "loco")
	root.connect_node("mix", 1, "act_seek")
	root.connect_node("output", 0, "mix")
	tree.tree_root = root
	tree.active = true
	tree.set("parameters/mix/blend_amount", 0.0)
	tree.set("parameters/loco/blend_position", 0.0)

func has_clip(n: String) -> bool:
	return _clip_lengths.has(n)

## Play a one-shot or held action by logical name. `atk` (attack dict) tunes the speed.
func play(logical: String, atk: Dictionary = {}) -> void:
	if logical == "flurry":
		_flurry = {"t": 0.0, "i": 0}
		current = "flurry"
		_start_clip("jab", "flurry", 0.11)
		return
	_flurry = {}
	var clip := logical
	if logical == "hit":
		clip = "hit_head" if randf() < 0.5 else "hit_chest"
	else:
		clip = ALIAS.get(logical, logical)
	var a: Dictionary = atk if not atk.is_empty() else Attacks.get_attack(logical)
	var hit_at := 0.0
	var dur := 0.0
	if not a.is_empty():
		hit_at = a.hits[0].t
		dur = a.dur
	_start_clip(clip, logical, hit_at, dur)

func _start_clip(clip: String, logical: String, hit_at := 0.0, dur := 0.0) -> void:
	if not _clip_lengths.has(clip):
		return
	var length: float = _clip_lengths[clip]
	_hold = logical in ["down", "fall", "block", "dead"]
	var scale := 1.0
	var impact: float = Attacks.IMPACT.get(clip, 0.0)
	if hit_at > 0 and impact > 0:
		scale = clampf(impact / hit_at, 0.6, 4)
	elif dur > 0:
		scale = clampf(length / dur, 0.6, 4)
	elif logical == "getup":
		scale = length / 0.75
	elif logical == "dodge":
		scale = length / 0.4
	elif logical == "hit" or logical == "blockHit":
		scale = 1.1
	elif logical == "fall":
		scale = 1.2
	var act := (tree.tree_root as AnimationNodeBlendTree).get_node("act") as AnimationNodeAnimation
	act.animation = clip
	var start := 0.0
	if logical == "down":
		start = length
	if logical == "block":
		start = length * 0.35
		scale = 0.0
	tree.set("parameters/act_ts/scale", scale)
	tree.set("parameters/act_seek/seek_request", start)
	_one_len = length
	_one_scale = scale
	current = logical
	clip_time = start
	_mix = 1.0 if _mix > 0.5 else _mix
	tree.set("parameters/mix/blend_amount", 1.0)

func stop() -> void:
	current = ""
	_flurry = {}
	_hold = false

func release() -> void:
	stop()

func _process(dt: float) -> void:
	if tree == null:
		return
	tree.set("parameters/loco/blend_position", speed)
	# Step events from distance travelled (one step per 0.78 m).
	if speed > 0.3 and current == "":
		_step_dist += speed * dt
		if _step_dist > 0.78:
			_step_dist = 0.0
			if on_step.is_valid():
				on_step.call()
	if current != "":
		clip_time += dt * _one_scale
		if not _flurry.is_empty():
			# Vova's series: jab, cross, jab, cross, then a big hook.
			_flurry.t += dt
			var seq := [[0.16, "cross", 0.27], [0.32, "jab", 0.43], [0.48, "cross", 0.59], [0.66, "hook", 0.84]]
			if _flurry.i < seq.size() and _flurry.t >= seq[_flurry.i][0]:
				var s = seq[_flurry.i]
				_flurry.i += 1
				var keep := _flurry
				_start_clip(s[1], "flurry", s[2] - s[0])
				_flurry = keep
			if _flurry.t > 1.1:
				stop()
		var looping: bool = (ALIAS.get(current, current) in LOOPS)
		if clip_time >= _one_len - 0.001 and not _hold and not looping and _flurry.is_empty():
			current = ""
	var target := 1.0 if current != "" else 0.0
	var rate := 12.0 if target > _mix else 7.0
	_mix = move_toward(_mix, target, rate * dt)
	tree.set("parameters/mix/blend_amount", _mix)
