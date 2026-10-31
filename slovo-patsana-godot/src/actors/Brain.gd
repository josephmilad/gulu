class_name Brain
## Per-NPC decision making (port of actors/ai.ts). Writes into fighter.ctrl each frame.
## Roles: ped, gang, ally, duel, police. The world `w` offers fighters, players, city,
## wanted and bark(f, text).

var role := "ped"
var mode := "idle"   # idle | walk | flee | fight | return
var target: Fighter = null
var home := Vector2.ZERO
var brave := true
var skill := 0.5
var idle_anim := ""
var hunt := false
var _node := -1
var _cool := 0.5 + randf()
var _strafe := 1 if randf() < 0.5 else -1
var _strafe_t := 0.0
var _block_t := 0.0
var _combo_left := 0
var _flee_from := Vector2.ZERO
var _mode_t := 0.0
var _bark_cd := 0.0

func _init(role_: String, home_: Vector2, skill_ := 0.5) -> void:
	role = role_
	home = home_
	skill = skill_
	brave = randf() < 0.25 if role == "ped" else true
	if role == "ped":
		mode = "walk"
	if role == "gang" and randf() < 0.5:
		idle_anim = "smoke"

static func d2(a: Node3D, b: Vector2) -> float:
	return Vector2(a.position.x - b.x, a.position.z - b.y).length()

func say(w: Node, f: Fighter, key: String) -> void:
	if _bark_cd > 0:
		return
	_bark_cd = 4 + randf() * 4
	w.bark(f, Looks.pick(Looks.BARKS[key]))

## Make this NPC fight `t` (and tell friends nearby).
func engage(f: Fighter, t: Fighter, w: Node, rally := true) -> void:
	if target == t and mode == "fight":
		return
	target = t
	mode = "fight"
	_mode_t = 0
	f.data["guard"] = true
	if rally and role == "gang":
		for o: Fighter in w.fighters:
			if o == f or o.team != f.team or not o.alive:
				continue
			var b: Brain = o.data.get("brain")
			if b and b.mode != "fight" and o.dist_to(f) < 20:
				b.engage(o, t, w, false)

func hostile_to(o: Fighter) -> bool:
	if role == "duel":
		return true
	if role == "gang":
		return o.team == "universam" and o.alive
	if role == "ally":
		return (o.team == "razezd" or o.team == "hadi") and o.alive and not o.data.get("spar", false)
	if role == "police":
		return o.team == "universam" and o.data.get("is_player", false) and o.alive
	return false

func update(f: Fighter, dt: float, w: Node) -> void:
	var c := f.ctrl
	c.punch = false
	c.kick = false
	c.special = false
	c.dodge = false
	c.block = false
	c.face = null
	c.mx = 0.0
	c.mz = 0.0
	c.speed = 0.0
	_cool -= dt
	_mode_t += dt
	_bark_cd -= dt
	if not f.alive or f.grounded:
		return
	if f.state == Fighter.S.HIT or f.state == Fighter.S.DODGE:
		return
	# React to being hit.
	var la := f.last_attacker
	if la and la.alive and f.since_combat < 0.2 and target != la:
		if role == "ped":
			if brave and f.hp > f.max_hp * 0.4:
				say(w, f, "pedAngry")
				engage(f, la, w)
			else:
				flee(Vector2(la.position.x, la.position.z), w, f)
		elif role == "police":
			engage(f, la, w)
		elif role != "ally" or la.team != "universam":
			if role == "gang":
				say(w, f, "gangHit")
			engage(f, la, w)
	match mode:
		"idle":
			_idle(f, w)
		"walk":
			_walk(f, w)
		"flee":
			_do_flee(f)
		"return":
			var d := d2(f, home)
			if d < 1.5:
				mode = "walk" if role == "ped" else "idle"
				f.data["guard"] = false
			else:
				_move_to(f, home.x, home.y, 3.2)
			_scan(f, w)
		"fight":
			_fight(f, dt, w)
	if mode != "idle" and idle_anim != "" and f.body.current == idle_anim:
		f.body.release()

func _move_to(f: Fighter, x: float, z: float, speed: float) -> void:
	var dx := x - f.position.x
	var dz := z - f.position.z
	var d := maxf(1e-6, sqrt(dx * dx + dz * dz))
	f.ctrl.mx = dx / d
	f.ctrl.mz = dz / d
	f.ctrl.speed = speed

func _scan(f: Fighter, w: Node) -> void:
	if role == "ped":
		for o: Fighter in w.fighters:
			if o == f or not o.alive or o.since_combat > 0.5:
				continue
			if o.state == Fighter.S.ATTACK and o.dist_to(f) < 11:
				flee(Vector2(o.position.x, o.position.z), w, f)
				return
		return
	for o: Fighter in w.fighters:
		if o == f or not hostile_to(o) or o.grounded or o.data.get("in_car", false):
			continue
		var d := o.dist_to(f)
		if role == "gang":
			var zone := City.zone_at(o.position.x, o.position.z)
			if (d < 11 and zone == f.team) or (hunt and d < 40):
				say(w, f, "gangAggro")
				engage(f, o, w)
				return
		elif role == "ally":
			var near_player := false
			for p: Fighter in w.players:
				if p.dist_to(o) < 8 and (p.since_combat < 3 or o.since_combat < 3):
					near_player = true
			if d < 18 and near_player:
				say(w, f, "allyJoin")
				engage(f, o, w)
				return
		elif role == "police":
			if w.get("wanted") != null and w.wanted > 0 and d < 40:
				say(w, f, "police")
				engage(f, o, w)
				return
		elif role == "duel":
			engage(f, o, w)
			return

