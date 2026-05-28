# Web Components: Mixins (`Reactive`, `Styleable`)

This document explains the preferred authoring style for Web Components in this repo: compose behavior via mixins rather than a deep
base-class hierarchy.

---

## Mental model

- `Reactive(Base)` adds **reactive template rendering** (renders a `DynamicBinding` into shadow DOM).
- `Styleable(Base)` adds **adoptable stylesheets** (base + user overrides via CSS layers).

You can compose them:

```ts
class MyEl extends Styleable(Reactive(HTMLElement)) {
  static styles = "button { color: red; }";
  template() {
    return html`<button>Click</button>`;
  }
}
```

---

## `Reactive(HTMLElement)`

- Calls `template()` on connect.
- Instantiates the returned `DynamicBinding` and replaces `shadowRoot` contents.
- Disposes reactive effects on disconnect.

Use it when you want a component to be driven by signals and automatically re-render.

---

## `Styleable(...)`

- Uses `adoptedStyleSheets`.
- Wraps CSS in layers to support customization:
  - `@layer base` for component-provided styles
  - `@layer custom` for user overrides

Customization options:

- `static customStyles` for global overrides
- `instance.customStyles` for per-instance overrides

---

## Why mixins

- Encourages small, composable behaviors.
- Avoids forcing every component into one base class.
- Makes it easy to opt into styling or reactivity independently.
