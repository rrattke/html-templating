# Technical Architecture Specification: Component & Template Rendering Strategies

This specification outlines five distinct rendering strategies for modern web applications that avoid heavy frameworks. It details
the precise mechanics, DOM behaviors, technical trade-offs, and implementation examples for each approach.

---

## Scenario A: The Encapsulated Component (The "Widget")

Designed for maximum isolation, this approach utilizes the full Web Component standard to protect UI primitives from external
interference.

- **Primary Use Case:** Complex, reusable UI primitives (Data Grids, Video Players, Interactive Modals).
- **Core Technology:** `customElements.define` + `this.attachShadow({ mode: 'open' })`.
- **DOM Footprint:** Leaves a persistent custom wrapper tag containing a `#shadow-root`.
- **Event Boundary:** **Closed.** Events fired inside the Shadow DOM are retargeted to the host element. Custom events must be
  explicitly dispatched with `{ bubbles: true, composed: true }` to pierce the boundary.
- **Styling Boundary:** **Strictly Closed.** Immune to global CSS. External styling requires explicitly exposed CSS Custom
  Properties or the `::part()` pseudo-element.

### Advantages vs. Disadvantages

- **Pros:** Total encapsulation; strict API boundary; self-contained state management.
- **Cons:** Overkill for simple layouts; creates layout friction if global grid/flexbox styles need to pierce the component; higher
  memory footprint and lifecycle boilerplate.

### Implementation Example

```javascript
import { html, render } from "lit-html";

class SecureToggle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Establishes the boundary
  }

  connectedCallback() {
    this._update();
  }

  _toggle() {
    this.dispatchEvent(new CustomEvent("toggled", { bubbles: true, composed: true }));
  }

  _update() {
    render(
      html`
      <style> button { background: gray; } </style>
      <button @click=${this._toggle}>Toggle</button>
    `,
      this.shadowRoot,
    );
  }
}
customElements.define("secure-toggle", SecureToggle);
```

---

## Scenario B: The Parameterized Template (The "Macro")

Treats DOM rendering as a pure function (`UI = f(state)`), ideal for declarative data mapping without lifecycle overhead.

- **Primary Use Case:** Application layout, repetitive views, replacing sections of the page, and rendering list items.
- **Core Technology:** Pure JavaScript functions returning templates (e.g., Tagged Template Literals via `lit-html`).
- **DOM Footprint:** **None.** Injects standard HTML elements directly into a target container without a custom wrapper.
- **Event Boundary:** **Open.** Native event bubbling through the standard DOM tree.
- **Styling Boundary:** **Open.** Fully inherits global CSS, utility classes, and responds natively to parent layout rules.

### Advantages vs. Disadvantages

- **Pros:** Zero registry overhead; perfect integration with global CSS/grids; fast diffing engine updates only changed nodes.
- **Cons:** Requires a dedicated JavaScript execution context to mount; lacks a semantic HTML tag identifying the container in the
  raw markup.

### Implementation Example

```javascript
import { html, render } from "lit-html";

// Pure function template
const UserProfile = (user, onSave) =>
  html`
  <div class="user-profile-card">
    <h2>${user.name}</h2>
    <button @click=${() => onSave(user.id)}>Save</button>
  </div>
`;

// Render directly into an existing DOM node
render(
  UserProfile({ id: 1, name: "Alice" }, (id) => console.log("Saving", id)),
  document.getElementById("main-content"),
);
```

---

## Scenario B2: Inline Document Rendering (The Hydration Target)

Bridges the gap between server-authored HTML and client-side Scenario B templates, allowing the DOM itself to trigger rendering.

- **Primary Use Case:** Server-rendered pages (MPAs) needing declarative, client-side hydration without a JavaScript router.
- **Core Technology:** Generic Mount-Point Custom Element (`<render-template>`) OR a global Data-Attribute Scanner.
- **DOM Footprint:** Leaves a generic wrapper tag or uses existing `data-*` annotated standard elements.
- **Event & Styling Boundaries:** **Open.** Behaves identically to Scenario B once mounted.

