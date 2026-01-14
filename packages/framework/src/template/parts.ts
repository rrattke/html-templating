import type { TemplateResult } from './html.js';

type TemplateFactory = (result: TemplateResult) => { fragment: DocumentFragment; dispose: () => void };

interface KeyedChild {
  start: Comment;
  end: Comment;
  dispose: () => void;
}

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

export class AttributePart {
  #listener: EventListener | null = null;
  #isPropertyBinding: boolean;
  #isEvent: boolean;
  #element: Element;
  #name: string;
  #textTemplate: TextTemplate | null = null;
  #slotIndex: number = 0;

  constructor(element: Element, name: string, textTemplate?: TextTemplate, slotIndex?: number) {
    this.#element = element;
    this.#name = name;
    this.#isPropertyBinding = this.#name.startsWith('.');
    this.#isEvent = this.#name.startsWith('on');
    this.#textTemplate = textTemplate ?? null;
    this.#slotIndex = slotIndex ?? 0;
  }

  get isEvent(): boolean {
    return this.#isEvent;
  }

  setValue(value: unknown): void {
    if (this.#textTemplate) {
      this.#textTemplate.setSlot(this.#slotIndex, value);
      this.#applyTextTemplate();
      return;
    }
    if (this.#isEvent) {
      this.#commitEvent(value);
      return;
    }
    if (this.#isPropertyBinding) {
      const property = this.#name.slice(1);
      (this.#element as unknown as Record<string, unknown>)[property] = value;
      return;
    }
    if (value == null || value === false) {
      this.#element.removeAttribute(this.#name);
      return;
    }
    if (value === true) {
      this.#element.setAttribute(this.#name, '');
      return;
    }
    this.#element.setAttribute(this.#name, String(value));
  }

  #applyTextTemplate(): void {
    if (!this.#textTemplate) {
      return;
    }
    const rendered = this.#textTemplate.render();
    if (this.#isPropertyBinding) {
      const property = this.#name.slice(1);
      (this.#element as unknown as Record<string, unknown>)[property] = rendered;
      return;
    }
    this.#element.setAttribute(this.#name, rendered);
  }

  #commitEvent(value: unknown): void {
    const eventName = this.#name.slice(2);
    if (this.#listener) {
      this.#element.removeEventListener(eventName, this.#listener);
      this.#listener = null;
    }
    if (typeof value === 'function') {
      this.#listener = value as EventListener;
      this.#element.addEventListener(eventName, this.#listener);
    }
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
