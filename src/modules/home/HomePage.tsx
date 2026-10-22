// Home = the roadmap and progress dashboard.

import { useState } from 'react';
import { Link } from 'react-router';
import { CATALOG, GROUP_LABEL, entry } from '../../data/openings/catalog';
import type { Group } from '../../data/openings/types';
import { blunderSlot } from '../../progress/blunder';
import { botResults, currentStage, mistakeCounts, recentGames, roadmap, type DashboardInput } from '../../progress/dashboard';
import { endgamesSlot } from '../../progress/endgames';
import { MASTERY_DAYS, dueCards, goodDays, masteryPercent, openingProgressSlot, pathSlot, pathStatus, progressOf } from '../../progress/openings';
import { planningSlot } from '../../progress/planning';
import { practiceSlot } from '../../progress/practice';
import { reviewsSlot } from '../../progress/reviews';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { startRating, tacticsSlot } from '../../progress/tactics';
import { BarList, ColumnChart, LineChart } from '../../ui/charts';
import { Badge, Card, Progress } from '../../ui/kit';

interface ModuleInfo {
  to: string;
  title: string;
  icon: string;
  blurb: string;
}

export const MODULES: ModuleInfo[] = [
  { to: '/openings', title: 'Opening Library', icon: '📖', blurb: 'Famous openings one at a time: moves, why, plan, traps.' },
  { to: '/practice', title: 'Practice Games', icon: '🤖', blurb: 'Bots from 600 to 1600 with a coach.' },
  { to: '/tactics', title: 'Tactics', icon: '⚡', blurb: '15 puzzles a day by theme.' },
  { to: '/blunder-check', title: 'Blunder Check', icon: '🛡️', blurb: 'Stop hanging pieces and missing threats.' },
  { to: '/planning', title: 'Planning', icon: '🧭', blurb: 'Plans and candidate moves.' },
  { to: '/endgames', title: 'Endgames', icon: '👑', blurb: 'Essential mates and pawn endings.' },
  { to: '/game-review', title: 'Game Review', icon: '🔍', blurb: 'Learn from your Chess.com games.' },
  { to: '/analysis', title: 'Analysis Board', icon: '🔬', blurb: 'Explore any position with the engine.' },
];

const STATUS_TONE = { mastered: 'green', current: 'yellow', locked: 'muted', 'coming-soon': 'muted' } as const;
const STATUS_ICON = { mastered: '✅', current: '▶️', locked: '🔒', 'coming-soon': '⏳' } as const;

