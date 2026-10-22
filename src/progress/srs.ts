// SM-2 spaced repetition: cards you get right come back after longer and
// longer gaps; cards you miss come back tomorrow.

export interface SrsCard {
  /** Ease factor (how fast the gap grows). Starts at 2.5. */
  ef: number;
  /** Days until the next review. */
  interval: number;
  /** Correct answers in a row. */
  reps: number;
  /** Next review date, local YYYY-MM-DD. */
  due: string;
  lapses: number;
  lastSeen: string;
}

/** Today's date in the user's own timezone, as YYYY-MM-DD. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return today(new Date(y, m - 1, d + days));
}

export function newCard(date = today()): SrsCard {
  return { ef: 2.5, interval: 0, reps: 0, due: date, lapses: 0, lastSeen: date };
}

/**
 * Grade a review. quality: 5 = perfect, 4 = right after hesitation or a hint,
 * 3 = right but hard, 0 to 2 = wrong.
 */
export function review(card: SrsCard, quality: number, date = today()): SrsCard {
  const q = Math.max(0, Math.min(5, quality));
  let { ef, interval, reps, lapses } = card;
  if (q < 3) {
    reps = 0;
    interval = 1;
    lapses += 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ef, interval, reps, lapses, due: addDays(date, interval), lastSeen: date };
}

export const isDue = (card: SrsCard, date = today()) => card.due <= date;
