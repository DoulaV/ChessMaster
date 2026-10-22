// Lets any screen open a position or game in the Analysis board.

import type { MoveTree } from '../../chess/moveTree';

export interface AnalysisHandoff {
  fen?: string;
  pgn?: string;
  tree?: MoveTree;
  current?: string;
  orientation?: 'white' | 'black';
  title?: string;
}

const KEY = 'cm:analysis-handoff';

/** Returns the path to navigate to. */
export function analysisPath(h: AnalysisHandoff): string {
  if (h.fen && !h.pgn && !h.tree) {
    const o = h.orientation ? `&o=${h.orientation}` : '';
    return `/analysis?fen=${encodeURIComponent(h.fen)}${o}`;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
  return '/analysis?handoff=1';
}

export function takeHandoff(): AnalysisHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as AnalysisHandoff) : null;
  } catch {
    return null;
  }
}
