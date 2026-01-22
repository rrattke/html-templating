# Generic NodePart Reconciliation - Architectural Concept

## Problem Statement

The current `ListManager.update()` method removes ALL DOM nodes and re-inserts them on every update, even when using keyed templates:

```typescript
// Current problematic approach in ListManager.update()
this.#range.deleteContents();
this.#range.insertNode(fragment);
```

This breaks:

- **FLIP animations**: Elements leave the DOM, breaking position tracking
- **Focus state**: Focused elements lose focus when removed
- **Scroll position**: Scrollable elements reset
- **CSS transitions**: `:hover`, `:focus` states are lost

## Core Insight

**The problem is the fragment-based batch update, not key management.**

The key is correctly stored on `TemplateBinding` (user intent) and should be copied to a tracked instance for reconciliation. The fix is changing *how* we update the DOM, not *where* we store keys.

## Architecture

### Separation of Concerns

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
│  │  TemplateBinding + Reconciler                                     │  │
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
  
  reconcile(bindings: TemplateBinding[]): void {
    // Track by key, reuse or create instances
    // Call part.setValue() with the realized nodes
  }
}
```

### Template Lifecycle

```
Template String          Template                   TemplateBinding           TemplateInstance
     │                        │                           │                         │
     │   html`<div>...</div>` │                           │                         │
     │ ──────────────────────>│ (compiled & cached)       │                         │
     │                        │                           │                         │
     │                        │   + values + key          │                         │
     │                        │ ─────────────────────────>│                         │
     │                        │                           │                         │
     │                        │                           │   .instance()           │
     │                        │                           │ ───────────────────────>│
     │                        │                           │                         │
```

### Key Concepts

| Term                 | Definition                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Template**         | Compiled template structure (cached by template strings). Created immediately in `html\`...\``. Immutable. |
| **Part**             | Applies a value to a DOM location. Stateless. No knowledge of keys or reconciliation.                      |
| **TemplateBinding**  | Render specification: Template reference + values array + optional key. Ephemeral, created on each render. |
| **TemplateInstance** | Realized DOM: fragment + parts + dispose(). Has behavior. Created when binding is instantiated.            |
| **InstanceState**    | Reconciliation bookkeeping: key + NodeRange + dispose. Managed by Reconciler.                              |
| **Reconciler**       | Tracks InstanceState by key. Decides create/reuse/dispose. Orchestrates DOM moves.                         |

### Class Definitions

```typescript
// Compiled template - cached, immutable
class Template {
  readonly element: HTMLTemplateElement;
  readonly descriptors: PartDescriptor[];
  
  cloneFragment(): DocumentFragment { ... }
}

// Part - stateless value application
class NodePart {
  #range: NodeRange;
  
  // Just applies value to DOM - no tracking, no reconciliation
  setValue(value: unknown): void {
    if (value == null || value === false) {
      this.#range.deleteContents();
    } else if (value instanceof Node) {
      this.#range.insertNode(value);
    } else if (value instanceof TemplateInstance) {
      this.#range.insertNode(value.fragment);
    } else {
      this.#range.insertNode(document.createTextNode(String(value)));
    }
  }
}

// Binding - ephemeral, created each render
class TemplateBinding {
  readonly template: Template;
  readonly values: unknown[];
  readonly key: unknown | undefined;
  
  instance(): TemplateInstance { ... }
}

// Realized DOM - has behavior
class TemplateInstance {
  readonly fragment: DocumentFragment;
  readonly parts: Part[];
  
  dispose(): void { ... }
  update(values: unknown[]): void { ... }  // Re-apply values to parts
}

// Reconciliation bookkeeping
class InstanceState {
  readonly key: unknown | undefined;
  readonly range: NodeRange;
  readonly instance: TemplateInstance;
  
  dispose(): void { this.instance.dispose(); }
  moveBefore(referenceNode: Node, parent: Node): void { ... }
}

// Reconciler - manages instance lifecycle
class Reconciler {
  #states = new Map<unknown, InstanceState>();
  
  // Reconcile a list of bindings
  render(bindings: TemplateBinding[]): void { ... }
}
```

## Implementation

### Where Does Reconciliation Live?

The `Reconciler` is a separate class that orchestrates instance management. It can be:

1. **Standalone** - used explicitly by the application
2. **Integrated with a render function** - for reactive scenarios

```typescript
// Option A: Explicit reconciler
const reconciler = new Reconciler(container);
reconciler.render(bindings);

// Option B: Integrated with reactive render  
render(container, () => items.map(item => html(item.id)`<li>${item.name}</li>`));
// The render function internally uses a Reconciler
```

### Reconciler Class

