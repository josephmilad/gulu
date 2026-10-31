class_name Characters
## The playable roster (port of actors/characters.ts) and the bonus-fighter save.

const SPECIALS := {
	"flurry": {"name": "Афганская серия", "desc": "Серия из четырёх ударов и добивающий прямой."},
	"lunge": {"name": "Рывок", "desc": "Бросок вперёд с ударом — сбивает с ног всех на пути."},
	"haymaker": {"name": "Кастет", "desc": "Медленный удар кастетом. Пробивает любой блок."},
	"sweep": {"name": "Подкат", "desc": "Бросок в ноги — сбивает противника на землю."},
	"turbokick": {"name": "Турбо-удар", "desc": "Мощный удар ногой с разворота. Валит с ног."},
	"uppercut": {"name": "Апперкот", "desc": "Короткий удар снизу в челюсть — сильный и быстрый."},
}

static var ALL: Array = [
	{"id": "adidas", "name": "Вова", "nick": "Адидас", "gang": "Универсам",
	 "bio": "Вернулся из Афгана. Старший у «Универсама». Слово держит — и спрашивает с других.",
	 "model": "vova", "hp": 130, "power": 1.15, "speed": 1.0, "special": "flurry",
	 "special_name": "Афганская серия", "special_desc": "Серия из четырёх ударов и добивающий прямой.",
	 "passive": "Закалка: меньше урона в блоке.", "stats": {"power": 9, "speed": 6, "health": 9, "technique": 8},
	 "quotes": ["Пацаны не извиняются.", "Ты с какого района?", "Слово пацана — это тебе не шутки."]},
	{"id": "palto", "name": "Андрей", "nick": "Пальто", "gang": "Универсам",
	 "bio": "Был чушпаном, стал пацаном. Худой, но злой — чем хуже ему, тем сильнее бьёт.",
	 "model": "palto", "hp": 100, "power": 0.95, "speed": 1.12, "special": "lunge",
	 "special_name": "Рывок", "special_desc": "Бросок вперёд с ударом — сбивает с ног всех на пути.",
	 "passive": "Злость: урон растёт, когда мало здоровья.", "stats": {"power": 6, "speed": 9, "health": 6, "technique": 7},
	 "quotes": ["Я теперь пацан.", "Пришился — значит, свой.", "Не трогай моих."]},
	{"id": "kashchey", "name": "Кащей", "nick": "Кащей", "gang": "Универсам (бывший старший)",
	 "bio": "Вышел с зоны. Живёт по понятиям, но бьёт не по правилам.",
	 "model": "kashchey", "hp": 115, "power": 1.05, "speed": 0.95, "special": "haymaker",
	 "special_name": "Кастет", "special_desc": "Медленный удар кастетом. Пробивает любой блок и валит с ног.",
	 "passive": "Подлость: удары ногой пробивают блок.", "stats": {"power": 8, "speed": 5, "health": 7, "technique": 9},
	 "quotes": ["Ну чё, пацаны, жизнь — она такая.", "Я своё отсидел.", "Кто старший — тот и прав."]},
	{"id": "marat", "name": "Марат", "nick": "Адидас-младший", "gang": "Универсам (скорлупа)",
	 "bio": "Младший брат Вовы. Мелкий, дерзкий и быстрый — лезет туда, куда старшие не успевают.",
	 "model": "marat", "hp": 90, "power": 0.88, "speed": 1.18, "special": "sweep",
	 "special_name": "Подкат", "special_desc": "Бросок в ноги — сбивает противника на землю.",
	 "passive": "Шустрый: уклон почти не тратит силы.", "stats": {"power": 5, "speed": 10, "health": 5, "technique": 7},
	 "quotes": ["Я тоже пацан!", "Брат за брата.", "Чё смотришь?"]},
	{"id": "turbo", "name": "Валера", "nick": "Турбо", "gang": "Универсам",
	 "bio": "Правая рука Адидаса. Горячий, на месте не сидит — сначала бьёт, потом думает.",
	 "model": "turbo", "hp": 115, "power": 1.08, "speed": 1.05, "special": "turbokick",
	 "special_name": "Турбо-удар", "special_desc": "Мощный удар ногой с разворота. Валит с ног.",
	 "passive": "Горячий: удары ногой на 25% сильнее.", "stats": {"power": 8, "speed": 7, "health": 7, "technique": 6},
	 "quotes": ["Погнали!", "Кто на нашей земле?", "Не тормози."]},
	{"id": "zima", "name": "Вахит", "nick": "Зима", "gang": "Универсам",
	 "bio": "Спокойный и хитрый. Говорит мало, в драке холоден — и быстро приходит в себя.",
	 "model": "zima", "hp": 110, "power": 1.0, "speed": 1.0, "special": "uppercut",
	 "special_name": "Апперкот", "special_desc": "Короткий удар снизу в челюсть — сильный и быстрый.",
	 "passive": "Хладнокровие: вне драки восстанавливает здоровье.", "stats": {"power": 7, "speed": 6, "health": 7, "technique": 9},
	 "quotes": ["Спокойно, пацаны.", "Зима близко.", "Не суетись."]},
	{"id": "bonus1", "name": "Бородач", "nick": "Бонус", "gang": "Бонусный персонаж",
	 "bio": "Гость из будущего в харрингтоне и тёмных очках. Характеристики настраиваешь ты.",
	 "model": "bonus1", "hp": 110, "power": 1.0, "speed": 1.0, "special": "flurry", "special_name": "", "special_desc": "",
	 "passive": "Свой стиль: характеристики и приём выбираешь сам.", "stats": {"power": 7, "speed": 7, "health": 7, "technique": 7},
	 "quotes": ["Ну что, начнём?", "Без лишних слов.", "Очки не трогай."], "custom": true},
	{"id": "bonus2", "name": "Профессор", "nick": "Бонус", "gang": "Бонусный персонаж",
	 "bio": "Друг в сером худи и очках. Думает быстрее, чем бьёт, — но бьёт тоже. Характеристики настраиваешь ты.",
	 "model": "bonus2", "hp": 110, "power": 1.0, "speed": 1.0, "special": "lunge", "special_name": "", "special_desc": "",
	 "passive": "Свой стиль: характеристики и приём выбираешь сам.", "stats": {"power": 7, "speed": 7, "health": 7, "technique": 7},
	 "quotes": ["Сейчас посчитаем.", "Теория, а потом практика.", "Спокойно, я знаю, что делаю."], "custom": true},
]