func _idle(f: Fighter, w: Node) -> void:
	if d2(f, home) > 2:
		_move_to(f, home.x, home.y, 1.4)
	elif idle_anim != "" and f.body.current != idle_anim and f.state == Fighter.S.FREE:
		f.body.play(idle_anim)
	if role != "duel" and f.ctrl.speed == 0:
		f.ctrl.face = atan2(home.x - f.position.x + 0.01, home.y - f.position.z) + PI
	if role == "ally":
		# Follow the player around in Universam turf.
		if w.players.size() > 0:
			var p: Fighter = w.players[0]
			var dp := p.dist_to(f)
			if p.alive and d2(p, home) < 25 and dp > 4 and dp < 25:
				_move_to(f, p.position.x, p.position.z, 3.5)
	_scan(f, w)

func _walk(f: Fighter, w: Node) -> void:
	var city = w.city
	if city == null:
		return
	if _node < 0:
		var best := 0
		var bd := 1e9
		for i in range(city.walk_nodes.size()):
			var n: Dictionary = city.walk_nodes[i]
			var d := Vector2(n.x - f.position.x, n.z - f.position.z).length()
			if d < bd:
				bd = d
				best = i
		_node = best
	var n: Dictionary = city.walk_nodes[_node]
	if Vector2(n.x - f.position.x, n.z - f.position.z).length() < 1.2:
		_node = Looks.pick(n.next)
	var t: Dictionary = city.walk_nodes[_node]
	_move_to(f, t.x, t.z, 1.35)
	_scan(f, w)

func flee(from: Vector2, w: Node, f: Fighter) -> void:
	if mode != "flee":
		say(w, f, "pedFlee")
	mode = "flee"
	_mode_t = 0
	_flee_from = from
	target = null

func _do_flee(f: Fighter) -> void:
	var dx := f.position.x - _flee_from.x
	var dz := f.position.z - _flee_from.y
	var d := maxf(1e-6, sqrt(dx * dx + dz * dz))
	dx /= d
	dz /= d
	var a := sin(_mode_t * 1.3 + f.position.x) * 0.5
	f.ctrl.mx = dx * cos(a) - dz * sin(a)
	f.ctrl.mz = dx * sin(a) + dz * cos(a)
	f.ctrl.speed = 5.2
	if _mode_t > 7 or d > 40:
		mode = "walk" if role == "ped" else "return"
		_node = -1

func _fight(f: Fighter, dt: float, w: Node) -> void:
	var t := target
	var c := f.ctrl
	var police_done: bool = role == "police" and (w.get("wanted") == null or w.wanted == 0)
	if police_done or t == null or not t.alive or (role == "gang" and d2(f, home) > 45) or (role == "ped" and _mode_t > 12):
		target = null
		mode = "walk" if role == "ped" else "return"
		_node = -1
		return
	if role == "gang" and f.hp < f.max_hp * 0.2 and randf() < 0.004:
		flee(Vector2(t.position.x, t.position.z), w, f)
		return
	var dx := t.position.x - f.position.x
	var dz := t.position.z - f.position.z
	var d := maxf(1e-6, sqrt(dx * dx + dz * dz))
	c.face = atan2(dx, dz)
	# Only a couple of enemies press in at once; the rest circle and wait their turn.
	var closer := 0
	for o: Fighter in w.fighters:
		if o == f or not o.alive or o.grounded:
			continue
		var b: Brain = o.data.get("brain")
		if b and b.target == t and b.mode == "fight" and o.dist_to(t) < d - 0.05:
			closer += 1
	var engaged := closer < (1 if role == "duel" else 2)
	var want := 2.2 if t.grounded else (1.15 if engaged else 3.4)
	_strafe_t -= dt
	if _strafe_t <= 0:
		_strafe_t = 0.8 + randf() * 1.8
		if randf() < 0.4:
			_strafe *= -1
	var nx := dx / d
	var nz := dz / d
	if d > want + 0.35:
		c.mx = nx
		c.mz = nz
		c.speed = 5.2 if d > 6 else 3.2
	elif d < want - 0.4:
		c.mx = -nx
		c.mz = -nz
		c.speed = 2
	else:
		c.mx = -nz * _strafe
		c.mz = nx * _strafe
		c.speed = 0.9 if engaged else 1.6
	# Defence: react to an incoming attack.
	_block_t -= dt
	var threatened := t.state == Fighter.S.ATTACK and d < 2.2
	if threatened and _block_t < -0.3 and randf() < 0.08 + skill * 0.25:
		if randf() < 0.25 * skill and f.stamina > 30:
			c.dodge = true
		else:
			_block_t = 0.35 + randf() * 0.3
	if _block_t > 0:
		c.block = true
		return
	# Offence
	if f.state == Fighter.S.ATTACK and _combo_left > 0:
		c.punch = true
		_combo_left -= 1
		return
	if engaged and not t.grounded and d < 1.7 and _cool <= 0 and f.state == Fighter.S.FREE:
		var r := randf()
		if f.special != "" and f.stamina > 60 and r < 0.12 + skill * 0.1:
			c.special = true
		elif r < 0.32:
			c.kick = true
		else:
			c.punch = true
			_combo_left = (1 + randi() % 2) if randf() < 0.3 + skill * 0.4 else 0
		_cool = (1.4 - skill * 0.9) * (0.6 + randf() * 0.8)
