import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { LineViewer } from '../../chess/board/LineViewer';
import { depthForRating, isStudentMove, lineNodes } from '../../data/openings/build';
import { entry, type CatalogEntry } from '../../data/openings/catalog';
import type { OpeningLesson } from '../../data/openings/types';
import { pgnForName } from '../../data/eco';
import {
  MASTERY_DAYS,
  MASTERY_SCORE,
  goodDays,
  isMastered,
  masteryPercent,
  openingProgressSlot,
  pathSlot,
  pathStatus,
  progressOf,
  recordDrill,
} from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { today } from '../../progress/srs';
import { Badge, Button, Card, Progress, Tip } from '../../ui/kit';
import { DrillSession, type DrillItem, type DrillResult } from './DrillSession';
import { LearnMode } from './LearnMode';
import { PlayOut } from './PlayOut';

type Tab = 'learn' | 'drill' | 'playout' | 'plan' | 'traps' | 'games';

const TABS: { id: Tab; label: string; needsUnlock?: boolean }[] = [
  { id: 'learn', label: '📖 Learn' },
  { id: 'drill', label: '🎯 Drill', needsUnlock: true },
  { id: 'playout', label: '🤖 Play-out', needsUnlock: true },
  { id: 'plan', label: '🧭 The Plan' },
  { id: 'traps', label: '🪤 Traps' },
  { id: 'games', label: '🏆 Model games' },
];

