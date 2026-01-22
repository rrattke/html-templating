# Slot Architecture Concept

## Problem Statement

The current implementation violates our 3-layer architecture by mixing concerns:

1. **Layer 2 (Parts)** should be stateless - just apply values to DOM locations
2. **Layer 3 (Render)** should handle stateful operations - reconciliation, instance management

Currently, `NodePart` has grown to include reconciliation logic (keyed reuse, DOM moves), which belongs in Layer 3. This makes the code harder to reason about and test.

Additionally, there's an asymmetry in how we handle values:

- Single value: Direct insertion
- Array of values: Special reconciliation path

This asymmetry complicates the code and makes it harder to maintain consistent behavior.

## Vision: Uniform Slot Handling

### Core Insight

Every insertion point (gap) in the DOM should be treated uniformly as a **Slot**. Whether you have:

- A single value: `${item}`
- An array of values: `${items.map(...)}`
- A conditional: `${condition && html`...`}`

The underlying mechanism is the same: **a Slot that holds content**.

### The Slot Concept

A **Slot** is the fundamental unit of dynamic content:

```text
┌─────────────────────────────────────────────────────────┐
│ Slot                                                    │
│ ─────                                                   │
│ A single insertion point in the DOM.                    │
│ Bounded by a start marker and tracks its end.           │
│                                                         │
│ Responsibilities:                                       │
│ - Hold content between markers                          │
│ - Replace content with new value                        │
│ - Track the DOM range it occupies                       │
│ - Dispose (clear content, clean up)                     │
│                                                         │
│ NOT responsible for:                                    │
│ - Deciding when to update                               │
│ - Keyed reconciliation                                  │
│ - Managing multiple slots                               │
└─────────────────────────────────────────────────────────┘
```

### Layer Separation

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Template Parsing (html.ts, template.ts)        │
│ ─────────────────────────────────────────────────────── │
│ Static compilation of template strings to descriptors.  │
│ No DOM, no values, just structure.                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Slots (parts.ts)                               │
│ ─────────────────────────────────────────────────────── │
│ Stateless primitives for applying values to DOM.        │
│                                                         │
│ Slot: Single insertion point                            │
│   - setContent(value): Replace content                  │
│   - clear(): Remove content                             │
│   - getRange(): Return NodeRange                        │
│                                                         │
│ AttributeSlot, PropertySlot, EventSlot, etc.            │
│   - Same pattern for other binding types                │
│                                                         │
│ Key property: NO STATE about previous values.           │
│ Just "put this value here now."                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Managed Parts (render.ts)                      │
│ ─────────────────────────────────────────────────────── │
│ Stateful wrappers that add reconciliation.              │
│                                                         │
│ NodePart: Manages N child Slots                         │
│   - setValue(value): Normalize, reconcile, delegate     │
│   - Tracks slots by key for reuse                       │
│   - Handles ordering (DOM moves)                        │
│   - Uniform treatment: 1 value = 1 slot, N = N slots    │
│                                                         │
│ Key property: Owns the reconciliation logic.            │
│ Slots are dumb; NodePart is smart about reuse.          │
└─────────────────────────────────────────────────────────┘
```

### Uniform Value Handling

The key insight is that `NodePart.setValue()` should normalize ALL inputs to an array of slot entries:

```typescript
// Conceptual pseudocode
setValue(value: unknown): void {
  // Normalize to array of entries
  const entries = this.#normalizeToEntries(value);
  
  // Reconcile: match entries to existing slots by key
  this.#reconcile(entries);
}

#normalizeToEntries(value: unknown): SlotEntry[] {
  // null/undefined/false → empty array
  if (value == null || value === false) return [];
  
  // Array → map each to entry
  if (Array.isArray(value)) {
    return value.flatMap(v => this.#normalizeToEntries(v));
  }
  
  // TemplateBinding → entry with key
  if (isTemplateBinding(value)) {
    return [{ key: value.key, binding: value }];
  }
  
  // Primitive/Node → keyless entry
  return [{ key: undefined, value }];
}
```

This makes the handling uniform:

- Single template: `[{ key: 'x', binding }]` → 1 slot
- Array of templates: `[{ key: 'a', ... }, { key: 'b', ... }]` → N slots
- Conditional false: `[]` → 0 slots
- Mixed content: Flattened to entries → M slots

### Slot Lifecycle

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │────▶│   Update    │────▶│   Dispose   │
│             │     │             │     │             │
│ - Marker    │     │ - Clear     │     │ - Clear     │
│ - Insert    │     │ - Insert    │     │ - Remove    │
│   content   │     │   new value │     │   marker    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Benefits

1. **Clear separation**: Slots don't know about reconciliation; NodePart doesn't know about DOM manipulation details

2. **Uniform code paths**: No special cases for single vs array values

3. **Testable in isolation**:
   - Test Slot: "Given marker, setContent(X) produces correct DOM"
   - Test NodePart: "Given entries, reconcile produces correct slot assignments"

4. **Easier to reason about**: Each layer has one job

5. **Animation-friendly**: DOM identity is preserved because slots are reused, not recreated

## Open Questions

1. **Slot identity**: Should Slot be a class or just a NodeRange with helpers?

2. **Nested templates**: When a slot contains a TemplateBinding, who instantiates it?
   - Option A: Slot calls binding.instance() (Layer 2 touches Layer 3?)
   - Option B: NodePart pre-instantiates before setting content
   - Option C: Pass an "instantiator" function to Slot

3. **Effect management**: Where do reactive effects live?
   - Currently in TemplateInstance.create()
   - Should this move to NodePart in Layer 3?

4. **Attribute parts**: Do they need the same Slot treatment?
   - Currently simpler (no reconciliation needed)
   - But could benefit from uniform pattern

## Next Steps

1. Define the `Slot` interface (Layer 2)
2. Extract reconciliation from `NodePart` into a managed wrapper (Layer 3)
3. Ensure uniform handling of all value types
4. Update tests to reflect new architecture
