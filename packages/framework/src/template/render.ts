/**
 * Template instantiation and rendering.
 * Layer 3: Manages template instances, bindings, and reconciliation.
 */

import { NodeRange } from './dom.js';
import { Template, getTemplate } from './template.js';
import { 
  EventAttributePart,
  NodePart,
  createParts,
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
  #strings: readonly string[];
  #values: unknown[];

  constructor(strings: readonly string[], values: unknown[]) {
    this.#strings = strings;
    this.#values = values;
  }

  get strings(): readonly string[] {
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

  constructor(strings: readonly string[], values: unknown[], runtime: SignalsRuntime) {
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

  constructor(fragment: DocumentFragment, parts: Part[], dispose: () => void, range: NodeRange) {
    this.fragment = fragment;
    this.parts = parts;
    this.#dispose = dispose;
    this.#range = range;
  }

  get range(): NodeRange {
    return this.#range;
  }

  /**
   * Extracts this instance's DOM nodes from the document.
   * Returns a DocumentFragment containing the nodes.
   * For instances with markers, includes the marker. For list items, only content.
   * The range remains valid and will track the new location after reinsertion.
   */
  extractContent(): DocumentFragment {
    return NodeRange.extractInclusive(this.#range.start, this.#range.end);
  }

  /**
   * Disposes all reactive effects and event listeners.
   */
  dispose(): void {
    this.#dispose();
  }

  /**
   * Creates a TemplateInstance from a template and values.
   * @param skipMarker If true, don't create a start marker (used for list items)
   */
  static create(runtime: SignalsRuntime, template: Template, values: unknown[], skipMarker = false): TemplateInstance {
    if (template.descriptors.length !== values.length) {
      throw new Error('Template part mismatch.');
    }

    const fragment = template.cloneFragment();
    const parts = createParts(template.descriptors, fragment);
    const disposers: Array<() => void> = [];

    // Create start marker and range to track where our content is
    // List items skip marker creation to reduce DOM overhead
    let range: NodeRange;
    if (skipMarker) {
      // List items always have content from the template
      range = new NodeRange(fragment.firstChild!, fragment.lastChild!);
    } else {
      // Regular instances: marker as start, last child as end (or marker if empty)
      const startMarker = document.createComment('');
      fragment.insertBefore(startMarker, fragment.firstChild);
      range = new NodeRange(startMarker, fragment.lastChild ?? startMarker);
    }

    // Create instance first
    const instance = new TemplateInstance(fragment, parts, () => {
      for (const disposer of disposers) {
        disposer();
      }
    }, range);

    // Initialize all parts
    parts.forEach((part, index) => {
      processPart(part, values[index], runtime, disposers);
    });

    return instance;
  }
}

/**
 * Configures a part with its value, handling both static and reactive bindings.
 * @param part The template part to configure
 * @param value The value to bind
 * @param runtime SignalsRuntime for effect creation
 * @param disposers Array to collect cleanup functions
 */
function processPart(
  part: Part,
  value: unknown,
  runtime: SignalsRuntime,
  disposers: Array<() => void>
): void {
  if (typeof value === 'function') {
    if (part instanceof EventAttributePart) {
      setupEventBinding(part, value as EventListener, disposers);
    } else {
      setupReactiveBinding(part, value as () => unknown, runtime, disposers);
    }
  } else {
    setupStaticPartBinding(part, value, runtime, disposers);
  }
}

/**
 * Sets up an event listener binding.
 * @param part Event attribute part
 * @param handler Event listener function
 * @param disposers Collection of cleanup functions
 */
function setupEventBinding(
  part: EventAttributePart,
  handler: EventListener,
  disposers: Array<() => void>
): void {
  part.setValue(handler);
  disposers.push(() => part.dispose());
}

/**
 * Sets up a reactive binding that updates when signals change.
 * Handles both standard values and keyed lists.
 * @param part Check if this needs list reconciliation
 * @param valueFn Signal getter or computed function
 * @param runtime SignalsRuntime
 * @param disposers Collection of cleanup functions
 */
function setupReactiveBinding(
  part: Part,
  valueFn: () => unknown,
  runtime: SignalsRuntime,
  disposers: Array<() => void>
): void {
  // Keyed list cache for this part
  const keyedState = {
    cache: new Map<unknown, TemplateInstance>(),
    order: [] as unknown[]
  };

  // Ensure cache is cleaned up when part is disposed
  disposers.push(() => {
    keyedState.cache.forEach(i => i.dispose());
    keyedState.cache.clear();
  });

  const dispose = runtime.effect(() => {
    const result = valueFn();
    
    // Optimized path for keyed lists
    if (part instanceof NodePart && isKeyedListCandidate(result)) {
      const items = Array.from(result);
      if (hasKeyedItems(items)) {
        reconcileKeyedList(items, runtime, part, keyedState);
        return;
      }
    }
    
    // Cleanup keyed state if we transitioned out of a keyed list
    if (keyedState.cache.size > 0) {
      keyedState.cache.forEach(i => i.dispose());
      keyedState.cache.clear();
      keyedState.order = [];
    }
    
    // Standard processing
    const processed = processValue(result, runtime, (cleanup) => {
        // Register cleanup for created instances
        // We use runtime.onCleanup so it runs when this effect re-runs
        runtime.onCleanup(cleanup);
    });
    part.setValue(processed);
  });
  
  disposers.push(dispose);
}

/**
 * Sets up a one-time static binding.
 * @param part Target part
 * @param value Static value
 * @param runtime Runtime (needed for nested dynamic content)
 * @param disposers Collection of cleanup functions
 */
function setupStaticPartBinding(
  part: Part,
  value: unknown,
  runtime: SignalsRuntime,
  disposers: Array<() => void>
): void {
  // Static initial value
  // We register cleanup to the instance's disposers list because there is no effect re-run
  const processed = processValue(value, runtime, (cleanup) => disposers.push(cleanup));
  part.setValue(processed);
}

/**
 * Helper to determine if a value might be a keyed list.
 */
function isKeyedListCandidate(value: unknown): value is Iterable<unknown> {
  return isIterable(value);
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
 * Registers disposal of created instances.
 */
function processValue(
  value: unknown, 
  runtime: SignalsRuntime, 
  registerCleanup: (cleanup: () => void) => void
): unknown {
  // Handle DynamicBinding by instantiating it
  if (value instanceof DynamicBinding) {
    const instance = TemplateInstance.create(runtime, value.getTemplate(), value.values);
    registerCleanup(() => instance.dispose());
    return instance.fragment;
  }
  
  // Handle StaticBinding by rendering it (allows mixing static in dynamic templates)
  if (value instanceof StaticBinding) {
    return value.render();
  }
  
  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map(item => processValue(item, runtime, registerCleanup));
  }
  
  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

/**
 * Reconciles a keyed list directly into a NodePart's range.
 * Minimizes DOM mutations by only moving items that changed position.
 */
/**
 * State for keyed list reconciliation.
 */
interface KeyedListState {
  cache: Map<unknown, TemplateInstance>;
  order: unknown[];
}

/**
 * Intermediate entry for keyed list reconciliation.
 */
interface KeyedEntry {
  instance: TemplateInstance;
  reused: boolean;
  key: unknown;
}

/**
 * Reconciles a keyed list of items in the DOM.
 * Optimized to minimize DOM moves using the LIS algorithm.
 */
function reconcileKeyedList(
  items: unknown[], 
  runtime: SignalsRuntime, 
  part: NodePart,
  state: KeyedListState
): void {
  const range = part.range;
  const newKeyOrder: unknown[] = [];
  
  // 1. Collect instances and determine reuse
  const { entries, currentKeys } = collectKeyedInstances(
    runtime, 
    items, 
    state.cache, 
    newKeyOrder
  );

  // 2. Remove unused instances
  cleanupRemovedInstances(state.cache, currentKeys);

  // 3. Commit changes to the DOM
  commitKeyedReconciliation(
    range,
    entries,
    state,
    newKeyOrder
  );
  
  // Update state for next render
  state.order = newKeyOrder;
}

/**
 * Collects template instances for the current list items.
 * Creates new instances or reuses existing ones from the cache.
 */
function collectKeyedInstances(
  runtime: SignalsRuntime,
  items: unknown[],
  cache: Map<unknown, TemplateInstance>,
  newKeyOrder: unknown[]
): { entries: KeyedEntry[], currentKeys: Set<unknown> } {
  const entries: KeyedEntry[] = [];
  const currentKeys = new Set<unknown>();

  for (const item of items) {
    if (item instanceof DynamicBinding && item.key !== undefined) {
      currentKeys.add(item.key);
      newKeyOrder.push(item.key);
      
      let instance = cache.get(item.key);
      let reused = false;
      
      if (instance) {
        reused = true;
      } else {
        // Create new instance without registering a disposer to the parent list
        // Disposal is handled by the cache cleanup or item removal logic
        instance = TemplateInstance.create(runtime, item.getTemplate(), item.values, true);
        cache.set(item.key, instance);
      }

      entries.push({ instance, reused, key: item.key });
    }
  }
  
  return { entries, currentKeys };
}

/**
 * Disposes template instances that are no longer present in the list.
 */
function cleanupRemovedInstances(
  cache: Map<unknown, TemplateInstance>,
  currentKeys: Set<unknown>
): void {
  for (const [key, instance] of cache) {
    if (!currentKeys.has(key)) {
      instance.dispose();
      cache.delete(key);
    }
  }
}

/**
 * Applies the reconciliation changes to the DOM.
 * Moves reused items and inserts new ones.
 */
function commitKeyedReconciliation(
  range: NodeRange,
  entries: KeyedEntry[],
  state: KeyedListState,
  newKeyOrder: unknown[]
): void {
  const needsMove = computeItemsToMove(state.order, newKeyOrder);
  const movedFragments = extractMovedFragments(entries, needsMove);
  
  let insertionPoint = range.start;
  const parentNode = range.start.parentNode!;
  const endAnchor = range.end.nextSibling;

  for (const { instance, reused, key } of entries) {
    const instanceStart = instance.range.start;
    const instanceEnd = instance.range.end;
    
    // Clean up garbage nodes before the next item
    if (reused && !needsMove.has(key)) {
      NodeRange.removeNodes(insertionPoint, instanceStart);
    }

    if (!reused) {
      // New item
      parentNode.insertBefore(instance.fragment, insertionPoint.nextSibling);
    } else if (needsMove.has(key)) {
      // Moved item
      const fragment = movedFragments.get(key)!;
      parentNode.insertBefore(fragment, insertionPoint.nextSibling);
    }
    // Else: reused and not moved, already in place
    
    insertionPoint = instanceEnd;
  }
  
  // Remove trailing garbage
  NodeRange.removeNodes(insertionPoint, endAnchor);

  // Update range end
  if (entries.length > 0) {
    range.setEnd(entries[entries.length - 1].instance.range.end);
  } else {
    range.setEnd(range.start);
  }
}

/**
 * Extracts content for items that need to be moved to preserve state.
 */
function extractMovedFragments(
  entries: KeyedEntry[], 
  needsMove: Set<unknown>
): Map<unknown, DocumentFragment> {
  const movedFragments = new Map<unknown, DocumentFragment>();
  for (const { instance, reused, key } of entries) {
    if (reused && needsMove.has(key)) {
      movedFragments.set(key, instance.extractContent());
    }
  }
  return movedFragments;
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
 * Computes the Longest Increasing Subsequence (LIS) of an array of numbers.
 * The function returns the *indices* of the items that make up the subsequence.
 * This is used for list reconciliation to find the largest set of items that stay 
 * in relative order, allowing us to move only the remaining items.
 * 
 * Algorithm: O(n log n) using binary search (patience sorting variant).
 * 
 * @param arr The input array of numbers (e.g., indices from the old list).
 * @return An array of *indices from the input array* that form the LIS.
 * 
 * @example
 * // Input values: [10, 20, 5, 30]
 * // Indices:      [0,  1,  2, 3]
 * // LIS values:   [10, 20, 30]
 * // LIS indices:  [0, 1, 3]
 * longestIncreasingSubsequence([10, 20, 5, 30]) // -> [0, 1, 3]
 */
export function longestIncreasingSubsequence(arr: number[]): number[] {
  const n = arr.length;
  if (n === 0) return [];
  
  const result: number[] = [];
  const p = new Int32Array(n);
  
  for (let i = 0; i < n; i++) {
    const val = arr[i];
    
    if (result.length === 0 || val > arr[result[result.length - 1]]) {
      if (result.length > 0) {
        p[i] = result[result.length - 1];
      }
      result.push(i);
      continue;
    }
    
    let u = 0;
    let v = result.length - 1;
    while (u < v) {
      const c = (u + v) >>> 1;
      if (arr[result[c]] < val) {
        u = c + 1;
      } else {
        v = c;
      }
    }
    
    if (val < arr[result[u]]) {
      if (u > 0) {
        p[i] = result[u - 1];
      }
      result[u] = i;
    }
  }
  
  let u = result.length;
  let v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  
  return result;
}

/**
 * Checks if a list contains keyed DynamicBindings.
 */
function hasKeyedItems(items: unknown[]): boolean {
  return items.some(item => item instanceof DynamicBinding && item.key !== undefined);
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value === 'string') {
    return false;
  }
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}
