import { 
  createEffect, 
  createRoot, 
  createSignal as solidCreateSignal,
  createMemo as solidCreateMemo,
  batch as solidBatch,
  untrack as solidUntrack,
  onCleanup as solidOnCleanup
} from 'solid-js';
import { SignalsRuntime } from '@vanishing/framework/runtime';

export const solidRuntime: SignalsRuntime = {
  effect(run) {
    return createRoot(dispose => {
      createEffect(run);
      return dispose;
    });
  },
  createSignal(initial) {
    return solidCreateSignal(initial);
  },
  createMemo(fn) {
    return solidCreateMemo(fn);
  },
  batch(fn) {
    return solidBatch(fn);
  },
  untrack(fn) {
    return solidUntrack(fn);
  },
  onCleanup(fn) {
    solidOnCleanup(fn);
  }
};