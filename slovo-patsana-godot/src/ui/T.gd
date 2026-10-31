class_name T
## UI strings in Russian and in English, told in a gentleman's register. T.t("key")
## picks the current language; a missing English line falls back to Russian.

static func t(key: String) -> String:
	if Game.lang == "en" and EN.has(key):
		return EN[key]
	return RU.get(key, key)

static func list(key: String) -> Array:
	if Game.lang == "en" and EN_LISTS.has(key):
		return EN_LISTS[key]
	return RU_LISTS[key]

static func bark(key: String) -> String:
	return Looks.pick(list("bark." + key))

## A character's name, nick, gang, bio or passive in the current language.
static func name(ch: Dictionary, field: String) -> String:
	if field == "name" and ch.get("custom", false):
		return ch.name
	if Game.lang == "en" and EN_CHARS.has(ch.id) and EN_CHARS[ch.id].has(field):
		return EN_CHARS[ch.id][field]
	return ch[field]

static func call_name(ch: Dictionary) -> String:
	return name(ch, "name") if ch.get("custom", false) else name(ch, "nick")

static func full_title(ch: Dictionary) -> String:
	if ch.get("custom", false) or name(ch, "name") == name(ch, "nick"):
		return name(ch, "name")
	return "%s «%s»" % [name(ch, "name"), name(ch, "nick")]

static func quote(ch: Dictionary, i: int) -> String:
	if Game.lang == "en" and EN_CHARS.has(ch.id):
		return EN_CHARS[ch.id].quotes[i % 3]
	return ch.quotes[i % 3]

static func special_name(id: String) -> String:
	if Game.lang == "en":
		return EN_SPECIALS[id][0]
	return Characters.SPECIALS[id].name

static func special_desc(id: String) -> String:
	if Game.lang == "en":
		return EN_SPECIALS[id][1]
	return Characters.SPECIALS[id].desc

static func zone(z: String) -> String:
	return t("zone." + z)

static func landmark(n: String) -> String:
	return t("landmark." + n)

