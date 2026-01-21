# FragmentList Design

## Purpose

This document explores the design of a `FragmentList` abstraction for managing DOM chunks during list reconciliation. The FragmentList provides efficient access to chunks by both position (for iteration) and key (for lookups during reconciliation).

## Problem Statement

During list reconciliation, we need to:
1. **Iterate chunks** in reverse order (end to start)
2. **Lookup chunks by key** for reuse detection
3. **Insert new chunks** at specific positions
4. **Delete unused chunks** from the list
5. **Move chunks** to new positions (for reordering)

The challenge is to design a data structure that makes these operations efficient while minimizing memory overhead.

## Core Concept

A **fragment** (or chunk) represents a contiguous sequence of DOM nodes:
- **Keyed fragments**: Have a stable identifier (key) for tracking across updates
- **Non-keyed fragments**: No identity, recreated on each update

Each fragment is bounded by:
- **Start node**: A comment marker (exclusive boundary)
- **End node**: The last content node (inclusive boundary)

These boundaries form a `NodeRange`:
```typescript
interface NodeRange {
  start: Comment;  // Boundary marker (exclusive)
  end: Node;       // Last content node (inclusive)
}
```

## Design Constraints

### Must Support
- ✅ Both keyed and non-keyed fragments
- ✅ Reverse iteration (for reconciliation algorithm)
- ✅ O(1) or better lookup by key
- ✅ Efficient insert/delete/move operations
- ✅ Disposal tracking (cleanup functions)

### Not Required
- ❌ Random access by index (we iterate, not index)
- ❌ Forward iteration (reverse is sufficient)
- ❌ Sorting or reordering in-place

## Design Option 1: Array-Based FragmentList

### Structure

