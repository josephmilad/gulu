class_name Select
extends Node3D
## Mortal Kombat-style select (port of SelectMode.ts): the highlighted fighter steps onto
## a snowy stage under a spotlight, portraits run along the bottom. Bonus fighters get an
## editor for their name, stats and special.
## P1: A/D + J/Enter, W/S + Q/E to edit. P2: ←/→ + Enter, ↑/↓ + [/] to edit.

const STAGE := Vector3(0, -400, 0)   # far below the city, so the shared sky and fog still apply
const STAT_ROWS := [["power", "stat.power"], ["speed", "stat.speed"], ["health", "stat.health"], ["technique", "stat.technique"]]

var camera := Camera3D.new()
var players := 1
var on_done: Callable
var on_back: Callable
var roster: Array = []
var cursors: Array = []   # {idx, locked, info: Control, x, body: Body, body_id, spot, row}
var cards: Array = []
var root: Control
var done := false
var t := 0.0
var body_cache := {}
var stage := Node3D.new()
var vs_label: Label

func init(n_players: int, done_cb: Callable, back_cb: Callable) -> Select:
	players = n_players
	on_done = done_cb
	on_back = back_cb
	return self

func _ready() -> void:
	Game.get_world()
	roster = Characters.roster()
	add_child(stage)
	stage.position = STAGE
	add_child(camera)
	camera.fov = 40
	camera.far = 300
	camera.current = true
	Game.capture_mouse(false)
	# Snowy stage with a wall of panel-block silhouettes behind it.
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_texture = load(Assets.p("tex/snow_01_diff.jpg"))
	fm.normal_enabled = true
	fm.normal_texture = load(Assets.p("tex/snow_01_nor.jpg"))
	fm.uv1_scale = Vector3(12, 12, 1)
	fm.roughness = 0.9
	floor.material_override = fm
	stage.add_child(floor)
	var back_mat := StandardMaterial3D.new()
	back_mat.albedo_color = Color("#1c1f2a")
	back_mat.emission_enabled = true
	back_mat.emission = Color("#2a1015")
	back_mat.emission_energy_multiplier = 0.4
	for k in range(-4, 5):
		var hgt := 10 + (((k * 7919) % 5 + 5) % 5 + 5) * 2
		var bm := BoxMesh.new()
		bm.size = Vector3(9, hgt, 6)
		var b := MeshInstance3D.new()
		b.mesh = bm
		b.material_override = back_mat
		b.position = Vector3(k * 10, hgt / 2.0, -22 - absf(k) * 2)
		stage.add_child(b)
	var fill := DirectionalLight3D.new()
	fill.light_color = Color("#c8d4ff")
	fill.light_energy = 0.5
	fill.rotation_degrees = Vector3(-25, 180, 0)
	stage.add_child(fill)
	camera.position = STAGE + Vector3(0, 1.7, 6.4)
	camera.look_at(STAGE + Vector3(0, 1.1, 0))

	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	var title := UI.label(T.t("select.title2" if players == 2 else "select.title"), 48, UI.PAPER, true)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.anchor_right = 1
	title.offset_top = 16
	root.add_child(title)
	var slots := [-1.25, 1.25] if players == 2 else [1.1]
	for p in range(slots.size()):
		var info := PanelContainer.new()
		info.add_theme_stylebox_override("panel", UI.box(Color(0.02, 0.024, 0.04, 0.72), Color(1, 1, 1, 0.12), 0, 12))
		info.custom_minimum_size = Vector2(360, 0)
		if p == 0:
			info.anchor_left = 0
			info.anchor_top = 0.5
			info.anchor_bottom = 0.5
			info.offset_left = 32
			info.grow_vertical = Control.GROW_DIRECTION_BOTH
		else:
			info.anchor_left = 1
			info.anchor_right = 1
			info.anchor_top = 0.5
			info.anchor_bottom = 0.5
			info.offset_left = -392
			info.offset_right = -32
			info.grow_vertical = Control.GROW_DIRECTION_BOTH
		root.add_child(info)
		var spot := SpotLight3D.new()
		spot.light_color = Color("#ffe8d0") if p == 0 else Color("#d0e0ff")
		spot.light_energy = 8
		spot.spot_range = 18
		spot.spot_angle = 20
		spot.spot_attenuation = 1.2
		spot.shadow_enabled = true
		spot.position = Vector3(slots[p], 9, 5)
		stage.add_child(spot)
		spot.look_at(STAGE + Vector3(slots[p], 0, 0.6))
		cursors.append({"idx": mini(p, roster.size() - 1), "locked": false, "info": info, "x": slots[p], "body": null, "body_id": "", "spot": spot, "row": 0})
	var bottom := VBoxContainer.new()
	bottom.anchor_top = 1
	bottom.anchor_bottom = 1
	bottom.anchor_right = 1
	bottom.offset_top = -200
	bottom.offset_bottom = -12
	bottom.alignment = BoxContainer.ALIGNMENT_END
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 10)
	for i in range(roster.size()):
		var ch: Dictionary = roster[i]
		var card := Button.new()
		card.custom_minimum_size = Vector2(100, 125)
		card.focus_mode = Control.FOCUS_NONE
		var st := StyleBoxFlat.new()
		st.bg_color = Color("#111111")
		st.border_color = Color("#333333")
		st.set_border_width_all(3)
		card.add_theme_stylebox_override("normal", st)
		card.add_theme_stylebox_override("hover", st)
		card.add_theme_stylebox_override("pressed", st)
		card.add_theme_stylebox_override("focus", st)
		var tr := TextureRect.new()
		tr.texture = Game.portraits.get(ch.id)
		tr.set_anchors_preset(Control.PRESET_FULL_RECT)
		tr.offset_left = 3
		tr.offset_top = 3
		tr.offset_right = -3
		tr.offset_bottom = -3
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.add_child(tr)
		var lbl := UI.label(Characters.full_title(ch), 13, UI.PAPER, true)
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
		lbl.add_theme_stylebox_override("normal", UI.box(Color(0, 0, 0, 0.75), Color(0, 0, 0, 0), 0, 2))
		lbl.anchor_top = 1
		lbl.anchor_bottom = 1
		lbl.anchor_right = 1
		lbl.offset_top = -36
		lbl.offset_left = 3
		lbl.offset_right = -3
		lbl.offset_bottom = -3
		card.add_child(lbl)
		if ch.get("custom", false):
			var tag := UI.label(T.t("select.bonus"), 11, Color("#111111"), true)
			tag.add_theme_stylebox_override("normal", UI.box(UI.GOLD, Color(0, 0, 0, 0), 0, 3))
			tag.anchor_left = 0.5
			tag.anchor_right = 0.5
			tag.grow_horizontal = Control.GROW_DIRECTION_BOTH
			tag.offset_top = 4
			card.add_child(tag)
		var marks := UI.label("", 13, Color.WHITE, true)
		marks.name = "marks"
		marks.offset_left = 4
		marks.offset_top = 4
		card.add_child(marks)
		card.mouse_entered.connect(func():
			if not Game.touch and not cursors[0].locked:
				_move(0, i - cursors[0].idx))
		card.pressed.connect(func():
			if Game.touch and cursors[0].idx != i:
				_move(0, i - cursors[0].idx)
				return
			_move(0, i - cursors[0].idx)
			_confirm(0))
		row.add_child(card)
		cards.append(card)
	bottom.add_child(row)
	if Game.touch:
		var bar := HBoxContainer.new()
		bar.alignment = BoxContainer.ALIGNMENT_CENTER
		bar.add_theme_constant_override("separation", 16)
		var back := UI.button("◀ " + T.t("select.back"), 18)
		back.pressed.connect(func(): if not done: on_back.call())
		var go := UI.button(T.t("select.go") + " ▶", 18)
		go.pressed.connect(func(): _confirm(0))
		bar.add_child(back)
		bar.add_child(go)
		bottom.add_child(bar)
	else:
		var hint := UI.label(T.t("select.hint2" if players == 2 else "select.hint"), 15, UI.MUTED)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		bottom.add_child(hint)
	root.add_child(bottom)
	Game.ui_layer.add_child(root)
	_refresh()

