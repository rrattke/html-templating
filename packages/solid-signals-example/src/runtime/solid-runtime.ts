import { createEffect, createRoot } from 'solid-js';
import type { PartRuntime } from '@vanishing/framework';

export const solidRuntime: PartRuntime = {
  effect(run) {
    return createRoot(dispose => {
      createEffect(run);
      return dispose;
    });
  }
};
