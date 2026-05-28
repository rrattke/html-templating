import type { SignalsRuntime } from "../runtime.js";
import type { Signal } from "../reactive/signal.js";

function state(runtime: SignalsRuntime) {
  return function decorate<This, Value>(
    target: ClassAccessorDecoratorTarget<This, Value>,
    _context: ClassAccessorDecoratorContext<This, Value>,
  ): ClassAccessorDecoratorResult<This, Value> {
    // The accessor's `get` is a closure-typed property, not a bound method.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { get: getStorage } = target as unknown as ClassAccessorDecoratorTarget<This, Signal<Value>>;

    return {
      init(this: This, initialValue: Value): Value {
        // The decorator infrastructure stores whatever init returns; we store a signal
        // and read/write through it via the get/set accessors below.
        return runtime.createSignal(initialValue) as unknown as Value;
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
      },
    };
  };
}

export const StateDecorator = {
  with: <This, Value>(runtime: SignalsRuntime) =>
    state(runtime) as (
      target: ClassAccessorDecoratorTarget<This, Value>,
      context: ClassAccessorDecoratorContext<This, Value>,
    ) => ClassAccessorDecoratorResult<This, Value>,
};

export function attr(attributeName?: string) {
  return function defineAttribute(
    _target: ClassAccessorDecoratorTarget<HTMLElement, string | null>,
    context: ClassAccessorDecoratorContext<HTMLElement, string | null>,
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
      },
    };
  };
}
