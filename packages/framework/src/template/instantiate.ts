import type { NodePartDescriptor, AttributePartDescriptor, TextContentPartDescriptor, TextTemplatePartDescriptor } from './html.js';
import { createTemplateDescriptor, resolvePath } from './html.js';
import { PartsTemplate, StandardAttributePart, PropertyAttributePart, BooleanAttributePart, EventAttributePart, TemplateAttributePart, NodePart, TextContentPart, TextTemplate, ATTRIBUTE_BINDING, PROPERTY_BINDING, BOOLEAN_ATTRIBUTE_BINDING } from './parts.js';
import type { SignalsRuntime } from '../runtime.js';

const templateCache = new WeakMap<TemplateStringsArray, PartsTemplate>();

export class TemplateBinding {
  #strings: TemplateStringsArray;
  #values: unknown[];
  #runtime: SignalsRuntime;
  key?: unknown;

  constructor(strings: TemplateStringsArray, values: unknown[], runtime: SignalsRuntime) {
    this.#strings = strings;
    this.#values = values;
    this.#runtime = runtime;
  }

  static with(runtime: SignalsRuntime): ((strings: TemplateStringsArray, ...values: unknown[]) => TemplateBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => TemplateBinding) {
    const htmlFunction = ((stringsOrKey?: TemplateStringsArray | unknown, ...values: unknown[]) => {
      // If called as a template tag: html``
      if (stringsOrKey && typeof stringsOrKey === 'object' && 'raw' in stringsOrKey) {
        return new TemplateBinding(stringsOrKey as TemplateStringsArray, values, runtime);
      }
      // If called as a function: html(key)
      const key = stringsOrKey;
      return (strings: TemplateStringsArray, ...values: unknown[]) => {
        const binding = new TemplateBinding(strings, values, runtime);
        if (key !== undefined) {
          binding.key = key;
        }
        return binding;
      };
    }) as ((strings: TemplateStringsArray, ...values: unknown[]) => TemplateBinding) & ((key?: unknown) => (strings: TemplateStringsArray, ...values: unknown[]) => TemplateBinding);

    return htmlFunction;
  }

  get strings(): TemplateStringsArray {
    return this.#strings;
  }

  get values(): unknown[] {
    return this.#values;
  }

  get runtime(): SignalsRuntime {
    return this.#runtime;
  }

  setKey(keyValue: unknown): this {
    this.key = keyValue;
    return this;
  }

  instance() {
    return create(this.#runtime, this.getTemplate(), this.#values);
  }

  getTemplate(): PartsTemplate {
    return getPartsTemplate(this.#strings);
  }
}

export function getPartsTemplate(strings: TemplateStringsArray): PartsTemplate {
  let template = templateCache.get(strings);
  if (!template) {
    template = createPartsTemplate(strings);
    templateCache.set(strings, template);
  }
  return template;
}

function createPartsTemplate(strings: readonly string[]): PartsTemplate {
  const { template, descriptors } = createTemplateDescriptor(strings);
  return new PartsTemplate(template, descriptors);
}

export interface TemplateInstance {
  fragment: DocumentFragment;
  parts: Part[];
  dispose: () => void;
}

type Part = NodePart | StandardAttributePart | PropertyAttributePart | BooleanAttributePart | EventAttributePart | TemplateAttributePart | TextContentPart;

type Descriptor = NodePartDescriptor | AttributePartDescriptor | TextContentPartDescriptor | TextTemplatePartDescriptor;

export function create(runtime: SignalsRuntime, template: PartsTemplate, values: unknown[]): TemplateInstance  {
  if (template.descriptors.length !== values.length) {
    throw new Error('Template part mismatch.');
  }

  const fragment = template.cloneFragment();
  const parts = createParts(template.descriptors, fragment, runtime);
  const disposers: Array<() => void> = [];

  parts.forEach((part, index) => {
    const value = values[index];
    if (typeof value === 'function') {
      if (part instanceof EventAttributePart) {
        part.setValue(value);
        disposers.push(() => part.dispose());
      }
      else {
        const dispose = runtime.effect(() => {
          part.setValue(value());
        });
        disposers.push(dispose);
      }
    } else {
      part.setValue(value);
    }
  });

  const dispose = () => {
    for (const dispose of disposers) {
      dispose();
    }
  };

  return { fragment, parts, dispose };
};

function createParts(descriptors: Descriptor[], fragment: DocumentFragment, runtime: SignalsRuntime): Part[] {
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
      if (descriptor.name.startsWith('on')) {
        // on* → Event handler
        const eventName = descriptor.name.slice(2);
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
