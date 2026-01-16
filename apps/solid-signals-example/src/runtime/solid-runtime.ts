import { 
  createEffect, 
  createRoot, 
  createSignal as solidCreateSignal,
  createMemo as solidCreateMemo,
  batch as solidBatch,
  untrack as solidUntrack,
  onCleanup as solidOnCleanup
} from 'solid-js';
import { StateDecorator } from '@vanishing/framework/wc';
import { PartRuntime, TemplateBinding } from '@vanishing/framework/template';

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

export const html = TemplateBinding.with(solidRuntime);
export const state = StateDecorator.with(solidRuntime);