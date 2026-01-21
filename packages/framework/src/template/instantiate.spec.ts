/**
 * Tests for template instantiation and part creation.
 * Verifies that HTML templates are correctly translated into the appropriate Part types.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateBinding, getPartsTemplate, create } from './instantiate.js';
import { StandardAttributePart, PropertyAttributePart, BooleanAttributePart, EventAttributePart } from './parts.js';

const dummyRuntime = { 
  effect: (fn: () => void) => {
    fn();
    return () => {};
  } 
} as any;

const html = TemplateBinding.with(dummyRuntime);

describe('Template to Part Translation', () => {
  describe('Event Listeners (@prefix)', () => {
    it('should create EventAttributePart for @click', () => {
      const template = html`<button @click=${() => {}}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for @input', () => {
      const template = html`<input @input=${() => {}}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for @change', () => {
      const template = html`<input @change=${() => {}}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for custom event @customevent', () => {
      const template = html`<div @customevent=${() => {}}>Custom</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create multiple EventAttributeParts for multiple event handlers', () => {
      const template = html`<button @click=${() => {}} @mouseenter=${() => {}}>Hover</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}, () => {}]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(EventAttributePart);
    });
  });

  describe('Property Bindings (.prefix)', () => {
    it('should create PropertyAttributePart for .value', () => {
      const template = html`<input .value=${'text'}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['text']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for .checked', () => {
      const template = html`<input .checked=${true}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for .disabled', () => {
      const template = html`<button .disabled=${false}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [false]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for custom property', () => {
      const template = html`<div .customProp=${'value'}>Custom</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['value']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create multiple PropertyAttributeParts', () => {
      const template = html`<input .value=${'text'} .disabled=${false}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['text', false]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(PropertyAttributePart);
    });
  });

  describe('Boolean Attributes (?prefix)', () => {
    it('should create BooleanAttributePart for ?disabled', () => {
      const template = html`<button ?disabled=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?checked', () => {
      const template = html`<input ?checked=${false}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [false]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?hidden', () => {
      const template = html`<div ?hidden=${true}>Hidden</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?readonly', () => {
      const template = html`<input ?readonly=${true}>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create multiple BooleanAttributeParts', () => {
      const template = html`<button ?disabled=${false} ?hidden=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [false, true]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(BooleanAttributePart);
    });
  });

  describe('Standard Attributes (no prefix)', () => {
    it('should create StandardAttributePart for regular class attribute', () => {
      const template = html`<div class=${'container'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['container']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for id attribute', () => {
      const template = html`<div id=${'myid'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['myid']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for data attribute', () => {
      const template = html`<div data-test=${'value'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['value']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for aria attribute', () => {
      const template = html`<button aria-label=${'Click me'}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['Click me']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create multiple StandardAttributeParts', () => {
      const template = html`<div class=${'container'} id=${'myid'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['container', 'myid']);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(StandardAttributePart);
    });
  });

  describe('Mixed Attribute Types', () => {
    it('should create correct parts for event, property, and boolean attributes', () => {
      const template = html`<button @click=${() => {}} .disabled=${false} ?hidden=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}, false, true]);
      
      expect(instance.parts).toHaveLength(3);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[2]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create correct parts for all attribute types', () => {
      const template = html`<input 
        class=${'input'}
        @input=${() => {}}
        .value=${'text'}
        ?disabled=${false}
      >`;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, ['input', () => {}, 'text', false]);
      
      expect(instance.parts).toHaveLength(4);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[2]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[3]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should handle multiple elements with different attribute types', () => {
      const template = html`
        <button @click=${() => {}}>Click</button>
        <input .value=${'text'}>
        <div ?hidden=${true}>Hidden</div>
        <span class=${'text'}>Text</span>
      `;
      const partsTemplate = template.getTemplate();
      const instance = create(dummyRuntime, partsTemplate, [() => {}, 'text', true, 'text']);
      
      expect(instance.parts).toHaveLength(4);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[2]).toBeInstanceOf(BooleanAttributePart);
      expect(instance.parts[3]).toBeInstanceOf(StandardAttributePart);
    });
  });

  describe('Descriptor Validation', () => {
    it('should create attribute descriptor with correct name for @click', () => {
      const strings = ['<button @click=', '>Click</button>'] as unknown as TemplateStringsArray;
      const template = getPartsTemplate(strings);
      
      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe('attribute');
      if (template.descriptors[0].type === 'attribute') {
        expect(template.descriptors[0].name).toBe('@click');
      }
    });

    it('should create attribute descriptor with correct name for .value', () => {
      const strings = ['<input .value=', '>'] as unknown as TemplateStringsArray;
      const template = getPartsTemplate(strings);
      
      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe('attribute');
      if (template.descriptors[0].type === 'attribute') {
        expect(template.descriptors[0].name).toBe('.value');
      }
    });

    it('should create attribute descriptor with correct name for ?disabled', () => {
      const strings = ['<button ?disabled=', '>Click</button>'] as unknown as TemplateStringsArray;
      const template = getPartsTemplate(strings);
      
      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe('attribute');
      if (template.descriptors[0].type === 'attribute') {
        expect(template.descriptors[0].name).toBe('?disabled');
      }
    });

    it('should preserve prefixes in descriptor names', () => {
      const strings = ['<button @click=', ' .disabled=', ' ?hidden=', '>Click</button>'] as unknown as TemplateStringsArray;
      const template = getPartsTemplate(strings);
      
      expect(template.descriptors).toHaveLength(3);
      expect(template.descriptors[0].type).toBe('attribute');
      expect(template.descriptors[1].type).toBe('attribute');
      expect(template.descriptors[2].type).toBe('attribute');
      
      if (template.descriptors[0].type === 'attribute') {
        expect(template.descriptors[0].name).toBe('@click');
      }
      if (template.descriptors[1].type === 'attribute') {
        expect(template.descriptors[1].name).toBe('.disabled');
      }
      if (template.descriptors[2].type === 'attribute') {
        expect(template.descriptors[2].name).toBe('?hidden');
      }
    });
  });
});
