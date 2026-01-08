import { createEffect } from '@vanishing/framework';
import { setPartRuntime, type PartRuntime } from '@vanishing/framework';

// Define the native signal runtime
export const nativeRuntime: PartRuntime = {
  effect: run => createEffect(run)
};

// Set as default runtime immediately when this module loads
setPartRuntime(nativeRuntime);
