extends Node
## Scripted play-throughs for headless checks: `godot -- --test roam`.
## Drives the real modes through PlayerInput and Input actions, prints state, saves shots.

var test := ""
var t := 0.0
var step := 0
var shots := 0

func run(name: String) -> void:
	test = name
	print("TEST ", name)
	# Skip 3D rendering between screenshots so the logic runs at full speed.
	get_viewport().disable_3d = true
	match name:
		"roam":
			Game.set_mode(FreeRoam.new().init("adidas", func(): get_tree().quit()))
		"roam_bonus":
			Game.set_mode(FreeRoam.new().init("bonus1", func(): get_tree().quit()))
		"drive":
			Game.set_mode(FreeRoam.new().init("adidas", func(): get_tree().quit()))
		"menu":
			get_parent().menu(false)
		"menu_en":
			Game.lang = "en"
			get_parent().menu(false)
		"versus":
			Game.set_mode(Versus.new().init(["adidas", "kashchey"], true, func(): get_tree().quit()))
		"story":
			Game.set_story_progress(0)
			Game.set_mode(FreeRoam.new().init("palto", func(): get_tree().quit(), {"story": true}))
	set_process(true)

func shot(name: String) -> void:
	get_viewport().disable_3d = false
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png("/tmp/sp/t_%s.png" % name)
	print("shot ", name, " t=%.2f" % t)
	get_viewport().disable_3d = true

func press(action: String) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = true
	Input.parse_input_event(ev)
	get_tree().create_timer(0.08).timeout.connect(func():
		var up := InputEventAction.new()
		up.action = action
		up.pressed = false
		Input.parse_input_event(up))

func state() -> String:
	var m = Game.mode
	if m == null or not (m is FreeRoam):
		return "no mode"
	var p: Fighter = m.players[0]
	var near: Array = m.fighters.filter(func(f): return f != p and f.dist_to(p) < 12).map(func(f): return "%s:%s:%d@%.1f" % [f.fname, f.team, f.hp, f.dist_to(p)])
	return "pos=(%.1f,%.1f) hp=%d st=%d state=%d anim=%s speed=%.1f fighters=%d money=%d near=%s" % [p.x, p.z, p.hp, p.stamina, p.state, p.body.current, p.body.speed, m.fighters.size(), m.money, near]

func _process(raw_dt: float) -> void:
	var dt := minf(raw_dt, 0.05)
	t += dt
	var m = Game.mode
	if test in ["roam", "roam_bonus", "drive"] and not (m is FreeRoam):
		return
	match test:
		"menu", "menu_en":
			_menu()
			return
		"versus":
			_versus()
			return
		"story":
			if m is FreeRoam:
				_story(m)
			return
		"drive":
			_drive(m)
		"roam", "roam_bonus":
			if step == 0 and t > 1.0:
				step = 1
				print("start ", state())
				shot("roam0")
				PlayerInput.stick = Vector2(0, 1)   # walk forward
			elif step == 1 and t > 3.0:
				step = 2
				PlayerInput.stick = Vector2(0.3, 1)  # sprint-ish diagonal
			elif step == 2 and t > 5.0:
				step = 3
				PlayerInput.stick = Vector2.ZERO
				print("walked ", state())
				shot("roam1")
				# Teleport a gang member next to us and start a fight.
				var p: Fighter = m.players[0]
				var g: Fighter = m.spawn_npc("razezd", "gang", p.x + 1.4, p.z + 1.2, Vector2(p.x, p.z))
				g.data.brain.engage(g, p, m)
			elif step == 3 and t > 5.5:
				step = 4
				press("punch")
			elif step == 4 and t > 5.8:
				step = 5
				press("punch")
			elif step == 5 and t > 6.1:
				step = 6
				press("punch")
				print("punching ", state())
			elif step == 6 and t > 6.5:
				step = 7
				shot("roam2")
			elif step == 7 and t > 7.0:
				step = 8
				press("kick")
			elif step == 8 and t > 9.0:
				step = 9
				press("special")
			elif step == 9 and t > 11.0:
				step = 10
				print("after fight ", state())
				shot("roam3")
				press("pause")
			elif step == 10 and t > 11.6:
				step = 11
				shot("pause")
				print("paused=", m.paused)
				press("pause")
			elif step == 11 and t > 12.2:
				step = 12
				print("resumed paused=", m.paused, " ", state())
				get_tree().quit()

func carstate(m) -> String:
	var s: Streets = m.streets
	var p: Fighter = m.players[0]
	var pc = s.player_car
	var pol: int = m.fighters.filter(func(f): return f.team == "police").size()
	var cars: Array = s.vehicles.map(func(v): return "%s%s@%d" % [v.kind, "*" if v.siren else "", Vector2(v.x - p.x, v.z - p.z).length()])
	var police: Array = s.vehicles.filter(func(v): return v.data.get("police", false)).map(func(v): return "%s@%d%s" % ["unit", Vector2(v.x - p.x, v.z - p.z).length(), "*" if v.siren else ""])
	return "wanted=%d incar=%s speed=%.0f thr=%.1f hp=%.0f pos=(%.0f,%.0f) officers=%d cars=%d police=%s fps=%d" % [s.wanted, pc != null, (pc.speed * 3.6) if pc else 0.0, pc.input.throttle if pc else 0.0, pc.health if pc else 0.0, p.x, p.z, pol, s.vehicles.size(), police, Engine.get_frames_per_second()]

