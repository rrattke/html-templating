/**
 * Tests for render.ts module.
 * Verifies template instantiation and binding functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DynamicBinding, TemplateInstance } from './render.js';
import { StandardAttributePart, PropertyAttributePart, BooleanAttributePart, EventAttributePart } from './parts.js';

describe('Template to Part Translation', () => {
  // Create a mock runtime for testing
  const dummyRuntime = {
    effect: (fn: () => void) => {
      fn();
      return () => {};
    }
  } as any;

  // Create the html function for the mock runtime
  const html = DynamicBinding.with(dummyRuntime);

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
  const html = DynamicBinding.with(dummyRuntime);

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
  const html = DynamicBinding.with(dummyRuntime);

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

  const html = DynamicBinding.with(dummyRuntime);

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

  const html = DynamicBinding.with(dummyRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should create keyed template using html(key) syntax', () => {
    const template = html('my-key')`<div>Content</div>`;
    
    expect(template.id).toBe('my-key');
    
    const instance = template.instance();
    container.appendChild(instance.fragment);
    
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('Content');
  });

  it('should create keyed templates in arrays', () => {
    const items = ['a', 'b', 'c'];
    const templates = items.map(item => html(item)`<span>${item}</span>`);
    
    expect(templates[0].id).toBe('a');
    expect(templates[1].id).toBe('b');
    expect(templates[2].id).toBe('c');
  });

  it('should work with numeric keys', () => {
    const template = html(123)`<div>Numbered</div>`;
    
    expect(template.id).toBe(123);
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

  const html = DynamicBinding.with(dummyRuntime);

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
    const reactiveHtml = DynamicBinding.with(reactiveRuntime);
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

  const html = DynamicBinding.with(dummyRuntime);

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

describe('StaticBinding.render()', () => {
  let container: HTMLElement;

  // Create a minimal runtime for the html tag (values won't be reactive)
  const staticRuntime = { 
    effect: (fn: () => void) => { fn(); return () => {}; } 
  } as any;

  const html = DynamicBinding.with(staticRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should render a simple template', () => {
    const template = html`<span>Hello</span>`;
    const fragment = template.render();
    container.appendChild(fragment);

    expect(container.textContent).toBe('Hello');
  });

  it('should render with interpolated values', () => {
    const name = 'World';
    const template = html`<span>Hello ${name}!</span>`;
    const fragment = template.render();
    container.appendChild(fragment);

    expect(container.textContent).toBe('Hello World!');
  });

  it('should render nested templates', () => {
    const inner = html`<em>nested</em>`;
    const outer = html`<div>This is ${inner} content</div>`;
    const fragment = outer.render();
    container.appendChild(fragment);

    const em = container.querySelector('em');
    expect(em?.textContent).toBe('nested');
  });

  it('should render arrays of templates', () => {
    const items = ['A', 'B', 'C'];
    const template = html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`;
    const fragment = template.render();
    container.appendChild(fragment);

    const lis = container.querySelectorAll('li');
    expect(lis).toHaveLength(3);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
    expect(lis[2].textContent).toBe('C');
  });

  it('should render deeply nested templates', () => {
    const level3 = html`<span>deep</span>`;
    const level2 = html`<div>${level3}</div>`;
    const level1 = html`<section>${level2}</section>`;
    const fragment = level1.render();
    container.appendChild(fragment);

    const span = container.querySelector('section > div > span');
    expect(span?.textContent).toBe('deep');
  });

  it('should handle nested arrays (flattening)', () => {
    const items = [
      html`<li>A</li>`,
      [html`<li>B</li>`, html`<li>C</li>`],
      html`<li>D</li>`
    ];
    const template = html`<ul>${items}</ul>`;
    const fragment = template.render();
    container.appendChild(fragment);

    const lis = container.querySelectorAll('li');
    expect(lis).toHaveLength(4);
    expect(container.querySelector('ul')?.textContent).toBe('ABCD');
  });

  it('should handle null and false values', () => {
    const showA = true;
    const showB = false;
    const template = html`<div>${showA && html`<span>A</span>`}${showB && html`<span>B</span>`}</div>`;
    const fragment = template.render();
    container.appendChild(fragment);

    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('A');
  });

  it('should render attributes', () => {
    const cls = 'my-class';
    const template = html`<div class="${cls}">Content</div>`;
    const fragment = template.render();
    container.appendChild(fragment);

    const div = container.querySelector('div');
    expect(div?.className).toBe('my-class');
  });

  it('should return a DocumentFragment directly', () => {
    const template = html`<span>Test</span>`;
    const result = template.render();

    expect(result).toBeInstanceOf(DocumentFragment);
  });
});

/**
 * FAILING TEST: Documents the list reconciliation problem.
 * 
 * When moving an item in a keyed list, the current implementation recreates
 * ALL list items instead of just moving the DOM nodes. This causes:
 * 1. Visual flashing in the browser
 * 2. Loss of DOM state (focus, scroll position, animations)
 * 3. Unnecessary performance overhead
 */
