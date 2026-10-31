class_name Story
## Story missions on top of free roam (port of game/Story.ts): a marker shows where the
## next one starts, then a list of steps (talk, go somewhere, beat people) runs with an
## objective line, a minimap target and an optional timer. Progress is saved.

var m: FreeRoam
var player_id := ""
var progress := 0
var missions: Array = []
var cur = null          # {m, steps, i, t, timer}
var actors: Array = []
var marker: Node3D
var obj_l: Label
var dlg_ui: Control
var dlg_por: TextureRect
var dlg_name: Label
var dlg_text: Label
var dlg = null          # {lines, i, t}
var cooldown := 0.0
var ru: bool:
	get: return Game.lang != "en"

func setup(mode: FreeRoam, pid: String) -> void:
	m = mode
	player_id = pid
	progress = clampi(Game.story_progress(), 0, 3)
	missions = [_join_up(), _video_salon(), _rink()]
	marker = _make_marker()
	m.actor_layer.add_child(marker)
	obj_l = UI.label("", 19, UI.PAPER)
	obj_l.add_theme_stylebox_override("normal", UI.box(Color(0.02, 0.024, 0.04, 0.7), Color(0, 0, 0, 0), 0, 8))
	obj_l.position = Vector2(20, 104)
	obj_l.visible = false
	m.hud.add_child(obj_l)
	dlg_ui = PanelContainer.new()
	dlg_ui.add_theme_stylebox_override("panel", UI.box(Color(0.02, 0.024, 0.04, 0.85), Color(1, 1, 1, 0.15), 0, 12))
	dlg_ui.anchor_left = 0.5
	dlg_ui.anchor_right = 0.5
	dlg_ui.anchor_top = 1
	dlg_ui.anchor_bottom = 1
	dlg_ui.grow_horizontal = Control.GROW_DIRECTION_BOTH
	dlg_ui.offset_top = -150
	dlg_ui.offset_bottom = -64
	dlg_ui.custom_minimum_size.x = 760
	dlg_ui.mouse_filter = Control.MOUSE_FILTER_STOP
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	dlg_por = TextureRect.new()
	dlg_por.custom_minimum_size = Vector2(72, 72)
	dlg_por.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	dlg_por.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	row.add_child(dlg_por)
	var col := VBoxContainer.new()
	dlg_name = UI.label("", 17, UI.GOLD, true)
	dlg_text = UI.label("", 21)
	dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dlg_text.custom_minimum_size.x = 640
	col.add_child(dlg_name)
	col.add_child(dlg_text)
	col.add_child(UI.label(T.t("story.enter"), 13, UI.MUTED))
	row.add_child(col)
	dlg_ui.add_child(row)
	dlg_ui.visible = false
	dlg_ui.gui_input.connect(func(e):
		if e is InputEventMouseButton and e.pressed:
			_next_line())
	m.hud.add_child(dlg_ui)
	if progress < missions.size():
		var ms: Dictionary = missions[progress]
		m.get_tree().create_timer(3.8).timeout.connect(func():
			if is_instance_valid(m):
				m.hud.notice(T.t("story.title"), T.t("story.next") % [progress + 1, ms.title.call()], 4))

static func progress_saved() -> int:
	return Game.story_progress()

var active: bool:
	get: return cur != null

# ---------- helpers ----------
func _pn() -> String:
	return T.call_name(Characters.by_id(player_id))

func _free(x: float, z: float) -> Vector2:
	var p := Vector2(x, z)
	for k in range(4):
		p = m.grid.resolve_circle(p.x, p.y, 1.2)
	return p

func _place(lname: String, dx := 0.0, dz := 0.0) -> Vector2:
	for l in m.city.landmarks:
		if l.name == lname:
			return _free(l.x + dx, l.z + dz)
	return _free(dx, dz)

func _has(id: String) -> bool:
	return id != player_id and ResourceLoader.exists(Characters.model_path(Characters.by_id(id)))

