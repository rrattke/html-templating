/**
 * Template compilation and caching.
 * Layer 1: Compiles template strings into reusable Template objects.
 */

import type { PartDescriptor } from './html.js';
import { createTemplateDescriptor } from './html.js';

const templateCache = new WeakMap<TemplateStringsArray, Template>();

/**
 * Compiled template - cached and immutable.
 * Contains the parsed HTMLTemplateElement and part descriptors.
 */
export class Template {
  readonly element: HTMLTemplateElement;
  readonly descriptors: PartDescriptor[];

  constructor(element: HTMLTemplateElement, descriptors: PartDescriptor[]) {
    this.element = element;
    this.descriptors = descriptors;
  }

  /**
   * Creates a fresh clone of the template content.
   */
  cloneFragment(): DocumentFragment {
    return this.element.content.cloneNode(true) as DocumentFragment;
  }
}

/**
 * Retrieves or creates a cached Template for the given template strings.
 * Uses WeakMap so templates can be garbage collected when modules unload.
 */
export function getTemplate(strings: TemplateStringsArray): Template {
  let template = templateCache.get(strings);
  if (!template) {
    const { template: element, descriptors } = createTemplateDescriptor(strings);
    template = new Template(element, descriptors);
    templateCache.set(strings, template);
  }
  return template;
}
