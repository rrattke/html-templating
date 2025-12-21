import { createSignal, html, ReactiveElement } from '@vanishing/framework';

const baseStyles = `
  :host {
    display: inline-flex;
    font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 999px;
    border: 1px solid #111;
    padding: 0.35rem 1rem;
    background: white;
    font-size: 1rem;
    cursor: pointer;
  }
`;

export class DemoCounter extends ReactiveElement {
  #signal = createSignal(0);

  protected template() {
    const [count, setCount] = this.#signal;
    return html`
      <style>${baseStyles}</style>
      <button onclick=${() => setCount(value => value + 1)}>
        <span>Count:</span>
        <strong>${() => count()}</strong>
      </button>
    `;
  }
}

customElements.define('demo-counter', DemoCounter);