```typescript
/**
 * Combines all metadata for a fragment
 */
interface FragmentEntry {
  endNode: Node;           // End boundary of this fragment (inclusive)
  key?: unknown;           // Optional key for identification
  dispose?: () => void;    // Optional cleanup function
}

/**
 * Array-based FragmentList using combined fragment entries.
 * 
 * Structure:
 * - #startMarker = outer start marker (constant)
 * - #fragments[i] = entry for fragment i
 * - Fragment i spans from #fragments[i-1].endNode (or #startMarker if i=0) 
 *   to #fragments[i].endNode
 * 
 * Benefits over separate arrays:
 * - Single array to maintain
 * - No index synchronization between pointers and disposers
 * - More memory efficient (no duplicate index storage)
 */
class FragmentList {
  // The outer start marker (constant)
  #startMarker: Comment;
  
  // Array of fragment entries
  // fragments[i] contains endNode and optional dispose for fragment i
  #fragments: FragmentEntry[] = [];
  
  // Two-step key resolution: key → index → range
  #keyToIndex: Map<unknown, number> = new Map();
  
  constructor(outerRange: NodeRange) {
    this.#startMarker = outerRange.start;
    // Initialize with single entry representing the outer end
    this.#fragments = [{ endNode: outerRange.end }];
  }
  
  get fragmentCount(): number {
    return this.#fragments.length;
  }
  
  // Step 2 of key resolution: index → range
  getFragmentRange(index: number): NodeRange {
    const startNode = index === 0 
      ? this.#startMarker 
      : this.#fragments[index - 1].endNode;
    
    return new NodeRange(
      startNode as Comment,           // start (exclusive)
      this.#fragments[index].endNode  // end (inclusive)
    );
  }
  
  // Two-step resolution: key → index → range
  getFragmentByKey(key: unknown): { range: NodeRange; index: number } | null {
    const index = this.#keyToIndex.get(key);
    if (index === undefined) return null;
    
    return { 
      range: this.getFragmentRange(index),
      index 
    };
  }
  
  // Check if key exists in list
  hasKey(key: unknown): boolean {
    return this.#keyToIndex.has(key);
  }
  
  // Iterate fragments from end to start (for reverse processing)
  *iterateReverse(): Generator<{ range: NodeRange; index: number; key?: unknown }> {
    for (let i = this.#fragments.length - 1; i >= 0; i--) {
      const entry = this.#fragments[i];
      yield { 
        range: this.getFragmentRange(i), 
        index: i,
        key: entry.key
      };
    }
  }
  
  // Delete fragment at index
  deleteFragment(index: number): void {
    const range = this.getFragmentRange(index);
    
    // Remove from DOM
    range.deleteContents();
    range.start.remove();  // Remove marker too
    
    // Call dispose if exists
    const entry = this.#fragments[index];
    if (entry.dispose) {
      entry.dispose();
    }
    
    // Remove entry from array
    this.#fragments.splice(index, 1);
    
    // Update key mappings:
    // - Delete if points to this index
    // - Decrement if points to index > this
    for (const [key, idx] of this.#keyToIndex) {
      if (idx === index) {
        this.#keyToIndex.delete(key);
      } else if (idx > index) {
        this.#keyToIndex.set(key, idx - 1);
      }
    }
  }
  
  // Insert fragment at position (at index position)
  insertFragment(
    atIndex: number, 
    marker: Comment, 
    nodes: Node[], 
    key?: unknown,
    dispose?: () => void
  ): void {
    const parent = this.#startMarker.parentNode;
    if (!parent) throw new Error('Not in DOM');
    
    // Find reference node for insertion
    // Insert before the start of the fragment that will be at atIndex after insertion
    const referenceNode = atIndex < this.#fragments.length
      ? (atIndex === 0 ? this.#startMarker.nextSibling : this.#fragments[atIndex - 1].endNode.nextSibling)
      : this.#fragments[this.#fragments.length - 1].endNode.nextSibling;
    
    // Insert marker and content nodes into DOM
    parent.insertBefore(marker, referenceNode);
    for (const node of nodes) {
      parent.insertBefore(node, referenceNode);
    }
    
    // Create fragment entry
    const endNode = nodes.length > 0 ? nodes[nodes.length - 1] : marker;
    const entry: FragmentEntry = { endNode, key, dispose };
    
    // Insert into fragments array
    this.#fragments.splice(atIndex, 0, entry);
    
    // Update key mappings: increment all indices >= atIndex
    for (const [k, idx] of this.#keyToIndex) {
      if (idx >= atIndex) {
        this.#keyToIndex.set(k, idx + 1);
      }
    }
    
    // Add new key mapping if keyed
    if (key !== undefined) {
      this.#keyToIndex.set(key, atIndex);
    }
  }
  
  // Move fragment from one index to another
  moveFragment(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    
    // Extract fragment from DOM
    const range = this.getFragmentRange(fromIndex);
    const startMarker = range.start;
    const fragment = range.extractContents();
    
    // Save entry and key before removal
    const entry = this.#fragments[fromIndex];
    let movedKey: unknown = undefined;
    for (const [key, idx] of this.#keyToIndex) {
      if (idx === fromIndex) {
        movedKey = key;
        break;
      }
    }
    
    // Remove from fragments array
    this.#fragments.splice(fromIndex, 1);
    
    // Update key indices for removal
    for (const [k, idx] of this.#keyToIndex) {
      if (idx === fromIndex) {
        this.#keyToIndex.delete(k);
      } else if (idx > fromIndex) {
        this.#keyToIndex.set(k, idx - 1);
      }
    }
    
    // Adjust target index (we removed one item)
    const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    
    // Insert at new position in DOM
    const referenceNode = adjustedToIndex < this.#fragments.length
      ? (adjustedToIndex === 0 ? this.#startMarker.nextSibling : this.#fragments[adjustedToIndex - 1].endNode.nextSibling)
      : this.#fragments[this.#fragments.length - 1].endNode.nextSibling;
    
    const parent = this.#startMarker.parentNode!;
    parent.insertBefore(startMarker, referenceNode);
    parent.insertBefore(fragment, referenceNode);
    
    // Insert into fragments array
    this.#fragments.splice(adjustedToIndex, 0, entry);
    
    // Update key indices for insertion
    for (const [k, idx] of this.#keyToIndex) {
      if (idx >= adjustedToIndex) {
        this.#keyToIndex.set(k, idx + 1);
      }
    }
    
    // Restore moved fragment's key
    if (movedKey !== undefined) {
      this.#keyToIndex.set(movedKey, adjustedToIndex);
    }
  }
  
  // Clear all fragments
  clear(): void {
    // Call all disposers
    for (const entry of this.#fragments) {
      if (entry.dispose) {
        entry.dispose();
      }
    }
    
    // Delete all content from DOM
    const range = new NodeRange(this.#startMarker, this.#fragments[this.#fragments.length - 1].endNode);
    range.deleteContents();
    
    // Reset state - keep outer end marker
    const outerEnd = this.#fragments[this.#fragments.length - 1].endNode;
    this.#fragments = [{ endNode: outerEnd }];
    this.#keyToIndex.clear();
  }
}
```

