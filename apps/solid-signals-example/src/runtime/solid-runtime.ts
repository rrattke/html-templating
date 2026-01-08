import { 
  createEffect, 
  createRoot, 
  createSignal as solidCreateSignal,
  createMemo as solidCreateMemo,
  batch as solidBatch,
  untrack as solidUntrack,
  onCleanup as solidOnCleanup
} from 'solid-js';
import type { PartRuntime } from '@vanishing/framework';
import { setPartRuntime } from '@vanishing/framework';

export const solidRuntime: PartRuntime = {
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

// Set as default runtime immediately when this module loads
setPartRuntime(solidRuntime);
