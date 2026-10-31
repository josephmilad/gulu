class_name Vehicle
extends Node3D
## Arcade car dynamics with a real velocity vector and tyre grip, so the handbrake
## makes it slide (port of vehicles/Vehicle.ts, after depixeled-chris/gta7, MIT).
## Heading 0 faces +Z and a positive steer turns left (toward +X).

const TUNING := {
	"zhiguli": {"engine": 7.5, "brake": 16, "max_speed": 40, "reverse_max": 8, "drag": 0.08, "rolling": 1.6, "turn_rate": 2.2, "grip_speed": 6, "grip": 5.5, "grip_hb": 0.7, "mass": 1.0},
	"volga": {"engine": 7, "brake": 15, "max_speed": 42, "reverse_max": 8, "drag": 0.07, "rolling": 1.6, "turn_rate": 1.9, "grip_speed": 7, "grip": 5, "grip_hb": 0.7, "mass": 1.3},
	"taxi": {"engine": 7, "brake": 15, "max_speed": 42, "reverse_max": 8, "drag": 0.07, "rolling": 1.6, "turn_rate": 1.9, "grip_speed": 7, "grip": 5, "grip_hb": 0.7, "mass": 1.3},
	"police": {"engine": 8, "brake": 16, "max_speed": 44, "reverse_max": 8, "drag": 0.08, "rolling": 1.6, "turn_rate": 2.25, "grip_speed": 6, "grip": 5.8, "grip_hb": 0.7, "mass": 1.0},
	"zil": {"engine": 4.5, "brake": 11, "max_speed": 26, "reverse_max": 6, "drag": 0.1, "rolling": 2, "turn_rate": 1.5, "grip_speed": 8, "grip": 5, "grip_hb": 1.2, "mass": 3.0},
	"uaz": {"engine": 7.8, "brake": 15, "max_speed": 36, "reverse_max": 8, "drag": 0.09, "rolling": 1.8, "turn_rate": 2.0, "grip_speed": 6, "grip": 6, "grip_hb": 1.0, "mass": 1.6},
}
const SNOW_GRIP := 0.75
static var _ids := 0

var id := 0
var kind := "zhiguli"
var vis: Dictionary
var heading := 0.0
var vx := 0.0
var vz := 0.0
var health := 100.0
var input := {"throttle": 0.0, "steer": 0.0, "handbrake": false}
var driver = null        ## a Fighter, or "npc"
var wheel_spin := 0.0
var siren := false
var data := {}
var tune: Dictionary
var half_len := 2.0
var half_wid := 0.8
var _steer_vis := 0.0
var _siren_t := 0.0

static func create(parent: Node3D, kind_: String) -> Vehicle:
	var v := Vehicle.new()
	_ids += 1
	v.id = _ids
	v.kind = kind_
	v.tune = TUNING[kind_]
	v.vis = CarModel.build(kind_)
	v.add_child(v.vis.root)
	v.half_len = v.vis.length / 2
	v.half_wid = v.vis.width / 2
	parent.add_child(v)
	return v

var x: float:
	get: return position.x
var z: float:
	get: return position.z
var speed: float:
	get: return Vector2(vx, vz).length()
var fwd_x: float:
	get: return sin(heading)
var fwd_z: float:
	get: return cos(heading)
var forward_speed: float:
	get: return vx * fwd_x + vz * fwd_z
var wrecked: bool:
	get: return health <= 0

func dist_to_point(pt: Vector3) -> float:
	return Vector2(x - pt.x, z - pt.z).length()

func place(px: float, pz: float, h: float) -> void:
	position = Vector3(px, 0, pz)
	heading = h
	vx = 0
	vz = 0
	sync()

## Where the driver gets in/out (left side; Soviet cars are left-hand drive).
func door_pos() -> Vector2:
	var lx := cos(heading)
	var lz := -sin(heading)
	return Vector2(x + lx * (half_wid + 0.7) + fwd_x * 0.3, z + lz * (half_wid + 0.7) + fwd_z * 0.3)

