import { createEffect, createSignal, createMemo, batch, untrack, onCleanup } from '@vanishing/framework';
import { setPartRuntime, type PartRuntime } from '@vanishing/framework';

// Define the native signal runtime
export const nativeRuntime: PartRuntime = {
  effect: run => createEffect(run),
  createSignal: initial => createSignal(initial),
  createMemo: fn => createMemo(fn),
  batch: fn => batch(fn),
  untrack: fn => untrack(fn),
  onCleanup: fn => onCleanup(fn)
};

// Set as default runtime immediately when this module loads
setPartRuntime(nativeRuntime);
