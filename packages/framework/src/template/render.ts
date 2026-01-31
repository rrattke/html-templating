/**
 * Template instantiation and rendering.
 * Layer 3: Manages template instances, bindings, and reconciliation.
 */

import type { Descriptor } from './html.js';
import { resolvePath } from './html.js';
import { NodeRange } from './dom.js';
import { Template, getTemplate } from './template.js';
import { 
  StandardAttributePart, 
  PropertyAttributePart, 
  BooleanAttributePart, 
  EventAttributePart, 
  TemplateAttributePart, 
  NodePart, 
  TextContentPart, 
  TextTemplate, 
  ATTRIBUTE_BINDING, 
  PROPERTY_BINDING, 
  BOOLEAN_ATTRIBUTE_BINDING,
  type Part
} from './parts.js';
import type { SignalsRuntime } from '../runtime.js';

/**
 * Static template binding - holds template strings and values.
 * No runtime needed. Rendered once with render() method.
 * 
 * @example
 * ```ts
 * const html = StaticBinding.html;
 * const page = html`<div>${title}</div>`;
 * document.body.appendChild(page.render());
 * ```
 */
export class StaticBinding {
  #strings: TemplateStringsArray;
  #values: unknown[];

  constructor(strings: TemplateStringsArray, values: unknown[]) {
    this.#strings = strings;
    this.#values = values;
  }

  get strings(): TemplateStringsArray {
    return this.#strings;
  }

  get values(): unknown[] {
    return this.#values;
  }

  getTemplate(): Template {
    return getTemplate(this.#strings);
  }

  /**
   * Renders the template to a DocumentFragment.
   * One-time rendering with no reactive updates.
   */
  render(): DocumentFragment {
    const template = this.getTemplate();
    const fragment = template.cloneFragment();
    const parts = createParts(template.descriptors, fragment);
    
    parts.forEach((part, index) => {
      const value = this.#values[index];
      const processed = processValueStatic(value);
      part.setValue(processed);
    });
    
    return fragment;
  }

  /**
   * Creates an html`` tag function for static templates.
   */
  static html(strings: TemplateStringsArray, ...values: unknown[]): StaticBinding {
    return new StaticBinding(strings, values);
  }
}

/**
 * Process a value for static rendering by instantiating any StaticBindings.
 * Unlike processValue, this doesn't track instances for disposal.
 */
function processValueStatic(value: unknown): unknown {
  // Handle StaticBinding by rendering it
  if (isStaticBinding(value)) {
    return value.render();
  }
  
  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map(item => processValueStatic(item));
  }
  
  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

/**
 * Process a value by instantiating any DynamicBindings.
 * Nested instances are tracked for disposal.
 */
function processValue(value: unknown, runtime: SignalsRuntime, nestedInstances: TemplateInstance[]): unknown {
  // Handle DynamicBinding by instantiating it
  if (isDynamicBinding(value)) {
    const instance = TemplateInstance.create(runtime, value.getTemplate(), value.values);
    nestedInstances.push(instance);
    return instance.fragment;
  }
  
  // Handle StaticBinding by rendering it (allows mixing static in dynamic templates)
  if (isStaticBinding(value)) {
    return value.render();
  }
  
  // Handle arrays/iterables recursively
  if (isIterable(value)) {
    return Array.from(value).map(item => processValue(item, runtime, nestedInstances));
  }
  
  // Pass through everything else (nodes, primitives, null, etc.)
  return value;
}

function isStaticBinding(value: unknown): value is StaticBinding {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  return 'strings' in (value as Record<string, unknown>) && 'values' in (value as Record<string, unknown>);
}

function isDynamicBinding(value: unknown): value is DynamicBinding {
  if (!isStaticBinding(value)) {
    return false;
  }
  return 'runtime' in value;
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value === 'string') {
    return false;
  }
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

/**
 * Realized template in the DOM.
 * Has behavior: dispose() cleans up effects and event listeners.
 */
export class TemplateInstance {
  readonly fragment: DocumentFragment;
  readonly parts: Part[];
  readonly #dispose: () => void;

  constructor(fragment: DocumentFragment, parts: Part[], dispose: () => void) {
    this.fragment = fragment;
    this.parts = parts;
    this.#dispose = dispose;
  }

  /**
   * Disposes all reactive effects and event listeners.
   */
  dispose(): void {
    this.#dispose();
  }

