
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
];
