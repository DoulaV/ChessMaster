import { Link } from 'react-router';
import { Card } from '../../ui/kit';

interface ModuleInfo {
  to: string;
  title: string;
  icon: string;
  blurb: string;
  ready: boolean;
}

export const MODULES: ModuleInfo[] = [
  { to: '/openings', title: 'Opening Library', icon: '📖', blurb: 'Learn famous openings one at a time: the moves, why, the plan and the traps.', ready: false },
  { to: '/blunder-check', title: 'Blunder Check', icon: '🛡️', blurb: 'Build the habit that stops you hanging pieces and missing threats.', ready: false },
  { to: '/practice', title: 'Practice Games', icon: '🤖', blurb: 'Play bots from 600 to 1600 with a coach watching your moves.', ready: false },
  { to: '/tactics', title: 'Tactics', icon: '⚡', blurb: '15 puzzles a day by theme: forks, pins, skewers, mates.', ready: false },
  { to: '/planning', title: 'Planning', icon: '🧭', blurb: 'Learn to think in plans and candidate moves, not one move at a time.', ready: false },
  { to: '/endgames', title: 'Endgames', icon: '👑', blurb: 'The essential checkmates and pawn endings, practiced until automatic.', ready: false },
  { to: '/review', title: 'Game Review', icon: '🔍', blurb: 'Import your Chess.com games and turn your mistakes into puzzles.', ready: false },
  { to: '/analysis', title: 'Analysis Board', icon: '🧪', blurb: 'Explore any position with the engine, threat view and explanations.', ready: true },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ChessMaster</h1>
        <p className="text-neutral-600 dark:text-neutral-300">Your path from 800 to 1500. One step at a time.</p>
      </div>
      <Card title="Today">
        <p className="text-sm">
          Your daily plan appears here once the training modules are ready. For now, try the{' '}
          <Link className="underline" to="/analysis">Analysis board</Link>.
        </p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) =>
          m.ready ? (
            <Link key={m.to} to={m.to} className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800">
              <ModuleBody m={m} />
            </Link>
          ) : (
            <div key={m.to} className="rounded-xl border border-dashed border-neutral-300 p-4 opacity-70 dark:border-neutral-600">
              <ModuleBody m={m} />
              <p className="mt-1 text-xs font-medium text-neutral-500">Coming soon</p>
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
      <p className="text-lg font-semibold">
        <span className="me-2">{m.icon}</span>
        {m.title}
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{m.blurb}</p>
    </>
  );
}