  /**
   * Creates a TemplateInstance from a template and values.
   */
  static create(runtime: SignalsRuntime, template: Template, values: unknown[]): TemplateInstance {
    if (template.descriptors.length !== values.length) {
      throw new Error('Template part mismatch.');
    }

    const fragment = template.cloneFragment();
    const parts = createParts(template.descriptors, fragment);
    const disposers: Array<() => void> = [];
    const nestedInstances: TemplateInstance[] = [];

    parts.forEach((part, index) => {
      const value = values[index];
      if (typeof value === 'function') {
        if (part instanceof EventAttributePart) {
          part.setValue(value);
          disposers.push(() => part.dispose());
        }
        else {
          const dispose = runtime.effect(() => {
            const result = value();
            const processed = processValue(result, runtime, nestedInstances);
            part.setValue(processed);
          });
          disposers.push(dispose);
        }
      } else {
        const processed = processValue(value, runtime, nestedInstances);
        part.setValue(processed);
      }
    });

    const dispose = () => {
      for (const instance of nestedInstances) {
        instance.dispose();
      }
      for (const disposer of disposers) {
        disposer();
      }
    };

    return new TemplateInstance(fragment, parts, dispose);
  }
}

/**
 * Dynamic template binding - extends StaticBinding with runtime and key.
 * Used for reactive templates that update when signals change.
 * 
 * @example
 * ```ts
 * const html = DynamicBinding.with(runtime);
 * const page = html`<div>${() => count()}</div>`;
 * document.body.appendChild(page.instance().fragment);
 * ```
 */
export class DynamicBinding extends StaticBinding {
  #runtime: SignalsRuntime;
  key?: unknown;

  constructor(strings: TemplateStringsArray, values: unknown[], runtime: SignalsRuntime) {
    super(strings, values);
    this.#runtime = runtime;
  }

