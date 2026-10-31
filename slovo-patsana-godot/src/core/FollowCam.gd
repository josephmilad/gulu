class_name FollowCam
## GTA-style orbit camera (port of core/FollowCamera.ts): mouse/stick orbits, recentres
## behind a moving target, backs off walls with a ray.

var cam: Camera3D
var yaw := PI
var pitch := 0.32
var dist := 5.2
var shake := 0.0
var car := false
var _cur_dist := 5.2
var _target := Vector3.ZERO
var _idle := 0.0

func _init(camera: Camera3D) -> void:
	cam = camera

## Forward direction for movement input, in world XZ.
func forward() -> Vector2:
	return Vector2(-sin(yaw), -cos(yaw))

func snap(x: float, z: float, heading: float) -> void:
	_target = Vector3(x, 1.5, z)
	yaw = heading + PI
	_cur_dist = dist
	update(0.001, x, z, heading, false, 0, 0, false)

static func _damp(a: float, b: float, l: float, dt: float) -> float:
	return b + (a - b) * exp(-l * dt)

func update(dt: float, x: float, z: float, heading: float, moving: bool, look_x: float, look_y: float, combat: bool) -> void:
	_target.x = _damp(_target.x, x, 12, dt)
	_target.z = _damp(_target.z, z, 12, dt)
	_target.y = 1.3 if car else 1.55
	if absf(look_x) + absf(look_y) > 1e-4:
		_idle = 0
	else:
		_idle += dt
	yaw += look_x
	pitch = clampf(pitch - look_y, -0.25, 1.2)
	if moving and not combat and _idle > (0.6 if car else 1.2):
		yaw = Fighter._damp_angle(yaw, heading + PI, 3.5 if car else 1.6, dt)
	if car and _idle > 0.6:
		pitch += (0.22 - pitch) * minf(1, dt * 2)
	var want := 8.0 if car else (dist + 0.8 if combat else dist)
	var dir := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	var d := want
	var space := cam.get_world_3d().direct_space_state if cam.is_inside_tree() else null
	if space:
		var q := PhysicsRayQueryParameters3D.create(_target, _target + dir * want, 1)
		var hit := space.intersect_ray(q)
		if not hit.is_empty():
			d = maxf(0.8, _target.distance_to(hit.position) - 0.3)
	_cur_dist = d if d < _cur_dist else _damp(_cur_dist, d, 4, dt)
	var p := _target + dir * _cur_dist
	p.y = maxf(0.4, p.y)
	if shake > 0:
		shake = maxf(0, shake - dt * 3)
		p.x += (randf() - 0.5) * shake * 0.25
		p.y += (randf() - 0.5) * shake * 0.25
	cam.position = p
	cam.look_at(_target + Vector3(0, 0.15, 0))
