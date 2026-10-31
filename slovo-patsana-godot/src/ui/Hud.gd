class_name Hud
extends Control
## Player panels, money/authority, minimap, floating name tags, speech bubbles and
## damage numbers (port of ui/Hud.ts). Built in code; styled through UI.

var panels := []
var money_l: Label
var auth_l: Label
var zone_l: Label
var stars_l: Label
var speedo_l: Label
var prompt_l: Label
var notice_l: Label
var notice_sub: Label
var toast_l: Label
var help_l: Label
var minimap: Minimap
var floats := []   # {node, pos: Vector3, follow: Fighter, t, life, rise}
var tags := {}     # Fighter → {node, bar}
var _notice_t := 0.0
var _toast_t := 0.0
var blips: Array = []
var target = null
var city: City

class Minimap extends Control:
	var base: ImageTexture
	var scale_px := 1.25
	var city: City
	var player: Fighter
	var others: Array = []
	var yaw := 0.0
	var blips: Array = []
	var target = null
	const S := 210.0
	func setup(c: City) -> void:
		city = c
		custom_minimum_size = Vector2(S, S)
		size = Vector2(S, S)
		var sz := ceili(City.HALF * 2 * scale_px) + 40
		var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
		img.fill(Color("#1c2029"))
		var tx := func(x: float) -> int: return int((x + City.HALF) * scale_px + 20)
		for i in range(City.N):
			for j in range(City.N):
				var zc: Color = City.ZONE_COLORS[City.zone_of_block(i, j)]
				zc.a = 0.2
				var x0: int = tx.call(-City.HALF + City.ROAD / 2 + i * City.PITCH)
				var y0: int = tx.call(-City.HALF + City.ROAD / 2 + j * City.PITCH)
				var w := int((City.PITCH - City.ROAD) * scale_px)
				_blend_rect(img, Rect2i(x0, y0, w, w), zc)
		for k in range(City.N + 1):
			var c0 := -City.HALF + k * City.PITCH
			img.fill_rect(Rect2i(tx.call(c0 - City.ROAD / 2), tx.call(-City.HALF - City.ROAD / 2), int(City.ROAD * scale_px), int((City.HALF * 2 + City.ROAD) * scale_px)), Color("#5b606b"))
			img.fill_rect(Rect2i(tx.call(-City.HALF - City.ROAD / 2), tx.call(c0 - City.ROAD / 2), int((City.HALF * 2 + City.ROAD) * scale_px), int(City.ROAD * scale_px)), Color("#5b606b"))
		for b in city.boxes:
			if b.h < 2 or (b.max_x - b.min_x > 60 and b.h > 25):
				continue
			img.fill_rect(Rect2i(tx.call(b.min_x), tx.call(b.min_z), maxi(1, int((b.max_x - b.min_x) * scale_px)), maxi(1, int((b.max_z - b.min_z) * scale_px))), Color("#9aa0ab"))
		base = ImageTexture.create_from_image(img)
		clip_contents = true
	static func _blend_rect(img: Image, r: Rect2i, c: Color) -> void:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
					continue
				img.set_pixel(x, y, img.get_pixel(x, y).blend(c))
	func _draw() -> void:
		if player == null:
			return
		var c := Vector2(S / 2, S / 2)
		draw_circle(c, S / 2, Color("#111111"))
		# Rotate so "up" on the map is the camera's forward direction.
		var r := yaw
		draw_set_transform(c, r, Vector2.ONE)
		var p := player.position
		draw_texture(base, Vector2(-((p.x + City.HALF) * scale_px + 20), -((p.z + City.HALF) * scale_px + 20)))
		for o: Fighter in others:
			if not o.alive:
				continue
			var d := Vector2((o.position.x - p.x) * scale_px, (o.position.z - p.z) * scale_px)
			if d.length_squared() > 110 * 110:
				continue
			var hostile: bool = o.team == "razezd" or o.team == "hadi"
			if not hostile and o.team == "civil":
				continue
			var col: Color
			if o.team == "police":
				col = Color("#5aa0ff")
			elif hostile:
				col = Color("#ff3030") if o.since_combat < 6 else City.ZONE_COLORS[o.team]
			else:
				col = Color("#6fe06a")
			draw_circle(d, 4 if (hostile and o.since_combat < 6) else 3, col)
		for b in blips:
			var d := Vector2((b[0] - p.x) * scale_px, (b[1] - p.z) * scale_px)
			if d.length_squared() > 110 * 110:
				continue
			draw_rect(Rect2(d - Vector2(4, 4), Vector2(8, 8)), b[2])
		if target != null:
			var d := Vector2((target.x - p.x) * scale_px, (target.z - p.z) * scale_px)
			if d.length() > 92:
				d = d.normalized() * 92
			var pts := PackedVector2Array([d + Vector2(0, -8), d + Vector2(7, 0), d + Vector2(0, 8), d + Vector2(-7, 0)])
			draw_colored_polygon(pts, Color("#ffc83a"))
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		# Landmark labels stay upright while the map turns underneath them.
		var font := UI.display_font()
		var cs := cos(r)
		var sn := sin(r)
		for l in city.landmarks:
			var dx: float = (l.x - p.x) * scale_px
			var dz: float = (l.z - p.z) * scale_px
			var x := S / 2 + dx * cs - dz * sn
			var y := S / 2 + dx * sn + dz * cs
			if x < -40 or x > S + 40 or y < 0 or y > S + 10:
				continue
			var w := font.get_string_size(l.name, HORIZONTAL_ALIGNMENT_CENTER, -1, 12).x
			draw_string(font, Vector2(x - w / 2 + 1, y + 1), l.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.BLACK)
			draw_string(font, Vector2(x - w / 2, y), l.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#ffe9a8"))
		# Player arrow (always points up, since the map rotates).
		draw_set_transform(c, -(player.heading - r) + PI, Vector2.ONE)
		var arrow := PackedVector2Array([Vector2(0, -8), Vector2(6, 7), Vector2(0, 3), Vector2(-6, 7)])
		draw_colored_polygon(arrow, Color.WHITE)
		draw_polyline(arrow + PackedVector2Array([Vector2(0, -8)]), Color.BLACK, 1.5)
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		draw_string(font, Vector2(S / 2 + sin(r) * 92 - 5, S / 2 - cos(r) * 92 + 5), "С", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color.WHITE)

## players: [{f: Fighter, portrait: Texture2D, title: String}]
func setup(players: Array, c: City) -> Hud:
	city = c
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i in range(players.size()):
		var p: Dictionary = players[i]
		var panel := HBoxContainer.new()
		panel.add_theme_constant_override("separation", 12)
		var por := UI.portrait(p.portrait, 64, Color("#d8262b") if i == 0 else Color("#3b7bd2"))
		var col := VBoxContainer.new()
		col.custom_minimum_size.x = 260
		var nm := UI.label(p.title, 22, Color.WHITE, true)
		var hp := UI.bar(260, 14, Color("#d8262b"), Color("#5a1012"))
		var st := UI.bar(260, 6, Color("#2fa3ff"), Color("#102030"))
		col.add_child(nm)
		col.add_child(hp.wrap)
		col.add_child(st.wrap)
		if i == 1:
			panel.add_child(col)
			panel.add_child(por)
			panel.alignment = BoxContainer.ALIGNMENT_END
			nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			panel.anchor_left = 1
			panel.anchor_right = 1
			panel.offset_left = -360
			panel.offset_right = -20
			panel.offset_top = 18
		else:
			panel.add_child(por)
			panel.add_child(col)
			panel.position = Vector2(20, 18)
		add_child(panel)
		panels.append({"hp": hp, "st": st, "nm": nm})
	if city:
		var stats := VBoxContainer.new()
		stats.anchor_left = 1
		stats.anchor_right = 1
		stats.offset_left = -300
		stats.offset_right = -22
		stats.offset_top = 18
		stats.alignment = BoxContainer.ALIGNMENT_BEGIN
		stars_l = UI.label("", 26, Color(1, 1, 1, 0.25), true)
		stars_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		money_l = UI.label("", 30, Color("#8fe08a"), true)
		money_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		auth_l = UI.label("", 18, Color("#f2c14e"), true)
		auth_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		zone_l = UI.label("", 15, Color.WHITE, false)
		zone_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		for l in [stars_l, money_l, auth_l, zone_l]:
			stats.add_child(l)
		add_child(stats)
		minimap = Minimap.new()
		minimap.setup(city)
		minimap.anchor_top = 1
		minimap.anchor_bottom = 1
		minimap.offset_left = 22
		minimap.offset_top = -232
		minimap.offset_right = 232
		minimap.offset_bottom = -22
		add_child(minimap)
		speedo_l = UI.label("", 54, Color.WHITE, true)
		speedo_l.anchor_left = 1
		speedo_l.anchor_right = 1
		speedo_l.anchor_top = 1
		speedo_l.anchor_bottom = 1
		speedo_l.offset_left = -300
		speedo_l.offset_right = -26
		speedo_l.offset_top = -130
		speedo_l.offset_bottom = -70
		speedo_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		speedo_l.visible = false
		add_child(speedo_l)
		prompt_l = UI.label("", 18, Color.WHITE, false)
		prompt_l.add_theme_stylebox_override("normal", UI.box(Color(0.02, 0.024, 0.04, 0.72), Color(1, 1, 1, 0.2)))
		prompt_l.anchor_left = 0.5
		prompt_l.anchor_right = 0.5
		prompt_l.anchor_top = 1
		prompt_l.anchor_bottom = 1
		prompt_l.grow_horizontal = Control.GROW_DIRECTION_BOTH
		prompt_l.offset_top = -200
		prompt_l.offset_bottom = -165
		prompt_l.visible = false
		add_child(prompt_l)
		help_l = UI.label("WASD ходить · Shift бег · ЛКМ/J рука · ПКМ/K нога\nQ блок · E приём · Пробел уклон · F машина · Esc пауза", 14, Color(1, 1, 1, 0.75), false)
		help_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		help_l.anchor_left = 1
		help_l.anchor_right = 1
		help_l.anchor_top = 1
		help_l.anchor_bottom = 1
		help_l.offset_left = -520
		help_l.offset_right = -22
		help_l.offset_top = -56
		help_l.offset_bottom = -14
		help_l.visible = not Game.touch
		add_child(help_l)
	notice_l = UI.label("", 46, Color("#f2c14e"), true)
	notice_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notice_l.anchor_right = 1
	notice_l.anchor_top = 0.24
	notice_l.anchor_bottom = 0.24
	notice_l.offset_bottom = 60
	notice_l.modulate.a = 0
	add_child(notice_l)
	notice_sub = UI.label("", 20, Color("#f3efe6"), false)
	notice_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notice_sub.anchor_right = 1
	notice_sub.anchor_top = 0.24
	notice_sub.anchor_bottom = 0.24
	notice_sub.offset_top = 60
	notice_sub.offset_bottom = 90
	notice_sub.modulate.a = 0
	add_child(notice_sub)
	toast_l = UI.label("", 18, Color.WHITE, false)
	toast_l.add_theme_stylebox_override("normal", UI.box(Color(0.02, 0.024, 0.04, 0.75), Color(1, 1, 1, 0.15)))
	toast_l.anchor_left = 0.5
	toast_l.anchor_right = 0.5
	toast_l.anchor_top = 1
	toast_l.anchor_bottom = 1
	toast_l.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast_l.offset_top = -110
	toast_l.offset_bottom = -76
	toast_l.modulate.a = 0
	add_child(toast_l)
	Game.ui_layer.add_child(self)
	return self

func notice(text: String, sub := "", time := 2.2) -> void:
	notice_l.text = text
	notice_sub.text = sub
	notice_l.modulate.a = 1
	notice_sub.modulate.a = 1
	_notice_t = time

func toast(text: String, time := 3.0) -> void:
	toast_l.text = text
	toast_l.modulate.a = 1
	_toast_t = time

func bubble(f: Fighter, text: String) -> void:
	var l := UI.label(text, 16, Color("#111111"), false)
	l.add_theme_stylebox_override("normal", UI.box(Color(1, 1, 1, 0.95), Color(0, 0, 0, 0.3), 10))
	add_child(l)
	floats.append({"node": l, "pos": Vector3.ZERO, "follow": f, "t": 0.0, "life": 2.6, "rise": 0.0})

func damage(f: Fighter, amount: float, blocked: bool) -> void:
	var l := UI.label("блок" if blocked else str(roundi(amount)), 16 if blocked else 22, Color("#9ad0ff") if blocked else Color("#ffd24a"), true)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 6)
	add_child(l)
	floats.append({"node": l, "pos": Vector3(f.position.x + (randf() - 0.5) * 0.4, 1.9, f.position.z), "follow": null, "t": 0.0, "life": 0.8, "rise": 1.2})

