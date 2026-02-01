import type { DynamicBinding } from '../template/render.js';

/**
 * A constructor type for classes that can be mixed with Reactive.
 */
type Constructor<T = object> = abstract new (...args: any[]) => T;

/**
 * Interface for Reactive instances - components that render reactive templates.
 */
export interface ReactiveInstance {
  /**
   * Returns the reactive template for this component.
   */
  template(): DynamicBinding;
  
  /**
   * Re-renders the component's template.
   */
  render(): void;
}

/**
 * Mixin that adds reactive template rendering to an HTMLElement.
 * 
 * Creates a shadow DOM and renders a reactive template into it.
 * The template is automatically re-rendered when reactive dependencies change.
 * 
 * @example
 * ```typescript
 * class MyComponent extends Reactive(HTMLElement) {
 *   template() {
 *     return html`<div>Hello World</div>`;
 *   }
 * }
 * ```
 * 
 * @example Composing with Styleable
 * ```typescript
 * class MyComponent extends Styleable(Reactive(HTMLElement)) {
 *   static styles = styles;
 *   
 *   template() {
 *     return html`<div>Styled reactive component</div>`;
 *   }
 * }
 * ```
 */
export function Reactive<TBase extends Constructor<HTMLElement>>(
  Base: TBase
): TBase & Constructor<ReactiveInstance> {
  abstract class ReactiveElement extends Base implements ReactiveInstance {
    #dispose: (() => void) | null = null;

    abstract template(): DynamicBinding;

    connectedCallback(): void {
      this.render();
    }

    disconnectedCallback(): void {
      this.#dispose?.();
      this.#dispose = null;
    }

    render(): void {
      const template = this.template();
      if (!template) {
        return;
      }
      this.#dispose?.();
      const { fragment, dispose } = template.instance();
      this.#dispose = dispose;
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      root.replaceChildren(fragment);
    }
  }

  return ReactiveElement;
}

/**
 * Convenience class for components that only need reactive rendering.
 * Equivalent to `Reactive(HTMLElement)`.
 * 
 * @deprecated Prefer using `Reactive(HTMLElement)` mixin for composition.
 */
export abstract class ReactiveElement extends Reactive(HTMLElement) {}
