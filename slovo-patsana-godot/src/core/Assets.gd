class_name Assets
## Where the models and textures live: the full set for desktop, the light set
## (512 px textures, no detail maps) for the web and phones.

static var _base := ""

static func base() -> String:
	if _base == "":
		var light := OS.has_feature("web") or OS.has_feature("mobile")
		_base = "res://assets_m/" if (light and ResourceLoader.exists("res://assets_m/characters/vova.glb")) else "res://assets/"
	return _base

static func p(rel: String) -> String:
	return base() + rel
