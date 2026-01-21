import { ReactiveElement } from '@vanishing/framework';
import { html, state } from '../runtime/solid-runtime.js';

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
  li .controls {
    display: flex;
    gap: 0.4rem;
  }
  li button {
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
  }
  li button.remove {
    background: rgba(239, 68, 68, 0.15);
    color: #be123c;
  }
  li button.remove:hover {
    background: rgba(239, 68, 68, 0.28);
  }
  li button.move {
    background: rgba(14, 165, 233, 0.12);
    color: #0369a1;
  }
  li button.move:hover {
    background: rgba(14, 165, 233, 0.22);
  }
  li button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  li button:disabled:hover {
    transform: none;
  }
`;

export class SolidSignalsList extends ReactiveElement {
  @state
  accessor items = [
    { id: 1, label: 'Adapter spike' },
    { id: 2, label: 'Solid runtime' },
    { id: 3, label: 'Docs refresh' }
  ];
  
  #nextId = 4;

  #addItem(): void {
    this.items = [...this.items, { id: this.#nextId++, label: `Task #${this.items.length + 1}` }];
  }

  #removeItem(id: number): void {
    this.items = this.items.filter(item => item.id !== id);
  }

  #moveUp(id: number): void {
    const index = this.items.findIndex(item => item.id === id);
    if (index > 0) {
      const newItems = [...this.items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      this.items = newItems;
    }
  }

  #moveDown(id: number): void {
    const index = this.items.findIndex(item => item.id === id);
    if (index >= 0 && index < this.items.length - 1) {
      const newItems = [...this.items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      this.items = newItems;
    }
  }

  template() {
    return html`
      <style>${listStyles}</style>
      <header>
        <strong>Solid Task List</strong>
        <span>${() => this.items.length} active</span>
      </header>
        <div class="actions">
        <button type="button" onclick=${() => this.#addItem()}>Add Task</button>
      </div>
        <ul>
          ${() => this.items.map((item, index) => html(item.id)`
            <li>
              <span>${item.label}</span>
              <div class="controls">
                <button type="button" class="move" onclick=${() => this.#moveUp(item.id)} ?disabled=${index === 0}>↑</button>
                <button type="button" class="move" onclick=${() => this.#moveDown(item.id)} ?disabled=${index === this.items.length - 1}>↓</button>
                <button type="button" class="remove" onclick=${() => this.#removeItem(item.id)}>Remove</button>
              </div>
            </li>
          `)}
        </ul>
    `;
  }
}

customElements.define('solid-signals-list', SolidSignalsList);
