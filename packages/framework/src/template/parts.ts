import type { TemplateResult } from './html.js';

type TemplateFactory = (result: TemplateResult) => { fragment: DocumentFragment; dispose: () => void };

interface KeyedChild {
  start: Comment;
  end: Comment;
  dispose: () => void;
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

export class NodePart {
  #start: Comment;
  #end: Comment;
  #current: Node | null = null;
  #instantiateNested: TemplateFactory;
  #childDisposers: Array<() => void> = [];
  #keyedChildren: Map<unknown, KeyedChild> | null = null;

  constructor(markerNode: Comment, instantiateNested: TemplateFactory) {
    const doc = markerNode.ownerDocument;
    this.#start = doc.createComment('part-start');
    this.#end = doc.createComment('part-end');
    markerNode.replaceWith(this.#start, this.#end);
    this.#instantiateNested = instantiateNested;
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
      if (entries.every(e => isTemplateResult(e) && e.key !== undefined)) {
        this.#commitKeyed(entries as TemplateResult[]);
      } else {
        this.#clearKeyedState();
        this.#disposeChildren();
        this.#commitIterableEntries(entries);
      }
      return;
    }
    this.#clearKeyedState();
    this.#disposeChildren();
    if (isTemplateResult(value)) {
      this.#commitTemplate(value);
      return;
    }
    if (value instanceof Node) {
      this.#commitNode(value);
      return;
    }
    this.#commitText(String(value));
  }

  #commitTemplate(result: TemplateResult): void {
    const instance = this.#instantiateNested(result);
    this.#childDisposers.push(instance.dispose);
    this.#commitNode(instance.fragment);
  }

  #commitIterableEntries(values: unknown[]): void {
    const fragment = this.#end.ownerDocument.createDocumentFragment();
    for (const value of values) {
      this.#appendIterableValue(fragment, value);
    }
    this.#commitNode(fragment);
  }

  #commitKeyed(entries: TemplateResult[]): void {
    const parent = this.#end.parentNode;
    if (!parent) {
      return;
    }
    if (!this.#keyedChildren) {
      this.#keyedChildren = new Map();
    }
    const seen = new Set<unknown>();
    let anchor: ChildNode | null = this.#end;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const existing = this.#keyedChildren.get(entry.key!);
      if (existing) {
        this.#moveKeyedChild(existing, anchor);
        anchor = existing.start;
      } else {
        const child = this.#createKeyedChild(entry, anchor);
        this.#keyedChildren.set(entry.key!, child);
        anchor = child.start;
      }
      seen.add(entry.key!);
    }
    for (const [key, child] of Array.from(this.#keyedChildren.entries())) {
      if (!seen.has(key)) {
        this.#removeKeyedChild(child);
        this.#keyedChildren.delete(key);
      }
    }
    this.#current = null;
  }

  #appendIterableValue(target: DocumentFragment, value: unknown): void {
    if (value == null || value === false) {
      return;
    }
    if (isTemplateResult(value)) {
      const instance = this.#instantiateNested(value);
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
    target.appendChild(this.#end.ownerDocument.createTextNode(String(value)));
  }

  #disposeChildren(): void {
    while (this.#childDisposers.length) {
      const dispose = this.#childDisposers.pop();
      dispose?.();
    }
  }

  #clearKeyedState(): void {
    if (!this.#keyedChildren) {
      return;
    }
    for (const child of this.#keyedChildren.values()) {
      this.#removeKeyedChild(child);
    }
    this.#keyedChildren = null;
    this.#current = null;
  }

  #commitText(text: string): void {
    if (this.#current instanceof Text) {
      if (this.#current.data !== text) {
        this.#current.data = text;
      }
      return;
    }
    const node = this.#end.ownerDocument.createTextNode(text);
    this.#setNode(node);
  }

  #commitNode(node: Node): void {
    if (this.#current === node) {
      return;
    }
    this.#setNode(node);
  }

  #setNode(node: Node): void {
    this.#clearRange();
    this.#end.parentNode?.insertBefore(node, this.#end);
    this.#current = node;
  }

  #clearRange(): void {
    let pointer = this.#start.nextSibling;
    while (pointer && pointer !== this.#end) {
      const next = pointer.nextSibling;
      pointer.remove();
      pointer = next;
    }
    this.#current = null;
  }

  #createKeyedChild(template: TemplateResult, anchor: ChildNode | null): KeyedChild {
    const { fragment, dispose } = this.#instantiateNested(template);
    const doc = this.#end.ownerDocument;
    const start = doc.createComment('key-start');
    const end = doc.createComment('key-end');
    const wrapper = doc.createDocumentFragment();
    wrapper.append(start);
    wrapper.append(fragment);
    wrapper.append(end);
    this.#end.parentNode?.insertBefore(wrapper, anchor);
    return { start, end, dispose };
  }

  #moveKeyedChild(child: KeyedChild, anchor: ChildNode | null): void {
    const parent = this.#end.parentNode;
    if (!parent) {
      return;
    }
    let node: ChildNode | null = child.start;
    while (node) {
      const next: ChildNode | null = node.nextSibling;
      parent.insertBefore(node, anchor);
      if (node === child.end) {
        break;
      }
      node = next;
    }
  }

  #removeKeyedChild(child: KeyedChild): void {
    child.dispose();
    let node: ChildNode | null = child.start;
    while (node) {
      const next: ChildNode | null = node.nextSibling;
      node.remove();
      if (node === child.end) {
        break;
      }
      node = next;
    }
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

function isTemplateResult(value: unknown): value is TemplateResult {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  return 'strings' in (value as Record<string, unknown>) && 'values' in (value as Record<string, unknown>);
}