const RU := {
	"title": "СЛОВО\nПАЦАНА", "subtitle": "УЛИЦЫ КАЗАНИ · 1989",
	"press_start": "НАЖМИ ЛЮБУЮ КЛАВИШУ", "press_start_touch": "КОСНИСЬ ЭКРАНА",
	"menu.free": "Свободная игра", "menu.free_note": "район, драки, авторитет",
	"menu.cpu": "Стенка на стенку: против компьютера", "menu.cpu_note": "1 на 1, каток",
	"menu.versus": "Стенка на стенку: два игрока", "menu.versus_note": "одна клавиатура или геймпады",
	"menu.story": "Сюжет", "menu.story_note": "миссии · пройдено %d/3", "menu.story_done": "пройден · 3/3 миссии",
	"menu.lang": "Язык", "menu.controls": "Управление", "menu.credits": "Авторы", "menu.credits_note": "модели, лицензии",
	"menu.foot": "Фанатская игра по мотивам сериала «Слово пацана». Все персонажи — стилизация.",
	"menu.back_hint": "Нажми Esc или кликни, чтобы вернуться", "menu.main": "Главное меню",
	"credits.intro": "Фанатская некоммерческая игра. Все персонажи — стилизация.",
	"credits.models": "3D-модели (Sketchfab, CC BY 4.0):", "credits.free": "Свободные ресурсы:",
	"loading": "ЗАГРУЗКА РАЙОНА…", "portraits": "ПОРТРЕТЫ…",
	"zone.universam": "Универсам", "zone.razezd": "Разъезд", "zone.hadi": "Хади Такташ",
	"select.title": "ВЫБЕРИ ПАЦАНА", "select.title2": "ВЫБЕРИТЕ ПАЦАНОВ", "select.bonus": "БОНУС",
	"select.bonus_name": "Бонус", "select.bonus_sub": "бонусный персонаж · настрой под себя", "select.special": "Приём",
	"select.derived": "Здоровье %d · сила ×%.2f · скорость ×%.2f", "select.back": "НАЗАД", "select.go": "ВЫБРАТЬ", "select.go_banner": "ПОГНАЛИ!",
	"select.hint": "A/D — выбор · Enter/J — подтвердить · бонус: W/S строка, Q/E −/+ или мышь · Esc назад",
	"select.hint2": "Игрок 1: A/D + J · Игрок 2: ←/→ + Enter · бонус: W/S Q/E или мышь · Esc назад",
	"stat.power": "Сила", "stat.speed": "Скорость", "stat.health": "Здоровье", "stat.technique": "Техника",
	"hud.rep": "Авторитет: %d", "hud.zone": "Район: %s", "hud.block": "блок", "hud.kmh": "%d км/ч",
	"hud.help": "WASD ходить · Shift бег · ЛКМ/J рука · ПКМ/K нога\nQ блок · E приём · Пробел уклон · F машина · Esc пауза",
	"roam.home": "Район Универсама. Держи слово.", "roam.own_turf": "Своя территория", "roam.foreign": "Чужой район. Смотри в оба.",
	"roam.seen_off": "ОТШИЛИ!", "roam.seen_off_sub": "%s: компания разогнана · +10 авторитета",
	"roam.civil_hit": "Пацаны так не делают. −5 авторитета", "roam.wasted": "ТЕБЯ ОТШИЛИ", "roam.wasted_sub": "Пацаны подберут. Потеряно немного денег.",
	"roam.busted": "ЗАДЕРЖАН", "roam.busted_sub": "Ночь в отделении. Милиция забрала половину денег.",
	"roam.tip": "Кликни мышью, чтобы управлять камерой · H — управление",
	"roam.tip_touch": "Левый палец — ходить (до упора — бег) · правый — камера · кнопки справа — драка",
	"pause": "ПАУЗА", "pause.resume": "Продолжить", "pause.controls": "Управление", "pause.gfx": "Графика: %s",
	"gfx.high": "высокая", "gfx.medium": "средняя", "gfx.low": "низкая",
	"car.enter": "[F] — сесть в машину", "car.jack": "[F] — выкинуть водителя и угнать", "car.exit": "[F] — выйти",
	"car.ram_police": "Ты протаранил милицию!", "car.steal_police": "Угон милицейской машины!", "car.steal": "Угон машины",
	"car.hit_person": "Сбил человека!", "car.hit_police": "Сбил милиционера!", "police.ko": "Ты вырубил милиционера!",
	"police.losing": "Милиция теряет след…", "police.lost": "Ушёл от милиции",
	"vs.round": "РАУНД %d", "vs.fight": "БЕЙ!", "vs.ko": "НОКАУТ", "vs.time": "ВРЕМЯ", "vs.wins": "%s ПОБЕЖДАЕТ",
	"vs.again": "Enter — ещё раз · Esc — меню", "vs.draw": "НИЧЬЯ",
	"story.title": "СЮЖЕТ", "story.next": "Миссия %d: «%s» — иди к жёлтому маркеру", "story.start_prompt": "Миссия %d: [%s] — встань в круг",
	"story.done": "МИССИЯ ПРОЙДЕНА", "story.done_sub": "«%s» · +%d ₽ · +%d авторитета", "story.all_done": "СЮЖЕТ ПРОЙДЕН",
	"story.all_done_sub": "Район держит слово. Продолжение следует…", "story.failed": "МИССИЯ ПРОВАЛЕНА", "story.wasted": "Тебя отшили. Попробуй ещё раз.",
	"story.late": "Не успел.", "story.enter": "Enter — дальше",
	"touch.punch": "РУКА", "touch.kick": "НОГА", "touch.block": "БЛОК", "touch.special": "ПРИЁМ", "touch.dodge": "УКЛОН", "touch.car": "МАШИНА",
	"vs.help_cpu": "A/D вперёд-назад · W/S в сторону · J рука · K нога · Q блок · E приём · Пробел уклон",
	"vs.help_2p": "Игрок 1: WASD · J K Q E Пробел  |  Игрок 2: стрелки · , . / ; ' (или NumPad 1–4, 0)",
	"vs.who_cpu": "КОМПЬЮТЕР", "vs.who_you": "ТЫ", "vs.who_player": "ИГРОК %d",
	"controls.kb": "Ходить — W A S D · Бег — Shift\nКамера — мышь (кликни по экрану) · Z / C\nУдар рукой (серия) — ЛКМ или J, жми несколько раз\nУдар ногой — ПКМ или K · Блок — Q или L (держать)\nСпецприём — E или U (нужна жёлтая полоса) · Уклон — Пробел\nСесть / выйти из машины — F (у двери водителя)\nЗа рулём — W/S газ и тормоз · A/D руль · Пробел ручник\nПауза — Esc · Геймпад: стик — ходить, X — рука, Y — нога, B — приём, A — уклон, LB — блок",
	"controls.touch": "Ходить — левый палец, джойстик появляется там, где коснёшься\nБег — джойстик до упора\nКамера — веди правым пальцем по экрану\nУдар рукой (серия) — РУКА, жми несколько раз\nУдар ногой — НОГА · Блок — БЛОК (держать)\nСпецприём — ПРИЁМ (нужна жёлтая полоса) · Уклон — УКЛОН\nМашина — МАШИНА у двери водителя; за рулём джойстик — газ и руль, УКЛОН — ручник\nПауза — II вверху",
	"landmark.Универсам": "Универсам", "landmark.Каток": "Каток", "landmark.Видеосалон": "Видеосалон", "landmark.Школа": "Школа",
	"landmark.Рынок": "Рынок", "landmark.Гаражи": "Гаражи", "landmark.Качалка": "Качалка",
}

