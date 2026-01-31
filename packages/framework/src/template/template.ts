/**
 * Template compilation and caching.
 * Layer 1: Parses template strings into reusable Template objects with part descriptors.
 */

import { buildPath, resolvePath as resolvePathImpl } from './dom.js';

// Re-export for use by other modules
export { resolvePathImpl as resolvePath };

// =============================================================================
// Constants
// =============================================================================

const NODE_MARKER_PREFIX = 'part:';
const ATTR_MARKER_PREFIX = '%%PART:';
const ATTR_MARKER_SUFFIX = '%%';

// =============================================================================
// Descriptor Types
// =============================================================================

export type PartDescriptor = NodePartDescriptor | AttributePartDescriptor | TextContentPartDescriptor | TextTemplatePartDescriptor;

export type Descriptor = PartDescriptor;

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

interface TemplateDescriptor {
  template: HTMLTemplateElement;
  descriptors: PartDescriptor[];
}

// =============================================================================
// Template Class and Caching
// =============================================================================

const templateCache = new WeakMap<TemplateStringsArray, Template>();

/**
 * Compiled template - cached and immutable.
 * Contains the parsed HTMLTemplateElement and part descriptors.
 */
export class Template {
  readonly element: HTMLTemplateElement;
  readonly descriptors: PartDescriptor[];

  constructor(element: HTMLTemplateElement, descriptors: PartDescriptor[]) {
    this.element = element;
    this.descriptors = descriptors;
  }

  /**
   * Creates a fresh clone of the template content.
   */
  cloneFragment(): DocumentFragment {
    return this.element.content.cloneNode(true) as DocumentFragment;
  }
}

/**
 * Retrieves or creates a cached Template for the given template strings.
 * Uses WeakMap so templates can be garbage collected when modules unload.
 */
export function getTemplate(strings: TemplateStringsArray): Template {
  let template = templateCache.get(strings);
  if (!template) {
    const { template: element, descriptors } = createTemplateDescriptor(strings);
    template = new Template(element, descriptors);
    templateCache.set(strings, template);
  }
  return template;
}

// =============================================================================
// Template Descriptor Creation
// =============================================================================

function createTemplateDescriptor(strings: readonly string[]): TemplateDescriptor {
  const template = createHtmlTemplate(strings);
  const partCount = strings.length - 1;
  const descriptors: PartDescriptor[] = new Array(partCount);
  scanTemplateContent(template.content, descriptors);
  return { template, descriptors };
}

function createHtmlTemplate(strings: readonly string[]): HTMLTemplateElement {
  const template = document.createElement('template');
  
  let html = '';
  const context = new HTMLContextTracker();
  for (let i = 0; i < strings.length - 1; i++) {
    const chunk = strings[i];
    context.advance(chunk);
    html += chunk;
    if (context.inAttributeValue()) {
      const mode = context.getMode();
      const marker = createAttributeMarker(i);
      html += needsQuotes(mode) ? `"${marker}"` : marker;
    } else {
      html += createNodeMarker(i);
    }
  }
  html += strings[strings.length - 1];
  
  template.innerHTML = html;
  return template;
}

function createNodeMarker(index: number): string {
  return `<!--${NODE_MARKER_PREFIX}${index}-->`;
}

function createAttributeMarker(index: number): string {
  return `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}`;
}

function needsQuotes(mode: ParserMode): boolean {
  // Unquoted attributes need quotes added around the marker
  return mode !== 'ATTR_VALUE_DOUBLE' && mode !== 'ATTR_VALUE_SINGLE';
}

// =============================================================================
// HTML Context Tracking (Parser State Machine)
// =============================================================================

type ParserMode =
  | 'TEXT'
  | 'TAG'
  | 'COMMENT'
  | 'ATTR_VALUE_DOUBLE'
  | 'ATTR_VALUE_SINGLE'
  | 'ATTR_VALUE_UNQUOTED';

class HTMLContextTracker {
  #mode: ParserMode = 'TEXT';
  #attrValuePending = false;

  advance(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      switch (this.#mode) {
        case 'TEXT': {
          if (ch === '<') {
            if (chunk.startsWith('!--', i + 1)) {
              this.#mode = 'COMMENT';
              i += 3; // skip past "!--"
            } else {
              this.#mode = 'TAG';
            }
          }
          break;
        }
        case 'COMMENT': {
          if (ch === '-' && chunk[i + 1] === '-' && chunk[i + 2] === '>') {
            this.#mode = 'TEXT';
            i += 2;
          }
          break;
        }
        case 'TAG': {
          if (this.#attrValuePending) {
            if (isWhitespace(ch)) {
              break;
            }
            this.#attrValuePending = false;
            if (ch === '"') {
              this.#mode = 'ATTR_VALUE_DOUBLE';
              break;
            }
            if (ch === '\'') {
              this.#mode = 'ATTR_VALUE_SINGLE';
              break;
            }
            if (ch === '>') {
              this.#mode = 'TEXT';
              break;
            }
            this.#mode = 'ATTR_VALUE_UNQUOTED';
            break;
          }
          if (ch === '=') {
            this.#attrValuePending = true;
            break;
          }
          if (ch === '"') {
            this.#mode = 'ATTR_VALUE_DOUBLE';
            break;
          }
          if (ch === '\'') {
            this.#mode = 'ATTR_VALUE_SINGLE';
            break;
          }
          if (ch === '>') {
            this.#mode = 'TEXT';
            break;
          }
          break;
        }
        case 'ATTR_VALUE_DOUBLE': {
          if (ch === '"') {
            this.#mode = 'TAG';
          }
          break;
        }
        case 'ATTR_VALUE_SINGLE': {
          if (ch === '\'') {
            this.#mode = 'TAG';
          }
          break;
        }
        case 'ATTR_VALUE_UNQUOTED': {
          if (isWhitespace(ch)) {
            this.#mode = 'TAG';
            break;
          }
          if (ch === '>') {
            this.#mode = 'TEXT';
            break;
          }
          break;
        }
      }
    }
  }

  inAttributeValue(): boolean {
    return (
      this.#mode === 'ATTR_VALUE_DOUBLE' ||
      this.#mode === 'ATTR_VALUE_SINGLE' ||
      this.#mode === 'ATTR_VALUE_UNQUOTED' ||
      this.#attrValuePending
    );
  }

  getMode(): ParserMode {
    return this.#mode;
  }
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
}

// =============================================================================
// Template Content Scanning
// =============================================================================

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
