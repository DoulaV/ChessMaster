// Spaced-repetition review of opening moves from every opening you have drilled.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { findNode } from '../../data/openings/build';
import { lesson as lessonById } from '../../data/openings/catalog';
import { dueCards, openingCardsSlot } from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { Button, Card } from '../../ui/kit';
import { DrillSession, type DrillItem, type DrillResult } from './DrillSession';

const MAX = 20;

export function ReviewPage() {
  const [cards] = useSlot(openingCardsSlot);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<DrillResult | null>(null);
  const items = useMemo<DrillItem[]>(() => {
    const out: DrillItem[] = [];
    for (const id of dueCards()) {
      const [lessonId, key] = id.split('|');
      const lesson = lessonById(lessonId);
      const node = lesson && findNode(lesson, key);
      if (!lesson || !node) continue;
      out.push({ lessonId, lineId: node.lines[0], askFrom: node.ply, endPly: node.ply });
      if (out.length >= MAX) break;
    }
    return out;
    // Recompute when cards change, but not while a session is running.
  }, [running ? null : cards]);

  if (running && items.length) {
    return (
      <DrillSession
        items={items}
        title="Review"
        onFinish={setDone}
        onExit={() => setRunning(false)}
      />
    );
  }

  const total = Object.keys(cards).length;
  const nextDue = Object.values(cards).map((c) => c.due).sort()[0];
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link to="/openings" className="text-sm text-cm-muted hover:text-white">← Library</Link>
      <h1 className="text-2xl font-extrabold">Review</h1>
      <Card>
        {items.length ? (
          <>
            <p className="mb-3">
              <b>{items.length}</b> move{items.length > 1 ? 's' : ''} to review today. Each one takes a few seconds.
            </p>
            <Button variant="primary" size="lg" className="w-full" onClick={() => { setDone(null); setRunning(true); }}>
              Start review
            </Button>
          </>
        ) : (
          <p className="text-cm-muted">
            {total === 0
              ? 'Nothing to review yet. Drill an opening first: every move you drill joins your review queue.'
              : `All done for today! ${total} moves in your queue. Next review: ${nextDue}.`}
          </p>
        )}
      </Card>
      {done && (
        <Card>
          <p className="text-sm">Last review: {done.correct} of {done.asked} right.</p>
        </Card>
      )}
    </div>
  );
}