const EN := {
	"title": "A GENTLEMAN'S\nWORD", "subtitle": "THE STREETS OF KAZAN · 1989",
	"press_start": "PRESS ANY KEY", "press_start_touch": "TOUCH THE SCREEN",
	"menu.free": "Free roam", "menu.free_note": "the district, fisticuffs, reputation",
	"menu.cpu": "Fisticuffs: against the machine", "menu.cpu_note": "one on one, at the rink",
	"menu.versus": "Fisticuffs: two players", "menu.versus_note": "one keyboard or two gamepads",
	"menu.story": "The Story", "menu.story_note": "missions · %d of 3 done", "menu.story_done": "completed · all 3 missions",
	"menu.lang": "Language", "menu.controls": "Controls", "menu.credits": "Credits", "menu.credits_note": "models, licences",
	"menu.foot": "A fan game after the series «Слово пацана», told in a gentleman's register. All characters are stylised.",
	"menu.back_hint": "Press Esc or click to go back", "menu.main": "Main menu",
	"credits.intro": "A non-commercial fan game. All characters are stylised.",
	"credits.models": "3D models (Sketchfab, CC BY 4.0):", "credits.free": "Free resources:",
	"loading": "PREPARING THE DISTRICT…", "portraits": "PORTRAITS…",
	"zone.universam": "The Emporium", "zone.razezd": "The Junction", "zone.hadi": "Hadley Street",
	"select.title": "CHOOSE YOUR GENTLEMAN", "select.title2": "CHOOSE YOUR GENTLEMEN", "select.bonus": "BONUS",
	"select.bonus_name": "Bonus", "select.bonus_sub": "bonus character · tailor to taste", "select.special": "Move",
	"select.derived": "Health %d · power ×%.2f · speed ×%.2f", "select.back": "BACK", "select.go": "CHOOSE", "select.go_banner": "TALLY-HO!",
	"select.hint": "A/D — choose · Enter/J — confirm · bonus: W/S row, Q/E −/+ or the mouse · Esc back",
	"select.hint2": "Player 1: A/D + J · Player 2: ←/→ + Enter · bonus: W/S Q/E or the mouse · Esc back",
	"stat.power": "Power", "stat.speed": "Speed", "stat.health": "Health", "stat.technique": "Technique",
	"hud.rep": "Reputation: %d", "hud.zone": "District: %s", "hud.block": "parried", "hud.kmh": "%d km/h",
	"hud.help": "WASD walk · Shift run · LMB/J fist · RMB/K boot\nQ guard · E move · Space dodge · F motor car · Esc pause",
	"roam.home": "The Emporium's district. Keep your word.", "roam.own_turf": "Home ground", "roam.foreign": "Foreign district. Mind yourself.",
	"roam.seen_off": "SEEN OFF!", "roam.seen_off_sub": "%s: their company dispersed · +10 reputation",
	"roam.civil_hit": "Not the done thing, old boy. −5 reputation", "roam.wasted": "YOU WERE SEEN OFF", "roam.wasted_sub": "The chaps will collect you. A little money lost.",
	"roam.busted": "DETAINED", "roam.busted_sub": "A night at the station. The constabulary kept half your money.",
	"roam.tip": "Click to take the camera · H — controls",
	"roam.tip_touch": "Left thumb — walk (push to the rim to run) · right — camera · buttons on the right — fisticuffs",
	"pause": "PAUSED", "pause.resume": "Carry on", "pause.controls": "Controls", "pause.gfx": "Graphics: %s",
	"gfx.high": "high", "gfx.medium": "medium", "gfx.low": "low",
	"car.enter": "[F] — take the motor car", "car.jack": "[F] — evict the driver and take the car", "car.exit": "[F] — step out",
	"car.ram_police": "You rammed the constabulary!", "car.steal_police": "Theft of a police motor!", "car.steal": "Motor car theft",
	"car.hit_person": "You ran a person down!", "car.hit_police": "You ran down a constable!", "police.ko": "You floored a constable!",
	"police.losing": "The constabulary loses the scent…", "police.lost": "Clean away from the constabulary",
	"vs.round": "ROUND %d", "vs.fight": "HAVE AT IT!", "vs.ko": "KNOCKOUT", "vs.time": "TIME", "vs.wins": "%s PREVAILS",
	"vs.again": "Enter — once more · Esc — menu", "vs.draw": "A DRAW",
	"story.title": "THE STORY", "story.next": "Mission %d: «%s» — walk to the yellow marker", "story.start_prompt": "Mission %d: [%s] — step into the circle",
	"story.done": "MISSION ACCOMPLISHED", "story.done_sub": "«%s» · +%d ₽ · +%d reputation", "story.all_done": "THE STORY IS TOLD",
	"story.all_done_sub": "The district keeps its word. To be continued…", "story.failed": "MISSION FAILED", "story.wasted": "You were seen off. Do try again.",
	"story.late": "Too late, old boy.", "story.enter": "Enter — onward",
	"touch.punch": "FIST", "touch.kick": "BOOT", "touch.block": "GUARD", "touch.special": "MOVE", "touch.dodge": "DODGE", "touch.car": "MOTOR",
	"vs.help_cpu": "A/D forward and back · W/S sideways · J fist · K boot · Q guard · E move · Space dodge",
	"vs.help_2p": "Player 1: WASD · J K Q E Space  |  Player 2: arrows · , . / ; ' (or NumPad 1–4, 0)",
	"vs.who_cpu": "THE MACHINE", "vs.who_you": "YOU", "vs.who_player": "PLAYER %d",
	"controls.kb": "Walk — W A S D · Run — Shift\nCamera — mouse (click the screen) · Z / C\nFist (combination) — LMB or J, press repeatedly\nBoot — RMB or K · Guard — Q or L (hold)\nSpecial move — E or U (needs the yellow bar) · Dodge — Space\nGet in / out of a motor car — F (at the driver's door)\nDriving — W/S throttle and brake · A/D steer · Space handbrake\nPause — Esc · Gamepad: stick — walk, X — fist, Y — boot, B — move, A — dodge, LB — guard",
	"controls.touch": "Walk — left thumb; the stick appears where you touch\nRun — push the stick to the rim\nCamera — drag with the right thumb\nFist (combination) — FIST, tap repeatedly\nBoot — BOOT · Guard — GUARD (hold)\nSpecial move — MOVE (needs the yellow bar) · Dodge — DODGE\nMotor car — MOTOR at the driver's door; while driving the stick steers and accelerates, DODGE is the handbrake\nPause — II at the top",
	"landmark.Универсам": "Emporium", "landmark.Каток": "Rink", "landmark.Видеосалон": "Video Salon", "landmark.Школа": "School",
	"landmark.Рынок": "Market", "landmark.Гаражи": "Garages", "landmark.Качалка": "Gymnasium",
}

