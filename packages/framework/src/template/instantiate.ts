import type { TemplateResult, TemplateRecord, NodePartDescriptor, AttributePartDescriptor, TextContentPartDescriptor } from './html.js';
import { getTemplateRecord, resolvePath } from './html.js';
import { AttributePart, NodePart, TextContentPart } from './parts.js';
import type { PartRuntime } from './runtime.js';
import { getPartRuntime } from './runtime.js';

export interface TemplateInstance {
  fragment: DocumentFragment;
  parts: Part[];
  dispose: () => void;
}

type Part = NodePart | AttributePart | TextContentPart;

type Descriptor = NodePartDescriptor | AttributePartDescriptor | TextContentPartDescriptor;

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
  return descriptors.map(descriptor => {
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
      return new AttributePart(element, descriptor.name);
    }
    if (descriptor.type === 'textContent') {
      const element = resolvePath(fragment, descriptor.path);
      if (!(element instanceof Element)) {
        throw new Error('TextContent descriptor did not resolve to an element.');
      }
      return new TextContentPart(element);
    }
    throw new Error(`Unknown descriptor type: ${(descriptor as Descriptor).type}`);
  });
}

function shouldTreatAsReactive(part: Part): boolean {
  if (part instanceof AttributePart && part.isEvent) {
    return false;
  }
  return true;
}