func set_wanted(n: int, flash: bool) -> void:
	if stars_l == null:
		return
	var s := ""
	for i in range(3):
		s += "★"
	stars_l.text = s
	# Lit stars are drawn by colour: the string is three stars, tinted by count.
	stars_l.add_theme_color_override("font_color", Color(1, 1, 1, 0.25) if n == 0 else (Color("#ffd24a") if not flash else Color("#ff6a3a")))
	stars_l.text = "★".repeat(n) + "☆".repeat(3 - n)

func set_speed(kmh) -> void:
	if speedo_l == null:
		return
	speedo_l.visible = kmh != null
	if kmh != null:
		speedo_l.text = "%d км/ч" % roundi(kmh)

func prompt(text) -> void:
	if prompt_l == null:
		return
	prompt_l.visible = text != null
	if text != null:
		if Game.touch:
			text = text.replace("[F]", "[МАШИНА]")
		prompt_l.text = text

func set_stats(money: int, auth: int, zone: String) -> void:
	money_l.text = "%d ₽" % money
	auth_l.text = "Авторитет: %d" % auth
	zone_l.text = "Район: " + City.ZONE_NAMES[zone]

func update(dt: float, cam: Camera3D, players: Array, others: Array, cam_yaw: float, special_cost: Array) -> void:
	for i in range(players.size()):
		if i >= panels.size():
			break
		var p: Fighter = players[i]
		var pn: Dictionary = panels[i]
		UI.set_bar(pn.hp, maxf(0, p.hp / p.max_hp))
		UI.set_bar(pn.st, p.stamina / 100.0)
		var cost: float = special_cost[i] if i < special_cost.size() else 100.0
		pn.st.fill.color = Color("#f2c14e") if p.stamina >= cost else Color("#2fa3ff")
	if _notice_t > 0:
		_notice_t -= dt
		if _notice_t <= 0:
			notice_l.modulate.a = 0
			notice_sub.modulate.a = 0
	if _toast_t > 0:
		_toast_t -= dt
		if _toast_t <= 0:
			toast_l.modulate.a = 0
	# Name tags with health for anyone recently in a fight.
	var p0: Fighter = players[0]
	var seen := {}
	for f: Fighter in others:
		var b = f.data.get("brain")
		var aggro: bool = b != null and b.mode == "fight"
		if not f.alive or (f.since_combat > 6 and not aggro) or f.dist_to(p0) > 26:
			continue
		var wp := f.position + Vector3(0, 2.15, 0)
		if cam.is_position_behind(wp):
			continue
		var s := cam.unproject_position(wp)
		seen[f] = true
		if not tags.has(f):
			var box := VBoxContainer.new()
			box.mouse_filter = Control.MOUSE_FILTER_IGNORE
			var n := UI.label(f.fname, 15, Color("#9fe09a") if f.team == "universam" else (Color("#dddddd") if f.team == "civil" else Color("#ff8a80")), true)
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			var bar := UI.bar(70, 5, Color("#ff5050"), Color(0, 0, 0, 0.6))
			box.add_child(n)
			box.add_child(bar.wrap)
			add_child(box)
			tags[f] = {"node": box, "bar": bar}
		var t: Dictionary = tags[f]
		t.node.position = s - Vector2(t.node.size.x / 2, t.node.size.y)
		UI.set_bar(t.bar, maxf(0, f.hp / f.max_hp))
	for f in tags.keys():
		if not seen.has(f):
			tags[f].node.queue_free()
			tags.erase(f)
	var keep := []
	for fl: Dictionary in floats:
		fl.t += dt
		if fl.t > fl.life or (fl.follow != null and not is_instance_valid(fl.follow)):
			fl.node.queue_free()
			continue
		var wp: Vector3
		if fl.follow != null:
			wp = fl.follow.position + Vector3(0, 2.5, 0)
		else:
			wp = fl.pos + Vector3(0, fl.t * fl.rise, 0)
		var behind := cam.is_position_behind(wp)
		fl.node.visible = not behind
		if not behind:
			var s := cam.unproject_position(wp)
			fl.node.position = s - fl.node.size / 2
		fl.node.modulate.a = minf(1, (fl.life - fl.t) * 3)
		keep.append(fl)
	floats = keep
	if minimap:
		minimap.player = p0
		minimap.others = others
		minimap.yaw = cam_yaw
		minimap.blips = blips
		minimap.target = target
		minimap.queue_redraw()

func dispose() -> void:
	queue_free()
