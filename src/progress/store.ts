// All saved data goes through this file. Today it lives in the browser
// (localStorage). To move to a backend later, write another `KeyValueBackend`
// and pass it to `setBackend`; nothing else in the app has to change.

import { useSyncExternalStore } from 'react';

export interface KeyValueBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const memoryBackend = (): KeyValueBackend => {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
};

const localBackend = (): KeyValueBackend => ({
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked; keep going in memory */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
});

const PREFIX = 'cm:';
let backend: KeyValueBackend =
  typeof localStorage === 'undefined' ? memoryBackend() : localBackend();
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

export function setBackend(b: KeyValueBackend) {
  backend = b;
  cache.clear();
}

/**
 * A named, versioned piece of saved data. `migrate` upgrades data saved by an
 * older version of the app, so progress is never lost when shapes change.
 */
export interface Slot<T> {
  key: string;
  version: number;
  initial: () => T;
  migrate?: (old: unknown, fromVersion: number) => T;
}

interface Stored<T> {
  v: number;
  data: T;
}

export function read<T>(slot: Slot<T>): T {
  if (cache.has(slot.key)) return cache.get(slot.key) as T;
  let value: T;
  const raw = backend.get(PREFIX + slot.key);
  try {
    const parsed = raw ? (JSON.parse(raw) as Stored<unknown>) : null;
    if (!parsed) value = slot.initial();
    else if (parsed.v === slot.version) value = parsed.data as T;
    else value = slot.migrate ? slot.migrate(parsed.data, parsed.v) : slot.initial();
  } catch {
    value = slot.initial();
  }
  cache.set(slot.key, value);
  return value;
}

export function write<T>(slot: Slot<T>, value: T) {
  cache.set(slot.key, value);
  backend.set(PREFIX + slot.key, JSON.stringify({ v: slot.version, data: value }));
  listeners.get(slot.key)?.forEach((l) => l());
}

export function update<T>(slot: Slot<T>, fn: (old: T) => T) {
  write(slot, fn(read(slot)));
}

function subscribe(key: string, cb: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(cb);
  return () => listeners.get(key)!.delete(cb);
}

/** React hook: the slot's value, re-rendering when it changes. */
export function useSlot<T>(slot: Slot<T>): [T, (fn: (old: T) => T) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribe(slot.key, cb),
    () => read(slot),
  );
  return [value, (fn) => update(slot, fn)];
}

/** Everything saved, as one JSON object (for backup, or a future backend import). */
export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof localStorage === 'undefined') return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(PREFIX)) out[k] = JSON.parse(localStorage.getItem(k)!);
  }
  return out;
}
