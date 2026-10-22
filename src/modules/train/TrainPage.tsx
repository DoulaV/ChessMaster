import { Link } from 'react-router';

const ITEMS = [
  { to: '/tactics', icon: '⚡', title: 'Tactics', text: '15 puzzles a day by theme, plus puzzles from your own games.' },
  { to: '/blunder-check', icon: '🛡️', title: 'Blunder Check', text: 'Spot threats, check if moves are safe, find hanging pieces.' },
  { to: '/planning', icon: '🧭', title: 'Planning', text: 'Think beyond one move: plans, candidate moves, key ideas.' },
  { to: '/game-review', icon: '🔍', title: 'Game Review', text: 'Import your Chess.com or Lichess games and learn from your mistakes.' },
];

/** One place for all training drills (used by the phone's bottom bar). */
export function TrainPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-2xl font-extrabold">Train</h1>
      {ITEMS.map((i) => (
        <Link key={i.to} to={i.to} className="flex items-center gap-4 rounded-lg bg-cm-panel p-4 hover:bg-cm-panel2">
          <span className="text-4xl">{i.icon}</span>
          <span>
            <span className="block text-lg font-bold">{i.title}</span>
            <span className="block text-sm text-cm-muted">{i.text}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
