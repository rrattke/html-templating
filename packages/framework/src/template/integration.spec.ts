import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateBinding } from './instantiate.js';

describe('integration tests', () => {
  let container: HTMLElement;
  let html: ReturnType<typeof TemplateBinding.with>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Set a simple runtime for non-reactive tests
    const runtime = {
      effect: (fn: () => void) => fn()
    } as any;
    html = TemplateBinding.with(runtime);
  });

  describe('style tag with dynamic content', () => {
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
      // Not a function, so shouldn't be reactive
      const template = html`<style>${css}</style>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      expect(style?.textContent).toBe(css);
    });
  });

  describe('combined style and content', () => {
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
  });

  describe('multi-expression text templates', () => {
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

    it('should render multiple expressions in style tag', () => {
      const color = 'blue';
      const bgColor = 'white';
      const template = html`<style>:host { color: ${color}; background: ${bgColor}; }</style>`;
      
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      expect(style?.textContent).toBe(':host { color: blue; background: white; }');
    });

    it('should update all slots when values change', () => {
      let class1 = 'initial1';
      let class2 = 'initial2';

      // Set up reactive runtime
      const effects: Array<() => void> = [];
      const reactiveRuntime = {
        effect: (fn: () => void) => {
          effects.push(fn);
          fn(); // Run initially
          return () => {};
        }
      } as any;
      const html = TemplateBinding.with(reactiveRuntime);
      const template = html`<div class="${() => class1} ${() => class2}"></div>`;
            
      const instance = template.instance();
      container.appendChild(instance.fragment);
      
      const div = container.querySelector('div');
      expect(div?.getAttribute('class')).toBe('initial1 initial2');
      
      // Update values and re-run effects
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
});