func _cast(prefs: Array, not_id := "") -> String:
	for id in prefs:
		if id != not_id and _has(id):
			return id
	for id in ["adidas", "kashchey", "palto", "turbo", "zima"]:
		if id != not_id and _has(id):
			return id
	return "kashchey"

## spec: id?, team, role, name?, hp, power?, skill?, special?, look?, tint?, scale?, hunt?, spar?
func _spawn(s: Dictionary, x: float, z: float) -> Fighter:
	var o := {}
	var fname: String = s.get("name", "")
	var special: String = s.get("special", "")
	if s.has("id"):
		var ch := Characters.by_id(s.id)
		o["path"] = Characters.model_path(ch)
		o["hero"] = true
		if fname == "":
			fname = T.call_name(ch)
		if special == "":
			special = ch.special
		o["char_id"] = s.id
	else:
		var look: String = s.get("look", "hadi" if s.team == "hadi" else ("razezd" if s.team == "razezd" else "universam"))
		var spec := Looks.gang_spec(look)
		o["path"] = spec.path
		o["tint"] = s.get("tint", spec.tint)
		o["tint_amt"] = spec.tint_amt
		o["scale"] = s.get("scale", spec.scale)
	o.merge({"hp": s.hp, "power": s.get("power", 0.85), "speed": 1.0, "special": special, "team": s.team, "name": fname})
	var f := Fighter.create(m.actor_layer, m, o)
	var p: Fighter = m.players[0]
	f.place(x, z, atan2(p.x - x, p.z - z))
	var b := Brain.new(s.role, Vector2(x, z), s.get("skill", 0.45))
	b.hunt = s.get("hunt", false)
	f.data["brain"] = b
	if s.get("spar", false):
		f.data["spar"] = true
	f.data["story"] = true
	m.add_fighter(f)
	actors.append(f)
	return f

func _attack(f: Fighter, target: Fighter) -> void:
	f.data.brain.engage(f, target, m, false)

func _wave(n: int, x: float, z: float, spec: Dictionary, names: Array) -> Array:
	var out := []
	for i in range(n):
		var a := TAU * i / n
		var at := _free(x + cos(a) * 2.5, z + sin(a) * 2.5)
		var s := spec.duplicate()
		s.merge({"hp": spec.get("hp", 60), "name": names[i % names.size()], "hunt": true}, true)
		var f := _spawn(s, at.x, at.y)
		_attack(f, m.players[0])
		out.append(f)
	return out

func _clear() -> void:
	for f in actors:
		if is_instance_valid(f):
			m.remove_fighter(f)
	actors = []

func _alive(list: Array) -> int:
	return list.filter(func(f): return is_instance_valid(f) and f.alive).size()

func _make_marker() -> Node3D:
	var g := Node3D.new()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1, 0.78, 0.23, 0.35)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.no_depth_test = false
	var beam := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.1
	cm.bottom_radius = 1.1
	cm.height = 7
	cm.radial_segments = 24
	cm.cap_top = false
	cm.cap_bottom = false
	beam.mesh = cm
	beam.material_override = mat
	beam.position.y = 3.5
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 1.0
	tm.outer_radius = 1.35
	ring.mesh = tm
	var rm := mat.duplicate()
	rm.albedo_color = Color(1, 0.78, 0.23, 0.9)
	ring.material_override = rm
	ring.position.y = 0.06
	ring.scale = Vector3(1, 0.1, 1)
	var light := OmniLight3D.new()
	light.light_color = Color(1, 0.69, 0.19)
	light.light_energy = 2
	light.omni_range = 10
	light.position.y = 1.5
	g.add_child(beam)
	g.add_child(ring)
	g.add_child(light)
	g.visible = false
	return g

# ---------- dialogue ----------
func _say(lines: Array) -> void:
	dlg = {"lines": lines, "i": 0, "t": 0.0}
	_show_line()

func _show_line() -> void:
	var l: Dictionary = dlg.lines[dlg.i]
	var who: String = l.who
	var pid := player_id if who == "me" else who
	var ch := Characters.by_id(pid)
	var nm: String = T.call_name(ch) if not ch.is_empty() else who
	dlg_name.text = nm
	dlg_text.text = l.text
	dlg_por.texture = Game.portraits.get(pid)
	dlg_por.visible = dlg_por.texture != null
	dlg_ui.visible = true
	Sfx.ui()

