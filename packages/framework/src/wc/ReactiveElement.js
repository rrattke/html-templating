import { html } from '../template/html.js';
import { instantiate } from '../template/instantiate.js';

export class ReactiveElement extends HTMLElement {
  constructor() {
    super();
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
    this._dispose = null;
  }

  template() {
    return html``;
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._dispose) {
      this._dispose();
      this._dispose = null;
    }
  }

  _render() {
    const result = this.template();
    if (!result) {
      return;
    }
    if (this._dispose) {
      this._dispose();
    }
    const { fragment, dispose } = instantiate(result);
    this._dispose = dispose;
    this.shadowRoot.replaceChildren(fragment);
  }
}
