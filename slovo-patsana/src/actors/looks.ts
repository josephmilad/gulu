import { pick } from '../core/math';

export interface BodySpec {
  model: string;
  tint?: number;
  tintAmt?: number;
  scale: number;
}

/**
 * Crowd variety from the three realistic models: clothing is re-tinted per
 * gang so you can read who is who (Razyezd blue, Hadi Taktash brown/olive).
 */
const GANG: Record<'universam' | 'razezd' | 'hadi', { models: string[]; tints: number[] }> = {
  universam: { models: ['vova', 'kashchey', 'palto'], tints: [0x2a1414, 0x1a1a1a, 0x3a1a1a] },
  razezd: { models: ['vova', 'kashchey'], tints: [0x2f5fb8, 0x3a66a8, 0x2a4f9a] },
  hadi: { models: ['vova', 'kashchey'], tints: [0x8a6a30, 0x6a7a34, 0x9a6a38] },
};

export function gangSpec(team: 'universam' | 'razezd' | 'hadi', r = Math.random): BodySpec {
  const g = GANG[team];
  return { model: pick(r, g.models), tint: pick(r, g.tints), tintAmt: team === 'universam' ? 0.35 : 0.8, scale: 0.94 + r() * 0.1 };
}

export function civilSpec(r = Math.random): BodySpec {
  const tints = [0x4a3a30, 0x2d3a4a, 0x5a2a2a, 0x3a3a3a, 0x6a5a40, 0x2a4a3a, 0x7a6a5a, 0x5a3048];
  return { model: pick(r, ['palto', 'palto', 'kashchey']), tint: pick(r, tints), tintAmt: 0.85, scale: 0.92 + r() * 0.12 };
}

/** Militsiya in winter greatcoats and fur hats. */
export function policeSpec(r = Math.random): BodySpec {
  return { model: 'kashchey', tint: 0x55606c, tintAmt: 0.9, scale: 0.98 + r() * 0.06 };
}

export const POLICE_NAMES = ['Сержант', 'Старшина', 'Лейтенант', 'Милиционер'];

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
  police: ['Стоять! Милиция!', 'Гражданин, пройдёмте!', 'Руки за голову!', 'Ни с места!'],
  ko: ['Лежать!', 'Отдыхай.', 'Ещё хочешь?', 'Слово пацана.'],
};