func _next_line() -> void:
	if dlg == null:
		return
	dlg.i += 1
	dlg.t = 0.0
	if dlg.i >= dlg.lines.size():
		dlg = null
		dlg_ui.visible = false
	else:
		_show_line()

# ---------- flow ----------
func _begin(ms: Dictionary) -> void:
	cur = {"m": ms, "steps": ms.steps.call(), "i": -1, "t": 0.0, "timer": 0.0}
	marker.visible = false
	Sfx.confirm()
	m.hud.notice(ms.title.call().to_upper(), ms.sub.call(), 3)
	_next_step()

func _next_step() -> void:
	cur.i += 1
	cur.t = 0.0
	if cur.i >= cur.steps.size():
		_complete()
		return
	var s: Dictionary = cur.steps[cur.i]
	cur.timer = s.get("timer", 0.0)
	if s.has("start"):
		s.start.call()
	if s.has("talk"):
		_say(s.talk.call())

func _complete() -> void:
	var ms: Dictionary = cur.m
	m.money += ms.reward.money
	m.authority += ms.reward.auth
	progress += 1
	Game.set_story_progress(progress)
	Sfx.ko()
	m.hud.notice(T.t("story.done"), T.t("story.done_sub") % [ms.title.call(), ms.reward.money, ms.reward.auth], 4)
	if progress >= missions.size():
		m.get_tree().create_timer(4.2).timeout.connect(func():
			if is_instance_valid(m):
				m.hud.notice(T.t("story.all_done"), T.t("story.all_done_sub"), 5))
	cur = null
	obj_l.visible = false
	m.hud.target = null
	var done := actors
	actors = []
	m.get_tree().create_timer(20.0).timeout.connect(func():
		if is_instance_valid(m):
			for f in done:
				if is_instance_valid(f):
					m.remove_fighter(f))
	cooldown = 6

func fail(reason: String) -> void:
	if cur == null:
		return
	Sfx.ko()
	m.hud.notice(T.t("story.failed"), reason, 4)
	cur = null
	dlg = null
	dlg_ui.visible = false
	obj_l.visible = false
	m.hud.target = null
	_clear()
	cooldown = 6

func on_wasted() -> void:
	fail(T.t("story.wasted"))

func update(dt: float) -> void:
	var p: Fighter = m.players[0]
	cooldown -= dt
	if Input.is_action_just_pressed("ui_confirm") and dlg != null:
		_next_line()
	if dlg != null:
		dlg.t += dt
		if dlg.t > maxf(2.8, dlg.lines[dlg.i].text.length() * 0.06):
			_next_line()
	if cur == null:
		var next = missions[progress] if progress < missions.size() else null
		marker.visible = next != null
		if next == null:
			return
		var at: Vector2 = next.start.call()
		marker.position = Vector3(at.x, 0, at.y)
		marker.rotation.y += dt
		m.hud.target = {"x": at.x, "z": at.y}
		var d := Vector2(p.x - at.x, p.z - at.y).length()
		if cooldown <= 0 and p.alive and (m.streets == null or m.streets.player_car == null) and d < 1.8:
			_begin(next)
		elif d < 8:
			m.hud.prompt(T.t("story.start_prompt") % [progress + 1, next.title.call()])
		return
	var s: Dictionary = cur.steps[cur.i]
	cur.t += dt
	if s.has("fail"):
		var why = s.fail.call()
		if why != null:
			fail(why)
			return
	if s.get("timer", 0.0) > 0:
		cur.timer -= dt
		if cur.timer <= 0:
			fail(T.t("story.late"))
			return
	var text := ""
	if s.has("obj"):
		text = s.obj.call() if s.obj is Callable else s.obj
	if s.has("at"):
		var at: Vector2 = s.at.call()
		var d := Vector2(p.x - at.x, p.z - at.y).length()
		marker.visible = true
		marker.position = Vector3(at.x, 0, at.y)
		marker.rotation.y += dt
		m.hud.target = {"x": at.x, "z": at.y}
		text += "  %d м" % roundi(d) if ru else "  %d m" % roundi(d)
	else:
		marker.visible = false
		m.hud.target = null
	if s.get("timer", 0.0) > 0:
		text += "  %d:%02d" % [floori(cur.timer / 60), int(cur.timer) % 60]
	obj_l.visible = text != "" and dlg == null
	obj_l.text = text
	if s.has("talk"):
		if dlg == null:
			_next_step()
		return
	if s.has("at"):
		var at: Vector2 = s.at.call()
		if Vector2(p.x - at.x, p.z - at.y).length() < s.get("radius", 2.5) and (not s.has("done") or s.done.call()):
			_next_step()
		return
	if s.has("done") and s.done.call():
		_next_step()

