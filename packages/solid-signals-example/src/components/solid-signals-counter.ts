import { html, ReactiveElement } from '@vanishing/framework';
import { createSignal } from 'solid-js';
import { solidRuntime } from '../runtime/solid-runtime.js';

const counterStyles = `
  :host {
    display: block;
    padding: 1.75rem;
    border-radius: 1.5rem;
    background: linear-gradient(135deg, #ffffff, #eef9ff);
    color: #0f172a;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.08);
    min-width: 300px;
    border: 1px solid rgba(14, 165, 233, 0.2);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-size: 0.78rem;
    color: #0ea5e9;
  }
  header span:last-child {
    background: rgba(14, 165, 233, 0.18);
    border-radius: 999px;
    padding: 0.2rem 0.8rem;
    color: #0f172a;
    letter-spacing: normal;
    font-size: 0.72rem;
  }
  .value {
    font-size: 3rem;
    font-weight: 600;
    margin: 0 0 1.3rem;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }
  button {
    border: none;
    border-radius: 0.95rem;
    padding: 0.7rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    background: rgba(14, 165, 233, 0.12);
    color: #0f172a;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button:hover {
    transform: translateY(-1px);
    background: rgba(14, 165, 233, 0.22);
  }
`;

export class SolidSignalsCounter extends ReactiveElement {
  #count!: () => number;
  #setCount!: (value: number | ((prev: number) => number)) => number;

  constructor() {
    super();
    const [count, setCount] = createSignal(2);
    this.#count = count;
    this.#setCount = setCount;
  }

  protected override partRuntime() {
    return solidRuntime;
  }

  protected template() {
    return html`
      <style>${counterStyles}</style>
      <header>
        <span>Solid Signals</span>
        <span>${() => (this.#count() % 2 === 0 ? 'even' : 'odd')}</span>
      </header>
      <p class="value">${() => this.#count()}</p>
      <div class="actions">
        <button type="button" onclick=${() => this.#setCount(value => value - 1)}>-1</button>
        <button type="button" onclick=${() => this.#setCount(() => 0)}>Reset</button>
        <button type="button" onclick=${() => this.#setCount(value => value + 1)}>+1</button>
      </div>
    `;
  }
}

customElements.define('solid-signals-counter', SolidSignalsCounter);
