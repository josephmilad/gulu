class_name Streets
## Everything with wheels (port of game/Streets.ts): parked cars you can take, traffic
## that drives the grid, and the militsiya who come after you when your wanted level rises.

const TRAFFIC := 9
const PARK_OFFSET := 3.6

var m: FreeRoam
var vehicles: Array = []
var player_car: Vehicle = null
var wanted := 0
var unseen := 0.0
var units: Array = []   # {car, officers, deployed}
var spots: Array = []   # {x, z, heading, car, kind}
var layer := Node3D.new()
var headlight := SpotLight3D.new()
var _pop_t := 0.0
var _last_crash := 0.0

var grid: BoxGrid:
	get: return m.grid

func setup(mode: FreeRoam) -> void:
	m = mode
	layer.name = "Streets"
	Game.world.add_child(layer)
	for k in range(City.N + 1):
		for seg in range(City.N):
			for side in [-1, 1]:
				for n in range(2):
					if randf() < 0.45:
						continue
					var along := -City.HALF + seg * City.PITCH + City.ROAD / 2 + 10 + n * 26 + randf() * 10
					var vertical := randf() < 0.5
					var off: float = CarDriver.road_c(k) + side * PARK_OFFSET
					spots.append({"x": off if vertical else along, "z": along if vertical else off,
						"heading": (PI if side > 0 else 0.0) if vertical else (PI / 2 if side > 0 else -PI / 2),
						"car": null, "kind": "zhiguli" if randf() < 0.65 else "volga"})
	headlight.light_color = Color("#fff0d0")
	headlight.light_energy = 0
	headlight.spot_range = 45
	headlight.spot_angle = 32
	headlight.spot_attenuation = 1.2
	headlight.shadow_enabled = false
	layer.add_child(headlight)

func _add(v: Vehicle) -> void:
	vehicles.append(v)

func _remove(v: Vehicle) -> void:
	vehicles.erase(v)
	for s in spots:
		if s.car == v:
			s.car = null
	v.queue_free()

func on_car_hit(v: Vehicle, speed: float, what: String, other) -> void:
	if speed < 3 or m.time - _last_crash < 0.15:
		return
	_last_crash = m.time
	var p: Fighter = m.players[0]
	Sfx.crash(speed / 14, Vector2(v.x - p.x, v.z - p.z).length())
	if v == player_car or other == player_car:
		m.shake(minf(1.2, speed / 12))
		if other != null and other.data.get("police", false):
			add_wanted(1, T.t("car.ram_police"))

func add_wanted(n: int, why := "") -> void:
	var before := wanted
	wanted = clampi(wanted + n, 0, 3)
	unseen = 0
	if wanted > before and why != "":
		m.hud.toast(why)

func clear_wanted() -> void:
	wanted = 0
	for u in units:
		_dismiss(u)

# ---------- Entering / leaving ----------
func _near_door(p: Fighter) -> Vehicle:
	var best: Vehicle = null
	var bd := 2.4
	for v: Vehicle in vehicles:
		if v.wrecked:
			continue
		var d := v.door_pos()
		var dist := Vector2(d.x - p.x, d.y - p.z).length()
		if dist < bd and v.speed < 3:
			bd = dist
			best = v
	return best

func _enter(p: Fighter, v: Vehicle) -> void:
	if v.driver != null and v.driver != p:
		var d := v.door_pos()
		if v.data.get("police", false):
			for u in units:
				if u.car == v and not u.deployed:
					_deploy(u)
			add_wanted(2, T.t("car.steal_police"))
		else:
			var f := m.spawn_npc("civil", "ped", d.x, d.y, d)
			f.take_impact(v.x, v.z, 5, 3)
			f.data.brain.flee(Vector2(p.x, p.z), m, f)
			m.bark(f, T.bark("carjack"))
			add_wanted(1, T.t("car.steal"))
		v.data["driver_ai"] = null
	v.driver = p
	v.data["driver_ai"] = null
	v.data["keep"] = true
	v.siren = false
	player_car = v
	p.body.visible = false
	p.data["in_car"] = true
	m.cam.car = true
	Sfx.engine_set(true, 0)

func _exit(p: Fighter) -> void:
	var v := player_car
	var d := v.door_pos()
	var r := grid.resolve_circle(d.x, d.y, 0.4)
	p.place(r.x, r.y, v.heading)
	p.body.visible = true
	p.data["in_car"] = false
	v.driver = null
	v.input = {"throttle": 0.0, "steer": 0.0, "handbrake": true}
	player_car = null
	m.cam.car = false
	Sfx.engine_set(false)

# ---------- Militsiya ----------
func _spawn_unit() -> void:
	var p: Fighter = m.players[0]
	var s := CarDriver.spawn_around(p.x, p.z, 70, 130)
	if s.is_empty():
		return
	var v := Vehicle.create(layer, "police")
	v.place(s.x, s.z, s.heading)
	v.data["police"] = true
	v.siren = true
	s.driver.chase = p
	v.data["driver_ai"] = s.driver
	v.driver = "npc"
	_add(v)
	units.append({"car": v, "officers": [], "deployed": false})

