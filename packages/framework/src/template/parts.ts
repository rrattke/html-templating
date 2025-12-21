export class NodePart {
  private readonly start: Comment;
  private readonly end: Comment;
  private current: Node | null = null;

  constructor(markerNode: Comment) {
    const doc = markerNode.ownerDocument;
    this.start = doc.createComment('part-start');
    this.end = doc.createComment('part-end');
    markerNode.replaceWith(this.start, this.end);
  }

  setValue(value: unknown): void {
    if (value == null) {
      this.commitText('');
      return;
    }
    if (value instanceof Node) {
      this.commitNode(value);
      return;
    }
    this.commitText(String(value));
  }

  private commitText(text: string): void {
    if (this.current instanceof Text) {
      if (this.current.data !== text) {
        this.current.data = text;
      }
      return;
    }
    const node = this.end.ownerDocument.createTextNode(text);
    this.setNode(node);
  }

  private commitNode(node: Node): void {
    if (this.current === node) {
      return;
    }
    this.setNode(node);
  }

  private setNode(node: Node): void {
    this.clearRange();
    this.end.parentNode?.insertBefore(node, this.end);
    this.current = node;
  }

  private clearRange(): void {
    let pointer = this.start.nextSibling;
    while (pointer && pointer !== this.end) {
      const next = pointer.nextSibling;
      pointer.remove();
      pointer = next;
    }
    this.current = null;
  }
}

export class AttributePart {
  private listener: EventListener | null = null;
  private readonly isPropertyBinding: boolean;
  private readonly _isEvent: boolean;

  constructor(private readonly element: Element, private readonly name: string) {
    this.isPropertyBinding = this.name.startsWith('.');
    this._isEvent = this.name.startsWith('on');
  }

  get isEvent(): boolean {
    return this._isEvent;
  }

  setValue(value: unknown): void {
    if (this._isEvent) {
      this.commitEvent(value);
      return;
    }
    if (this.isPropertyBinding) {
      const property = this.name.slice(1);
      (this.element as unknown as Record<string, unknown>)[property] = value;
      return;
    }
    if (value == null || value === false) {
      this.element.removeAttribute(this.name);
      return;
    }
    if (value === true) {
      this.element.setAttribute(this.name, '');
      return;
    }
    this.element.setAttribute(this.name, String(value));
  }

  private commitEvent(value: unknown): void {
    const eventName = this.name.slice(2);
    if (this.listener) {
      this.element.removeEventListener(eventName, this.listener);
      this.listener = null;
    }
    if (typeof value === 'function') {
      this.listener = value as EventListener;
      this.element.addEventListener(eventName, this.listener);
    }
  }
}