export function OpeningPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const e = entry(id);
  const [order] = useSlot(pathSlot);
  const [all] = useSlot(openingProgressSlot);
  if (!e) return <p>Opening not found. <Link className="underline" to="/openings">Back to the library</Link></p>;
  const status = pathStatus(order, all).status[e.id];
  const unlocked = status === 'current' || status === 'mastered';
  const tab = (params.get('tab') as Tab) || 'learn';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2">
        <Link to="/openings" className="text-cm-muted hover:text-white">← Library</Link>
        <h1 className="me-2 text-2xl font-extrabold">{e.name}</h1>
        <Badge>{e.eco}</Badge>
        <Badge>{e.side === 'white' ? '♔ as White' : '♚ as Black'}</Badge>
        {status === 'mastered' && <Badge tone="green">Mastered</Badge>}
        {status === 'current' && <Badge tone="yellow">Studying now</Badge>}
        {status === 'locked' && <Badge>🔒 Locked</Badge>}
      </div>
      {!e.lesson ? (
        <ComingSoon e={e} />
      ) : (
        <>
          {!unlocked && (
            <div className="mx-auto max-w-[1200px]">
              <Tip>
                🔒 You study one opening at a time. This one unlocks when you master the openings before it in your path.
                You can still read the lesson, the plan, the traps and the model games.
              </Tip>
            </div>
          )}
          <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const disabled = t.needsUnlock && !unlocked;
              return (
                <button
                  key={t.id}
                  disabled={disabled}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${tab === t.id ? 'bg-cm-panel2 text-white' : 'text-cm-muted hover:text-white'} disabled:opacity-40`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {tab === 'learn' && <LearnMode lesson={e.lesson} />}
          {tab === 'drill' && unlocked && <DrillTab lesson={e.lesson} />}
          {tab === 'playout' && unlocked && <PlayOut lesson={e.lesson} />}
          {tab === 'plan' && <PlanTab lesson={e.lesson} />}
          {tab === 'traps' && <TrapsTab lesson={e.lesson} />}
          {tab === 'games' && <GamesTab lesson={e.lesson} />}
        </>
      )}
    </div>
  );
}

function fullDrillItems(lesson: OpeningLesson, rating: number): DrillItem[] {
  const depth = depthForRating(rating);
  const main = lesson.lines.filter((l) => l.main);
  const rest = lesson.lines.filter((l) => !l.main).sort(() => Math.random() - 0.5);
  return [...main, ...rest]
    .map((l) => ({ lessonId: lesson.id, lineId: l.id, askFrom: 1, endPly: Math.min(depth, l.moves.length) }))
    .filter((it) => lineNodes(lesson, it.lineId, it.endPly).some((n) => isStudentMove(lesson, n.ply)));
}

function DrillTab({ lesson }: { lesson: OpeningLesson }) {
  const [settings] = useSlot(settingsSlot);
  const [all] = useSlot(openingProgressSlot);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<DrillResult | null>(null);
  const p = progressOf(all, lesson.id);
  const days = goodDays(p);
  const todayScore = p.drillDays[today()];
  const items = fullDrillItems(lesson, settings.rating);

  if (running) {
    return (
      <DrillSession
        items={items}
        title={`${lesson.name} drill`}
        onFinish={(r) => {
          recordDrill(lesson.id, r.asked ? r.correct / r.asked : 0);
          setLast(r);
        }}
        onExit={() => setRunning(false)}
      />
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Card title="Drill from memory">
        <p className="mb-3 text-sm text-cm-muted">
          The app plays your opponent’s moves; you play yours. One full drill goes through all {items.length} lines once,
          about {depthForRating(settings.rating) / 2} moves deep at your rating.
        </p>
        <p className="mb-1 text-sm font-semibold">
          Mastery: {Math.min(days.length, MASTERY_DAYS)} of {MASTERY_DAYS} days at {MASTERY_SCORE * 100}%+
        </p>
        <Progress value={masteryPercent(p, lesson.lines.length)} className="mb-2" />
        <div className="mb-3 flex gap-1.5">
          {Array.from({ length: MASTERY_DAYS }, (_, i) => (
            <span key={i} className={`rounded px-2 py-1 text-xs font-bold ${days[i] ? 'bg-cm-green/25 text-cm-green-light' : 'bg-cm-panel2 text-cm-faint'}`}>
              {days[i] ? `✓ ${days[i]}` : `Day ${i + 1}`}
            </span>
          ))}
        </div>
        {todayScore !== undefined && (
          <p className="mb-3 text-sm">
            Today’s best: <b>{Math.round(todayScore * 100)}%</b>
            {todayScore >= MASTERY_SCORE ? ' ✓ counts for today. Come back tomorrow for the next day.' : ' (90% needed to count)'}
          </p>
        )}
        {isMastered(p) && <p className="mb-3 text-sm text-cm-green-light">🏆 Mastered! It stays in your Review queue so you don’t forget it.</p>}
        <Button variant="primary" size="lg" className="w-full" onClick={() => setRunning(true)}>
          Start drill
        </Button>
      </Card>
      {last && (
        <Card>
          <p className="text-sm">
            Last drill: <b>{last.asked ? Math.round((last.correct / last.asked) * 100) : 0}%</b> ({last.correct}/{last.asked}).
          </p>
        </Card>
      )}
    </div>
  );
}

function PlanTab({ lesson }: { lesson: OpeningLesson }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-3 lg:grid-cols-2">
      <Card title="Character">
        <div className="mb-2 flex gap-1.5">
          {lesson.style.map((s) => (
            <Badge key={s} tone="green">{s}</Badge>
          ))}
        </div>
        <p className="text-[15px]">{lesson.character}</p>
      </Card>
      <Card title="THE PLAN">
        <p className="mb-3 text-[15px]">{lesson.plan.summary}</p>
        <p className="mb-1 text-sm font-bold">Pawn structure</p>
        <p className="text-sm text-cm-muted">{lesson.plan.pawnStructure}</p>
      </Card>
      <Card title="Where each piece belongs">
        <div className="divide-y divide-cm-line">
          {lesson.plan.pieces.map((p) => (
            <div key={p.piece} className="py-2 text-sm">
              <p><b>{p.piece}</b>: <span className="text-cm-green-light">{p.where}</span></p>
              <p className="text-cm-muted">{p.why}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Goals checklist">
        <ul className="space-y-1.5 text-sm">
          {lesson.plan.goals.map((g) => (
            <li key={g}>✅ {g}</li>
          ))}
        </ul>
      </Card>
      <Card title="What if they go off-book?" className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {lesson.offBook.map((o) => (
            <div key={o.when} className="rounded-lg bg-cm-panel2 p-3 text-sm">
              <p className="font-bold">{o.when}</p>
              <p className="text-cm-muted">{o.advice}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-cm-muted">
          Always fall back on the basics: control the center, develop knights and bishops, castle, and don’t move the same piece twice without a reason.
        </p>
      </Card>
    </div>
  );
}

function TrapsTab({ lesson }: { lesson: OpeningLesson }) {
  const [sel, setSel] = useState(lesson.traps[0]?.id);
  const trap = lesson.traps.find((t) => t.id === sel);
  if (!trap) return <p className="text-cm-muted">No traps listed yet.</p>;
  return (
    <LineViewer
      key={trap.id}
      moves={trap.moves}
      orientation={lesson.side}
      highlightIndex={trap.mistakeAt}
      comments={{ [trap.mistakeAt]: 'This is the mistake.', [trap.moves.length - 1]: 'And this is the punishment.' }}
      header={
        <>
          <Card title="Traps">
            <div className="flex flex-wrap gap-1.5">
              {lesson.traps.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSel(t.id)}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${t.id === sel ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted hover:text-white'}`}
                >
                  {t.kind === 'set' ? '🎣 ' : '⚠️ '}
                  {t.name}
                </button>
              ))}
            </div>
          </Card>
          <Card title={trap.name}>
            <p className="mb-2 text-sm">{trap.summary}</p>
            {trap.howToSet && (
              <p className="mb-2 text-sm"><b className="text-cm-green-light">How to set it:</b> {trap.howToSet}</p>
            )}
            <p className="text-sm"><b className="text-cm-yellow">How to avoid it:</b> {trap.howToAvoid}</p>
          </Card>
        </>
      }
    />
  );
}

