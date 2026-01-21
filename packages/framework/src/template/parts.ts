import type { TemplateBinding } from './instantiate.js';
import type { PartDescriptor } from './html.js';
import type { PartRuntime } from './runtime.js';

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

interface KeyedChild {
  range: NodeRange;
  dispose: () => void;
}

/**
 * Manages list rendering for both keyed and non-keyed content.
 * Handles creation, reordering, and disposal of list items.
 * 
 * KEYED ITEMS: Template bindings with keys are tracked and reused across updates.
 * When the same key appears in multiple updates, the existing DOM instance is reused
 * and moved, not recreated. Keys must be unique and stable.
 * 
 * Good key strategies:
 * - Unique IDs (UUIDs, database IDs, incrementing counters)
 * - Stable item properties (user.id, product.sku)
 * 
 * Bad key strategies:
 * - Array indices (changes when items are reordered/removed)
 * - Derived values that can collide (item.length + 1, current timestamp)
 * - Display labels (unless guaranteed to be unique and stable)
 * 
 * NON-KEYED ITEMS: All other content (non-keyed templates, nodes, primitives) is
 * disposed and recreated on every update. No reuse occurs for non-keyed items.
 */
class ListManager {
  #range: NodeRange;
  #keyedItems: Map<unknown, KeyedChild> = new Map();
  #nonKeyedDisposers: Array<() => void> = [];

  constructor(range: NodeRange) {
    this.#range = range;
  }

  /**
   * Updates the DOM to match the provided list of items.
   * - Keyed template bindings: reused when key matches (last occurrence wins for duplicate keys)
   * - Non-keyed items: disposed and recreated every update
   */
  update(entries: unknown[]): void {
    const parent = this.#range.start.parentNode;
    if (!parent) {
      return;
    }

    // Dispose all non-keyed items from previous update
    this.#disposeNonKeyed();

    const seen = new Set<unknown>();
    const fragment = this.#range.ownerDocument.createDocumentFragment();

    // Process all entries and build fragment
    for (const entry of entries) {
      // Check if this is a keyed template binding
      if (isTemplateBinding(entry) && entry.key !== undefined) {
        const key = entry.key;
        
        // For duplicate keys in the same update, last occurrence wins
        // So if we've already seen this key in THIS update, dispose the previous one
        if (seen.has(key)) {
          const existing = this.#keyedItems.get(key);
          if (existing) {
            existing.dispose();
            this.#keyedItems.delete(key);
          }
        }
        
        const existing = this.#keyedItems.get(key);

        if (existing) {
          this.#reuseKeyedItem(existing, fragment);
          seen.add(key);
        } else {
          this.#createKeyedItem(key, entry, fragment);
          seen.add(key);
        }
      } else {
        this.#processNonKeyedItem(entry, fragment);
      }
    }

    // Remove keyed children that are no longer present
    for (const [key, child] of Array.from(this.#keyedItems.entries())) {
      if (!seen.has(key)) {
        child.dispose();
        this.#keyedItems.delete(key);
      }
    }

    // Replace entire range contents with new fragment
    this.#range.deleteContents();
    this.#range.insertNode(fragment);
  }

  /**
   * Clears all keyed and non-keyed children and resets state.
   */
  clear(): void {
    this.#disposeNonKeyed();
    for (const child of this.#keyedItems.values()) {
      child.dispose();
    }
    this.#keyedItems.clear();
    this.#range.deleteContents();
  }

  /**
   * Returns true if this manager has any children (keyed or non-keyed).
   */
  hasChildren(): boolean {
    return this.#keyedItems.size > 0 || this.#nonKeyedDisposers.length > 0;
  }

  /**
   * Disposes all non-keyed items from the previous update.
   * Called at the start of each update.
   */
  #disposeNonKeyed(): void {
    while (this.#nonKeyedDisposers.length) {
      const dispose = this.#nonKeyedDisposers.pop();
      dispose?.();
    }
  }

  /**
   * Reuses an existing keyed item by extracting it from the DOM and appending to the fragment.
   * Note: We need to move both the marker and the content nodes to maintain the range structure.
   */
  #reuseKeyedItem(child: KeyedChild, fragment: DocumentFragment): void {
    // Get the marker and extract content nodes
    const marker = child.range.start;
    const contentFragment = child.range.extractContents();
    const contentNodes = Array.from(contentFragment.childNodes);
    
