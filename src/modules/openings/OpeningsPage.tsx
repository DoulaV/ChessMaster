import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CATALOG, DEFAULT_PATH, GROUP_LABEL, entry } from '../../data/openings/catalog';
import type { Group } from '../../data/openings/types';
import {
  MASTERY_DAYS,
  dueCards,
  goodDays,
  masteryPercent,
  openingProgressSlot,
  pathSlot,
  pathStatus,
  progressOf,
  type OpeningStatus,
} from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { Badge, Button, Card, Progress, Segmented } from '../../ui/kit';

const STATUS_BADGE: Record<OpeningStatus, { label: string; tone: 'green' | 'yellow' | 'muted' }> = {
  mastered: { label: '✓ Mastered', tone: 'green' },
  current: { label: 'Studying now', tone: 'yellow' },
  locked: { label: '🔒 Locked', tone: 'muted' },
  'coming-soon': { label: 'Lesson coming soon', tone: 'muted' },
};

export function OpeningsPage() {
  const [order, setOrder] = useSlot(pathSlot);
  const [all] = useSlot(openingProgressSlot);
  const [view, setView] = useState<'path' | 'all'>('path');
  const navigate = useNavigate();
  const { steps, status, currentStep } = pathStatus(order, all);
  const due = dueCards().length;

  const move = (i: number, dir: -1 | 1) =>
    setOrder(() => {
      const ids = steps.map((s) => s.id);
      const j = i + dir;
      if (j < 0 || j >= ids.length) return ids;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return ids;
    });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-extrabold">Opening Library</h1>

      {currentStep && (
        <Card className="border-s-4 border-cm-green">
          <p className="text-xs font-bold tracking-wide text-cm-faint uppercase">Your current opening</p>
          {currentStep.openings.map((id) => {
            const e = entry(id)!;
            const p = progressOf(all, id);
            if (status[id] === 'mastered') return null;
            return (
              <div key={id} className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-extrabold">{e.name}</p>
                  <Badge>{e.eco}</Badge>
                  <span className="text-sm text-cm-faint">{e.side === 'white' ? 'as White' : 'as Black'}</span>
                </div>
                {e.lesson ? (
                  <>
                    <p className="mt-1 text-sm text-cm-muted">
                      {goodDays(p).length} of {MASTERY_DAYS} days at 90%+ in drills
                    </p>
                    <Progress value={masteryPercent(p, e.lesson.lines.length)} className="my-2" />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => navigate(`/openings/${id}?tab=learn`)}>📖 Learn</Button>
                      <Button variant="primary" onClick={() => navigate(`/openings/${id}?tab=drill`)}>🎯 Drill</Button>
                      <Button onClick={() => navigate(`/openings/${id}?tab=playout`)}>🤖 Play-out</Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-cm-muted">The lesson for this opening is coming in a later update.</p>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/openings/review" className="block rounded-lg bg-cm-panel p-4 hover:bg-cm-panel2">
          <p className="text-lg font-bold">🔁 Review {due > 0 && <Badge tone="yellow">{due} due</Badge>}</p>
          <p className="text-sm text-cm-muted">Spaced repetition: moves you studied come back just before you forget them.</p>
        </Link>
        <Link to="/openings/recognize" className="block rounded-lg bg-cm-panel p-4 hover:bg-cm-panel2">
          <p className="text-lg font-bold">❓ Recognize</p>
          <p className="text-sm text-cm-muted">Quiz: see the moves, name the opening. Covers all {CATALOG.length} openings.</p>
        </Link>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'path', label: 'My path' },
          { value: 'all', label: 'All openings' },
        ]}
      />

      {view === 'path' ? (
        <Card
          title="Learning path"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setOrder(() => DEFAULT_PATH.map((s) => s.id))}>
              Reset order
            </Button>
          }
        >
          <p className="mb-3 text-sm text-cm-muted">
            You study one step at a time. A step unlocks when every opening before it is mastered (90%+ in drills on {MASTERY_DAYS} different days).
            Use the arrows to change the order.
          </p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-2 rounded-lg p-2 ${s === currentStep ? 'bg-cm-panel2' : ''}`}>
                <span className="w-7 shrink-0 text-center font-bold text-cm-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {s.openings.map((id) => (
                      <Link key={id} to={`/openings/${id}`} className="inline-flex items-center gap-1.5 rounded bg-cm-bg px-2 py-1 text-sm font-semibold hover:bg-cm-hover">
                        {statusIcon(status[id])} {entry(id)?.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button aria-label="Move up" className="h-9 w-9 rounded text-cm-muted hover:bg-cm-hover disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button aria-label="Move down" className="h-9 w-9 rounded text-cm-muted hover:bg-cm-hover disabled:opacity-30" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>▼</button>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        (['white', 'black-e4', 'black-d4'] as Group[]).map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-lg font-bold">{GROUP_LABEL[g]}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CATALOG.filter((c) => c.group === g).map((c) => {
                const st = status[c.id] ?? (c.lesson ? 'locked' : 'coming-soon');
                const p = progressOf(all, c.id);
                return (
                  <Link key={c.id} to={`/openings/${c.id}`} className="block rounded-lg bg-cm-panel p-3 hover:bg-cm-panel2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{c.name}</p>
                      <Badge>{c.eco}</Badge>
                    </div>
                    <div className="mt-1">
                      <Badge tone={STATUS_BADGE[st].tone}>{STATUS_BADGE[st].label}</Badge>
                    </div>
                    {c.lesson && st !== 'coming-soon' && (
                      <Progress value={masteryPercent(p, c.lesson.lines.length)} className="mt-2" />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function statusIcon(s: OpeningStatus | undefined) {
  if (s === 'mastered') return '✅';
  if (s === 'current') return '▶️';
  if (s === 'coming-soon') return '⏳';
  return '🔒';
}
