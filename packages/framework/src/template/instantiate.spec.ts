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

  describe('Nested Templates', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    it('should render nested template as child content', () => {
      const inner = html`<span>Inner</span>`;
      const outer = html`<div>${inner}</div>`;
      
      const instance = outer.instance();
      container.appendChild(instance.fragment);
      
      const div = container.querySelector('div');
      const span = div?.querySelector('span');
      expect(span?.textContent).toBe('Inner');
    });

    it('should render multiple nested templates', () => {
      const first = html`<span>First</span>`;
      const second = html`<span>Second</span>`;
      const outer = html`<div>${first}${second}</div>`;
      
      const instance = outer.instance();
      container.appendChild(instance.fragment);
      
      const spans = container.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      expect(spans[0].textContent).toBe('First');
      expect(spans[1].textContent).toBe('Second');
    });

    it('should render deeply nested templates', () => {
      const innermost = html`<em>Deep</em>`;
      const middle = html`<span>${innermost}</span>`;
      const outer = html`<div>${middle}</div>`;
      
      const instance = outer.instance();
      container.appendChild(instance.fragment);
      
      const em = container.querySelector('em');
      expect(em?.textContent).toBe('Deep');
    });

    it('should mix nested templates with static content', () => {
      const nested = html`<strong>Bold</strong>`;
      const template = html`<p>Start ${nested} End</p>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const p = container.querySelector('p');
      const strong = p?.querySelector('strong');
      expect(strong?.textContent).toBe('Bold');
      expect(p?.textContent).toContain('Start');
      expect(p?.textContent).toContain('End');
    });

    it('should handle conditional nested templates', () => {
      const condition = true;
      const nested = html`<span>Conditional</span>`;
      const template = html`<div>${condition && nested}</div>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const span = container.querySelector('span');
      expect(span?.textContent).toBe('Conditional');
    });

    it('should handle nested templates with attributes', () => {
      const inner = html`<button @click=${() => {}} ?disabled=${false}>Click</button>`;
      const outer = html`<div class=${'container'}>${inner}</div>`;
      
      const instance = outer.instance();
      container.appendChild(instance.fragment);
      
      const button = container.querySelector('button');
      expect(button).toBeDefined();
      expect(button?.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Template Iteration', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    it('should render array of templates', () => {
      const items = ['One', 'Two', 'Three'];
      const templates = items.map(item => html`<li>${item}</li>`);
      const template = html`<ul>${templates}</ul>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(3);
      expect(lis[0].textContent).toBe('One');
      expect(lis[1].textContent).toBe('Two');
      expect(lis[2].textContent).toBe('Three');
    });

    it('should render array of keyed templates', () => {
      const items = [
        { id: 1, text: 'First' },
        { id: 2, text: 'Second' },
        { id: 3, text: 'Third' }
      ];
      const templates = items.map(item => html(item.id)`<li>${item.text}</li>`);
      const template = html`<ul>${templates}</ul>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(3);
      expect(lis[0].textContent).toBe('First');
      expect(lis[1].textContent).toBe('Second');
      expect(lis[2].textContent).toBe('Third');
    });

    it('should render empty array', () => {
      const items: string[] = [];
      const templates = items.map(item => html`<li>${item}</li>`);
      const template = html`<ul>${templates}</ul>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(0);
    });

    it('should render mixed array of primitives and templates', () => {
      const mixed = [
        'Text',
        html`<span>Template</span>`,
        42,
        html`<strong>Bold</strong>`
      ];
      const template = html`<div>${mixed}</div>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const div = container.querySelector('div');
      expect(div?.textContent).toContain('Text');
      expect(div?.textContent).toContain('Template');
      expect(div?.textContent).toContain('42');
      expect(div?.textContent).toContain('Bold');
      expect(div?.querySelector('span')).toBeDefined();
      expect(div?.querySelector('strong')).toBeDefined();
    });

    it('should handle array.map inline with template creation', () => {
      const numbers = [1, 2, 3];
      const template = html`<ul>${numbers.map(n => html`<li>${n * 2}</li>`)}</ul>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(3);
      expect(lis[0].textContent).toBe('2');
      expect(lis[1].textContent).toBe('4');
      expect(lis[2].textContent).toBe('6');
    });

    it('should render nested iterations', () => {
      const groups = [
        { name: 'Group A', items: ['A1', 'A2'] },
        { name: 'Group B', items: ['B1', 'B2', 'B3'] }
      ];
      
      const template = html`
        <div>
          ${groups.map(group => html`
            <div class=${'group'}>
              <h3>${group.name}</h3>
              <ul>${group.items.map(item => html`<li>${item}</li>`)}</ul>
            </div>
          `)}
        </div>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const groupDivs = container.querySelectorAll('.group');
      expect(groupDivs).toHaveLength(2);
      
      const firstGroupLis = groupDivs[0].querySelectorAll('li');
      expect(firstGroupLis).toHaveLength(2);
      expect(firstGroupLis[0].textContent).toBe('A1');
      
      const secondGroupLis = groupDivs[1].querySelectorAll('li');
      expect(secondGroupLis).toHaveLength(3);
      expect(secondGroupLis[0].textContent).toBe('B1');
    });

    it('should handle keyed templates with attributes in iteration', () => {
      const todos = [
        { id: 1, text: 'Buy milk', done: true },
        { id: 2, text: 'Walk dog', done: false }
      ];
      
      const template = html`
        <ul>
          ${todos.map(todo => html(todo.id)`
            <li>
              <input type="checkbox" .checked=${todo.done}>
              <span>${todo.text}</span>
            </li>
          `)}
        </ul>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(2);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
      
      const spans = container.querySelectorAll('span');
      expect(spans[0].textContent).toBe('Buy milk');
      expect(spans[1].textContent).toBe('Walk dog');
    });

    it('should handle conditional rendering in iterations', () => {
      const items = [
        { id: 1, text: 'Visible', show: true },
        { id: 2, text: 'Hidden', show: false },
        { id: 3, text: 'Also Visible', show: true }
      ];
      
      const template = html`
        <ul>
          ${items.map(item => item.show && html(item.id)`<li>${item.text}</li>`)}
        </ul>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(2);
      expect(lis[0].textContent).toBe('Visible');
      expect(lis[1].textContent).toBe('Also Visible');
    });

    it('should handle keyed templates with event handlers', () => {
      let clickedId: number | null = null;
      const buttons = [
        { id: 1, label: 'First' },
        { id: 2, label: 'Second' }
      ];
      
      const template = html`
        <div>
          ${buttons.map(btn => html(btn.id)`
            <button @click=${() => { clickedId = btn.id; }}>${btn.label}</button>
          `)}
        </div>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const allButtons = container.querySelectorAll('button');
      expect(allButtons).toHaveLength(2);
      
      allButtons[1].click();
      expect(clickedId).toBe(2);
    });

    it('should handle large arrays efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `Item ${i}` }));
      const template = html`
        <ul>
          ${items.map(item => html(item.id)`<li>${item.value}</li>`)}
        </ul>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(100);
      expect(lis[0].textContent).toBe('Item 0');
      expect(lis[99].textContent).toBe('Item 99');
    });

    it('should handle filter + map operations', () => {
      const items = [
        { id: 1, text: 'Apple', visible: true },
        { id: 2, text: 'Banana', visible: false },
        { id: 3, text: 'Cherry', visible: true }
      ];
      
      const template = html`
        <ul>
          ${items
            .filter(item => item.visible)
            .map(item => html(item.id)`<li>${item.text}</li>`)}
        </ul>
      `;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const lis = container.querySelectorAll('li');
      expect(lis).toHaveLength(2);
      expect(lis[0].textContent).toBe('Apple');
      expect(lis[1].textContent).toBe('Cherry');
    });
  });
});