func _drive(m) -> void:
	var s: Streets = m.streets
	var p: Fighter = m.players[0]
	if step == 0 and t > 1.5:
		step = 1
		print("start ", carstate(m))
		# Walk to the nearest parked car's door.
		var best = null
		var bd := 1e9
		for v in s.vehicles:
			if v.driver == null and v.dist_to_point(p.position) < bd:
				bd = v.dist_to_point(p.position)
				best = v
		if best:
			var d: Vector2 = best.door_pos()
			p.place(d.x, d.y, best.heading)
			m.cam.snap(p.x, p.z, p.heading)
			print("at door of ", best.kind)
	elif step == 1 and t > 2.0:
		step = 2
		press("interact")
	elif step == 2 and t > 2.5:
		step = 3
		print("entered ", carstate(m))
		PlayerInput.stick = Vector2(0, 1)
	elif step == 3 and t > 3.5 and t < 6.5 and int(t * 2) != int((t - get_process_delta_time()) * 2):
		print(" t=%.1f " % t, carstate(m))
	elif step == 3 and t > 6.5:
		step = 4
		PlayerInput.stick = Vector2(0.6, 1)
		print("driving ", carstate(m))
		shot("drive1")
	elif step == 4 and t > 9.0:
		step = 5
		PlayerInput.stick = Vector2(0, 0.4)
		s.add_wanted(2, "test")
	elif step == 5 and t > 15.0:
		step = 6
		print("wanted ", carstate(m))
		shot("drive2")
		PlayerInput.stick = Vector2.ZERO
	elif step == 6 and t > 18.0:
		step = 7
		press("interact")
	elif step == 7 and t > 19.0:
		step = 8
		print("exited ", carstate(m))
	elif step == 8 and t > 24.0:
		step = 9
		print("police ", carstate(m), " hp=", p.hp)
		shot("drive3")
		get_tree().quit()

func key(code: int) -> void:
	var ev := InputEventKey.new()
	ev.keycode = code
	ev.physical_keycode = code
	ev.pressed = true
	Input.parse_input_event(ev)
	get_tree().create_timer(0.06).timeout.connect(func():
		var up := InputEventKey.new()
		up.keycode = code
		up.physical_keycode = code
		up.pressed = false
		Input.parse_input_event(up))

func _menu() -> void:
	if step == 0 and t > 1.0:
		step = 1
		await shot(test + "0")
		key(KEY_X)                      # any key → menu list
	elif step == 1 and t > 2.0:
		step = 2
		await shot(test + "1")
		print("menu mode=", Game.mode.get_class(), " items=", Game.mode.items.size())
		key(KEY_S); 
	elif step == 2 and t > 2.5:
		step = 3
		key(KEY_S)
	elif step == 3 and t > 3.0:
		step = 4
		key(KEY_S)                      # → Сюжет (4th item on desktop)
	elif step == 4 and t > 3.5:
		step = 5
		press("ui_confirm")
	elif step == 5 and t > 5.0:
		step = 6
		print("after confirm mode=", Game.mode.get_class())
		key(KEY_D); 
	elif step == 6 and t > 5.4:
		step = 7
		key(KEY_D)
	elif step == 7 and t > 5.8:
		step = 8
		key(KEY_D)                      # → bonus1
	elif step == 8 and t > 6.3:
		step = 9
		key(KEY_E)
		key(KEY_E)
	elif step == 9 and t > 7.5:
		step = 10
		await shot(test + "2")
		print("select idx=", Game.mode.cursors[0].idx if Game.mode is Select else -1)
		key(KEY_J)
	elif step == 10 and t > 10.0:
		step = 11
		print("playing mode=", Game.mode.get_class(), " story=", (Game.mode.story != null) if Game.mode is FreeRoam else "n/a")
		await shot(test + "3")
		get_tree().quit()

func _versus() -> void:
	var v = Game.mode
	if not (v is Versus):
		return
	if step == 0 and t > 2.5:
		step = 1
		print("versus phase=", v.phase, " round=", v.round)
	elif step == 1 and t > 4.0:
		step = 2
		PlayerInput.stick = Vector2(1, 0)
	elif step == 2 and t > 5.0:
		step = 3
		PlayerInput.stick = Vector2.ZERO
		press("punch")
	elif step == 3 and t > 5.4:
		step = 4
		press("punch")
	elif step == 4 and t > 6.0:
		step = 5
		await shot("versus1")
		var a: Fighter = v.players[0]
		var b: Fighter = v.players[1]
		print("fight hp=", a.hp, "/", b.hp, " dist=%.1f" % a.dist_to(b), " phase=", v.phase)
		# Let the CPU win quickly to see the round flow.
		a.hp = 5
	elif step == 5 and t > 12.0:
		step = 6
		print("round flow: phase=", v.phase, " round=", v.round, " wins=", v.wins, " hp=", v.players[0].hp, "/", v.players[1].hp)
		await shot("versus2")
		get_tree().quit()

func _story(m: FreeRoam) -> void:
	var s = m.story
	var p: Fighter = m.players[0]
	if step == 0 and t > 1.0:
		step = 1
		var at: Vector2 = s.missions[0].start.call()
		p.place(at.x, at.y, 0)
		m.cam.snap(p.x, p.z, 0)
	elif step == 1 and t > 2.5:
		step = 2
		print("story started=", s.cur != null, " dlg=", s.dlg != null, " actors=", s.actors.size())
		await shot("story1")
		press("ui_confirm")
	elif step == 2 and t > 3.5:
		step = 3
		press("ui_confirm")
		press("ui_confirm")
	elif step == 3 and t > 5.0:
		step = 4
		press("ui_confirm")
	elif step == 4 and t > 8.0:
		step = 5
		print("step=", s.cur.i if s.cur else -1, " obj=", s.obj_l.text, " actors=", s.actors.map(func(f): return "%s:%d" % [f.fname, f.hp]))
		await shot("story2")
		get_tree().quit()
