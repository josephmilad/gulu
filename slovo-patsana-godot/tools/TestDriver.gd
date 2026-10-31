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
	match name:
		"roam":
			Game.set_mode(FreeRoam.new().init("adidas", func(): get_tree().quit()))
		"roam_bonus":
			Game.set_mode(FreeRoam.new().init("bonus1", func(): get_tree().quit()))
	set_process(true)

func shot(name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png("/tmp/sp/t_%s.png" % name)
	print("shot ", name, " t=%.2f" % t)

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

func _process(dt: float) -> void:
	t += dt
	var m = Game.mode
	if not (m is FreeRoam):
		return
	match test:
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
