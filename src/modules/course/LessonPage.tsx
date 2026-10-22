import { Chess } from 'chess.js';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ARROW, Board, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { LineViewer } from '../../chess/board/LineViewer';
import { moveIdeas } from '../../chess/explain';
import { parseUci, pvToSan } from '../../chess/utils';
import { lessonById } from '../../data/course/units';
import type { CourseLesson } from '../../data/course/types';
import {
  GUIDED_COUNT,
  PASS_MARK,
  TEST_COUNT,
  addToReview,
  canTestOut,
  courseSlot,
  isComplete,
  isUnlocked,
  lessonState,
  nextStep,
  setLesson,
  type LessonStep,
} from '../../progress/course';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { startRating, tacticsSlot } from '../../progress/tactics';
import { BoardLayout } from '../../ui/BoardLayout';
import { Button, Card, Tip } from '../../ui/kit';
import { ExerciseRunner, type RunResult } from './ExerciseRunner';
import { itemKey, loadItems, type CourseItem } from './items';

const STEPS: { id: LessonStep; label: string }[] = [
  { id: 'learn', label: '1. Learn' },
  { id: 'guided', label: '2. Practice with the coach' },
  { id: 'test', label: '3. Test' },
  { id: 'game', label: '4. Use it in a game' },
  { id: 'done', label: '5. Homework' },
];

export function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const [course] = useSlot(courseSlot);
  if (!lesson) return <p>Lesson not found. <Link className="underline" to="/">Back</Link></p>;
  if (!isUnlocked(course, lesson.id)) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <Tip>🔒 Lesson {lesson.id} opens when you finish the lessons before it. One step at a time.</Tip>
        <Link to="/"><Button>Back to the course</Button></Link>
      </div>
    );
  }
  return <Lesson key={lesson.id} lesson={lesson} />;
}

function useRating() {
  const [settings] = useSlot(settingsSlot);
  const [tactics] = useSlot(tacticsSlot);
  return tactics.rating || startRating(settings.rating);
}

