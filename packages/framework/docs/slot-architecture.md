# Slot Architecture

## Problem

The current implementation mixes concerns:
- **NodePart** (Layer 2) contains reconciliation logic that belongs in Layer 3
- Asymmetric handling of single values vs arrays

## Solution: 3-Layer Architecture

```
Layer 1: Template Parsing (html.ts, template.ts)
├── Static compilation of template strings to descriptors
└── No DOM, no values, just structure

Layer 2: Parts (parts.ts)
├── Stateless primitives for applying values to DOM
├── NodePart: setValue(), range, clear()
└── AttributePart, EventPart, etc.

Layer 3: Render (render.ts)
├── TemplateInstance: owns parts[], dispose()
├── InstanceState: key, range, instance, children
└── Reconciler: keyed reconciliation, DOM moves
```

## Key Concepts

### NodePart (Layer 2)

Stateless. Just applies values to a DOM location.

```typescript
class NodePart {
  readonly range: NodeRange;
  setValue(value: unknown): void;
  clear(): void;
}
```

### InstanceState (Layer 3)

Tracks a template instance with its key and DOM range. Forms a tree via `children`.

```typescript
class InstanceState {
  readonly key: unknown | undefined;
  readonly range: NodeRange;
  readonly instance: TemplateInstance;
  readonly children: InstanceState[] = [];
}
```

### TemplateInstance (Layer 3)

Owns the parts and cleanup.

```typescript
class TemplateInstance {
  readonly parts: Part[];
  dispose(): void;
}
```

## Tree Structure

InstanceState forms the tree. Reconciler populates `children` when creating nested states.

```
InstanceState (root)
├── key: undefined
├── range: NodeRange
├── instance: TemplateInstance
└── children: InstanceState[]
    ├── InstanceState (key: 'a')
    │   └── children: [...]
    └── InstanceState (key: 'b')
        └── children: [...]
```

## Usage

```typescript
// Access children
for (const child of state.children) {
  console.log(child.key, child.range);
}

// Find by key
const target = state.children.find(c => c.key === 'item-42');

// Access DOM
target?.range.start.parentElement?.classList.add('highlight');
```

## Changes from Current

| Component | Change |
|-----------|--------|
| NodePart | Unchanged (stays Layer 2, stateless) |
| InstanceState | Add `children: InstanceState[]` |
| Reconciler | Populate children when creating nested states |

---

## Implementation Approach: Two Functions

### The Problem

Currently logic is spread across:
- `TemplateInstance.create()` - mixes instantiation with effect wiring
- `NodePart.setValue()` - handles TemplateBinding instantiation and reconciliation
- `Reconciler` - handles keyed lists but not general template hierarchy

We need orchestration that:
1. Resolves values (instantiate TemplateBindings recursively)
2. Sets resolved values on parts
3. Tracks the template hierarchy for reconciliation

### Two Distinct Use Cases

#### 1. Static Binding

Create a DOM tree from nested templates. No reactivity, no tracking.

```typescript
function instantiateStatic(binding: TemplateBinding): DocumentFragment {
  const template = binding.getTemplate();
  const fragment = template.cloneFragment();
  const parts = createParts(template.descriptors, fragment, binding.runtime);
  
  parts.forEach((part, index) => {
    const value = binding.values[index];
    part.setValue(resolveStatic(value));
  });
  
  return fragment;
}

function resolveStatic(value: unknown): unknown {
  if (isTemplateBinding(value)) {
    return instantiateStatic(value);  // Recurse
  }
  if (Array.isArray(value)) {
    return value.map(resolveStatic);
  }
  return value;
}
```

#### 2. Dynamic Binding (Reconciliation)

Create a stateful tree that can re-render and reconcile.

```typescript
function render(binding: TemplateBinding, container: Node): TemplateState {
  const state = createState(binding, null);
  container.appendChild(state.fragment);
  return state;
}
```

### TemplateState (New Concept)

A tree of state objects for reconciliation:

```typescript
class TemplateState {
  readonly binding: TemplateBinding;
  readonly instance: TemplateInstance;
  readonly range: NodeRange;
  readonly key: unknown | undefined;
  
  #children: Map<number, TemplateState[]> = new Map();  // partIndex → child states
  #disposers: Array<() => void> = [];
  
  get fragment(): DocumentFragment { return this.instance.fragment; }
  
  getChildren(partIndex: number): TemplateState[] {
    return this.#children.get(partIndex) ?? [];
  }
  
  dispose(): void {
    // Dispose all children recursively
    for (const children of this.#children.values()) {
      for (const child of children) {
        child.dispose();
      }
    }
    // Dispose own effects
    for (const dispose of this.#disposers) {
      dispose();
    }
  }
}
```

### createState Implementation

