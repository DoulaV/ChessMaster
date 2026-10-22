// The shape of the Course: units, lessons and where their exercises come from.

import type { MistakeTag } from '../../chess/explain';

export type Area = 'safety' | 'tactics' | 'calculation' | 'openings' | 'positional' | 'planning' | 'attack' | 'endgames';

/** Where a lesson's exercises come from (all checked with Stockfish or from the Lichess puzzle database). */
export type ExerciseSource =
  | { kind: 'threats' } // Blunder Check bank: spot the threat
  | { kind: 'safe' } // Blunder Check bank: is this move safe?
  | { kind: 'hanging' } // Blunder Check bank: tap the unprotected pieces
  | { kind: 'puzzles'; themes: string[] } // Lichess puzzle files in public/puzzles
  | { kind: 'mixed'; parts: ExerciseSource[] };

export interface CourseLesson {
  id: string;
  unit: number;
  title: string;
  /** What you will be able to do after the lesson. */
  goal: string;
  /** Short explanation, a few paragraphs in plain words. */
  concept: string[];
  /** The rules to remember. */
  rules: string[];
  /** Questions the coach asks during guided practice, in order. */
  coachQuestions: string[];
  exercises: ExerciseSource;
  /** Focus shown during the practice game for this lesson. */
  gameFocus: string;
  /** One habit to use in your real games this week. */
  homework: string;
  /** Mistake types from your games that send you back to this lesson. */
  fixes: MistakeTag[];
  area: Area;
}

export interface CourseUnit {
  id: number;
  title: string;
  range: string;
  summary: string;
  /** Empty while the unit is still being written. */
  lessons: CourseLesson[];
}