func dispose() -> void:
	_clear()
	if is_instance_valid(marker):
		marker.queue_free()

# ---------- the missions ----------
## Text in the current language: _l("русский", "English").
func _l(r: String, e: String) -> String:
	return r if ru else e

func _join_up() -> Dictionary:
	var st := {"giver": "", "spar": [], "boss": null}
	return {
		"title": func(): return _l("Пришиться", "Joining the Club"),
		"sub": func(): return _l("Миссия 1 · Школьный двор", "Mission 1 · The school yard"),
		"start": func(): return _place("Школа", 14, 16),
		"reward": {"money": 50, "auth": 20},
		"steps": func():
			st.giver = _cast(["adidas", "kashchey", "turbo"])
			var school := _place("Школа", 14, 16)
			var g: String = st.giver
			return [
				{"start": func(): st.boss = _spawn({"id": g, "team": "universam", "role": "ally", "hp": 160, "skill": 0.7}, school.x + 2.5, school.y + 1.5),
				 "talk": func(): return [
					{"who": g, "text": _l("Слышь, %s. Говорят, к Универсаму пришиться хочешь?" % _pn(), "I say, %s. Word is you'd like to join the Emporium?" % _pn())},
					{"who": "me", "text": _l("Хочу.", "I would.")},
					{"who": g, "text": _l("Пацаном не рождаются. Вон скорлупа — покажи, что ты не чушпан.", "Nobody is born a gentleman. There are the young set: show us you're no mere civilian.")},
					{"who": g, "text": _l("По-честному, без ножей и без толпы. Давай.", "Fair play: no knives, no mob. Off you go.")}]},
				{"start": func():
					st.spar = []
					for i in range(2):
						var at := _free(school.x - 5 + i * 2, school.y - 4)
						var f := _spawn({"team": "razezd", "role": "gang", "look": "universam", "name": _l("Скорлупа", "Young 'un") if i else _l("Мелкий", "Titch"), "hp": 55, "power": 0.7, "skill": 0.35, "spar": true, "hunt": true}, at.x, at.y)
						_attack(f, m.players[0])
						st.spar.append(f),
				 "obj": func(): return _l("Победи скорлупу: %d/2", "Beat the young set: %d of 2") % (2 - _alive(st.spar)),
				 "done": func(): return _alive(st.spar) == 0},
				{"talk": func(): return [
					{"who": g, "text": _l("Нормально. Теперь ты с нами.", "Not bad at all. You're with us now.")},
					{"who": g, "text": _l("Запомни: пацаны не извиняются и своих не бросают. Слово пацана — закон.", "Remember: a gentleman never apologises and never abandons his own. A gentleman's word is law.")},
					{"who": g, "text": _l("Сегодня сбор у качалки. Опоздаешь — можешь не приходить.", "The club meets at the gymnasium tonight. Arrive late and don't bother arriving.")}]},
				{"start": func():
					var gym := _place("Качалка", 0, 3)
					if st.boss:
						st.boss.place(gym.x + 2, gym.y, 0)
						st.boss.data.brain.home = Vector2(gym.x + 2, gym.y)
					for i in range(3):
						var at := _free(gym.x - 2 + i * 1.5, gym.y + 2.5)
						_spawn({"team": "universam", "role": "ally", "look": "universam", "name": [_l("Сява", "Sid"), _l("Лампа", "Lamp"), _l("Ералаш", "Jester")][i], "hp": 90}, at.x, at.y),
				 "obj": func(): return _l("Доберись до качалки к началу сбора", "Reach the gymnasium before the meeting starts"),
				 "at": func(): return _place("Качалка", 0, 3), "radius": 4.0, "timer": 110.0},
				{"talk": func(): return [
					{"who": g, "text": _l("Все в сборе. Пацаны, это %s. Теперь он с нами." % _pn(), "All present. Gentlemen, this is %s. He's with us now." % _pn())},
					{"who": _l("Пацаны", "The chaps"), "text": _l("Универсам!", "The Emporium!")},
					{"who": g, "text": _l("Завтра будет работа. Отдыхай.", "There'll be work tomorrow. Rest up.")}]},
			],
	}

