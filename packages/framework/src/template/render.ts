/**
 * Template instantiation and rendering.
 * Layer 3: Manages template instances, bindings, and reconciliation.
 */

import { NodeRange } from './dom.js';
import { Template, getTemplate } from './template.js';
import { 
  EventAttributePart, 
  createParts,
  KeepInPlace,
  type Part
} from './parts.js';
import type { SignalsRuntime } from '../runtime.js';

/**
 * Static template binding - holds template strings and values.
 * No runtime needed. Rendered once with render() method.
 * 
 * @example
 * ```ts
 * const html = StaticBinding.html;
 * const page = html`<div>${title}</div>`;
 * document.body.appendChild(page.render());
 * ```
 */
export class StaticBinding {
  #strings: TemplateStringsArray;
  #values: unknown[];

  constructor(strings: TemplateStringsArray, values: unknown[]) {
    this.#strings = strings;
    this.#values = values;
  }

  get strings(): TemplateStringsArray {
    return this.#strings;
  }

  get values(): unknown[] {
    return this.#values;
  }

  getTemplate(): Template {
    return getTemplate(this.#strings);
  }

  /**
   * Renders the template to a DocumentFragment.
   * One-time rendering with no reactive updates.
   */
  render(): DocumentFragment {
    const template = this.getTemplate();
    const fragment = template.cloneFragment();
    const parts = createParts(template.descriptors, fragment);
    
    parts.forEach((part, index) => {
      const value = this.#values[index];
      const processed = processValueStatic(value);
      part.setValue(processed);
    });
    
    return fragment;
  }

  /**
   * Creates an html`` tag function for static templates.
   */
  static html(strings: TemplateStringsArray, ...values: unknown[]): StaticBinding {
    return new StaticBinding(strings, values);
  }
}

/**
 * Process a value for static rendering by instantiating any StaticBindings.
 * Unlike processValue, this doesn't track instances for disposal.
 */
function processValueStatic(value: unknown): unknown {
  // Handle StaticBinding by rendering it
  if (value instanceof StaticBinding) {
    return value.render();
  }
  
  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map(item => processValueStatic(item));
  }
  
  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

/**
 * Process a value by instantiating any DynamicBindings.
 * Child instances are tracked on the parent for reconciliation.
 */
function processValue(value: unknown, runtime: SignalsRuntime, parent: TemplateInstance): unknown {
  // Handle DynamicBinding by instantiating it (or reusing existing)
  if (value instanceof DynamicBinding) {
    const { instance, reused } = parent.getOrCreateChild(value.key, () => 
      TemplateInstance.create(runtime, value.getTemplate(), value.values)
    );
    
    if (reused) {
      // Extract DOM nodes from their current location for reinsertion
      return instance.extractContent();
    }
    return instance.fragment;
  }
  
  // Handle StaticBinding by rendering it (allows mixing static in dynamic templates)
  if (value instanceof StaticBinding) {
    return value.render();
  }
  
  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map(item => processValue(item, runtime, parent));
  }
  
  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

/**
 * Process a list value with optimized reconciliation.
 * Only moves items that have actually changed position.
 * Returns KeepInPlace markers for items that shouldn't move.
 */
export function processListValue(value: unknown, runtime: SignalsRuntime, parent: TemplateInstance): unknown {
  if (!isIterable(value)) {
    return processValue(value, runtime, parent);
  }
  
  const items = Array.from(value);
  
  // Check if we have keyed items
  const hasKeys = items.some(item => item instanceof DynamicBinding && item.key !== undefined);
  
  if (!hasKeys) {
    // No keys - just process each item
    return items.map(item => processValue(item, runtime, parent));
  }
  
  return reconcileKeyedList(items, runtime, parent);
}

/**
 * Reconciles a list of keyed items, minimizing DOM mutations.
 * Only extracts items that have actually changed position.
 */
function reconcileKeyedList(items: unknown[], runtime: SignalsRuntime, parent: TemplateInstance): unknown[] {
  const result: unknown[] = [];
  const newKeyOrder: unknown[] = [];
  
  // First pass: collect keys and get/create instances
  const instances: Array<{ item: unknown; instance?: TemplateInstance; reused?: boolean; key?: unknown }> = [];
  for (const item of items) {
    if (item instanceof DynamicBinding && item.key !== undefined) {
      const { instance, reused } = parent.getOrCreateChild(item.key, () => 
        TemplateInstance.create(runtime, item.getTemplate(), item.values)
      );
      instances.push({ item, instance, reused, key: item.key });
      newKeyOrder.push(item.key);
    } else {
      instances.push({ item });
    }
  }
  
  // Get the previous order of keys
  const oldKeyOrder = parent.getChildKeyOrder();
  
  // Compute which items need to move
  const needsMove = computeItemsToMove(oldKeyOrder, newKeyOrder);
  
  // Second pass: build result, only extracting items that need to move
  for (const { item, instance, reused, key } of instances) {
    if (instance) {
      if (!reused) {
        // New item - use fragment
        result.push(instance.fragment);
      } else if (needsMove.has(key)) {
        // Reused but needs to move - extract and reinsert
        result.push(instance.extractContent());
      } else {
        // Reused and in same position - keep in place
        result.push(new KeepInPlace(instance.range));
      }
    } else {
      // Non-keyed item, process recursively
      result.push(processValue(item, runtime, parent));
    }
  }
  
  // Update the parent's child order
  parent.setChildKeyOrder(newKeyOrder);
  
  return result;
}

/**
 * Computes which items need to move based on comparing old and new key orders.
 * Uses longest increasing subsequence to minimize moves.
 */
function computeItemsToMove(oldOrder: unknown[], newOrder: unknown[]): Set<unknown> {
  // Build index map for old order
  const oldIndexMap = new Map<unknown, number>();
  for (let i = 0; i < oldOrder.length; i++) {
    oldIndexMap.set(oldOrder[i], i);
  }
  
  // Get indices in old array for each item in new array
  const oldIndices: number[] = [];
  const newKeys: unknown[] = [];
  for (const key of newOrder) {
    if (oldIndexMap.has(key)) {
      oldIndices.push(oldIndexMap.get(key)!);
      newKeys.push(key);
    }
  }
  
  // Find longest increasing subsequence - these items don't need to move
  const lis = longestIncreasingSubsequence(oldIndices);
  const stableIndices = new Set(lis);
  
  // Items not in the LIS need to move
  const needsMove = new Set<unknown>();
  for (let i = 0; i < oldIndices.length; i++) {
    if (!stableIndices.has(i)) {
      needsMove.add(newKeys[i]);
    }
  }
  
  return needsMove;
}

/**
 * Returns the indices of the longest increasing subsequence.
 */
function longestIncreasingSubsequence(arr: number[]): number[] {
  if (arr.length === 0) return [];
  
  const n = arr.length;
  const dp: number[] = new Array(n).fill(1);
  const parent: number[] = new Array(n).fill(-1);
  
  let maxLen = 1;
  let maxIdx = 0;
  
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[j] < arr[i] && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        parent[i] = j;
      }
    }
    if (dp[i] > maxLen) {
      maxLen = dp[i];
      maxIdx = i;
    }
  }
  
  // Reconstruct the indices
  const result: number[] = [];
  let idx = maxIdx;
  while (idx !== -1) {
    result.push(idx);
    idx = parent[idx];
  }
  
  return result.reverse();
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value === 'string') {
    return false;
  }
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

