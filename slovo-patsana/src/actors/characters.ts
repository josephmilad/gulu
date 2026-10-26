
export interface CharacterDef {
  id: string;
  name: string;
  nick: string;
  gang: string;
  bio: string;
  /** GLB in public/assets/characters. */
  model: string;
  hp: number;
  power: number;
  speed: number;
  /** Special move id (an attack in combat.ts). */
  special: string;
  specialName: string;
  specialDesc: string;
  passive: string;
  stats: { power: number; speed: number; health: number; technique: number };
  quotes: string[];
  /** Bonus fighters: the player sets their stats, name and special. */
  custom?: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'adidas',
    name: 'Вова',
    nick: 'Адидас',
    gang: 'Универсам',
    bio: 'Вернулся из Афгана. Старший у «Универсама». Слово держит — и спрашивает с других.',
    model: 'vova',
    hp: 130, power: 1.15, speed: 1.0,
    special: 'flurry', specialName: 'Афганская серия', specialDesc: 'Серия из четырёх ударов и добивающий прямой.',
    passive: 'Закалка: меньше урона в блоке.',
    stats: { power: 9, speed: 6, health: 9, technique: 8 },
    quotes: ['Пацаны не извиняются.', 'Ты с какого района?', 'Слово пацана — это тебе не шутки.'],
  },
  {
    id: 'palto',
    name: 'Андрей',
    nick: 'Пальто',
    gang: 'Универсам',
    bio: 'Был чушпаном, стал пацаном. Худой, но злой — чем хуже ему, тем сильнее бьёт.',
    model: 'palto',
    hp: 100, power: 0.95, speed: 1.12,
    special: 'lunge', specialName: 'Рывок', specialDesc: 'Бросок вперёд с ударом — сбивает с ног всех на пути.',
    passive: 'Злость: урон растёт, когда мало здоровья.',
    stats: { power: 6, speed: 9, health: 6, technique: 7 },
    quotes: ['Я теперь пацан.', 'Пришился — значит, свой.', 'Не трогай моих.'],
  },
  {
    id: 'kashchey',
    name: 'Кащей',
    nick: 'Кащей',
    gang: 'Универсам (бывший старший)',
    bio: 'Вышел с зоны. Живёт по понятиям, но бьёт не по правилам.',
    model: 'kashchey',
    hp: 115, power: 1.05, speed: 0.95,
    special: 'haymaker', specialName: 'Кастет', specialDesc: 'Медленный удар кастетом. Пробивает любой блок и валит с ног.',
    passive: 'Подлость: удары ногой пробивают блок.',
    stats: { power: 8, speed: 5, health: 7, technique: 9 },
    quotes: ['Ну чё, пацаны, жизнь — она такая.', 'Я своё отсидел.', 'Кто старший — тот и прав.'],
  },
  {
    id: 'marat',
    name: 'Марат',
    nick: 'Адидас-младший',
    gang: 'Универсам (скорлупа)',
    bio: 'Младший брат Вовы. Мелкий, дерзкий и быстрый — лезет туда, куда старшие не успевают.',
    model: 'marat',
    hp: 90, power: 0.88, speed: 1.18,
    special: 'sweep', specialName: 'Подкат', specialDesc: 'Бросок в ноги — сбивает противника на землю.',
    passive: 'Шустрый: уклон почти не тратит силы.',
    stats: { power: 5, speed: 10, health: 5, technique: 7 },
    quotes: ['Я тоже пацан!', 'Брат за брата.', 'Чё смотришь?'],
  },
  {
    id: 'turbo',
    name: 'Валера',
    nick: 'Турбо',
    gang: 'Универсам',
    bio: 'Правая рука Адидаса. Горячий, на месте не сидит — сначала бьёт, потом думает.',
    model: 'turbo',
    hp: 115, power: 1.08, speed: 1.05,
    special: 'turbokick', specialName: 'Турбо-удар', specialDesc: 'Мощный удар ногой с разворота. Валит с ног.',
    passive: 'Горячий: удары ногой на 25% сильнее.',
    stats: { power: 8, speed: 7, health: 7, technique: 6 },
    quotes: ['Погнали!', 'Кто на нашей земле?', 'Не тормози.'],
  },
  {
    id: 'zima',
    name: 'Вахит',
    nick: 'Зима',
    gang: 'Универсам',
    bio: 'Спокойный и хитрый. Говорит мало, в драке холоден — и быстро приходит в себя.',
    model: 'zima',
    hp: 110, power: 1.0, speed: 1.0,
    special: 'uppercut', specialName: 'Апперкот', specialDesc: 'Короткий удар снизу в челюсть — сильный и быстрый.',
    passive: 'Хладнокровие: вне драки восстанавливает здоровье.',
    stats: { power: 7, speed: 6, health: 7, technique: 9 },
    quotes: ['Спокойно, пацаны.', 'Зима близко.', 'Не суетись.'],
  },
  {
    id: 'bonus1',
    name: 'Бородач',
    nick: 'Бонус',
    gang: 'Бонусный персонаж',
    bio: 'Гость из будущего в харрингтоне и тёмных очках. Характеристики настраиваешь ты.',
    model: 'bonus1',
    hp: 110, power: 1, speed: 1,
    special: 'flurry', specialName: '', specialDesc: '',
    passive: 'Свой стиль: характеристики и приём выбираешь сам.',
    stats: { power: 7, speed: 7, health: 7, technique: 7 },
    quotes: ['Ну что, начнём?', 'Без лишних слов.', 'Очки не трогай.'],
    custom: true,
  },
  {
    id: 'bonus2',
    name: 'Профессор',
    nick: 'Бонус',
    gang: 'Бонусный персонаж',
    bio: 'Друг в сером худи и очках. Думает быстрее, чем бьёт, — но бьёт тоже. Характеристики настраиваешь ты.',
    model: 'bonus2',
    hp: 110, power: 1, speed: 1,
    special: 'lunge', specialName: '', specialDesc: '',
    passive: 'Свой стиль: характеристики и приём выбираешь сам.',
    stats: { power: 7, speed: 7, health: 7, technique: 7 },
    quotes: ['Сейчас посчитаем.', 'Теория, а потом практика.', 'Спокойно, я знаю, что делаю.'],
    custom: true,
  },
];

