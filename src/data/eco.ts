// Names any position from Lichess's open list of openings (loaded on demand).

import { Chess } from 'chess.js';
import { epd } from '../chess/utils';

export interface OpeningName {
  eco: string;
  name: string;
  pgn: string;
}

type EcoData = Record<string, [string, string, string]>;
let data: Promise<EcoData> | null = null;

export function loadEco(): Promise<EcoData> {
  data ??= import('./eco.json').then((m) => m.default as unknown as EcoData);
  return data;
}

/** Name of exactly this position, if it has one. */
export async function nameOfPosition(fen: string): Promise<OpeningName | null> {
  const d = await loadEco();
  const hit = d[epd(fen)];
  return hit ? { eco: hit[0], name: hit[1], pgn: hit[2] } : null;
}

/**
 * Name of the opening for a game: the last named position along the moves,
 * so it keeps its name after leaving known theory.
 */
export async function nameOfLine(fens: string[]): Promise<OpeningName | null> {
  const d = await loadEco();
  for (let i = fens.length - 1; i >= 0; i--) {
    const hit = d[epd(fens[i])];
    if (hit) return { eco: hit[0], name: hit[1], pgn: hit[2] };
  }
  return null;
}

/** Positions along a SAN move list, starting from the initial position. */
export function fensOf(sans: string[]): string[] {
  const c = new Chess();
  const out = [c.fen()];
  for (const s of sans) {
    c.move(s);
    out.push(c.fen());
  }
  return out;
}

/** SAN moves of the shortest move order for an official opening name. */
export async function pgnForName(name: string): Promise<string[] | null> {
  const d = await loadEco();
  let best: string | null = null;
  for (const [, n, pgn] of Object.values(d)) {
    if (n === name && (!best || pgn.length < best.length)) best = pgn;
  }
  return best ? pgnToSans(best) : null;
}

export function pgnToSans(pgn: string): string[] {
  return pgn
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, ''));
}
