# Templates vs Documents

This repo uses two distinct (but compatible) approaches depending on what you are building:

- **Scenario A — Templated Lists (state → DOM)**: you have an array/object model and render it into the DOM.
- **Scenario B — Visual HTML Editor (DOM as document)**: you author a document as DOM/HTML, persist it, and later parse it back into
  an editor model.

The unifying idea: HTML/DOM is the descriptive output, while rendering + wiring happen at lifecycle boundaries.

Quick decision rule:

- If the thing is **app composition** (lists, conditionals, orchestration): prefer **templates/functions**.
- If the thing is a **reusable widget** (plotter, grid, date picker): prefer a **Web Component**.

---

## Scenario A: Templated Lists

- Mental model: state changes → render step → DOM updates (with keyed reconciliation for stable identity).
- Doc: [templates-vs-documents/declarative-list-rendering.md](templates-vs-documents/declarative-list-rendering.md)

---

## Scenario B: Visual HTML Editor (Roundtrip)

- Mental model: editor model → generate DOM/HTML → persist → parse DOM/HTML → editor model.
- Doc: [templates-vs-documents/visual-html-editor-roundtrip.md](templates-vs-documents/visual-html-editor-roundtrip.md)
