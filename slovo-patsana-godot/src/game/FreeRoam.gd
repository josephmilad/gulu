class_name FreeRoam
extends Node3D
## Open-world mode (port of game/FreeRoamMode.ts): walk the district, fight rival
## gangs, earn money and authority. Also the Arena and AI world for the fighters.

const PED_COUNT := 16

var camera := Camera3D.new()
var fighters: Array = []
var players: Array = []
var grid: BoxGrid
var city: City
var bounds = null
var cam: FollowCam
var hud: Hud
var streets = null     # Streets, once cars are in
var story = null       # Story, in story mode
var time := 0.0
var money := 20
var authority := 0
var actor_layer := Node3D.new()
var groups: Array = []
var pickups: Array = []
var zone := "universam"
var paused := false
var pause_ui: Control = null
var tip: Label
var wasted_ui: Control = null
var wasted_t := 0.0
var busted := false
var char_id := ""
var on_quit: Callable
var fill := OmniLight3D.new()
var note_mesh: QuadMesh
var note_mat: StandardMaterial3D
var _pop_t := 0.0
var _had_lock := false
var opts := {}

var wanted: int:
	get: return streets.wanted if streets else 0

## Store the parameters; the world is built in _ready(), once the mode is in the tree.
func init(id: String, quit_cb: Callable, options := {}) -> FreeRoam:
	char_id = id
	on_quit = quit_cb
	opts = options
	return self

func _ready() -> void:
	var id := char_id
	var options := opts
	Game.get_world()
	city = Game.city
	grid = city.grid
	Game.world.add_child(actor_layer)
	add_child(camera)
	camera.fov = 60
	camera.far = 700
	camera.current = true
	fill.light_color = Color(1, 0.886, 0.769)
	fill.light_energy = 1.2
	fill.omni_range = 14
	fill.omni_attenuation = 1.5
	fill.shadow_enabled = false
	actor_layer.add_child(fill)
	var ch := Characters.by_id(id)
	var p := Fighter.create(actor_layer, self, {"path": Characters.model_path(ch), "hero": true, "hp": ch.hp, "power": ch.power, "speed": ch.speed,
		"special": ch.special, "regen": Characters.regen_of(ch), "team": "universam", "name": T.call_name(ch), "char_id": ch.id})
	p.place(city.spawn.x, city.spawn.z, city.spawn.heading)
	p.data["is_player"] = true
	fighters.append(p)
	players.append(p)
	cam = FollowCam.new(camera)
	cam.snap(p.x, p.z, p.heading)
	hud = Hud.new().setup([{"f": p, "portrait": Game.portraits.get(ch.id), "title": T.full_title(ch)}], city)
	for hg in city.hangouts:
		groups.append({"hang": hg, "team": hg.zone, "members": [], "respawn_at": 0.0, "wiped": false})
	for i in range(PED_COUNT):
		_spawn_ped(true)
	note_mesh = QuadMesh.new()
	note_mesh.size = Vector2(0.5, 0.25)
	note_mat = StandardMaterial3D.new()
	note_mat.albedo_color = Color("#9fd08a")
	note_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	note_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	tip = UI.label(T.t("roam.tip_touch") if Game.touch else T.t("roam.tip"), 16, Color(1, 1, 1, 0.85))
	tip.add_theme_stylebox_override("normal", UI.box(Color(0, 0, 0, 0.5)))
	tip.anchor_left = 0.5
	tip.anchor_right = 0.5
	tip.anchor_top = 0.58
	tip.anchor_bottom = 0.58
	tip.grow_horizontal = Control.GROW_DIRECTION_BOTH
	hud.add_child(tip)
	get_tree().create_timer(9.0).timeout.connect(func(): if is_instance_valid(tip): tip.visible = false)
	hud.notice(T.full_title(ch).to_upper(), T.t("roam.home"), 3.5)
	Sfx.stop_music()
	Sfx.start_wind()
	if ResourceLoader.exists("res://src/game/Streets.gd"):
		streets = load("res://src/game/Streets.gd").new()
		streets.setup(self)
	if options.get("story", false) and ResourceLoader.exists("res://src/game/Story.gd"):
		story = load("res://src/game/Story.gd").new()
		story.setup(self, id)
	if not Game.touch:
		Game.capture_mouse(true)
		_had_lock = true
	TouchUI.set_shown(true)