describe('List Reconciliation - DOM Identity Preservation', () => {
  let container: HTMLElement;
  let effectCallbacks: Array<() => void>;
  
  // Runtime that tracks effects so we can re-trigger them
  const trackingRuntime = {
    effect: (fn: () => void) => {
      effectCallbacks.push(fn);
      fn(); // Run immediately
      return () => {
        const index = effectCallbacks.indexOf(fn);
        if (index >= 0) effectCallbacks.splice(index, 1);
      };
    }
  } as any;

  const html = DynamicBinding.with(trackingRuntime);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    effectCallbacks = [];
  });

  afterEach(() => {
    container.remove();
  });

  function rerunEffects() {
    for (const fn of effectCallbacks) {
      fn();
    }
  }

  it('should preserve DOM identity when reordering keyed items', () => {
    // Setup: Render a list with 3 items
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    // Template factory using keys
    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    // Verify initial render
    const lisBefore = container.querySelectorAll('li');
    expect(lisBefore).toHaveLength(3);
    
    // Capture DOM references BEFORE the move
    const liA = lisBefore[0];
    const liB = lisBefore[1];
    const liC = lisBefore[2];
    
    expect(liA.dataset.id).toBe('a');
    expect(liB.dataset.id).toBe('b');
    expect(liC.dataset.id).toBe('c');

    // Move item C to the front: [C, A, B]
    items = [items[2], items[0], items[1]];
    rerunEffects();

    // Verify new order
    const lisAfter = container.querySelectorAll('li');
    expect(lisAfter).toHaveLength(3);
    expect(lisAfter[0].dataset.id).toBe('c');
    expect(lisAfter[1].dataset.id).toBe('a');
    expect(lisAfter[2].dataset.id).toBe('b');

    // THE CRITICAL CHECK: Are the DOM nodes the SAME objects?
    // If reconciliation is working, these should be the exact same DOM nodes,
    // just in a different order. If it's broken, they'll be new nodes.
    expect(lisAfter[0]).toBe(liC); // C moved to position 0
    expect(lisAfter[1]).toBe(liA); // A moved to position 1
    expect(lisAfter[2]).toBe(liB); // B moved to position 2
  });

  it('should only touch moved nodes, not recreate all nodes', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    const ul = container.querySelector('ul')!;
    const liA = container.querySelector('[data-id="a"]')!;
    const liB = container.querySelector('[data-id="b"]')!;
    const liC = container.querySelector('[data-id="c"]')!;

    // Track DOM mutations
    const mutations: Array<{ type: string; node: Node; tagName?: string }> = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          mutations.push({ 
            type: 'added', 
            node,
            tagName: (node as Element).tagName 
          });
        }
        for (const node of record.removedNodes) {
          mutations.push({ 
            type: 'removed', 
            node,
            tagName: (node as Element).tagName 
          });
        }
      }
    });
    observer.observe(ul, { childList: true, subtree: true });

    // Move C to front: [C, A, B]
    items = [items[2], items[0], items[1]];
    rerunEffects();
    observer.disconnect();

    // Verify DOM nodes are the SAME objects, just reordered
    const lisAfter = container.querySelectorAll('li');
    expect(lisAfter[0]).toBe(liC);
    expect(lisAfter[1]).toBe(liA);
    expect(lisAfter[2]).toBe(liB);
  });

  it('should not move items that have not changed position', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    let extractContentCalls = 0;
    const originalExtractContent = TemplateInstance.prototype.extractContent;
    TemplateInstance.prototype.extractContent = function() {
      extractContentCalls++;
      return originalExtractContent.call(this);
    };

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    const ul = container.querySelector('ul')!;
    const liA = container.querySelector('[data-id="a"]')!;
    const liB = container.querySelector('[data-id="b"]')!;
    const liC = container.querySelector('[data-id="c"]')!;

    extractContentCalls = 0; // Reset after initial render

    // Track ALL DOM mutations on the UL
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      mutations.push(...records);
    });
    observer.observe(ul, { childList: true });

    // Same items, same order - nothing should be moved
    items = [...items];
    rerunEffects();
    observer.disconnect();
    
    // Restore original
    TemplateInstance.prototype.extractContent = originalExtractContent;

    // extractContent should NOT be called for items in the same position
    expect(extractContentCalls).toBe(0);

    // No mutations should have occurred - items are in the same position!
    expect(mutations).toHaveLength(0);

    // Also verify DOM nodes are still the same objects
    expect(container.querySelector('[data-id="a"]')).toBe(liA);
    expect(container.querySelector('[data-id="b"]')).toBe(liB);
    expect(container.querySelector('[data-id="c"]')).toBe(liC);
  });

  it('should only extract items that actually move, leaving others in place', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    const extractedKeys: string[] = [];
    const originalExtractContent = TemplateInstance.prototype.extractContent;
    TemplateInstance.prototype.extractContent = function() {
      // Try to identify which item this is by checking the DOM
      // For list items (no marker), start is the first element
      // For instances with markers, start.nextSibling is the first element
      const firstElement = (this.range.start.nodeType === Node.COMMENT_NODE 
        ? this.range.start.nextSibling 
        : this.range.start) as HTMLElement;
      if (firstElement?.dataset?.id) {
        extractedKeys.push(firstElement.dataset.id);
      }
      return originalExtractContent.call(this);
    };

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    extractedKeys.length = 0; // Reset after initial render

    // Move C to front: [C, A, B]
    // With LIS algorithm:
    // - Old positions: A=0, B=1, C=2
    // - New positions: C=0, A=1, B=2
    // - Indices in old: [2, 0, 1]
    // - LIS of [2, 0, 1] is [0, 1] at indices 1, 2 (A and B)
    // - So only C needs to move
    items = [items[2], items[0], items[1]];
    rerunEffects();

    // Restore original
    TemplateInstance.prototype.extractContent = originalExtractContent;

    // Only C should have been extracted
    expect(extractedKeys).toEqual(['c']);
  });

  it('should add new items to the list', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    // Capture original nodes
    const liA = container.querySelector('[data-id="a"]')!;
    const liB = container.querySelector('[data-id="b"]')!;
    expect(container.querySelectorAll('li')).toHaveLength(2);

    // Add item C at the end
    items = [...items, { id: 'c', label: 'Item C' }];
    rerunEffects();

    const lisAfter = container.querySelectorAll('li');
    expect(lisAfter).toHaveLength(3);
    
    // Original nodes should be preserved
    expect(lisAfter[0]).toBe(liA);
    expect(lisAfter[1]).toBe(liB);
    // New node created for C
    expect(lisAfter[2].dataset.id).toBe('c');
  });

  it('should add new items in the middle of the list', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'c', label: 'Item C' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    const liA = container.querySelector('[data-id="a"]')!;
    const liC = container.querySelector('[data-id="c"]')!;

    // Insert B between A and C
    items = [items[0], { id: 'b', label: 'Item B' }, items[1]];
    rerunEffects();

    const lisAfter = container.querySelectorAll('li');
    expect(lisAfter).toHaveLength(3);
    expect(lisAfter[0]).toBe(liA);
    expect(lisAfter[1].dataset.id).toBe('b'); // New node
    expect(lisAfter[2]).toBe(liC);
  });

  it('should remove items from the list', () => {
    let items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    const liA = container.querySelector('[data-id="a"]')!;
    const liC = container.querySelector('[data-id="c"]')!;
    expect(container.querySelectorAll('li')).toHaveLength(3);

    // Remove B
    items = [items[0], items[2]];
    rerunEffects();

    const lisAfter = container.querySelectorAll('li');
    expect(lisAfter).toHaveLength(2);
    expect(lisAfter[0]).toBe(liA);
    expect(lisAfter[1]).toBe(liC);
    
    // B should no longer be in the document
    expect(container.querySelector('[data-id="b"]')).toBeNull();
  });

  it('should handle clearing the entire list', () => {
    let items: Array<{ id: string; label: string }> = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    expect(container.querySelectorAll('li')).toHaveLength(2);

    // Clear list
    items = [];
    rerunEffects();

    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('should handle repopulating an empty list', () => {
    let items: Array<{ id: string; label: string }> = [];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    expect(container.querySelectorAll('li')).toHaveLength(0);

    // Add items
    items = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' }
    ];
    rerunEffects();

    const lis = container.querySelectorAll('li');
    expect(lis).toHaveLength(2);
    expect(lis[0].dataset.id).toBe('a');
    expect(lis[1].dataset.id).toBe('b');
  });

  it('should preserve existing items when adding multiple times', () => {
    // This tests that range tracking remains valid after content is moved.
    // Previously, extractContent() would collapse the range, causing items
    // to disappear on subsequent updates.
    let items: Array<{ id: string; label: string }> = [
      { id: 'a', label: 'Item A' },
      { id: 'b', label: 'Item B' },
      { id: 'c', label: 'Item C' }
    ];

    const itemTemplate = (item: { id: string; label: string }) => 
      html(item.id)`<li data-id="${item.id}">${item.label}</li>`;

    const template = html`<ul>${() => items.map(itemTemplate)}</ul>`;
    const instance = template.instance();
    container.appendChild(instance.fragment);

    // Capture original nodes
    const liA = container.querySelector('[data-id="a"]')!;
    const liB = container.querySelector('[data-id="b"]')!;
    const liC = container.querySelector('[data-id="c"]')!;
    expect(container.querySelectorAll('li')).toHaveLength(3);

    // Add first new item
    items = [...items, { id: 'd', label: 'Item D' }];
    rerunEffects();

    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(container.querySelector('[data-id="a"]')).toBe(liA);
    expect(container.querySelector('[data-id="b"]')).toBe(liB);
    expect(container.querySelector('[data-id="c"]')).toBe(liC);
    expect(container.querySelector('[data-id="d"]')).not.toBeNull();

    // Add second new item - this is where the bug manifested
    // Range tracking was broken after first reuse, causing items to disappear
    items = [...items, { id: 'e', label: 'Item E' }];
    rerunEffects();

    expect(container.querySelectorAll('li')).toHaveLength(5);
    // All original items should still be present and be the same DOM nodes
    expect(container.querySelector('[data-id="a"]')).toBe(liA);
    expect(container.querySelector('[data-id="b"]')).toBe(liB);
    expect(container.querySelector('[data-id="c"]')).toBe(liC);
    expect(container.querySelector('[data-id="d"]')).not.toBeNull();
    expect(container.querySelector('[data-id="e"]')).not.toBeNull();

    // Add third new item to confirm stability
    items = [...items, { id: 'f', label: 'Item F' }];
    rerunEffects();

    expect(container.querySelectorAll('li')).toHaveLength(6);
    expect(container.querySelector('[data-id="a"]')).toBe(liA);
    expect(container.querySelector('[data-id="b"]')).toBe(liB);
    expect(container.querySelector('[data-id="c"]')).toBe(liC);
  });
});