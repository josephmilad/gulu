class_name BoxGrid
## Axis-aligned boxes in a coarse grid, for quick "is this spot free" queries and
## circle push-out (port of core/collision.ts). Boxes: {min_x, max_x, min_z, max_z, h}.

var cell := 24.0
var cells := {}
var boxes: Array = []

func _init(cell_size := 24.0) -> void:
	cell = cell_size

static func box(min_x: float, max_x: float, min_z: float, max_z: float, h: float) -> Dictionary:
	return {"min_x": min_x, "max_x": max_x, "min_z": min_z, "max_z": max_z, "h": h}

func add(b: Dictionary) -> void:
	boxes.append(b)
	var i0 := floori(b.min_x / cell)
	var i1 := floori(b.max_x / cell)
	var j0 := floori(b.min_z / cell)
	var j1 := floori(b.max_z / cell)
	for i in range(i0, i1 + 1):
		for j in range(j0, j1 + 1):
			var k := Vector2i(i, j)
			if not cells.has(k):
				cells[k] = []
			cells[k].append(b)

## Boxes overlapping the rectangle.
func query(min_x: float, min_z: float, max_x: float, max_z: float) -> Array:
	var out := []
	var i0 := floori(min_x / cell)
	var i1 := floori(max_x / cell)
	var j0 := floori(min_z / cell)
	var j1 := floori(max_z / cell)
	for i in range(i0, i1 + 1):
		for j in range(j0, j1 + 1):
			var list = cells.get(Vector2i(i, j))
			if list == null:
				continue
			for b in list:
				if b.max_x < min_x or b.min_x > max_x or b.max_z < min_z or b.min_z > max_z:
					continue
				if not out.has(b):
					out.append(b)
	return out

func is_free(x: float, z: float, rad: float) -> bool:
	return query(x - rad, z - rad, x + rad, z + rad).is_empty()

## Push a circle (x, z, r) out of every box it overlaps.
func resolve_circle(x: float, z: float, r: float) -> Vector2:
	for b in query(x - r, z - r, x + r, z + r):
		var cx: float = clampf(x, b.min_x, b.max_x)
		var cz: float = clampf(z, b.min_z, b.max_z)
		var dx := x - cx
		var dz := z - cz
		var d := sqrt(dx * dx + dz * dz)
		if d >= r:
			continue
		if d < 1e-5:
			# Centre inside the box: leave through the nearest face.
			var dl: float = x - b.min_x
			var dr: float = b.max_x - x
			var dn: float = z - b.min_z
			var df: float = b.max_z - z
			var m := minf(minf(dl, dr), minf(dn, df))
			if m == dl:
				x = b.min_x - r
			elif m == dr:
				x = b.max_x + r
			elif m == dn:
				z = b.min_z - r
			else:
				z = b.max_z + r
		else:
			x = cx + dx / d * r
			z = cz + dz / d * r
	return Vector2(x, z)
