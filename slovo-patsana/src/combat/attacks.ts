export interface HitDef {
  t: number; // seconds into the attack
  dmg: number;
  range: number;
  arc: number; // half-angle in radians
  kb: number; // knockback speed
  knockdown?: boolean;
  unblockable?: boolean;
  /** Stays active until this time (for lunges). */
  until?: number;
}

export interface AttackDef {
  id: string;
  clip: string;
  dur: number;
  hits: HitDef[];
  /** Forward movement during the attack: [from, to, speed]. */
  move?: [number, number, number];
  stamina: number;
  /** After this time the next combo input is accepted. */
  chainAt: number;
  kind: 'punch' | 'kick' | 'special';
}

const A = (a: AttackDef) => a;

export const ATTACKS: Record<string, AttackDef> = {
  jab: A({ id: 'jab', clip: 'jab', dur: 0.32, hits: [{ t: 0.1, dmg: 6, range: 1.3, arc: 0.9, kb: 1.2 }], move: [0, 0.12, 2], stamina: 6, chainAt: 0.14, kind: 'punch' }),
  cross: A({ id: 'cross', clip: 'cross', dur: 0.4, hits: [{ t: 0.13, dmg: 9, range: 1.35, arc: 0.9, kb: 2 }], move: [0, 0.14, 2.5], stamina: 8, chainAt: 0.18, kind: 'punch' }),
  hook: A({ id: 'hook', clip: 'hook', dur: 0.5, hits: [{ t: 0.21, dmg: 13, range: 1.25, arc: 1.2, kb: 4.5, knockdown: true }], move: [0.05, 0.22, 2.5], stamina: 12, chainAt: 0.3, kind: 'punch' }),
  kick: A({ id: 'kick', clip: 'kick', dur: 0.6, hits: [{ t: 0.25, dmg: 13, range: 1.7, arc: 0.7, kb: 5 }], stamina: 14, chainAt: 0.4, kind: 'kick' }),
  flurry: A({
    id: 'flurry', clip: 'flurry', dur: 1.05,
    hits: [
      { t: 0.11, dmg: 5, range: 1.35, arc: 0.9, kb: 0.8 },
      { t: 0.27, dmg: 5, range: 1.35, arc: 0.9, kb: 0.8 },
      { t: 0.43, dmg: 5, range: 1.35, arc: 0.9, kb: 0.8 },
      { t: 0.59, dmg: 5, range: 1.35, arc: 0.9, kb: 0.8 },
      { t: 0.84, dmg: 16, range: 1.45, arc: 1.0, kb: 7, knockdown: true },
    ],
    move: [0, 0.85, 1.6], stamina: 40, chainAt: 1, kind: 'special',
  }),
  lunge: A({
    id: 'lunge', clip: 'lunge', dur: 0.7,
    hits: [{ t: 0.2, until: 0.5, dmg: 17, range: 1.3, arc: 1.1, kb: 7, knockdown: true }],
    move: [0.12, 0.48, 11], stamina: 35, chainAt: 0.65, kind: 'special',
  }),
  haymaker: A({
    id: 'haymaker', clip: 'haymaker', dur: 0.95,
    hits: [{ t: 0.52, dmg: 30, range: 1.5, arc: 1.2, kb: 8, knockdown: true, unblockable: true }],
    move: [0.4, 0.55, 3], stamina: 35, chainAt: 0.9, kind: 'special',
  }),
};

export const PUNCH_CHAIN = ['jab', 'cross', 'hook'];