func _info_html(ch: Dictionary, cur: Dictionary) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	var gang := UI.label(T.name(ch, "gang").to_upper(), 13, UI.MUTED)
	col.add_child(gang)
	var p := cursors.find(cur)
	if ch.get("custom", false) and not cur.locked:
		var nm := LineEdit.new()
		nm.text = ch.name
		nm.max_length = 18
		nm.add_theme_font_override("font", UI.display_font())
		nm.add_theme_font_size_override("font_size", 28)
		nm.text_changed.connect(func(txt: String):
			ch.name = txt.strip_edges() if txt.strip_edges() != "" else T.t("select.bonus_name")
			Characters.save_bonus(ch)
			_update_card_label(cur.idx))
		nm.focus_exited.connect(func(): pass)
		col.add_child(nm)
		col.add_child(UI.label(T.t("select.bonus_sub"), 16, UI.GOLD, true))
		for r in range(STAT_ROWS.size()):
			var k: String = STAT_ROWS[r][0]
			col.add_child(_edit_row(T.t(STAT_ROWS[r][1]), str(ch.stats[k]), ch.stats[k] / 10.0, cur.row == r, func(d): _edit_at(p, r, d)))
		var sp: Dictionary = Characters.SPECIALS[ch.special]
		col.add_child(_edit_row(T.t("select.special"), T.special_name(ch.special), -1, cur.row == 4, func(d): _edit_at(p, 4, d)))
		var desc := UI.label(T.special_desc(ch.special), 15)
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		desc.custom_minimum_size.x = 330
		col.add_child(desc)
		col.add_child(UI.label(T.t("select.derived") % [ch.hp, ch.power, ch.speed], 13, UI.MUTED))
		return col
	col.add_child(UI.label(T.name(ch, "name"), 34, UI.PAPER, true))
	col.add_child(UI.label("«%s»" % T.name(ch, "nick"), 18, UI.GOLD, true))
	var bio := UI.label(T.name(ch, "bio"), 16)
	bio.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bio.custom_minimum_size.x = 330
	col.add_child(bio)
	for r in STAT_ROWS:
		col.add_child(_stat_row(T.t(r[1]), ch.stats[r[0]] / 10.0, p == 1))
	var spec := UI.label("%s — %s\n%s" % [T.special_name(ch.special), T.special_desc(ch.special), T.name(ch, "passive")], 15)
	spec.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	spec.custom_minimum_size.x = 330
	col.add_child(spec)
	return col

