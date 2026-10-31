extends Node3D
## Entry point: builds the world and portraits, then opens the menu (or a scripted
## test when launched with `-- --test <name>`).

var loading: Label

func _ready() -> void:
	loading = UI.label("ЗАГРУЗКА РАЙОНА…", 28, UI.GOLD, true)
	loading.set_anchors_preset(Control.PRESET_CENTER)
	loading.grow_horizontal = Control.GROW_DIRECTION_BOTH
	loading.grow_vertical = Control.GROW_DIRECTION_BOTH
	Game.ui_layer.add_child(loading)
	await get_tree().process_frame
	Game.get_world()
	loading.text = "ПОРТРЕТЫ…"
	await Game.make_portraits()
	loading.queue_free()
	var args := OS.get_cmdline_user_args()
	var ti := args.find("--test")
	if ti >= 0 and ti + 1 < args.size():
		var drv: Node = load("res://tools/TestDriver.gd").new()
		add_child(drv)
		drv.run(args[ti + 1])
		return
	menu()

func menu() -> void:
	if ResourceLoader.exists("res://src/game/Menu.gd"):
		Game.set_mode(load("res://src/game/Menu.gd").new().start())
	else:
		Game.set_mode(FreeRoam.new().init("adidas", func(): menu()))
