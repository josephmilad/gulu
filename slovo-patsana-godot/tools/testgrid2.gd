extends SceneTree
func _init():
	process_frame.connect(_run, CONNECT_ONE_SHOT)
func _run():
	var city := City.new()
	get_root().add_child(city)
	var g := city.grid
	var x := -3.6
	var z := 46.0
	var r := 0.8
	print("query: ", g.query(x - r, z - r, x + r, z + r))
	print("resolve: ", g.resolve_circle(x, z, r))
	for b in g.query(x - r, z - r, x + r, z + r):
		var cx: float = clampf(x, b.min_x, b.max_x)
		var cz: float = clampf(z, b.min_z, b.max_z)
		print("  box ", b, " closest ", cx, ",", cz, " d=", Vector2(x - cx, z - cz).length())
	# Any box with weird extents?
	var bad := 0
	for b in g.boxes:
		if b.min_x > b.max_x or b.min_z > b.max_z or (b.max_x - b.min_x) > 200 or (b.max_z - b.min_z) > 200:
			bad += 1
			if bad < 6:
				print("  odd box ", b)
	print("odd boxes: ", bad, " of ", g.boxes.size(), " cells=", g.cells.size())
	quit()
