// Small single-series charts in SVG: a line with a hover crosshair, columns,
// and horizontal bars. Each one can switch to a plain table.
// Colors: the data mark uses one validated hue (checked on the dark panel
// surface); all text uses text colors, never the data color.

import { useState, type ReactNode } from 'react';

export const SERIES = '#3987e5';
const GRID = '#45423e';
const SURFACE = '#262522';

export interface Point {
  label: string;
  value: number;
  /** Extra line in the tooltip. */
  note?: string;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Frame({ title, subtitle, table, children, empty }: {
  title: string;
  subtitle?: string;
  table: { head: [string, string]; rows: [string, string][] };
  children: ReactNode;
  empty?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="rounded-lg bg-cm-panel p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <figcaption>
          <p className="font-bold">{title}</p>
          {subtitle && <p className="text-xs text-cm-faint">{subtitle}</p>}
        </figcaption>
        {!empty && (
          <button className="shrink-0 rounded px-2 py-1 text-xs text-cm-muted hover:bg-cm-panel2" onClick={() => setAsTable(!asTable)}>
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {empty ? (
        <p className="py-6 text-center text-sm text-cm-faint">{empty}</p>
      ) : asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-cm-faint">
              <th className="text-start font-normal">{table.head[0]}</th>
              <th className="text-end font-normal">{table.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([a, b], i) => (
              <tr key={i} className="border-t border-cm-line">
                <td className="py-1">{a}</td>
                <td className="text-end">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </figure>
  );
}

function Tooltip({ x, y, w, lines }: { x: number; y: number; w: number; lines: string[] }) {
  const width = 132;
  const left = Math.min(Math.max(x - width / 2, 0), w - width);
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md bg-black/90 px-2 py-1 text-xs text-white shadow-lg"
      style={{ left: `${(left / w) * 100}%`, top: y, width }}
    >
      {lines.map((l, i) => (
        <p key={i} className={i === 0 ? 'font-bold' : 'text-white/80'}>{l}</p>
      ))}
    </div>
  );
}

/** Line chart with a hover crosshair (rating over time). */
export function LineChart({ title, subtitle, data, format = (v) => String(v), empty, valueName = 'Value' }: {
  title: string;
  subtitle?: string;
  data: Point[];
  format?: (v: number) => string;
  empty?: string;
  valueName?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 180;
  const pad = { l: 40, r: 12, t: 10, b: 22 };
  const vals = data.map((d) => d.value);
  const lo = Math.floor((Math.min(...vals, Infinity) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...vals, -Infinity) + 20) / 50) * 50;
  const x = (i: number) => pad.l + (data.length <= 1 ? (W - pad.l - pad.r) / 2 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const last = data[data.length - 1];
  return (
    <Frame
      title={title}
      subtitle={subtitle}
      empty={data.length < 2 ? empty ?? 'Not enough data yet.' : undefined}
      table={{ head: ['Date', valueName], rows: data.map((d) => [d.label, format(d.value)]) }}
    >
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: latest ${last ? format(last.value) : ''}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8b8987">{t}</text>
            </g>
          ))}
          <path d={`${path} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} fill={SERIES} opacity={0.1} />
          <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && (
            <>
              <circle cx={x(data.length - 1)} cy={y(last.value)} r={5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
              <text x={x(data.length - 1) - 8} y={y(last.value) - 10} textAnchor="end" fontSize={12} fontWeight={700} fill="#ffffff">{format(last.value)}</text>
            </>
          )}
          <text x={pad.l} y={H - 4} fontSize={11} fill="#8b8987">{data[0]?.label}</text>
          <text x={W - pad.r} y={H - 4} fontSize={11} textAnchor="end" fill="#8b8987">{last?.label}</text>
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#bababa" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
            </>
          )}
          {/* Hit areas: one invisible column per point, wider than the mark. */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={x(i) - (W - pad.l - pad.r) / Math.max(1, data.length - 1) / 2}
              y={0}
              width={(W - pad.l - pad.r) / Math.max(1, data.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <Tooltip x={x(hover)} y={4} w={W} lines={[data[hover].label, `${valueName}: ${format(data[hover].value)}`, ...(data[hover].note ? [data[hover].note!] : [])]} />
        )}
      </div>
    </Frame>
  );
}

/** Vertical columns from a zero baseline (e.g. blunders per game). */
export function ColumnChart({ title, subtitle, data, format = (v) => String(v), empty, valueName = 'Value' }: {
  title: string;
  subtitle?: string;
  data: Point[];
  format?: (v: number) => string;
  empty?: string;
  valueName?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 170;
  const pad = { l: 30, r: 8, t: 14, b: 8 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(24, band - 2);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const base = H - pad.b;
  const r = 4;
  const bar = (x0: number, top: number) => {
    const h = base - top;
    if (h <= 0) return '';
    const rr = Math.min(r, h, bw / 2);
    return `M${x0},${base} L${x0},${top + rr} Q${x0},${top} ${x0 + rr},${top} L${x0 + bw - rr},${top} Q${x0 + bw},${top} ${x0 + bw},${top + rr} L${x0 + bw},${base} Z`;
  };
  return (
    <Frame title={title} subtitle={subtitle} empty={data.length === 0 ? empty ?? 'No data yet.' : undefined} table={{ head: ['Game', valueName], rows: data.map((d) => [d.label, format(d.value)]) }}>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8b8987">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pad.l + i * band + (band - bw) / 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={pad.l + i * band} y={0} width={band} height={H} fill="transparent" />
                <path d={bar(x0, y(d.value))} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.55} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <Tooltip x={pad.l + hover * band + band / 2} y={4} w={W} lines={[data[hover].label, `${valueName}: ${format(data[hover].value)}`, ...(data[hover].note ? [data[hover].note!] : [])]} />
        )}
      </div>
    </Frame>
  );
}

/** Horizontal bars with the value at the tip (categories: bot levels, mistake types). */
export function BarList({ title, subtitle, data, format = (v) => String(v), max, empty, valueName = 'Value' }: {
  title: string;
  subtitle?: string;
  data: Point[];
  format?: (v: number) => string;
  max?: number;
  empty?: string;
  valueName?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <Frame title={title} subtitle={subtitle} empty={data.length === 0 ? empty ?? 'No data yet.' : undefined} table={{ head: ['', valueName], rows: data.map((d) => [d.label, format(d.value)]) }}>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} title={`${d.label}: ${format(d.value)}${d.note ? ` (${d.note})` : ''}`}>
            <div className="mb-0.5 flex justify-between gap-2 text-sm">
              <span className="truncate">{d.label}</span>
              <span className="shrink-0 text-cm-muted">
                {format(d.value)}
                {d.note && <span className="ms-1 text-xs text-cm-faint">{d.note}</span>}
              </span>
            </div>
            <div className="h-3 rounded-sm bg-cm-bg">
              <div className="h-3 rounded-e" style={{ width: `${Math.max(2, (d.value / top) * 100)}%`, background: SERIES }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