# ---------- Arena callbacks ----------
func on_hit(att: Fighter, vic: Fighter, res: Dictionary, hit: Dictionary) -> void:
	var listener: Fighter = players[0]
	var d := vic.dist_to(listener)
	if res.blocked:
		Sfx.block(d)
	else:
		Sfx.hit(minf(1.4, hit.dmg / 12.0), d)
	if res.knockdown:
		get_tree().create_timer(0.38).timeout.connect(func(): Sfx.thud(d))
	if d < 30:
		hud.damage(vic, res.dmg, res.blocked)
	var player_involved := players.has(att) or players.has(vic)
	if player_involved and not res.blocked:
		Game.freeze(0.09 if res.knockdown else 0.045)
		cam.shake = maxf(cam.shake, 1.0 if res.knockdown else 0.5)
	var b = vic.data.get("brain")
	if b and vic.alive and not res.ko:
		if b.role == "ped" and not b.brave:
			b.flee(Vector2(att.x, att.z), self, vic)
	if res.ko:
		on_ko(att, vic)

func on_whiff(att: Fighter) -> void:
	Sfx.whoosh(att.dist_to(players[0]))

func on_step(f: Fighter) -> void:
	Sfx.step(f.dist_to(players[0]))

func bark(f: Fighter, text: String) -> void:
	if f.dist_to(players[0]) < 30:
		hud.bubble(f, text)

func shake(n: float) -> void:
	cam.shake = maxf(cam.shake, n)

func on_ko(att: Fighter, vic: Fighter) -> void:
	var by_player := players.has(att)
	if players.has(vic):
		wasted(att.team == "police" or wanted > 0)
		return
	if not by_player:
		return
	if vic.team == "police":
		if streets:
			streets.add_wanted(1, T.t("police.ko"))
		_drop_money(vic.x, vic.z, 10 + randi() % 15)
		return
	if vic.team == "razezd" or vic.team == "hadi":
		authority += 3
		_drop_money(vic.x, vic.z, 5 + randi() % 20)
		if randf() < 0.4:
			hud.bubble(att, T.bark("ko"))
		for g in groups:
			if g.members.has(vic) and g.members.all(func(m): return not m.alive):
				g.wiped = true
				g.respawn_at = time + 90
				authority += 10
				hud.notice(T.t("roam.seen_off"), T.t("roam.seen_off_sub") % T.zone(g.team))
				Sfx.ko()
	elif vic.team == "civil":
		authority = maxi(0, authority - 5)
		_drop_money(vic.x, vic.z, 1 + randi() % 6)
		hud.toast(T.t("roam.civil_hit"))
		if streets:
			streets.add_wanted(1)

func _drop_money(x: float, z: float, value: int) -> void:
	var m := MeshInstance3D.new()
	m.mesh = note_mesh
	m.material_override = note_mat
	m.position = Vector3(x, 0.5, z)
	actor_layer.add_child(m)
	pickups.append({"mesh": m, "value": value, "t": 0.0})

func wasted(is_busted := false) -> void:
	if wasted_ui:
		return
	Sfx.ko()
	if story:
		story.on_wasted()
	busted = is_busted
	var o := Control.new()
	o.set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.7)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	o.add_child(bg)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_CENTER)
	col.grow_horizontal = Control.GROW_DIRECTION_BOTH
	col.grow_vertical = Control.GROW_DIRECTION_BOTH
	var h := UI.label(T.t("roam.busted") if is_busted else T.t("roam.wasted"), 80, UI.RED, true)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var s := UI.label(T.t("roam.busted_sub") if is_busted else T.t("roam.wasted_sub"), 22)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(h)
	col.add_child(s)
	o.add_child(col)
	hud.add_child(o)
	wasted_ui = o
	wasted_t = 4
	Game.time_scale = 0.4

