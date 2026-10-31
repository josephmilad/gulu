extends SceneTree
## Builds the city and environment, renders a few views, saves screenshots (xvfb).
var t := 0.0
var shots := 0
var city: City
var env: Env
var cam: Camera3D
var views := []
func _init():
	process_frame.connect(_setup, CONNECT_ONE_SHOT)
func _setup():
	var root3d := Node3D.new()
	get_root().add_child(root3d)
	env = Env.new()
	root3d.add_child(env)
	city = City.new()
	root3d.add_child(city)
	env.set_lamp_spots(city.lamp_spots)
	cam = Camera3D.new()
	cam.fov = 60
	cam.far = 700
	root3d.add_child(cam)
	cam.current = true
	var s: Vector3 = Vector3(city.spawn.x, 1.6, city.spawn.z)
	var cx: float = city.spawn.x - 4
	var cz: float = city.spawn.z - 10
	views = [
		[Vector3(cx + 8, 1.7, cz + 6), Vector3(cx + 24, 1.5, cz + 22)],   # kiosk + trees by the Универсам
		[Vector3(cx + 30, 1.6, cz + 46), Vector3(cx + 10, 2, cz + 30)],   # street with lamps and a bus stop
		[Vector3(City.block_center(1, 4).x, 3, City.block_center(1, 4).y + 30), Vector3(City.block_center(1, 4).x, 1, City.block_center(1, 4).y)],  # rink
		[s + Vector3(0, 60, 80), s],                                   # overview
	]
	for b in city.find_children("*", "Body", true, false):
		pass
	process_frame.connect(_tick)
func _tick():
	var dt := get_root().get_process_delta_time()
	t += dt
	env.update(dt, Vector3(city.spawn.x, 0, city.spawn.z))
	city.update(t)
	if shots < views.size():
		var v = views[shots]
		cam.position = v[0]
		cam.look_at(v[1])
		if t > 0.3 + shots * 0.6:
			var img := get_root().get_viewport().get_texture().get_image()
			img.save_png("/tmp/sp/city_%d.png" % shots)
			print("shot ", shots)
			shots += 1
	elif t > 0.3 + views.size() * 0.6 + 0.3:
		quit()
