# ✅ Project Instruction Document: Minimal Reactive Web Component Framework

### Combining lit-style template parsing with Solid-style reactivity

## 1. Project Goal
Build a minimal, future-proof, "vanishing framework" that provides:

- HTML-first templating (lit-style template parsing + Part system)
- Fine-grained reactivity (SolidJS signals or @solid-js/store)
- Web Component integration (Shadow DOM, decorators)
- Zero diffing, zero re-rendering
- Direct DOM updates via Parts
- Clean migration path to native DOM Parts + TC39 Signals

The framework should be small, explicit, and standards-aligned.

---

## 2. Core Architecture

### 2.1 Template Layer (lit-like)
Implement a minimal template engine that:

1. Uses a tagged template literal `html` to:
   - Combine static strings with comment markers (e.g., `<!--_part_-->`)
   - Cache templates by `TemplateStringsArray`
2. Parses HTML once using `<template>`:
   - `template.innerHTML = htmlString`
   - Extract `template.content`
3. Walks the DOM to locate markers:
   - Comment nodes for text parts
   - Attribute markers (optional extension)
4. Produces a template record containing:
   - Parsed DOM fragment
   - List of dynamic hole descriptors
   - Functions to locate holes in clones
5. Provides an `instantiate(record)` function that:
   - Clones the fragment
   - Resolves hole positions
   - Creates Part objects (NodePart, AttributePart, PropertyPart)
6. Each Part object exposes:
   - `setValue(value)` → updates DOM directly

### 2.2 Reactive Layer (Solid-style)
Use SolidJS signals or a minimal clone:

- `createSignal(initial)`
- `createEffect(fn)`
- Dependency tracking at read-time
- Synchronous, fine-grained updates

Reactivity is responsible for **when** updates happen.
The template engine is responsible for **where** updates go.

### 2.3 Integration Layer
When instantiating a template:

- For each dynamic value:
  - If it’s a function → wrap in `createEffect(() => part.setValue(fn()))`
  - Else → set once

No diffing.
No template re-evaluation.
No virtual DOM.

### 2.4 Runtime Adapters (Current)
- The template layer depends on a `PartRuntime` interface with reactive primitives
- `TemplateBinding.with(runtime)` creates a runtime-specific template function factory
- `StateDecorator.with(runtime)` creates a runtime-specific state decorator
- No global state—each binding carries its own runtime
- Component authors import runtime-specific `html` and `state` from their runtime module
- Example: `import { html, state } from '../runtime/native-runtime.js';`

---

## 3. Excluded Functionality

### lit-html features to omit
- `render()` diffing system
- Directive system (`repeat`, `when`, `guard`, etc.)
- Nested template resolution
- Async/promise handling
- Iterable expansion
- Boolean attribute logic
- Property/attribute merging
- Hydration
- SSR
- Lifecycle management
- Disconnectable parts
- Template re-evaluation

### Framework features to omit
- Component lifecycle beyond Web Components
- State management abstractions
- Routing
- Global stores
- JSX
- Template expressions beyond simple values/functions

Goal: minimalism over feature parity.

---

## 4. Web Component Integration

### Base class: `ReactiveElement`
Responsibilities:

- `constructor()`:
  - Attach Shadow DOM
  - Initialize signals
  - Prepare template function
- `connectedCallback()`:
  - Instantiate template once
  - Mount fragment into shadow root
  - Bind reactive effects to Parts
- `disconnectedCallback()`:
  - Dispose effects (optional)

### Decorators (optional)
Provide decorators for:

- Reactive properties → backed by Solid signals
- Attribute reflection
- Event binding

Example:

```js
@state count = 0;
@attr title;
```

---

## 5. Suggested File Structure

```
src/
  reactive/
    signal.js
    effect.js
  template/
    html.js
    parser.js
    parts.js
    instantiate.js
  wc/
    ReactiveElement.js
    decorators.js
  examples/
    counter/
      CounterElement.js
      index.html
```

---

## 6. Minimal Example Usage

```js
import { html } from './template/html.js';
import { createSignal } from './reactive/signal.js';
import { instantiate } from './template/instantiate.js';

const [count, setCount] = createSignal(0);

const tpl = html`
  <button onclick=${() => setCount(count() + 1)}>
    Count: ${() => count()}
  </button>
`;

const { fragment, parts } = instantiate(tpl);
document.body.appendChild(fragment);
```

---

## 7. Implementation Priorities

### Phase 1 — Core
- `html` tagged template
- Template record caching
- Comment marker insertion
- DOM parsing
- Marker detection
- NodePart implementation
- Solid-style signals + effects
- Integration of signals → parts

### Phase 2 — Extensions
- AttributePart
- PropertyPart
- EventPart
- Decorators
- Web Component base class

### Phase 3 — Optional Enhancements
- Partial attribute parsing
- Keyed lists (manual, not diffing)
- SSR-friendly template records

---

## 8. Design Principles

- **HTML-first**: templates are HTML, not JSX
- **Fine-grained**: updates target specific DOM nodes
- **No diffing**: reactivity drives updates directly
- **No re-rendering**: template parsed once
- **Vanishing**: minimal runtime, easy to replace with native DOM Parts
- **Future-proof**: aligns with TC39 Signals + DOM Parts proposals
- **Explicit**: no magic, no hidden lifecycle

---

Use this document as the canonical reference for all implementation work in this repository.
