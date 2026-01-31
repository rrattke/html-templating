/**
 * Tests for Reconciler class.
 * Verifies keyed reconciliation with DOM element identity preservation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Reconciler, TemplateBinding, InstanceState, TemplateInstance } from './render.js';
import { getTemplate as getPartsTemplate } from './template.js';
import { StandardAttributePart, PropertyAttributePart, BooleanAttributePart, EventAttributePart } from './parts.js';

describe('Reconciler', () => {
  let container: HTMLElement;
  let reconciler: Reconciler;

  // Create a mock runtime for testing
  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  // Create the html function for the mock runtime
  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    reconciler = new Reconciler(container);
  });

  afterEach(() => {
    reconciler.dispose();
    container.remove();
  });

  describe('basic rendering', () => {
    it('should render a single binding', () => {
      const bindings = [html('a')`<span>A</span>`];
      reconciler.render(bindings);

      expect(container.textContent).toBe('A');
      expect(reconciler.states.length).toBe(1);
    });

    it('should render multiple bindings', () => {
      const bindings = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings);

      expect(container.textContent).toBe('ABC');
      expect(reconciler.states.length).toBe(3);
    });

    it('should handle empty bindings array', () => {
      reconciler.render([]);

      expect(container.textContent).toBe('');
      expect(reconciler.states.length).toBe(0);
    });
  });

  describe('keyed reconciliation', () => {
    it('should reuse DOM elements for same keys', () => {
      const bindings1 = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`
      ];
      reconciler.render(bindings1);

      const spanA1 = container.querySelector('span');
      expect(spanA1?.textContent).toBe('A');

      const bindings2 = [
        html('a')`<span>A-updated</span>`,
        html('b')`<span>B-updated</span>`
      ];
      reconciler.render(bindings2);

      const spanA2 = container.querySelector('span');
      // The DOM element should be the same (reused)
      expect(spanA2).toBe(spanA1);
      // Content should be unchanged (reused instance keeps old content)
      expect(spanA2?.textContent).toBe('A');
    });

    it('should reorder elements when key order changes', () => {
      const bindings1 = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings1);

      const spans1 = container.querySelectorAll('span');
      const spanA = spans1[0];
      const spanB = spans1[1];
      const spanC = spans1[2];

      expect(container.textContent).toBe('ABC');

      // Reorder: C, A, B
      const bindings2 = [
        html('c')`<span>C</span>`,
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`
      ];
      reconciler.render(bindings2);

      const spans2 = container.querySelectorAll('span');
      // Same DOM elements, different order
      expect(spans2[0]).toBe(spanC);
      expect(spans2[1]).toBe(spanA);
      expect(spans2[2]).toBe(spanB);
      expect(container.textContent).toBe('CAB');
    });

    it('should dispose removed items', () => {
      const bindings1 = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings1);

      expect(reconciler.states.length).toBe(3);

      // Remove 'b'
      const bindings2 = [
        html('a')`<span>A</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings2);

      expect(reconciler.states.length).toBe(2);
      expect(container.textContent).toBe('AC');
    });

    it('should add new items at correct position', () => {
      const bindings1 = [
        html('a')`<span>A</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings1);

      expect(container.textContent).toBe('AC');

      // Add 'b' in between
      const bindings2 = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`,
        html('c')`<span>C</span>`
      ];
      reconciler.render(bindings2);

      expect(container.textContent).toBe('ABC');
      expect(reconciler.states.length).toBe(3);
    });
  });

  describe('DOM identity preservation', () => {
    it('should preserve element identity across reorders', () => {
      const bindings1 = [
        html('item1')`<div id="item1">Item 1</div>`,
        html('item2')`<div id="item2">Item 2</div>`,
        html('item3')`<div id="item3">Item 3</div>`
      ];
      reconciler.render(bindings1);

      const item1Before = container.querySelector('#item1');
      const item2Before = container.querySelector('#item2');
      const item3Before = container.querySelector('#item3');

      // Reverse order
      const bindings2 = [
        html('item3')`<div id="item3">Item 3</div>`,
        html('item2')`<div id="item2">Item 2</div>`,
        html('item1')`<div id="item1">Item 1</div>`
      ];
      reconciler.render(bindings2);

      const item1After = container.querySelector('#item1');
      const item2After = container.querySelector('#item2');
      const item3After = container.querySelector('#item3');

      // Same DOM elements, just moved
      expect(item1After).toBe(item1Before);
      expect(item2After).toBe(item2Before);
      expect(item3After).toBe(item3Before);

      // Verify new order
      const items = container.querySelectorAll('div');
      expect(items[0]).toBe(item3Before);
      expect(items[1]).toBe(item2Before);
      expect(items[2]).toBe(item1Before);
    });
  });

  describe('InstanceState', () => {
    it('should track key on state', () => {
      const bindings = [
        html('myKey')`<span>Content</span>`
      ];
      reconciler.render(bindings);

      expect(reconciler.states[0].key).toBe('myKey');
    });

    it('should support various key types', () => {
      const bindings = [
        html(1)`<span>Number</span>`,
        html('str')`<span>String</span>`,
        html(true)`<span>Boolean</span>`
      ];
      reconciler.render(bindings);

      expect(reconciler.states[0].key).toBe(1);
      expect(reconciler.states[1].key).toBe('str');
      expect(reconciler.states[2].key).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should dispose all states on reconciler.dispose()', () => {
      const bindings = [
        html('a')`<span>A</span>`,
        html('b')`<span>B</span>`
      ];
      reconciler.render(bindings);

      expect(container.children.length).toBeGreaterThan(0);

      reconciler.dispose();

      // Container should only have the end marker removed
      expect(reconciler.states.length).toBe(0);
    });
  });
});

describe('Template to Part Translation', () => {
  // Create a mock runtime for testing
  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  // Create the html function for the mock runtime
  const html = TemplateBinding.with(dummyRuntime);

  describe('Event Listeners (@prefix)', () => {
    it('should create EventAttributePart for @click', () => {
      const template = html`<button @click=${() => {}}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for @input', () => {
      const template = html`<input @input=${() => {}}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for @change', () => {
      const template = html`<input @change=${() => {}}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create EventAttributePart for custom event @customevent', () => {
      const template = html`<div @customevent=${() => {}}>Custom</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
    });

    it('should create multiple EventAttributeParts for multiple event handlers', () => {
      const template = html`<button @click=${() => {}} @mouseenter=${() => {}}>Hover</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}, () => {}]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(EventAttributePart);
    });
  });

  describe('Property Bindings (.prefix)', () => {
    it('should create PropertyAttributePart for .value', () => {
      const template = html`<input .value=${'text'}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['text']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for .checked', () => {
      const template = html`<input .checked=${true}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for .disabled', () => {
      const template = html`<button .disabled=${false}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [false]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create PropertyAttributePart for custom property', () => {
      const template = html`<div .customProp=${'value'}>Custom</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['value']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
    });

    it('should create multiple PropertyAttributeParts', () => {
      const template = html`<input .value=${'text'} .disabled=${false}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['text', false]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(PropertyAttributePart);
    });
  });

  describe('Boolean Attributes (?prefix)', () => {
    it('should create BooleanAttributePart for ?disabled', () => {
      const template = html`<button ?disabled=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?checked', () => {
      const template = html`<input ?checked=${false}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [false]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?hidden', () => {
      const template = html`<div ?hidden=${true}>Hidden</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create BooleanAttributePart for ?readonly', () => {
      const template = html`<input ?readonly=${true}>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [true]);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
    });

    it('should create multiple BooleanAttributeParts', () => {
      const template = html`<button ?disabled=${false} ?hidden=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [false, true]);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(BooleanAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(BooleanAttributePart);
    });
  });

  describe('Standard Attributes (no prefix)', () => {
    it('should create StandardAttributePart for regular class attribute', () => {
      const template = html`<div class=${'container'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['container']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for id attribute', () => {
      const template = html`<div id=${'myid'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['myid']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for data attribute', () => {
      const template = html`<div data-test=${'value'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['value']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create StandardAttributePart for aria attribute', () => {
      const template = html`<button aria-label=${'Click me'}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['Click me']);
      
      expect(instance.parts).toHaveLength(1);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
    });

    it('should create multiple StandardAttributeParts', () => {
      const template = html`<div class=${'container'} id=${'myid'}>Content</div>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['container', 'myid']);
      
      expect(instance.parts).toHaveLength(2);
      expect(instance.parts[0]).toBeInstanceOf(StandardAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(StandardAttributePart);
    });
  });

  describe('Mixed Attribute Types', () => {
    it('should create correct parts for event, property, and boolean attributes', () => {
      const template = html`<button @click=${() => {}} .disabled=${false} ?hidden=${true}>Click</button>`;
      const partsTemplate = template.getTemplate();
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}, false, true]);
      
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
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, ['input', () => {}, 'text', false]);
      
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
      const instance = TemplateInstance.create(dummyRuntime, partsTemplate, [() => {}, 'text', true, 'text']);
      
      expect(instance.parts).toHaveLength(4);
      expect(instance.parts[0]).toBeInstanceOf(EventAttributePart);
      expect(instance.parts[1]).toBeInstanceOf(PropertyAttributePart);
      expect(instance.parts[2]).toBeInstanceOf(BooleanAttributePart);
      expect(instance.parts[3]).toBeInstanceOf(StandardAttributePart);
    });
  });
});

describe('Nested Templates', () => {
  let container: HTMLElement;

  // Create a mock runtime for testing
  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  // Create the html function for the mock runtime
  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
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

  // Create a mock runtime for testing
  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  // Create the html function for the mock runtime
  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
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

  it('should handle nested arrays (flatten arrays within arrays)', () => {
    const templates = [
      html`<span>A</span>`,
      [html`<span>B</span>`, html`<span>C</span>`],
      html`<span>D</span>`
    ];
    const template = html`<div>${templates}</div>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(4);
    expect(spans[0].textContent).toBe('A');
    expect(spans[1].textContent).toBe('B');
    expect(spans[2].textContent).toBe('C');
    expect(spans[3].textContent).toBe('D');
  });

  it('should clear template bindings with null', () => {
    const inner = html`<span>Content</span>`;
    const template = html`<div>${inner}</div>`;
    
    let instance = template.instance();
    container.appendChild(instance.fragment);
    expect(container.querySelector('span')?.textContent).toBe('Content');
    
    // Clear with null
    const cleared = html`<div>${null}</div>`;
    instance = cleared.instance();
    container.innerHTML = '';
    container.appendChild(instance.fragment);
    
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('div')?.textContent).toBe('');
  });

  it('should clear template bindings with false', () => {
    const inner = html`<span>Content</span>`;
    const template = html`<div>${inner}</div>`;
    
    let instance = template.instance();
    container.appendChild(instance.fragment);
    expect(container.querySelector('span')?.textContent).toBe('Content');
    
    // Clear with false (enables conditional rendering)
    const cleared = html`<div>${false}</div>`;
    instance = cleared.instance();
    container.innerHTML = '';
    container.appendChild(instance.fragment);
    
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('div')?.textContent).toBe('');
  });
});

describe('Style Tag Rendering', () => {
  let container: HTMLElement;

  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should render static CSS in style tag', () => {
    const css = ':host { color: red; }';
    const template = html`<style>${css}</style>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const style = container.querySelector('style');
    expect(style).toBeDefined();
    expect(style?.textContent).toBe(css);
  });

  it('should render variable CSS in style tag', () => {
    const primaryColor = 'blue';
    const css = `:host { color: ${primaryColor}; }`;
    const template = html`<style>${css}</style>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const style = container.querySelector('style');
    expect(style?.textContent).toBe(css);
  });

  it('should not treat style content as reactive', () => {
    const css = ':host { color: blue; }';
    const template = html`<style>${css}</style>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const style = container.querySelector('style');
    expect(style?.textContent).toBe(css);
  });

  it('should handle both style and dynamic content', () => {
    const css = ':host { color: red; }';
    const message = 'Hello';
    
    const template = html`<style>${css}</style><p>${message}</p>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const style = container.querySelector('style');
    const p = container.querySelector('p');
    
    expect(style?.textContent).toBe(css);
    expect(p?.textContent).toBe(message);
  });

  it('should render multiple expressions in style tag', () => {
    const color = 'blue';
    const bgColor = 'white';
    const template = html`<style>:host { color: ${color}; background: ${bgColor}; }</style>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const style = container.querySelector('style');
    expect(style?.textContent).toBe(':host { color: blue; background: white; }');
  });
});

describe('Keyed Templates', () => {
  let container: HTMLElement;

  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should create keyed template using html(key) syntax', () => {
    const template = html('my-key')`<div>Content</div>`;
    
    expect(template.key).toBe('my-key');
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('Content');
  });

  it('should create keyed templates in arrays', () => {
    const items = ['a', 'b', 'c'];
    const templates = items.map(item => html(item)`<span>${item}</span>`);
    
    expect(templates[0].key).toBe('a');
    expect(templates[1].key).toBe('b');
    expect(templates[2].key).toBe('c');
  });

  it('should work with numeric keys', () => {
    const template = html(123)`<div>Numbered</div>`;
    
    expect(template.key).toBe(123);
  });
});

describe('Multi-Expression Text Templates', () => {
  let container: HTMLElement;

  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should render multiple expressions in one attribute', () => {
    const class1 = 'foo';
    const class2 = 'bar';
    const template = html`<div class="${class1} ${class2}"></div>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.getAttribute('class')).toBe('foo bar');
  });

  it('should render mixed static and dynamic in attribute', () => {
    const theme = 'dark';
    const template = html`<div class="prefix-${theme}-suffix"></div>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.getAttribute('class')).toBe('prefix-dark-suffix');
  });

  it('should update all slots when values change', () => {
    let class1 = 'initial1';
    let class2 = 'initial2';

    const effects: Array<() => void> = [];
    const reactiveRuntime = {
      effect: (fn: () => void) => {
        effects.push(fn);
        fn();
        return () => {};
      }
    } as any;
    const reactiveHtml = TemplateBinding.with(reactiveRuntime);
    const template = reactiveHtml`<div class="${() => class1} ${() => class2}"></div>`;
          
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.getAttribute('class')).toBe('initial1 initial2');
    
    class1 = 'updated1';
    class2 = 'updated2';
    effects.forEach(fn => fn());
    
    expect(div?.getAttribute('class')).toBe('updated1 updated2');
  });

  it('should handle null and undefined in multi-expression templates', () => {
    const template = html`<div class="${null} ${undefined} valid"></div>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.getAttribute('class')).toBe('  valid');
  });

  it('should convert values to strings in multi-expression templates', () => {
    const num = 42;
    const bool = true;
    const template = html`<div data-values="${num} ${bool}"></div>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.getAttribute('data-values')).toBe('42 true');
  });
});

describe('Boolean Attribute Binding', () => {
  let container: HTMLElement;

  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  const html = TemplateBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should add attribute when value is truthy', () => {
    const isDisabled = true;
    const template = html`<button ?disabled=${isDisabled}>Click</button>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.getAttribute('disabled')).toBe('');
  });

  it('should remove attribute when value is falsy', () => {
    const isDisabled = false;
    const template = html`<button ?disabled=${isDisabled}>Click</button>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(false);
  });

  it('should handle null/undefined as falsy', () => {
    const template1 = html`<input ?checked=${null}>`;
    const template2 = html`<input ?checked=${undefined}>`;
    
    const instance1 = template1.instance();
    const instance2 = template2.instance();
    container.appendChild(instance1.fragment);
    container.appendChild(instance2.fragment);
    
    const inputs = container.querySelectorAll('input');
    expect(inputs[0]?.hasAttribute('checked')).toBe(false);
    expect(inputs[1]?.hasAttribute('checked')).toBe(false);
  });

  it('should treat non-boolean truthy values as true', () => {
    const template = html`<input ?required=${'yes'}>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const input = container.querySelector('input');
    expect(input?.hasAttribute('required')).toBe(true);
  });

  it('should handle multiple boolean attributes', () => {
    const disabled = true;
    const hidden = false;
    const template = html`<button ?disabled=${disabled} ?hidden=${hidden}>Click</button>`;
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.hasAttribute('hidden')).toBe(false);
  });
});
