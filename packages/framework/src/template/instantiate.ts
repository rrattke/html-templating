import type { TemplateResult, TemplateRecord, NodePartDescriptor, AttributePartDescriptor, TextContentPartDescriptor, TextTemplatePartDescriptor } from './html.js';
import { getTemplateRecord, resolvePath } from './html.js';
import { StandardAttributePart, PropertyAttributePart, EventAttributePart, TemplateAttributePart, NodePart, TextContentPart, TextTemplate, ATTRIBUTE_BINDING, PROPERTY_BINDING } from './parts.js';
import type { PartRuntime } from './runtime.js';
import { getPartRuntime } from './runtime.js';

export interface TemplateInstance {
  fragment: DocumentFragment;
  parts: Part[];
  dispose: () => void;
}

type Part = NodePart | StandardAttributePart | PropertyAttributePart | EventAttributePart | TemplateAttributePart | TextContentPart;

type Descriptor = NodePartDescriptor | AttributePartDescriptor | TextContentPartDescriptor | TextTemplatePartDescriptor;

export function instantiate(result: TemplateResult, runtime: PartRuntime = getPartRuntime()): TemplateInstance {
  const record = getTemplateRecord(result.strings);
  if (record.descriptors.length !== result.values.length) {
    throw new Error('Template part mismatch.');
  }

  const fragment = record.clone();
  const parts = createParts(record.descriptors, fragment, runtime);
  const disposers: Array<() => void> = [];

  parts.forEach((part, index) => {
    const value = result.values[index];
    if (typeof value === 'function' && shouldTreatAsReactive(part)) {
      const dispose = runtime.effect(() => {
        part.setValue((value as () => unknown)());
      });
      disposers.push(dispose);
    } else {
      part.setValue(value);
    }
  });

  const dispose = () => {
    for (const teardown of disposers) {
      teardown();
    }
  };

  return { fragment, parts, dispose };
}

function createParts(descriptors: Descriptor[], fragment: DocumentFragment, runtime: PartRuntime): Part[] {
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
      return new NodePart(marker, value => instantiate(value, runtime));
    }
    if (descriptor.type === 'attribute') {
      const element = resolvePath(fragment, descriptor.path);
      if (!(element instanceof Element)) {
        throw new Error('Attribute descriptor did not resolve to an element.');
      }
      // Determine which specialized part to create based on attribute name
      if (descriptor.name.startsWith('on')) {
        const eventName = descriptor.name.slice(2);
        return new EventAttributePart(element, eventName);
      } else if (descriptor.name.startsWith('.')) {
        const propertyName = descriptor.name.slice(1);
        return new PropertyAttributePart(element, propertyName);
      } else {
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
        // Determine which binding strategy to use based on attribute name
        const isPropertyBinding = descriptor.name.startsWith('.');
        const strategy = isPropertyBinding ? PROPERTY_BINDING : ATTRIBUTE_BINDING;
        const name = isPropertyBinding ? descriptor.name.slice(1) : descriptor.name;
        return new TemplateAttributePart(element, name, textTemplate, slotIndex, strategy);
      } else {
        return new TextContentPart(element, textTemplate, slotIndex);
      }
    }
    throw new Error(`Unknown descriptor type: ${(descriptor as Descriptor).type}`);
  });
}

function shouldTreatAsReactive(part: Part): boolean {
  // Event handlers should not be wrapped in effects
  if (part instanceof EventAttributePart) {
    return false;
  }
  return true;
}
