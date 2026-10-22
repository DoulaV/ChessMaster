// Lichess public services: opening explorer stats and analysis links.

import { read } from '../progress/store';
import { settingsSlot } from '../progress/slots';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
}

export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening: { eco: string; name: string } | null;
}

export type ExplorerError = 'no-token' | 'bad-token' | 'network';

/**
 * Lichess ratings run about 300 to 400 points above Chess.com at club level,
 * so a Chess.com 800 plays like a Lichess 1100 to 1200.
 */
export function lichessRatingBands(chesscomRating: number): number[] {
  const all = [400, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500];
  const target = chesscomRating + 350;
  const i = Math.max(0, all.findIndex((r) => r > target) - 1);
  // The player's own band and the one above it.
  return all.slice(i, i + 2);
}

const cache = new Map<string, ExplorerResult>();

export async function explorer(
  fen: string,
): Promise<{ ok: true; data: ExplorerResult } | { ok: false; error: ExplorerError }> {
  const s = read(settingsSlot);
  if (!s.lichessToken) return { ok: false, error: 'no-token' };
  const ratings = lichessRatingBands(s.rating).join(',');
  const url = `https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=${ratings}&fen=${encodeURIComponent(fen)}`;
  const hit = cache.get(url);
  if (hit) return { ok: true, data: hit };
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${s.lichessToken}` } });
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'bad-token' };
    if (!res.ok) return { ok: false, error: 'network' };
    const data = (await res.json()) as ExplorerResult;
    cache.set(url, data);
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export function lichessAnalysisUrl(fen: string, orientation: 'white' | 'black' = 'white'): string {
  return `https://lichess.org/analysis/standard/${fen.replace(/ /g, '_')}?color=${orientation}`;
}