func _video_salon() -> Dictionary:
	var st := {"giver": "", "second": "", "w1": [], "w2": []}
	return {
		"title": func(): return _l("Видеосалон", "The Video Salon"),
		"sub": func(): return _l("Миссия 2 · Разъезд", "Mission 2 · The Junction"),
		"start": func(): return _place("Видеосалон", -2, 4),
		"reward": {"money": 120, "auth": 30},
		"steps": func():
			st.giver = _cast(["turbo", "zima", "kashchey", "adidas"])
			st.second = _cast(["zima", "adidas", "kashchey"], st.giver)
			var hall := _place("Видеосалон", -2, 4)
			var g: String = st.giver
			var s2: String = st.second
			return [
				{"start": func():
					_spawn({"id": g, "team": "universam", "role": "ally", "hp": 140, "skill": 0.6}, hall.x + 2, hall.y + 1.5)
					_spawn({"id": s2, "team": "universam", "role": "ally", "hp": 140, "skill": 0.6}, hall.x - 2, hall.y + 1.5),
				 "talk": func(): return [
					{"who": g, "text": _l("%s, разъездовские наехали на видеосалон. Хозяин платит нам — значит, мы его и защищаем." % _pn(), "%s, the Junction lot are leaning on the video salon. The owner pays us, so we're the ones who protect him." % _pn())},
					{"who": s2, "text": _l("Идут. Человек пять, не меньше.", "Here they come. Five of them at the least.")},
					{"who": g, "text": _l("Встречаем. Никто не бежит.", "We receive them. Nobody runs.")}]},
				{"start": func():
					st.w1 = _wave(3, hall.x - 16, hall.y + 10, {"team": "razezd", "role": "gang", "hp": 65, "skill": 0.45}, [_l("Шмыга", "Shifty"), _l("Рыжий", "Ginger"), _l("Батон", "Loaf")])
					for f in actors:
						if f.team == "universam":
							_attack(f, st.w1[0]),
				 "obj": func(): return _l("Отбейся от разъездовских · волна 1/2 · осталось %d", "Hold off the Junction · wave 1 of 2 · %d left") % _alive(st.w1),
				 "done": func(): return _alive(st.w1) == 0},
				{"talk": func(): return [{"who": s2, "text": _l("Это ещё не всё! Сам Жёлтый идёт.", "That's not all of them! Yellow himself is coming.")}]},
				{"start": func():
					st.w2 = _wave(3, hall.x + 14, hall.y + 12, {"team": "razezd", "role": "gang", "hp": 70, "skill": 0.5}, [_l("Косой", "Squint"), _l("Гвоздь", "Nail"), _l("Сухой", "Lean")])
					var boss := _spawn({"team": "razezd", "role": "gang", "name": _l("Жёлтый", "Yellow"), "hp": 170, "power": 1.1, "skill": 0.75, "special": "haymaker", "tint": Color("#b8a020"), "scale": 1.06, "hunt": true}, hall.x + 15, hall.y + 9)
					_attack(boss, m.players[0])
					st.w2.append(boss)
					for f in actors:
						if f.team == "universam" and f.alive:
							_attack(f, st.w2[0]),
				 "obj": func(): return _l("Отбейся от разъездовских · волна 2/2 · осталось %d", "Hold off the Junction · wave 2 of 2 · %d left") % _alive(st.w2),
				 "done": func(): return _alive(st.w2) == 0},
				{"talk": func(): return [
					{"who": g, "text": _l("Вот так. Видеосалон наш.", "There we are. The video salon is ours.")},
					{"who": _l("Хозяин салона", "The salon owner"), "text": _l("Спасибо, пацаны! Вот, за защиту. И приходите на «Рэмбо» бесплатно.", "Thank you, gentlemen! Here, for your protection. And do come and see «Rambo» on the house.")}]},
			],
	}