func _deploy(u: Dictionary) -> void:
	u.deployed = true
	var ai = u.car.data.get("driver_ai")
	if ai:
		ai.hold = true
	for i in range(2):
		var side := 1 if i == 0 else -1
		var lx := cos(u.car.heading) * side
		var lz := -sin(u.car.heading) * side
		var x: float = u.car.x + lx * (u.car.half_wid + 0.8)
		var z: float = u.car.z + lz * (u.car.half_wid + 0.8)
		var spec := Looks.police_spec()
		spec.merge({"hp": 80, "power": 0.95, "speed": 1.05, "team": "police", "name": Looks.pick(T.list("police_names"))})
		var f := Fighter.create(m.actor_layer, m, spec)
		f.place(x, z, u.car.heading)
		f.data["brain"] = Brain.new("police", Vector2(u.car.x, u.car.z), 0.55)
		f.data["unit"] = u
		m.add_fighter(f)
		u.officers.append(f)
		if i == 0:
			m.bark(f, T.bark("police"))
	u.car.driver = null

func _dismiss(u: Dictionary) -> void:
	u.car.siren = false
	var ai = u.car.data.get("driver_ai")
	if ai:
		ai.chase = null
		ai.hold = false

func _update_police(dt: float) -> void:
	var p: Fighter = m.players[0]
	var target: Node3D = player_car if player_car else p
	var active := units.filter(func(u): return u.car.siren)
	if wanted > active.size() and units.size() < 4:
		_spawn_unit()
	var seen := false
	for u in units:
		var car: Vehicle = u.car
		var d := Vector2(car.x - target.position.x, car.z - target.position.z).length()
		var ai = car.data.get("driver_ai")
		if car.siren and ai:
			ai.chase = target
		if wanted > 0 and car.siren:
			if d < 45 and grid.segment_hit(car.x, 1.5, car.z, target.position.x, 1.5, target.position.z) >= 1:
				seen = true
			if not u.deployed and player_car == null and d < 14 and car.speed < 6:
				_deploy(u)
		if u.deployed:
			var alive: Array = u.officers.filter(func(o): return is_instance_valid(o) and o.alive and m.fighters.has(o))
			for o: Fighter in alive:
				var od := Vector2(o.x - target.position.x, o.z - target.position.z).length()
				if od < 35 and wanted > 0:
					seen = true
				var b: Brain = o.data.brain
				b.home = Vector2(car.x, car.z)
				if (player_car != null and od > 18) or wanted == 0:
					b.target = null
					b.mode = "return"
			var back: bool = alive.all(func(o): return Vector2(o.x - car.x, o.z - car.z).length() < 3 and o.data.brain.mode != "fight")
			if back and (player_car != null or wanted == 0):
				for o in alive:
					m.remove_fighter(o)
				u.officers = []
				u.deployed = false
				car.driver = "npc"
				if ai:
					ai.hold = false
	if wanted > 0:
		unseen = 0.0 if seen else unseen + dt
		if unseen > 12 + wanted * 5:
			wanted -= 1
			unseen = 0
			m.hud.toast(T.t("police.losing") if wanted > 0 else T.t("police.lost"))
			if wanted == 0:
				for u in units:
					_dismiss(u)
	for u in units.duplicate():
		var d := Vector2(u.car.x - p.x, u.car.z - p.z).length()
		if not u.car.siren and not u.deployed and d > 120:
			units.erase(u)
			if u.car != player_car:
				_remove(u.car)

# ---------- Population ----------
func _populate() -> void:
	var p: Fighter = m.players[0]
	var px: float = player_car.x if player_car else p.x
	var pz: float = player_car.z if player_car else p.z
	for s in spots:
		var d := Vector2(s.x - px, s.z - pz).length()
		if s.car == null and d < 85 and d > 25:
			var v := Vehicle.create(layer, s.kind)
			v.place(s.x, s.z, s.heading)
			s.car = v
			_add(v)
		elif s.car != null and d > 130 and not s.car.data.get("keep", false):
			_remove(s.car)
	var traffic := 0
	for v: Vehicle in vehicles.duplicate():
		if v == player_car or v.data.get("police", false):
			continue
		var d := Vector2(v.x - px, v.z - pz).length()
		if v.data.get("driver_ai") != null:
			if d > 170:
				_remove(v)
			else:
				traffic += 1
		elif v.data.get("keep", false) and d > 160:
			_remove(v)
	if traffic < TRAFFIC:
		var s := CarDriver.spawn_around(px, pz, 55, 150)
		if not s.is_empty():
			for o: Vehicle in vehicles:
				if Vector2(o.x - s.x, o.z - s.z).length() < 7:
					return
			var roll := randf()
			var kind := "zhiguli" if roll < 0.46 else ("volga" if roll < 0.68 else ("taxi" if roll < 0.8 else ("uaz" if roll < 0.9 else "zil")))
			var v := Vehicle.create(layer, kind)
			v.place(s.x, s.z, s.heading)
			v.data["driver_ai"] = s.driver
			v.driver = "npc"
			_add(v)

