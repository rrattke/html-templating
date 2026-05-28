# Visual HTML Editor Roundtrip (DOM ↔ Model)

This document expands Scenario B from [../templates-vs-documents.md](../templates-vs-documents.md): a workflow where users *author*
a plot/chart visually and the persisted output is **HTML**.

The core challenge is the **roundtrip**:

- generate HTML from an editor model
- later parse that HTML back into the editor model

---

## Mental model

Think of this like "source code" ↔ "AST":

- **Editor model** (typed JS object): best for forms, validation, undo/redo, selections
- **Document HTML**: best for persistence, copy/paste, sharing, and visual editing

Your system needs two transforms:

- `renderDocument(model) → HTMLElement`
- `parseDocument(element) → model`

Even if "DOM is the source of truth" after the user is done, the editor typically still keeps a model for ergonomics.

---

## Choose a canonical document format (your DSL)

Pick one HTML shape and treat it as canonical.

Recommended minimum:

- root marker attributes (`data-doc`, `data-version`)
- stable IDs for child elements (`data-id`)
- use attributes for small config (`src`, `color`, `axis`, ...)

Example:

```html
<x-plot data-doc="vanishing-plot" data-version="1">
  <x-signal data-id="cpu" src="/api/metrics/cpu" color="#e11d48"></x-signal>
  <x-signal data-id="mem" src="/api/metrics/mem" color="#0ea5e9"></x-signal>
</x-plot>
```

---

## Large configuration: embed JSON (avoid giant attributes)

If configuration gets bigger than a handful of attributes, embed JSON as a child node.

```html
<x-signal data-id="cpu" src="/api/metrics/cpu">
  <script type="application/json" data-config>
    { "color": "#e11d48", "yAxis": "left", "unit": "%" }
  </script>
</x-signal>
```

This keeps the document self-contained and editor-friendly.

---

## Parsing: document HTML → editor model

A robust parser:

1. Locate the root element (and validate `data-doc`/`data-version`).
2. Read known attributes.
3. Iterate over direct child `<x-signal>` elements.
4. Parse embedded JSON blocks (if present).
5. Normalize defaults.
6. Preserve or reject unknown markup (see below).

Sketch:

```ts
type PlotDocV1 = {
  version: 1;
  signals: Array<{
    id: string;
    src: string;
    color?: string;
    config?: Record<string, unknown>;
  }>;
};

export function parsePlotDoc(root: ParentNode): PlotDocV1 {
  const plot = root.querySelector("x-plot[data-doc=\"vanishing-plot\"]");
  if (!plot) { throw new Error("No plot document root found"); }

  const version = Number(plot.getAttribute("data-version") ?? "1");
  if (version !== 1) { throw new Error(`Unsupported version: ${version}`); }

  const signals = Array.from(plot.querySelectorAll(":scope > x-signal")).map((el) => {
    const id = el.getAttribute("data-id");
    const src = el.getAttribute("src");
    if (!id || !src) { throw new Error("Signal missing data-id or src"); }

    const cfg = el.querySelector("script[type=\"application/json\"][data-config]");
    const config = cfg?.textContent?.trim() ? JSON.parse(cfg.textContent) : undefined;

    return {
      id,
      src,
      color: el.getAttribute("color") ?? undefined,
      config,
    };
  });

  return { version: 1, signals };
}
```

---

## Generation: editor model → document HTML

The inverse transform creates the canonical DOM.

Sketch:

```ts
export function renderPlotDoc(model: PlotDocV1, doc = document): HTMLElement {
  const plot = doc.createElement("x-plot");
  plot.setAttribute("data-doc", "vanishing-plot");
  plot.setAttribute("data-version", String(model.version));

  for (const s of model.signals) {
    const el = doc.createElement("x-signal");
    el.setAttribute("data-id", s.id);
    el.setAttribute("src", s.src);
    if (s.color) { el.setAttribute("color", s.color); }

    if (s.config) {
      const script = doc.createElement("script");
      script.type = "application/json";
      script.setAttribute("data-config", "");
      script.textContent = JSON.stringify(s.config);
      el.appendChild(script);
    }

    plot.appendChild(el);
  }

  return plot;
}
```

---

## Preserving unknown markup (important for editors)

When users paste HTML or hand-edit documents, you have to decide what to do with unknown nodes/attributes.

### Strategy 1: Strict DSL

- Everything inside `<x-plot>` must be known.
- Unknown nodes are removed or cause validation errors.

Pros: simplest.

Cons: copy/paste and forward-compatibility are worse.

### Strategy 2: Preserve unknown nodes

- Parser collects unknown nodes/attrs into an `extras` bucket.
- Renderer re-emits them.

Pros: better resilience.

Cons: more work and more edge cases.

### Strategy 3: DOM-first editing

- While editing, update the DOM directly (attributes, ordering, insertion).
- Only parse on import/load or when the editor needs a full model rebuild.

Pros: feels most natural in WYSIWYG tools.

Cons: you still need parsing for load/migrate.

---

## Versioning and migration

Always store a version and expect it to change.

- `data-version="1"` on the root
- `parsePlotDoc()` switches by version
- either migrate DOM first or migrate the model after parsing

---

## Relationship to runtime wiring

The roundtrip format is separate from how `<x-plot>` wires data sources at runtime.

During runtime, `<x-plot>` can:

- watch children (MutationObserver / slotchange)
- subscribe/unsubscribe based on `<x-signal>` configuration
- render without the editor present

The editor roundtrip just guarantees: **document HTML contains all needed configuration**.