    // Remove marker from DOM
    marker.remove();
    
    // Add marker to fragment first
    fragment.appendChild(marker);
    // Then add content nodes
    for (const node of contentNodes) {
      fragment.appendChild(node);
    }
    
    // Update the range's end to point to the last content node (or marker if no content)
    // This is necessary because after extractContents(), the range was collapsed
    child.range = new NodeRange(marker, contentNodes.length > 0 ? contentNodes[contentNodes.length - 1] : marker);
  }

  /**
   * Creates a new keyed item by instantiating the template and tracking it.
   */
  #createKeyedItem(key: unknown, entry: TemplateBinding, fragment: DocumentFragment): void {
    const { fragment: itemFragment, dispose } = entry.instance();
    const marker = this.#range.ownerDocument.createComment('item');
    fragment.appendChild(marker);
    
    const nodes = Array.from(itemFragment.childNodes);
    for (const node of nodes) {
      fragment.appendChild(node);
    }
    
    const range = new NodeRange(marker, nodes.length > 0 ? nodes[nodes.length - 1] : marker);
    this.#keyedItems.set(key, { range, dispose });
  }

  /**
   * Processes a non-keyed item by preparing it and adding to the fragment.
   */
  #processNonKeyedItem(value: unknown, fragment: DocumentFragment): void {
    const prepared = this.#prepareItem(value);
    if (prepared.dispose) {
      this.#nonKeyedDisposers.push(prepared.dispose);
    }
    for (const node of prepared.nodes) {
      fragment.appendChild(node);
    }
  }

  /**
   * Prepares an item value into a list of nodes ready for insertion.
   * Handles TemplateBindings, Nodes, nested iterables, and primitives.
   * Returns array of nodes and optional dispose function.
   */
  #prepareItem(value: unknown): { nodes: Node[]; dispose?: () => void } {
    // Null/false → empty
    if (value == null || value === false) {
      return { nodes: [] };
    }

    // TemplateBinding → instantiate
    if (isTemplateBinding(value)) {
      const instance = value.instance();
      const nodes = Array.from(instance.fragment.childNodes);
      return { nodes, dispose: instance.dispose };
    }

    // Nested iterable → flatten recursively
    if (isIterable(value)) {
      const allNodes: Node[] = [];
      const disposers: Array<() => void> = [];
      
      for (const nested of value) {
        const prepared = this.#prepareItem(nested);
        allNodes.push(...prepared.nodes);
        if (prepared.dispose) {
          disposers.push(prepared.dispose);
        }
      }
      
      // Return composite disposer if any nested items need disposal
      return {
        nodes: allNodes,
        dispose: disposers.length > 0 ? () => disposers.forEach(d => d()) : undefined
      };
    }

    // Node → use directly
    if (value instanceof Node) {
      return { nodes: [value] };
    }

    // Primitive → text node
    return { nodes: [this.#range.ownerDocument.createTextNode(String(value))] };
  }
}

/**
 * Strategy interface for setting attribute or property values on elements.
 */
interface BindingStrategy {
  set(element: Element, name: string, value: unknown): void;
}

/**
 * Binding strategy that sets HTML attributes using setAttribute/removeAttribute.
 * Handles boolean values: null/false removes attribute, true sets empty string.
 */
class AttributeBinding implements BindingStrategy {
  set(element: Element, name: string, value: unknown): void {
    if (value == null || value === false) {
      element.removeAttribute(name);
      return;
    }
    if (value === true) {
      element.setAttribute(name, '');
      return;
    }
    element.setAttribute(name, String(value));
  }
}

/**
 * Binding strategy that sets element properties directly.
 */
class PropertyBinding implements BindingStrategy {
  set(element: Element, name: string, value: unknown): void {
    (element as unknown as Record<string, unknown>)[name] = value;
  }
}

// Module-wide singleton instances (exported for use in instantiate.ts)
export const ATTRIBUTE_BINDING = new AttributeBinding();
export const PROPERTY_BINDING = new PropertyBinding();

export class TextTemplate {
  #strings: string[];
  #values: unknown[];

  constructor(strings: string[]) {
    this.#strings = strings;
    this.#values = new Array(strings.length - 1).fill('');
  }

  setSlot(index: number, value: unknown): void {
    this.#values[index] = value;
  }