func _respawn() -> void:
	var p: Fighter = players[0]
	wasted_ui.queue_free()
	wasted_ui = null
	Game.time_scale = 1
	money = floori(money * (0.5 if busted else 0.7))
	if streets:
		streets.clear_wanted()
	for f: Fighter in fighters.duplicate():
		if f.team == "police":
			remove_fighter(f)
	p.revive()
	p.place(city.spawn.x, city.spawn.z, city.spawn.heading)
	cam.snap(p.x, p.z, p.heading)
	for f: Fighter in fighters:
		var b = f.data.get("brain")
		if b and b.mode == "fight":
			b.target = null
			b.mode = "return"

# ---------- Population ----------
func add_fighter(f: Fighter) -> void:
	if not fighters.has(f):
		fighters.append(f)

func remove_fighter(f: Fighter) -> void:
	fighters.erase(f)
	if hud.tags.has(f):
		hud.tags[f].node.queue_free()
		hud.tags.erase(f)
	f.queue_free()

func spawn_npc(team: String, role: String, x: float, z: float, home: Vector2) -> Fighter:
	var spec: Dictionary
	if team == "civil":
		spec = Looks.civil_spec()
	elif team == "police":
		spec = Looks.police_spec()
	else:
		spec = Looks.gang_spec(team)
	var fname: String
	if team == "civil":
		fname = Looks.pick(T.list("civil_f" if spec.female else "civil_m"))
	elif team == "police":
		fname = Looks.pick(T.list("police_names"))
	elif role == "ally":
		fname = Looks.pick(T.list("ally_nicks"))
	else:
		fname = Looks.pick(T.list("gang_nicks"))
	var hp := 40.0 if team == "civil" else (90.0 if role == "ally" else 55.0 + floori(authority / 5.0) * 3)
	var o := spec.duplicate()
	o.merge({"hp": minf(hp, 110), "power": 0.6 if team == "civil" else 0.8, "speed": 1.0, "team": team, "name": fname})
	var f := Fighter.create(actor_layer, self, o)
	f.place(x, z, randf() * TAU)
	var skill := 0.1 if team == "civil" else minf(0.85, 0.3 + authority / 200.0)
	f.data["brain"] = Brain.new(role, home, skill)
	fighters.append(f)
	return f

func _spawn_ped(anywhere := false) -> void:
	var p: Fighter = players[0]
	for tries in range(12):
		var n: Dictionary = city.walk_nodes[city.random_walk_node()]
		var d := Vector2(n.x - p.x, n.z - p.z).length()
		if d < (12 if anywhere else 40) or d > 80:
			continue
		spawn_npc("civil", "ped", n.x + (randf() - 0.5) * 2, n.z + (randf() - 0.5) * 2, Vector2(n.x, n.z))
		return

func _manage_groups() -> void:
	var p: Fighter = players[0]
	for g in groups:
		var d := Vector2(g.hang.x - p.x, g.hang.z - p.z).length()
		if g.members.is_empty():
			if d < 85 and d > 25 and time >= g.respawn_at:
				var ally: bool = g.team == "universam"
				var n := 2 if ally else 3 + (1 if authority > 40 else 0) + (1 if randf() < 0.3 else 0)
				for i in range(n):
					var a := TAU * i / n
					var x: float = g.hang.x + cos(a) * 1.6
					var z: float = g.hang.z + sin(a) * 1.6
					g.members.append(spawn_npc(g.team, "ally" if ally else "gang", x, z, Vector2(x, z)))
				g.wiped = false
		elif d > 120 and g.members.all(func(m): return not is_instance_valid(m) or m.data.brain.mode != "fight"):
			for m in g.members:
				if is_instance_valid(m) and fighters.has(m):
					remove_fighter(m)
			g.members = []
		else:
			g.members = g.members.filter(func(m): return is_instance_valid(m) and fighters.has(m))
			if g.members.is_empty() and g.respawn_at < time:
				g.respawn_at = time + 45

