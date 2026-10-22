import { Link, useNavigate } from 'react-router';
import { entry } from '../../data/openings/catalog';
import { MASTERY_DAYS, dueCards, goodDays, masteryPercent, openingProgressSlot, pathSlot, pathStatus, progressOf } from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { Button, Card, Progress } from '../../ui/kit';

interface ModuleInfo {
  to: string;
  title: string;
  icon: string;
  blurb: string;
  ready: boolean;
}

export const MODULES: ModuleInfo[] = [
  { to: '/openings', title: 'Opening Library', icon: '📖', blurb: 'Learn famous openings one at a time: the moves, why, the plan and the traps.', ready: true },
  { to: '/blunder-check', title: 'Blunder Check', icon: '🛡️', blurb: 'Build the habit that stops you hanging pieces and missing threats.', ready: true },
  { to: '/practice', title: 'Practice Games', icon: '🤖', blurb: 'Play bots from 600 to 1600 with a coach watching your moves.', ready: true },
  { to: '/tactics', title: 'Tactics', icon: '⚡', blurb: '15 puzzles a day by theme: forks, pins, skewers, mates.', ready: true },
  { to: '/planning', title: 'Planning', icon: '🧭', blurb: 'Learn to think in plans and candidate moves, not one move at a time.', ready: true },
  { to: '/endgames', title: 'Endgames', icon: '👑', blurb: 'The essential checkmates and pawn endings, practiced until automatic.', ready: false },
  { to: '/game-review', title: 'Game Review', icon: '🔍', blurb: 'Import your Chess.com games and turn your mistakes into puzzles.', ready: false },
  { to: '/analysis', title: 'Analysis Board', icon: '🔬', blurb: 'Explore any position with the engine, threat view and explanations.', ready: true },
];

export function HomePage() {
  const navigate = useNavigate();
  const [order] = useSlot(pathSlot);
  const [all] = useSlot(openingProgressSlot);
  const { currentStep, status } = pathStatus(order, all);
  const currentId = currentStep?.openings.find((id) => status[id] !== 'mastered');
  const current = currentId ? entry(currentId) : undefined;
  const p = currentId ? progressOf(all, currentId) : null;
  const due = dueCards().length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Welcome back</h1>
          <p className="text-cm-muted">Your path from 800 to 1500. One step at a time.</p>
        </div>
        <div className="flex gap-1 lg:hidden">
          <Link to="/studies" aria-label="My studies" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl">📚</Link>
          <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl">⚙️</Link>
        </div>
      </div>
      <Card title="Today">
        <div className="space-y-3">
          {current?.lesson && p && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-48 flex-1">
                <p className="font-bold">📖 {current.name}</p>
                <p className="text-sm text-cm-muted">
                  {goodDays(p).length}/{MASTERY_DAYS} days at 90%+ · drill it today
                </p>
                <Progress value={masteryPercent(p, current.lesson.lines.length)} className="mt-1.5" />
              </div>
              <Button variant="primary" onClick={() => navigate(`/openings/${current.id}?tab=drill`)}>Drill now</Button>
            </div>
          )}
          {due > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">🔁 {due} opening moves to review</p>
              <Button onClick={() => navigate('/openings/review')}>Review</Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">🛡️ Blunder check: one round of each drill</p>
            <Button onClick={() => navigate('/blunder-check')}>Train</Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">⚡ 15 puzzles</p>
            <Button onClick={() => navigate('/tactics')}>Solve</Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">🤖 One practice game</p>
            <Button onClick={() => navigate('/practice')}>Play</Button>
          </div>
          <p className="text-xs text-cm-faint">More daily tasks (blunder checks, puzzles, a practice game) appear here as those modules are built.</p>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) =>
          m.ready ? (
            <Link key={m.to} to={m.to} className="block rounded-lg bg-cm-panel p-4 transition hover:bg-cm-panel2">
              <ModuleBody m={m} />
            </Link>
          ) : (
            <div key={m.to} className="rounded-lg border border-dashed border-cm-line p-4 opacity-60">
              <ModuleBody m={m} />
              <p className="mt-1 text-xs font-bold text-cm-faint">Coming soon</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function ModuleBody({ m }: { m: ModuleInfo }) {
  return (
    <>
      <p className="text-lg font-bold">
        <span className="me-2">{m.icon}</span>
        {m.title}
      </p>
      <p className="text-sm text-cm-muted">{m.blurb}</p>
    </>
  );
}