/**
 * Realized template in the DOM.
 * Has behavior: dispose() cleans up effects and event listeners.
 * Tracks child instances for reconciliation.
 */
export class TemplateInstance {
  readonly fragment: DocumentFragment;
  readonly parts: Part[];
  readonly #dispose: () => void;
  
  // DOM range tracking - where our content lives in the document
  #range: NodeRange;
  
  // Child instance tracking for reconciliation
  #children: TemplateInstance[] = [];
  #childrenByKey = new Map<unknown, TemplateInstance>();
  #childKeyOrder: unknown[] = [];

  constructor(fragment: DocumentFragment, parts: Part[], dispose: () => void, range: NodeRange) {
    this.fragment = fragment;
    this.parts = parts;
    this.#dispose = dispose;
    this.#range = range;
  }

  get children(): readonly TemplateInstance[] {
    return this.#children;
  }

  get range(): NodeRange {
    return this.#range;
  }

  getChildKeyOrder(): unknown[] {
    return this.#childKeyOrder;
  }

  setChildKeyOrder(order: unknown[]): void {
    this.#childKeyOrder = order;
  }

  /**
   * Extracts this instance's DOM nodes from the document.
   * Returns a DocumentFragment containing the nodes (including the start marker).
   * The range remains valid and will track the new location after reinsertion.
   */
  extractContent(): DocumentFragment {
    const fragment = document.createDocumentFragment();
    
    // Include the start marker so the range stays valid after reinsertion
    let node: Node | null = this.#range.start;
    const end = this.#range.end;
    
    while (node) {
      const next: Node | null = node.nextSibling;
      fragment.appendChild(node);
      if (node === end) break;
      node = next;
    }
    
    return fragment;
  }

