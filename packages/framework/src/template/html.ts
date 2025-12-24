const NODE_MARKER_PREFIX = 'part:';
const ATTR_MARKER_PREFIX = '%%PART:';
const ATTR_MARKER_SUFFIX = '%%';

export interface TemplateResult {
  strings: TemplateStringsArray;
  values: unknown[];
  key?: unknown;
  setKey(keyValue: unknown): this;
}

export interface TemplateRecord {
  template: HTMLTemplateElement;
  descriptors: PartDescriptor[];
  clone(): DocumentFragment;
}

type PartDescriptor = NodePartDescriptor | AttributePartDescriptor;

export interface NodePartDescriptor {
  type: 'node';
  path: number[];
}

export interface AttributePartDescriptor {
  type: 'attribute';
  name: string;
  path: number[];
}

const templateCache = new WeakMap<TemplateStringsArray, TemplateRecord>();

export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return new TemplateResultImpl(strings, values);
}

class TemplateResultImpl implements TemplateResult {
  key?: unknown;

  constructor(public strings: TemplateStringsArray, public values: unknown[]) {}

  setKey(keyValue: unknown): this {
    this.key = keyValue;
    return this;
  }
}

export function getTemplateRecord(strings: TemplateStringsArray): TemplateRecord {
  let record = templateCache.get(strings);
  if (!record) {
    record = createTemplateRecord(strings);
    templateCache.set(strings, record);
  }
  return record;
}

function createTemplateRecord(strings: TemplateStringsArray): TemplateRecord {
  const template = document.createElement('template');
  template.innerHTML = buildHTML(strings);
  const partCount = strings.length - 1;
  const descriptors: PartDescriptor[] = new Array(partCount);
  scanTemplateContent(template.content, descriptors);
  return {
    template,
    descriptors,
    clone: () => template.content.cloneNode(true) as DocumentFragment
  };
}

function buildHTML(strings: TemplateStringsArray): string {
  let result = '';
  for (let i = 0; i < strings.length - 1; i++) {
    const chunk = strings[i];
    result += chunk;
    if (isAttributePosition(chunk)) {
      result += attributeMarkerForIndex(i);
    } else {
      result += nodeMarkerForIndex(i);
    }
  }
  result += strings[strings.length - 1];
  return result;
}

function nodeMarkerForIndex(index: number): string {
  return `<!--${NODE_MARKER_PREFIX}${index}-->`;
}

function attributeMarkerForIndex(index: number): string {
  return `"${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}"`;
}

function isAttributePosition(chunk: string): boolean {
  return /=\s*$/.test(chunk);
}

function scanTemplateContent(fragment: DocumentFragment, descriptors: PartDescriptor[]): void {
  const walker = document.createTreeWalker(
    fragment,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.COMMENT_NODE) {
      extractNodePart(node as Comment, fragment, descriptors);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      extractAttributeParts(node as Element, fragment, descriptors);
    }
  }
}

function extractNodePart(commentNode: Comment, root: DocumentFragment, descriptors: PartDescriptor[]): void {
  const data = commentNode.data.trim();
  if (!data.startsWith(NODE_MARKER_PREFIX)) {
    return;
  }
  const numeric = data.slice(NODE_MARKER_PREFIX.length);
  const index = Number.parseInt(numeric, 10);
  if (Number.isNaN(index)) {
    throw new Error('Invalid node marker index.');
  }
  descriptors[index] = { type: 'node', path: buildPath(commentNode, root) };
}

function extractAttributeParts(element: Element, root: DocumentFragment, descriptors: PartDescriptor[]): void {
  for (const attr of Array.from(element.attributes)) {
    const value = attr.value;
    const markerIndex = value.indexOf(ATTR_MARKER_PREFIX);
    if (markerIndex === -1) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith(ATTR_MARKER_PREFIX) || !trimmed.endsWith(ATTR_MARKER_SUFFIX)) {
      throw new Error('Attribute expressions must only contain a single placeholder.');
    }
    const index = parseAttributeMarker(trimmed);
    const canonical = `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}`;
    if (trimmed !== canonical) {
      throw new Error('Attribute expressions cannot mix static text with placeholders.');
    }
    element.removeAttribute(attr.name);
    descriptors[index] = {
      type: 'attribute',
      name: attr.name,
      path: buildPath(element, root)
    };
  }
}

function parseAttributeMarker(text: string): number {
  const start = text.indexOf(ATTR_MARKER_PREFIX);
  const end = text.indexOf(ATTR_MARKER_SUFFIX, start + ATTR_MARKER_PREFIX.length);
  const numeric = text.slice(start + ATTR_MARKER_PREFIX.length, end);
  return Number.parseInt(numeric, 10);
}

function buildPath(node: Node, root: DocumentFragment): number[] {
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

export function resolvePath(root: DocumentFragment, path: number[]): Node {
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