/** Specials a bonus fighter can pick: attack id → name and description. */
export const SPECIALS: Record<string, { name: string; desc: string }> = {
  flurry: { name: 'Афганская серия', desc: 'Серия из четырёх ударов и добивающий прямой.' },
  lunge: { name: 'Рывок', desc: 'Бросок вперёд с ударом — сбивает с ног всех на пути.' },
  haymaker: { name: 'Кастет', desc: 'Медленный удар кастетом. Пробивает любой блок.' },
  sweep: { name: 'Подкат', desc: 'Бросок в ноги — сбивает противника на землю.' },
  turbokick: { name: 'Турбо-удар', desc: 'Мощный удар ногой с разворота. Валит с ног.' },
  uppercut: { name: 'Апперкот', desc: 'Короткий удар снизу в челюсть — сильный и быстрый.' },
};

const STORE = 'sp-bonus';

type BonusSave = Record<string, { name: string; stats: CharacterDef['stats']; special: string }>;

function readSave(): BonusSave {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') as BonusSave;
  } catch {
    return {};
  }
}

/** Derive fighter numbers from 1–10 stats (used for the bonus fighters). */
function applyStats(ch: CharacterDef) {
  const s = ch.stats;
  ch.hp = 40 + s.health * 10;
  ch.power = +(0.6 + s.power * 0.06).toFixed(2);
  ch.speed = +(0.76 + s.speed * 0.042).toFixed(3);
  const sp = SPECIALS[ch.special] ?? SPECIALS.flurry;
  ch.specialName = sp.name;
  ch.specialDesc = sp.desc;
}

/** Load the player's saved bonus-fighter setup. */
export function loadBonus() {
  const save = readSave();
  for (const ch of CHARACTERS) {
    if (!ch.custom) continue;
    const s = save[ch.id];
    if (s) {
      if (s.name) ch.name = s.name.slice(0, 18);
      for (const k of ['power', 'speed', 'health', 'technique'] as const)
        if (typeof s.stats?.[k] === 'number') ch.stats[k] = Math.max(1, Math.min(10, Math.round(s.stats[k])));
      if (SPECIALS[s.special]) ch.special = s.special;
    }
    applyStats(ch);
  }
}

export function saveBonus(ch: CharacterDef) {
  applyStats(ch);
  const save = readSave();
  save[ch.id] = { name: ch.name, stats: { ...ch.stats }, special: ch.special };
  try {
    localStorage.setItem(STORE, JSON.stringify(save));
  } catch {
    /* private mode: keep the setup for this session only */
  }
}

/** Stamina regeneration multiplier from the technique stat. */
export const regenOf = (ch: CharacterDef) => 0.7 + ch.stats.technique * 0.05;

/** Fighter constructor options for a playable character. */
export const fighterOpts = (ch: CharacterDef) => ({
  hp: ch.hp, power: ch.power, speed: ch.speed, special: ch.special, regen: regenOf(ch), charId: ch.id,
});

/** Characters whose models actually loaded. */
export let ROSTER: CharacterDef[] = CHARACTERS;
export function setRoster(has: (model: string) => boolean) {
  ROSTER = CHARACTERS.filter((c) => has(c.model));
}

export const charById = (id: string) => CHARACTERS.find((c) => c.id === id)!;

/** What other characters call this fighter. */
export const callName = (ch: CharacterDef) => (ch.custom ? ch.name : ch.nick);
/** «Name "Nick"» heading. */
export const fullTitle = (ch: CharacterDef) => (ch.custom || ch.name === ch.nick ? ch.name : `${ch.name} «${ch.nick}»`);
