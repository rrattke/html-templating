export class NodePart {
  constructor(markerNode) {
    const doc = markerNode.ownerDocument;
    this.start = doc.createComment('part-start');
    this.end = doc.createComment('part-end');
    markerNode.replaceWith(this.start, this.end);
    this.current = null;
  }

  setValue(value) {
    if (value == null) {
      this._commitText('');
      return;
    }
    if (value instanceof Node) {
      this._commitNode(value);
      return;
    }
    this._commitText(String(value));
  }

  _commitText(text) {
    if (this.current instanceof Text) {
      if (this.current.data !== text) {
        this.current.data = text;
      }
      return;
    }
    const node = this.end.ownerDocument.createTextNode(text);
    this._setNode(node);
  }

  _commitNode(node) {
    if (this.current === node) {
      return;
    }
    this._setNode(node);
  }

  _setNode(node) {
    this._clearRange();
    this.end.parentNode.insertBefore(node, this.end);
    this.current = node;
  }

  _clearRange() {
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
  constructor(element, name) {
    this.element = element;
    this.name = name;
    this.listener = null;
    this._isEvent = name.startsWith('on');
  }

  get isEvent() {
    return this._isEvent;
  }

  setValue(value) {
    if (this._isEvent) {
      this._commitEvent(value);
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
    if (this.name.startsWith('.')) {
      this.element[this.name.slice(1)] = value;
      return;
    }
    this.element.setAttribute(this.name, String(value));
  }

  _commitEvent(value) {
    const eventName = this.name.slice(2);
    if (this.listener) {
      this.element.removeEventListener(eventName, this.listener);
      this.listener = null;
    }
    if (typeof value === 'function') {
      this.listener = value;
      this.element.addEventListener(eventName, this.listener);
    }
  }
}
