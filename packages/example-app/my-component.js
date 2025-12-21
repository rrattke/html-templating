import { ReactiveElement, html, createSignal } from '@vanishing/framework';

class CounterButton extends ReactiveElement {
  constructor() {
    super();
    this.#counter = createSignal(0);
  }

  #counter;

  template() {
    const [count, setCount] = this.#counter;
    return html`
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, sans-serif;
        }

        button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 999px;
          border: 1px solid #222;
          background: #fff;
          cursor: pointer;
        }
      </style>
      <button onclick=${() => setCount(value => value + 1)}>
        <span>Count:</span>
        <strong>${() => count()}</strong>
      </button>
    `;
  }
}

customElements.define('demo-counter', CounterButton);
