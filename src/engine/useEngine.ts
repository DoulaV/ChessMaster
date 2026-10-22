import { useEffect, useState } from 'react';
import { getBackgroundEngine, getEngine, type EngineLine } from './engine';

/** Live engine lines for a position. Re-runs whenever the position changes. */
export function useEngineLines(
  fen: string | null,
  { depth = 16, multipv = 3, background = false } = {},
) {
  const [lines, setLines] = useState<EngineLine[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!fen) {
      setLines([]);
      return;
    }
    let alive = true;
    const engine = background ? getBackgroundEngine() : getEngine();
    setLines([]);
    setRunning(true);
    engine
      .analyseLatest(fen, {
        depth,
        multipv,
        onUpdate: (l) => alive && setLines(l),
      })
      .then((l) => {
        if (!alive) return;
        if (l.length) setLines(l);
        setRunning(false);
      });
    return () => {
      alive = false;
    };
  }, [fen, depth, multipv, background]);

  return { lines, running };
}
