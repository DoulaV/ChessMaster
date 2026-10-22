import { useState } from 'react';
import { openingProgressSlot } from '../../progress/openings';
import { puzzlesSlot } from '../../progress/puzzles';
import { isDue, today, addDays } from '../../progress/srs';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { DAILY_SIZE, THEMES, startRating, tacticsSlot, weakestThemes } from '../../progress/tactics';
import { Badge, Button, Card, Progress, Toggle } from '../../ui/kit';
import { buildDailySet, loadTheme, pickNear, type PuzzleItem } from './puzzles';
import { PuzzleSession, type SessionResult } from './PuzzleSession';

export function TacticsPage() {
  const [settings] = useSlot(settingsSlot);
  const [stats] = useSlot(tacticsSlot);
  const [personal] = useSlot(puzzlesSlot);
  const [progress] = useSlot(openingProgressSlot);
  const [session, setSession] = useState<{ items: PuzzleItem[]; title: string } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [onlyStudied, setOnlyStudied] = useState(false);
  const [loading, setLoading] = useState(false);

  const rating = stats.rating || startRating(settings.rating);
  const doneToday = stats.days[today()]?.done ?? 0;
  const left = Math.max(0, DAILY_SIZE - doneToday);
  const weekAgo = stats.history[Object.keys(stats.history).filter((d) => d <= addDays(today(), -7)).sort().pop() ?? ''];
  const dueMine = personal.filter((p) => isDue(p.card));
  const studied = new Set(Object.entries(progress).filter(([, p]) => Object.keys(p.drillDays).length || p.learnedLines.length).map(([id]) => id));
  const weakest = weakestThemes(stats).slice(0, 2);

  if (session) {
    return (
      <PuzzleSession
        key={session.title + session.items.length}
        items={session.items}
        title={session.title}
        onDone={(r) => {
          setResult(r);
          setSession(null);
        }}
      />
    );
  }

  async function startDaily() {
    setLoading(true);
    const items = await buildDailySet(stats, rating, personal, left || DAILY_SIZE, onlyStudied && studied.size ? studied : undefined);
    setLoading(false);
    setResult(null);
    if (items.length) setSession({ items, title: left ? 'Today’s puzzles' : 'Extra puzzles' });
  }

  async function startTheme(theme: string) {
    setLoading(true);
    const list = await loadTheme(theme);
    const items = pickNear(list, rating, 10, new Set(stats.recent), onlyStudied && studied.size ? studied : undefined);
    setLoading(false);
    setResult(null);
    const name = THEMES.find((t) => t.id === theme)?.name ?? theme;
    if (items.length) setSession({ items, title: name });
  }

  function startMine() {
    setResult(null);
    setSession({ items: dueMine.slice(0, 10).map((puzzle) => ({ kind: 'personal', puzzle })), title: 'Your puzzles' });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-extrabold">Tactics</h1>
      {result && (
        <Card className="border-s-4 border-cm-green">
          <p className="text-lg font-bold">Set complete: {result.solved} of {result.total} solved.</p>
          <p className="text-sm text-cm-muted">Your puzzle rating is now {rating}.</p>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-cm-muted">Puzzle rating</p>
          <p className="text-3xl font-extrabold">{rating}</p>
          <p className="text-xs text-cm-faint">
            {weekAgo !== undefined ? `${rating - weekAgo >= 0 ? '+' : ''}${rating - weekAgo} in 7 days` : stats.games ? `${stats.games} puzzles played` : 'Starts near your Chess.com rating'}
          </p>
        </Card>
        <Card className="sm:col-span-2">
          <p className="font-bold">📅 Today’s set: {Math.min(doneToday, DAILY_SIZE)} / {DAILY_SIZE}</p>
          <Progress value={doneToday / DAILY_SIZE} className="my-2" />
          <p className="mb-3 text-xs text-cm-muted">
            A short set, not endless grinding. It mixes your own puzzles that are due with themes you find hardest
            {weakest.length ? ` (right now: ${weakest.map((w) => THEMES.find((t) => t.id === w)?.name).join(', ')})` : ''}.
          </p>
          <Button variant="primary" onClick={startDaily} disabled={loading}>
            {loading ? 'Loading…' : left ? `Start (${left} left)` : 'Done for today! Play 15 more'}
          </Button>
        </Card>
      </div>

      <Card title="⭐ Your puzzles (from your own games)">
        {personal.length === 0 ? (
          <p className="text-sm text-cm-muted">Mistakes from your practice games appear here as puzzles, so you fix the exact errors you make.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">{dueMine.length} due now · {personal.length} in total</p>
            <Button onClick={startMine} disabled={!dueMine.length}>Practice them</Button>
          </div>
        )}
      </Card>

      <Card>
        <Toggle
          checked={onlyStudied}
          onChange={setOnlyStudied}
          label="Only puzzles from openings I’ve studied"
          hint={studied.size ? `${studied.size} opening${studied.size > 1 ? 's' : ''} studied so far.` : 'Study an opening first to use this.'}
        />
      </Card>

      <section>
        <h2 className="mb-2 text-lg font-bold">Practice a theme</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => {
            const s = stats.byTheme[t.id];
            return (
              <button key={t.id} onClick={() => startTheme(t.id)} disabled={loading} className="rounded-lg bg-cm-panel p-3 text-start hover:bg-cm-panel2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{t.icon} {t.name}</p>
                  {s && s.total > 0 && <Badge tone={s.right / s.total >= 0.7 ? 'green' : s.right / s.total >= 0.5 ? 'yellow' : 'red'}>{Math.round((s.right / s.total) * 100)}%</Badge>}
                </div>
                <p className="text-xs text-cm-muted">{t.text}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-cm-faint">Puzzles from the Lichess puzzle database (free to use), rated 800 to 1600.</p>
      </section>
    </div>
  );
}