# ---------- Frame ----------
func update(dt: float, it: Dictionary) -> void:
	var p: Fighter = m.players[0]
	if player_car:
		if it.interact and player_car.speed < 5:
			_exit(p)
	elif p.alive and not p.grounded and p.state == Fighter.S.FREE:
		var v := _near_door(p)
		m.hud.prompt((T.t("car.jack") if v.driver != null else T.t("car.enter")) if v else null)
		if v and it.interact:
			_enter(p, v)
	if player_car:
		var v := player_car
		v.input.throttle = it.move_y
		v.input.steer = -it.move_x
		v.input.handbrake = it.dodge or it.block
		p.place(v.x, v.z, v.heading)
		m.hud.prompt(T.t("car.exit") if v.speed < 5 else null)
		m.hud.set_speed(absf(v.forward_speed) * 3.6)
		Sfx.engine_set(true, clampf(absf(v.forward_speed) / 30 + absf(v.input.throttle) * 0.15, 0, 1))
		headlight.light_energy = 12
		headlight.position = Vector3(v.x + v.fwd_x * 2.2, 0.9, v.z + v.fwd_z * 2.2)
		headlight.look_at(Vector3(v.x + v.fwd_x * 14, 0, v.z + v.fwd_z * 14))
	else:
		m.hud.set_speed(null)
		headlight.light_energy = 0
	var obstacles: Array = []
	for f: Fighter in m.fighters:
		if f.alive and not f.data.get("in_car", false):
			obstacles.append(f)
	for v in vehicles:
		obstacles.append(v)
	for v: Vehicle in vehicles:
		var ai = v.data.get("driver_ai")
		if ai and v.driver is String:
			ai.update(v, dt, obstacles.filter(func(o): return o != v), grid)
			if ai.honk:
				Sfx.horn(Vector2(v.x - p.x, v.z - p.z).length())
		elif v.driver == null:
			v.input = {"throttle": 0.0, "steer": 0.0, "handbrake": true}
	for v: Vehicle in vehicles:
		var far := Vector2(v.x - p.x, v.z - p.z).length() > 160
		if not far or v == player_car:
			v.update(dt, self)
	_hit_people()
	_pop_t += dt
	if _pop_t > 0.5:
		_pop_t = 0
		_populate()
	_update_police(dt)
	var siren := 0.0
	for u in units:
		if u.car.siren:
			siren = maxf(siren, 1 - Vector2(u.car.x - p.x, u.car.z - p.z).length() / 120)
	Sfx.siren(maxf(0, siren))
	m.hud.set_wanted(wanted, unseen < 1)
	m.hud.blips = units.filter(func(u): return u.car.siren).map(func(u): return [u.car.x, u.car.z, Color("#5aa0ff")])

## Cars knock people down; slow cars just shove them aside.
func _hit_people() -> void:
	for v: Vehicle in vehicles:
		var c := cos(v.heading)
		var s := sin(v.heading)
		for f: Fighter in m.fighters:
			if f.data.get("in_car", false) or not f.alive:
				continue
			var dx := f.x - v.x
			var dz := f.z - v.z
			if dx * dx + dz * dz > 16:
				continue
			var lx := dx * c - dz * s
			var lz := dx * s + dz * c
			var mx := v.half_wid + f.radius * 0.8
			var mz := v.half_len + f.radius * 0.8
			if absf(lx) > mx or absf(lz) > mz:
				continue
			var sp := v.speed
			if sp > 3.5 and not f.grounded:
				var res := f.take_impact(v.x - v.vx, v.z - v.vz, sp * 3.2, sp * 0.8)
				v.vx *= 0.85
				v.vz *= 0.85
				Sfx.hit(1.3, f.dist_to(m.players[0]))
				if not res.is_empty() and v == player_car:
					if f.team == "civil" or f.team == "police":
						if res.ko:
							add_wanted(1, T.t("car.hit_person"))
					if f.team == "police":
						add_wanted(1, T.t("car.hit_police"))
					if res.ko:
						m.on_ko(m.players[0], f)
					m.shake(0.6)
				continue
			var px := mx - absf(lx)
			var pz := mz - absf(lz)
			if px < pz:
				var k := signf(lx) * px
				f.position.x += k * c
				f.position.z += -k * s
			else:
				var k := signf(lz) * pz
				f.position.x += k * s
				f.position.z += k * c

func dispose() -> void:
	Sfx.engine_set(false)
	Sfx.siren(0)
	layer.queue_free()
