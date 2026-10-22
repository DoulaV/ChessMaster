// The blunder-check habit: four questions before every move.

export const CHECKLIST = [
  { q: 'What did my opponent’s last move threaten?', hint: 'Look at every piece it now attacks, and any new line it opened.' },
  { q: 'Checks, captures, threats: for BOTH sides.', hint: 'First theirs, then yours. Forcing moves come first.' },
  { q: 'Is the piece I’m about to move leaving something undefended?', hint: 'Was it protecting another piece or a key square?' },
  { q: 'After my move, can my opponent capture anything for free?', hint: 'Imagine your move on the board and look from their side.' },
];

export function Checklist({ compact = false, active }: { compact?: boolean; active?: number }) {
  return (
    <ol className="space-y-2">
      {CHECKLIST.map((c, i) => (
        <li key={i} className={`flex gap-3 rounded-lg p-2 ${active === i ? 'bg-cm-green/20' : ''}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cm-green font-extrabold text-white">{i + 1}</span>
          <span>
            <span className="block font-bold">{c.q}</span>
            {!compact && <span className="block text-sm text-cm-muted">{c.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
