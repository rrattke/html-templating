# Declarative Data Sources + Templated Lists

Two separate (but compatible) scenarios:

1. **Templating scenario**: render a list from an array (no “list Web Component”).
2. **Document scenario**: a plotter whose signals are edited, then *persisted as HTML* (DOM is the source of truth).

The unifying idea: HTML/DOM is the descriptive output, while rendering + wiring happen at lifecycle boundaries.

Quick decision rule:

- If the thing is **app composition** (lists, conditionals, orchestration): prefer **templates/functions**.
- If the thing is a **reusable widget** (plotter, grid, date picker): prefer a **Web Component**.

---

## Scenario 1: Templating a List from an Array (No List Component)

### Mental model

- Your application state is an array.
- A **template/render step** turns that array into DOM.
- Keys preserve identity across reorders.

In other words: *lists are a rendering concern*, not inherently a Web Component concern.

### What “keys” buy you

Keys are about *DOM identity*.

- Reordering keeps the same underlying elements/instances.
- Focus, selection, input cursor, and element-local state are less likely to reset.
- The reconciler can move the minimum number of nodes.

### Solution options

1. **Preferred (app composition)**: loop in the parent template and use keyed items.
2. **Widget approach**: a reusable `<x-list>` that accepts `.items` (property) and renders internally.
3. **"Repeat" element**: `<x-repeat>` that clones a child `<template>` per item (requires a binding language).

### When to pick which option

- Pick **(1) parent template** when the list is app-specific and the markup is simple.
- Pick **(2) widget** when the list is a reusable control with behavior (virtualization, selection model, keyboard nav).
- Pick **(3) repeat element** when you truly want authoring to be “HTML first” (but accept a mini-binding syntax).

### Example: keyed list in a parent template

```ts
import { html } from '../src/template/runtime.js';

type Todo = { id: string; title: string };

export const view = (items: readonly Todo[]) => html`
  <ul>
    ${() => items.map(item =>
      html(item.id)`<li>${item.title}</li>`
    )}
  </ul>
`;
```

### Example: “more declarative” list rendering with a directive

If you prefer keeping control-flow out of the template body, use a list directive.

Note: this `repeat()` helper is an optional convenience API. The current prototype lives on the `repeat-directive` branch (not on `main`). If it is not available in your build, the inline mapping example above is the baseline that works everywhere.

```ts
// Pseudocode (see branch: repeat-directive)
import { html, repeat } from '@vanishing/framework/template';

export const view = (items: readonly Todo[]) => html`
  <ul>
    ${repeat(
      () => items,
      item => item.id,
      item => html`<li>${item.title}</li>`,
    )}
  </ul>
`;
```

Why keys matter: reordering `[A,B,C] → [C,A,B]` can keep DOM identity for A/B/C instead of destroying and recreating nodes.

### Practical pitfalls

- Don’t use array indices as keys unless the list is truly append-only.
- If you see “weird reuse”, it’s often unstable keys (e.g. random IDs per render).
- Prefer one keyed root per item. Avoid emitting multiple keyed bindings for the same logical item.

---

## Scenario 2: Plotter with Fixed Elements (Visual HTML Editor)

### Mental model

- During editing, the user adds/removes/configures signals.
- When “done”, the final output is **literal HTML** (the DOM describes the chart).
- The plotter reads its child elements and wires subscriptions.

This is the classic “old-school editor” model: the document is the model.

### What’s different from Scenario 1

In Scenario 1, the array is the source of truth.

In Scenario 2, the **DOM is the source of truth**:

- Adding/removing signals means adding/removing child elements.
- Editing a signal means updating attributes / embedded JSON.
- Persisting means saving the HTML (not a JS array).

### The basic shape (signals as declarative sources)

```html
<x-plot>
  <x-signal src="/api/metrics/cpu" color="#e11d48"></x-signal>
  <x-signal src="/api/metrics/mem" color="#0ea5e9"></x-signal>
</x-plot>
```

### How `<x-plot>` discovers changes

1. **Light DOM children**: use `MutationObserver` to watch additions/removals/attribute changes.
2. **Shadow DOM**: put signals in a named slot and handle `slotchange`.

Either way, the data flow is: DOM changes → re-scan signals → subscribe/unsubscribe → repaint.

Implementation tips:

- Observe *attribute changes* on `<x-signal>` (e.g. `src`, `color`) so updates rewire without rebuild.
- Keep a map from “signal element identity” → “unsubscribe/cleanup function” for deterministic teardown.

### Data transport (keep it descriptive)

- **Attributes**: references + small options (`src`, `color`, `axis`, `units`).
- **Properties** (optional escape hatch): advanced sources (`.provider=${...}`).
- **Events**: interactions and status (`range-change`, `signal-error`, etc.).

Guidelines:

- Prefer `src`-style references over embedding big payloads.
- If you need a “custom source”, use a property (`.provider`) so it stays typed and doesn’t require serialization.
- Use events for anything that should cross the component boundary without coupling (errors, user interaction).

### Example: storing larger configuration without giant attributes

```html
<x-signal src="/api/metrics/cpu">
  <script type="application/json">
    { "color": "#e11d48", "yAxis": "left", "unit": "%" }
  </script>
</x-signal>
```

This stays editor-friendly and keeps the document self-contained.

### Wiring options (how plot and signal talk)

You typically choose one of these contracts:

1. **Pull**: `<x-plot>` scans children and reads properties / calls methods on them.
   - Good when the plot owns orchestration.
2. **Register**: each `<x-signal>` registers itself (event-based) and provides a subscription handle.
   - Good when signals are “active” sources and the plot is a consumer.

Event-based registration sketch:

```ts
// x-signal: on connect
this.dispatchEvent(new CustomEvent('signal-register', {
  bubbles: true,
  composed: true,
  detail: {
    element: this,
    subscribe: (onSample: (v: unknown) => void) => {
      // return unsubscribe
      return () => {};
    },
  }
}));
```

`<x-plot>` listens for `signal-register` and stores the returned cleanup function.

---

## Bridge: Using Templates During Editing, Saving HTML at the End

It’s normal for an editor to keep `signals[]` as internal state while the user edits, then *publish* the result as DOM:

```ts
type SignalConfig = { id: string; src: string; color?: string };

export const editorPreview = (signals: readonly SignalConfig[]) => html`
  <x-plot>
    ${() => signals.map(s =>
      html(s.id)`<x-signal src=${s.src} color=${s.color ?? '#64748b'}></x-signal>`
    )}
  </x-plot>
`;
```

After the user is done, you can persist the resulting HTML (outerHTML) as the “chart document”.

Two useful workflows:

- **Editor state → DOM**: render the preview from `signals[]` while editing.
- **DOM → editor state**: when loading an existing document, parse `<x-signal>` elements back into `signals[]`.

