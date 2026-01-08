import type { Signal, Memo } from '../reactive/signal.js';

export interface PartRuntime {
  createSignal<T>(initialValue: T): Signal<T>;
  effect(run: () => void): () => void;
  createMemo<T>(fn: () => T): Memo<T>;
  batch<T>(fn: () => T): T;
  untrack<T>(fn: () => T): T;
  onCleanup(fn: () => void): void;
}

let activeRuntime: PartRuntime | undefined;

export function setPartRuntime(runtime: PartRuntime): void {
  activeRuntime = runtime;
}

export function getPartRuntime(): PartRuntime {
  if (!activeRuntime) {
    throw new Error('No runtime set. Call setPartRuntime() before using reactive templates.');
  }
  return activeRuntime;
}
