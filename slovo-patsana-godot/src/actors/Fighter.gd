class_name Fighter
extends CharacterBody3D
## Combat state machine (port of actors/Fighter.ts): attacks with hit windows, block,
## dodge, knockdown, get-up. The owner (player code or a Brain) writes `ctrl` each frame.
## `arena` is the game mode: fighters, grid, bounds, on_hit(), on_whiff(), on_step().

enum S { FREE, ATTACK, HIT, DOWN, GETUP, DODGE, DEAD }

var body: Body
var arena: Node
var team := "civil"
var fname := ""
var char_id := ""
var hp := 100.0
var max_hp := 100.0
var stamina := 100.0
var power := 1.0
var move_mul := 1.0
var regen := 1.0
var special := ""
var radius := 0.38
var state: int = S.FREE
var state_t := 0.0
var attack: Dictionary = {}
var heading := 0.0
var vx := 0.0
var vz := 0.0
var blocking := false
var invuln := 0.0
var since_combat := 99.0
var last_attacker: Fighter = null
var hit_flash := 0.0
var data := {}   ## free-form slot for AI / game-mode data (brain, is_player, in_car, …)
var ctrl := {"mx": 0.0, "mz": 0.0, "speed": 0.0, "face": null, "punch": false, "kick": false, "special": false, "block": false, "dodge": false}

var _attack_t := 0.0
var _hit_done: Array = []
var _combo_step := 0
var _combo_timer := 0.0
var _buffered := ""

## opts: path, tint, tint_amt, scale, hero, hp, power, speed, special, regen, team, name, char_id
static func create(parent: Node3D, arena_: Node, opts: Dictionary) -> Fighter:
	var f := Fighter.new()
	f.arena = arena_
	f.team = opts.get("team", "civil")
	f.fname = opts.get("name", "")
	f.char_id = opts.get("char_id", "")
	f.hp = opts.get("hp", 100.0)
	f.max_hp = f.hp
	f.power = opts.get("power", 1.0)
	f.move_mul = opts.get("speed", 1.0)
	f.regen = opts.get("regen", 1.0)
	f.special = opts.get("special", "")
	f.collision_layer = 2
	f.collision_mask = 1
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	f.add_child(cs)
	parent.add_child(f)
	f.body = Body.new()
	f.add_child(f.body)
	f.body.setup(opts.path, opts)
	f.body.on_step = func(): if f.arena and f.arena.has_method("on_step"): f.arena.on_step(f)
	return f

var alive: bool:
	get: return state != S.DEAD
var grounded: bool:
	get: return state == S.DOWN or state == S.DEAD or state == S.GETUP
var x: float:
	get: return position.x
var z: float:
	get: return position.z
var forward_x: float:
	get: return sin(heading)
var forward_z: float:
	get: return cos(heading)

func place(px: float, pz: float, h := 0.0) -> void:
	position = Vector3(px, 0, pz)
	heading = h
	rotation.y = h

func dist_to(o: Node3D) -> float:
	return Vector2(position.x - o.position.x, position.z - o.position.z).length()

func _set_state(s: int) -> void:
	state = s
	state_t = 0.0

func _start_attack(id: String) -> void:
	var a := Attacks.get_attack(id)
	if a.is_empty():
		return
	if a.kind == "special" and stamina < a.stamina:
		return
	attack = a
	_attack_t = 0.0
	_hit_done = []
	for h in a.hits:
		_hit_done.append([])
	stamina = maxf(0, stamina - a.stamina)
	_set_state(S.ATTACK)
	body.play(a.clip if id != "flurry" else "flurry", a)
	if arena.has_method("on_whiff"):
		arena.on_whiff(self)
	since_combat = 0

func _next_punch() -> void:
	if _combo_timer <= 0:
		_combo_step = 0
	var id: String = Attacks.PUNCH_CHAIN[_combo_step % 3]
	_combo_step = (_combo_step + 1) % 3
	_combo_timer = 0.9
	_start_attack(id)

func _do_action(kind: String) -> void:
	if kind == "punch":
		_next_punch()
	elif kind == "kick":
		_combo_step = 0
		_start_attack("kick")
	elif special != "":
		_start_attack(special)

## Damage multiplier including character passives.
func dmg_mul() -> float:
	var m := power
	if char_id == "palto":
		m *= 1 + 0.6 * (1 - hp / max_hp)
	if char_id == "turbo" and not attack.is_empty() and attack.kind == "kick":
		m *= 1.25
	return m