func _stat_row(label: String, k: float, right := false) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	var l := UI.label(label.to_upper(), 13)
	l.custom_minimum_size.x = 80
	var bar := UI.bar(230, 8, UI.RED if not right else Color("#3b7bd2"), Color(1, 1, 1, 0.1))
	UI.set_bar(bar, k)
	h.add_child(l)
	h.add_child(bar.wrap)
	return h

func _edit_row(label: String, value: String, k: float, on: bool, fn: Callable) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	if on:
		var pc := PanelContainer.new()
		pc.add_theme_stylebox_override("panel", UI.box(Color(1, 0.82, 0.35, 0.08), UI.GOLD, 0, 2))
		pc.add_child(h)
		h = HBoxContainer.new()
		h.add_theme_constant_override("separation", 6)
		pc.get_child(0).add_child(h)
		var l0 := UI.label(label.to_upper(), 13)
		l0.custom_minimum_size.x = 76
		h.add_child(l0)
		_edit_buttons(h, value, k, fn)
		return pc
	var l := UI.label(label.to_upper(), 13)
	l.custom_minimum_size.x = 80
	h.add_child(l)
	_edit_buttons(h, value, k, fn)
	return h

func _edit_buttons(h: HBoxContainer, value: String, k: float, fn: Callable) -> void:
	var minus := Button.new()
	minus.text = "−"
	minus.custom_minimum_size = Vector2(28, 24)
	minus.pressed.connect(func(): fn.call(-1))
	h.add_child(minus)
	if k >= 0:
		var bar := UI.bar(150, 8, UI.RED, Color(1, 1, 1, 0.1))
		UI.set_bar(bar, k)
		h.add_child(bar.wrap)
		var v := UI.label(value, 16, UI.GOLD, true)
		v.custom_minimum_size.x = 22
		h.add_child(v)
	else:
		var v := UI.label(value, 15, UI.GOLD, true)
		v.custom_minimum_size.x = 174
		v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		h.add_child(v)
	var plus := Button.new()
	plus.text = "+"
	plus.custom_minimum_size = Vector2(28, 24)
	plus.pressed.connect(func(): fn.call(1))
	h.add_child(plus)

func _edit_at(p: int, row: int, d: int) -> void:
	cursors[p].row = row
	_edit(p, d)

func _edit(p: int, d: int) -> void:
	var cur: Dictionary = cursors[p]
	var ch: Dictionary = roster[cur.idx]
	if not ch.get("custom", false) or cur.locked:
		return
	if cur.row < 4:
		var k: String = STAT_ROWS[cur.row][0]
		ch.stats[k] = clampi(ch.stats[k] + d, 1, 10)
	else:
		var ids := Characters.SPECIALS.keys()
		var i := ids.find(ch.special)
		ch.special = ids[(i + d + ids.size()) % ids.size()]
	Characters.save_bonus(ch)
	Sfx.ui()
	_refresh()

func _update_card_label(i: int) -> void:
	var lbl := cards[i].get_child(1) as Label
	lbl.text = Characters.full_title(roster[i])

func _body_for(p: int, id: String) -> Body:
	var key := "%d:%s" % [p, id]
	if not body_cache.has(key):
		var b := Body.new()
		stage.add_child(b)
		b.setup(Characters.model_path(Characters.by_id(id)), {"hero": true})
		b.visible = false
		body_cache[key] = b
	return body_cache[key]

func _render_info(p: int) -> void:
	var cur: Dictionary = cursors[p]
	for c in cur.info.get_children():
		c.queue_free()
	cur.info.add_child(_info_html(roster[cur.idx], cur))

