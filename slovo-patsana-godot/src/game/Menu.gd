class_name Menu
extends Node3D
## Title screen over a slow fly-around of the district at night (port of MenuMode.ts).

var camera := Camera3D.new()
var root: Control
var items: Array = []
var btns: Array = []
var idx := 0
var started := false
var t := 0.0
var overlay: Control = null
var on_play: Callable
var press_start: Label
var list: VBoxContainer

func init(play_cb: Callable, already_started := false) -> Menu:
	on_play = play_cb
	started = already_started
	return self

func _ready() -> void:
	Game.get_world()
	add_child(camera)
	camera.fov = 55
	camera.far = 900
	camera.current = true
	Game.capture_mouse(false)
	var story_n := Game.story_progress()
	items = [
		{"label": T.t("menu.free"), "note": T.t("menu.free_note"), "action": func(): on_play.call(1, "free")},
		{"label": T.t("menu.cpu"), "note": T.t("menu.cpu_note"), "action": func(): on_play.call(1, "cpu")},
	]
	if not Game.touch:
		items.append({"label": T.t("menu.versus"), "note": T.t("menu.versus_note"), "action": func(): on_play.call(2, "versus")})
	items.append({"label": T.t("menu.story"), "note": T.t("menu.story_done") if story_n >= 3 else T.t("menu.story_note") % story_n, "action": func(): on_play.call(1, "story")})
	items.append({"label": T.t("menu.lang"), "note": "English" if Game.lang == "ru" else "Русский", "action": func(): _toggle_lang()})
	items.append({"label": T.t("menu.controls"), "note": "", "action": func(): _show_overlay(T.t("menu.controls"), Controls.text())})
	items.append({"label": T.t("menu.credits"), "note": T.t("menu.credits_note"), "action": func(): _show_overlay(T.t("menu.credits"), Credits.text())})

	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	var col := VBoxContainer.new()
	col.anchor_left = 0.08
	col.anchor_right = 0.9
	col.anchor_top = 0.5
	col.anchor_bottom = 0.5
	col.grow_vertical = Control.GROW_DIRECTION_BOTH
	col.add_theme_constant_override("separation", 4)
	var title := UI.label(T.t("title"), 100, UI.RED, true)
	title.add_theme_constant_override("line_spacing", -22)
	var sub := UI.label(T.t("subtitle"), 22, UI.PAPER, true)
	sub.add_theme_constant_override("outline_size", 0)
	col.add_child(title)
	col.add_child(sub)
	var spacer := Control.new()
	spacer.custom_minimum_size.y = 30
	col.add_child(spacer)
	list = VBoxContainer.new()
	list.add_theme_constant_override("separation", 2)
	for i in range(items.size()):
		var it: Dictionary = items[i]
		var b := UI.button(it.label, 26, "")
		if it.note != "":
			var n := UI.label(it.note, 15, UI.MUTED)
			n.position = Vector2(0, 0)
			b.text = it.label
			b.add_child(n)
			n.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
			n.grow_horizontal = Control.GROW_DIRECTION_BEGIN
			n.grow_vertical = Control.GROW_DIRECTION_BOTH
			n.offset_right = -16
		b.custom_minimum_size.x = 520
		b.focus_entered.connect(func(): idx = i)
		b.pressed.connect(func(): _activate(i))
		b.mouse_entered.connect(func(): b.grab_focus())
		list.add_child(b)
		btns.append(b)
	press_start = UI.label(T.t("press_start"), 22, UI.GOLD, true)
	col.add_child(press_start if not started else list)
	root.add_child(col)
	var foot := UI.label(T.t("menu.foot"), 15, UI.MUTED)
	foot.anchor_left = 0.08
	foot.anchor_top = 1
	foot.anchor_bottom = 1
	foot.offset_top = -44
	root.add_child(foot)
	Game.ui_layer.add_child(root)
	if started:
		btns[0].grab_focus()
		Sfx.start_music()

func _toggle_lang() -> void:
	Game.lang = "en" if Game.lang == "ru" else "ru"
	Game.save_settings()
	# Rebuild the menu in the new language.
	Game.set_mode(Menu.new().init(on_play, true))

func _begin() -> void:
	if started:
		return
	started = true
	Sfx.start_wind()
	Sfx.start_music()
	press_start.get_parent().add_child(list)
	press_start.get_parent().move_child(list, press_start.get_index())
	press_start.queue_free()
	btns[0].grab_focus()

func _activate(i: int) -> void:
	if not started:
		return
	Sfx.confirm()
	items[i].action.call()

func _show_overlay(title: String, text: String) -> void:
	var ov := UI.overlay(title)
	var l := UI.label(text, 18)
	l.custom_minimum_size.x = 760
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ov.col.add_child(l)
	var hint := UI.label(T.t("menu.back_hint"), 15, UI.MUTED)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ov.col.add_child(hint)
	ov.root.gui_input.connect(func(e):
		if e is InputEventMouseButton and e.pressed:
			_close_overlay())
	root.add_child(ov.root)
	overlay = ov.root

func _close_overlay() -> void:
	if overlay:
		overlay.queue_free()
		overlay = null
		if btns.size() > idx:
			btns[idx].grab_focus()

func _unhandled_input(e: InputEvent) -> void:
	if not started:
		if (e is InputEventKey and e.pressed) or (e is InputEventMouseButton and e.pressed) or (e is InputEventScreenTouch and e.pressed) or (e is InputEventJoypadButton and e.pressed):
			_begin()
		return
	if overlay:
		if e.is_action_pressed("pause") or e.is_action_pressed("ui_confirm") or (e is InputEventScreenTouch and e.pressed):
			_close_overlay()
		return
	if e.is_action_pressed("move_back") or e.is_action_pressed("ui_down"):
		idx = (idx + 1) % btns.size()
		btns[idx].grab_focus()
		Sfx.ui()
	elif e.is_action_pressed("move_forward") or e.is_action_pressed("ui_up"):
		idx = (idx + btns.size() - 1) % btns.size()
		btns[idx].grab_focus()
		Sfx.ui()
	elif e.is_action_pressed("ui_confirm"):
		_activate(idx)

func _process(dt: float) -> void:
	t += dt
	var a := t * 0.05
	camera.position = Vector3(cos(a + 0.6) * 120, 38 + sin(t * 0.1) * 6, sin(a + 0.6) * 120)
	camera.look_at(Vector3(cos(a) * 60 * 0.3, 8, sin(a) * 60 * 0.3))
	Game.env.update(dt, camera.position)
	Game.city.update(t)

func dispose() -> void:
	root.queue_free()
