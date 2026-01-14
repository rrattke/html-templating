import { describe, it, expect, beforeEach } from 'vitest';
import { html } from './html.js';
import { instantiate } from './instantiate.js';
import { setPartRuntime } from './runtime.js';

describe('integration tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Set a simple runtime for non-reactive tests
    setPartRuntime({
      effect: (fn) => {
        fn();
        return () => {};
      }
    });
  });

  describe('style tag with dynamic content', () => {
    it('should render static CSS in style tag', () => {
      const css = ':host { color: red; }';
      const result = html`<style>${css}</style>`;
      
      const instance = instantiate(result);
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      expect(style).toBeDefined();
      expect(style?.textContent).toBe(css);
    });

    it('should render variable CSS in style tag', () => {
      const primaryColor = 'blue';
      const css = `:host { color: ${primaryColor}; }`;
      const result = html`<style>${css}</style>`;
      
      const instance = instantiate(result);
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      expect(style?.textContent).toBe(css);
    });

    it('should not treat style content as reactive', () => {
      const css = ':host { color: blue; }';
      // Not a function, so shouldn't be reactive
      const result = html`<style>${css}</style>`;
      
      const instance = instantiate(result);
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      expect(style?.textContent).toBe(css);
    });
  });

  describe('combined style and content', () => {
    it('should handle both style and dynamic content', () => {
      const css = ':host { color: red; }';
      const message = 'Hello';
      
      const result = html`<style>${css}</style><p>${message}</p>`;
      
      const instance = instantiate(result);
      container.appendChild(instance.fragment);
      
      const style = container.querySelector('style');
      const p = container.querySelector('p');
      
      expect(style?.textContent).toBe(css);
      expect(p?.textContent).toBe(message);
    });
  });
});
