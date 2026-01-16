import type { TemplateBinding } from '../template/instantiate.js';

export abstract class ReactiveElement extends HTMLElement {
  #dispose: (() => void) | null = null;

  constructor() {
    super();
  }

  abstract template(): TemplateBinding;

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    this.#dispose?.();
    this.#dispose = null;
  }

  protected render(): void {
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
