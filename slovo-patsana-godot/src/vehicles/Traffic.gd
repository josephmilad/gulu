class_name CarDriver
## Drives a car around the road grid (port of vehicles/Traffic.ts): right-hand lanes, a
## random turn at each crossing, slows for anything in front. In chase mode it picks
## turns that close the distance to a target and goes straight for it once in sight.

const LANE := 1.7

var dir := Vector2i(0, 1)
var node := Vector2i(0, 0)   # next intersection (ix, iz)
var honk := false
var cruise := 8 + randf() * 3
var chase: Node3D = null
var hold := false
var _chosen := false
var _stuck := 0.0
var _reverse_t := 0.0
var _blocked_t := 0.0
var _ignore_t := 0.0

static func road_c(k: int) -> float:
	return -City.HALF + k * City.PITCH

func _init(d: Vector2i, n: Vector2i) -> void:
	dir = d
	node = n

## Place a car on a random road segment around a point: {x, z, heading, driver} or {}.
static func spawn_around(cx: float, cz: float, min_d: float, max_d: float) -> Dictionary:
	for tries in range(30):
		var vertical := randf() < 0.5
		var k := randi() % (City.N + 1)
		var along := -City.HALF + 10 + randf() * (City.HALF * 2 - 20)
		var sign := 1 if randf() < 0.5 else -1
		var d := Vector2i(0, sign) if vertical else Vector2i(sign, 0)
		var right := Vector2i(-d.y, d.x)
		var x := (road_c(k) if vertical else along) + right.x * LANE
		var z := (along if vertical else road_c(k)) + right.y * LANE
		var dist := Vector2(x - cx, z - cz).length()
		if dist < min_d or dist > max_d:
			continue
		var t := fposmod(along + City.HALF, City.PITCH)
		if t < 12 or t > City.PITCH - 12:
			continue
		var next_idx := floori((along + City.HALF) / City.PITCH) + (1 if sign > 0 else 0)
		if next_idx < 0 or next_idx > City.N:
			continue
		var n := Vector2i(k, next_idx) if vertical else Vector2i(next_idx, k)
		return {"x": x, "z": z, "heading": atan2(float(d.x), float(d.y)), "driver": CarDriver.new(d, n)}
	return {}

func _node_pos() -> Vector2:
	return Vector2(road_c(node.x), road_c(node.y))

func _pick_turn() -> Vector2i:
	var opts := [dir, Vector2i(-dir.y, dir.x), Vector2i(dir.y, -dir.x)]
	var valid := []
	for o in opts:
		var n: Vector2i = node + o
		if n.x >= 0 and n.x <= City.N and n.y >= 0 and n.y <= City.N:
			valid.append(o)
	if valid.is_empty():
		return -dir
	if chase:
		var p := _node_pos()
		var best: Vector2i = valid[0]
		var bd := 1e9
		for o in valid:
			var d := Vector2(p.x + o.x * City.PITCH - chase.position.x, p.y + o.y * City.PITCH - chase.position.z).length()
			if d < bd:
				bd = d
				best = o
		return best
	if valid.size() > 1 and randf() < 0.55 and valid.has(dir):
		return dir
	return valid[randi() % valid.size()]

## obstacles: Array of Node3D (fighters and vehicles).
func update(v: Vehicle, dt: float, obstacles: Array, grid: BoxGrid) -> void:
	var inp := v.input
	if hold:
		inp.throttle = -1.0 if v.forward_speed > 0.3 else 0.0
		inp.steer = 0.0
		inp.handbrake = v.speed < 0.5
		return
	var np := _node_pos()
	var old_dir := dir
	var dist_node := Vector2(np.x - v.x, np.y - v.z).length()
	if dist_node < 9 and not _chosen:
		_chosen = true
		dir = _pick_turn()
	var ahead := (v.x - np.x) * dir.x + (v.z - np.y) * dir.y
	if _chosen and ahead > 4:
		node = node + dir
		_chosen = false
	var ex := float(dir.x)
	var ez := float(dir.y)
	var rx := -ez
	var rz := ex
	var lx := np.x + rx * LANE
	var lz := np.y + rz * LANE
	var t := (v.x - lx) * ex + (v.z - lz) * ez
	var tx := lx + ex * (t + 7)
	var tz := lz + ez * (t + 7)
	var target := cruise
	if dist_node < 16 and dir != old_dir:
		target = 5
	if chase:
		target = 15
		var d := Vector2(chase.position.x - v.x, chase.position.z - v.z).length()
		var clear := grid == null or grid.segment_hit(v.x, 1, v.z, chase.position.x, 1, chase.position.z) >= 1
		if d < 35 and clear:
			tx = chase.position.x
			tz = chase.position.z
			target = 4.0 if d < 8 else 13.0
	var want := atan2(tx - v.x, tz - v.z)
	var err := wrapf(want - v.heading, -PI, PI)
	var steer := clampf(err * 2.4, -1, 1)
	honk = false
	_ignore_t -= dt
	if chase == null and _ignore_t <= 0:
		var before := target
		for o: Node3D in obstacles:
			var ox := o.position.x - v.x
			var oz := o.position.z - v.z
			var d := sqrt(ox * ox + oz * oz)
			if d < 1 or d > 13:
				continue
			var along := ox * v.fwd_x + oz * v.fwd_z
			var side := absf(ox * cos(v.heading) - oz * sin(v.heading))
			if along > 0 and side < 1.5:
				target = minf(target, maxf(0, (d - 5) * 0.8))
		if target < 1 and before > 1:
			_blocked_t += dt
			if _blocked_t > 3:
				_blocked_t = 0
				_ignore_t = 2
				honk = true
		else:
			_blocked_t = 0
	if inp.throttle > 0.3 and v.speed < 0.6:
		_stuck += dt
	else:
		_stuck = maxf(0, _stuck - dt)
	if _stuck > 1.6:
		_reverse_t = 1.3
		_stuck = 0
	if _reverse_t > 0:
		_reverse_t -= dt
		inp.throttle = -0.8
		inp.steer = -steer
		inp.handbrake = false
		return
	var fs := v.forward_speed
	inp.throttle = clampf((target - fs) * 0.45, -1, 1)
	if target < 0.5 and fs < 0.5:
		inp.throttle = 0.0
	inp.handbrake = target < 0.5 and fs < 1
	inp.steer = steer
