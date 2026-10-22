// Saved results of the Blunder Check Trainer.

import type { Slot } from './store';

export interface Tally {
  right: number;
  total: number;
}

export interface BlunderStats {
  spot: Tally;
  safe: Tally;
  hanging: { rounds: number; bestMs: number | null; lastMs: number | null };
  /** Recently seen positions, so they don't repeat too soon. */
  recent: { spot: string[]; safe: string[]; hanging: string[] };
  /** Exercises done per local day, for the streak and dashboard. */
  days: Record<string, { spot: number; safe: number; hanging: number }>;
}

export const blunderSlot: Slot<BlunderStats> = {
  key: 'blunder',
  version: 1,
  initial: () => ({
    spot: { right: 0, total: 0 },
    safe: { right: 0, total: 0 },
    hanging: { rounds: 0, bestMs: null, lastMs: null },
    recent: { spot: [], safe: [], hanging: [] },
    days: {},
  }),
};

export const pct = (t: Tally) => (t.total ? Math.round((t.right / t.total) * 100) : null);
