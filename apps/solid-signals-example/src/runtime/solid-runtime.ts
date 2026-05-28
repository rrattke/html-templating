import {
  batch as solidBatch,
  createEffect,
  createMemo as solidCreateMemo,
  createRoot,
  createSignal as solidCreateSignal,
  onCleanup as solidOnCleanup,
  untrack as solidUntrack,
} from "solid-js";

import type { SignalsRuntime } from "@vanishing/framework/runtime";

export const solidRuntime: SignalsRuntime = {
  effect(run) {
    return createRoot((dispose) => {
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
  },
};