function GamesTab({ lesson }: { lesson: OpeningLesson }) {
  const [sel, setSel] = useState(lesson.modelGames[0]?.id);
  const g = lesson.modelGames.find((x) => x.id === sel);
  if (!g) return <p className="text-cm-muted">No model games yet.</p>;
  return (
    <LineViewer
      key={g.id}
      moves={g.moves}
      comments={g.comments}
      orientation={lesson.side}
      header={
        <>
          {lesson.modelGames.length > 1 && (
            <Card>
              <div className="flex flex-wrap gap-1.5">
                {lesson.modelGames.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setSel(x.id)}
                    className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${x.id === sel ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted hover:text-white'}`}
                  >
                    {x.title}
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card title={g.title}>
            <p className="text-sm">
              <b>{g.white}</b> vs <b>{g.black}</b>, {g.event ? `${g.event}, ` : ''}{g.illustrative ? 'teaching game' : g.year} · {g.result}
            </p>
            <p className="mt-2 text-sm text-cm-muted">{g.lesson}</p>
          </Card>
        </>
      }
    />
  );
}

function ComingSoon({ e }: { e: CatalogEntry }) {
  const navigate = useNavigate();
  const [moves, setMoves] = useState<string[] | null>(null);
  const [variation, setVariation] = useState(e.variations[0]);
  useEffect(() => {
    pgnForName(variation).then((sans) => setMoves(sans));
  }, [variation]);
  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-[1200px]">
        <Tip>
          The full lesson for {e.name} is coming in a later update. For now you can see its key moves, and it already appears in the
          Recognize quiz.
        </Tip>
      </div>
      {moves && (
        <LineViewer
          moves={moves}
          orientation={e.side}
          initialIndex={moves.length}
          header={
            <Card title="Key variations">
              <div className="flex flex-wrap gap-1.5">
                {e.variations.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariation(v)}
                    className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${v === variation ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted hover:text-white'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Card>
          }
          extra={<Button size="sm" onClick={() => navigate('/openings')}>Back to the library</Button>}
        />
      )}
    </div>
  );
}
