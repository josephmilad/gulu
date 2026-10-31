class_name Versus
extends Node3D
## «Стенка на стенку» (port of VersusMode.ts): a one-on-one duel on the rink, Mortal
## Kombat style: best of three rounds, side-on camera, a crowd behind the boards.
## Player 2 is a second human on the arrow keys, or the CPU.

const ROUND_TIME := 60.0
const WINS_NEEDED := 2

var camera := Camera3D.new()
var fighters: Array = []
var players: Array = []
var grid = null
var city = null
var bounds: Dictionary
var wanted := 0
var layer := Node3D.new()
var crowd: Array = []
var center := Vector3.ZERO
var schemes := ["kbm", "arrows"]
var wins := [0, 0]
var round := 1
var phase := "intro"
var phase_t := 0.0
var timer := ROUND_TIME
var ids: Array = []
var cpu := false
var on_quit: Callable
var defs: Array = []
var ui: Control
var bars: Array = []
var timer_l: Label
var banner: Label
var banner_sub: Label
var cam_side := 1.0
var cam_pos := Vector3.ZERO
var cam_look := Vector3.ZERO
var shake := 0.0
var paused := false
var pause_ui: Control = null
var _banner_hide := 0.0

func init(ids_: Array, cpu_: bool, quit_cb: Callable) -> Versus:
	ids = ids_
	cpu = cpu_
	on_quit = quit_cb
	return self

func _ready() -> void:
	Game.get_world()
	Game.world.add_child(layer)
	add_child(camera)
	camera.fov = 42
	camera.far = 700
	camera.current = true
	Game.capture_mouse(false)
	var c := City.block_center(1, 4)
	center = Vector3(c.x, 0, c.y)
	bounds = {"min_x": c.x - 19, "max_x": c.x + 19, "min_z": c.y - 10.5, "max_z": c.y + 10.5}
	defs = ids.map(func(id): return Characters.by_id(id))
	for i in range(defs.size()):
		var ch: Dictionary = defs[i]
		var f := Fighter.create(layer, self, {"path": Characters.model_path(ch), "hero": true, "hp": ch.hp, "power": ch.power, "speed": ch.speed,
			"special": ch.special, "regen": Characters.regen_of(ch), "team": "razezd" if i == 0 else "hadi", "name": T.call_name(ch), "char_id": ch.id})
		f.data["versus"] = true
		f.data["guard"] = true
		if i == 1 and cpu:
			f.data["brain"] = Brain.new("duel", Vector2(center.x, center.z), 0.85)
		fighters.append(f)
		players.append(f)
	_spawn_crowd()
	_build_hud()
	_start_round()
	Sfx.stop_music()
	Sfx.start_music()
	TouchUI.set_shown(true)

# ---------- Arena / AI world ----------
func on_hit(att: Fighter, _vic: Fighter, res: Dictionary, hit: Dictionary) -> void:
	if res.blocked:
		Sfx.block()
	else:
		Sfx.hit(minf(1.5, hit.dmg / 11.0))
	if res.knockdown:
		get_tree().create_timer(0.38).timeout.connect(func(): Sfx.thud())
	if not res.blocked:
		Game.freeze(0.1 if res.knockdown else 0.05)
		shake = maxf(shake, 1.0 if res.knockdown else 0.4)
	if res.ko and phase == "fight":
		_end_round(players.find(att))

func on_whiff(_att: Fighter) -> void:
	Sfx.whoosh()

func on_step(_f: Fighter) -> void:
	Sfx.step(6)

func bark(_f: Fighter, _text: String) -> void:
	pass

# ---------- Setup ----------
func _spawn_crowd() -> void:
	var c := center
	for i in range(16):
		var side := i % 4
		var t: float = (float(i / 4) / 3 - 0.5) * (34 if side < 2 else 18) + (randf() - 0.5) * 3
		var x: float = c.x + t if side < 2 else c.x + (-23.2 if side == 2 else 23.2)
		var z: float = c.z + (-14 if side == 0 else 14) if side < 2 else c.z + t
		var spec := Looks.civil_spec()
		var b := Body.new()
		layer.add_child(b)
		b.setup(spec.path, spec)
		b.position = Vector3(x, 0, z)
		b.rotation.y = atan2(c.x - x, c.z - z)
		b.play("yes" if randf() < 0.5 else "talk")
		crowd.append(b)

