import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Engine, parseInfo, type UciTransport } from '../src/engine/engine';

const require = createRequire(import.meta.url);

function nodeTransport(): UciTransport {
  let cb: (l: string) => void = () => {};
  const sf = require('stockfish')('lite-single', (line: string) => cb(line));
  return { send: (c) => sf.processCommand(c), onLine: (f) => (cb = f), terminate: () => sf.terminate() };
}

describe('engine', () => {
  it('parses scores from White’s point of view', () => {
    const l = parseInfo('info depth 8 multipv 2 score cp -45 nodes 1 pv g8f6 e1g1', false)!;
    expect(l).toMatchObject({ depth: 8, multipv: 2, score: { cp: 45, mate: null }, pv: ['g8f6', 'e1g1'] });
    const m = parseInfo('info depth 3 multipv 1 score mate 2 pv d1h5', true)!;
    expect(m.score.mate).toBe(2);
  });

  it('finds mate in one with real Stockfish', async () => {
    const e = new Engine(nodeTransport());
    const lines = await e.analyse('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 6, multipv: 2 });
    expect(lines[0].pv[0]).toBe('d1d8');
    expect(lines[0].score.mate).toBe(1);
    expect(lines.length).toBe(2);
    // A second search after the first one still works.
    const again = await e.analyseLatest('6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1', { depth: 4 });
    expect(again.length).toBe(1);
    e.terminate();
  }, 30000);
});
