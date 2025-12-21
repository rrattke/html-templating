import { getTemplateRecord, resolvePath } from './html.js';
import { NodePart, AttributePart } from './parts.js';
import { createEffect } from '../reactive/signal.js';

export function instantiate(result) {
  const record = getTemplateRecord(result.strings);
  if (record.partCount !== result.values.length) {
    throw new Error('Template part mismatch.');
  }

  const fragment = record.clone();
  const parts = createParts(record.descriptors, fragment);
  const disposers = [];

  parts.forEach((part, index) => {
    const value = result.values[index];
    if (typeof value === 'function' && shouldTreatAsReactive(part)) {
      const dispose = createEffect(() => {
        part.setValue(value());
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

function createParts(descriptors, fragment) {
  return descriptors.map(descriptor => {
    if (!descriptor) {
      throw new Error('Missing template descriptor.');
    }
    if (descriptor.type === 'node') {
      const marker = resolvePath(fragment, descriptor.path);
      return new NodePart(marker);
    }
    if (descriptor.type === 'attribute') {
      const element = resolvePath(fragment, descriptor.path);
      return new AttributePart(element, descriptor.name);
    }
    throw new Error(`Unknown descriptor type: ${descriptor.type}`);
  });
}

function shouldTreatAsReactive(part) {
  if (part instanceof AttributePart && part.isEvent) {
    return false;
  }
  return true;
}
