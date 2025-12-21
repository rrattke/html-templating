import { reactive } from 'https://esm.run/arrow-js';

// 1. The Attribute Decorator (with Type Support)
export function attribute(type = String) {
  return function(target, key) {
    const constructor = target.constructor;
    if (!constructor.observedAttributes) {
      constructor.observedAttributes = [];
    }
    constructor.observedAttributes.push(key);
    if (!constructor._attributeTypes) {
      constructor._attributeTypes = new Map();
    }
    constructor._attributeTypes.set(key, type);
  };
}

// 2. The Reactive Property Decorator
export function reactiveProp(target, key) {
  Object.defineProperty(target, key, {
    get() { return this._state[key]; },
    set(val) { this._state[key] = val; },
    configurable: true,
    enumerable: true
  });
}

// 3. The Base Class
export class ArrowElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = reactive({});
  }

  attributeChangedCallback(name, oldVal, newVal) {
    const type = this.constructor._attributeTypes?.get(name) || String;
    if (type === Boolean) {
      this[name] = newVal !== null && newVal !== 'false';
    } else if (type === Number) {
      this[name] = Number(newVal);
    } else if (type === Object || type === Array) {
        try {
            this[name] = JSON.parse(newVal);
        } catch (e) {
            console.warn(`Failed to parse attribute ${name} as JSON`, e);
        }
    } else {
      this[name] = newVal;
    }
    this.render?.(); // Trigger a render if it exists
  }
}
