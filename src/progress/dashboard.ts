// Everything the dashboard shows, worked out from the saved progress.
// Pure functions: pass in the saved data, get numbers back.

import { MISTAKE_LABEL, type MistakeTag } from '../chess/explain';
import { DEFAULT_PATH } from '../data/openings/catalog';
import type { BlunderStats } from './blunder';
import type { EndgameRecord } from './endgames';
import { isMastered, orderedPath, type OpeningProgress } from './openings';
import type { PracticeGame } from './practice';
import type { ReviewedGame } from './reviews';
import { addDays, today as todayFn } from './srs';
import type { TacticsStats } from './tactics';

export interface DashboardInput {
  rating: number;
  openings: Record<string, OpeningProgress>;
  path: string[];
  blunder: BlunderStats;
  tactics: TacticsStats;
  planning: { quiz: { right: number; total: number }; candidates: { rounds: number; foundBest: number }; lessonsRead: string[]; days: Record<string, unknown> };
  practice: PracticeGame[];
  reviews: Record<string, ReviewedGame>;
  endgames: { byId: Record<string, EndgameRecord>; days: Record<string, number> };
  today?: string;
}

/** Local YYYY-MM-DD of an ISO time. */
export const localDate = (iso: string) => todayFn(new Date(iso));

export function activeDays(d: DashboardInput): Set<string> {
  const days = new Set<string>();
  for (const p of Object.values(d.openings)) Object.keys(p.drillDays).forEach((x) => days.add(x));
  Object.keys(d.blunder.days).forEach((x) => days.add(x));
  Object.keys(d.tactics.days).forEach((x) => days.add(x));
  Object.keys(d.planning.days).forEach((x) => days.add(x));
  Object.keys(d.endgames.days).forEach((x) => days.add(x));
  d.practice.forEach((g) => days.add(localDate(g.endedAt)));
  return days;
}

