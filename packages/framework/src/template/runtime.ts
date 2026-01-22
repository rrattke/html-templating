/**
 * Runtime facade for template binding.
 * Allows runtime to be configured globally by consuming applications.
 */

import { TemplateBinding } from './render.js';

/**
 * HTML template tag function (delegates to configured runtime).
 */
export function html(...args: any[]): any {
  const runtime = globalThis.__SIGNALS_RUNTIME__;
  if (!runtime) {
    throw new Error('Runtime not configured. Call setRuntime() before importing components.');
  }
  return TemplateBinding.with(runtime)(...args);
}