func _build_hud() -> void:
	ui = Control.new()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i in range(defs.size()):
		var ch: Dictionary = defs[i]
		var side := HBoxContainer.new()
		side.add_theme_constant_override("separation", 12)
		var por := UI.portrait(Game.portraits.get(ch.id), 72, UI.RED if i == 0 else Color("#3b7bd2"))
		var col := VBoxContainer.new()
		col.custom_minimum_size.x = 420
		var nm := UI.label(T.full_title(ch), 22, UI.PAPER, true)
		var hp := UI.bar(420, 22, Color("#f0b030"), Color(0, 0, 0, 0.65))
		var lag := ColorRect.new()
		lag.color = Color("#dd2233")
		lag.size = Vector2(420, 22)
		lag.mouse_filter = Control.MOUSE_FILTER_IGNORE
		hp.wrap.add_child(lag)
		hp.wrap.move_child(lag, 0)
		var st := UI.bar(420, 6, Color("#2fa3ff"), Color(0, 0, 0, 0.6))
		var pips := UI.label("", 20, UI.GOLD, true)
		col.add_child(nm)
		col.add_child(hp.wrap)
		col.add_child(st.wrap)
		col.add_child(pips)
		if i == 1:
			side.add_child(col)
			side.add_child(por)
			nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			pips.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			side.anchor_left = 1
			side.anchor_right = 1
			side.offset_left = -520
			side.offset_right = -20
			side.offset_top = 16
		else:
			side.add_child(por)
			side.add_child(col)
			side.position = Vector2(20, 16)
		ui.add_child(side)
		bars.append({"hp": hp, "lag": lag, "st": st, "pips": pips, "right": i == 1})
	timer_l = UI.label("60", 56, Color.WHITE, true)
	timer_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	timer_l.anchor_left = 0.5
	timer_l.anchor_right = 0.5
	timer_l.grow_horizontal = Control.GROW_DIRECTION_BOTH
	timer_l.offset_top = 14
	ui.add_child(timer_l)
	banner = UI.label("", 110, UI.GOLD, true)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.anchor_right = 1
	banner.anchor_top = 0.3
	banner.anchor_bottom = 0.3
	banner.grow_vertical = Control.GROW_DIRECTION_BOTH
	banner.modulate.a = 0
	ui.add_child(banner)
	banner_sub = UI.label("", 24, UI.PAPER, false, true)
	banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_sub.anchor_right = 1
	banner_sub.anchor_top = 0.3
	banner_sub.anchor_bottom = 0.3
	banner_sub.offset_top = 80
	banner_sub.modulate.a = 0
	ui.add_child(banner_sub)
	var help := UI.label(T.t("vs.help_cpu") if cpu else T.t("vs.help_2p"), 14, Color(1, 1, 1, 0.75))
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	help.anchor_right = 1
	help.anchor_top = 1
	help.anchor_bottom = 1
	help.offset_top = -40
	help.visible = not Game.touch
	ui.add_child(help)
	Game.ui_layer.add_child(ui)

func _start_round() -> void:
	for i in range(players.size()):
		var f: Fighter = players[i]
		f.revive()
		f.place(center.x + (-3.2 if i == 0 else 3.2), center.z, PI / 2 if i == 0 else -PI / 2)
	timer = ROUND_TIME
	phase = "intro"
	phase_t = 0
	_say(T.t("vs.round") % round, UI.GOLD)
	Sfx.confirm()

func _say(text: String, color: Color, sub := "") -> void:
	banner.text = text
	banner.add_theme_color_override("font_color", color)
	banner.modulate.a = 1
	banner_sub.text = sub
	banner_sub.modulate.a = 1 if sub != "" else 0
	_banner_hide = 0

func _end_round(winner: int) -> void:
	phase = "ko"
	phase_t = 0
	if winner >= 0:
		wins[winner] += 1
	Game.time_scale = 0.35
	Sfx.ko()
	_say(T.t("vs.ko") if winner >= 0 else T.t("vs.time"), UI.RED)
	if winner >= 0:
		get_tree().create_timer(0.9).timeout.connect(func(): players[winner].body.play("victory"))

# ---------- Input ----------
func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("pause"):
		_toggle_pause()
	elif phase == "over" and e.is_action_pressed("ui_confirm"):
		wins = [0, 0]
		round = 1
		_start_round()

func _toggle_pause() -> void:
	paused = not paused
	TouchUI.set_shown(not paused)
	if pause_ui:
		pause_ui.queue_free()
		pause_ui = null
	if not paused:
		return
	var ov := UI.overlay(T.t("pause"))
	var b1 := UI.button(T.t("pause.resume"))
	b1.pressed.connect(func():
		Sfx.confirm()
		_toggle_pause())
	var b2 := UI.button(T.t("menu.main"))
	b2.pressed.connect(func():
		Sfx.confirm()
		on_quit.call())
	ov.col.add_child(b1)
	ov.col.add_child(b2)
	ui.add_child(ov.root)
	pause_ui = ov.root
	b1.grab_focus()