  render(): string {
    let result = this.#strings[0];
    for (let i = 0; i < this.#values.length; i++) {
      result += String(this.#values[i] ?? '');
      result += this.#strings[i + 1];
    }
    return result;
  }
}

/**
 * Tracks a range of nodes in the DOM using a start marker comment and an end node reference.
 * Content is inserted after the start marker. The end node points to the last inserted node.
 * When empty, both start and end point to the same marker comment (start === end means collapsed/empty).
 */
class NodeRange {
  #start: Comment;
  #end: Node;

  /**
   * Creates a new NodeRange.
   * @param start The start marker comment node
   * @param end The end node of the range (defaults to start, creating an empty/collapsed range)
   */
  constructor(start: Comment, end?: Node) {
    this.#start = start;
    this.#end = end ?? start;
  }

  /**
   * Extracts the range contents into a DocumentFragment, removing nodes from the DOM.
   * After extraction, the range is collapsed (end === start).
   * Returns an empty fragment if the range is already empty.
   */
  extractContents(): DocumentFragment {
    const fragment = this.#start.ownerDocument.createDocumentFragment();
    
    if (this.collapsed()) {
      return fragment;
    }

    let node = this.#start.nextSibling;
    while (node) {
      const next = node.nextSibling;
      const isEnd = node === this.#end;
      fragment.appendChild(node); // Implicitly removes from DOM
      if (isEnd) {
        break;
      }
      node = next;
    }
    
    this.#end = this.#start;
    return fragment;
  }

  /**
   * Clones the range contents into a DocumentFragment without removing nodes from the DOM.
   * The range remains unchanged.
   * Returns an empty fragment if the range is empty.
   */
  cloneContents(): DocumentFragment {
    const fragment = this.#start.ownerDocument.createDocumentFragment();
    
    if (this.collapsed()) {
      return fragment;
    }

    let node = this.#start.nextSibling;
    while (node) {
      fragment.appendChild(node.cloneNode(true));
      if (node === this.#end) {
        break;
      }
      node = node.nextSibling;
    }
    
    return fragment;
  }

  /**
   * Removes all nodes from after the start marker up to and including the end node.
   * After deleting contents, the range is empty (end === start).
   */
  deleteContents(): void {
    if (this.#end === this.#start) {
      return; // Already empty
    }

    let node = this.#start.nextSibling;
    while (node) {
      const next = node.nextSibling;
      const isEnd = node === this.#end;
      node.remove();
      if (isEnd) {
        break;
      }
      node = next;
    }
    this.#end = this.#start;
  }

  /**
   * Inserts a node or fragment into the range after deleting existing contents.
   * Updates end to point to the last inserted node.
   */
  insertNode(content: Node): void {
    this.deleteContents();
    
    const parent = this.#start.parentNode;
    if (!parent) {
      throw new Error('NodeRange marker is not attached to DOM');
    }

    if (content instanceof DocumentFragment) {
      const nodes = Array.from(content.childNodes);
      if (nodes.length === 0) {
        // Empty fragment, range remains empty
        return;
      }
      parent.insertBefore(content, this.#start.nextSibling);
      this.#end = nodes[nodes.length - 1];
    } else {
      parent.insertBefore(content, this.#start.nextSibling);
      this.#end = content;
    }
  }

  collapsed(): boolean {
    return this.#end === this.#start;
  }

  get start(): Comment {
    return this.#start;
  }

  get end(): Node {
    return this.#end;
  }

  get ownerDocument(): Document {
    return this.#start.ownerDocument;
  }
}

export class NodePart {
  #range: NodeRange;
  #listManager: ListManager | null = null;

  constructor(markerNode: Comment) {
    this.#range = new NodeRange(markerNode);
  }

  setValue(value: unknown): void {
    // null/undefined/false → clear (false enables conditional rendering: condition && html`...`)
    if (value == null || value === false) {
      this.#clearListManager();
      this.#range.deleteContents();
    } else if (isIterable(value) || (isTemplateBinding(value) && value.key !== undefined)) {
      // Delegate to ListManager for:
      // - Arrays/iterables (may contain keyed or non-keyed items)
      // - Single keyed template bindings
      if (!this.#listManager) {
        this.#range.deleteContents();
        this.#listManager = new ListManager(this.#range);
      }
      const entries = Array.isArray(value) ? value : [value];
      this.#listManager.update(entries);
    } else if (isTemplateBinding(value)) {
      // Non-keyed single template
      this.#clearListManager();
      const instance = value.instance();
      this.#range.insertNode(instance.fragment);
      // Note: Non-keyed single template disposal is not tracked
      // This is acceptable as it will be replaced on next setValue
    } else if (value instanceof Node) {
      this.#clearListManager();
      this.#range.insertNode(value);
    } else {
      // Primitive value (string, number, etc.)
      this.#clearListManager();
      this.#commitText(String(value));
    }
  }

  #clearListManager(): void {
    if (!this.#listManager) {
      return;
    }
    this.#listManager.clear();
    this.#listManager = null;
    this.#range.deleteContents();
  }

  #commitText(text: string): void {
    const node = this.#range.ownerDocument.createTextNode(text);
    this.#range.insertNode(node);
  }
}

/**
 * Attribute part for standard HTML attributes.
 * Handles boolean values: null/false removes attribute, true sets empty string.
 */
export class StandardAttributePart {
  #element: Element;
  #name: string;
  #strategy: BindingStrategy;

