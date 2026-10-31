extends SceneTree
func _init():
	process_frame.connect(_run, CONNECT_ONE_SHOT)
func _run():
	var city := City.new()
	get_root().add_child(city)
	var g := city.grid
	print("boxes near the road x=0, z 40..60:")
	for b in g.query(-8, 40, 8, 60):
		print("  ", b)
	# Simulate a car on the vertical road x = -3.6 heading +z.
	var v := Vehicle.create(city, "volga")
	var a := {"grid": g, "vehicles": [v]}
	v.place(-3.6, 46, 0)
	v.driver = "me"
	v.input = {"throttle": 1.0, "steer": 0.0, "handbrake": false}
	var arena := Arena.new(g, [v])
	for i in range(90):
		v.update(1.0 / 30.0, arena)
		if i % 30 == 29:
			print("t=%.1f speed=%.2f pos=(%.1f,%.1f)" % [(i + 1) / 30.0, v.speed, v.x, v.z])
	quit()
class Arena:
	var grid
	var vehicles
	func _init(g, vs):
		grid = g
		vehicles = vs
	func on_car_hit(v, speed, what, other):
		print("  hit ", what, " speed=%.1f at (%.1f,%.1f)" % [speed, v.x, v.z])
