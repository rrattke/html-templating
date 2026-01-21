# List DOM Update Issue - Critical Finding

## Problem Statement

**Discovered Issue**: The current `ListManager` implementation in `packages/framework/src/template/parts.ts` removes and re-adds ALL DOM elements on every update, even for keyed templates that should be reused in place.

## Why This Matters

This architectural issue breaks several important features:

1. **CSS Transitions**: Elements lose their computed positions when removed from the DOM, making smooth transitions impossible
2. **FLIP Animations**: Cannot track element movement because elements are destroyed and recreated rather than moved
3. **Focus State**: Focused elements lose focus when removed and re-added
4. **Performance**: Unnecessary DOM manipulation for elements that haven't changed position
5. **Scroll Position**: Elements being removed/re-added can cause scroll jumps

## Current Behavior

### Code Location
File: `packages/framework/src/template/parts.ts`
Class: `ListManager`
Method: `update(entries: unknown[])`

### The Problem Code

```typescript
update(entries: unknown[]): void {
  // ... process entries and build fragment ...
  
  // THIS IS THE PROBLEM:
  // Always removes ALL content and re-adds everything
  this.#range.deleteContents();
  this.#range.insertNode(fragment);
}
```

### What Actually Happens

When you have a keyed list like:
```typescript
items.map(item => html(item.id)`<li>${item.text}</li>`)
```

And you reorder items (e.g., swap positions 0 and 1):
```typescript
// Before: [A, B, C]
// After:  [B, A, C]
```

**Expected Behavior** (for keyed templates):
- Element A: moves from position 0 → 1
- Element B: moves from position 1 → 0  
- Element C: stays at position 2 (NOT touched)

**Actual Behavior**:
1. All 3 elements are removed from DOM (`deleteContents()`)
2. All 3 elements are re-added from fragment (`insertNode()`)
3. Element C is removed and re-added even though it didn't move!

## Evidence

### Test File
Created: `packages/framework/src/template/dom-reuse.spec.ts`

The MutationObserver test shows that ALL elements are removed and re-added on every update.

### Keyed Template Reuse Logic

The `#reuseKeyedItem()` method does keep the DOM nodes:
```typescript
#reuseKeyedItem(child: KeyedChild, fragment: DocumentFragment): void {
  const marker = child.range.start;
  const contentFragment = child.range.extractContents();
  const contentNodes = Array.from(contentFragment.childNodes);
  
  marker.remove();  // Removes from DOM
  fragment.appendChild(marker);  // Adds to fragment
  // ... adds content nodes to fragment
}
```

But then everything in the fragment gets removed and re-inserted:
```typescript
this.#range.deleteContents();  // Removes ALL
this.#range.insertNode(fragment);  // Re-adds ALL
```

## Solution Approaches

### Option 1: In-Place Updates (Recommended)
Instead of building a fragment and replacing everything:
1. Track which keyed items exist and their current positions
2. Only move/insert/remove elements that actually changed
3. Use `insertBefore()` to reorder existing elements without removing them

**Pros**: Minimal DOM manipulation, preserves element identity
**Cons**: More complex diffing logic

### Option 2: Incremental DOM Approach
Use a reconciliation algorithm similar to React:
1. Build a map of old positions
2. Build a map of new positions  
3. Calculate minimal set of moves/insertions/deletions
4. Apply changes incrementally

**Pros**: Optimal DOM operations
**Cons**: Complex algorithm, needs careful testing

### Option 3: Hybrid Approach
Keep current fragment-based approach for non-keyed items, but special-case keyed items:
1. Keyed items stay in DOM and get moved
2. Non-keyed items use current fragment approach

**Pros**: Simpler migration path
**Cons**: Two different code paths to maintain

## Current Workaround

**Stashed**: FLIP animation implementation that works despite the issue

File: `packages/demo-components/src/list.ts`

```typescript
#moveUp(id: number): void {
  // Capture positions BEFORE update
  const items = Array.from(this.shadowRoot!.querySelectorAll('li'));
  const oldPositions = items.map(el => el.getBoundingClientRect().top);
  
  // Update data (triggers re-render)
  const newItems = [...this.items];
  [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
  this.items = newItems;
  
  // Animate AFTER DOM updates
  requestAnimationFrame(() => {
    items.forEach((el, i) => {
      const delta = oldPositions[i] - el.getBoundingClientRect().top;
      if (delta) {
        el.style.transform = `translateY(${delta}px)`;
        el.style.transition = 'none';
        requestAnimationFrame(() => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }
    });
  });
}
```

**Issue with workaround**: This works by tracking element references BEFORE the update, but relies on the fact that keyed templates reuse the same elements. However, it's fragile and won't work if elements are truly recreated.

## Related Files

- `packages/framework/src/template/parts.ts` - ListManager implementation
- `packages/framework/src/template/dom-reuse.spec.ts` - Test demonstrating the issue
- `packages/demo-components/src/list.ts` - List component (stashed FLIP animation)
- `packages/framework/src/template/instantiate.spec.ts` - 138 tests (27 new for template translation)

## Test Status

- **Total tests**: 138 passing
- **New tests added**: 
  - 27 tests for template-to-part translation (@click, .value, ?disabled)
  - 17 tests for nested templates and iteration
  - DOM reuse tests (demonstrating the issue)

## Next Steps

1. **Decide on solution approach** (recommend Option 1: In-Place Updates)
2. **Implement proper DOM diffing** in `ListManager.update()`
3. **Add comprehensive tests** for DOM element reuse
4. **Verify FLIP animations work** without workarounds
5. **Test with reactive updates** to ensure element identity is preserved
6. **Document keyed template guarantees** (element reuse, stability, etc.)

## Performance Impact

**Current**: O(n) DOM removals + O(n) DOM insertions on every update = O(2n) operations

**With Fix**: O(k) operations where k = number of elements that actually changed position

For a list of 100 items where only 2 swap positions:
- Current: 200 DOM operations
- Fixed: ~4 DOM operations (move 2 elements)

## Breaking Changes

The fix should be **backwards compatible**:
- API remains the same (keyed templates with `html(key)`)
- Behavior improves (elements stay in DOM)
- No breaking changes for users

## References

- FLIP Animation technique: https://aerotwist.com/blog/flip-your-animations/
- React Reconciliation: https://react.dev/learn/preserving-and-resetting-state
- Incremental DOM: https://github.com/google/incremental-dom

---

**Date**: January 21, 2026
**Status**: Issue identified, solution approaches outlined, ready for implementation
