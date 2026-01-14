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

type PartDescriptor = NodePartDescriptor | AttributePartDescriptor | TextContentPartDescriptor | TextTemplatePartDescriptor;

export interface NodePartDescriptor {
  type: 'node';
  path: number[];
}

export interface AttributePartDescriptor {
  type: 'attribute';
  name: string;
  path: number[];
}

export interface TextContentPartDescriptor {
  type: 'textContent';
  path: number[];
}

export interface TextTemplatePartDescriptor {
  type: 'textTemplate';
  target: 'attribute' | 'textContent';
  name?: string; // attribute name if target is 'attribute'
  path: number[];
  strings: string[];
  indices: number[]; // which value indices correspond to this template
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
      const element = node as Element;
      // Handle <style> and <script> tags specially
      if (element.tagName === 'STYLE' || element.tagName === 'SCRIPT') {
        extractTextContentPart(element, fragment, descriptors);
      }
      extractAttributeParts(element, fragment, descriptors);
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

function extractTextContentPart(element: Element, root: DocumentFragment, descriptors: PartDescriptor[]): void {
  const text = element.textContent || '';
  const markerPattern = new RegExp(`<!--${NODE_MARKER_PREFIX}(\\d+)-->`, 'g');
  const matches = [...text.matchAll(markerPattern)];
  
  if (matches.length === 0) {
    return;
  }
  
  if (matches.length === 1) {
    // Single expression - use simple TextContentPart
    const index = Number.parseInt(matches[0][1], 10);
    const cleanedText = text.replace(matches[0][0], '');
    element.textContent = cleanedText;
    descriptors[index] = {
      type: 'textContent',
      path: buildPath(element, root)
    };
    return;
  }
  
  // Multiple expressions - use TextTemplate
  const strings: string[] = [];
  const indices: number[] = [];
  let lastIndex = 0;
  
  for (const match of matches) {
    const valueIndex = Number.parseInt(match[1], 10);
    indices.push(valueIndex);
    strings.push(text.slice(lastIndex, match.index));
    lastIndex = match.index! + match[0].length;
  }
  strings.push(text.slice(lastIndex));
  
  element.textContent = strings.join('');
  
  // Create one TextTemplatePartDescriptor with all indices
  const descriptor: TextTemplatePartDescriptor = {
    type: 'textTemplate',
    target: 'textContent',
    path: buildPath(element, root),
    strings,
    indices
  };
  
  // Assign to all value indices
  for (const idx of indices) {
    descriptors[idx] = descriptor;
  }
}

function extractAttributeParts(element: Element, root: DocumentFragment, descriptors: PartDescriptor[]): void {
  const attrArray = Array.from(element.attributes);
  for (const attr of attrArray) {
    const value = attr.value;
    const markerPattern = new RegExp(`${ATTR_MARKER_PREFIX}(\\d+)${ATTR_MARKER_SUFFIX}`, 'g');
    const matches = [...value.matchAll(markerPattern)];
    
    if (matches.length === 0) {
      continue;
    }
    
    if (matches.length === 1 && value === matches[0][0]) {
      // Single expression without static text - use simple AttributePart
      const index = Number.parseInt(matches[0][1], 10);
      element.removeAttribute(attr.name);
      descriptors[index] = {
        type: 'attribute',
        name: attr.name,
        path: buildPath(element, root)
      };
      continue;
    }
    
    // Multiple expressions or mixed with static text - use TextTemplate
    const strings: string[] = [];
    const indices: number[] = [];
    let lastIndex = 0;
    
    for (const match of matches) {
      const valueIndex = Number.parseInt(match[1], 10);
      indices.push(valueIndex);
      strings.push(value.slice(lastIndex, match.index));
      lastIndex = match.index! + match[0].length;
    }
    strings.push(value.slice(lastIndex));
    
    element.removeAttribute(attr.name);
    
    // Create one TextTemplatePartDescriptor with all indices
    const descriptor: TextTemplatePartDescriptor = {
      type: 'textTemplate',
      target: 'attribute',
      name: attr.name,
      path: buildPath(element, root),
      strings,
      indices
    };
    
    // Assign to all value indices
    for (const idx of indices) {
      descriptors[idx] = descriptor;
    }
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
