extends Node3D
## Entry point: builds the world and portraits, then opens the menu (or a scripted
## test when launched with `-- --test <name>`). Also owns the menu → select → mode flow.

var loading: Label

func _ready() -> void:
	loading = UI.label(T.t("loading"), 28, UI.GOLD, true)
	loading.set_anchors_preset(Control.PRESET_CENTER)
	loading.grow_horizontal = Control.GROW_DIRECTION_BOTH
	loading.grow_vertical = Control.GROW_DIRECTION_BOTH
	Game.ui_layer.add_child(loading)
	await get_tree().process_frame
	Game.get_world()
	loading.text = T.t("portraits")
	await Game.make_portraits()
	loading.queue_free()
	if Game.touch:
		Game.ui_layer.add_child(TouchUI.new())
	var args := OS.get_cmdline_user_args()
	var ti := args.find("--test")
	if ti >= 0 and ti + 1 < args.size():
		var drv: Node = load("res://tools/TestDriver.gd").new()
		add_child(drv)
		drv.run(args[ti + 1])
		return
	menu(false)

func menu(started := true) -> void:
	Game.set_mode(Menu.new().init(func(players: int, mode: String): select(players, mode), started))

func select(players: int, mode: String) -> void:
	Game.set_mode(Select.new().init(players, func(ids: Array): play(ids, mode), func(): menu()))

func play(ids: Array, mode: String) -> void:
	match mode:
		"free", "story":
			Game.set_mode(FreeRoam.new().init(ids[0], func(): menu(), {"story": mode == "story"}))
		"cpu":
			# The CPU picks someone else from the roster.
			var others := Characters.roster().filter(func(c): return c.id != ids[0])
			var rival: String = others[randi() % others.size()].id
			Game.set_mode(Versus.new().init([ids[0], rival], true, func(): menu()))
		"versus":
			Game.set_mode(Versus.new().init(ids, false, func(): menu()))
