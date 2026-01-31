/**
 * DOM utilities for template manipulation.
 * Shared helpers for path resolution and node range management.
 */

/**
 * Encodes a node's location as an array of child indices from the fragment root.
 * Used to store descriptor paths for efficient clone resolution.
 */
export function buildPath(node: Node, root: Node): number[] {
  const path: number[] = [];
  let current: Node | null = node;
  while (current && current !== root) {
    const parent: ParentNode | null = current.parentNode;
    if (!parent) {
      break;
    }
    const index = Array.prototype.indexOf.call(parent.childNodes, current);
    path.unshift(index);
    current = parent;
  }
  return path;
}

/**
 * Replays stored indices against a cloned fragment to find the target node.
 */
export function resolvePath(root: Node, path: number[]): Node {
  let node: Node = root;
  for (const index of path) {
    const next = node.childNodes[index];
    if (!next) {
      throw new Error('Failed to resolve part path.');
    }
    node = next;
  }
  return node;
}

/**
 * Tracks a contiguous sequence of DOM nodes.
 * Uses an exclusive start marker (Comment or first content node) and inclusive end node.
 * 
 * Range states:
 * - Empty/collapsed: end === start (no content between markers)
 * - Non-empty: end is the last content node after start
 */
export class NodeRange {
  #start: Node;
  #end: Node;

  /**
   * Creates a new NodeRange.
   * @param start The start marker (Comment for template parts, or first content node for list items)
   * @param end The end node of the range (defaults to start, creating an empty/collapsed range)
   */
  constructor(start: Node, end?: Node) {
    this.#start = start;
    this.#end = end ?? start;
  }

  /**
   * Extracts the range contents into a DocumentFragment, removing nodes from the DOM.
   * After extraction, the range is collapsed (end === start).
   * Returns an empty fragment if the range is already empty.
   */
  extractContents(): DocumentFragment {
    const fragment = NodeRange.extractContents(this.#start, this.#end);
    this.#end = this.#start;
    return fragment;
  }

  /**
   * Clones the range contents into a DocumentFragment without removing nodes from the DOM.
   * The range remains unchanged.
   * Returns an empty fragment if the range is empty.
   */
  cloneContents(): DocumentFragment {
    return NodeRange.cloneContents(this.#start, this.#end);
  }

  /**
   * Removes all nodes from after the start marker up to and including the end node.
   * After deleting contents, the range is empty (end === start).
   */
  deleteContents(): void {
    NodeRange.deleteContents(this.#start, this.#end);
    this.#end = this.#start;
  }

  /**
   * Inserts a node or fragment into the range after deleting existing contents.
   * Updates end to point to the last inserted node.
   */
  insertNode(content: Node): void {
    this.deleteContents();
    const newEnd = NodeRange.insertNode(this.#start, content);
    this.#end = newEnd;
  }

  /**
   * Sets the end node of the range.
   * Used when building ranges incrementally.
   */
  setEnd(node: Node): void {
    this.#end = node;
  }

  /**
   * Sets the start node of the range.
   * Used to fix list item boundaries after insertion.
   */
  setStart(node: Node): void {
    this.#start = node;
  }

  /**
   * Returns true if the range is empty (no content nodes).
   */
  collapsed(): boolean {
    return this.#end === this.#start;
  }

  get start(): Node {
    return this.#start;
  }

  get end(): Node {
    return this.#end;
  }

  get ownerDocument(): Document {
    return this.#start.ownerDocument!;
  }

  /**
   * Extracts all nodes from start.nextSibling to end (inclusive) into a DocumentFragment.
   * Exclude start boundary, include end boundary.
   * Returns empty fragment if start === end (collapsed range).
   */
  static extractContents(start: Node, end: Node): DocumentFragment {
    const fragment = NodeRange.ownerDocument(start, end).createDocumentFragment();
    
    if (NodeRange.collapsed(start, end)) {
      return fragment;
    }

    let node = start.nextSibling;
    while (node) {
      const next = node.nextSibling;
      const isEnd = node === end;
      fragment.appendChild(node); // Implicitly removes from DOM
      if (isEnd) {
        break;
      }
      node = next;
    }
    
    return fragment;
  }

  /**
   * Extracts all nodes from start to end (both inclusive) into a DocumentFragment.
   * Include both start and end boundaries.
   * Returns empty fragment if start and end are not connected.
   */
  static extractInclusive(start: Node, end: Node): DocumentFragment {
    const fragment = NodeRange.ownerDocument(start, end).createDocumentFragment();
    
    let node: Node | null = start;
    while (node) {
      const next: Node | null = node.nextSibling;
      fragment.appendChild(node);
      if (node === end) break;
      node = next;
    }
    
    return fragment;
  }

  /**
   * Clones all nodes from start.nextSibling to end (inclusive) into a DocumentFragment.
   * Exclude start boundary, include end boundary.
   * Returns empty fragment if start === end (collapsed range).
   */
  static cloneContents(start: Node, end: Node): DocumentFragment {
    const fragment = NodeRange.ownerDocument(start, end).createDocumentFragment();
    
    if (NodeRange.collapsed(start, end)) {
      return fragment;
    }

    let node = start.nextSibling;
    while (node) {
      fragment.appendChild(node.cloneNode(true));
      if (node === end) {
        break;
      }
      node = node.nextSibling;
    }
    
    return fragment;
  }

  /**
   * Deletes all nodes from start.nextSibling to end (inclusive).
   * Exclude start boundary, include end boundary.
   * No-op if start === end (collapsed range).
   */
  static deleteContents(start: Node, end: Node): void {
    if (NodeRange.collapsed(start, end)) return;
    
    let node = start.nextSibling;
    while (node) {
      const next = node.nextSibling;
      const isEnd = node === end;
      node.remove();
      if (isEnd) break;
      node = next;
    }
  }

  /**
   * Inserts a node or fragment after start.
   * Returns the new end node (last inserted node, or start if content is empty).
   */
  static insertNode(start: Node, content: Node): Node {
    const parent = start.parentNode;
    if (!parent) {
      throw new Error('NodeRange marker is not attached to DOM');
    }

    if (content instanceof DocumentFragment) {
      const nodes = Array.from(content.childNodes);
      if (nodes.length === 0) {
        // Empty fragment, return start (collapsed range)
        return start;
      }
      parent.insertBefore(content, start.nextSibling);
      return nodes[nodes.length - 1];
    } else {
      parent.insertBefore(content, start.nextSibling);
      return content;
    }
  }

  /**
   * Checks if range is collapsed (empty).
   */
  static collapsed(start: Node, end: Node): boolean {
    return start === end;
  }

  /**
   * Gets the owner document of the range.
   * Validates that both nodes belong to the same document.
   * @throws Error if start and end have different owner documents
   */
  static ownerDocument(start: Node, end: Node): Document {
    const startDoc = start.ownerDocument;
    const endDoc = end.ownerDocument;
    
    if (!startDoc) {
      throw new Error('Start node has no owner document');
    }
    
    if (start !== end && startDoc !== endDoc) {
      throw new Error('Range boundaries must belong to the same document');
    }
    
    return startDoc;
  }
}