  constructor(element: Element, name: string) {
    this.#element = element;
    this.#name = name;
    this.#strategy = ATTRIBUTE_BINDING;
  }

  setValue(value: unknown): void {
    this.#strategy.set(this.#element, this.#name, value);
  }
}

/**
 * Attribute part for property bindings.
 * Sets element properties directly instead of using setAttribute.
 * Expects the property name without the '.' prefix (e.g., 'value' not '.value').
 */
export class PropertyAttributePart {
  #element: Element;
  #property: string;
  #strategy: BindingStrategy;

  constructor(element: Element, propertyName: string) {
    this.#element = element;
    this.#property = propertyName;
    this.#strategy = PROPERTY_BINDING;
  }

  setValue(value: unknown): void {
    this.#strategy.set(this.#element, this.#property, value);
  }
}

/**
 * Attribute part for event listeners.
 * Manages addEventListener/removeEventListener lifecycle.
 * Expects the event name without the 'on' prefix (e.g., 'click' not 'onclick').
 */
export class EventAttributePart {
  #element: Element;
  #eventName: string;
  #listener: EventListener | null = null;

  constructor(element: Element, eventName: string) {
    this.#element = element;
    this.#eventName = eventName;
  }

  setValue(value: unknown): void {
    if (this.#listener) {
      this.#element.removeEventListener(this.#eventName, this.#listener);
      this.#listener = null;
    }
    if (typeof value === 'function') {
      this.#listener = value as EventListener;
      this.#element.addEventListener(this.#eventName, this.#listener);
    }
  }

  dispose(): void {
    if (this.#listener) {
      this.#element.removeEventListener(this.#eventName, this.#listener);
      this.#listener = null;
    }
  }
}

/**
 * Attribute part for interpolated attributes with text templates.
 * Renders the template then applies via the provided binding strategy.
 */
export class TemplateAttributePart {
  #element: Element;
  #name: string;
  #textTemplate: TextTemplate;
  #slotIndex: number;
  #strategy: BindingStrategy;

  constructor(element: Element, name: string, textTemplate: TextTemplate, slotIndex: number, strategy: BindingStrategy) {
    this.#element = element;
    this.#name = name;
    this.#textTemplate = textTemplate;
    this.#slotIndex = slotIndex;
    this.#strategy = strategy;
  }

  setValue(value: unknown): void {
    this.#textTemplate.setSlot(this.#slotIndex, value);
    const rendered = this.#textTemplate.render();
    this.#strategy.set(this.#element, this.#name, rendered);
  }
}

export class TextContentPart {
  #element: Element;
  #textTemplate: TextTemplate | null = null;
  #slotIndex: number = 0;

  constructor(element: Element, textTemplate?: TextTemplate, slotIndex?: number) {
    this.#element = element;
    this.#textTemplate = textTemplate ?? null;
    this.#slotIndex = slotIndex ?? 0;
  }

  setValue(value: unknown): void {
    if (this.#textTemplate) {
      this.#textTemplate.setSlot(this.#slotIndex, value);
      this.#element.textContent = this.#textTemplate.render();
      return;
    }
    this.#element.textContent = String(value ?? '');
  }
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value === 'string') {
    return false;
  }
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

function isTemplateBinding(value: unknown): value is TemplateBinding {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  return 'strings' in (value as Record<string, unknown>) && 'values' in (value as Record<string, unknown>);
}
