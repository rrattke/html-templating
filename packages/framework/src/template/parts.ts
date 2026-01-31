import type { TemplateBinding } from './render.js';
import type { PartDescriptor } from './html.js';
import type { SignalsRuntime } from '../runtime.js';
import { NodeRange } from './dom.js';
import { Template } from './template.js';

export { NodeRange, Template };

// Backward compatibility alias - will be removed after full migration
export { Template as PartsTemplate };

/**
 * Strategy interface for setting attribute or property values on elements.
 */
interface BindingStrategy {
  set(element: Element, name: string, value: unknown): void;
}

/**
 * Binding strategy that sets HTML attributes using setAttribute/removeAttribute.
 * Handles boolean values: null/false removes attribute, true sets empty string.
 */
class AttributeBinding implements BindingStrategy {
  set(element: Element, name: string, value: unknown): void {
    if (value == null || value === false) {
      element.removeAttribute(name);
      return;
    }
    if (value === true) {
      element.setAttribute(name, '');
      return;
    }
    element.setAttribute(name, String(value));
  }
}

/**
 * Binding strategy that sets element properties directly.
 */
class PropertyBinding implements BindingStrategy {
  set(element: Element, name: string, value: unknown): void {
    (element as unknown as Record<string, unknown>)[name] = value;
  }
}

/**
 * Binding strategy for boolean attributes (e.g., disabled, checked, hidden).
 * Always adds/removes the attribute based on truthiness - never sets a value.
 * Used with the ?attr syntax: ?disabled=${condition}
 */
class BooleanAttributeBinding implements BindingStrategy {
  set(element: Element, name: string, value: unknown): void {
    if (value) {
      element.setAttribute(name, '');
    } else {
      element.removeAttribute(name);
    }
  }
}

// Module-wide singleton instances (exported for use in instantiate.ts)
export const ATTRIBUTE_BINDING = new AttributeBinding();
export const PROPERTY_BINDING = new PropertyBinding();
export const BOOLEAN_ATTRIBUTE_BINDING = new BooleanAttributeBinding();

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

/**
 * NodePart: applies values to a DOM location marked by a comment.
 * Stateless - just applies values without tracking or reconciliation.
 * For keyed reconciliation, use Reconciler at the render level.
 */
export class NodePart {
  #range: NodeRange;

  constructor(markerNode: Comment) {
    this.#range = new NodeRange(markerNode);
  }

  setValue(value: unknown): void {
    this.#range.deleteContents();
    const node = this.#valueToNode(value);
    if (node) {
      this.#range.insertNode(node);
    }
  }

  #valueToNode(value: unknown): Node | null {
    if (value == null || value === false) {
      return null;
    }
    if (value instanceof Node) {
      return value;
    }
    if (value instanceof DocumentFragment) {
      return value;
    }
    if (isIterable(value)) {
      const fragment = this.#range.ownerDocument.createDocumentFragment();
      for (const item of value) {
        const node = this.#valueToNode(item);
        if (node) {
          fragment.appendChild(node);
        }
      }
      return fragment;
    }
    return this.#range.ownerDocument.createTextNode(String(value));
  }
}

/**
 * Attribute part for standard HTML attributes.
 * Handles boolean values: null/false removes attribute, true sets empty string.
 * For strict boolean behavior (always add/remove based on truthiness), use BooleanAttributeBinding.
 */
export class StandardAttributePart {
  #element: Element;
  #name: string;
  #strategy: BindingStrategy;

  constructor(element: Element, name: string) {
    this.#element = element;
    this.#name = name;
    this.#strategy = ATTRIBUTE_BINDING;
  }

  setValue(value: unknown): void {
    this.#strategy.set(this.#element, this.#name, value);
  }
}

/**
 * Attribute part for property bindings.
 * Sets element properties directly instead of using setAttribute.
 * Expects the property name without the '.' prefix (e.g., 'value' not '.value').
 */
export class PropertyAttributePart {
  #element: Element;
  #property: string;
  #strategy: BindingStrategy;

  constructor(element: Element, propertyName: string) {
    this.#element = element;
    this.#property = propertyName;
    this.#strategy = PROPERTY_BINDING;
  }

  setValue(value: unknown): void {
    this.#strategy.set(this.#element, this.#property, value);
  }
}

/**
 * Attribute part for boolean attributes.
 * Always adds/removes the attribute based on truthiness of the value.
 * Used with ?attribute syntax: ?disabled=${condition}
 * Expects the attribute name without the '?' prefix (e.g., 'disabled' not '?disabled').
 */
export class BooleanAttributePart {
  #element: Element;
  #name: string;
  #strategy: BindingStrategy;

  constructor(element: Element, name: string) {
    this.#element = element;
    this.#name = name;
    this.#strategy = BOOLEAN_ATTRIBUTE_BINDING;
  }

  setValue(value: unknown): void {
    this.#strategy.set(this.#element, this.#name, value);
  }
}

/**
 * Attribute part for event listeners.
 * Manages addEventListener/removeEventListener lifecycle.
 * Expects the event name without the '@' prefix (e.g., 'click' not '@click').
 */
export class EventAttributePart {
  #element: Element;
  #eventName: string;
  #listener: EventListener | null = null;

  constructor(element: Element, eventName: string) {
    this.#element = element;
    this.#eventName = eventName;
  }

  setValue(value: unknown): void {
    if (this.#listener) {
      this.#element.removeEventListener(this.#eventName, this.#listener);
      this.#listener = null;
    }
    if (typeof value === 'function') {
      this.#listener = value as EventListener;
      this.#element.addEventListener(this.#eventName, this.#listener);
    }
  }

  dispose(): void {
    if (this.#listener) {
      this.#element.removeEventListener(this.#eventName, this.#listener);
      this.#listener = null;
    }
  }
}

/**
 * Attribute part for interpolated attributes with text templates.
 * Renders the template then applies via the provided binding strategy.
 */
export class TemplateAttributePart {
  #element: Element;
  #name: string;
  #textTemplate: TextTemplate;
  #slotIndex: number;
  #strategy: BindingStrategy;

  constructor(element: Element, name: string, textTemplate: TextTemplate, slotIndex: number, strategy: BindingStrategy) {
    this.#element = element;
    this.#name = name;
    this.#textTemplate = textTemplate;
    this.#slotIndex = slotIndex;
    this.#strategy = strategy;
  }

  setValue(value: unknown): void {
    this.#textTemplate.setSlot(this.#slotIndex, value);
    const rendered = this.#textTemplate.render();
    this.#strategy.set(this.#element, this.#name, rendered);
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
