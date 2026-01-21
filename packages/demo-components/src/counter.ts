import { ReactiveElement } from '@vanishing/framework/wc';
import { html } from '@vanishing/framework/template';
import { state } from '@vanishing/framework/wc';

const counterStyles = `
  :host {
    display: block;
    padding: 1.75rem;
    border-radius: 1.5rem;
    background: linear-gradient(135deg, #ffffff, #f6f7fb);
    color: #0f172a;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
    min-width: 280px;
    border: 1px solid rgba(99, 102, 241, 0.15);
  }
  header {
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-size: 0.8rem;
    color: #6366f1;
    margin-bottom: 0.75rem;
  }
  .value {
    font-size: 3rem;
    font-weight: 600;
    margin: 0 0 1.25rem;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  button {
    flex: 1;
    border: none;
    border-radius: 0.85rem;
    padding: 0.65rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.12);
    color: #0f172a;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button:hover {
    transform: translateY(-1px);
    background: rgba(99, 102, 241, 0.2);
  }
`;

export class Counter extends ReactiveElement {
  @state
  accessor count = 0;

  template() {
    return html`
      <style>${counterStyles}</style>
      <header>Counter</header>
      <p class="value">${() => this.count}</p>
      <div class="actions">
        <button type="button" onclick=${() => this.count--}>-1</button>
        <button type="button" onclick=${() => this.count++}>+1</button>
        <button type="button" onclick=${() => this.count = 0}>Reset</button>
      </div>
    `;
  }
}

customElements.define('demo-counter', Counter);
