import { html, ReactiveElement } from '@vanishing/framework';
import { createSignal } from 'solid-js';
import { solidRuntime } from '../runtime/solid-runtime.js';

const listStyles = `
  :host {
    display: block;
    padding: 1.5rem;
    border-radius: 1.25rem;
    background: #fff;
    color: #0f172a;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.18);
    min-width: 320px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 1.05rem;
    margin-bottom: 0.9rem;
  }
  header span {
    background: rgba(14, 165, 233, 0.15);
    border-radius: 999px;
    padding: 0.2rem 0.85rem;
    font-size: 0.85rem;
    color: #0369a1;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  button {
    border: none;
    border-radius: 0.85rem;
    padding: 0.55rem 0.85rem;
    background: rgba(14, 165, 233, 0.12);
    color: #0f172a;
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button:hover {
    transform: translateY(-1px);
    background: rgba(14, 165, 233, 0.22);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.85rem;
    border-radius: 0.95rem;
    background: rgba(240, 249, 255, 0.95);
    border: 1px solid rgba(14, 165, 233, 0.35);
  }
  li span {
    font-weight: 500;
  }
  li button {
    background: rgba(239, 68, 68, 0.15);
    color: #be123c;
  }
  li button:hover {
    background: rgba(239, 68, 68, 0.28);
  }
`;

export class SolidSignalsList extends ReactiveElement {
  #items!: () => string[];
  #setItems!: (value: string[] | ((prev: string[]) => string[])) => string[];

  constructor() {
    super();
    const [items, setItems] = createSignal<string[]>(['Adapter spike', 'Solid runtime', 'Docs refresh']);
    this.#items = items;
    this.#setItems = setItems;
  }

  protected override partRuntime() {
    return solidRuntime;
  }

  #addItem(): void {
    this.#setItems(list => [...list, `Task #${list.length + 1}`]);
  }

  #removeItem(index: number): void {
    this.#setItems(list => list.filter((_, i) => i !== index));
  }

  protected template() {
    return html`
      <style>${listStyles}</style>
      <header>
        <strong>Solid Task List</strong>
        <span>${() => this.#items().length} active</span>
      </header>
      <div class="actions">
        <button type="button" onclick=${() => this.#addItem()}>Add Task</button>
      </div>
      <ul>
        ${() => this.#items().map((label, index) => html`
          <li>
            <span>${label}</span>
            <button type="button" onclick=${() => this.#removeItem(index)}>Remove</button>
          </li>
        `)}
      </ul>
    `;
  }
}

customElements.define('solid-signals-list', SolidSignalsList);