const RU_LISTS := {
	"police_names": ["Сержант", "Старшина", "Лейтенант", "Милиционер"],
	"gang_nicks": ["Хмурый", "Лысый", "Кирпич", "Сиплый", "Борзый", "Шнырь", "Валет", "Гвоздь", "Колесо", "Малой", "Шило", "Сутулый", "Рыжий", "Батон", "Чёрный", "Длинный"],
	"ally_nicks": ["Турбо", "Зима", "Марат", "Ералаш", "Сутулый", "Желтый", "Лампа"],
	"civil_m": ["Прохожий", "Мужик", "Дед", "Работяга", "Студент"],
	"civil_f": ["Прохожая", "Женщина", "Бабушка", "Студентка"],
	"bark.gangAggro": ["Э, ты чё, с какого района?", "Стоять! Ты чей будешь?", "Пацаны, тут универсамовский!", "Сюда иди, чушпан!", "Ты чё на нашей земле забыл?"],
	"bark.gangHit": ["Ах ты…", "Наших бьют!", "Вали его!", "Отшиваем!"],
	"bark.allyJoin": ["Универсам, вперёд!", "Наших бьют!", "Пацаны, впрягаемся!", "Я с тобой!"],
	"bark.pedFlee": ["Помогите!", "Милиция!", "Хулиганы!", "Ой, мамочки!", "Караул!"],
	"bark.pedAngry": ["Ты чё, совсем?", "Сейчас получишь!", "Ах ты шпана!"],
	"bark.police": ["Стоять! Милиция!", "Гражданин, пройдёмте!", "Руки за голову!", "Ни с места!"],
	"bark.ko": ["Лежать!", "Отдыхай.", "Ещё хочешь?", "Слово пацана."],
	"bark.carjack": ["Ты чё творишь?!", "Машину отдай!", "Милиция!"],
}