```typescript
class Reconciler {
  #parent: Node;
  #states: InstanceState[] = [];
  #statesByKey = new Map<unknown, InstanceState>();
  #endMarker: Comment;
  
  constructor(parent: Node) {
    this.#parent = parent;
    this.#endMarker = document.createComment('');
    parent.appendChild(this.#endMarker);
  }
  
  render(bindings: TemplateBinding[]): void {
    const reusedKeys = new Set<unknown>();
    const newStates: InstanceState[] = [];
    
    // Process in reverse for efficient insertion
    let referenceNode: Node = this.#endMarker;
    
    for (let i = bindings.length - 1; i >= 0; i--) {
      const binding = bindings[i];
      const key = binding.key;
      
      if (key !== undefined && this.#statesByKey.has(key) && !reusedKeys.has(key)) {
        // Reuse existing state
        const existing = this.#statesByKey.get(key)!;
        reusedKeys.add(key);
        existing.moveBefore(referenceNode, this.#parent);
        newStates.unshift(existing);
        referenceNode = existing.range.start;
      } else {
        // Create new state
        const state = this.#createState(binding);
        this.#insertStateBefore(state, referenceNode);
        newStates.unshift(state);
        referenceNode = state.range.start;
      }
    }
    
    // Dispose unused states
    for (const state of this.#states) {
      if (state.key === undefined || !reusedKeys.has(state.key)) {
        state.dispose();
        state.range.deleteContents();
      }
    }
    
    // Update tracking
    this.#states = newStates;
    this.#statesByKey.clear();
    for (const state of newStates) {
      if (state.key !== undefined) {
        this.#statesByKey.set(state.key, state);
      }
    }
  }
  
  #createState(binding: TemplateBinding): InstanceState {
    const instance = binding.instance();
    const startMarker = document.createComment('');
    
    // Wrap fragment with markers for range tracking
    const range = new NodeRange(startMarker);
    instance.fragment.insertBefore(startMarker, instance.fragment.firstChild);
    range.setEnd(instance.fragment.lastChild!);
    
    return new InstanceState(binding.key, range, instance);
  }
  
  #insertStateBefore(state: InstanceState, referenceNode: Node): void {
    // Collect all nodes from the range
    let node: Node | null = state.range.start;
    const end = state.range.end;
    
    while (node) {
      const next = node.nextSibling;
      this.#parent.insertBefore(node, referenceNode);
      if (node === end) break;
      node = next;
    }
  }
}
```

### NodePart Simplified

With reconciliation moved out, `NodePart` becomes purely about value application:

```typescript
class NodePart {
  #range: NodeRange;
  
  constructor(markerNode: Comment) {
    this.#range = new NodeRange(markerNode);
  }
  
  setValue(value: unknown): void {
    this.#range.deleteContents();
    
    if (value == null || value === false) {
      return;
    }
    
    if (value instanceof Node) {
      this.#range.insertNode(value);
    } else if (value instanceof DocumentFragment) {
      this.#range.insertNode(value);
    } else if (value instanceof TemplateInstance) {
      this.#range.insertNode(value.fragment);
    } else if (Array.isArray(value)) {
      // Flatten array to fragment
      const fragment = document.createDocumentFragment();
      for (const item of value) {
        fragment.appendChild(this.#valueToNode(item));
      }
      this.#range.insertNode(fragment);
    } else {
      this.#range.insertNode(document.createTextNode(String(value)));
    }
  }
  
  #valueToNode(value: unknown): Node {
    if (value instanceof Node) return value;
    if (value instanceof TemplateInstance) return value.fragment;
    return document.createTextNode(String(value));
  }
}
```

## Implementation Plan

### Phase 1: Rename and Refactor Template

1. Rename `PartsTemplate` → `Template`
2. Compile `Template` immediately in `html` tagged template function
3. Store `Template` reference in `TemplateBinding` (not raw strings)

### Phase 2: Create TemplateInstance Class

1. Convert `TemplateInstance` from interface to class
2. Add `dispose()` method
3. Add optional `update(values)` method for re-applying values

### Phase 3: Simplify NodePart

1. Remove instance tracking from `NodePart`
2. Remove `ListManager` entirely
3. `NodePart.setValue()` just applies values to DOM

### Phase 4: Create InstanceState and Reconciler

1. Implement `InstanceState` class with `moveBefore()` method
2. Implement `Reconciler` class with state tracking
3. Integrate with reactive `render()` function

### Phase 4: Testing

1. Add DOM element identity preservation tests
2. Add MutationObserver tests to verify minimal operations
3. Ensure all existing tests pass

## Validation Criteria

| Criterion                     | Verification Method                                 |
| ----------------------------- | --------------------------------------------------- |
| Same keys = same DOM elements | `element1 === element2` identity check              |
| Minimal DOM operations        | MutationObserver shows only moves, no remove/re-add |
| FLIP animations work          | No workarounds needed                               |
| All tests pass                | `npm test` shows 138 passing                        |
| Code is simpler               | ListManager removed, fewer LOC                      |

---

**Status**: Ready for implementation  
**Key Insight**: The problem is fragment-based batch update, not key location
