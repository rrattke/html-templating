## Roadmap: Refined Architecture & Pluggable Binding Strategy

This document outlines the implementation steps to introduce value-based dirty checking, a pluggable binding interface, and a
transition path to `lit-html`.

---

### 1. Value-Based Dirty Checking

To minimize DOM thrashing, we introduce a cache for previous values within the `TemplateInstance`. This ensures that "Dumb Parts"
only execute when data actually changes.

```typescript
// Add to TemplateInstance in render.ts
export class TemplateInstance {
  #previousValues: unknown[] = [];

  update(newValues: unknown[]): void {
    this.parts.forEach((part, index) => {
      const newValue = newValues[index];
      const oldValue = this.#previousValues[index];

      // Dirty check: Only update the DOM if the value has changed
      if (newValue !== oldValue) {
        part.setValue(newValue);
        this.#previousValues[index] = newValue;
      }
    });
  }
}
```

---

### 2. Pluggable Binding Interface

To generalize behavior, we decouple the `NodePart` from the specific logic of `StaticBinding` or `DynamicBinding`. By treating
bindings as a "Strategy," you can swap rendering behaviors (e.g., portals, lists, or static content) without modifying the core
`NodePart`.

#### The Interface Definition

```typescript
/**
 * Strategy for how a value is committed to a NodePart.
 * This allows the library to handle different types of content (Static, Dynamic, List)
 * through a unified lifecycle.
 */
export interface BindingStrategy {
  /** Initial setup or mounting logic */
  mount(part: NodePart): void;
  /** Update logic called when signals or values change */
  update(part: NodePart): void;
  /** Cleanup logic for effects and listeners */
  dispose(): void;
}
```

#### The Unified Binding Class

```typescript
export class TemplateBinding implements BindingStrategy {
  #template: Template;
  #values: unknown[];
  #instance: TemplateInstance | null = null;
  #runtime?: SignalsRuntime;

  constructor(template: Template, values: unknown[], runtime?: SignalsRuntime) {
    this.#template = template;
    this.#values = values;
    this.#runtime = runtime;
  }

  mount(part: NodePart) {
    this.#instance = TemplateInstance.create(
      this.#runtime!,
      this.#template,
      this.#values,
    );
    part.setValue(this.#instance.fragment);
  }

  update(part: NodePart) {
    if (this.#instance) {
      this.#instance.update(this.#values);
    }
  }

  dispose() {
    this.#instance?.dispose();
  }
}
```

---

### 3. Transitioning to lit-html

If the complexity of custom list reconciliation (the "List Hell") outweighs the benefits of a bespoke engine, you can swap the Layer
3 logic for `lit-html`.

#### Core Characteristics

- **Synchronous Updates:** Standalone `lit-html` updates the DOM synchronously during the `render()` call.
- **Stability:** It uses the same canonical `strings` array check to ensure DOM structures are reused.
- **Simplified Lists:** The `repeat` directive handles reordering and item identity via keys, removing the need for custom LIS
  algorithms.

#### Integration Example

```typescript
import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";

// Triggered by your existing SignalsRuntime
effect(() => {
  // Lit's render is synchronous: DOM is updated before this function returns
  render(
    html`
      <ul>
        ${repeat(mySignal.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}
      </ul>
    `,
    container,
  );
});
```

---

### Next Step

Would you like me to help you implement the **`createPrimitiveInstance`** helper mentioned in the `collectInstances` logic to ensure
your new pluggable interface handles strings and numbers as elegantly as templates?
