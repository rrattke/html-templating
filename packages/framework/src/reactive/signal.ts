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

export type Memo<T> = () => T;

interface SignalOptions<T> {
  equals?: boolean | ((prev: T, next: T) => boolean);
}

export function createSignal<T>(initial: T, options?: SignalOptions<T>): Signal<T> {
  let value = initial;
  const subscribers: SubscriberSet = new Set();
  const equals = options?.equals ?? true;

  const read = (): T => {
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect.deps.add(subscribers);
    }
    return value;
  };

  const write = (next: WriteValue<T>): T => {
    const resolved = typeof next === 'function' ? (next as Updater<T>)(value) : next;
    
    // Check equality
    const hasChanged = equals === false 
      ? true 
      : typeof equals === 'function' 
        ? !equals(value, resolved)
        : !Object.is(resolved, value);
    
    if (!hasChanged) {
      return value;
    }
    
    value = resolved;
    
    if (batchDepth > 0) {
      for (const effect of subscribers) {
        batchedEffects.add(effect);
      }
    } else {
      for (const effect of [...subscribers]) {
        effect.run();
      }
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

export function createMemo<T>(fn: () => T): Memo<T> {
  const [memo, setMemo] = createSignal<T>(fn(), { equals: false });
  createEffect(() => setMemo(fn()));
  return memo;
}

let batchDepth = 0;
let batchedEffects: Set<EffectRecord> = new Set();

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = batchedEffects;
      batchedEffects = new Set();
      for (const effect of effects) {
        effect.run();
      }
    }
  }
}

export function untrack<T>(fn: () => T): T {
  const prevEffect = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prevEffect;
  }
}
