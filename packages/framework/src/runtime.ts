import type { Memo, Signal } from "./reactive/signal.js";

export interface SignalsRuntime {
  createSignal<T>(initialValue: T): Signal<T>;
  effect(run: () => void): () => void;
  createMemo<T>(fn: () => T): Memo<T>;
  batch<T>(fn: () => T): T;
  untrack<T>(fn: () => T): T;
  onCleanup(fn: () => void): void;
}

declare global {
  var __SIGNALS_RUNTIME__: SignalsRuntime | undefined;
}

/**
 * Set the global runtime used by the framework.
 * Must be called before importing any components that use templates or state.
 */
export function setRuntime(runtime: SignalsRuntime): void {
  globalThis.__SIGNALS_RUNTIME__ = runtime;
}
