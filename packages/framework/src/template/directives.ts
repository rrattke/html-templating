/**
 * Template directives are small, stateless helpers that keep templates
 * "HTML-shaped" while still allowing control-flow like lists and conditionals.
 */

import { DynamicBinding } from './render.js';

/**
 * Declaratively render a keyed list.
 *
 * This is analogous to lit-html's `repeat()` directive: it centralizes list
 * mapping + keying so templates stay readable.
 *
 * The return value is a function so it can be used directly in dynamic slots:
 * `html` will track it with the reactive runtime and rerun it on updates.
 *
 * @example
 * ```ts
 * html`<ul>
 *   ${repeat(() => items, item => item.id, item => html`<li>${item.label}</li>`)}
 * </ul>`
 * ```
 */
export function repeat<T>(
  items: Iterable<T> | (() => Iterable<T> | null | undefined),
  key: (item: T, index: number) => unknown,
  template: (item: T, index: number) => unknown,
): () => unknown[] {
  return () => {
    const resolvedItems = typeof items === 'function' ? items() : items;
    if (!resolvedItems) return [];

    const results: unknown[] = [];
    let index = 0;

    for (const item of resolvedItems) {
      const rendered = template(item, index);

      // If the template produced a DynamicBinding without a key, attach one.
      // This enables keyed list reconciliation without forcing `html(key)` at call sites.
      if (rendered instanceof DynamicBinding && rendered.key === undefined) {
        rendered.key = key(item, index);
      }

      results.push(rendered);
      index++;
    }

    return results;
  };
}