### Performance Analysis

| Operation | Time Complexity | Explanation |
|-----------|----------------|-------------|
| `getFragmentByKey()` | **O(1)** | Map lookup + array access |
| `insertFragment()` | **O(n)** | Array splice is O(n) + O(k) key updates |
| `deleteFragment()` | **O(n)** | Array splice is O(n) + O(k) key updates |
| `moveFragment()` | **O(n)** | Two splices + O(k) key updates |
| `iterateReverse()` | **O(n)** | Iterate all fragments |

Where:
- n = total number of fragments
- k = number of keyed fragments (k ≤ n)

**Key insight:** The array splice operation is already O(n), so the O(k) key update overhead is not the bottleneck. Total is O(n + k) = O(n).

### Space Complexity

**Storage per fragment:**
```
FragmentEntry:
  - endNode: Node         = 8 bytes (reference)
  - key?: unknown         = 8 bytes (reference, if present)
  - dispose?: () => void  = 8 bytes (reference, if present)
  - Object overhead       = ~16 bytes (V8)
  Total per entry: ~40 bytes (keyed with dispose), ~24 bytes (non-keyed, no dispose)

Start marker: 8 bytes (single reference, shared)
Key map: k × (key_size + 8) for index numbers (for fast lookup)
```

**Total: O(n × 40 + k×key_size)**

For typical case (n=100, k=50, all with disposers, key=number):
- Start marker: 8 bytes
- Fragment entries: ~4000 bytes (40 bytes each)
- Key map: ~800 bytes (key + index for fast lookup)
- **Total: ~4.8 KB**

**Benefits over separate arrays:**
- No duplicate index storage for disposers
- Single array splice operation (vs two for pointers)
- Key stored with fragment (no map search during iteration)
- Simpler implementation (one data structure to maintain)

### Pros
- ✅ Simple, straightforward implementation
- ✅ O(1) key lookup
- ✅ Memory efficient (~32 bytes per fragment)
- ✅ Easy to debug (array is inspectable)
- ✅ Single data structure (no separate disposer tracking)
- ✅ No index synchronization issues

### Cons
- ❌ O(n) insert/delete/move operations
- ❌ Must update key indices on every structural change

## Design Option 2: Linked List FragmentList

### Structure