const EN_LISTS := {
	"police_names": ["Sergeant", "Sergeant-Major", "Lieutenant", "Constable"],
	"gang_nicks": ["Gloomy", "Baldy", "Brick", "Hoarse", "Brazen", "Weasel", "Jack", "Nail", "Wheel", "Junior", "Awl", "Stoop", "Ginger", "Loaf", "Blackie", "Lanky"],
	"ally_nicks": ["Turbo", "Winter", "Martin", "Jester", "Stoop", "Yellow", "Lamp"],
	"civil_m": ["Passer-by", "Fellow", "Grandad", "Workman", "Student"],
	"civil_f": ["Lady", "Woman", "Grandmother", "Young lady"],
	"bark.gangAggro": ["I say, which district are you from?", "Halt! Whose man are you?", "Chaps, an Emporium fellow!", "Over here, you civilian!", "What business have you on our ground?"],
	"bark.gangHit": ["Why, you…", "They're thrashing our lads!", "Have at him!", "See him off!"],
	"bark.allyJoin": ["Emporium, forward!", "Our lads are under attack!", "Chaps, into the fray!", "I'm with you!"],
	"bark.pedFlee": ["Help!", "Constable!", "Hooligans!", "Oh, heavens!", "Murder!"],
	"bark.pedAngry": ["Have you quite lost your mind?", "You'll get what for!", "You young ruffian!"],
	"bark.police": ["Halt! Constabulary!", "Come along quietly, sir!", "Hands behind your head!", "Don't move!"],
	"bark.ko": ["Stay down!", "Have a rest.", "Care for more?", "A gentleman's word."],
	"bark.carjack": ["What on earth are you doing?!", "Give back the motor!", "Constable!"],
}

