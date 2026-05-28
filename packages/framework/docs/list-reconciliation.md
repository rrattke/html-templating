# List Reconciliation

## Overview

The list reconciliation algorithm efficiently updates keyed lists in the DOM by minimizing node movements and re-insertions. When a
reactive list changes, the algorithm determines which items need to move and which can stay in place, avoiding unnecessary DOM
mutations.

## Key Concepts

### Keyed Lists

A keyed list consists of `DynamicBinding` instances where each has a unique `key` property:

```typescript
const items = [
  { id: "a", label: "Item A" },
  { id: "b", label: "Item B" },
  { id: "c", label: "Item C" },
];

html`<ul>${() => items.map((item) => html(item.id)`<li>${item.label}</li>`)}</ul>`;
```

The `html(item.id)` syntax creates a keyed template - the key allows the reconciliation algorithm to track which item is which
across updates.

### Template Instance Tracking

Each keyed item gets its own `TemplateInstance`. Unlike non-keyed lists, keyed instances are:

- **Stored by key** in a localized cache within the render effect (not on the parent instance)
- **Reused** across updates if the key still exists
- **Created without a marker node** (using `skipMarker=true`) to reduce DOM overhead

List items use their first content node as the range start instead of creating an extra Comment marker node. This localized tracking
prevents key collisions between sibling lists and avoids memory leaks from retained children.

## Algorithm Phases

### Phase 1: Collect Instances

For each item in the new list:

1. Extract its key from the `DynamicBinding`
2. Look up existing instance by key in the local `state.cache`
3. If found, reuse it; otherwise create new instance and add to cache
4. Track the new key order

```typescript
for (const item of items) {
  if (item instanceof DynamicBinding && item.key !== undefined) {
    let instance = state.cache.get(item.key);
    // Reuse or create...
    if (!instance) {
      instance = TemplateInstance.create(runtime, item.getTemplate(), item.values, true);
      state.cache.set(item.key, instance);
    }
    entries.push({ instance, reused: !!instance, key: item.key });
    newKeyOrder.push(item.key);
  }
}
```

### Phase 2: Compute Items to Move

Uses the **Longest Increasing Subsequence (LIS)** algorithm to determine which items can stay in place:

1. Map old keys to their old indices
2. For each key in new order, get its old index
3. Find LIS of old indices - these represent items in the same relative order
4. Items NOT in the LIS need to move

**Example:**

```
Old order: [A, B, C, D]  (indices: 0, 1, 2, 3)
New order: [C, A, B, D]

Old indices for new order: [2, 0, 1, 3]
LIS of [2, 0, 1, 3] = [0, 1, 3] (indices in array, not values)
This represents keys A, B, D staying in same relative order
Only C needs to move
```

This is optimal - we move the minimum number of items needed.

### Phase 3: Extract Movers

Before modifying the DOM structure, we perform an extraction pass. Any item identified as "needs move" is extracted into a
DocumentFragment. This simplifies the insertion phase by treating moves and new insertions identically.

```typescript
const movedFragments = new Map<unknown, DocumentFragment>();
for (const { instance, reused, key } of entries) {
  if (reused && needsMove.has(key)) {
    movedFragments.set(key, instance.extractContent());
  }
}
```

### Phase 4: Reconcile DOM