/** Days in a row with any training, counting back from today (or yesterday if today isn't done yet). */
export function streak(d: DashboardInput): number {
  const days = activeDays(d);
  const t = d.today ?? todayFn();
  let cur = days.has(t) ? t : addDays(t, -1);
  let n = 0;
  while (days.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

export interface PlanItem {
  id: string;
  label: string;
  minutes: string;
  done: boolean;
  to: string;
}

export function todaysPlan(d: DashboardInput, currentOpening: string | null): PlanItem[] {
  const t = d.today ?? todayFn();
  const drilled = Object.values(d.openings).some((p) => p.drillDays[t] !== undefined);
  const bc = d.blunder.days[t];
  const blunderDone = !!bc && bc.spot + bc.safe + bc.hanging >= 10;
  const puzzles = d.tactics.days[t]?.done ?? 0;
  const played = d.practice.some((g) => localDate(g.endedAt) === t);
  return [
    { id: 'opening', label: 'Opening drill', minutes: '10 min', done: drilled, to: currentOpening ? `/openings/${currentOpening}?tab=drill` : '/openings' },
    { id: 'blunder', label: 'Blunder check (10 exercises)', minutes: '10 min', done: blunderDone, to: '/blunder-check' },
    { id: 'puzzles', label: `15 puzzles (${Math.min(15, puzzles)}/15)`, minutes: '10 to 15 min', done: puzzles >= 15, to: '/tactics' },
    { id: 'game', label: 'One practice game', minutes: '10 to 15 min', done: played, to: '/practice' },
  ];
}

export interface RoadmapItem {
  label: string;
  done: boolean;
  detail: string;
}

export interface Stage {
  id: string;
  title: string;
  range: [number, number];
  items: RoadmapItem[];
}

const pct = (r: number, t: number) => (t ? Math.round((r / t) * 100) : 0);

/** Last N games (practice and reviewed), newest first, as {blunders, date, label}. */
export function recentGames(d: DashboardInput) {
  const fromPractice = d.practice.map((g) => ({ at: g.endedAt, blunders: g.blunders, label: `vs Bot ${g.botRating}`, tags: g.tags }));
  const fromReviews = Object.values(d.reviews).map((g) => ({ at: g.playedAt, blunders: g.blunders, label: `vs ${g.opponent}`, tags: g.tags }));
  return [...fromPractice, ...fromReviews].sort((a, b) => b.at.localeCompare(a.at));
}

export function roadmap(d: DashboardInput): Stage[] {
  const steps = orderedPath(d.path.length ? d.path : DEFAULT_PATH.map((s) => s.id));
  const openingsDone = (from: number, to: number) => {
    const ids = steps.slice(from - 1, to).flatMap((s) => s.openings);
    const done = ids.filter((id) => d.openings[id] && isMastered(d.openings[id])).length;
    return { done: done === ids.length, detail: `${done} of ${ids.length} mastered` };
  };
  const theme = (id: string) => d.tactics.byTheme[id] ?? { right: 0, total: 0 };
  const themeOk = (id: string) => theme(id).total >= 20 && theme(id).right / theme(id).total >= 0.7;
  const eg = (id: string) => !!d.endgames.byId[id]?.mastered;
  const recent = recentGames(d).slice(0, 5);
  const avgBlunders = recent.length ? recent.reduce((s, g) => s + g.blunders, 0) / recent.length : null;
  const winsVs = (min: number, max: number) => d.practice.filter((g) => g.result === 'win' && g.takebacks === 0 && g.botRating >= min && g.botRating <= max).length;
  const s1 = openingsDone(1, 3);
  const s2 = openingsDone(4, 8);
  const s3 = openingsDone(9, 12);
  const s4 = openingsDone(13, 15);
  return [
    {
      id: 'stage-1',
      title: 'Stop hanging pieces',
      range: [800, 1000],
      items: [
        { label: 'Blunder check drills at 70%+', done: d.blunder.spot.total >= 30 && d.blunder.safe.total >= 30 && d.blunder.spot.right / d.blunder.spot.total >= 0.7 && d.blunder.safe.right / d.blunder.safe.total >= 0.7, detail: `threats ${pct(d.blunder.spot.right, d.blunder.spot.total)}% (${d.blunder.spot.total}), safety ${pct(d.blunder.safe.right, d.blunder.safe.total)}% (${d.blunder.safe.total}); 30 of each needed` },
        { label: '1 blunder or fewer per game (last 5 games)', done: avgBlunders !== null && recent.length >= 5 && avgBlunders <= 1, detail: avgBlunders === null ? 'no games yet' : `average ${avgBlunders.toFixed(1)} over ${recent.length} games` },
        { label: 'Basic checkmates: queen and rook', done: eg('kqk') && eg('krk'), detail: `${[eg('kqk'), eg('krk')].filter(Boolean).length} of 2 mastered` },
        { label: 'First 3 openings in your path', ...s1 },
      ],
    },
    {
      id: 'stage-2',
      title: 'Core tactics',
      range: [1000, 1200],
      items: [
        { label: 'Forks, pins and skewers at 70%+ (20 each)', done: themeOk('fork') && themeOk('pin') && themeOk('skewer'), detail: ['fork', 'pin', 'skewer'].map((t) => `${t} ${pct(theme(t).right, theme(t).total)}% (${theme(t).total})`).join(', ') },
        { label: 'Openings 4 to 8 in your path', ...s2 },
        { label: 'Beat the 1000 and 1200 bots without takebacks', done: winsVs(1000, 1000) > 0 && winsVs(1200, 1200) > 0, detail: `wins: 1000 bot ${winsVs(1000, 1000)}, 1200 bot ${winsVs(1200, 1200)}` },
      ],
    },
    {
      id: 'stage-3',
      title: 'Think in plans',
      range: [1200, 1400],
      items: [
        { label: 'Candidate moves: find the best move 60% of the time (20 rounds)', done: d.planning.candidates.rounds >= 20 && d.planning.candidates.foundBest / d.planning.candidates.rounds >= 0.6, detail: `${d.planning.candidates.foundBest} of ${d.planning.candidates.rounds}` },
        { label: 'What’s the plan? at 70%+ (20 questions)', done: d.planning.quiz.total >= 20 && d.planning.quiz.right / d.planning.quiz.total >= 0.7, detail: `${pct(d.planning.quiz.right, d.planning.quiz.total)}% of ${d.planning.quiz.total}` },
        { label: 'Basic endgames: opposition, square rule, Lucena, Philidor', done: ['king-6th', 'opposition', 'square-rule', 'lucena', 'philidor'].every(eg), detail: `${['king-6th', 'opposition', 'square-rule', 'lucena', 'philidor'].filter(eg).length} of 5 mastered` },
        { label: 'Openings 9 to 12 in your path', ...s3 },
      ],
    },
    {
      id: 'stage-4',
      title: 'Convert and outplay',
      range: [1400, 1500],
      items: [
        { label: 'Pawn structure lessons read (pawn breaks, weak squares)', done: ['pawn-breaks', 'weak-squares'].every((x) => d.planning.lessonsRead.includes(x)), detail: `${['pawn-breaks', 'weak-squares'].filter((x) => d.planning.lessonsRead.includes(x)).length} of 2 read` },
        { label: 'Convert winning positions: 3 wins vs 1400+ bots', done: winsVs(1400, 9999) >= 3, detail: `${winsVs(1400, 9999)} of 3` },
        { label: 'The sharper openings (steps 13 to 15)', ...s4 },
      ],
    },
  ];
}

export function currentStage(stages: Stage[], rating: number): Stage {
  return stages.find((s) => rating < s.range[1]) ?? stages[stages.length - 1];
}

export function mistakeCounts(d: DashboardInput): { tag: MistakeTag; label: string; count: number }[] {
  const counts = new Map<MistakeTag, number>();
  for (const g of recentGames(d)) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, label: MISTAKE_LABEL[tag], count })).sort((a, b) => b.count - a.count);
}

export function botResults(d: DashboardInput) {
  const by = new Map<number, { wins: number; total: number }>();
  for (const g of d.practice) {
    const r = by.get(g.botRating) ?? { wins: 0, total: 0 };
    r.total++;
    if (g.result === 'win') r.wins++;
    by.set(g.botRating, r);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rating, r]) => ({ rating, ...r, rate: r.wins / r.total }));
}
