import { Reactive, state, Styleable } from "@vanishing/framework/wc";
import { html } from "@vanishing/framework/template";
import styles from "./list.css?inline";

export class List extends Styleable(Reactive(HTMLElement)) {
  static styles = styles;

  @state
  accessor items = [
    { id: 1, label: "First Item" },
    { id: 2, label: "Second Item" },
    { id: 3, label: "Third Item" },
  ];

  #nextId = 4;

  #addItem(): void {
    this.items = [...this.items, { id: this.#nextId++, label: `Item #${this.items.length + 1}` }];
  }

  #removeItem(id: number): void {
    this.items = this.items.filter((item) => item.id !== id);
  }

  #moveUp(id: number): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index > 0) {
      const newItems = [...this.items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      this.items = newItems;
    }
  }

  #moveDown(id: number): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0 && index < this.items.length - 1) {
      const newItems = [...this.items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      this.items = newItems;
    }
  }

  #isFirst(id: number): boolean {
    return this.items[0]?.id === id;
  }

  #isLast(id: number): boolean {
    return this.items[this.items.length - 1]?.id === id;
  }

  template() {
    return html`
      <header>
        <strong>List Component</strong>
        <span>${() => this.items.length} items</span>
      </header>
      <div class="action-bar">
        <button type="button" @click=${() => this.#addItem()}>Add Item</button>
      </div>
      <ul>
        ${() =>
      this.items.map((item, index) =>
        html(item.id)`
          <li>
            <span>${item.label}</span>
            <div class="controls">
              <button type="button" class="move" @click=${() => this.#moveUp(item.id)} ?disabled=${() =>
          this.#isFirst(item.id)}>↑</button>
              <button type="button" class="move" @click=${() => this.#moveDown(item.id)} ?disabled=${() =>
          this.#isLast(item.id)}>↓</button>
              <button type="button" class="remove" @click=${() => this.#removeItem(item.id)}>Remove</button>
            </div>
          </li>
        `
      )}
      </ul>
    `;
  }
}

customElements.define("demo-list", List);