func _manage_peds() -> void:
	var p: Fighter = players[0]
	var peds := 0
	for f: Fighter in fighters.duplicate():
		if players.has(f):
			continue
		var d := f.dist_to(p)
		var brain = f.data.get("brain")
		if not f.alive:
			f.data["dead_t"] = f.data.get("dead_t", 0.0) + 0.25
			if f.data.dead_t > 30 or d > 90:
				remove_fighter(f)
			continue
		if brain == null:
			continue
		if brain.role == "police" and d > 110:
			remove_fighter(f)
		elif brain.role == "ped":
			if d > 95:
				remove_fighter(f)
			else:
				peds += 1
	if peds < PED_COUNT:
		_spawn_ped()

# ---------- Input & pause ----------
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		pause(not paused)
	elif event.is_action_pressed("help") and not paused:
		pause(true, true)
	elif event is InputEventMouseButton and event.pressed and not paused and not Game.touch and not PlayerInput.mouse_captured:
		Game.capture_mouse(true)

func pause(on: bool, controls := false) -> void:
	if on == paused and not controls:
		return
	paused = on
	if pause_ui:
		pause_ui.queue_free()
		pause_ui = null
	if has_node("TouchUI"):
		pass
	if not on:
		Game.capture_mouse(true)
		TouchUI.set_shown(true)
		return
	Game.capture_mouse(false)
	TouchUI.set_shown(false)
	var ov := UI.overlay(T.t("pause.controls") if controls else T.t("pause"))
	if controls:
		var c := UI.label(Controls.text(), 18)
		ov.col.add_child(c)
	var first: Button = null
	var mk := func(label: String, fn: Callable) -> Button:
		var b := UI.button(label)
		b.pressed.connect(func():
			Sfx.confirm()
			fn.call())
		ov.col.add_child(b)
		return b
	first = mk.call(T.t("pause.resume"), func(): pause(false))
	if not controls:
		mk.call(T.t("pause.controls"), func(): pause(true, true))
		var order := ["high", "medium", "low"]
		var gb: Button = mk.call(T.t("pause.gfx") % T.t("gfx." + Game.quality), func(): pass)
		gb.pressed.connect(func():
			var next: String = order[(order.find(Game.quality) + 1) % 3]
			Game.set_quality(next)
			gb.text = T.t("pause.gfx") % T.t("gfx." + next))
	mk.call(T.t("menu.main"), func(): on_quit.call())
	hud.add_child(ov.root)
	pause_ui = ov.root
	first.grab_focus()