export function ProgressPage() {
  const [settings] = useSlot(settingsSlot);
  const [openings] = useSlot(openingProgressSlot);
  const [path] = useSlot(pathSlot);
  const [blunder] = useSlot(blunderSlot);
  const [tactics] = useSlot(tacticsSlot);
  const [planning] = useSlot(planningSlot);
  const [practice] = useSlot(practiceSlot);
  const [reviews] = useSlot(reviewsSlot);
  const [endgames] = useSlot(endgamesSlot);
  const [openStage, setOpenStage] = useState<string | null>(null);

  const input: DashboardInput = { rating: settings.rating, openings, path, blunder, tactics, planning, practice, reviews, endgames };
  const { currentStep, status } = pathStatus(path, openings);
  const currentId = currentStep?.openings.find((id) => status[id] !== 'mastered') ?? null;
  const current = currentId ? entry(currentId) : undefined;
  const stages = roadmap(input);
  const stage = currentStage(stages, settings.rating);
  const dueMoves = dueCards().length;
  const ratingSeries = Object.entries(tactics.history).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([d, v]) => ({ label: d.slice(5), value: v }));
  const games = recentGames(input).slice(0, 20).reverse();
  const bots = botResults(input);
  const mistakes = mistakeCounts(input).slice(0, 6);
  const mastered = CATALOG.filter((c) => status[c.id] === 'mastered').length;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Progress</h1>
          <p className="text-cm-muted">
            Rating {settings.rating} (Chess.com) · goal 1500 · stage: <b className="text-white">{stage.title}</b>
          </p>
        </div>
        <div className="flex gap-1 lg:hidden">
          <Link to="/studies" aria-label="My studies" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl">📚</Link>
          <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl">⚙️</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-cm-muted">Puzzle rating</p>
          <p className="text-3xl font-extrabold">{tactics.rating || startRating(settings.rating)}</p>
          <p className="text-xs text-cm-faint">{tactics.games} puzzles played</p>
        </Card>
        <Card>
          <p className="text-sm text-cm-muted">Openings mastered</p>
          <p className="text-3xl font-extrabold">{mastered} / {CATALOG.length}</p>
          <p className="text-xs text-cm-faint">{dueMoves ? `${dueMoves} moves to review today` : 'No reviews due'}</p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="📖 Current opening">
          {current?.lesson ? (
            <>
              <p className="text-lg font-bold">{current.name} <Badge>{current.eco}</Badge></p>
              <p className="text-sm text-cm-muted">{goodDays(progressOf(openings, current.id)).length} of {MASTERY_DAYS} days at 90%+</p>
              <Progress value={masteryPercent(progressOf(openings, current.id), current.lesson.lines.length)} className="my-2" />
              <p className="text-xs text-cm-faint">{Math.round(masteryPercent(progressOf(openings, current.id), current.lesson.lines.length) * 100)}% toward mastery</p>
            </>
          ) : (
            <p className="text-sm text-cm-muted">All openings in your path are mastered. Amazing!</p>
          )}
          <Link to="/openings" className="mt-2 inline-block text-sm underline">Open the library</Link>
        </Card>
        <Card title="🗺️ Library map">
          {(['white', 'black-e4', 'black-d4'] as Group[]).map((g) => (
            <div key={g} className="mb-2">
              <p className="mb-1 text-xs text-cm-faint">{GROUP_LABEL[g]}</p>
              <div className="flex flex-wrap gap-1">
                {CATALOG.filter((c) => c.group === g).map((c) => {
                  const st = status[c.id] ?? 'locked';
                  return (
                    <Link key={c.id} to={`/openings/${c.id}`} title={c.name}>
                      <Badge tone={STATUS_TONE[st]}>{STATUS_ICON[st]} {c.name.replace(' Defense', '').replace(' Opening', '').replace(' Game', '')}</Badge>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-cm-faint">✅ mastered · ▶️ studying now · 🔒 locked</p>
        </Card>
      </div>

      <Card title="🧗 Your roadmap to 1500">
        <div className="space-y-2">
          {stages.map((s) => {
            const done = s.items.filter((i) => i.done).length;
            const isCurrent = s.id === stage.id;
            const expanded = openStage === s.id || (openStage === null && isCurrent);
            return (
              <div key={s.id} className={`rounded-lg ${isCurrent ? 'bg-cm-panel2' : 'bg-cm-bg/40'}`}>
                <button className="flex w-full items-center gap-3 p-3 text-start" onClick={() => setOpenStage(expanded ? '' : s.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {s.range[0]} to {s.range[1]}: {s.title} {isCurrent && <Badge tone="yellow">You are here</Badge>}
                    </span>
                    <Progress value={done / s.items.length} className="mt-1.5" />
                  </span>
                  <span className="text-sm text-cm-muted">{done}/{s.items.length}</span>
                </button>
                {expanded && (
                  <ul className="space-y-1.5 px-3 pb-3">
                    {s.items.map((i) => (
                      <li key={i.label} className="text-sm">
                        {i.done ? '✅' : '⬜'} <b>{i.label}</b>
                        <span className="block ps-6 text-xs text-cm-faint">{i.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <LineChart title="Puzzle rating" subtitle="End of each day, last 30 days played" data={ratingSeries} valueName="Rating" empty="Solve some puzzles to see your rating trend." />
        <ColumnChart
          title="Blunders per game"
          subtitle="Practice games and reviewed games, oldest to newest"
          data={games.map((g) => ({ label: `${g.at.slice(5, 10)} ${g.label}`, value: g.blunders }))}
          valueName="Blunders"
          empty="Play a practice game or review one of your games."
        />
        <BarList
          title="Win rate against each bot"
          data={bots.map((b) => ({ label: `Bot ${b.rating}`, value: Math.round(b.rate * 100), note: `${b.wins} of ${b.total}` }))}
          format={(v) => `${v}%`}
          max={100}
          valueName="Win rate"
          empty="Play practice games to see your results."
        />
        <BarList
          title="Your most common mistakes"
          subtitle="From practice games and reviewed games"
          data={mistakes.map((m) => ({ label: m.label, value: m.count }))}
          valueName="Times"
          empty="No mistakes recorded yet."
        />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold">Everything</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className="block rounded-lg bg-cm-panel p-3 hover:bg-cm-panel2">
              <p className="font-bold">{m.icon} {m.title}</p>
              <p className="text-xs text-cm-muted">{m.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