  /**
   * Creates an html`` tag function bound to a specific runtime.
   * Supports both direct use (html`...`) and keyed use (html(key)`...`).
   */
  static with(runtime: SignalsRuntime): ((strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) {
    const htmlFunction = ((stringsOrKey?: TemplateStringsArray | unknown, ...values: unknown[]) => {
      // If called as a template tag: html``
      if (stringsOrKey && typeof stringsOrKey === 'object' && 'raw' in stringsOrKey) {
        return new DynamicBinding(stringsOrKey as TemplateStringsArray, values, runtime);
      }
      // If called as a function: html(key)
      const key = stringsOrKey;
      return (strings: TemplateStringsArray, ...values: unknown[]) => {
        const binding = new DynamicBinding(strings, values, runtime);
        if (key !== undefined) {
          binding.key = key;
        }
        return binding;
      };
    }) as ((strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => DynamicBinding);

    return htmlFunction;
  }

  get runtime(): SignalsRuntime {
    return this.#runtime;
  }

  setKey(keyValue: unknown): this {
    this.key = keyValue;
    return this;
  }

  instance() {
    return TemplateInstance.create(this.#runtime, this.getTemplate(), this.values);
  }
}

/**
 * Reconciliation bookkeeping for a single template instance.
 * Tracks the key, DOM range, and instance for efficient reuse and moves.
 */
export class InstanceState {
  readonly key: unknown | undefined;
  readonly range: NodeRange;
  readonly instance: TemplateInstance;

  constructor(key: unknown | undefined, range: NodeRange, instance: TemplateInstance) {
    this.key = key;
    this.range = range;
    this.instance = instance;
  }

  /**
   * Disposes the template instance (cleans up effects and event listeners).
   */
  dispose(): void {
    this.instance.dispose();
  }

  /**
   * Moves all nodes in this instance's range before the reference node.
   * Uses in-place DOM moves, preserving element identity.
   */
  moveBefore(referenceNode: Node, parent: Node): void {
    let node: Node | null = this.range.start;
    const end = this.range.end;

    while (node) {
      const next: Node | null = node.nextSibling;
      parent.insertBefore(node, referenceNode);
      if (node === end) break;
      node = next;
    }
  }
}

/**
 * Reconciler for template bindings.
 * Manages a list of InstanceState entries by key, efficiently reusing
 * existing instances and performing in-place DOM moves.
 */
export class Reconciler {
  #parent: Node;
  #states: InstanceState[] = [];
  #statesByKey = new Map<unknown, InstanceState>();
  #endMarker: Comment;

  constructor(parent: Node) {
    this.#parent = parent;
    this.#endMarker = document.createComment('');
    parent.appendChild(this.#endMarker);
  }

  /**
   * The end marker comment node that marks the end of the reconciled content.
   */
  get endMarker(): Comment {
    return this.#endMarker;
  }

  /**
   * Current tracked instance states.
   */
  get states(): readonly InstanceState[] {
    return this.#states;
  }

  /**
   * Renders a list of template bindings, reusing existing instances by key
   * and performing minimal DOM operations.
   */
  render(bindings: DynamicBinding[]): void {
    const reusedKeys = new Set<unknown>();
    const newStates: InstanceState[] = [];

    // Process in reverse for efficient insertion before reference node
    let referenceNode: Node = this.#endMarker;

    for (let i = bindings.length - 1; i >= 0; i--) {
      const binding = bindings[i];
      const key = binding.key;

      if (key !== undefined && this.#statesByKey.has(key) && !reusedKeys.has(key)) {
        // Reuse existing state
        const existing = this.#statesByKey.get(key)!;
        reusedKeys.add(key);
        existing.moveBefore(referenceNode, this.#parent);
        newStates.unshift(existing);
        referenceNode = existing.range.start;
      } else {
        // Create new state
        const state = this.#createState(binding);
        this.#insertStateBefore(state, referenceNode);
        newStates.unshift(state);
        referenceNode = state.range.start;
      }
    }

    // Dispose unused states
    for (const state of this.#states) {
      if (state.key === undefined || !reusedKeys.has(state.key)) {
        state.dispose();
        state.range.deleteContents();
      }
    }

    // Update tracking
    this.#states = newStates;
    this.#statesByKey.clear();
    for (const state of newStates) {
      if (state.key !== undefined) {
        this.#statesByKey.set(state.key, state);
      }
    }
  }

  #createState(binding: DynamicBinding): InstanceState {
    const instance = binding.instance();
    const startMarker = document.createComment('');

    // Wrap fragment with markers for range tracking
    instance.fragment.insertBefore(startMarker, instance.fragment.firstChild);
    const range = new NodeRange(startMarker);
    if (instance.fragment.lastChild) {
      range.setEnd(instance.fragment.lastChild);
    }

    return new InstanceState(binding.key, range, instance);
  }

  #insertStateBefore(state: InstanceState, referenceNode: Node): void {
    // Collect all nodes from the range
    let node: Node | null = state.range.start;
    const end = state.range.end;

    while (node) {
      const next: Node | null = node.nextSibling;
      this.#parent.insertBefore(node, referenceNode);
      if (node === end) break;
      node = next;
    }
  }

  /**
   * Disposes all tracked instances and removes the end marker.
   */
  dispose(): void {
    for (const state of this.#states) {
      state.dispose();
      state.range.deleteContents();
    }
    this.#states = [];
    this.#statesByKey.clear();
    this.#endMarker.remove();
  }
}

function createParts(descriptors: Descriptor[], fragment: DocumentFragment): Part[] {
  const textTemplateCache = new Map<Descriptor, TextTemplate>();
  
  return descriptors.map((descriptor, index) => {
    if (!descriptor) {
      throw new Error('Missing template descriptor.');
    }
    if (descriptor.type === 'node') {
      const marker = resolvePath(fragment, descriptor.path);
      if (!(marker instanceof Comment)) {
        throw new Error('Node descriptor did not resolve to a comment marker.');
      }
      return new NodePart(marker);
    }
    if (descriptor.type === 'attribute') {
      const element = resolvePath(fragment, descriptor.path);
      if (!(element instanceof Element)) {
        throw new Error('Attribute descriptor did not resolve to an element.');
      }
      // Determine which specialized part to create based on attribute name prefix
      if (descriptor.name.startsWith('@')) {
        // @event → Event handler
        const eventName = descriptor.name.slice(1);
        return new EventAttributePart(element, eventName);
      } else if (descriptor.name.startsWith('.')) {
        // .property → Property binding
        const propertyName = descriptor.name.slice(1);
        return new PropertyAttributePart(element, propertyName);
      } else if (descriptor.name.startsWith('?')) {
        // ?attribute → Boolean attribute (adds/removes based on truthiness)
        const attributeName = descriptor.name.slice(1);
        return new BooleanAttributePart(element, attributeName);
      } else {
        // Regular attribute
        return new StandardAttributePart(element, descriptor.name);
      }
    }
    if (descriptor.type === 'textContent') {
      const element = resolvePath(fragment, descriptor.path);
      if (!(element instanceof Element)) {
        throw new Error('TextContent descriptor did not resolve to an element.');
      }
      return new TextContentPart(element);
    }
    if (descriptor.type === 'textTemplate') {
      // Get or create shared TextTemplate for this descriptor
      let textTemplate = textTemplateCache.get(descriptor);
      if (!textTemplate) {
        textTemplate = new TextTemplate(descriptor.strings);
        textTemplateCache.set(descriptor, textTemplate);
      }
      
      // Find which slot this value index corresponds to
      const slotIndex = descriptor.indices.indexOf(index);
      if (slotIndex === -1) {
        throw new Error('Value index not found in textTemplate descriptor indices.');
      }
      
      const element = resolvePath(fragment, descriptor.path);
      if (!(element instanceof Element)) {
        throw new Error('TextTemplate descriptor did not resolve to an element.');
      }
      
      if (descriptor.target === 'attribute') {
        if (!descriptor.name) {
          throw new Error('TextTemplate attribute descriptor missing name.');
        }
        // Determine which binding strategy to use based on attribute name prefix
        let strategy = ATTRIBUTE_BINDING;
        let name = descriptor.name;
        
        if (descriptor.name.startsWith('.')) {
          // .property → Property binding
          strategy = PROPERTY_BINDING;
          name = descriptor.name.slice(1);
        } else if (descriptor.name.startsWith('?')) {
          // ?attribute → Boolean attribute binding
          strategy = BOOLEAN_ATTRIBUTE_BINDING;
          name = descriptor.name.slice(1);
        }
        
        return new TemplateAttributePart(element, name, textTemplate, slotIndex, strategy);
      } else {
        return new TextContentPart(element, textTemplate, slotIndex);
      }
    }
    throw new Error(`Unknown descriptor type: ${(descriptor as Descriptor).type}`);
  });
}
