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
    const fragment = this.#start.ownerDocument!.createDocumentFragment();
    
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
    const fragment = this.ownerDocument.createDocumentFragment();
    
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

  /**
   * Sets the end node of the range.
   * Used when building ranges incrementally.
   */
  setEnd(node: Node): void {
    this.#end = node;
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
}
