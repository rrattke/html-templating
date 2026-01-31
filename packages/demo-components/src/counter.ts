import { Styleable, Reactive, state } from '@vanishing/framework/wc';
import { html } from '@vanishing/framework/template';
import styles from './counter.css?inline';

export class Counter extends Styleable(Reactive(HTMLElement)) {
  static styles = styles;
  
  @state accessor count = 0;

  template() {
    return html`
      <header>Counter</header>
      <p class="value">${() => this.count}</p>
      <div class="actions">
        <button type="button" @click=${() => this.count--}>-1</button>
        <button type="button" @click=${() => this.count++}>+1</button>
        <button type="button" @click=${() => this.count = 0}>Reset</button>
      </div>
    `;
  }
}

customElements.define('demo-counter', Counter);