```typescript
function createState(
  binding: TemplateBinding,
  parent: TemplateState | null
): TemplateState {
  const template = binding.getTemplate();
  const fragment = template.cloneFragment();
  const parts = createParts(template.descriptors, fragment, binding.runtime);
  const instance = new TemplateInstance(fragment, parts, () => {});
  
  // Create range markers
  const startMarker = document.createComment('');
  fragment.insertBefore(startMarker, fragment.firstChild);
  const range = new NodeRange(startMarker);
  if (fragment.lastChild) {
    range.setEnd(fragment.lastChild);
  }
  
  const state = new TemplateState(binding, instance, range, binding.key);
  
  // Process each part/value pair
  parts.forEach((part, index) => {
    const value = binding.values[index];
    
    if (typeof value === 'function') {
      if (part instanceof EventAttributePart) {
        // Event handler - set directly
        part.setValue(value);
        state.addDisposer(() => part.dispose());
      } else {
        // Reactive value - wrap in effect
        const dispose = binding.runtime.effect(() => {
          const resolved = value();
          processValue(state, part, index, resolved);
        });
        state.addDisposer(dispose);
      }
    } else {
      // Static value
      processValue(state, part, index, value);
    }
  });
  
  return state;
}
```

### processValue: Handle Different Value Types

```typescript
function processValue(
  state: TemplateState,
  part: Part,
  partIndex: number,
  value: unknown
): void {
  if (!(part instanceof NodePart)) {
    // Attribute/Property/Boolean parts - just set
    part.setValue(value);
    return;
  }
  
  // NodePart - may need reconciliation
  if (isTemplateBinding(value)) {
    // Single template binding
    reconcileSingle(state, part, partIndex, value);
  } else if (Array.isArray(value) && value.some(isTemplateBinding)) {
    // Array of template bindings
    reconcileArray(state, part, partIndex, value);
  } else {
    // Primitive, Node, or non-template array
    part.setValue(value);
    // Clear any existing children for this part
    disposeChildren(state, partIndex);
  }
}
```

### reconcileSingle: Single Template in Slot

```typescript
function reconcileSingle(
  state: TemplateState,
  part: NodePart,
  partIndex: number,
  binding: TemplateBinding
): void {
  const existingChildren = state.getChildren(partIndex);
  const existing = existingChildren[0];
  
  // Can reuse if same template structure
  if (existing && canReuse(existing, binding)) {
    // Update existing - values may have changed
    // (reactive values handle themselves via effects)
    return;
  }
  
  // Dispose old, create new
  disposeChildren(state, partIndex);
  
  const child = createState(binding, state);
  state.setChildren(partIndex, [child]);
  part.setValue(child.fragment);
}

function canReuse(existing: TemplateState, binding: TemplateBinding): boolean {
  // Same template structure (same strings array)
  return existing.binding.strings === binding.strings;
}
```

### reconcileArray: List of Templates in Slot

```typescript
function reconcileArray(
  state: TemplateState,
  part: NodePart,
  partIndex: number,
  values: unknown[]
): void {
  const existingChildren = state.getChildren(partIndex);
  const existingByKey = new Map<unknown, TemplateState>();
  
  // Index existing by key
  for (const child of existingChildren) {
    if (child.key !== undefined) {
      existingByKey.set(child.key, child);
    }
  }
  
  const newChildren: TemplateState[] = [];
  const fragment = document.createDocumentFragment();
  const reusedKeys = new Set<unknown>();
  
  for (const value of values) {
    if (!isTemplateBinding(value)) {
      // Non-template in array - convert to node
      fragment.appendChild(valueToNode(value));
      continue;
    }
    
    const binding = value as TemplateBinding;
    const key = binding.key;
    const existing = key !== undefined ? existingByKey.get(key) : undefined;
    
    if (existing && canReuse(existing, binding)) {
      // Reuse existing state
      reusedKeys.add(key);
      newChildren.push(existing);
      // Move DOM nodes
      appendRange(fragment, existing.range);
    } else {
      // Create new state
      const child = createState(binding, state);
      newChildren.push(child);
      fragment.appendChild(child.fragment);
    }
  }
  
  // Dispose unused
  for (const child of existingChildren) {
    if (child.key === undefined || !reusedKeys.has(child.key)) {
      child.dispose();
      child.range.deleteContents();
    }
  }
  
  // Update DOM and state
  part.clear();
  part.setValue(fragment);
  state.setChildren(partIndex, newChildren);
}
```

### Helper Functions

```typescript
function disposeChildren(state: TemplateState, partIndex: number): void {
  const children = state.getChildren(partIndex);
  for (const child of children) {
    child.dispose();
  }
  state.setChildren(partIndex, []);
}

function appendRange(fragment: DocumentFragment, range: NodeRange): void {
  let node: Node | null = range.start;
  while (node) {
    const next = node.nextSibling;
    fragment.appendChild(node);
    if (node === range.end) break;
    node = next;
  }
}

function valueToNode(value: unknown): Node {
  if (value instanceof Node) return value;
  return document.createTextNode(String(value ?? ''));
}
```