func _rink() -> Dictionary:
	var st := {"giver": "", "victim_id": "", "victim": null, "hadi": []}
	return {
		"title": func(): return _l("Каток", "The Rink"),
		"sub": func(): return _l("Миссия 3 · Хадишевские", "Mission 3 · The Hadley Street lot"),
		"start": func(): return _place("Универсам", 6, 12),
		"reward": {"money": 200, "auth": 50},
		"steps": func():
			st.giver = _cast(["zima", "turbo", "adidas", "kashchey"])
			st.victim_id = _cast(["marat", "palto"])
			var g: String = st.giver
			var vid: String = st.victim_id
			var vname := T.call_name(Characters.by_id(vid))
			var rink := _place("Каток")
			return [
				{"talk": func(): return [
					{"who": g, "text": _l("%s! Хадишевские зажали %s на катке!" % [_pn(), vname], "%s! The Hadley Street lot have %s cornered at the rink!" % [_pn(), vname])},
					{"who": g, "text": _l("Бери любую тачку и гони туда. Минута — и будет поздно!", "Take any motor you can and drive. A minute more and it'll be too late!")}]},
				{"obj": func(): return _l("Гони на каток! F — сесть в машину", "Race to the rink! F — take a motor car"),
				 "at": func(): return rink, "radius": 16.0, "timer": 80.0},
				{"start": func():
					st.victim = _spawn({"id": vid, "team": "universam", "role": "ally", "hp": 130, "skill": 0.5}, rink.x, rink.y)
					st.hadi = _wave(4, rink.x, rink.y, {"team": "hadi", "role": "gang", "hp": 70, "skill": 0.5}, [_l("Тахир", "Tahir"), _l("Ринат", "Rinat"), _l("Ильдар", "Ildar"), _l("Марс", "Mars")])
					var boss := _spawn({"team": "hadi", "role": "gang", "name": _l("Хади-старший", "Hadley Senior"), "hp": 190, "power": 1.15, "skill": 0.8, "special": "flurry", "tint": Color("#5a3a1a"), "scale": 1.08, "hunt": true}, rink.x + 4, rink.y + 3)
					st.hadi.append(boss)
					for i in range(3):
						_attack(st.hadi[i], st.victim)
					_attack(boss, m.players[0])
					_attack(st.victim, st.hadi[0]),
				 "obj": func(): return _l("Выручай %s! Хадишевских осталось: %d" % [vname, _alive(st.hadi)], "Get %s out of there! Hadley Street left: %d" % [vname, _alive(st.hadi)]),
				 "done": func(): return _alive(st.hadi) == 0,
				 "fail": func(): return (_l("%s отшили. Не успел." % vname, "%s was seen off. Too late." % vname)) if (st.victim != null and is_instance_valid(st.victim) and not st.victim.alive) else null},
				{"talk": func(): return [
					{"who": vid, "text": _l("Спасибо… Я думал — всё, конец.", "Thank you… I thought that was the end of me.")},
					{"who": "me", "text": _l("Своих не бросаем.", "We don't abandon our own.")},
					{"who": vid, "text": _l("Хадишевские этого так не оставят. Но сегодня каток — наш.", "Hadley Street won't let this lie. But tonight the rink is ours.")}]},
			],
	}
