// "Think with me": a step-by-step thinking routine with unlimited help.
// You think first; tap to see each answer. Your plan carries over between moves.
// Answers are worked out only when you ask for them, one at a time, so the
// board stays smooth.

import type { Move, Square } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import { moveIdeas } from '../../chess/explain';
import { pvToSan } from '../../chess/utils';
import { getBackgroundEngine } from '../../engine/engine';
import { Button, Card } from '../../ui/kit';
import { STEP_QUESTIONS, stepById, type ThinkStep } from './thinking';

export interface CoachMarks {
  squares: Square[];
  moves: { from: Square; to: Square }[];
  best?: { from: Square; to: Square };
}

export function ThinkingCoach({ fen, last, openingPlan, plan, prevPlan, onPlan, onMarks, onReveal, safetyMode, onSafetyMode }: {
  fen: string;
  last: Move | null;
  openingPlan?: string | null;
  plan: string;
  /** The plan you wrote before your last move. */
  prevPlan: string;
  onPlan: (p: string) => void;
  onMarks: (m: CoachMarks) => void;
  /** Called the first time any help is opened in this position. */
  onReveal: () => void;
  safetyMode: boolean;
  onSafetyMode: (v: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Partial<Record<ThinkStep['id'], ThinkStep>>>({});
  const [working, setWorking] = useState<ThinkStep['id'] | null>(null);
  const [best, setBest] = useState<{ san: string; why: string; from: Square; to: Square } | null>(null);
  const [loadingBest, setLoadingBest] = useState(false);
  const [draft, setDraft] = useState(plan);
  const helped = useRef(false);
  // Keep the latest props in refs so effects only re-run when the position changes.
  const lastRef = useRef(last);
  lastRef.current = last;
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const onMarksRef = useRef(onMarks);
  onMarksRef.current = onMarks;

  // New position: forget the answers.
  useEffect(() => {
    setAnswers({});
    setBest(null);
    setWorking(null);
    helped.current = false;
    onMarksRef.current({ squares: [], moves: [] });
  }, [fen]);
  useEffect(() => setDraft(plan), [plan]);

  // Board marks for the answers you opened (only when they change).
  const marksKey = Object.keys(answers).join(',') + (best ? `|${best.from}${best.to}` : '');
  useEffect(() => {
    const squares: Square[] = [];
    const moves: CoachMarks['moves'] = [];
    for (const s of Object.values(answers)) {
      if (!s) continue;
      squares.push(...s.squares);
      moves.push(...s.moves.slice(0, 4));
    }
    onMarksRef.current({ squares, moves, best: best ? { from: best.from, to: best.to } : undefined });
  }, [marksKey]);

  const firstHelp = () => {
    if (!helped.current) {
      helped.current = true;
      onReveal();
    }
  };

  const reveal = (id: ThinkStep['id']) => {
    if (working) return;
    firstHelp();
    setWorking(id);
    const forFen = fen;
    // Let the button show "Thinking…" first, then do the work.
    setTimeout(() => {
      const step = stepById(id, forFen, lastRef.current, openingPlan);
      if (fenRef.current === forFen) setAnswers((a) => ({ ...a, [id]: step }));
      setWorking(null);
    }, 30);
  };

  const nextIndex = STEP_QUESTIONS.findIndex((q) => !answers[q.id]);

  async function showBest() {
    firstHelp();
    setLoadingBest(true);
    const forFen = fen;
    const l = await getBackgroundEngine().analyse(forFen, { depth: 13, multipv: 1 });
    setLoadingBest(false);
    const uci = l[0]?.pv[0];
    if (!uci || fenRef.current !== forFen) return;
    const why = moveIdeas(forFen, uci)[0] ?? 'It improves your position the most. Compare it with your own plan.';
    setBest({ san: pvToSan(forFen, [uci])[0] ?? uci, why, from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
  }

  return (
    <Card title="🧠 Think with me">
      {prevPlan && (
        <p className="mb-3 rounded-lg bg-cm-panel2 p-2 text-sm">
          🧵 Your plan last move: <b>“{prevPlan}”</b>. After their reply, is it still a good plan?
        </p>
      )}
      <ol className="space-y-2">
        {STEP_QUESTIONS.map((q, k) => {
          const a = answers[q.id];
          const current = k === nextIndex;
          return (
            <li key={q.id} className={`rounded-lg p-2 ${current ? 'bg-cm-green/10 ring-1 ring-cm-green/50' : ''}`}>
              <div className="flex gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${a ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted'}`}>{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{q.question(last)}</p>
                  {current && !a && <p className="text-xs text-cm-faint">{q.why}</p>}
                  {a ? (
                    <ul className="mt-1 space-y-0.5 text-sm text-cm-muted">
                      {a.answer.map((t, i) => (
                        <li key={i}>• {t}</li>
                      ))}
                    </ul>
                  ) : (
                    current && (
                      <Button size="sm" className="mt-1.5" onClick={() => reveal(q.id)} disabled={!!working}>
                        {working === q.id ? 'Thinking…' : 'I’ve thought about it: show me'}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 border-t border-cm-line pt-3">
        <label className="mb-1 block text-sm font-bold">🧵 Your plan (it follows you to the next move)</label>
        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border p-2 text-sm"
            placeholder="e.g. castle, then bring the knight to f5"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onPlan(draft.trim())}
          />
          <Button size="sm" onClick={() => onPlan(draft.trim())}>Save</Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={safetyMode ? 'primary' : 'secondary'} onClick={() => onSafetyMode(!safetyMode)}>
          🛡️ {safetyMode ? 'Safety check is ON: make your move' : 'Safety-check my move first'}
        </Button>
        <Button size="sm" variant="ghost" onClick={showBest} disabled={loadingBest || !!best}>
          {loadingBest ? 'Thinking…' : '💡 Show the best move'}
        </Button>
      </div>
      {best && (
        <p className="mt-2 rounded-lg bg-cm-blue/20 p-2 text-sm">
          💡 Best: <b>{best.san}</b> (blue arrow). {best.why} Before playing it, can you see why it’s good?
        </p>
      )}
    </Card>
  );
}
