class_name Looks
## Crowd variety, names and barks (port of actors/looks.ts).

const GANG := {
	"universam": {"models": ["vova", "kashchey", "palto"], "tints": [Color("#2a1414"), Color("#1a1a1a"), Color("#3a1a1a")]},
	"razezd": {"models": ["vova", "kashchey"], "tints": [Color("#2f5fb8"), Color("#3a66a8"), Color("#2a4f9a")]},
	"hadi": {"models": ["vova", "kashchey"], "tints": [Color("#8a6a30"), Color("#6a7a34"), Color("#9a6a38")]},
}
const NPC_MODELS := ["eric", "carla", "claudia", "nathan", "sophia", "oldcoat", "oldcoat"]
const FEMALE := ["carla", "claudia", "sophia"]

const POLICE_NAMES := ["Сержант", "Старшина", "Лейтенант", "Милиционер"]
const GANG_NICKS := ["Хмурый", "Лысый", "Кирпич", "Сиплый", "Борзый", "Шнырь", "Валет", "Гвоздь", "Колесо", "Малой", "Шило", "Сутулый", "Рыжий", "Батон", "Чёрный", "Длинный"]
const ALLY_NICKS := ["Турбо", "Зима", "Марат", "Ералаш", "Сутулый", "Желтый", "Лампа"]
const CIVIL_NAMES_M := ["Прохожий", "Мужик", "Дед", "Работяга", "Студент"]
const CIVIL_NAMES_F := ["Прохожая", "Женщина", "Бабушка", "Студентка"]

const BARKS := {
	"gangAggro": ["Э, ты чё, с какого района?", "Стоять! Ты чей будешь?", "Пацаны, тут универсамовский!", "Сюда иди, чушпан!", "Ты чё на нашей земле забыл?"],
	"gangHit": ["Ах ты…", "Наших бьют!", "Вали его!", "Отшиваем!"],
	"allyJoin": ["Универсам, вперёд!", "Наших бьют!", "Пацаны, впрягаемся!", "Я с тобой!"],
	"pedFlee": ["Помогите!", "Милиция!", "Хулиганы!", "Ой, мамочки!", "Караул!"],
	"pedAngry": ["Ты чё, совсем?", "Сейчас получишь!", "Ах ты шпана!"],
	"police": ["Стоять! Милиция!", "Гражданин, пройдёмте!", "Руки за голову!", "Ни с места!"],
	"ko": ["Лежать!", "Отдыхай.", "Ещё хочешь?", "Слово пацана."],
}

static func pick(list: Array):
	return list[randi() % list.size()]

## {path, tint, tint_amt, scale, female}
static func gang_spec(team: String) -> Dictionary:
	var g: Dictionary = GANG[team]
	return {"path": "res://assets/characters/%s.glb" % pick(g.models), "tint": pick(g.tints),
		"tint_amt": 0.35 if team == "universam" else 0.8, "scale": 0.94 + randf() * 0.1, "female": false}

static func civil_spec() -> Dictionary:
	var m: String = pick(NPC_MODELS)
	return {"path": "res://assets/characters/npc/%s.glb" % m, "female": m in FEMALE, "scale": 0.96 + randf() * 0.06}

## Militsiya in winter greatcoats and fur hats.
static func police_spec() -> Dictionary:
	return {"path": "res://assets/characters/kashchey.glb", "tint": Color("#55606c"), "tint_amt": 0.9, "scale": 0.98 + randf() * 0.06, "female": false}
