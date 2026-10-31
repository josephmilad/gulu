class_name UI
## Small helpers for code-built UI: fonts, labels, bars, boxes, buttons.

const RED := Color("#d8262b")
const RED_DARK := Color("#7a0f12")
const GOLD := Color("#f2c14e")
const PAPER := Color("#f3efe6")
const MUTED := Color("#9aa0ab")

static var _display: Font
static var _text: Font
static var _text_bold: Font

static func display_font() -> Font:
	if _display == null:
		_display = load("res://assets/fonts/RussoOne-Regular.ttf")
	return _display

static func text_font(bold := false) -> Font:
	if bold:
		if _text_bold == null:
			_text_bold = load("res://assets/fonts/PT_Sans-Narrow-Web-Bold.ttf")
		return _text_bold
	if _text == null:
		_text = load("res://assets/fonts/PT_Sans-Narrow-Web-Regular.ttf")
	return _text

static func label(text: String, size: int, color := PAPER, display := false, bold := false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", display_font() if display else text_font(bold))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if display:
		l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
		l.add_theme_constant_override("shadow_offset_x", 2)
		l.add_theme_constant_override("shadow_offset_y", 2)
	return l

static func box(bg: Color, border := Color(0, 0, 0, 0), radius := 0, pad := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(1 if border.a > 0 else 0)
	s.set_corner_radius_all(radius)
	s.content_margin_left = pad * 1.6
	s.content_margin_right = pad * 1.6
	s.content_margin_top = pad * 0.6
	s.content_margin_bottom = pad * 0.6
	return s

## Horizontal bar: returns {wrap, fill, w}.
static func bar(w: float, h: float, fill: Color, back: Color) -> Dictionary:
	var wrap := ColorRect.new()
	wrap.color = back
	wrap.custom_minimum_size = Vector2(w, h)
	wrap.size = Vector2(w, h)
	wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var f := ColorRect.new()
	f.color = fill
	f.position = Vector2.ZERO
	f.size = Vector2(w, h)
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wrap.add_child(f)
	return {"wrap": wrap, "fill": f, "w": w, "h": h}

static func set_bar(b: Dictionary, k: float) -> void:
	b.fill.size.x = b.w * clampf(k, 0, 1)

static func portrait(tex: Texture2D, size: int, border: Color) -> Control:
	var frame := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = Color("#111111")
	s.border_color = border
	s.set_border_width_all(2)
	frame.add_theme_stylebox_override("panel", s)
	frame.custom_minimum_size = Vector2(size, size)
	var tr := TextureRect.new()
	tr.texture = tex
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	tr.custom_minimum_size = Vector2(size - 4, size - 4)
	frame.add_child(tr)
	return frame

static func button(text: String, size := 26, note := "") -> Button:
	var b := Button.new()
	b.text = text + ("   " + note if note != "" else "")
	b.add_theme_font_override("font", display_font())
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", PAPER)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_focus_color", Color.WHITE)
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0, 0, 0, 0)
	normal.content_margin_left = 18
	normal.content_margin_right = 18
	normal.content_margin_top = 8
	normal.content_margin_bottom = 8
	var hover := normal.duplicate()
	hover.bg_color = Color(RED.r, RED.g, RED.b, 0.85)
	hover.border_width_left = 4
	hover.border_color = Color.WHITE
	hover.content_margin_left = 28
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("focus", hover)
	b.add_theme_stylebox_override("pressed", hover)
	return b

static func overlay(title: String) -> Dictionary:
	var o := Control.new()
	o.set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.024, 0.04, 0.82)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	o.add_child(bg)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_CENTER)
	col.grow_horizontal = Control.GROW_DIRECTION_BOTH
	col.grow_vertical = Control.GROW_DIRECTION_BOTH
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 6)
	var h := label(title, 54, RED, true)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(h)
	o.add_child(col)
	return {"root": o, "col": col}
