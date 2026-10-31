extends SceneTree
## Isolated check of the car dynamics: full throttle for 3 s, with and without the city grid.
class Arena:
	var grid = null
	var vehicles := []
	func on_car_hit(v, speed, what, other): print("  hit ", what, " speed=%.1f" % speed)
func _init():
	process_frame.connect(_run, CONNECT_ONE_SHOT)
func _run():
	var root := Node3D.new()
	get_root().add_child(root)
	for use_grid in [false, true]:
		var a := Arena.new()
		if use_grid:
			var city := City.new()
			root.add_child(city)
			a.grid = city.grid
		var v := Vehicle.create(root, "volga")
		a.vehicles.append(v)
		v.place(-4, 46, PI / 2)   # the spot from the drive test
		v.driver = "me"
		v.input = {"throttle": 1.0, "steer": 0.0, "handbrake": false}
		for i in range(90):
			v.update(1.0 / 30.0, a)
			if i % 15 == 14:
				print("grid=", use_grid, " t=%.1f speed=%.2f pos=(%.1f,%.1f) hp=%.0f" % [(i + 1) / 30.0, v.speed, v.x, v.z, v.health])
		v.queue_free()
	quit()
