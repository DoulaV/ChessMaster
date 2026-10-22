// Small shared UI building blocks (dark theme).

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  // Big green button with a darker "3D" bottom edge.
  primary:
    'bg-cm-green text-white font-bold shadow-[0_4px_0_0_var(--color-cm-green-dark)] hover:bg-cm-green-light active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--color-cm-green-dark)]',
  secondary:
    'bg-cm-panel2 text-cm-text font-semibold shadow-[0_3px_0_0_#1f1e1c] hover:bg-cm-hover active:translate-y-[2px] active:shadow-[0_1px_0_0_#1f1e1c]',
  ghost: 'text-cm-muted font-semibold hover:bg-cm-panel2 hover:text-white',
  danger: 'bg-cm-red text-white font-bold shadow-[0_4px_0_0_#8f1b1b] hover:brightness-110',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm min-h-9', md: 'px-4 py-2.5 min-h-11', lg: 'px-6 py-4 text-xl min-h-14' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Card({ title, children, className = '', actions }: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-lg bg-cm-panel p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-cm-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-cm-green' : 'bg-cm-hover'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.375rem]' : 'start-0.5'}`}
        />
      </button>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-cm-panel p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="h-10 w-10 rounded-lg text-2xl text-cm-muted hover:bg-cm-panel2" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-cm-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-md px-3 text-sm font-semibold ${value === o.value ? 'bg-cm-panel2 text-white' : 'text-cm-muted hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border-s-4 border-cm-yellow bg-cm-panel2 p-3 text-sm">{children}</p>;
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-cm-bg ${className}`}>
      <div className="h-full rounded-full bg-cm-green transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'yellow' | 'red' }) {
  const tones = {
    muted: 'bg-cm-panel2 text-cm-muted',
    green: 'bg-cm-green/20 text-cm-green-light',
    yellow: 'bg-cm-yellow/20 text-cm-yellow',
    red: 'bg-cm-red/20 text-red-300',
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

/** Copy text to the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