## Returns {blocked, dmg, ko, knockdown} or {} when the hit did nothing.
func take_hit(att: Fighter, hit: Dictionary) -> Dictionary:
	if invuln > 0 or grounded:
		return {}
	last_attacker = att
	since_combat = 0
	var dx := att.position.x - position.x
	var dz := att.position.z - position.z
	var len := maxf(1e-6, sqrt(dx * dx + dz * dz))
	var facing := (forward_x * dx + forward_z * dz) / len
	var unblockable: bool = hit.get("unblockable", false) or (att.char_id == "kashchey" and not att.attack.is_empty() and att.attack.kind == "kick")
	var nx := -dx / len
	var nz := -dz / len
	var dmg: float = hit.dmg * att.dmg_mul()
	if blocking and state == S.FREE and facing > 0.2 and not unblockable:
		dmg *= 0.08 if char_id == "adidas" else 0.15
		stamina -= 12
		hp = maxf(1, hp - dmg)
		vx += nx * hit.kb * 0.4
		vz += nz * hit.kb * 0.4
		if stamina <= 0:
			stamina = 0
			blocking = false
			_set_state(S.HIT)
			body.play("hit")
			state_t = -0.4
		else:
			body.play("blockHit")
		return {"blocked": true, "dmg": dmg, "ko": false, "knockdown": false}
	hp -= dmg
	hit_flash = 0.15
	vx += nx * hit.kb
	vz += nz * hit.kb
	attack = {}
	blocking = false
	var ko := hp <= 0
	var kd: bool = ko or hit.get("knockdown", false)
	if ko:
		hp = 0
	if kd:
		heading = atan2(dx, dz)
		_set_state(S.DOWN)
		body.play("fall")
		data["ko"] = ko
	else:
		_set_state(S.HIT)
		body.play("hit")
	return {"blocked": false, "dmg": dmg, "ko": ko, "knockdown": kd}

## Hit by something that isn't a fighter (a car). Always knocks down.
func take_impact(from_x: float, from_z: float, dmg: float, kb: float) -> Dictionary:
	if invuln > 0 or grounded:
		return {}
	var dx := from_x - position.x
	var dz := from_z - position.z
	var len := maxf(1e-6, sqrt(dx * dx + dz * dz))
	hp -= dmg
	hit_flash = 0.15
	vx -= dx / len * kb
	vz -= dz / len * kb
	attack = {}
	blocking = false
	var ko := hp <= 0
	if ko:
		hp = 0
	heading = atan2(dx, dz)
	_set_state(S.DOWN)
	body.play("fall")
	data["ko"] = ko
	since_combat = 0
	return {"blocked": false, "dmg": dmg, "ko": ko, "knockdown": true}

func revive(new_hp := -1.0) -> void:
	hp = max_hp if new_hp < 0 else new_hp
	stamina = 100
	_set_state(S.FREE)
	body.stop()
	attack = {}
	vx = 0
	vz = 0
	data["ko"] = false

