import { getPartRuntime } from '../template/runtime.js';
import type { Signal } from '../reactive/signal.js';

type DecoratedHost = Record<PropertyKey, unknown> & HTMLElement;

type Initializer<T> = T | (() => T);

export function state<T>(initialValue: Initializer<T>) {
  return function defineState(target: DecoratedHost, key: string | symbol): void {
    const signalKey = Symbol(`state:${String(key)}`);

    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      get(this: DecoratedHost) {
        if (!this[signalKey]) {
          const initial = typeof initialValue === 'function'
            ? (initialValue as () => T).call(this)
            : initialValue;
          const runtime = getPartRuntime();
          this[signalKey] = runtime.createSignal(initial);
        }
        const [read] = this[signalKey] as Signal<T>;
        return read();
      },
      set(this: DecoratedHost, value: unknown) {
        if (!this[signalKey]) {
          const initial = typeof initialValue === 'function'
            ? (initialValue as () => T).call(this)
            : initialValue;
          const runtime = getPartRuntime();
          this[signalKey] = runtime.createSignal(initial);
        }
        const [, write] = this[signalKey] as Signal<T>;
        write(value as T);
      }
    });
  };
}

export function attr(attributeName?: string) {
  return function defineAttribute(target: DecoratedHost, key: string | symbol): void {
    const name = attributeName ?? String(key).toLowerCase();

    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      get(this: HTMLElement) {
        if (!this.hasAttribute(name)) {
          return null;
        }
        return this.getAttribute(name);
      },
      set(this: HTMLElement, value: unknown) {
        if (value === null || value === undefined) {
          this.removeAttribute(name);
        } else {
          this.setAttribute(name, String(value));
        }
      }
    });
  };
}
