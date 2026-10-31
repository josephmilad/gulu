class_name Credits
## Attribution for third-party assets (CC BY needs the authors named in the game).

static func text() -> String:
	var lines := [T.t("credits.intro"), "", T.t("credits.models")]
	var f := FileAccess.open("res://assets/CREDITS.txt", FileAccess.READ)
	if f:
		for line in f.get_as_text().split("\n"):
			if line.strip_edges() != "":
				lines.append("• " + line.strip_edges())
	lines.append("")
	lines.append(T.t("credits.free"))
	lines.append("• Poly Haven — HDRI, textures, props · CC0")
	lines.append("• Quaternius Universal Animation Library 1 & 2 · CC0")
	lines.append("• depixeled-chris/gta7 — car dynamics · MIT")
	lines.append("• Godot Engine · MIT")
	return "\n".join(lines)