```typescript
/**
 * A fragment node in the doubly-linked list
 */
interface FragmentNode {
  endNode: Node;          // End boundary of this fragment (inclusive)
  key?: unknown;          // Optional key for identification
  dispose?: () => void;   // Optional cleanup function
  prev: FragmentNode | null; // Previous fragment (or null if first)
  next: FragmentNode | null; // Next fragment (or null if last)
}

/**
 * Note: We store only endNode, not the full NodeRange.
 * The start node is derived from the previous fragment's endNode
 * (or outerRange.start for the first fragment).
 * This is important because the start node is not stable - it changes
 * when the predecessor moves or is removed.
 */

/**
 * Linked list-based FragmentList.
 * 
 * Benefits:
 * - O(1) insert/delete/move operations
 * - O(1) key lookup
 * - No index maintenance overhead
 */
class FragmentList {
  #head: FragmentNode | null = null;  // First fragment
  #tail: FragmentNode | null = null;  // Last fragment
  #count: number = 0;
  
  // Map from key to fragment node (only for keyed fragments)
  #keyToFragment: Map<unknown, FragmentNode> = new Map();
  
  // The outer range boundaries
  #outerRange: NodeRange;
  
  constructor(outerRange: NodeRange) {
    this.#outerRange = outerRange;
  }
  
  get fragmentCount(): number {
    return this.#count;
  }
  
  // Lookup fragment by key - O(1)
  getFragmentByKey(key: unknown): FragmentNode | null {
    return this.#keyToFragment.get(key) ?? null;
  }
  
  // Check if key exists - O(1)
  hasKey(key: unknown): boolean {
    return this.#keyToFragment.has(key);
  }
  
  // Iterate fragments from end to start - O(n)
  *iterateReverse(): Generator<FragmentNode> {
    let current = this.#tail;
    while (current) {
      yield current;
      current = current.prev;
    }
  }
  
  // Iterate fragments from start to end - O(n)
  *iterateForward(): Generator<FragmentNode> {
    let current = this.#head;
    while (current) {
      yield current;
      current = current.next;
    }
  }
  
  // Insert fragment at the end - O(1)
  appendFragment(endNode: Node, key?: unknown, dispose?: () => void): FragmentNode {
    const node: FragmentNode = { endNode, key, dispose, prev: this.#tail, next: null };
    
    if (this.#tail) {
      this.#tail.next = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    this.#count++;
    
    if (key !== undefined) {
      this.#keyToFragment.set(key, node);
    }
    
    return node;
  }
  
  // Insert fragment before another fragment - O(1)
  insertBefore(
    beforeFragment: FragmentNode | null, 
    endNode: Node, 
    key?: unknown, 
    dispose?: () => void
  ): FragmentNode {
    if (!beforeFragment) {
      return this.appendFragment(endNode, key, dispose);
    }
    
    const node: FragmentNode = { 
      endNode, 
      key, 
      dispose, 
      prev: beforeFragment.prev, 
      next: beforeFragment 
    };
    
    if (beforeFragment.prev) {
      beforeFragment.prev.next = node;
    } else {
      this.#head = node;
    }
    beforeFragment.prev = node;
    this.#count++;
    
    if (key !== undefined) {
      this.#keyToFragment.set(key, node);
    }
    
    return node;
  }
  
  // Delete fragment - O(1)
  deleteFragment(fragment: FragmentNode): void {
    // Compute start node
    const startNode = fragment.prev ? fragment.prev.endNode : this.#outerRange.start;
    
    // Remove from DOM
    const range = new NodeRange(startNode as Comment, fragment.endNode);
    range.deleteContents();
    startNode.remove();  // Remove marker too
    
    // Unlink from list
    if (fragment.prev) {
      fragment.prev.next = fragment.next;
    } else {
      this.#head = fragment.next;
    }
    
    if (fragment.next) {
      fragment.next.prev = fragment.prev;
    } else {
      this.#tail = fragment.prev;
    }
    
    this.#count--;
    
    // Remove from key map
    if (fragment.key !== undefined) {
      this.#keyToFragment.delete(fragment.key);
    }
    
    // Call dispose
    if (fragment.dispose) {
      fragment.dispose();
    }
  }
  
  // Move fragment before another fragment - O(1)
  moveBefore(fragment: FragmentNode, beforeFragment: FragmentNode | null): void {
    if (fragment === beforeFragment) return;
    
    // Unlink from current position
    if (fragment.prev) {
      fragment.prev.next = fragment.next;
    } else {
      this.#head = fragment.next;
    }
    
    if (fragment.next) {
      fragment.next.prev = fragment.prev;
    } else {
      this.#tail = fragment.prev;
    }
    
    // Insert at new position
    if (!beforeFragment) {
      // Move to end
      fragment.prev = this.#tail;
      fragment.next = null;
      if (this.#tail) {
        this.#tail.next = fragment;
      } else {
        this.#head = fragment;
      }
      this.#tail = fragment;
    } else {
      fragment.prev = beforeFragment.prev;
      fragment.next = beforeFragment;
      if (beforeFragment.prev) {
        beforeFragment.prev.next = fragment;
      } else {
        this.#head = fragment;
      }
      beforeFragment.prev = fragment;
    }
    
    // Note: Fragment stays in DOM, caller moves it separately
  }
  
  // Clear all fragments
  clear(): void {
    for (const fragment of this.iterateForward()) {
      if (fragment.dispose) {
        fragment.dispose();
      }
    }
    this.#head = null;
    this.#tail = null;
    this.#count = 0;
    this.#keyToFragment.clear();
    this.#outerRange.deleteContents();
  }
}
```

### Performance Analysis

| Operation | Time Complexity | Explanation |
|-----------|----------------|-------------|
| `getFragmentByKey()` | **O(1)** | Direct map lookup |
| `insertBefore()` | **O(1)** | Pointer manipulation only |
| `deleteFragment()` | **O(1)** | Pointer manipulation only |
| `moveBefore()` | **O(1)** | Unlink + relink = constant time |
| `iterateReverse()` | **O(n)** | Traverse all fragments |

All operations except iteration are **O(1)** - a significant improvement over the array-based approach!

### Space Complexity

