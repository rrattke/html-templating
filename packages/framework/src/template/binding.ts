import { PartsTemplate } from './compiled-template.js';
import type { PartRuntime } from './runtime.js';

/**
 * Represents a tagged template literal bound to a specific reactive runtime.
 * Created by calling TemplateBinding.with(runtime) to get a template tag function.
 */
export class TemplateBinding {
  #strings: TemplateStringsArray;
  #values: unknown[];
  #runtime: PartRuntime;
  key?: unknown;

  constructor(strings: TemplateStringsArray, values: unknown[], runtime: PartRuntime) {
    this.#strings = strings;
    this.#values = values;
    this.#runtime = runtime;
  }

  static with(runtime: PartRuntime): (strings: TemplateStringsArray, ...values: unknown[]) => TemplateBinding {
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      return new TemplateBinding(strings, values, runtime);
    };
  }

  get strings(): TemplateStringsArray {
    return this.#strings;
  }

  get values(): unknown[] {
    return this.#values;
  }

  get runtime(): PartRuntime {
    return this.#runtime;
  }

  setKey(keyValue: unknown): this {
    this.key = keyValue;
    return this;
  }

  // Abstract method - implementation injected by instantiate module
  instance(): { fragment: DocumentFragment; dispose: () => void } {
    throw new Error('instance() must be implemented - patched by instantiate module');
  }

  // Abstract method - implementation injected by instantiate module  
  getTemplate(): PartsTemplate {
    throw new Error('getTemplate() must be implemented - patched by instantiate module');
  }
}