### Advantages vs. Disadvantages

- **Pros:** Keeps data and layout logic visually co-located in the HTML; leverages the native HTML parser for initialization.
- **Cons:** Generic tags obscure document semantics; parsing large JSON payloads from attributes on load can impact performance.

### Implementation Example (Mount-Point Approach)

```html
<render-template template="UserProfile" data-state='{"name": "Alice"}'></render-template>
```

```javascript
// Generic registry logic
class RenderTemplate extends HTMLElement {
  connectedCallback() {
    const templateName = this.getAttribute("template");
    const state = JSON.parse(this.dataset.state || "{}");

    // Assumes templates are stored in a global registry or imported map
    const templateFn = TemplateRegistry[templateName];
    render(templateFn(state), this); // Renders into Light DOM
  }
}
customElements.define("render-template", RenderTemplate);
```

---

## Scenario B3: The Semantic Light Component

A hybrid approach utilizing Custom Elements for document semantics and lifecycle, but abandoning the Shadow DOM to preserve styling
flexibility.

- **Primary Use Case:** Semantic, distinct business entities (e.g., `<user-profile>`, `<shopping-cart>`).
- **Core Technology:** `customElements.define` *without* calling `attachShadow`.
- **DOM Footprint:** Leaves a specific custom wrapper tag, but renders children into the Light DOM.
- **Event & Styling Boundaries:** **Open.** Events bubble natively. Styling inherits globally, though the wrapper tag itself must
  often be styled with `display: contents` to prevent layout disruption.

### Advantages vs. Disadvantages

- **Pros:** Pristine, semantic HTML; easy to query natively (`getElementsByTagName`); utilizes the native browser lifecycle.
- **Cons:** Incurs the "registry tax" (defining a class for every template type); passing complex data via HTML attributes requires
  string serialization and manual type coercion.

### Implementation Example

```html
<user-card name="Alice" role="Admin"></user-card>
```

```javascript
import { html, render } from "lit-html";

class UserCardElement extends HTMLElement {
  connectedCallback() {
    // Manual attribute parsing and type coercion
    const params = {
      name: this.getAttribute("name") || "Unknown",
      role: this.getAttribute("role") || "User",
    };

    // Render standard markup into this element's Light DOM
    render(html`<article class="card"><h2>${params.name}</h2></article>`, this);
  }
}
customElements.define("user-card", UserCardElement);
```

---

## Scenario C: The State-Reflective Generator (Two-Way DOM)

An architecture designed for visual editors or systems that must infer state parameters *back* from the DOM.

- **Primary Use Case:** WYSIWYG builders, drag-and-drop constructors, or round-trip editing of handcrafted code.
- **Core Technology:** Data-Attribute Serialization (`data-params`) OR strict DOM Scraping Schemas.
- **DOM Footprint:** The DOM acts as a persistent storage layer for template parameters.
- **Event & Styling Boundaries:** **N/A.** Acts as a data-extraction layer reading the DOM.

### Advantages vs. Disadvantages

- **Pros:** Enables true two-way editing (Code -> UI, UI -> Code); allows reverse-engineering of template parameters natively.
- **Cons:** Serialization inflates HTML payload size; DOM scraping schemas are brittle and break if the markup is manually altered;
  requires strict XSS sanitization if reflecting user input.

### Implementation Example (Serialization Approach)

```html
<div class="user-profile-card" data-editor-params='{"id": 1, "name": "Alice"}'>
  <h2>Alice</h2>
</div>
```

```javascript
// Extraction logic for the editor
function inferParameters(domNode) {
  const rawParams = domNode.getAttribute("data-editor-params");
  return rawParams ? JSON.parse(rawParams) : null;
}

const node = document.querySelector(".user-profile-card");
const state = inferParameters(node); // Yields: { id: 1, name: "Alice" }
```
