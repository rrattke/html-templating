import { html, ReactiveElement } from '@vanishing/framework';
import { createSignal } from 'solid-js';
import { solidRuntime } from '../runtime/solid-runtime.js';

const counterStyles = `
  :host {
    display: block;
    padding: 2rem;
    border-radius: 1.75rem;
    background: linear-gradient(135deg, #312e81, #7c3aed);
    color: #f4f0ff;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 18px 45px rgba(52, 31, 151, 0.45);
    min-width: 280px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .value {
    font-size: 3.25rem;
    font-weight: 600;
    margin: 0 0 1.25rem;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }
  button {
    border: none;
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.18);
    color: inherit;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
    backdrop-filter: blur(8px);
  }
  button:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.28);
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
