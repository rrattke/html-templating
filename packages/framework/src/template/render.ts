/**
 * Template instantiation and rendering.
 * Layer 3: Manages template instances, bindings, and reconciliation.
 */

import { NodeRange } from "./dom.js";
import { getTemplate, Template } from "./template.js";
import {
  createParts,
  EventAttributePart,
  NodePart,
  type Part,
} from "./parts.js";
import type { SignalsRuntime } from "../runtime.js";

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

  get template(): Template {
    return getTemplate(this.#strings);
  }

  /**
   * Renders the template to a DocumentFragment.
   * One-time rendering with no reactive updates.
   */
  render(): DocumentFragment {
    const template = this.template;
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
 * Dynamic template binding - extends StaticBinding with runtime and unique id.
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
  id?: unknown;

  constructor(strings: readonly string[], values: unknown[], runtime: SignalsRuntime) {
    super(strings, values);
    this.#runtime = runtime;
  }

  /**
   * Creates an html`` tag function bound to a specific runtime.
   * Supports both direct use (html`...`) and identified use (html(id)`...`).
   */
  static with(
    runtime: SignalsRuntime,
  ):
    & ((strings: readonly string[], ...values: unknown[]) => DynamicBinding)
    & ((id?: unknown) => (strings: readonly string[], ...values: unknown[]) => DynamicBinding) {
    const htmlFunction = ((stringsOrId?: readonly string[] | unknown, ...values: unknown[]) => {
      // If called as a template tag: html``
      if (Array.isArray(stringsOrId) && "raw" in stringsOrId) {
        return new DynamicBinding(stringsOrId as readonly string[], values, runtime);
      }
      // If called as a function: html(id)
      const id = stringsOrId;
      return (strings: readonly string[], ...values: unknown[]) => {
        const binding = new DynamicBinding(strings, values, runtime);
        if (id !== undefined) {
          binding.id = id;
        }
        return binding;
      };
    }) as
      & ((strings: readonly string[], ...values: unknown[]) => DynamicBinding)
      & ((id?: unknown) => (strings: readonly string[], ...values: unknown[]) => DynamicBinding);

    return htmlFunction;
  }

  get runtime(): SignalsRuntime {
    return this.#runtime;
  }

  instance() {
    return TemplateInstance.create(this.#runtime, this.template, this.values);
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
  readonly template: Template;

  // DOM range tracking - where our content lives in the document
  #range: NodeRange;

  constructor(fragment: DocumentFragment, parts: Part[], dispose: () => void, range: NodeRange, template: Template) {
    this.fragment = fragment;
    this.parts = parts;
    this.#dispose = dispose;
    this.#range = range;
    this.template = template;
  }

  update(values: unknown[]): void {
    this.parts.forEach((part, index) => {
      part.setValue(values[index]);
    });
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
      throw new Error("Template part mismatch.");
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
      const startMarker = document.createComment("");
      fragment.insertBefore(startMarker, fragment.firstChild);
      range = new NodeRange(startMarker, fragment.lastChild ?? startMarker);
    }

    // Create instance first
    const instance = new TemplateInstance(
      fragment,
      parts,
      () => {
        for (const disposer of disposers) {
          disposer();
        }
      },
      range,
      template,
    );

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
  disposers: Array<() => void>,
): void {
  if (typeof value === "function") {
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
  disposers: Array<() => void>,
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
  disposers: Array<() => void>,
): void {
  // Keyed list cache for this part
  const listState = {
    cache: new Map<unknown, TemplateInstance>(),
    order: [] as unknown[],
  };

  // Track current nested instance for single-template optimizations
  let activeInstance: TemplateInstance | null = null;

  // Ensure cache and active instance are cleaned up when part is disposed
  disposers.push(() => {
    listState.cache.forEach((i) => i.dispose());
    listState.cache.clear();
    if (activeInstance) {
      activeInstance.dispose();
      activeInstance = null;
    }
  });

  const dispose = runtime.effect(() => {
    const result = valueFn();

    // Optimized path for identified lists
    if (part instanceof NodePart && isListCandidate(result)) {
      const items = Array.from(result);
      if (hasIdentifiableItems(items)) {
        // Clear active instance if we switch to list
        if (activeInstance) {
          activeInstance.dispose();
          activeInstance = null;
        }
        reconcileList(items, runtime, part, listState);
        return;
      }
    }

    // Cleanup list state if we transitioned out of a list
    if (listState.cache.size > 0) {
      listState.cache.forEach((i) => i.dispose());
      listState.cache.clear();
      listState.order = [];
    }

    // NESTED TEMPLATE RECONCILIATION
    if (part instanceof NodePart && result instanceof DynamicBinding) {
      if (activeInstance && activeInstance.template === result.template) {
        // IDENTITY MATCH: Only update values, keep DOM nodes
        activeInstance.update(result.values);
        return;
      }

      // IDENTITY MISMATCH: Swap out instance
      if (activeInstance) {
        activeInstance.dispose();
      }

      // Create new instance
      activeInstance = TemplateInstance.create(runtime, result.template, result.values);
      part.setValue(activeInstance.fragment);
      return;
    }

    // CLEANUP ON PRIMITIVE SWAP
    if (activeInstance) {
      activeInstance.dispose();
      activeInstance = null;
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
  disposers: Array<() => void>,
): void {
  // Static initial value
  // We register cleanup to the instance's disposers list because there is no effect re-run
  const processed = processValue(value, runtime, (cleanup) => disposers.push(cleanup));
  part.setValue(processed);
}

/**
 * Helper to determine if a value might be a list.
 */
function isListCandidate(value: unknown): value is Iterable<unknown> {
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
    return Array.from(value).map((item) => processValueStatic(item));
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
  registerCleanup: (cleanup: () => void) => void,
): unknown {
  // Handle DynamicBinding by instantiating it
  if (value instanceof DynamicBinding) {
    const instance = TemplateInstance.create(runtime, value.template, value.values);
    registerCleanup(() => instance.dispose());
    return instance.fragment;
  }

  // Handle StaticBinding by rendering it (allows mixing static in dynamic templates)
  if (value instanceof StaticBinding) {
    return value.render();
  }

  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map((item) => processValue(item, runtime, registerCleanup));
  }

  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

/**
 * Reconciles a list directly into a NodePart's range.
 * Minimizes DOM mutations by only moving items that changed position.
 */
/**
 * State for list reconciliation.
 */
interface ListState {
  cache: Map<unknown, TemplateInstance>;
  order: unknown[];
}

/**
 * Intermediate entry for list reconciliation.
 */
interface ListEntry {
  instance: TemplateInstance;
  reused: boolean;
  id: unknown;
}

/**
 * Reconciles a list of items in the DOM.
 * Optimized to minimize DOM moves using the LIS algorithm.
 */
function reconcileList(
  items: unknown[],
  runtime: SignalsRuntime,
  part: NodePart,
  state: ListState,
): void {
  const range = part.range;
  const newOrder: unknown[] = [];

  // 1. Collect instances and determine reuse
  const { entries, currentIds } = collectInstances(
    runtime,
    items,
    state.cache,
    newOrder,
  );

  // 2. Remove unused instances
  cleanupRemovedInstances(state.cache, currentIds);

  // 3. Commit changes to the DOM
  commitReconciliation(
    range,
    entries,
    state,
    newOrder,
  );

  // Update state for next render
  state.order = newOrder;
}

/**
 * Collects template instances for the current list items.
 * Creates new instances or reuses existing ones from the cache.
 */
function collectInstances(
  runtime: SignalsRuntime,
  items: unknown[],
  cache: Map<unknown, TemplateInstance>,
  newOrder: unknown[],
): { entries: ListEntry[]; currentIds: Set<unknown>; } {
  const entries: ListEntry[] = [];
  const currentIds = new Set<unknown>();

  for (const item of items) {
    if (item instanceof DynamicBinding && item.id !== undefined) {
      currentIds.add(item.id);
      newOrder.push(item.id);

      let instance = cache.get(item.id);
      let reused = false;

      if (instance) {
        reused = true;
      } else {
        // Create new instance without registering a disposer to the parent list
        // Disposal is handled by the cache cleanup or item removal logic
        instance = TemplateInstance.create(runtime, item.template, item.values, true);
        cache.set(item.id, instance);
      }

      entries.push({ instance, reused, id: item.id });
    }
  }

  return { entries, currentIds };
}

/**
 * Disposes template instances that are no longer present in the list.
 */
function cleanupRemovedInstances(
  cache: Map<unknown, TemplateInstance>,
  currentIds: Set<unknown>,
): void {
  for (const [id, instance] of cache) {
    if (!currentIds.has(id)) {
      instance.dispose();
      cache.delete(id);
    }
  }
}

/**
 * Applies the reconciliation changes to the DOM.
 * Moves reused items and inserts new ones.
 */
function commitReconciliation(
  range: NodeRange,
  entries: ListEntry[],
  state: ListState,
  newOrder: unknown[],
): void {
  const needsMove = computeItemsToMove(state.order, newOrder);
  const movingFragments = extractMovingFragments(entries, needsMove);

  let insertionPoint = range.start;
  const parentNode = range.start.parentNode!;
  const endAnchor = range.end.nextSibling;

  for (const { instance, reused, id } of entries) {
    const instanceStart = instance.range.start;
    const instanceEnd = instance.range.end;

    // Clean up garbage nodes before the next item
    if (reused && !needsMove.has(id)) {
      NodeRange.removeNodes(insertionPoint, instanceStart);
    }

    if (!reused) {
      // New item
      parentNode.insertBefore(instance.fragment, insertionPoint.nextSibling);
    } else if (needsMove.has(id)) {
      // Moved item
      const fragment = movingFragments.get(id)!;
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
function extractMovingFragments(
  entries: ListEntry[],
  needsMove: Set<unknown>,
): Map<unknown, DocumentFragment> {
  const movingFragments = new Map<unknown, DocumentFragment>();
  for (const { instance, reused, id } of entries) {
    if (reused && needsMove.has(id)) {
      movingFragments.set(id, instance.extractContent());
    }
  }
  return movingFragments;
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
  if (n === 0) { return []; }

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
 * Checks if a list contains identifiable DynamicBindings.
 */
function hasIdentifiableItems(items: unknown[]): boolean {
  return items.some((item) => item instanceof DynamicBinding && item.id !== undefined);
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value === "string") {
    return false;
  }
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === "function";
}
