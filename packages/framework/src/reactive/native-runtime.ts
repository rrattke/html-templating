import { batch, createEffect, createMemo, createSignal, onCleanup, untrack } from "./signal.js";

import type { SignalsRuntime } from "../runtime.js";

// Define the native signal runtime

export const nativeRuntime: SignalsRuntime = {
  effect: (run) => createEffect(run),
  createSignal: (initial) => createSignal(initial),
  createMemo: (fn) => createMemo(fn),
  batch: (fn) => batch(fn),
  untrack: (fn) => untrack(fn),
  onCleanup: (fn) => onCleanup(fn),
};
