/**
 * Runtime facade for web component decorators.
 * Allows runtime to be configured globally by consuming applications.
 */

import { StateDecorator } from "./decorators.js";

/**
 * State decorator (delegates to configured runtime).
 */
export function state<This, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> {
  const runtime = globalThis.__SIGNALS_RUNTIME__;
  if (!runtime) {
    throw new Error("Runtime not configured. Call setRuntime() before importing components.");
  }
  return StateDecorator.with<This, Value>(runtime)(target, context);
}
