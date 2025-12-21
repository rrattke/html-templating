import type { TemplateResult } from './html.js';

type TemplateFactory = (result: TemplateResult) => { fragment: DocumentFragment; dispose: () => void };

export class NodePart {
  #start: Comment;
  #end: Comment;
  #current: Node | null = null;
  #instantiateNested: TemplateFactory;
  #childDisposers: Array<() => void> = [];

  constructor(markerNode: Comment, instantiateNested: TemplateFactory) {
    const doc = markerNode.ownerDocument;
    this.#start = doc.createComment('part-start');
    this.#end = doc.createComment('part-end');
    markerNode.replaceWith(this.#start, this.#end);
    this.#instantiateNested = instantiateNested;
  }

  setValue(value: unknown): void {
    this.#disposeChildren();
    if (value == null || value === false) {
      this.#commitText('');
      return;
    }
    if (isTemplateResult(value)) {
      this.#commitTemplate(value);
      return;
    }
    if (isIterable(value)) {
      this.#commitIterable(value);
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

  #commitIterable(values: Iterable<unknown>): void {
    const fragment = this.#end.ownerDocument.createDocumentFragment();
    for (const value of values) {
      this.#appendIterableValue(fragment, value);
    }
    this.#commitNode(fragment);
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
}

export class AttributePart {
  #listener: EventListener | null = null;
  #isPropertyBinding: boolean;
  #isEvent: boolean;
  #element: Element;
  #name: string;

  constructor(element: Element, name: string) {
    this.#element = element;
    this.#name = name;
    this.#isPropertyBinding = this.#name.startsWith('.');
    this.#isEvent = this.#name.startsWith('on');
  }

  get isEvent(): boolean {
    return this.#isEvent;
  }

  setValue(value: unknown): void {
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
