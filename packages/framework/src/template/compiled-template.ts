import type { PartDescriptor } from './html.js';
import type { PartRuntime } from './runtime.js';

/**
 * A compiled template ready for instantiation.
 * Contains the template element and metadata about dynamic parts.
 */
export class PartsTemplate {
  constructor(
    public readonly template: HTMLTemplateElement,
    public readonly descriptors: PartDescriptor[]
  ) {}

  cloneFragment(): DocumentFragment {
    return this.template.content.cloneNode(true) as DocumentFragment;
  }

  createInstance(values: unknown[], runtime: PartRuntime): { fragment: DocumentFragment; dispose: () => void } {
    // Implementation will be provided by instantiate.ts to avoid circular dependencies
    // This method signature is defined here but actual implementation is in instantiate.ts
    throw new Error('createInstance must be implemented - this should be patched by instantiate module');
  }
}
