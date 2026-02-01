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

    parts.forEach((part, index) => {
      const value = values[index];
      if (typeof value === 'function') {
        if (part instanceof EventAttributePart) {
          part.setValue(value);
          disposers.push(() => part.dispose());
        }
        else {
          // Keyed list cache for this part
          const keyedState = {
            cache: new Map<unknown, TemplateInstance>(),
            order: [] as unknown[]
          };
          
          // Dispose cache when this part (and instance) is disposed
          disposers.push(() => {
            keyedState.cache.forEach(i => i.dispose());
            keyedState.cache.clear();
          });

          const dispose = runtime.effect(() => {
            const result = value();
            
            // For NodeParts with keyed lists, use optimized reconciliation
            if (part instanceof NodePart && isIterable(result)) {
              const items = Array.from(result);
              if (hasKeyedItems(items)) {
                reconcileKeyedList(items, runtime, part, keyedState);
                return;
              }
            }
            
            // If switching away from keyed list, clear cache
            if (keyedState.cache.size > 0) {
              keyedState.cache.forEach(i => i.dispose());
              keyedState.cache.clear();
              keyedState.order = [];
            }
            
            // Standard processing for non-keyed values
            const processed = processValue(result, runtime, (cleanup) => {
                // Register cleanup for created instances
                // We use runtime.onCleanup so it runs when this effect re-runs
                runtime.onCleanup(cleanup);
            });
            part.setValue(processed);
          });
          disposers.push(dispose);
        }
      } else {
        // Static initial value
        // We register cleanup to the instance's disposers list because there is no effect re-run
        const processed = processValue(value, runtime, (cleanup) => disposers.push(cleanup));
        part.setValue(processed);
      }
    });

    return instance;
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
function reconcileKeyedList(
  items: unknown[], 
  runtime: SignalsRuntime, 
  part: NodePart,
  state: { cache: Map<unknown, TemplateInstance>, order: unknown[] }
): void {
  const range = part.range;
  const newKeyOrder: unknown[] = [];
  
  // Reference node to know where the list ends in the DOM
  const endAnchor = range.end.nextSibling;
  
  // First pass: collect keys and get/create instances
  const entries: Array<{ 
    instance: TemplateInstance; 
    reused: boolean; 
    key: unknown;
  }> = [];
  
  const currentKeys = new Set<unknown>();

  for (const item of items) {
    if (item instanceof DynamicBinding && item.key !== undefined) {
      currentKeys.add(item.key);
      
      let instance = state.cache.get(item.key);
      let reused = false;
      
      if (instance) {
        reused = true;
      } else {
        // Create new instance without registering a disposer to the parent list
        // Disposal is handled by the cache cleanup or item removal logic
        instance = TemplateInstance.create(runtime, item.getTemplate(), item.values, true);
        state.cache.set(item.key, instance);
      }

      entries.push({ instance, reused, key: item.key });
      newKeyOrder.push(item.key);
    }
  }

  // Detect and dispose removed items
  for (const [key, instance] of state.cache) {
    if (!currentKeys.has(key)) {
      instance.dispose();
      state.cache.delete(key);
    }
  }
  
  // Get the previous order of keys
  const oldKeyOrder = state.order;
  
  // Compute which items need to move
  const needsMove = computeItemsToMove(oldKeyOrder, newKeyOrder);
  
  // Extract reused items that need to move
  const movedFragments = new Map<unknown, DocumentFragment>();
  for (const { instance, reused, key } of entries) {
    if (reused && needsMove.has(key)) {
      movedFragments.set(key, instance.extractContent());
    }
  }
  
  // Track our insertion point as we reconcile
  let insertionPoint: Node = range.start;
  const parentNode = range.start.parentNode!;
  
  for (const { instance, reused, key } of entries) {
    const instanceStart = instance.range.start;
    const instanceEnd = instance.range.end;
    
    // Clean up garbage nodes before the next item
    if (reused && !needsMove.has(key)) {
      let node = insertionPoint.nextSibling;
      while (node && node !== instanceStart && node !== endAnchor) {
        const next = node.nextSibling;
        node.remove();
        node = next;
      }
    }

    if (!reused) {
      parentNode.insertBefore(instance.fragment, insertionPoint.nextSibling);
      insertionPoint = instanceEnd;
    } else if (needsMove.has(key)) {
      const fragment = movedFragments.get(key)!;
      parentNode.insertBefore(fragment, insertionPoint.nextSibling);
      insertionPoint = instanceEnd;
    } else {
      insertionPoint = instanceEnd;
    }
  }
  
  // Remove any remaining nodes after the last item up to the boundary
  let node = insertionPoint.nextSibling;
  while (node && node !== endAnchor) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }
  
  // Update range end
  if (entries.length > 0) {
    range.setEnd(entries[entries.length - 1].instance.range.end);
  } else {
    range.setEnd(range.start);
  }
  
  // Update state order for next run
  state.order = newKeyOrder;
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
