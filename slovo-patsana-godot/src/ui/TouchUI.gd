class_name TouchUI
extends Control
## On-screen controls for phones: a floating stick on the left half (push it to the rim
## to sprint), drag anywhere else to turn the camera, fight buttons on the right, pause
## at the top. Buttons send the same actions a keyboard would.

const BUTTONS := [
	["punch", "touch.punch", 84, Vector2(0, 0), UI.RED],
	["kick", "touch.kick", 70, Vector2(92, 4), Color(1, 1, 1, 0.55)],
	["block", "touch.block", 64, Vector2(172, 10), Color(1, 1, 1, 0.55)],
	["special", "touch.special", 66, Vector2(10, 96), UI.GOLD],
	["dodge", "touch.dodge", 62, Vector2(88, 84), Color(1, 1, 1, 0.55)],
	["interact", "touch.car", 58, Vector2(160, 90), Color(1, 1, 1, 0.55)],
]

static var instance: TouchUI

var base: Control
var knob: Control
var stick_id := -1
var stick_o := Vector2.ZERO
var look_id := -1
var look_p := Vector2.ZERO
var held := {}

static func set_shown(on: bool) -> void:
	if instance:
		instance.visible = on
		if not on:
			instance._reset()

func _ready() -> void:
	instance = self
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	base = _circle(128, Color(0, 0, 0, 0.25), Color(1, 1, 1, 0.35))
	base.visible = false
	knob = _circle(58, Color(1, 1, 1, 0.55), Color(0, 0, 0, 0))
	base.add_child(knob)
	knob.position = Vector2(35, 35)
	add_child(base)
	var pad := Control.new()
	pad.anchor_left = 1
	pad.anchor_right = 1
	pad.anchor_top = 1
	pad.anchor_bottom = 1
	pad.offset_left = -264
	pad.offset_top = -234
	pad.offset_right = -14
	pad.offset_bottom = -14
	add_child(pad)
	for b in BUTTONS:
		var btn := _button(T.t(b[1]), b[2], b[4])
		btn.position = Vector2(250 - b[3].x - b[2], 220 - b[3].y - b[2])
		var action: String = b[0]
		btn.gui_input.connect(func(e: InputEvent):
			if e is InputEventScreenTouch or e is InputEventMouseButton:
				if e.pressed:
					_press(action, true)
					btn.modulate = Color(1.4, 1.4, 1.4)
				else:
					_press(action, false)
					btn.modulate = Color.WHITE
				accept_event())
		pad.add_child(btn)
	var pause := _button("II", 44, Color(1, 1, 1, 0.55))
	pause.anchor_left = 0.5
	pause.anchor_right = 0.5
	pause.offset_left = -22
	pause.offset_right = 22
	pause.offset_top = 10
	pause.offset_bottom = 54
	pause.gui_input.connect(func(e: InputEvent):
		if (e is InputEventScreenTouch or e is InputEventMouseButton) and e.pressed:
			_press("pause", true)
			_press("pause", false)
			accept_event())
	add_child(pause)

func _circle(d: float, fill: Color, border: Color) -> Control:
	var c := Panel.new()
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(2 if border.a > 0 else 0)
	s.set_corner_radius_all(int(d / 2))
	c.add_theme_stylebox_override("panel", s)
	c.custom_minimum_size = Vector2(d, d)
	c.size = Vector2(d, d)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c

func _button(text: String, d: float, border: Color) -> Control:
	var c := _circle(d, Color(0.04, 0.04, 0.055, 0.45), border)
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	var l := UI.label(text, 12 if d > 60 else 10, Color.WHITE if border.a > 0.6 else Color.WHITE, true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	if border == UI.GOLD:
		l.add_theme_color_override("font_color", UI.GOLD)
	c.add_child(l)
	return c

func _press(action: String, down: bool) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = down
	Input.parse_input_event(ev)

func _reset() -> void:
	stick_id = -1
	look_id = -1
	PlayerInput.stick = Vector2.ZERO
	base.visible = false

func _gui_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		if e.pressed:
			if e.position.x < size.x * 0.42 and stick_id < 0:
				stick_id = e.index
				stick_o = e.position
				base.position = e.position - Vector2(64, 64)
				base.visible = true
				knob.position = Vector2(35, 35)
			elif look_id < 0:
				look_id = e.index
				look_p = e.position
		else:
			if e.index == stick_id:
				stick_id = -1
				PlayerInput.stick = Vector2.ZERO
				base.visible = false
			elif e.index == look_id:
				look_id = -1
		accept_event()
	elif e is InputEventScreenDrag:
		if e.index == stick_id:
			var R := 56.0
			var d: Vector2 = e.position - stick_o
			if d.length() > R:
				d = d.normalized() * R
			knob.position = Vector2(35, 35) + d
			PlayerInput.stick = Vector2(d.x / R, -d.y / R)
		elif e.index == look_id:
			PlayerInput.look_touch += (e.position - look_p) * Vector2(1, 0.75)
			look_p = e.position
		accept_event()
