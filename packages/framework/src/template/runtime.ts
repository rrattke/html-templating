import { createEffect } from '../reactive/signal.js';

export interface PartRuntime {
  effect(run: () => void): () => void;
}

const signalRuntime: PartRuntime = {
  effect: run => createEffect(run)
};

let activeRuntime: PartRuntime = signalRuntime;

export function setPartRuntime(runtime: PartRuntime): void {
  activeRuntime = runtime;
}

export function getPartRuntime(): PartRuntime {
  return activeRuntime;
}

export function getSignalRuntime(): PartRuntime {
  return signalRuntime;
}
