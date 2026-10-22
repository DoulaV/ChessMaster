// The shape of opening lessons.
//
// An opening is written as a list of lines (main line plus side lines).
// Each line is a list of [move, why] pairs from the starting position.
// Lines that share their first moves only need the "why" once: the
// builder merges them into a single move tree.

export type Side = 'white' | 'black';
export type Group = 'white' | 'black-e4' | 'black-d4';

/** One move in SAN plus a one-sentence reason. The reason may be left out if an earlier line already gave it. */
export type MoveSpec = [san: string, why?: string];

export interface LineSpec {
  id: string;
  /** Short name shown in the app, e.g. "Giuoco Piano: Main Line". */
  name: string;
  /** Standard ECO code and name of the position the line reaches (checked by tests). */
  eco: string;
  ecoName: string;
  main?: boolean;
  moves: MoveSpec[];
}

export interface Trap {
  id: string;
  name: string;
  /** "set" = a trap you can set; "avoid" = a trap you must not fall into. */
  kind: 'set' | 'avoid';
  /** All moves from the start, in SAN. */
  moves: string[];
  /** Index into `moves` of the mistake (the move that falls for it). */
  mistakeAt: number;
  summary: string;
  howToSet?: string;
  howToAvoid: string;
}

export interface ModelGame {
  id: string;
  title: string;
  white: string;
  black: string;
  year: number;
  event?: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  /** True when this is a teaching game, not a famous historical game. */
  illustrative?: boolean;
  moves: string[];
  /** Comments keyed by move index in `moves` (0 = first move). */
  comments: Record<number, string>;
  lesson: string;
}

export interface PiecePlan {
  piece: string;
  where: string;
  why: string;
}

export interface OpeningLesson {
  id: string;
  name: string;
  side: Side;
  group: Group;
  eco: string;
  /** e.g. ["solid", "classical"] */
  style: string[];
  character: string;
  plan: {
    summary: string;
    pawnStructure: string;
    pieces: PiecePlan[];
    goals: string[];
  };
  offBook: { when: string; advice: string }[];
  traps: Trap[];
  lines: LineSpec[];
  modelGames: ModelGame[];
}

/** A node in the built move tree. */
export interface OpeningNode {
  /** Moves from the start up to and including this one, joined by spaces. Unique per node. */
  key: string;
  san: string;
  why: string;
  ply: number;
  fen: string;
  /** Lines that pass through this node. */
  lines: string[];
  children: OpeningNode[];
}
