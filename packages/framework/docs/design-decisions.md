# Design Decisions

This document captures the core design philosophy, goals, and key architectural decisions that shaped this framework. It serves as the canonical reference for understanding *why* the framework works the way it does.

---

## 1. Project Vision

### The "Vanishing Framework" Concept

A vanishing framework is one where the development tools and libraries are either compiled away or are so lightweight that they "vanish," leaving behind code that is very close to native browser standards. As browsers adopt new APIs like Signals and DOM Parts, the small libraries we use today will be replaced by native browser commands, making the framework truly "vanish."

### Core Goals

Build a minimal, future-proof framework that provides:

- **HTML-first templating** (lit-style template parsing + Part system)
- **Fine-grained reactivity** (SolidJS signals or @solid-js/store)
- **Web Component integration** (Shadow DOM, decorators)
- **Zero diffing, zero re-rendering**
- **Direct DOM updates via Parts**
- **Clean migration path to native DOM Parts + TC39 Signals**

The framework should be small, explicit, and standards-aligned.

---

## 2. Design Principles

- **HTML-first**: Templates are HTML, not JSX
- **Fine-grained**: Updates target specific DOM nodes
- **No diffing**: Reactivity drives updates directly
- **No re-rendering**: Template parsed once
- **Vanishing**: Minimal runtime, easy to replace with native DOM Parts
- **Future-proof**: Aligns with TC39 Signals + DOM Parts proposals
- **Explicit**: No magic, no hidden lifecycle

---

## 3. Core Architecture Decisions

### 3.1 Template Layer (lit-like)

Implement a minimal template engine that:

1. Uses a tagged template literal `html` to:
   - Combine static strings with comment markers (e.g., `<!--part:N-->`)
   - Cache templates by `TemplateStringsArray`
2. Parses HTML once using `<template>`:
   - `template.innerHTML = htmlString`
   - Extract `template.content`
3. Walks the DOM to locate markers:
   - Comment nodes for text parts
   - Attribute markers for dynamic attributes
4. Produces a template record containing:
   - Parsed DOM fragment
   - List of dynamic hole descriptors
   - Functions to locate holes in clones
5. Provides an `instantiate(record)` function that:
   - Clones the fragment
   - Resolves hole positions
   - Creates Part objects (NodePart, AttributePart, etc.)
6. Each Part object exposes:
   - `setValue(value)` → updates DOM directly

### 3.2 Reactive Layer (Solid-style)

Use SolidJS signals or a minimal clone:

- `createSignal(initial)`
- `createEffect(fn)`
- Dependency tracking at read-time
- Synchronous, fine-grained updates

**Reactivity is responsible for *when* updates happen.**
**The template engine is responsible for *where* updates go.**

### 3.3 Integration Layer

When instantiating a template:

- For each dynamic value:
  - If it's a function → wrap in `createEffect(() => part.setValue(fn()))`
  - Else → set once

No diffing. No template re-evaluation. No virtual DOM.

### 3.4 Runtime Adapters

- The template layer depends on a `SignalsRuntime` interface with reactive primitives
- `DynamicBinding.with(runtime)` creates a runtime-specific template function factory
- `StateDecorator.with(runtime)` creates a runtime-specific state decorator
- No global state—each binding carries its own runtime
- Component authors import runtime-specific `html` and `state` from their runtime module

---

## 4. Three-Layer Architecture

The framework uses a strict three-layer architecture that separates concerns cleanly:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Template Compilation (static)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Template                                                         │  │
│  │  - Compiles template strings into DOM template + part descriptors │  │
│  │  - Cached by template strings identity                            │  │
│  │  - Completely static, no runtime values                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Value Application (stateless)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Parts (NodePart, AttributePart, etc.)                            │  │
│  │  - Apply values to DOM locations                                  │  │
│  │  - Stateless: setValue(value) → DOM mutation                      │  │
│  │  - No knowledge of bindings, keys, or reconciliation              │  │
│  │  - Reusable for any scenario (reactive or not)                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Instance Management (stateful)                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  DynamicBinding + Reconciler                                     │  │
│  │  - Tracks instances by key                                        │  │
│  │  - Decides: create new, reuse existing, or dispose                │  │
│  │  - Manages DOM node ranges for moves                              │  │
│  │  - Owns the reactivity lifecycle (effects, disposal)              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Matters

**Parts must be reusable without bindings:**

```typescript
// Direct usage (no binding, no reactivity, no keying)
const template = getTemplate(strings);
const fragment = template.cloneFragment();
const parts = createParts(template.descriptors, fragment);
parts[0].setValue("Hello");       // Just applies value
parts[1].setValue(42);            // Just applies value
container.appendChild(fragment);

// Binding usage (with reactivity and keying)
const binding = html(key)`<div>${() => count()}</div>`;
// Reconciler tracks this binding, creates instance, wires up effects
```