func _refresh() -> void:
	for i in range(cards.size()):
		var st: StyleBoxFlat = cards[i].get_theme_stylebox("normal")
		var p1: bool = cursors[0].idx == i
		var p2: bool = cursors.size() > 1 and cursors[1].idx == i
		st.border_color = UI.RED if p1 else (Color("#3b7bd2") if p2 else Color("#333333"))
		(cards[i].get_node("marks") as Label).text = ("1P " if p1 else "") + ("2P" if p2 else "")
	for p in range(cursors.size()):
		var cur: Dictionary = cursors[p]
		_render_info(p)
		var id: String = roster[cur.idx].id
		if cur.body_id != id:
			if cur.body:
				cur.body.visible = false
			cur.body = _body_for(p, id)
			cur.body_id = id
			cur.body.visible = true
			cur.body.position = Vector3(cur.x + (-0.6 if p == 0 else 0.6), 0, 0.3)
			cur.body.rotation.y = 0.25 if p == 0 else -0.25
			cur.body.stop()

func _move(p: int, d: int) -> void:
	if p >= cursors.size():
		return
	var cur: Dictionary = cursors[p]
	if cur.locked or done or d == 0:
		return
	cur.idx = (cur.idx + d + roster.size()) % roster.size()
	cur.row = 0
	Sfx.ui()
	_refresh()

func _confirm(p: int) -> void:
	if p >= cursors.size():
		return
	var cur: Dictionary = cursors[p]
	if cur.locked or done:
		return
	cur.locked = true
	Sfx.confirm()
	if cur.body:
		cur.body.play("victory")
	var ch: Dictionary = roster[cur.idx]
	_render_info(p)
	cur.info.get_child(0).add_child(UI.label("— " + T.quote(ch, 0), 16, UI.GOLD))
	if cursors.all(func(c): return c.locked):
		done = true
		vs_label = UI.label("VS" if players == 2 else T.t("select.go_banner"), 160 if players == 2 else 110, UI.GOLD, true)
		vs_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vs_label.set_anchors_preset(Control.PRESET_CENTER)
		vs_label.grow_horizontal = Control.GROW_DIRECTION_BOTH
		vs_label.grow_vertical = Control.GROW_DIRECTION_BOTH
		root.add_child(vs_label)
		get_tree().create_timer(1.3).timeout.connect(func(): on_done.call(cursors.map(func(c): return roster[c.idx].id)))

func _row(p: int, d: int) -> void:
	if p >= cursors.size():
		return
	var cur: Dictionary = cursors[p]
	if cur.locked or not roster[cur.idx].get("custom", false):
		return
	cur.row = (cur.row + d + 5) % 5
	Sfx.ui()
	_render_info(p)

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey) or not e.pressed or e.echo:
		return
	var two := players == 2
	match e.keycode:
		KEY_A: _move(0, -1)
		KEY_D: _move(0, 1)
		KEY_W: _row(0, -1)
		KEY_S: _row(0, 1)
		KEY_Q: _edit(0, -1)
		KEY_E: _edit(0, 1)
		KEY_J, KEY_SPACE: _confirm(0)
		KEY_LEFT: _move(1 if two else 0, -1)
		KEY_RIGHT: _move(1 if two else 0, 1)
		KEY_UP: _row(1 if two else 0, -1)
		KEY_DOWN: _row(1 if two else 0, 1)
		KEY_BRACKETLEFT: _edit(1 if two else 0, -1)
		KEY_BRACKETRIGHT: _edit(1 if two else 0, 1)
		KEY_ENTER, KEY_KP_ENTER, KEY_KP_1, KEY_COMMA: _confirm(1 if two else 0)
		KEY_ESCAPE:
			if not done:
				Sfx.ui()
				on_back.call()

func _process(dt: float) -> void:
	t += dt
	for p in range(cursors.size()):
		var cur: Dictionary = cursors[p]
		var b: Body = cur.body
		if b == null:
			continue
		b.position.x = lerpf(b.position.x, cur.x, 1 - exp(-7 * dt))
		b.position.z = lerpf(b.position.z, 0.9, 1 - exp(-7 * dt))
		var want_ry := (0.35 if players == 2 else -0.15) if p == 0 else -0.35
		b.rotation.y = lerpf(b.rotation.y, want_ry, 1 - exp(-5 * dt))
		if b.current == "" and randf() < dt * 0.15:
			b.play("yes")
		b.speed = 0
	camera.position.x = STAGE.x + sin(t * 0.3) * 0.3
	camera.look_at(STAGE + Vector3(0, 1.1, 0))
	Game.env.update(dt, STAGE)

func dispose() -> void:
	root.queue_free()