function Lesson({ lesson }: { lesson: CourseLesson }) {
  const [course] = useSlot(courseSlot);
  const navigate = useNavigate();
  const p = lessonState(course, lesson.id);
  const step = nextStep(course, lesson.id);
  const [view, setView] = useState<LessonStep>(step);
  const [running, setRunning] = useState<null | { mode: 'guided' | 'test'; items: CourseItem[] }>(null);
  const [lastTest, setLastTest] = useState<{ right: number; total: number } | null>(null);
  const rating = useRating();
  const testOut = canTestOut(course, lesson.id) && !p.learned && !p.passed;
  const reached = (s: LessonStep) => STEPS.findIndex((x) => x.id === s) <= STEPS.findIndex((x) => x.id === step) || isComplete(p);

  async function start(mode: 'guided' | 'test') {
    const avoid = new Set(course.review.map((r) => r.key));
    // Tests are a little easier than your puzzle rating, so passing means you really know it.
    const items = await loadItems(lesson.exercises, mode === 'guided' ? GUIDED_COUNT : TEST_COUNT, mode === 'test' ? rating - 50 : rating - 100, avoid);
    setRunning({ mode, items });
  }

  function finish(mode: 'guided' | 'test', results: RunResult[]) {
    setRunning(null);
    addToReview(lesson.id, results.filter((r) => !r.ok).map((r) => ({ key: itemKey(r.item), item: r.item })));
    if (mode === 'guided') {
      setLesson(lesson.id, (x) => ({ ...x, guided: Math.max(x.guided, GUIDED_COUNT) }));
      setView('test');
      return;
    }
    const right = results.filter((r) => r.ok).length;
    const score = right / results.length;
    setLastTest({ right, total: results.length });
    const testedOut = !p.learned;
    setLesson(lesson.id, (x) => ({
      ...x,
      testBest: Math.max(x.testBest ?? 0, score),
      passed: x.passed || score >= PASS_MARK,
      testedOut: x.testedOut || (score >= PASS_MARK && testedOut),
    }));
    setView(score >= PASS_MARK ? (testedOut ? 'done' : 'game') : 'test');
  }

  if (running) {
    return (
      <ExerciseRunner
        items={running.items}
        mode={running.mode}
        title={`${lesson.id} ${lesson.title}: ${running.mode === 'guided' ? 'practice with the coach' : 'test'}`}
        coachQuestions={lesson.coachQuestions}
        onFinish={(r) => finish(running.mode, r)}
        onExit={() => setRunning(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div>
        <Link to="/" className="text-sm text-cm-muted hover:text-white">← Course</Link>
        <h1 className="text-2xl font-extrabold">Lesson {lesson.id}: {lesson.title}</h1>
        <p className="text-cm-muted">🎯 {lesson.goal}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s) => (
          <button
            key={s.id}
            disabled={!reached(s.id)}
            onClick={() => setView(s.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${view === s.id ? 'bg-cm-panel2 text-white' : 'text-cm-muted hover:text-white'} disabled:opacity-35`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {testOut && view === 'learn' && (
        <Tip>
          Your placement test says you already know this area. You can <button className="underline" onClick={() => start('test')}>take the test now</button>: pass it ({Math.round(PASS_MARK * 100)}%) and the lesson is done.
        </Tip>
      )}

      {view === 'learn' && <LearnStep lesson={lesson} rating={rating} onDone={() => { setLesson(lesson.id, (x) => ({ ...x, learned: true })); setView('guided'); }} learned={p.learned} />}

      {view === 'guided' && (
        <Card title="Practice with the coach">
          <p className="mb-3 text-sm text-cm-muted">
            {GUIDED_COUNT} exercises. Before you answer, the coach asks you the questions a strong player asks. Use as many as you need: this part is for learning, not for a score.
          </p>
          <ul className="mb-3 list-disc space-y-1 ps-5 text-sm">
            {lesson.coachQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <Button variant="primary" size="lg" onClick={() => start('guided')}>{p.guided >= GUIDED_COUNT ? 'Practice again' : 'Start practice'}</Button>
        </Card>
      )}

      {view === 'test' && (
        <Card title="Test">
          <p className="mb-2 text-sm text-cm-muted">
            {TEST_COUNT} new exercises, no help. You need {Math.round(PASS_MARK * TEST_COUNT)} of {TEST_COUNT} to pass. Missed ones go to your review queue.
          </p>
          {lastTest && (
            <p className={`mb-2 text-lg font-bold ${lastTest.right / lastTest.total >= PASS_MARK ? 'text-cm-green-light' : 'text-red-400'}`}>
              {lastTest.right} / {lastTest.total}: {lastTest.right / lastTest.total >= PASS_MARK ? 'passed!' : 'not yet. Look at the rules again, then retry with new positions.'}
            </p>
          )}
          {p.testBest !== null && <p className="mb-2 text-sm">Best so far: {Math.round(p.testBest * 100)}%</p>}
          <Button variant="primary" size="lg" onClick={() => start('test')}>{p.passed ? 'Take it again' : 'Start the test'}</Button>
        </Card>
      )}

      {view === 'game' && (
        <Card title="Use it in a real game">
          <p className="mb-2">Play one full game against a bot slightly stronger than you, with the Full coach.</p>
          <p className="mb-3 rounded-lg bg-cm-panel2 p-3 text-sm"><b>Focus for this game:</b> {lesson.gameFocus}</p>
          {p.gamePlayed ? <p className="mb-2 text-cm-green-light">✓ Game played.</p> : null}
          <Button variant="primary" size="lg" onClick={() => navigate(`/practice?lesson=${lesson.id}`)}>Play the game</Button>
        </Card>
      )}

      {view === 'done' && (
        <Card title={isComplete(p) ? '✅ Lesson complete' : 'Homework'}>
          <p className="mb-3 rounded-lg bg-cm-panel2 p-3"><b>Your homework this week:</b> {lesson.homework}</p>
          <p className="mb-3 text-sm text-cm-muted">The exercises you missed come back in your daily warm-up, so the idea sticks.</p>
          <Link to="/"><Button variant="primary">Back to the course</Button></Link>
        </Card>
      )}

      <p className="text-xs text-cm-faint">Status: {p.learned ? '✓ learned' : 'not learned'} · practice {Math.min(p.guided, GUIDED_COUNT)}/{GUIDED_COUNT} · test {p.passed ? '✓ passed' : 'not passed'}{p.testedOut ? ' (tested out)' : ''} · game {p.gamePlayed ? '✓' : 'not yet'}</p>
    </div>
  );
}

function LearnStep({ lesson, rating, onDone, learned }: { lesson: CourseLesson; rating: number; onDone: () => void; learned: boolean }) {
  const [examples, setExamples] = useState<CourseItem[]>([]);
  const [ex, setEx] = useState(0);
  useEffect(() => {
    loadItems(lesson.exercises, 2, rating - 200, new Set(), true).then(setExamples);
  }, [lesson.id]);
  const item = examples[ex];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="The idea">
          <div className="space-y-2 text-[15px]">
            {lesson.concept.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </Card>
        <Card title="Remember">
          <ol className="list-decimal space-y-1.5 ps-5 text-[15px]">
            {lesson.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </Card>
      </div>
      {item && (
        <div>
          <h2 className="mb-2 text-lg font-bold">Worked example {ex + 1} of {examples.length}</h2>
          <WorkedExample key={ex} item={item} footer={
            <div className="flex flex-wrap gap-2">
              {ex + 1 < examples.length ? (
                <Button variant="primary" onClick={() => setEx(ex + 1)}>Next example</Button>
              ) : (
                <Button variant="primary" onClick={onDone}>{learned ? 'Go to practice' : 'I understand: start practice'}</Button>
              )}
            </div>
          } />
        </div>
      )}
      {!examples.length && <Button variant="primary" onClick={onDone}>Continue</Button>}
    </div>
  );
}

/** An exercise with its answer shown and explained. */
function WorkedExample({ item, footer }: { item: CourseItem; footer: React.ReactNode }) {
  if (item.kind === 'puzzle') {
    const q = item.q;
    const sans = pvToSan(q.fen, q.moves);
    const c = new Chess(q.fen);
    const comments: Record<number, string> = {};
    q.moves.forEach((u, k) => {
      const before = c.fen();
      const m = c.move(parseUci(u));
      comments[k] = k === 0 ? `Your opponent plays ${m.san}. Now it’s your move: what would you play?` : k % 2 === 1 ? `${m.san}! ${moveIdeas(before, u)[0] ?? ''}` : `They answer ${m.san}.`;
    });
    const solver = new Chess(q.fen).turn() === 'w' ? 'black' : 'white';
    return <LineViewer moves={sans} comments={comments} startFen={q.fen} orientation={solver} extra={footer} />;
  }
  const orientation = (fen: string) => (fen.split(' ')[1] === 'w' ? 'white' : 'black');
  const highlights: Record<string, string> = {};
  const arrows: Arrow[] = [];
  let fen = item.q.fen;
  let text: React.ReactNode = null;
  if (item.kind === 'threat') {
    for (const a of item.q.answers) highlights[a] = HIGHLIGHT.danger;
    for (const [f, t] of item.q.threats) arrows.push({ startSquare: f, endSquare: t, color: ARROW.threat });
    text = <><p className="mb-1 font-bold">Your opponent just played {item.q.move[2]}.</p><p>{item.q.text}</p></>;
  } else if (item.kind === 'safe') {
    const c = new Chess(fen);
    const m = c.move(item.q.san);
    arrows.push({ startSquare: m.from, endSquare: m.to, color: item.q.verdict === 'safe' ? ARROW.good : ARROW.threat });
    text = (
      <>
        <p className="mb-1 font-bold">The move {item.q.san} is {item.q.verdict === 'safe' ? 'safe' : 'a blunder'}.</p>
        {item.q.text.map((t, k) => <p key={k}>{t}</p>)}
      </>
    );
  } else {
    for (const a of item.q.answers) highlights[a] = HIGHLIGHT.warn;
    text = <p>The highlighted pieces have no defender at all. These are the loose pieces: the first targets for forks and double attacks.</p>;
    fen = item.q.fen;
  }
  return (
    <BoardLayout
      board={<Board fen={fen} orientation={item.kind === 'hanging' ? 'white' : orientation(fen)} movable="none" highlights={highlights} arrows={arrows} drawArrows={false} />}
      panel={
        <>
          <Card><div className="space-y-1 text-[15px]">{text}</div></Card>
          {footer}
        </>
      }
    />
  );
}

