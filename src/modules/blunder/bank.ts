// The pre-built, engine-checked Blunder Check exercises (src/data/blunder.json).

import type { Square } from 'chess.js';

export interface BankThreat {
  fen: string;
  /** Opponent's last move: from, to, SAN. */
  move: [Square, Square, string];
  answers: Square[];
  threats: [Square, Square, string][];
  text: string;
}

export interface BankSafe {
  fen: string;
  uci: string;
  san: string;
  verdict: 'safe' | 'blunder';
  /** Pawns x100 lost compared with the best move. */
  loss: number;
  best: string;
  /** The engine's answer to the candidate move. */
  reply: string;
  text: string[];
}

export interface BankHanging {
  fen: string;
  answers: Square[];
}

export interface BlunderBank {
  threats: BankThreat[];
  safe: BankSafe[];
  hanging: BankHanging[];
}

let bank: Promise<BlunderBank> | null = null;

export function loadBank(): Promise<BlunderBank> {
  bank ??= import('../../data/blunder.json').then((m) => m.default as unknown as BlunderBank);
  return bank;
}

/** Pick `n` random items, avoiding the ones seen most recently. */
export function pickFresh<T extends { fen: string }>(items: T[], n: number, recent: string[]): T[] {
  const recentSet = new Set(recent);
  const fresh = items.filter((i) => !recentSet.has(i.fen));
  const pool = fresh.length >= n ? fresh : items;
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < Math.min(n, pool.length)) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]);
  }
  return out;
}
