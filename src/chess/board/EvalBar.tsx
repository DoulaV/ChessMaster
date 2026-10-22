import type { Score } from '../../engine/engine';
import { formatScore } from '../explain';
import { winChance } from '../utils';

/** Vertical bar: white share grows as White's winning chances grow. */
export function EvalBar({ score, orientation }: { score: Score | null; orientation: 'white' | 'black' }) {
  const white = score
    ? score.mate !== null
      ? score.mate > 0
        ? 1
        : 0
      : winChance(score.cp)
    : 0.5;
  const pct = `${Math.round(white * 100)}%`;
  const flipped = orientation === 'black';
  return (
    <div
      className={`relative flex w-5 shrink-0 overflow-hidden rounded border border-neutral-400 bg-neutral-700 dark:border-neutral-600 ${flipped ? 'flex-col' : 'flex-col-reverse'}`}
      aria-label={score ? `Evaluation ${formatScore(score)}` : 'Evaluation'}
    >
      <div className="bg-white transition-all duration-500" style={{ height: pct }} />
      {score && (
        <span
          className={`absolute inset-x-0 text-center text-[9px] font-bold ${
            white >= 0.5 === !flipped ? 'bottom-1' : 'top-1'
          } ${white >= 0.5 ? 'text-neutral-800' : 'text-neutral-100'}`}
        >
          {formatScore(score).replace('+', '')}
        </span>
      )}
    </div>
  );
}
