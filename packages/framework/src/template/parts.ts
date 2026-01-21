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
 * Manages keyed template instances for efficient DOM updates.
 * Handles creation, reordering, and disposal of keyed children.
 * 
 * IMPORTANT: Keys must be unique and stable. When the same key appears in multiple
 * updates, the existing DOM instance is reused and moved, not recreated. This means:
 * - Keys should uniquely identify each item across all updates
 * - Reusing a key will reuse the existing DOM element (no new instance created)
 * - Key collisions will cause unexpected behavior (items appearing in wrong positions)
 * 
 * Good key strategies:
 * - Unique IDs (UUIDs, database IDs, incrementing counters)
 * - Stable item properties (user.id, product.sku)
 * 
 * Bad key strategies:
 * - Array indices (changes when items are reordered/removed)
 * - Derived values that can collide (item.length + 1, current timestamp)
 * - Display labels (unless guaranteed to be unique and stable)
 */
class ListManager {
  #range: NodeRange;
  #items: Map<unknown, KeyedChild> = new Map();
  #disposers: Array<() => void> = [];

  constructor(range: NodeRange) {
    this.#range = range;
  }

  /**
   * Updates the DOM to match the provided keyed binding(s).
   * Accepts either a single keyed template or an array of keyed templates.
   * Reuses existing instances with matching keys, creates new ones, and removes old ones.
   */
  update(value: TemplateBinding | TemplateBinding[]): void {
    const entries = Array.isArray(value) ? value : [value];
    const parent = this.#range.start.parentNode;
    if (!parent) {
      return;
    }

    const seen = new Set<unknown>();
    let anchor: ChildNode | null = this.#range.start;

    // Process entries in reverse order to maintain correct DOM order
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const key = entry.key!;
      const existing = this.#items.get(key);

      if (existing) {
        // Reuse existing child, move to correct position
        this.#moveItem(existing, anchor);
        anchor = existing.range.start;
      } else {
        // Create new child
        const child = this.#createItem(entry, anchor);
        this.#items.set(key, child);
        this.#disposers.push(child.dispose);
        anchor = child.range.start;
      }
      seen.add(key);
    }

    // Remove children that are no longer present
    for (const [key, child] of Array.from(this.#items.entries())) {
      if (!seen.has(key)) {
        const disposeIndex = this.#disposers.indexOf(child.dispose);
        if (disposeIndex !== -1) {
          this.#disposers.splice(disposeIndex, 1);
        }
        this.#removeItem(child);
        this.#items.delete(key);
      }
    }
  }

  /**
   * Clears all keyed children and resets state.
   */
  clear(): void {
    for (const child of this.#items.values()) {
      this.#removeItem(child);
    }
    this.#items.clear();
    this.#disposers = [];
  }

  /**
   * Returns true if this manager has any keyed children.
   */
  hasChildren(): boolean {
    return this.#items.size > 0;
  }

  #createItem(binding: TemplateBinding, anchor: ChildNode | null): KeyedChild {
    const { fragment, dispose } = binding.instance();
    const marker = this.#range.ownerDocument.createComment('item');
    this.#range.start.parentNode?.insertBefore(marker, anchor);
    
    const range = new NodeRange(marker);
    range.insertNode(fragment);
    
    return { range, dispose };
  }

  #moveItem(child: KeyedChild, anchor: ChildNode | null): void {
    const parent = this.#range.start.parentNode;
    if (!parent) {
      return;
    }
    
    // Move all nodes in the range (marker + content)
    let node: ChildNode | null = child.range.start;
    const endNode = child.range.end;
    
    while (node) {
      const next: ChildNode | null = node.nextSibling;
      parent.insertBefore(node, anchor);
      if (node === endNode) {
        break;
      }
      node = next;
    }
  }

  #removeItem(child: KeyedChild): void {
    child.dispose();
    child.range.deleteContents();
    child.range.start.remove();
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
  #childDisposers: Array<() => void> = [];
  #listManager: ListManager | null = null;

  constructor(markerNode: Comment) {
    this.#range = new NodeRange(markerNode);
  }

  setValue(value: unknown): void {
    if (value == null || value === false) {
      this.#clearKeyedState();
      this.#disposeChildren();
      this.#commitText('');
      return;
    }
    if (isIterable(value)) {
      const entries = Array.from(value);
      if (entries.every(e => isTemplateBinding(e) && e.key !== undefined)) {
        this.#commitKeyed(entries as TemplateBinding[]);
      } else {
        this.#clearKeyedState();
        this.#disposeChildren();
        this.#commitIterableEntries(entries);
      }
      return;
    }
    if (isTemplateBinding(value)) {
      if (value.key !== undefined) {
        this.#commitKeyed(value);
      } else {
        this.#clearKeyedState();
        this.#disposeChildren();
        this.#commitTemplate(value);
      }
      return;
    }
    this.#clearKeyedState();
    this.#disposeChildren();
    if (value instanceof Node) {
      this.#commitNode(value);
      return;
    }
    this.#commitText(String(value));
  }

  #commitTemplate(binding: TemplateBinding): void {
    const instance = binding.instance();
    this.#childDisposers.push(instance.dispose);
    this.#commitNode(instance.fragment);
  }

  #commitIterableEntries(values: unknown[]): void {
    const fragment = this.#range.ownerDocument.createDocumentFragment();
    for (const value of values) {
      this.#appendIterableValue(fragment, value);
    }
    this.#commitNode(fragment);
  }

  #commitKeyed(value: TemplateBinding | TemplateBinding[]): void {
    const parent = this.#range.start.parentNode;
    if (!parent) {
      return;
    }
    if (!this.#listManager) {
      // Transitioning from non-keyed to keyed - clear non-keyed content
      this.#disposeChildren();
      this.#range.deleteContents();
      this.#listManager = new ListManager(this.#range);
    }
    
    this.#listManager.update(value);
  }

  #appendIterableValue(target: DocumentFragment, value: unknown): void {
    if (value == null || value === false) {
      return;
    }
    if (isTemplateBinding(value)) {
      const instance = value.instance();
      this.#childDisposers.push(instance.dispose);
      target.appendChild(instance.fragment);
      return;
    }
    if (isIterable(value)) {
      for (const nested of value) {
        this.#appendIterableValue(target, nested);
      }
      return;
    }
    if (value instanceof Node) {
      target.appendChild(value);
      return;
    }
    target.appendChild(this.#range.ownerDocument.createTextNode(String(value)));
  }

  #disposeChildren(): void {
    while (this.#childDisposers.length) {
      const dispose = this.#childDisposers.pop();
      dispose?.();
    }
  }

  #clearKeyedState(): void {
    if (!this.#listManager) {
      return;
    }
    this.#listManager.clear();
    this.#listManager = null;
    this.#childDisposers = [];
    this.#range.deleteContents();
  }

  #commitText(text: string): void {
    const node = this.#range.ownerDocument.createTextNode(text);
    this.#range.insertNode(node);
  }

  #commitNode(node: Node): void {
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
