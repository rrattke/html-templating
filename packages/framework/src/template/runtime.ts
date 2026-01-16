import type { Signal, Memo } from '../reactive.js';

export interface PartRuntime {
  createSignal<T>(initialValue: T): Signal<T>;
  effect(run: () => void): () => void;
  createMemo<T>(fn: () => T): Memo<T>;
  batch<T>(fn: () => T): T;
  untrack<T>(fn: () => T): T;
  onCleanup(fn: () => void): void;
}
