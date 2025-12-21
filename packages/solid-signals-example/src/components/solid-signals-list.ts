import { html, ReactiveElement } from '@vanishing/framework';
import { createSignal } from 'solid-js';
import { solidRuntime } from '../runtime/solid-runtime.js';

const listStyles = `
  :host {
    display: block;
    padding: 1.5rem;
    border-radius: 1.5rem;
    background: linear-gradient(135deg, #0f172a, #0f766e);
    color: #e0f2fe;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 18px 45px rgba(7, 89, 133, 0.45);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  header span {
    font-size: 0.9rem;
    padding: 0.2rem 0.9rem;
    border-radius: 999px;
    background: rgba(3, 105, 161, 0.35);
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  button {
    border: none;
    border-radius: 0.9rem;
    padding: 0.55rem 0.85rem;
    background: rgba(14, 165, 233, 0.25);
    color: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button:hover {
    transform: translateY(-1px);
    background: rgba(14, 165, 233, 0.4);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.85rem;
    border-radius: 0.95rem;
    background: rgba(8, 47, 73, 0.85);
    border: 1px solid rgba(14, 165, 233, 0.3);
  }
  li button {
    background: rgba(239, 68, 68, 0.25);
  }
  li button:hover {
    background: rgba(239, 68, 68, 0.4);
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

  #renderItems(items: string[]): DocumentFragment {
    const doc = this.ownerDocument ?? window.document;
    const fragment = doc.createDocumentFragment();
    items.forEach((label, index) => {
      const li = doc.createElement('li');
      const span = doc.createElement('span');
      span.textContent = label;
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = 'Remove';
      button.addEventListener('click', () => this.#removeItem(index));
      li.append(span, button);
      fragment.append(li);
    });
    return fragment;
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
      <ul>${() => this.#renderItems(this.#items())}</ul>
    `;
  }
}

customElements.define('solid-signals-list', SolidSignalsList);
