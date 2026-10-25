import type { Look, HatStyle, JacketStyle } from './HumanModel';
import { pick } from '../core/math';
import type { Team } from './Fighter';

const SKINS = [0xe8c0a5, 0xdcae92, 0xd9a688, 0xc99474, 0xf0cdb5];
const HAIRS = [0x1d1612, 0x3a2a1c, 0x5a4330, 0x7a6048, 0x2a2420, 0x8a7a6a];
const DARK = [0x23262d, 0x2d2a26, 0x1d2430, 0x35302a, 0x3a3f46];

/** Gang colour cues so you can read who's who at a glance. */
const GANG: Record<Exclude<Team, 'civil'>, { hats: number[]; jackets: number[]; styles: JacketStyle[]; hat: HatStyle[] }> = {
  universam: { hats: [0x8a1f1f, 0x222222, 0x5a1a1a], jackets: [0x1c1c22, 0x2b2b30, 0x3a2a22], styles: ['jacket', 'tracksuit', 'leather'], hat: ['knit', 'cap', 'none'] },
  razezd: { hats: [0x1f4a8a, 0x2a6ac2, 0x1a2f5a], jackets: [0x24395e, 0x2a2f45, 0x1e3a6a], styles: ['puffer', 'jacket', 'sweater'], hat: ['knit', 'knit', 'cap'] },
  hadi: { hats: [0xc29a2a, 0x8a6a1a, 0x5a4a2a], jackets: [0x5a4126, 0x4a3a28, 0x6a5030], styles: ['leather', 'jacket', 'puffer'], hat: ['knit', 'cap', 'fur'] },
};

export function gangLook(team: Exclude<Team, 'civil'>, r = Math.random): Look {
  const g = GANG[team];
  const style = pick(r, g.styles);
  return {
    skin: pick(r, SKINS), hair: pick(r, HAIRS), hairStyle: pick(r, ['short', 'buzz', 'fringe'] as const),
    hat: pick(r, g.hat), hatColor: pick(r, g.hats),
    jacket: pick(r, g.jackets), jacketStyle: style, stripes: style === 'tracksuit' ? 0xeeeeee : undefined,
    pants: pick(r, DARK), pantsStripes: style === 'tracksuit' && r() < 0.6 ? 0xeeeeee : undefined, shoes: pick(r, [0x111111, 0x222222, 0xdddddd]),
    scarf: r() < 0.4 ? pick(r, g.hats) : undefined,
    stubble: r() < 0.3, scar: r() < 0.15,
    build: 0.95 + r() * 0.17, height: 0.94 + r() * 0.1,
  };
}

export function civilLook(r = Math.random): Look {
  const female = r() < 0.45;
  const old = r() < 0.3;
  const coat = pick(r, [0x4a3a30, 0x2d3a4a, 0x5a2a2a, 0x3a3a3a, 0x6a5a40, 0x2a4a3a, 0x7a6a5a, 0x8a3040]);
  return {
    skin: pick(r, SKINS), hair: old ? pick(r, [0x9a9a9a, 0xcfcfcf, 0x6a6a6a]) : pick(r, HAIRS),
    hairStyle: female ? 'long' : pick(r, ['short', 'bald', 'short'] as const),
    hat: female ? pick(r, ['fur', 'beret', 'knit', 'fur'] as const) : pick(r, ['ushanka', 'fur', 'cap', 'ushanka', 'none'] as const),
    hatColor: pick(r, [0x3a2a20, 0x5a4535, 0x2a2a2a, 0x7a6a5a, 0x8a2a3a]),
    jacket: coat, jacketStyle: pick(r, ['coat', 'coat', 'puffer', 'jacket'] as const), longCoat: female || r() < 0.5,
    pants: pick(r, DARK), shoes: pick(r, [0x111111, 0x2a1a10, 0x3a2a20]),
    scarf: r() < 0.5 ? pick(r, [0xc23a3a, 0xe0d0b0, 0x3a5aa0, 0x6a6a6a]) : undefined,
    mustache: !female && r() < 0.35, glasses: r() < 0.15, female,
    build: female ? 0.86 + r() * 0.08 : 0.95 + r() * 0.15, height: female ? 0.9 + r() * 0.06 : 0.95 + r() * 0.08,
  };
}

export const GANG_NICKS = ['Хмурый', 'Лысый', 'Кирпич', 'Сиплый', 'Борзый', 'Шнырь', 'Валет', 'Гвоздь', 'Колесо', 'Малой', 'Шило', 'Сутулый', 'Рыжий', 'Батон', 'Чёрный', 'Длинный'];
export const ALLY_NICKS = ['Турбо', 'Зима', 'Марат', 'Ералаш', 'Сутулый', 'Желтый', 'Лампа'];
export const CIVIL_NAMES_M = ['Прохожий', 'Мужик', 'Дед', 'Работяга', 'Студент'];
export const CIVIL_NAMES_F = ['Прохожая', 'Женщина', 'Бабушка', 'Студентка'];

export const BARKS = {
  gangAggro: ['Э, ты чё, с какого района?', 'Стоять! Ты чей будешь?', 'Пацаны, тут универсамовский!', 'Сюда иди, чушпан!', 'Ты чё на нашей земле забыл?'],
  gangHit: ['Ах ты…', 'Наших бьют!', 'Вали его!', 'Отшиваем!'],
  allyJoin: ['Универсам, вперёд!', 'Наших бьют!', 'Пацаны, впрягаемся!', 'Я с тобой!'],
  pedFlee: ['Помогите!', 'Милиция!', 'Хулиганы!', 'Ой, мамочки!', 'Караул!'],
  pedAngry: ['Ты чё, совсем?', 'Сейчас получишь!', 'Ах ты шпана!'],
  ko: ['Лежать!', 'Отдыхай.', 'Ещё хочешь?', 'Слово пацана.'],
};
