class_name PlayerInput
## What a player wants this frame, independent of the device (port of core/input.ts).
## Schemes: "kbm" (WASD + mouse + gamepad 0 + touch), "arrows" (second player on one keyboard).

static var mouse_dx := 0.0
static var mouse_dy := 0.0
static var stick := Vector2.ZERO      ## touch joystick, right/forward positive
static var look_touch := Vector2.ZERO ## touch camera drag, in pixels
static var mouse_captured := false

static func feed(event: InputEvent) -> void:
	if event is InputEventMouseMotion and mouse_captured:
		mouse_dx += event.relative.x
		mouse_dy += event.relative.y

static func end_frame() -> void:
	mouse_dx = 0
	mouse_dy = 0
	look_touch = Vector2.ZERO

static func empty() -> Dictionary:
	return {"move_x": 0.0, "move_y": 0.0, "run": false, "punch": false, "kick": false, "block": false,
		"special": false, "dodge": false, "interact": false, "look_x": 0.0, "look_y": 0.0}

static func read(scheme: String, dt: float) -> Dictionary:
	var it := empty()
	if scheme == "kbm":
		it.move_x = Input.get_action_strength("move_right") - Input.get_action_strength("move_left")
		it.move_y = Input.get_action_strength("move_forward") - Input.get_action_strength("move_back")
		it.run = Input.is_action_pressed("run")
		it.punch = Input.is_action_just_pressed("punch")
		it.kick = Input.is_action_just_pressed("kick")
		it.block = Input.is_action_pressed("block")
		it.special = Input.is_action_just_pressed("special")
		it.dodge = Input.is_action_just_pressed("dodge")
		it.interact = Input.is_action_just_pressed("interact")
		it.look_x = -mouse_dx * 0.0028 - look_touch.x * 0.0045
		it.look_y = -mouse_dy * 0.0022 - look_touch.y * 0.0035
		it.look_x += (Input.get_action_strength("cam_left") - Input.get_action_strength("cam_right")) * 2.2 * dt
		# Gamepad right stick.
		var rx := Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)
		var ry := Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
		if absf(rx) > 0.18:
			it.look_x -= rx * 2.6 * dt
		if absf(ry) > 0.18:
			it.look_y -= ry * 1.8 * dt
		if stick.length() > 0.02:
			it.move_x = stick.x
			it.move_y = stick.y
			if stick.length() > 0.92:
				it.run = true
	elif scheme == "arrows":
		it.move_x = Input.get_action_strength("p2_right") - Input.get_action_strength("p2_left")
		it.move_y = Input.get_action_strength("p2_forward") - Input.get_action_strength("p2_back")
		it.run = Input.is_action_pressed("p2_run")
		it.punch = Input.is_action_just_pressed("p2_punch")
		it.kick = Input.is_action_just_pressed("p2_kick")
		it.block = Input.is_action_pressed("p2_block")
		it.special = Input.is_action_just_pressed("p2_special")
		it.dodge = Input.is_action_just_pressed("p2_dodge")
	return it