  /**
   * Disposes all reactive effects, event listeners, and child instances.
   */
  dispose(): void {
    for (const child of this.#children) {
      child.dispose();
    }
    this.#children = [];
    this.#childrenByKey.clear();
    this.#dispose();
  }

  /**
   * Gets or creates a child instance for a keyed binding.
   * If an instance with the same key exists, it's reused and its DOM content extracted.
   * Returns the instance and whether it was reused.
   */
  getOrCreateChild(key: unknown, create: () => TemplateInstance): { instance: TemplateInstance; reused: boolean } {
    if (key !== undefined && this.#childrenByKey.has(key)) {
      const instance = this.#childrenByKey.get(key)!;
      return { instance, reused: true };
    }
    
    const instance = create();
    this.#children.push(instance);
    if (key !== undefined) {
      this.#childrenByKey.set(key, instance);
    }
    return { instance, reused: false };
  }

  /**
   * Creates a TemplateInstance from a template and values.
   */
  static create(runtime: SignalsRuntime, template: Template, values: unknown[]): TemplateInstance {
    if (template.descriptors.length !== values.length) {
      throw new Error('Template part mismatch.');
    }

    const fragment = template.cloneFragment();
    const parts = createParts(template.descriptors, fragment);
    const disposers: Array<() => void> = [];

    // Create start marker and range to track where our content is
    const startMarker = document.createComment('');
    fragment.insertBefore(startMarker, fragment.firstChild);
    const range = new NodeRange(startMarker, fragment.lastChild ?? startMarker);

    // Create instance first so children can be tracked
    const instance = new TemplateInstance(fragment, parts, () => {
      for (const disposer of disposers) {
        disposer();
      }
    }, range);

    parts.forEach((part, index) => {
      const value = values[index];
      if (typeof value === 'function') {
        if (part instanceof EventAttributePart) {
          part.setValue(value);
          disposers.push(() => part.dispose());
        }
        else {
          const dispose = runtime.effect(() => {
            const result = value();
            // Use processListValue for optimized list reconciliation
            const processed = processListValue(result, runtime, instance);
            part.setValue(processed);
          });
          disposers.push(dispose);
        }
      } else {
        const processed = processValue(value, runtime, instance);
        part.setValue(processed);
      }
    });

    return instance;
  }
}

/**
 * Dynamic template binding - extends StaticBinding with runtime and key.
 * Used for reactive templates that update when signals change.
 * 
 * @example
 * ```ts
 * const html = DynamicBinding.with(runtime);
 * const page = html`<div>${() => count()}</div>`;
 * document.body.appendChild(page.instance().fragment);
 * ```
 */
export class DynamicBinding extends StaticBinding {
  #runtime: SignalsRuntime;
  key?: unknown;

  constructor(strings: TemplateStringsArray, values: unknown[], runtime: SignalsRuntime) {
    super(strings, values);
    this.#runtime = runtime;
  }

  /**
   * Creates an html`` tag function bound to a specific runtime.
   * Supports both direct use (html`...`) and keyed use (html(key)`...`).
   */
  static with(runtime: SignalsRuntime): ((strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) {
    const htmlFunction = ((stringsOrKey?: TemplateStringsArray | unknown, ...values: unknown[]) => {
      // If called as a template tag: html``
      if (stringsOrKey && typeof stringsOrKey === 'object' && 'raw' in stringsOrKey) {
        return new DynamicBinding(stringsOrKey as TemplateStringsArray, values, runtime);
      }
      // If called as a function: html(key)
      const key = stringsOrKey;
      return (strings: TemplateStringsArray, ...values: unknown[]) => {
        const binding = new DynamicBinding(strings, values, runtime);
        if (key !== undefined) {
          binding.key = key;
        }
        return binding;
      };
    }) as ((strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding);

    return htmlFunction;
  }

  get runtime(): SignalsRuntime {
    return this.#runtime;
  }

  setKey(keyValue: unknown): this {
    this.key = keyValue;
    return this;
  }

  instance() {
    return TemplateInstance.create(this.#runtime, this.getTemplate(), this.values);
  }
}