**Reconciliation happens OUTSIDE parts:**

```typescript
// Parts are dumb - they just apply values
class NodePart {
  setValue(value: unknown): void {
    // Convert value to nodes and insert
    // NO instance tracking, NO key comparison
  }
}

// Reconciliation is a separate concern
class Reconciler {
  #instances: Map<unknown, InstanceState> = new Map();
  
  reconcile(bindings: DynamicBinding[]): void {
    // Track by key, reuse or create instances
    // Call part.setValue() with the realized nodes
  }
}
```

---

## 5. Key Terminology

| Term                 | Definition                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Template**         | Compiled template structure (cached by template strings). Created immediately in `html\`...\``. Immutable. |
| **Part**             | Applies a value to a DOM location. Stateless. No knowledge of keys or reconciliation.                     |
| **DynamicBinding**   | Render specification: Template reference + values array + optional key + runtime. Ephemeral, created on each render. |
| **TemplateInstance** | Realized DOM: fragment + parts + dispose(). Has behavior. Created when binding is instantiated.           |
| **InstanceState**    | Reconciliation bookkeeping: key + NodeRange + dispose. Managed by Reconciler.                             |
| **Reconciler**       | Tracks InstanceState by key. Decides create/reuse/dispose. Orchestrates DOM moves.                        |
| **NodeRange**        | Tracks a contiguous sequence of DOM nodes using exclusive start marker and inclusive end node.             |

---

## 6. The Reconciliation Problem & Solution

### The Problem

A naive approach removes ALL DOM nodes and re-inserts them on every update, even when using keyed templates:

```typescript
// Problematic approach
this.#range.deleteContents();
this.#range.insertNode(fragment);
```

This breaks:

- **FLIP animations**: Elements leave the DOM, breaking position tracking
- **Focus state**: Focused elements lose focus when removed
- **Scroll position**: Scrollable elements reset
- **CSS transitions**: `:hover`, `:focus` states are lost

### Core Insight

**The problem is the fragment-based batch update, not key management.**

The key is correctly stored on `DynamicBinding` (user intent) and should be copied to a tracked instance for reconciliation. The fix is changing *how* we update the DOM, not *where* we store keys.

### Solution: In-Place DOM Moves

The `Reconciler` class handles keyed reconciliation by:

1. Tracking instances by key in a Map
2. Reusing existing DOM nodes when the same key appears
3. Moving nodes in-place rather than removing and re-adding
4. Disposing only the instances whose keys are no longer present

```typescript
class Reconciler {
  render(bindings: DynamicBinding[]): void {
    // Process bindings, reuse by key, move in-place
    for (const binding of bindings) {
      if (this.#statesByKey.has(binding.key)) {
        // Reuse: move existing nodes to new position
        existing.moveBefore(referenceNode, this.#parent);
      } else {
        // Create: instantiate new binding
        this.#createState(binding);
      }
    }
    // Dispose unused states
  }
}
```

---

## 7. Excluded Functionality

### lit-html features we intentionally omit

- `render()` diffing system
- Directive system (`repeat`, `when`, `guard`, etc.)
- Async/promise handling
- Boolean attribute logic
- Property/attribute merging
- Hydration / SSR
- Lifecycle management
- Disconnectable parts
- Template re-evaluation

### Framework features we intentionally omit

- Component lifecycle beyond Web Components
- State management abstractions
- Routing
- Global stores
- JSX
- Template expressions beyond simple values/functions

**Goal: minimalism over feature parity.**

---

## 8. Future Native Solutions (2025+)

The web standards bodies are actively working on a two-part native solution:

- **DOM Parts API**: A proposed browser API that allows developers to mark specific parts of the DOM as "dynamic holes." This provides a highly efficient, low-level way to update content without re-parsing HTML.

- **TC39 Signals Proposal**: A native JavaScript primitive for reactivity. A `Signal` is an object that can notify interested parties when its value changes.

When combined, these will allow for a "Push" model: a `Signal`'s value changes, and it directly tells the corresponding `DOM Part` to update itself, which is extremely performant.

Our framework is designed to be easily migrated to these native APIs when they become available.

---

## 9. Implementation Priorities

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
- Keyed lists with reconciliation
- SSR-friendly template records

---

## 10. Web Component Integration

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
  - Dispose effects

### Decorators

Provide decorators for:

- Reactive properties → backed by signals
- Attribute reflection
- Event binding

Example:

```js
@state count = 0;
@attr title;
```

---

*Use this document as the canonical reference for understanding the design philosophy and architectural decisions in this repository.*
