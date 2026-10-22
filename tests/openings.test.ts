import { describe, expect, it } from 'vitest';
import eco from '../src/data/eco.json';
import { CATALOG, DEFAULT_PATH, LESSONS } from '../src/data/openings/catalog';
import { validateLesson } from '../src/data/openings/validate';

const ECO = eco as unknown as Record<string, [string, string, string]>;

describe('opening data quality', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.name}: legal, explained, official names, complete`, () => {
      expect(validateLesson(lesson)).toEqual([]);
    });
  }

  it('every catalog entry with a lesson matches it', () => {
    for (const c of CATALOG) {
      if (!c.lesson) continue;
      expect(c.lesson.id).toBe(c.id);
      expect(c.lesson.side).toBe(c.side);
      expect(c.lesson.group).toBe(c.group);
    }
  });

  it('catalog: every variation name exists in the official opening list', () => {
    const names = new Set(Object.values(ECO).map((v) => v[1]));
    for (const c of CATALOG) for (const v of c.variations) expect(names.has(v), v).toBe(true);
  });

  it('the learning path covers known openings, each once', () => {
    const ids = DEFAULT_PATH.flatMap((s) => s.openings);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(CATALOG.some((c) => c.id === id), id).toBe(true);
    expect(DEFAULT_PATH).toHaveLength(15);
  });
});
