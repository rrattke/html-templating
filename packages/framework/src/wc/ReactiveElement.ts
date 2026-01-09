import type { TemplateResult } from '../template/html.js';
import { html } from '../template/html.js';
import { instantiate } from '../template/instantiate.js';
import type { PartRuntime } from '../template/runtime.js';
import { getPartRuntime } from '../template/runtime.js';

export abstract class ReactiveElement extends HTMLElement {
  #dispose: (() => void) | null = null;

  constructor() {
    super();
  }

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
    const { fragment, dispose } = instantiate(result, this.partRuntime());
    this.#dispose = dispose;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    root.replaceChildren(fragment);
  }

  protected partRuntime(): PartRuntime {
    return getPartRuntime();
  }
}
