# Declarative List Rendering

This document expands Scenario 1 from [declarative-data-sources-and-templated-lists.md](declarative-data-sources-and-templated-lists.md): how to render lists from arrays *without* introducing a dedicated Web Component.

The goal is to keep templates "HTML-shaped" while still supporting:

- keyed reconciliation (stable DOM identity)
- minimal DOM mutations
- readable authoring

---

## Mental model

- The DOM is the declarative end result.
- A render step is inevitable for "array → DOM".
- You can choose *where* control-flow lives:
  - inline (`items.map(...)`)
  - in small directives (`repeat(...)`, `when(...)`)
  - in components/widgets (less common for app-specific lists)

---

## Option A: Inline mapping (simple, explicit)

```ts
import { html } from '@vanishing/framework/template';

export const view = (items: readonly { id: string; label: string }[]) => html`
  <ul>
    ${() => items.map(item => html(item.id)`<li>${item.label}</li>`)}
  </ul>
`;
```

Pros: no extra APIs.

Cons: templates contain JS control-flow.

---

## Option B: A directive (`repeat`) (HTML-shaped templates)

Use a small helper so the template reads more like HTML.

Note: `repeat()` is an optional convenience API. It is part of the project vision and the current prototype lives on the `repeat-directive` branch (not on `main`).

```ts
// Pseudocode (see branch: repeat-directive)
import { html, repeat } from '@vanishing/framework/template';

export const view = (items: readonly { id: string; label: string }[]) => html`
  <ul>
    ${repeat(
      () => items,
      item => item.id,
      item => html`<li>${item.label}</li>`,
    )}
  </ul>
`;
```

What this buys you:

- the template body stays mostly markup
- keying becomes hard to forget
- you can standardize behavior (e.g., filtering, separators) in one place

---

## Choosing keys

Keys must be:

- stable across renders
- unique among siblings

Good keys:

- database ID
- stable string identifier

Bad keys:

- array index (breaks on inserts/reorders)
- random values (`Math.random()`)

---

## Rendering to light DOM (no Web Component)

In this framework, a `DynamicBinding` can be instantiated and appended directly.

Conceptually:

```ts
const binding = html`<main>...</main>`;
const instance = binding.instance();
root.appendChild(instance.fragment);
```

(How you choose to manage disposal / re-rendering depends on your app shell.)

---

## HTML-authored alternative

If you want templates that look like documents/fragments (Aurelia-style), see:

- [html-authored-templates.md](html-authored-templates.md)
