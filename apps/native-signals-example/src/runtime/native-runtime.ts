import { createEffect, createSignal, createMemo, batch, untrack, onCleanup } from '@vanishing/framework/reactive';
import { type SignalsRuntime } from '@vanishing/framework/runtime';

// Define the native signal runtime
export const nativeRuntime: SignalsRuntime = {
  effect: run => createEffect(run),
  createSignal: initial => createSignal(initial),
  createMemo: fn => createMemo(fn),
  batch: fn => batch(fn),
  untrack: fn => untrack(fn),
  onCleanup: fn => onCleanup(fn)
};