### Key Insight: Lists as Templates

A list is just a template with N slots and almost no static parts:

```
Regular template:  <div>${a}</div>     → 1 slot, 2 fragments
List of N items:   ${items.map(...)}   → N slots, 0 fragments
```

Both should go through the same reconciliation mechanism.

### Orchestration Flow

```
TemplateBinding
     │
     ▼
┌─────────────────────────────────────────────┐
│ Orchestrator                                │
│                                             │
│ 1. Get template from binding                │
│ 2. Clone fragment                           │
│ 3. Create parts                             │
│ 4. For each value:                          │
│    - If TemplateBinding: recurse (create    │
│      child TemplateState)                   │
│    - If array: reconcile children           │
│    - Else: set on part directly             │
│ 5. Wire up effects for reactive values      │
│ 6. Return TemplateState with children       │
└─────────────────────────────────────────────┘
     │
     ▼
TemplateState (tree)
```

### Migration Path

Cannot refactor in place without breaking current implementation. Steps:

1. Implement new functions alongside existing code
2. Add tests for new functions
3. Migrate usage gradually
4. Remove old logic from NodePart/TemplateInstance

### Open Questions

1. Where does the orchestrator live? New module or in render.ts?
2. How to handle mixed static/reactive values in one template?
3. Should TemplateState replace InstanceState or coexist?

---

## Refined Architecture: Parts Are Transient

### Key Insight

**Lists are the only source of variable-quantity slots.** A single slot always holds 0 or 1 value - reconcileSingle is just "same template? keep : replace". The interesting reconciliation (keyed matching, moves, insertions) only happens in arrays.

### Further Simplification: Collapse TemplateInstance + InstanceState

For the static case, we don't need to know anything about parts after creation. They're used to set values, then discarded. This means TemplateInstance is unnecessary overhead.

### Current Structure (Over-Engineered)

```
Template (L1)
    │
    ▼
TemplateInstance (L3)
├── fragment: DocumentFragment
├── parts: Part[]          ← stored but never accessed after setup
└── dispose()
    │
    ▼
InstanceState (L3)
├── key
├── range: NodeRange
├── instance: TemplateInstance  ← extra indirection
└── children: InstanceState[]
```

### Proposed Structure (Collapsed)

```
Template (L1)
├── strings
├── descriptors
└── cloneFragment()

Parts (L2) - TRANSIENT
├── Created during setup
├── Values applied
└── NOT stored (effects close over them if needed)

TemplateState (L3) - THE ONLY stateful object
├── range: NodeRange
├── key: unknown | undefined
├── children: Map<number, TemplateState[]>
├── disposers: (() => void)[]
└── dispose()
```

### Why Parts Don't Need Storage

Parts are used to set values during setup:

**Static case**: Parts used once, then garbage collected
```typescript
function instantiateStatic(binding: TemplateBinding): DocumentFragment {
  const fragment = binding.getTemplate().cloneFragment();
  const parts = createParts(...);  // transient
  
  parts.forEach((part, i) => {
    part.setValue(resolve(binding.values[i]));
  });
  
  return fragment;  // parts garbage collected, no state needed
}
```

**Dynamic case**: Parts captured in effect closures, not stored in array
```typescript
// Effect captures part in closure - no array storage needed
const dispose = runtime.effect(() => {
  part.setValue(getValue());  // part lives in closure
});
state.addDisposer(dispose);

// We never need: state.parts[3].setValue(...)
// Each effect closes over its own part
```

### Type Relationships

```typescript
// Layer 1: Immutable template structure
class Template {
  readonly strings: TemplateStringsArray;
  readonly descriptors: PartDescriptor[];
  cloneFragment(): DocumentFragment;
}

// Layer 2: Transient value applicators
type Part = NodePart | AttributePart | PropertyPart | EventAttributePart | BooleanAttributePart;

// Layer 3: The only stateful runtime object
class TemplateState {
  readonly range: NodeRange;
  readonly key: unknown | undefined;
  
  #children: Map<number, TemplateState[]>;
  #disposers: (() => void)[];
  
  dispose(): void {
    for (const children of this.#children.values()) {
      for (const child of children) child.dispose();
    }
    for (const dispose of this.#disposers) dispose();
  }
}
```

### Summary

| Concept | Role | Lifetime |
|---------|------|----------|
| Template | Static structure | Application lifetime |
| Part | Apply value to DOM location | Transient (setup only) or closure-captured |
| TemplateState | Track DOM range, children, cleanup | Render lifetime |
| TemplateInstance | ~~Owns parts~~ | **Eliminated** |
| InstanceState | ~~Wraps instance~~ | **Merged into TemplateState** |
