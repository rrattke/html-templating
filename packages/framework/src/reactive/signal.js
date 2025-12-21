let currentEffect = null;
let cleanupStack = null;

function cleanupEffect(effect) {
  if (effect.deps) {
    for (const dep of effect.deps) {
      dep.delete(effect);
    }
    effect.deps.clear();
  }
  if (effect.cleanups) {
    for (const fn of effect.cleanups) {
      try {
        fn();
      } catch (error) {
        console.error('Cleanup error', error);
      }
    }
    effect.cleanups.length = 0;
  }
}

export function createSignal(initial) {
  let value = initial;
  const subscribers = new Set();

  const read = () => {
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect.deps.add(subscribers);
    }
    return value;
  };

  const write = next => {
    const resolved = typeof next === 'function' ? next(value) : next;
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

export function createEffect(fn) {
  const effect = {
    fn,
    deps: new Set(),
    cleanups: [],
    active: true,
    run() {
      if (!effect.active) {
        return;
      }
      cleanupEffect(effect);
      const prevEffect = currentEffect;
      const prevCleanupStack = cleanupStack;
      currentEffect = effect;
      cleanupStack = [];
      try {
        effect.fn();
      } finally {
        effect.cleanups = cleanupStack;
        cleanupStack = prevCleanupStack;
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

export function onCleanup(fn) {
  if (cleanupStack) {
    cleanupStack.push(fn);
  }
}