const EN_SPECIALS := {
	"flurry": ["The Afghan Flourish", "A series of four blows and a finishing straight."],
	"lunge": ["The Lunge", "A dash forward with a blow that floors everyone in its path."],
	"haymaker": ["The Knuckle-Duster", "A slow blow with brass knuckles. Goes through any guard."],
	"sweep": ["The Low Sweep", "A slide into the legs that puts the opponent on the ground."],
	"turbokick": ["The Turbo Kick", "A powerful spinning kick. Knocks a man down."],
	"uppercut": ["The Uppercut", "A short blow from below to the jaw: strong and quick."],
}

const EN_CHARS := {
	"adidas": {"name": "Victor", "nick": "Tweed", "gang": "The Emporium",
		"bio": "Back from the Afghan campaign. The senior gentleman of the Emporium. Keeps his word, and expects the same of others.",
		"passive": "Hardened: takes less damage when guarding.",
		"quotes": ["A gentleman never apologises.", "And which district do you hail from, sir?", "A gentleman's word is no laughing matter."]},
	"palto": {"name": "Andrew", "nick": "Overcoat", "gang": "The Emporium",
		"bio": "Once a mere civilian, now one of the chaps. Slight of build but fierce: the worse things get, the harder he hits.",
		"passive": "Temper: damage grows as his health falls.",
		"quotes": ["I'm one of the chaps now.", "Sworn in, and therefore one of us.", "Kindly leave my friends alone."]},
	"kashchey": {"name": "Old Bones", "nick": "Old Bones", "gang": "The Emporium (former senior)",
		"bio": "Fresh out of His Majesty's pleasure. Lives by the code, fights outside of it.",
		"passive": "Low cunning: his kicks go through any guard.",
		"quotes": ["Well, lads, such is life.", "I've served my time.", "The senior man is always right."]},
	"marat": {"name": "Martin", "nick": "Tweed the Younger", "gang": "The Emporium (the young set)",
		"bio": "Victor's little brother. Small, cheeky and quick, into every scrape the elders can't reach.",
		"passive": "Nimble: dodging costs him almost no stamina.",
		"quotes": ["I'm a gentleman too!", "Brother stands by brother.", "What are you looking at?"]},
	"turbo": {"name": "Valentine", "nick": "Turbo", "gang": "The Emporium",
		"bio": "Victor's right-hand man. Hot-headed; swings first and reflects afterwards.",
		"passive": "Hot-headed: kicks hit 25% harder.",
		"quotes": ["Off we go!", "Who's on our ground?", "Do keep up."]},
	"zima": {"name": "Walter", "nick": "Winter", "gang": "The Emporium",
		"bio": "Calm and cunning. Says little, fights cold, and recovers remarkably fast.",
		"passive": "Cool head: recovers health between fights.",
		"quotes": ["Steady, chaps.", "Winter is near.", "No need to fuss."]},
	"bonus1": {"nick": "Bonus", "gang": "Bonus character",
		"bio": "A guest from the future in a Harrington jacket and dark glasses. You set his attributes.",
		"passive": "Own style: you choose the attributes and the move.",
		"quotes": ["Shall we begin?", "No further words.", "Mind the spectacles."]},
	"bonus2": {"nick": "Bonus", "gang": "Bonus character",
		"bio": "A friend in a grey hoodie and glasses. Thinks faster than he hits, and he hits too. You set his attributes.",
		"passive": "Own style: you choose the attributes and the move.",
		"quotes": ["Let us do the arithmetic.", "Theory first, then practice.", "Calm yourself, I know what I'm doing."]},
}
