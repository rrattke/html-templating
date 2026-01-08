import { createEffect, createRoot } from 'solid-js';
import type { PartRuntime } from '@vanishing/framework';
import { setPartRuntime } from '@vanishing/framework';

export const solidRuntime: PartRuntime = {
  effect(run) {
    return createRoot(dispose => {
      createEffect(run);
      return dispose;
    });
  }
};

// Set as default runtime immediately when this module loads
setPartRuntime(solidRuntime);