const SAVE_PATH := "user://bonus.json"

static func by_id(id: String) -> Dictionary:
	for c in ALL:
		if c.id == id:
			return c
	return {}

static func model_path(ch: Dictionary) -> String:
	return "res://assets/characters/%s.glb" % ch.model

## Characters whose model file exists.
static func roster() -> Array:
	var out := []
	for c in ALL:
		if ResourceLoader.exists(model_path(c)):
			out.append(c)
	return out

static func call_name(ch: Dictionary) -> String:
	return ch.name if ch.get("custom", false) else ch.nick

static func full_title(ch: Dictionary) -> String:
	if ch.get("custom", false) or ch.name == ch.nick:
		return ch.name
	return "%s «%s»" % [ch.name, ch.nick]

## Derive fighter numbers from the 1–10 stats (bonus fighters).
static func apply_stats(ch: Dictionary) -> void:
	var s: Dictionary = ch.stats
	ch.hp = 40 + s.health * 10
	ch.power = snappedf(0.6 + s.power * 0.06, 0.01)
	ch.speed = snappedf(0.76 + s.speed * 0.042, 0.001)
	var sp: Dictionary = SPECIALS.get(ch.special, SPECIALS.flurry)
	ch.special_name = sp.name
	ch.special_desc = sp.desc

static func regen_of(ch: Dictionary) -> float:
	return 0.7 + ch.stats.technique * 0.05

static func load_bonus() -> void:
	var save := {}
	if FileAccess.file_exists(SAVE_PATH):
		var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
		var parsed = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			save = parsed
	for ch in ALL:
		if not ch.get("custom", false):
			continue
		var s = save.get(ch.id)
		if s is Dictionary:
			if s.has("name") and String(s.name) != "":
				ch.name = String(s.name).left(18)
			for k in ["power", "speed", "health", "technique"]:
				if s.has("stats") and s.stats.has(k):
					ch.stats[k] = clampi(roundi(float(s.stats[k])), 1, 10)
			if SPECIALS.has(s.get("special", "")):
				ch.special = s.special
		apply_stats(ch)

static func save_bonus(ch: Dictionary) -> void:
	apply_stats(ch)
	var save := {}
	if FileAccess.file_exists(SAVE_PATH):
		var parsed = JSON.parse_string(FileAccess.open(SAVE_PATH, FileAccess.READ).get_as_text())
		if parsed is Dictionary:
			save = parsed
	save[ch.id] = {"name": ch.name, "stats": ch.stats.duplicate(), "special": ch.special}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	f.store_string(JSON.stringify(save))