func tick(dt: float) -> void:
	var c := ctrl
	state_t += dt
	since_combat += dt
	_combo_timer -= dt
	invuln = maxf(0, invuln - dt)
	hit_flash = maxf(0, hit_flash - dt)
	if state != S.ATTACK and state != S.DODGE:
		stamina = minf(100, stamina + dt * (8.0 if blocking else 20.0) * regen)
	# Zima's passive: he gets his breath (and health) back between fights.
	if char_id == "zima" and alive and since_combat > 4:
		hp = minf(max_hp, hp + dt * 3)

	var want_vx := 0.0
	var want_vz := 0.0
	var accel := 14.0
	match state:
		S.FREE:
			blocking = c.block
			var dodge_cost := 6.0 if char_id == "marat" else 15.0
			if c.dodge and stamina >= dodge_cost:
				stamina -= dodge_cost
				_set_state(S.DODGE)
				invuln = 0.3
				var dx: float = c.mx
				var dz: float = c.mz
				if Vector2(dx, dz).length() < 0.1:
					dx = -forward_x
					dz = -forward_z
				var l := Vector2(dx, dz).length()
				vx = dx / l * 8
				vz = dz / l * 8
				body.play("dodge")
			else:
				if not c.block:
					if c.special and special != "":
						_do_action("special")
					elif c.punch:
						_do_action("punch")
					elif c.kick:
						_do_action("kick")
				if state == S.FREE:
					var mul := 0.35 if c.block else 1.0
					want_vx = c.mx * c.speed * mul * move_mul
					want_vz = c.mz * c.speed * mul * move_mul
					if c.face != null:
						heading = _damp_angle(heading, c.face, 14, dt)
					elif Vector2(c.mx, c.mz).length() > 0.1:
						heading = _damp_angle(heading, atan2(c.mx, c.mz), 12, dt)
		S.ATTACK:
			var a := attack
			blocking = false
			_attack_t += dt
			if c.face != null and _attack_t < 0.12:
				heading = _damp_angle(heading, c.face, 18, dt)
			if a.move != null and _attack_t >= a.move[0] and _attack_t <= a.move[1]:
				want_vx = forward_x * a.move[2]
				want_vz = forward_z * a.move[2]
				accel = 40
			else:
				accel = 18
			for i in range(a.hits.size()):
				var h: Dictionary = a.hits[i]
				var done: Array = _hit_done[i]
				var active: bool
				if h.has("until"):
					active = _attack_t >= h.t and _attack_t <= h.until
				else:
					active = _attack_t >= h.t and not done.has(self)
				if not active:
					continue
				if not h.has("until"):
					done.append(self)
				_resolve_hit(h, done)
			if c.punch:
				_buffered = "punch"
			elif c.kick:
				_buffered = "kick"
			elif c.special:
				_buffered = "special"
			if _attack_t >= a.chain_at and _buffered != "" and a.kind != "special":
				var b := _buffered
				_buffered = ""
				_do_action(b)
			elif _attack_t >= a.dur:
				attack = {}
				_buffered = ""
				_set_state(S.FREE)
		S.HIT:
			blocking = false
			accel = 6
			if state_t > 0.36:
				_set_state(S.FREE)
		S.DODGE:
			accel = 3
			if state_t > 0.32:
				_set_state(S.FREE)
		S.DOWN:
			accel = 5
			if state_t > 0.55 and body.current == "fall":
				body.play("down")
			if data.get("ko", false):
				if state_t > 0.6:
					_set_state(S.DEAD)
			elif state_t > 1.4:
				_set_state(S.GETUP)
				body.play("getup")
				invuln = 0.9
		S.GETUP:
			accel = 10
			if state_t > 0.75:
				_set_state(S.FREE)
		S.DEAD:
			accel = 5
			if body.current != "down" and state_t > 0.1:
				body.play("down")

	var k := 1 - exp(-accel * dt)
	vx += (want_vx - vx) * k
	vz += (want_vz - vz) * k
	# Push apart from other standing fighters.
	var px := position.x + vx * dt
	var pz := position.z + vz * dt
	if not grounded:
		for o: Fighter in arena.fighters:
			if o == self or o.grounded or o.data.get("in_car", false):
				continue
			var dx := px - o.position.x
			var dz := pz - o.position.z
			var r := radius + o.radius
			var d2 := dx * dx + dz * dz
			if d2 < r * r and d2 > 1e-6:
				var d := sqrt(d2)
				var p := (r - d) * 0.5
				px += dx / d * p
				pz += dz / d * p
	# Walls: let the physics body slide along them.
	velocity = Vector3((px - position.x) / maxf(dt, 1e-4), 0, (pz - position.z) / maxf(dt, 1e-4))
	move_and_slide()
	position.y = 0
	if arena.get("bounds") != null:
		var b: Dictionary = arena.bounds
		position.x = clampf(position.x, b.min_x, b.max_x)
		position.z = clampf(position.z, b.min_z, b.max_z)
	rotation.y = heading
	body.speed = 0.0 if (grounded or state == S.DODGE) else Vector2(vx, vz).length()
	var cur := body.current
	if state == S.FREE and blocking:
		if cur != "block" and cur != "blockHit":
			body.play("block")
	elif cur == "block":
		body.release()

func _resolve_hit(h: Dictionary, done: Array) -> void:
	for o: Fighter in arena.fighters:
		if o == self or done.has(o) or o.grounded or o.data.get("in_car", false):
			continue
		if o.team == team and o.team != "civil" and not data.get("versus", false):
			continue
		var dx := o.position.x - position.x
		var dz := o.position.z - position.z
		var d := sqrt(dx * dx + dz * dz)
		if d > h.range + o.radius * 0.5:
			continue
		var ang := absf(wrapf(atan2(dx, dz) - heading, -PI, PI))
		if ang > h.arc and d > 0.5:
			continue
		done.append(o)
		var res: Dictionary = o.take_hit(self, h)
		if not res.is_empty() and arena.has_method("on_hit"):
			arena.on_hit(self, o, res, h)

static func _damp_angle(a: float, b: float, lambda: float, dt: float) -> float:
	var d := wrapf(b - a, -PI, PI)
	return a + d * (1 - exp(-lambda * dt))
