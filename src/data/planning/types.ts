// Content shapes for the Planning Trainer.

export type Orientation = 'white' | 'black';

export interface PlanningExample {
  fen: string;
  orientation: Orientation;
  title: string;
  /** 2 or 3 sentences explaining the idea in this position. */
  text: string;
  /** Arrows showing the idea, as [from, to] squares. */
  arrows: [string, string][];
  highlight?: string[];
}

export interface PlanningLesson {
  id: 'piece-activity' | 'center' | 'king-safety' | 'weak-squares' | 'open-files' | 'pawn-breaks' | 'trading';
  title: string;
  icon: string;
  summary: string;
  /** 4 to 6 short rules. */
  points: string[];
  examples: PlanningExample[];
}

export interface PlanOption {
  text: string;
  correct: boolean;
}

export interface PlanExercise {
  id: string;
  /** The student is to move in this position. */
  fen: string;
  orientation: Orientation;
  /** Catalog id of the opening this position comes from. */
  openingId: string;
  question: string;
  options: PlanOption[];
  explanation: string;
  /** A typical first move (SAN) that starts the correct plan. */
  firstMove?: string;
}