# ---------- Frame ----------
func _process(raw_dt: float) -> void:
	if paused:
		return
	var dt := minf(raw_dt, 0.05)
	var a: Fighter = players[0]
	var b: Fighter = players[1]
	phase_t += dt / maxf(0.2, Game.time_scale)
	var can_fight := phase == "fight"
	if phase == "intro" and phase_t > 1.6:
		phase = "fight"
		_say(T.t("vs.fight"), UI.RED)
		_banner_hide = 0.9
	if _banner_hide > 0:
		_banner_hide -= dt
		if _banner_hide <= 0 and phase == "fight":
			banner.modulate.a = 0
			banner_sub.modulate.a = 0
	if phase == "fight":
		timer -= dt
		if timer <= 0:
			timer = 0
			var ka := a.hp / a.max_hp
			var kb := b.hp / b.max_hp
			_end_round(0 if ka > kb else (1 if kb > ka else -1))
	if phase == "ko" and phase_t > 3.2:
		Game.time_scale = 1
		var champ := -1
		for i in range(2):
			if wins[i] >= WINS_NEEDED:
				champ = i
		if champ >= 0:
			phase = "over"
			phase_t = 0
			var d: Dictionary = defs[champ]
			var who := T.t("vs.who_cpu") if (cpu and champ == 1) else (T.t("vs.who_you") if cpu else T.t("vs.who_player") % (champ + 1))
			_say(T.t("vs.wins") % T.name(d, "name").to_upper(), UI.GOLD, "%s · %s\n%s" % [who, T.quote(d, 1), T.t("vs.again")])
			players[champ].body.play("victory")
		else:
			round += 1
			_start_round()
	var fwd := (cam_look - cam_pos)
	fwd.y = 0
	fwd = fwd.normalized() if fwd.length() > 0.01 else Vector3(0, 0, -1)
	var right := Vector3(-fwd.z, 0, fwd.x)
	for i in range(2):
		var f: Fighter = players[i]
		var o: Fighter = players[1 - i]
		var c := f.ctrl
		var brain = f.data.get("brain")
		if brain:
			if can_fight:
				brain.update(f, dt, self)
			else:
				c.mx = 0.0
				c.mz = 0.0
				c.speed = 0.0
				c.punch = false
				c.kick = false
				c.special = false
				c.block = false
				c.dodge = false
			c.face = atan2(o.x - f.x, o.z - f.z)
		else:
			var it := PlayerInput.read(schemes[i], dt)
			c.mx = right.x * it.move_x + fwd.x * it.move_y
			c.mz = right.z * it.move_x + fwd.z * it.move_y
			var l := Vector2(c.mx, c.mz).length()
			if l > 1:
				c.mx /= l
				c.mz /= l
			c.speed = 4.5 if it.run else 2.8
			c.punch = can_fight and it.punch
			c.kick = can_fight and it.kick
			c.special = can_fight and it.special
			c.block = can_fight and it.block
			c.dodge = can_fight and it.dodge
			if not can_fight:
				c.mx = 0.0
				c.mz = 0.0
			c.face = atan2(o.x - f.x, o.z - f.z)
	for f: Fighter in players:
		f.tick(dt)
	for cb: Body in crowd:
		cb.speed = 0
		if cb.current == "" and randf() < dt * 0.3:
			cb.play("yes" if randf() < 0.5 else "talk")
	_update_camera(dt)
	_update_hud()
	Game.env.update(dt, center)
	Game.city.update(phase_t)

func _update_camera(dt: float) -> void:
	var a: Fighter = players[0]
	var b: Fighter = players[1]
	var mid := Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2)
	var axis := Vector3(b.x - a.x, 0, b.z - a.z)
	var sep := maxf(1, axis.length())
	axis = axis.normalized()
	var n := Vector3(-axis.z, 0, axis.x) * cam_side
	var cur := cam_pos - mid
	cur.y = 0
	if cur.length_squared() > 1 and cur.dot(n) < 0:
		cam_side *= -1
		n = -n
	var dist := clampf(sep * 0.75 + 4.2, 5.5, 13)
	var want := mid + n * dist
	want.y = 1.9 + dist * 0.08
	if cam_pos.length_squared() == 0:
		cam_pos = want
	var k := 1 - exp(-5 * dt)
	cam_pos = cam_pos.lerp(want, k)
	cam_look = Vector3(mid.x, 1.15, mid.z)
	camera.position = cam_pos
	if shake > 0:
		shake = maxf(0, shake - dt * 3)
		camera.position.x += (randf() - 0.5) * shake * 0.2
		camera.position.y += (randf() - 0.5) * shake * 0.2
	camera.look_at(cam_look)

func _update_hud() -> void:
	for i in range(2):
		var f: Fighter = players[i]
		var bar: Dictionary = bars[i]
		var k := maxf(0, f.hp / f.max_hp)
		UI.set_bar(bar.hp, k)
		var lag: ColorRect = bar.lag
		lag.size.x = lerpf(lag.size.x, 420 * k, 0.05)
		if bar.right:
			bar.hp.fill.position.x = 420 - bar.hp.fill.size.x
			lag.position.x = 420 - lag.size.x
		UI.set_bar(bar.st, f.stamina / 100.0)
		var cost: float = Attacks.get_attack(f.special if f.special != "" else "flurry").stamina
		bar.st.fill.color = UI.GOLD if f.stamina >= cost else Color("#2fa3ff")
		if bar.right:
			bar.st.fill.position.x = 420 - bar.st.fill.size.x
		var pips := ""
		for w in range(WINS_NEEDED):
			pips += "●" if w < wins[i] else "○"
		bar.pips.text = pips
	timer_l.text = str(ceili(timer))
	timer_l.add_theme_color_override("font_color", Color("#ff4a3a") if timer < 10 else Color.WHITE)

func dispose() -> void:
	TouchUI.set_shown(false)
	Game.time_scale = 1
	layer.queue_free()
	ui.queue_free()
	Sfx.stop_music()