Walk through the new order, maintaining an `insertionPoint` that tracks where to insert next. We handle "garbage" (nodes that
shouldn't be there) inline during this pass.

```typescript
for (const { instance, reused, key } of entries) {
  // 1. Clean up garbage: remove nodes between insertionPoint and current item start
  //    (Only if item is reused and didn't move - moving items are already out)
  if (reused && !needsMove.has(key)) {
    removeNodesBetween(insertionPoint, instance.range.start);
  }

  // 2. Insert if needed
  if (!reused) {
    // New item - insert fragment
    parentNode.insertBefore(instance.fragment, insertionPoint.nextSibling);
  } else if (needsMove.has(key)) {
    // Moved item - insert pre-extracted fragment
    const fragment = movedFragments.get(key)!;
    parentNode.insertBefore(fragment, insertionPoint.nextSibling);
  }

  // 3. Advance insertionPoint to end of current item
  insertionPoint = instance.range.end;
}
```

**For each item:**

1. **New item** - Insert its fragment at current position
2. **Moved item** - Extract from current location, insert at new position
3. **Unmoved item** - Leave in place, just clean up orphaned nodes before it

**Key insight:** Items that don't move are never extracted or reinserted - we only clean up nodes between them.

### Phase 4: Cleanup

1. Remove any nodes after the last item (removed items)
2. Update the parent's range end to point to the last item
3. Update the parent's child key order for next reconciliation

## DOM Structure

### Without Markers (List Items)

List items created with `skipMarker=true`:

```
<ul>
  #comment (NodePart marker)
  <li>Item A</li>  ← range.start (first content node)
  <li>Item B</li>  ← range.end (last content node)
  #comment (NodePart marker)
</ul>
```

### With Markers (Root Instances)

Root template instances have markers:

```
<div>
  #comment (marker) ← range.start
  <span>Content</span>
  <p>More</p> ← range.end
</div>
```

This saves one Comment node per list item, reducing DOM overhead.

## Performance Characteristics

### Memory Optimization

- **Localized State**: Key tracking happens in `reconcileKeyedList` loop state, not on the parent `TemplateInstance` object.
- **Reference Cleanup**: When a list is removed or replaced, the local `Map` is garbage collected immediately.
- **No array allocations per instance**: Previous versions allocated `children` arrays for every template instance (even non-lists).
  This is now 0 bytes for non-list instances.

### Time Complexity

- **LIS Calculation**: O(n log n) - Uses binary search on result tails.
- **DOM Access**: O(n) - Single pass over the new list.
- **Reconciliation**: O(n) - We touch each item exactly once in the main loop.

### Space Complexity

- O(n) for the `cache` Map (stores active instances).
- O(n) for `newKeyOrder` array.
- 0 additional overhead for non-keyed items.

### DOM Mutations

- **Moves**: Only items not in the Longest Increasing Subsequence are moved.
- **Insertions**: New items are inserted directly.
- **Deletions**: Handled inline during the walk (removes gaps) or at the end (removes trailing nodes).
- **Fragmentation**: Reduced by extracting movers into Fragments before re-insertion.

### What Gets Moved

Given this transformation:

```
[A, B, C, D, E] → [E, A, B, C, D]
```

The algorithm:

1. Finds LIS: [A, B, C, D] (indices 1, 2, 3, 4 in new array)
2. Moves only: E
3. Leaves in place: A, B, C, D

This is optimal - we can't do better than moving 1 item.

## Edge Cases

### Empty List

```typescript
if (entries.length === 0) {
  range.setEnd(range.start); // Collapsed range
}
```

### All Items Removed

Cleanup phase removes all nodes between `insertionPoint` and old `range.end`.

### All Items New

All items go through the "new item" path, no extractions happen.

### Reordering Without Moves

If new order maintains relative positions (e.g., inserting at front/back), many items stay in place:

```
[A, B, C] → [X, A, B, C] 
// Only X is new, A, B, C stay in place
```

## Integration

The reconciliation is triggered from `TemplateInstance.create()` effect:

```typescript
runtime.effect(() => {
  const result = value();

  if (part instanceof NodePart && isIterable(result)) {
    const items = Array.from(result);
    if (hasKeyedItems(items)) {
      reconcileKeyedList(items, runtime, instance, part);
      return;
    }
  }

  // Fallback to standard processing
  const processed = processValue(result, runtime, instance);
  part.setValue(processed);
});
```

This checks if the result is a keyed list and uses optimized reconciliation instead of replacing everything.

## Benefits

1. **Preserves DOM Identity** - Nodes that don't move keep their references
2. **Maintains Focus** - Focused elements stay focused if unmoved
3. **Preserves State** - Component state, animations, selections preserved
4. **Minimal Mutations** - Only touches what actually changed
5. **Efficient** - LIS algorithm ensures minimum number of moves
