extends SceneTree
func _init():
	process_frame.connect(_run, CONNECT_ONE_SHOT)
func _run():
	for kind in CarModel.KINDS:
		var v := CarModel.build(kind)
		var car: Node3D = v.body.get_child(0)
		print(kind, " L=%.2f W=%.2f" % [v.length, v.width], " root xform=", car.transform.basis.get_scale(), " ", car.transform.origin, " wheels=", v.wheels.size())
		# Compare with a true AABB after adding to the tree.
		get_root().add_child(v.root)
		var aabb := AABB()
		var first := true
		for mi in car.find_children("*", "MeshInstance3D", true, false):
			var tb: AABB = mi.global_transform * mi.get_aabb()
			aabb = tb if first else aabb.merge(tb)
			first = false
		print("   true: size=", aabb.size, " pos=", aabb.position)
		v.root.queue_free()
	quit()
