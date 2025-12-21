import { createSignal } from '../reactive/signal.js';

export function state(initialValue) {
  return function defineState(target, key) {
    const signalKey = Symbol(`state:${String(key)}`);
    Object.defineProperty(target, key, {
      get() {
        if (!this[signalKey]) {
          const initial = typeof initialValue === 'function' ? initialValue.call(this) : initialValue;
          this[signalKey] = createSignal(initial);
        }
        return this[signalKey][0]();
      },
      set(value) {
        if (!this[signalKey]) {
          const initial = typeof initialValue === 'function' ? initialValue.call(this) : initialValue;
          this[signalKey] = createSignal(initial);
        }
        this[signalKey][1](value);
      }
    });
  };
}

export function attr(attributeName) {
  return function defineAttribute(target, key) {
    const name = attributeName ?? key.toLowerCase();
    Object.defineProperty(target, key, {
      get() {
        if (!this.hasAttribute(name)) {
          return null;
        }
        return this.getAttribute(name);
      },
      set(value) {
        if (value === null || value === undefined) {
          this.removeAttribute(name);
        } else {
          this.setAttribute(name, value);
        }
      }
    });
  };
}
