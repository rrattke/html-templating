import type { SignalsRuntime } from '../runtime.js';
import type { Signal } from '../reactive/signal.js';

function state<This, Value>(runtime: SignalsRuntime) {
  return function<This, Value> (
    target: ClassAccessorDecoratorTarget<This, Value>
  ): ClassAccessorDecoratorResult<This, Value> {
    const { get: getStorage } = target as unknown as ClassAccessorDecoratorTarget<This, Signal<Value>>;

    return {
      init(this: This, initialValue: Value): any {
        const signal = runtime.createSignal(initialValue);
        // Return the signal directly - the decorator infrastructure will store it
        return signal;
      },
      get(this: This): Value {
        const signal = getStorage.call(this);
        const [read] = signal;
        return read();
      },
      set(this: This, value: Value): void {
        const signal = getStorage.call(this);
        const [, write] = signal;
        write(value);
      }
    };
  };
}

export const StateDecorator = {
  with: state
};

export function attr(attributeName?: string) {
  return function defineAttribute(
    _target: ClassAccessorDecoratorTarget<HTMLElement, string | null>,
    context: ClassAccessorDecoratorContext<HTMLElement, string | null>
  ): ClassAccessorDecoratorResult<HTMLElement, string | null> {
    const name = attributeName ?? String(context.name).toLowerCase();

    return {
      get(this: HTMLElement): string | null {
        if (!this.hasAttribute(name)) {
          return null;
        }
        return this.getAttribute(name);
      },
      set(this: HTMLElement, value: string | null): void {
        if (value === null || value === undefined) {
          this.removeAttribute(name);
        } else {
          this.setAttribute(name, String(value));
        }
      }
    };
  };
}
