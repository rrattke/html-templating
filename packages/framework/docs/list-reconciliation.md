# List Reconciliation

## Overview

The list reconciliation algorithm efficiently updates keyed lists in the DOM by minimizing node movements and re-insertions. When a reactive list changes, the algorithm determines which items need to move and which can stay in place, avoiding unnecessary DOM mutations.

## Key Concepts

### Keyed Lists

A keyed list consists of `DynamicBinding` instances where each has a unique `key` property:

```typescript
const items = [
  { id: 'a', label: 'Item A' },
  { id: 'b', label: 'Item B' },
  { id: 'c', label: 'Item C' }
];

html`<ul>${() => items.map(item => 
  html(item.id)`<li>${item.label}</li>`
)}</ul>`;
```

The `html(item.id)` syntax creates a keyed template - the key allows the reconciliation algorithm to track which item is which across updates.

### Template Instance Tracking

Each keyed item gets its own `TemplateInstance` that is:
- **Stored by key** in the parent instance's `#childrenByKey` map
- **Reused** across updates if the key still exists
- **Created without a marker node** (using `skipMarker=true`) to reduce DOM overhead

List items use their first content node as the range start instead of creating an extra Comment marker node.

## Algorithm Phases

### Phase 1: Collect Instances

For each item in the new list:
1. Extract its key from the `DynamicBinding`
2. Look up existing instance by key in `parent.#childrenByKey`
3. If found, reuse it; otherwise create new instance
4. Track the new key order

```typescript
for (const item of items) {
  if (item instanceof DynamicBinding && item.key !== undefined) {
    const { instance, reused } = parent.getOrCreateChild(item.key, () => 
      TemplateInstance.create(runtime, item.getTemplate(), item.values, true)
    );
    entries.push({ instance, reused, key: item.key });
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

### Phase 3: Reconcile DOM

Walk through the new order, maintaining an `insertionPoint` that tracks where to insert next:

```typescript
for (const { instance, reused, key } of entries) {
  if (!reused) {
    // New item - insert fragment after insertionPoint
    parentNode.insertBefore(instance.fragment, insertionPoint.nextSibling);
  } else if (needsMove.has(key)) {
    // Reused but needs to move - extract and reinsert
    const fragment = instance.extractContent();
    parentNode.insertBefore(fragment, insertionPoint.nextSibling);
  } else {
    // Reused and in correct position
    // Remove orphaned nodes between insertionPoint and this item
    removeNodesBetween(insertionPoint, instanceStart);
  }
  // Always advance insertionPoint past this item
  insertionPoint = instanceEnd;
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

- **Time Complexity**: O(n²) for LIS computation, O(n) for reconciliation
- **Space Complexity**: O(n) for tracking instances and indices
- **DOM Mutations**: Minimal - only moves items that actually changed position

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
