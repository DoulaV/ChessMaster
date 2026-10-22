// Every kind of saved data in the app, in one place.

import type { MoveTree } from '../chess/moveTree';
import type { Slot } from './store';

export interface Settings {
  /** Chess.com rapid rating; drives opening depth and bot suggestions. */
  rating: number;
  chesscomUser: string;
  lichessUser: string;
  /** Optional personal Lichess token, only used for opening explorer stats. */
  lichessToken: string;
  boardTheme: 'green' | 'brown' | 'blue';
}

export const settingsSlot: Slot<Settings> = {
  key: 'settings',
  version: 1,
  initial: () => ({
    rating: 800,
    chesscomUser: '',
    lichessUser: '',
    lichessToken: '',
    boardTheme: 'green',
  }),
};

export interface Study {
  id: string;
  title: string;
  /** When saved, ISO time in UTC. */
  savedAt: string;
  tree: MoveTree;
  /** Node to open on. */
  current: string;
  orientation: 'white' | 'black';
  /** Where it came from, e.g. "Practice game vs 800 bot". */
  source?: string;
}

export const studiesSlot: Slot<Study[]> = {
  key: 'studies',
  version: 1,
  initial: () => [],
};
