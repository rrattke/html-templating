import type { TemplateResult } from '../template/html.js';
import { html } from '../template/html.js';
import { instantiate } from '../template/instantiate.js';

export abstract class ReactiveElement extends HTMLElement {
  #dispose: (() => void) | null = null;

  protected template(): TemplateResult {
    return html``;
  }

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    this.#dispose?.();
    this.#dispose = null;
  }

  protected render(): void {
    const result = this.template();
    if (!result) {
      return;
    }
    this.#dispose?.();
    const { fragment, dispose } = instantiate(result);
    this.#dispose = dispose;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    root.replaceChildren(fragment);
  }
}
