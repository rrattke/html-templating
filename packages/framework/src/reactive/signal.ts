type SubscriberSet = Set<EffectRecord>;

type CleanupFn = () => void;

type Updater<T> = (value: T) => T;

type WriteValue<T> = T | Updater<T>;

interface EffectRecord {
  fn: () => void;
  deps: Set<SubscriberSet>;
  cleanups: CleanupFn[];
  active: boolean;
  run: () => void;
}

let currentEffect: EffectRecord | null = null;
let cleanupStack: CleanupFn[] | null = null;

function cleanupEffect(effect: EffectRecord): void {
  if (effect.deps.size > 0) {
    for (const dep of effect.deps) {
      dep.delete(effect);
    }
    effect.deps.clear();
  }
  if (effect.cleanups.length > 0) {
    for (const cleanup of effect.cleanups) {
      try {
        cleanup();
      } catch (error) {
        console.error('cleanup failed', error);
      }
    }
    effect.cleanups.length = 0;
  }
}

export type Signal<T> = [() => T, (value: WriteValue<T>) => T];

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers: SubscriberSet = new Set();

  const read = (): T => {
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect.deps.add(subscribers);
    }
    return value;
  };

  const write = (next: WriteValue<T>): T => {
    const resolved = typeof next === 'function' ? (next as Updater<T>)(value) : next;
    if (Object.is(resolved, value)) {
      return value;
    }
    value = resolved;
    for (const effect of [...subscribers]) {
      effect.run();
    }
    return value;
  };

  return [read, write];
}

export function createEffect(fn: () => void): () => void {
  const effect: EffectRecord = {
    fn,
    deps: new Set(),
    cleanups: [],
    active: true,
    run: () => {
      if (!effect.active) {
        return;
      }
      cleanupEffect(effect);
      const prevEffect = currentEffect;
      const prevCleanup = cleanupStack;
      currentEffect = effect;
      cleanupStack = [];
      try {
        effect.fn();
      } finally {
        effect.cleanups = cleanupStack;
        cleanupStack = prevCleanup;
        currentEffect = prevEffect;
      }
    }
  };

  effect.run();

  return () => {
    effect.active = false;
    cleanupEffect(effect);
  };
}

export function onCleanup(fn: CleanupFn): void {
  if (cleanupStack) {
    cleanupStack.push(fn);
  }
}