# ---------- Frame ----------
func _process(raw_dt: float) -> void:
	# Long frames (a slow machine, a hitch) must not blow up the arcade physics.
	var dt := minf(raw_dt, 0.05)
	if paused:
		_render_only(0)
		return
	time += dt
	var p: Fighter = players[0]
	if wasted_ui:
		wasted_t -= dt / maxf(0.1, Game.time_scale)
		if wasted_t <= 0:
			_respawn()
	var it := PlayerInput.read("kbm", dt)
	var f := cam.forward()
	var rx := -f.y
	var rz := f.x
	var mx: float = f.x * it.move_y + rx * it.move_x
	var mz: float = f.y * it.move_y + rz * it.move_x
	var ml := Vector2(mx, mz).length()
	if ml > 1:
		mx /= ml
		mz /= ml
	var tgt := _nearest_threat(p)
	var fighting := tgt != null and tgt.dist_to(p) < 5
	var c := p.ctrl
	c.mx = mx
	c.mz = mz
	c.speed = 6.4 if it.run else (2.8 if fighting else 3.6)
	c.punch = it.punch
	c.kick = it.kick
	c.block = it.block
	c.special = it.special
	c.dodge = it.dodge
	c.face = null
	if tgt and (fighting or it.punch or it.kick or it.special) and not it.run:
		c.face = atan2(tgt.x - p.x, tgt.z - p.z)
	p.data["guard"] = fighting
	if story:
		story.update(dt)
	var driving := false
	if streets:
		streets.update(dt, it)
		driving = streets.player_car != null
	if driving:
		c.mx = 0
		c.mz = 0
		c.punch = false
		c.kick = false
		c.special = false
		c.dodge = false
		c.block = false
	for fi: Fighter in fighters:
		var b = fi.data.get("brain")
		if b and fi.dist_to(p) < 110:
			b.update(fi, dt, self)
	for fi: Fighter in fighters:
		if fi.data.get("in_car", false):
			continue
		if fi.dist_to(p) < 110:
			fi.tick(dt)
	_pop_t += dt
	if _pop_t > 0.25:
		_pop_t = 0
		_manage_peds()
		_manage_groups()
	var keep := []
	for pk: Dictionary in pickups:
		pk.t += dt
		pk.mesh.rotation.y += dt * 3
		pk.mesh.position.y = 0.45 + sin(pk.t * 4) * 0.1
		if Vector2(pk.mesh.position.x - p.x, pk.mesh.position.z - p.z).length() < 1.3 and p.alive:
			money += pk.value
			Sfx.coin()
			hud.toast("+%d ₽" % pk.value, 1.2)
			pk.mesh.queue_free()
			continue
		if pk.t > 60:
			pk.mesh.queue_free()
			continue
		keep.append(pk)
	pickups = keep
	var zn := City.zone_at(p.x, p.z)
	if zn != zone:
		zone = zn
		hud.notice(T.zone(zn).to_upper(), T.t("roam.own_turf") if zn == "universam" else T.t("roam.foreign"), 2)
	hud.set_stats(money, authority, zn)
	if streets and streets.player_car:
		_render_only(dt, it.look_x, it.look_y, streets.player_car.speed > 1, false, streets.player_car.heading)
	else:
		_render_only(dt, it.look_x, it.look_y, Vector2(mx, mz).length() > 0.1, fighting)

func _render_only(dt: float, look_x := 0.0, look_y := 0.0, moving := false, fighting := false, heading = null) -> void:
	var p: Fighter = players[0]
	if dt > 0:
		cam.update(dt, p.x, p.z, heading if heading != null else p.heading, moving, look_x, look_y, fighting)
	var cp := camera.position
	fill.position = Vector3(p.x + (cp.x - p.x) * 0.4, 3, p.z + (cp.z - p.z) * 0.4)
	Game.env.update(dt, Vector3(p.x, 0, p.z))
	city.update(time)
	var others := fighters.filter(func(f): return not players.has(f))
	var cost: float = Attacks.get_attack(p.special if p.special != "" else "flurry").stamina
	hud.update(dt, camera, players, others, cam.yaw, [cost])

func _nearest_threat(p: Fighter) -> Fighter:
	var best: Fighter = null
	var bs := 1e9
	for o: Fighter in fighters:
		if o == p or not o.alive or o.grounded:
			continue
		var b = o.data.get("brain")
		var hostile: bool = (b != null and b.mode == "fight" and b.target == p) or o.team == "razezd" or o.team == "hadi" or o == p.last_attacker
		if not hostile:
			continue
		var dx := o.x - p.x
		var dz := o.z - p.z
		var d := sqrt(dx * dx + dz * dz)
		if d > 6:
			continue
		var ang := absf(wrapf(atan2(dx, dz) - p.heading, -PI, PI))
		var score := d + ang * 1.2
		if score < bs:
			bs = score
			best = o
	return best

func dispose() -> void:
	TouchUI.set_shown(false)
	Game.capture_mouse(false)
	Game.time_scale = 1
	if streets:
		streets.dispose()
	if story:
		story.dispose()
	hud.dispose()
	actor_layer.queue_free()