**Storage per fragment:**
```
FragmentNode object:
  - endNode: Node         = 8 bytes (reference)
  - key?: unknown         = 8 bytes (reference)
  - dispose?: () => void  = 8 bytes (reference)
  - prev: FragmentNode    = 8 bytes (reference)
  - next: FragmentNode    = 8 bytes (reference)
  - Object overhead       = ~32 bytes (V8 engine)
  Total per node: ~72 bytes

Key map: k × (key_size + 8 bytes) for reference to node
```

**Total: O(n × 72 + k×key_size)**

For typical case (n=100, k=50):
- FragmentNodes: ~7200 bytes
- Key map: ~800 bytes (reuses node refs)
- **Total: ~8.0 KB**

### Pros
- ✅ **O(1) insert/delete/move** - optimal for reconciliation
- ✅ O(1) key lookup
- ✅ No index maintenance
- ✅ Simple, clean operations (just pointer manipulation)

### Cons
- ❌ **~1.7x more memory** than array version (~8.0 KB vs ~4.8 KB)
- ❌ No random access by position (but we don't need it)
- ❌ More objects to garbage collect
- ❌ Cache locality not as good as array

## Comparison Summary

| Aspect | Array-Based | Linked List |
|--------|------------|-------------|
| **Insert** | O(n) | O(1) ✓ |
| **Delete** | O(n) | O(1) ✓ |
| **Move** | O(n) | O(1) ✓ |
| **Lookup by key** | O(1) | O(1) = |
| **Iterate reverse** | O(n) | O(n) = |
| **Memory per fragment** | ~40 bytes | ~72 bytes |
| **Total memory (100 items)** | ~4.8 KB | ~8.0 KB |
| **Implementation complexity** | Low ✓ | Low ✓ |
| **Debugging** | Easy (array) | Medium (linked) |

## Recommendations

### For Most Use Cases: **Linked List**
**Reasoning:**
- List reconciliation typically involves many moves/inserts/deletes
- O(1) operations provide better performance for large lists
- Memory overhead (6 KB for 100 items) is negligible on modern systems
- Simpler implementation (no index maintenance)

**Best for:**
- Dynamic lists with frequent reordering
- Large lists (>50 items)
- Performance-critical applications

### For Memory-Constrained Scenarios: **Array-Based**
**Reasoning:**
- 3.5x less memory usage
- O(n) operations acceptable for small lists
- Better cache locality

**Best for:**
- Very small lists (<20 items)
- Memory-constrained environments (embedded systems)
- Static lists with few updates

### Hybrid Approach (Future Optimization)
Start with one implementation and add the other if profiling shows need:
- Use array for lists < 20 items
- Use linked list for lists ≥ 20 items
- Switch dynamically based on size

## Implementation Notes

### Key Design Decisions

1. **Both track all fragments** (keyed and non-keyed)
   - Current code only tracks keyed items
   - Both designs track all to enable iteration and position-based operations

2. **Disposal functions stored inline**
   - Array: Stored in FragmentEntry alongside endNode
   - Linked: Directly on FragmentNode
   - Both approaches are clean and avoid separate tracking

3. **Two-step key resolution**
   - Makes the lookup path explicit: key → (index or node) → range
   - Could optimize linked list to skip node and return range directly

4. **Reverse iteration required**
   - Reconciliation algorithm processes from end to start
   - Both designs support this efficiently

### Testing Considerations

Both implementations should pass identical tests:
- Insert at various positions
- Delete from various positions
- Move between positions
- Lookup by key
- Iterate in reverse order
- Handle edge cases (empty list, single item, etc.)

### Migration Path

Current code structure:
```typescript
class ListManager {
  #range: NodeRange;
  #keyedItems: Map<unknown, KeyedChild>;
  #nonKeyedDisposers: Array<() => void>;
}
```

Migration to FragmentList:
```typescript
class ListManager {
  #range: NodeRange;
  #fragments: FragmentList;  // Replaces #keyedItems + #nonKeyedDisposers
}
```

The FragmentList encapsulates all fragment tracking, simplifying ListManager.

---

## Conclusion

The **Linked List approach is recommended** for the FragmentList implementation due to its:
- Superior O(1) performance for all mutation operations
- Simpler implementation without index maintenance
- Acceptable memory overhead for typical use cases

The array-based approach remains a valid alternative for memory-constrained scenarios or very small lists where the O(n) operations won't be a bottleneck.
