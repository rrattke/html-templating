# Templates vs Documents (Two Scenarios)

This repo uses two distinct (but compatible) approaches depending on what you are building:

- **Scenario A — Templated Lists (state → DOM)**: You have an array/object model and render it into the DOM.
- **Scenario B — Visual HTML Editor (DOM as document)**: You author a document as DOM/HTML, persist it, and later parse it back into an editor model.

The unifying idea: HTML/DOM is the descriptive output, while rendering + wiring happen at lifecycle boundaries.

Quick decision rule:

- If the thing is **app composition** (lists, conditionals, orchestration): prefer **templates/functions**.
- If the thing is a **reusable widget** (plotter, grid, date picker): prefer a **Web Component**.

---

## Scenario A: Templated Lists

Use this when your UI is driven by application state.

- Mental model: state changes → render step → DOM updates (with keyed reconciliation for stable identity).
- Doc: [declarative-list-rendering.md](declarative-list-rendering.md)

---

## Scenario B: Visual HTML Editor (Roundtrip)

Use this when the *saved artifact* is HTML.

- Mental model: editor model → generate DOM/HTML → persist → parse DOM/HTML → editor model.
- Doc: [visual-html-editor-roundtrip.md](visual-html-editor-roundtrip.md)

