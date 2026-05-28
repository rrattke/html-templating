/**
 * Runtime facade for template binding.
 * Allows runtime to be configured globally by consuming applications.
 */

import { DynamicBinding } from "./render.js";

/**
 * HTML template tag function (delegates to configured runtime).
 * Supports both direct use (`` html`...` ``) and keyed use (`` html(id)`...` ``).
 */
export const html:
  & ((strings: readonly string[], ...values: unknown[]) => DynamicBinding)
  & ((id?: unknown) => (strings: readonly string[], ...values: unknown[]) => DynamicBinding) =
    ((stringsOrId?: unknown, ...values: unknown[]) => {
      const runtime = globalThis.__SIGNALS_RUNTIME__;
      if (!runtime) {
        throw new Error("Runtime not configured. Call setRuntime() before importing components.");
      }
      const bound = DynamicBinding.with(runtime);
      if (Array.isArray(stringsOrId) && "raw" in stringsOrId) {
        return bound(stringsOrId as readonly string[], ...values);
      }
      return bound(stringsOrId);
    }) as never;
