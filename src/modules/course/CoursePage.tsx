import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MISTAKE_LABEL, type MistakeTag } from '../../chess/explain';
import { UNITS, lessonById } from '../../data/course/units';
import type { Area } from '../../data/course/types';
import {
  courseSlot,
  currentLesson,
  dueReview,
  gradeReview,
  isComplete,
  isUnlocked,
  lessonState,
  lessonsForTags,
  nextStep,
} from '../../progress/course';
import { localDate } from '../../progress/dashboard';
import { dueCards } from '../../progress/openings';
import { practiceSlot } from '../../progress/practice';
import { puzzlesSlot } from '../../progress/puzzles';
import { reviewsSlot } from '../../progress/reviews';
import { isDue, today } from '../../progress/srs';
import { update, useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { startRating, tacticsSlot } from '../../progress/tactics';
import { Badge, Button, Card, Progress } from '../../ui/kit';
import { ExerciseRunner, type RunResult } from './ExerciseRunner';
import { itemKey, loadItems, type CourseItem } from './items';

const AREA_LABEL: Partial<Record<Area, string>> = { safety: 'Safety (threats and loose pieces)', tactics: 'Tactics' };

const STEP_LABEL = { learn: 'Learn the idea', guided: 'Practice with the coach', test: 'Take the test', game: 'Play the lesson game', done: 'Done' } as const;

export function CoursePage() {
  const [course] = useSlot(courseSlot);
  const [settings] = useSlot(settingsSlot);
  const [tactics] = useSlot(tacticsSlot);
  const [practice] = useSlot(practiceSlot);
  const [reviews] = useSlot(reviewsSlot);
  const [personal] = useSlot(puzzlesSlot);
  const navigate = useNavigate();
  const [mode, setMode] = useState<null | 'placement' | 'warmup'>(null);
  const [runItems, setRunItems] = useState<CourseItem[]>([]);
  const rating = tactics.rating || startRating(settings.rating);

  const lesson = currentLesson(course);
  const step = lesson ? nextStep(course, lesson.id) : 'done';
  const due = dueReview(course);
  const day = course.days[today()] ?? { warmup: 0, lesson: 0, game: 0 };
  const playedToday = practice.some((g) => localDate(g.endedAt) === today()) || day.game > 0;
  const allTags: MistakeTag[] = [...practice.flatMap((g) => g.tags), ...Object.values(reviews).flatMap((r) => r.tags)];
  const tagCounts = [...allTags.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<MistakeTag, number>()).entries()].sort((a, b) => b[1] - a[1]);

  async function startPlacement() {
    const parts = await Promise.all([
      loadItems({ kind: 'threats' }, 4, 1000),
      loadItems({ kind: 'safe' }, 4, 1000),
      loadItems({ kind: 'hanging' }, 2, 1000),
      loadItems({ kind: 'puzzles', themes: ['defensive-move'] }, 2, 1000),
      loadItems({ kind: 'puzzles', themes: ['fork', 'pin', 'skewer', 'discovered-attack', 'back-rank-mate', 'mate-in-1'] }, 6, 1000),
      loadItems({ kind: 'puzzles', themes: ['removing-defender', 'mate-in-2'] }, 2, 1100),
    ]);
    setRunItems(parts.flat());
    setMode('placement');
  }

  function finishPlacement(results: RunResult[]) {
    const isSafety = (r: RunResult) => r.item.kind !== 'puzzle' || r.item.q.theme === 'defensive-move';
    const score = (rs: RunResult[]) => (rs.length ? rs.filter((r) => r.ok).length / rs.length : 0);
    const safety = score(results.filter(isSafety));
    const tacticsScore = score(results.filter((r) => !isSafety(r)));
    update(courseSlot, (s) => ({ ...s, placement: { done: true, skipped: false, date: today(), scores: { safety, tactics: tacticsScore } } }));
    setMode(null);
  }

  async function startWarmup() {
    let items = due.slice(0, 6).map((r) => r.item as CourseItem);
    if (!items.length) {
      // Nothing due: a few exercises from lessons you've finished (or from the current one).
      const done = UNITS.flatMap((u) => u.lessons).filter((l) => isComplete(lessonState(course, l.id)));
      const source = (done.length ? done[Math.floor(Math.random() * done.length)] : lesson)?.exercises;
      if (source) items = await loadItems(source, 5, rating - 100);
    }
    setRunItems(items);
    setMode('warmup');
  }

  if (mode === 'placement') {
    return <ExerciseRunner items={runItems} mode="placement" title="Placement test" onFinish={finishPlacement} onExit={() => setMode(null)} />;
  }
  if (mode === 'warmup') {
    return (
      <ExerciseRunner
        items={runItems}
        mode="review"
        title="Warm-up"
        onFinish={(results) => {
          const keys = new Set(due.map((d) => d.key));
          for (const r of results) {
            const k = itemKey(r.item);
            if (keys.has(k)) gradeReview(k, r.ok);
          }
          if (!results.some((r) => keys.has(itemKey(r.item)))) update(courseSlot, (s) => ({ ...s, days: { ...s.days, [today()]: { ...(s.days[today()] ?? { warmup: 0, lesson: 0, game: 0 }), warmup: 1 } } }));
          setMode(null);
        }}
        onExit={() => setMode(null)}
      />
    );
  }

  const session = [
    { id: 'warmup', title: 'Warm-up: review your misses', minutes: '5 to 10 min', done: day.warmup > 0, detail: due.length ? `${due.length} exercises due` : 'a few exercises from past lessons', go: startWarmup },
    {
      id: 'lesson',
      title: lesson ? `Lesson ${lesson.id}: ${STEP_LABEL[step]}` : 'All written lessons done',
      minutes: '15 to 20 min',
      done: day.lesson > 0,
      detail: lesson?.title ?? 'New units are coming',
      go: () => lesson && navigate(`/course/${lesson.id}`),
    },
    {
      id: 'game',
      title: 'Practice game with a focus',
      minutes: '15 to 20 min',
      done: playedToday,
      detail: lesson ? lesson.gameFocus : 'Use your checklist every move',
      go: () => navigate(lesson ? `/practice?lesson=${lesson.id}` : '/practice'),
    },
    { id: 'debrief', title: 'Debrief: read the coach’s notes', minutes: '5 min', done: playedToday && course.notes[0]?.date === today(), detail: 'Appears after your game', go: () => document.getElementById('coach-notes')?.scrollIntoView({ behavior: 'smooth' }) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Your coach</h1>
          <p className="text-cm-muted">From {settings.rating} to 1500, one lesson at a time.</p>
        </div>
        <div className="flex gap-1">
          <Link to="/progress" aria-label="Progress" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl">📈</Link>
          <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-lg bg-cm-panel text-xl lg:hidden">⚙️</Link>
        </div>
      </div>

      {!course.placement.done && !course.placement.skipped ? (
        <Card className="border-s-4 border-cm-green">
          <p className="text-lg font-bold">First, let me see how you play</p>
          <p className="mb-3 text-sm text-cm-muted">
            A 20-position placement test (about 10 minutes): spotting threats, safe moves, loose pieces and tactics. It tells me where you lose points, so you can test out of what you already know.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={startPlacement}>Start the placement test</Button>
            <Button variant="ghost" onClick={() => update(courseSlot, (s) => ({ ...s, placement: { ...s.placement, skipped: true } }))}>Skip, start at Lesson 1.1</Button>
          </div>
        </Card>
      ) : (
        <Card title="Today’s session (about 45 minutes)">
          <ol className="divide-y divide-cm-line">
            {session.map((s, k) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${s.done ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted'}`}>{s.done ? '✓' : k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{s.title}</span>
                  <span className="block text-xs text-cm-faint">{s.minutes} · {s.detail}</span>
                </span>
                {!s.done && <Button size="sm" variant={session.findIndex((x) => !x.done) === k ? 'primary' : 'secondary'} onClick={s.go}>Go</Button>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="🧑‍🏫 What I know about your chess">
          {course.placement.done ? (
            <div className="space-y-2">
              {(Object.entries(course.placement.scores) as [Area, number][]).map(([a, v]) => (
                <div key={a}>
                  <div className="flex justify-between text-sm"><span>{AREA_LABEL[a] ?? a}</span><span className="text-cm-muted">{Math.round(v * 100)}%</span></div>
                  <Progress value={v} />
                </div>
              ))}
              <p className="text-xs text-cm-faint">From your placement test. 80%+ in an area lets you test out of its lessons.</p>
            </div>
          ) : (
            <p className="text-sm text-cm-muted">Take the placement test so I can see your strengths.</p>
          )}
          {tagCounts.length > 0 && (
            <div className="mt-3 border-t border-cm-line pt-2">
              <p className="mb-1 text-sm font-bold">What costs you games</p>
              {tagCounts.slice(0, 3).map(([t, n]) => {
                const fix = lessonsForTags([t])[0];
                return (
                  <p key={t} className="text-sm">
                    {MISTAKE_LABEL[t]} ×{n}
                    {fix && <> → <Link className="underline" to={`/course/${fix}`}>Lesson {fix}</Link></>}
                  </p>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Extra reviews">
          <div className="space-y-2 text-sm">
            <p>⭐ Your own puzzles due: <b>{personal.filter((p) => isDue(p.card)).length}</b> · <Link className="underline" to="/tactics">practice</Link></p>
            <p>📖 Opening moves due: <b>{dueCards().length}</b> · <Link className="underline" to="/openings/review">review</Link></p>
            <p className="text-xs text-cm-faint">Optional extras. The course warm-up covers what matters most.</p>
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold">The course</h2>
        <div className="space-y-2">
          {UNITS.map((u) => {
            const done = u.lessons.filter((l) => isComplete(lessonState(course, l.id))).length;
            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">Unit {u.id}: {u.title} <span className="text-sm font-normal text-cm-faint">({u.range})</span></p>
                  {u.lessons.length ? <Badge tone={done === u.lessons.length ? 'green' : 'muted'}>{done}/{u.lessons.length}</Badge> : <Badge>Coming next</Badge>}
                </div>
                <p className="mb-2 text-sm text-cm-muted">{u.summary}</p>
                {u.lessons.length > 0 && (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {u.lessons.map((l) => {
                      const st = lessonState(course, l.id);
                      const open = isUnlocked(course, l.id);
                      const complete = isComplete(st);
                      return open ? (
                        <Link key={l.id} to={`/course/${l.id}`} className={`rounded-lg px-3 py-2 text-sm ${l.id === lesson?.id ? 'bg-cm-green/20 font-bold' : 'bg-cm-panel2 hover:bg-cm-hover'}`}>
                          {complete ? '✅' : '▶️'} {l.id} {l.title}
                        </Link>
                      ) : (
                        <span key={l.id} className="rounded-lg bg-cm-bg/50 px-3 py-2 text-sm text-cm-faint">🔒 {l.id} {l.title}</span>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <Card title="📝 Coach’s notes from your games">
        <div id="coach-notes" className="space-y-2">
          {course.notes.length === 0 && <p className="text-sm text-cm-muted">After each practice game or reviewed game, I’ll write what to work on here.</p>}
          {course.notes.slice(0, 8).map((n, k) => (
            <div key={k} className="rounded-lg bg-cm-panel2 p-2 text-sm">
              <p className="text-xs text-cm-faint">{n.date}</p>
              <p>{n.text}</p>
              {n.lessons.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {n.lessons.map((id) => (
                    <Link key={id} to={`/course/${id}`}><Badge tone="yellow">Lesson {id}: {lessonById(id)?.title}</Badge></Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
