class_name Controls
## The controls table, keyboard or touch.

static func text() -> String:
	return T.t("controls.touch" if Game.touch else "controls.kb")