func update(dt: float, arena) -> void:
	var t := tune
	var inp := input if not wrecked else {"throttle": 0.0, "steer": 0.0, "handbrake": true}
	var throttle: float = clampf(inp.throttle, -1, 1)
	var steer: float = clampf(inp.steer, -1, 1)
	var fx := fwd_x
	var fz := fwd_z
	var v_f := vx * fx + vz * fz
	if throttle != 0:
		var opposing := (v_f > 0.1 and throttle < 0) or (v_f < -0.1 and throttle > 0)
		var a: float = t.brake if opposing else t.engine * (1 - clampf(absf(v_f) / t.max_speed, 0, 1) * 0.6)
		vx += fx * throttle * a * dt
		vz += fz * throttle * a * dt
	var sp := Vector2(vx, vz).length()
	if sp > 1e-4:
		var decel: float = (t.rolling + (5.0 if inp.handbrake else 0.0)) * dt
		var k := maxf(0, 1 - decel / sp)
		vx *= k
		vz *= k
	vx -= vx * t.drag * dt
	vz -= vz * t.drag * dt
	var authority: float = clampf(Vector2(vx, vz).length() / t.grip_speed, 0, 1)
	var dir := -1.0 if (v_f < -0.1 and not inp.handbrake) else 1.0
	heading += steer * t.turn_rate * authority * dir * (1.35 if inp.handbrake else 1.0) * dt
	var nfx := sin(heading)
	var nfz := cos(heading)
	var nlx := cos(heading)
	var nlz := -sin(heading)
	var fwd := vx * nfx + vz * nfz
	var lat := vx * nlx + vz * nlz
	var grip: float = (t.grip_hb if inp.handbrake else t.grip) * SNOW_GRIP
	lat *= exp(-grip * dt)
	fwd = clampf(fwd, -t.reverse_max, t.max_speed)
	vx = nfx * fwd + nlx * lat
	vz = nfz * fwd + nlz * lat
	position.x += vx * dt
	position.z += vz * dt
	_collide(arena)
	wheel_spin += (fwd / vis.wheel_r) * dt
	_steer_vis += (steer * 0.5 - _steer_vis) * minf(1, dt * 10)
	_siren_t += dt
	sync()
	var braking: bool = (v_f > 0.5 and throttle < 0) or inp.handbrake or (driver != null and absf(throttle) < 0.05 and sp < 1)
	for b in vis.brake:
		b.material_override = CarModel.brake_mat() if braking else CarModel.tail_mat()
	if vis.beacons.size() > 0:
		var on := siren and int(floor(_siren_t * 6)) % 2 == 0
		(vis.beacons[0].material_override as StandardMaterial3D).emission_energy_multiplier = (6.0 if on else 0.0) if siren else 0.0
		(vis.beacons[1].material_override as StandardMaterial3D).emission_energy_multiplier = (0.0 if on else 6.0) if siren else 0.0

## The car is three circles along its length for collisions: [x, z, r].
func circles() -> Array:
	var r := half_wid
	var off := half_len - r
	var out := []
	for o in [-off, 0.0, off]:
		out.append([x + fwd_x * o, z + fwd_z * o, r])
	return out

func _collide(arena) -> void:
	var g: BoxGrid = arena.grid
	if g:
		for pass_ in range(2):
			for c in circles():
				var cx: float = c[0]
				var cz: float = c[1]
				var r: float = c[2]
				var n := g.resolve_circle(cx, cz, r)
				# Vector2 is single precision: ignore rounding noise, only real pushes count.
				if absf(n.x - cx) > 1e-4 or absf(n.y - cz) > 1e-4:
					position.x += n.x - cx
					position.z += n.y - cz
					var px := n.x - cx
					var pz := n.y - cz
					var pl := maxf(1e-6, sqrt(px * px + pz * pz))
					var nx := px / pl
					var nz := pz / pl
					var into := vx * nx + vz * nz
					if into < 0:
						if pass_ == 0:
							arena.on_car_hit(self, -into, "wall", null)
						vx -= nx * into * 1.3
						vz -= nz * into * 1.3
						health -= maxf(0, -into - 6) * 2.5
	for o: Vehicle in arena.vehicles:
		if o == self or o.id < id:
			continue
		for a in circles():
			for b in o.circles():
				var dx: float = a[0] - b[0]
				var dz: float = a[1] - b[1]
				var d := sqrt(dx * dx + dz * dz)
				var rr: float = a[2] + b[2]
				if d >= rr or d < 1e-4:
					continue
				var nx := dx / d
				var nz := dz / d
				var pen := rr - d
				var ma: float = tune.mass
				var mb: float = o.tune.mass
				position.x += nx * pen * (mb / (ma + mb))
				position.z += nz * pen * (mb / (ma + mb))
				o.position.x -= nx * pen * (ma / (ma + mb))
				o.position.z -= nz * pen * (ma / (ma + mb))
				var rel := (vx - o.vx) * nx + (vz - o.vz) * nz
				if rel < 0:
					var j := (-(1 + 0.3) * rel) / (1 / ma + 1 / mb)
					vx += (j / ma) * nx
					vz += (j / ma) * nz
					o.vx -= (j / mb) * nx
					o.vz -= (j / mb) * nz
					var dmg := maxf(0, -rel - 5) * 2
					health -= dmg
					o.health -= dmg
					arena.on_car_hit(self, -rel, "car", o)

func sync() -> void:
	rotation.y = heading
	var lat := vx * cos(heading) - vz * sin(heading)
	(vis.body as Node3D).rotation.z = clampf(-lat * 0.012, -0.06, 0.06)
	for w in vis.wheels:
		(w as Node3D).rotation.x = wheel_spin
	for s in vis.steer:
		(s as Node3D).rotation.y = _steer_vis * 0.8
