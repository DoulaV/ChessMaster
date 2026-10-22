import type { ReactNode } from 'react';

/**
 * Board on the left and a side panel on the right (desktop), or stacked
 * (phone). The board is sized so it fits the screen height on desktop.
 */
export function BoardLayout({ board, panel, above, below }: {
  board: ReactNode;
  panel: ReactNode;
  above?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-3 lg:flex-row lg:items-start">
      <div className="w-full lg:w-[min(100%,calc(100dvh-140px))] lg:max-w-[720px] lg:shrink-0">
        {above}
        {board}
        {below}
      </div>
      <div className="min-w-0 flex-1 space-y-3 lg:max-w-[440px]">{panel}</div>
    </div>
  );
}

/** Name strip above or below the board, like on chess sites. */
export function PlayerBar({ name, detail, icon = '👤', right }: {
  name: string;
  detail?: string;
  icon?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="flex h-9 w-9 items-center justify-center rounded bg-cm-panel2 text-xl">{icon}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-bold">{name}</span>
        {detail && <span className="ms-1.5 text-sm text-cm-faint">{detail}</span>}
      </span>
      {right}
    </div>
  );
}
