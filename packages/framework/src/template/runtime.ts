export interface PartRuntime {
  effect(run: () => void): () => void;
}

let activeRuntime: PartRuntime | undefined;

export function setPartRuntime(runtime: PartRuntime): void {
  activeRuntime = runtime;
}

export function getPartRuntime(): PartRuntime {
  if (!activeRuntime) {
    throw new Error('No runtime set. Call setPartRuntime() before using reactive templates.');
  }
  return activeRuntime;
}
