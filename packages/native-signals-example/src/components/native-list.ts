import { createSignal, html, ReactiveElement, repeat } from '@vanishing/framework';

const listStyles = `
  :host {
    display: block;
    padding: 1.5rem;
    border-radius: 1.25rem;
    background: #fff;
    color: #0f172a;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.09);
    min-width: 320px;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 1.125rem;
    margin-bottom: 1rem;
  }
  header span {
    background: rgba(99, 102, 241, 0.14);
    border-radius: 999px;
    padding: 0.2rem 0.85rem;
    font-size: 0.85rem;
    color: #4c1d95;
  }
  .action-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  button {
    border: none;
    border-radius: 0.85rem;
    padding: 0.55rem 0.9rem;
    background: rgba(99, 102, 241, 0.15);
    color: #111827;
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button:hover {
    transform: translateY(-1px);
    background: rgba(99, 102, 241, 0.28);
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
    border-radius: 0.9rem;
    background: rgba(249, 250, 251, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.4);
  }
  li span {
    font-weight: 500;
  }
  li button {
    background: rgba(244, 63, 94, 0.18);
    color: #be123c;
  }
  li button:hover {
    background: rgba(244, 63, 94, 0.28);
  }
`;

export class NativeList extends ReactiveElement {
  #itemsSignal = createSignal<string[]>(['Framework Goals', 'Runtime Swap', 'Docs Polish']);

  #addItem(): void {
    const [, setItems] = this.#itemsSignal;
    setItems(items => [...items, `Todo #${items.length + 1}`]);
  }

  #removeItem(label: string): void {
    const [, setItems] = this.#itemsSignal;
    setItems(items => items.filter(item => item !== label));
  }

  protected template() {
    const [items] = this.#itemsSignal;
    return html`
      <style>${listStyles}</style>
      <header>
        <strong>Native Todo List</strong>
        <span>${() => items().length} items</span>
      </header>
      <div class="action-bar">
        <button type="button" onclick=${() => this.#addItem()}>Add Item</button>
      </div>
      <ul>
        ${() => repeat(items(), label => label, label => html`
          <li>
            <span>${label}</span>
            <button type="button" onclick=${() => this.#removeItem(label)}>Remove</button>
          </li>
        `)}
      </ul>
    `;
  }
}

customElements.define('native-list', NativeList);
