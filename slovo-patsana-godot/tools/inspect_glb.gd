extends SceneTree
## Prints what Godot made of an imported GLB: node tree, skeleton bones, animations.
func _init():
	var path: String = OS.get_environment("GLB")
	var ps: PackedScene = load(path)
	var inst := ps.instantiate()
	_dump(inst, 0)
	var ap := inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if ap:
		var names := []
		for lib in ap.get_animation_library_list():
			for a in ap.get_animation_library(lib).get_animation_list():
				var anim := ap.get_animation_library(lib).get_animation(a)
				names.append("%s/%s:%.2f(%d tracks)" % [lib, a, anim.length, anim.get_track_count()])
		print("ANIMS ", names)
	var sk := inst.find_child("Skeleton3D", true, false) as Skeleton3D
	if sk:
		var bones := []
		for i in range(sk.get_bone_count()): bones.append(sk.get_bone_name(i))
		print("BONES ", sk.get_bone_count(), " ", bones.slice(0, 12))
	quit()
func _dump(n: Node, d: int):
	if d < 3: print("  ".repeat(d), n.name, " (", n.get_class(), ")", (" mesh=" + str((n as MeshInstance3D).mesh.get_surface_count()) + " surfaces") if n is MeshInstance3D else "")
	for c in n.get_children(): _dump(c, d + 1)
