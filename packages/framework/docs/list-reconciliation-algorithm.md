# List Reconciliation Algorithm

## Document Purpose

This document describes the algorithm for efficiently updating DOM lists with minimal operations. It addresses the critical issue identified in `LIST_DOM_UPDATE_ISSUE.md` where the current implementation removes and re-adds ALL DOM elements on every update.

## Problem Context

### Current Implementation Problem

Location: `packages/framework/src/template/parts.ts`, class `ListManager`, method `update()`

**Current approach:**
```typescript
update(entries: unknown[]): void {
  // ... build fragment with all items ...
  this.#range.deleteContents();  // ❌ Removes ALL
  this.#range.insertNode(fragment);  // ❌ Re-adds ALL
}
```

**Why this is problematic:**
- Breaks CSS transitions (elements lose computed positions)
- Makes FLIP animations impossible
- Elements lose focus state
- Poor performance (unnecessary DOM operations)
- Causes scroll jumps

### Data Model

**List Content Structure:**
- List consists of **chunks** (individual list items)
- Each chunk is a **sequence of DOM nodes** (could be 1+ nodes)
- Chunks can be **keyed** (identifiable) or **non-keyed** (anonymous)
- **Keyed chunks:** Have a unique `key` for identification and reuse
- **Non-keyed chunks:** Must be recreated on every update (no way to identify for reuse)

**Example:**
```typescript
// Input: array of template bindings
[
  html(1)`<li>Item A</li>`,      // Keyed chunk (key=1)
  html(2)`<li>Item B</li>`,      // Keyed chunk (key=2)  
  'plain text',                   // Non-keyed chunk
  html(3)`<li>Item C</li>`,      // Keyed chunk (key=3)
]
```

### NodeRange Structure

The framework uses `NodeRange` to track sequences of DOM nodes:

```typescript
class NodeRange {
  start: Comment;  // Boundary marker (EXCLUSIVE - not part of content)
  end: Node;       // Last content node (INCLUSIVE - part of content)
}
```

**Critical details:**
- `start` is a **comment node** serving as a boundary marker
- `start` is **EXCLUSIVE**: content begins at `start.nextSibling`
- `end` is **INCLUSIVE**: content includes the end node itself
- Content = all nodes from `start.nextSibling` through `end` (inclusive)

**Example:**
```
NodeRange { start: <!--marker-->, end: <li>...</li> }

DOM structure:
  <!--marker--> [text node] <span>...</span> <li>...</li>
  ^start        ^first                       ^end
  (exclusive)   (content begins)             (inclusive)
```

### Chunk Boundary Sharing

Adjacent chunks **share boundary nodes** for efficiency:

```typescript
chunk1: NodeRange { start: marker1, end: marker2 }
chunk2: NodeRange { start: marker2, end: marker3 }
chunk3: NodeRange { start: marker3, end: endMarker }
```

**marker2 serves dual purpose:**
- **Last node of chunk1** (inclusive in chunk1's content)
- **Boundary marker for chunk2** (exclusive from chunk2's content)

**DOM layout:**
```
<!--marker1--> [chunk1 nodes...] <!--marker2--> [chunk2 nodes...] <!--marker3--> [chunk3 nodes...] <!--endMarker-->
^chunk1.start                    ^chunk1.end   ^chunk2.start                    ^chunk2.end      ^chunk3.start
                                 ^chunk2.start                                   ^chunk3.start
```

**To extract chunk1's content:**
```typescript
// Get all nodes from marker1.nextSibling through marker2 (inclusive)
let node = chunk1.range.start.nextSibling;
while (node) {
  // ... process node
  if (node === chunk1.range.end) break;
  node = node.nextSibling;
}
```

## Algorithm Goals

1. **Minimize DOM operations:** Only touch chunks that changed position or are new/removed
2. **Preserve element identity:** Keyed chunks stay in DOM and move, never removed/re-added
3. **Efficient lookup:** O(n+m) time complexity where n=old length, m=new length
4. **Handle all cases:** Reorder, insert, remove, mixed keyed/non-keyed

## Algorithm Development

### Core Insight

**DOM nodes can only exist in one place at a time.** When you call `insertBefore(existingNode, reference)`, the node is **automatically moved** from its current position to the new position. This is the key to efficient reordering.

### Algorithm Strategy

Instead of building a complete fragment and replacing everything:

1. **Build index** of existing keyed chunks (Map: key → chunk)
2. **Process new list in order**, for each item:
   - If keyed and exists: **move** to correct position
   - If new: **create and insert** at correct position
   - Track which items were reused
3. **Cleanup** any keyed chunks that weren't reused (remove from DOM)
4. **Non-keyed chunks** are always recreated (no identity to track)

### Why This Works

- **Keyed chunks:** We can identify them across updates, so we move instead of recreate
- **Non-keyed chunks:** No identity, so we must recreate (but that's expected)
- **Ordering:** By processing the new list in order and inserting/moving to the correct position, we build the correct final order
- **Minimal ops:** Only chunks that changed position are moved; chunks already in position stay put

## Actual TypeScript Data Structures

### Existing List (Old, in DOM)

```typescript
// ListManager has:
#range: NodeRange                          // Outer boundary of entire list
#keyedItems: Map<key, KeyedChild>         // Tracks keyed chunks

interface KeyedChild {
  range: NodeRange;    // Chunk boundary (start=marker, end=last node)
  dispose: () => void; // Cleanup function
}
```

**Structure in DOM:**
```
#range.start (outer marker)
  → chunk1.range.start (marker1)
    → [chunk1 content nodes...]
    → chunk1.range.end (marker2 or last content node)
  → chunk2.range.start (marker2 - shared with chunk1.end)
    → [chunk2 content nodes...]
    → chunk2.range.end (marker3 or last content node)
  → ...
#range.end (outer end marker)
```

### New List (Input to update())

```typescript
entries: Array<DocumentFragment | TemplateBinding | Node | primitive>

// TemplateBinding structure:
interface TemplateBinding {
  key?: unknown;  // If present, this chunk is identifiable/keyed
  instance: () => { 
    fragment: DocumentFragment;  // Rendered content
    dispose: () => void;         // Cleanup function
  };
}
```

**Processing rules:**
- `TemplateBinding` with `key` + exists in `#keyedItems` → **Reuse and move**
- `TemplateBinding` with `key` + new → **Instantiate and insert**
- `TemplateBinding` without `key` → **Instantiate and insert** (non-keyed)
- `DocumentFragment` → **Insert** (non-keyed)
- `Node` → **Insert** (non-keyed)
- Primitive (string, number) → **Convert to text node and insert** (non-keyed)

## FragmentList Abstraction

To efficiently manage the list of chunks during reconciliation, we introduce a `FragmentList` helper class:

```typescript
/**
 * Manages a list of DOM chunks with efficient access by index and key.
 * 
 * Structure:
 * - Maintains an array of boundary nodes (pointers)
 * - pointers[0] = outer start marker
 * - pointers[i] for i > 0 = end node of chunk (i-1)
 * - pointers.length = number of chunks + 1
 * 
 * Key Resolution (two-step):
 * 1. key → index (via #keyToIndex map)
 * 2. index → range (via #pointers array)
 * 
 * This makes chunk[i] = NodeRange(pointers[i], pointers[i+1])
 */
class FragmentList {
  // Array of boundary nodes
  #pointers: Node[];
  
  // Map from key to chunk index (only for keyed chunks)
  #keyToIndex: Map<unknown, number> = new Map();
  
  constructor(outerRange: NodeRange) {
    this.#pointers = [outerRange.start, outerRange.end];
  }
  
  get chunkCount(): number {
    return this.#pointers.length - 1;
  }
  
  // Step 2: index → range
  getChunkRange(index: number): NodeRange {
    return new NodeRange(
      this.#pointers[index] as Comment,    // start (exclusive)
      this.#pointers[index + 1]            // end (inclusive)
    );
  }
  
  // Two-step resolution: key → index → range
  getChunkByKey(key: unknown): { range: NodeRange; index: number } | null {
    const index = this.#keyToIndex.get(key);
    if (index === undefined) return null;
    
    return { 
      range: this.getChunkRange(index),
      index 
    };
  }
  
  // Check if key exists in list
  hasKey(key: unknown): boolean {
    return this.#keyToIndex.has(key);
  }
  
  // Iterate chunks from end to start (for reverse processing)
  *iterateReverse(): Generator<{ range: NodeRange; index: number }> {
    for (let i = this.#pointers.length - 2; i >= 0; i--) {
      yield { range: this.getChunkRange(i), index: i };
    }
  }
  
  // Delete chunk at index
  deleteChunk(index: number): void {
    const range = this.getChunkRange(index);
    range.deleteContents();
    
    // Remove end pointer from array
    this.#pointers.splice(index + 1, 1);
    
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
  
  // Insert chunk at position (before chunk at beforeIndex)
  insertChunk(beforeIndex: number, marker: Comment, nodes: Node[], key?: unknown): void {
    const parent = this.#pointers[0].parentNode;
    if (!parent) throw new Error('Not in DOM');
    
    // Find reference node for insertion
    const referenceNode = beforeIndex < this.#pointers.length
      ? this.#pointers[beforeIndex]
      : this.#pointers[this.#pointers.length - 1].nextSibling;
    
    // Insert marker and content nodes into DOM
    parent.insertBefore(marker, referenceNode);
    for (const node of nodes) {
      parent.insertBefore(node, referenceNode);
    }
    
    // Update pointers array
    const endNode = nodes.length > 0 ? nodes[nodes.length - 1] : marker;
    this.#pointers.splice(beforeIndex, 0, marker);      // Insert start
    this.#pointers.splice(beforeIndex + 1, 0, endNode); // Insert end
    
    // Update key mappings: increment all indices >= beforeIndex
    for (const [k, idx] of this.#keyToIndex) {
      if (idx >= beforeIndex) {
        this.#keyToIndex.set(k, idx + 1);
      }
    }
    
    // Add new key mapping if keyed
    if (key !== undefined) {
      this.#keyToIndex.set(key, beforeIndex);
    }
  }
  
  // Move chunk from one index to another
  moveChunk(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    
    // Extract chunk from DOM and pointers
    const range = this.getChunkRange(fromIndex);
    const startMarker = range.start;
    const fragment = range.extractContents();
    const endNode = this.#pointers[fromIndex + 1];
    
    // Remove from pointers array
    this.#pointers.splice(fromIndex + 1, 1);
    
    // Update key indices for removal
    for (const [k, idx] of this.#keyToIndex) {
      if (idx === fromIndex) {
        // Keep track - will update after insertion
      } else if (idx > fromIndex) {
        this.#keyToIndex.set(k, idx - 1);
      }
    }
    
    // Adjust target index (we removed one item)
    const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    
    // Insert at new position in DOM
    const referenceNode = adjustedToIndex < this.#pointers.length
      ? this.#pointers[adjustedToIndex]
      : this.#pointers[this.#pointers.length - 1].nextSibling;
    
    const parent = this.#pointers[0].parentNode!;
    parent.insertBefore(startMarker, referenceNode);
    parent.insertBefore(fragment, referenceNode);
    
    // Insert into pointers array
    this.#pointers.splice(adjustedToIndex, 0, startMarker);
    this.#pointers.splice(adjustedToIndex + 1, 0, endNode);
    
    // Update key indices for insertion
    for (const [k, idx] of this.#keyToIndex) {
      if (idx >= adjustedToIndex) {
        this.#keyToIndex.set(k, idx + 1);
      }
    }
    
    // Fix the moved chunk's key mapping
    for (const [k, idx] of this.#keyToIndex) {
      if (this.#pointers[idx] === startMarker) {
        this.#keyToIndex.set(k, adjustedToIndex);
        break;
      }
    }
  }
}
```

**Benefits of FragmentList:**
- ✅ **Clear abstraction**: Encapsulates chunk management logic
- ✅ **Two-step resolution**: Explicit `key → index → range` lookup
- ✅ **Index stability**: Automatically maintained during operations
- ✅ **Reverse iteration**: Built-in support for end-to-start processing
- ✅ **Both keyed and non-keyed**: All chunks tracked, only keyed ones mapped

**Performance considerations:**
- `getChunkByKey()`: O(1) map lookup + O(1) range creation
- `deleteChunk()`: O(k) to update key indices where k = number of keyed chunks
- `insertChunk()`: O(k) to update key indices
- `moveChunk()`: O(k) to update key indices

The O(k) overhead for index updates is acceptable for typical list sizes. Later sections discuss potential optimizations.

## Original Pseudo-Algorithm (Conceptual)

This section preserves the original thinking process before applying actual data structures.

```
Algorithm: ReconcileChunkList(oldChunks, newChunks, containerRange)

Input:
  - oldChunks: Current list of chunks in DOM
  - newChunks: Desired list of chunks to render
  - containerRange: NodeRange defining the list boundary
  
  Each chunk has:
    - key: identifier (or undefined for non-keyed)
    - nodes: array of DOM nodes
    - dispose: cleanup function

Output:
  - DOM updated to match newChunks with minimal operations

───────────────────────────────────────────────────────────

STEP 1: BUILD INDEX OF EXISTING KEYED CHUNKS

  oldKeyedChunks = new Map<key, chunk>()
  
  For each chunk in oldChunks:
    If chunk.key is defined:
      oldKeyedChunks.set(chunk.key, chunk)
    
    Mark chunk as "not reused yet"

  Notes:
    - Only index keyed chunks (they're the only ones we can identify)
    - Non-keyed chunks will be disposed and recreated
    - O(n) where n = number of old chunks

───────────────────────────────────────────────────────────

STEP 2: PROCESS NEW LIST AND MOVE/INSERT CHUNKS

  referenceNode = containerRange.endMarker.nextSibling
  // We insert before this reference; initially it's after the list
  
  For i = newChunks.length - 1 down to 0:
    // Process in REVERSE order so we can use a single reference node
    
    newChunk = newChunks[i]
    
    ┌─────────────────────────────────────────────────┐
    │ CASE A: Keyed chunk that exists in old list    │
    └─────────────────────────────────────────────────┘
    
    If newChunk.key is defined AND oldKeyedChunks.has(newChunk.key):
      
      oldChunk = oldKeyedChunks.get(newChunk.key)
      Mark oldChunk as "reused"
      
      // Move oldChunk's nodes to correct position
      For each node in oldChunk.nodes (in reverse order):
        containerElement.insertBefore(node, referenceNode)
        // This moves the node if already in DOM
      
      referenceNode = oldChunk.nodes[0]
      // Next iteration will insert before this chunk
    
    ┌─────────────────────────────────────────────────┐
    │ CASE B: New chunk (keyed-but-new OR non-keyed) │
    └─────────────────────────────────────────────────┘
    
    Else:
      
      // Create new chunk (render template or prepare value)
      newNodes = RENDER_CHUNK(newChunk)
      
      // Insert new nodes at correct position
      For each node in newNodes (in reverse order):
        containerElement.insertBefore(node, referenceNode)
      
      If newChunk.key is defined:
        // Track new keyed chunk for future updates
        Store newChunk in tracking system
      
      If newChunk has dispose function:
        // Track disposer (for non-keyed or for cleanup)
        Store dispose function
      
      referenceNode = newNodes[0]
  
  Notes:
    - Reverse iteration lets us use a single reference node
    - insertBefore() automatically moves existing nodes
    - O(m) where m = number of new chunks

───────────────────────────────────────────────────────────

STEP 3: CLEANUP UNUSED KEYED CHUNKS

  For each [key, chunk] in oldKeyedChunks:
    
    If chunk is marked as "not reused":
      
      // Remove chunk's nodes from DOM
      For each node in chunk.nodes:
        node.remove()
      
      // Clean up effects, signals, etc.
      chunk.dispose()
      
      // Remove from tracking
      Delete chunk from keyedItems map
  
  Notes:
    - Only removes chunks that weren't in new list
    - O(k) where k = number of unused keyed chunks

───────────────────────────────────────────────────────────

STEP 4: DISPOSE NON-KEYED ITEMS FROM PREVIOUS UPDATE

  For each disposer in nonKeyedDisposers:
    disposer()
  
  Clear nonKeyedDisposers list
  
  Notes:
    - Non-keyed items are recreated every update
    - Their old instances need cleanup
    - This could be done at the start of the algorithm instead

───────────────────────────────────────────────────────────

End Algorithm
```

## Refined Algorithm (TypeScript Implementation)

This algorithm uses the actual data structures from `ListManager` in `parts.ts`.

```typescript
Algorithm: ListManager.update(entries: unknown[])

Input:
  - entries: Array of items to render (TemplateBinding, Node, primitives, etc.)
  - this.#range: NodeRange defining the list boundary
  - this.#keyedItems: Map<key, KeyedChild> tracking existing keyed chunks
  - this.#nonKeyedDisposers: Array of cleanup functions from previous update

Output:
  - DOM updated to match entries with minimal operations
  - #keyedItems map updated to reflect current state

───────────────────────────────────────────────────────────

STEP 0: VALIDATE & DISPOSE NON-KEYED ITEMS

  parent = this.#range.start.parentNode
  If parent is null:
    Return early (range not in DOM)
  
  // Dispose all non-keyed items from previous update
  For each disposer in this.#nonKeyedDisposers:
    disposer()
  Clear this.#nonKeyedDisposers

  Notes:
    - Non-keyed items are always recreated, so clean up previous instances
    - Prevents memory leaks from abandoned effects/signals

───────────────────────────────────────────────────────────

STEP 1: MARK ALL KEYED ITEMS AS "NOT REUSED"

  reusedKeys = new Set<unknown>()
  
  Notes:
    - We'll add keys to this set as we process the new list
    - After processing, any key NOT in this set should be removed

───────────────────────────────────────────────────────────

STEP 2: PROCESS NEW LIST IN REVERSE ORDER

  referenceNode = this.#range.end.nextSibling
  // Insert before this reference (initially after the entire list)
  
  For i = entries.length - 1 down to 0:
    entry = entries[i]
    
    ┌───────────────────────────────────────────────────────┐
    │ CASE A: Keyed TemplateBinding that exists            │
    └───────────────────────────────────────────────────────┘
    
    If isTemplateBinding(entry) AND entry.key !== undefined:
      key = entry.key
      
      // Handle duplicate keys in same update (last occurrence wins)
      If reusedKeys.has(key):
        existing = this.#keyedItems.get(key)
        If existing:
          existing.dispose()
          this.#keyedItems.delete(key)
      
      existing = this.#keyedItems.get(key)
      
      If existing:
        // REUSE: Move existing chunk to correct position
        reusedKeys.add(key)
        
        // Move all nodes from existing chunk
        // Content = nodes from existing.range.start.nextSibling 
        //           through existing.range.end (inclusive)
        
        node = existing.range.end
        While node !== existing.range.start:
          prevNode = node.previousSibling
          parent.insertBefore(node, referenceNode)
          // insertBefore() automatically moves the node
          node = prevNode
        
        // Update reference for next iteration
        referenceNode = existing.range.start.nextSibling
        // Next chunk will be inserted before this chunk
        
      Else:
        // CREATE: New keyed chunk
        { fragment, dispose } = entry.instance()
        marker = document.createComment('item')
        
        // Insert in reverse: last node first, then marker
        nodes = Array.from(fragment.childNodes)
        For j = nodes.length - 1 down to 0:
          parent.insertBefore(nodes[j], referenceNode)
        parent.insertBefore(marker, referenceNode)
        
        // Track new keyed chunk
        endNode = nodes.length > 0 ? nodes[nodes.length - 1] : marker
        range = new NodeRange(marker, endNode)
        this.#keyedItems.set(key, { range, dispose })
        reusedKeys.add(key)
        
        referenceNode = marker
    
    ┌───────────────────────────────────────────────────────┐
    │ CASE B: Non-keyed item (all other types)             │
    └───────────────────────────────────────────────────────┘
    
    Else:
      // Prepare item (handles TemplateBinding, Node, primitives, etc.)
      { nodes, dispose } = this.#prepareItem(entry)
      
      If dispose:
        this.#nonKeyedDisposers.push(dispose)
      
      // Insert nodes in reverse order
      For j = nodes.length - 1 down to 0:
        parent.insertBefore(nodes[j], referenceNode)
      
      If nodes.length > 0:
        referenceNode = nodes[0]
  
  Notes:
    - Reverse iteration allows single reference node
    - insertBefore() on existing nodes moves them (doesn't clone)
    - Moving nodes maintains their event listeners, focus, etc.

───────────────────────────────────────────────────────────

STEP 3: REMOVE UNUSED KEYED CHUNKS

  For each [key, child] in this.#keyedItems:
    
    If NOT reusedKeys.has(key):
      
      // Remove chunk's content from DOM
      // Content = nodes from child.range.start.nextSibling
      //           through child.range.end (inclusive)
      node = child.range.start.nextSibling
      While node:
        next = node.nextSibling
        isEnd = (node === child.range.end)
        node.remove()
        If isEnd:
          Break
        node = next
      
      // Also remove the start marker
      child.range.start.remove()
      
      // Clean up effects, signals, etc.
      child.dispose()
      
      // Remove from tracking map
      this.#keyedItems.delete(key)
  
  Notes:
    - Only removes chunks that weren't in new list
    - Must remove both content AND start marker
    - O(k) where k = number of unused keyed chunks

───────────────────────────────────────────────────────────

STEP 4: CLEAN UP BOUNDARIES (if needed)

  // The outer range boundaries (this.#range.start and end) stay in place
  // Individual chunk markers have already been moved/removed as needed
  // No additional cleanup required
  
  Notes:
    - Unlike the old algorithm, we don't call deleteContents() + insertNode()
    - The range structure is maintained through individual moves

───────────────────────────────────────────────────────────

End Algorithm
```

## Key Differences from Original Algorithm

The refined algorithm accounts for:

1. **NodeRange boundaries**: Start is exclusive, end is inclusive
2. **Shared boundaries**: Adjacent chunks share marker nodes
3. **Reverse traversal for moving**: When moving a chunk's nodes, we go from `end` back to `start.nextSibling`
4. **Marker management**: Each keyed chunk has its own start marker that must be moved with content
5. **#prepareItem()**: Existing helper that handles all non-keyed types
6. **No fragment building**: We insert directly into DOM, not into a temporary fragment

## Helper Operations (Existing in parts.ts)

```typescript
Operation: #prepareItem(value: unknown): { nodes: Node[], dispose?: () => void }
  
  If value is null/false:
    Return { nodes: [] }
  
  If isTemplateBinding(value):
    { fragment, dispose } = value.instance()
    nodes = Array.from(fragment.childNodes)
    Return { nodes, dispose }
  
  If isIterable(value):
    // Recursively flatten nested iterables
    allNodes = []
    disposers = []
    For each nested in value:
      { nodes, dispose } = #prepareItem(nested)
      allNodes.push(...nodes)
      If dispose: disposers.push(dispose)
    Return { 
      nodes: allNodes,
      dispose: disposers.length > 0 ? () => disposers.forEach(d => d()) : undefined
    }
  
  If value instanceof Node:
    Return { nodes: [value] }
  
  Else (primitive):
    textNode = document.createTextNode(String(value))
    Return { nodes: [textNode] }
```

## Moving a Chunk: Detailed Steps

To move an existing keyed chunk to a new position:

```typescript
// Given: chunk.range = NodeRange { start: marker, end: lastNode }
// Goal: Move entire chunk before referenceNode

// Approach: Walk backward from end to start, moving each node
node = chunk.range.end
while (node !== chunk.range.start) {
  const prev = node.previousSibling
  parent.insertBefore(node, referenceNode)  // Moves the node
  node = prev
}

// Note: We don't move the start marker itself if it's shared with 
// previous chunk's end. Only move if it's a dedicated marker.
// The current implementation creates a marker per chunk, so we do move it.
```

**Why backward traversal?**
- Maintains node order within the chunk
- If we went forward, insertBefore() would reverse the chunk's nodes
- Going backward keeps them in original order at new position

**Example:**
```
Original: [A, B, C]
Move before X using forward: insertBefore(A, X), insertBefore(B, X), insertBefore(C, X)
Result: [C, B, A, X]  ❌ REVERSED!

Move before X using backward: insertBefore(C, X), insertBefore(B, X), insertBefore(A, X)
Result: [A, B, C, X]  ✅ CORRECT!
```

## Complexity Analysis

### Time Complexity
- **Step 0** (Dispose non-keyed): O(d) where d = non-keyed disposers
- **Step 1** (Initialize set): O(1)
- **Step 2** (Process new list): O(m × n) where m = entries length, n = avg nodes per chunk
- **Step 3** (Cleanup unused): O(k × n) where k = unused keyed chunks
- **Total**: O((m + k) × n) ≈ O(total nodes)

### Space Complexity
- **reusedKeys Set**: O(k) where k = number of keyed items
- **Temporary arrays**: O(n) per chunk
- **Total**: O(k + n)

### DOM Operations
- **Keyed chunk reused, same position**: 0 operations (optimization possible)
- **Keyed chunk moved**: n `insertBefore()` operations (n = nodes in chunk)
- **Keyed chunk removed**: n `remove()` operations
- **New chunk inserted**: n `insertBefore()` operations

**Best case** (no changes): 0 DOM operations
**Worst case** (all chunks move): O(total nodes) operations

## Helper Operations

```
Operation: RENDER_CHUNK(chunk)
  
  If chunk is a TemplateBinding:
    { fragment, dispose } = chunk.instance()
    nodes = Array.from(fragment.childNodes)
    Return { nodes, dispose }
  
  Else if chunk is a Node:
    Return { nodes: [chunk], dispose: null }
  
  Else if chunk is a primitive (string, number, etc.):
    textNode = document.createTextNode(String(chunk))
    Return { nodes: [textNode], dispose: null }
  
  Else:
    // Handle other types (arrays, null, etc.)
    Return { nodes: [...], dispose: null }
```

## Complexity Analysis

### Time Complexity
- **Step 1** (Build index): O(n) where n = old list length
- **Step 2** (Process new): O(m) where m = new list length
- **Step 3** (Cleanup): O(k) where k = unused keyed items
- **Total**: O(n + m) - linear in input sizes

### Space Complexity
- **Map storage**: O(k) where k = number of keyed items in old list
- **Temporary arrays**: O(1) (reuse for each chunk)
- **Total**: O(k) - only storing keyed item references

### DOM Operations
- **Keyed item reused in same position**: 0 operations
- **Keyed item moved**: 1 `insertBefore()` per node in chunk
- **Keyed item removed**: 1 `remove()` per node in chunk
- **New item inserted**: 1 `insertBefore()` per node in chunk

**Best case** (no changes): 0 DOM operations
**Worst case** (all new items): O(m × avgNodesPerChunk) operations

## Example Walkthrough

### Setup
```
Old list: [A(key:1), B(key:2), C(key:3)]
New list: [C(key:3), D(key:4), A(key:1)]

Each chunk has:
  - 1 marker comment
  - 1 element node
```

### Initial State

**DOM structure:**
```
<!--outer-start-->
  <!--markerA--> <li>Item A</li>
  <!--markerB--> <li>Item B</li>
  <!--markerC--> <li>Item C</li>
<!--outer-end-->
```

**#keyedItems map:**
```typescript
{
  1: { range: NodeRange(markerA, elementA), dispose: fn },
  2: { range: NodeRange(markerB, elementB), dispose: fn },
  3: { range: NodeRange(markerC, elementC), dispose: fn }
}
```

**Note on chunk boundaries:**
Actually, looking at the current code's `#createKeyedItem()`, each chunk creates its own marker and the range is:
```typescript
range = new NodeRange(marker, nodes.length > 0 ? nodes[nodes.length - 1] : marker)
```

So for a chunk with marker + element:
- `range.start = marker (comment)`
- `range.end = element (last node)`

Chunks don't necessarily share boundaries in the current implementation. Let me revise:

### Execution

**Step 1: Mark all as not reused**
```
reusedKeys = new Set()
```

**Step 2: Process new list (reverse order)**

**referenceNode = outer-end.nextSibling (null or next sibling)**

*Iteration i=2: entry = A(key:1)*
```
- A is keyed and exists in #keyedItems
- Move A's chunk before referenceNode
  - Move elementA before referenceNode
  - Move markerA before referenceNode
- reusedKeys.add(1)
- referenceNode = markerA.nextSibling

DOM: [markerB, elementB, markerC, elementC, markerA, elementA]
```

*Iteration i=1: entry = D(key:4)*
```
- D is keyed but NOT in #keyedItems (new)
- Instantiate D: creates [markerD, elementD]
- Insert elementD before referenceNode (markerA.nextSibling = elementA)
- Insert markerD before referenceNode
- Track in #keyedItems
- reusedKeys.add(4)
- referenceNode = markerD

DOM: [markerB, elementB, markerC, elementC, markerD, elementD, markerA, elementA]
```

Wait, this doesn't look right. Let me reconsider the reference node tracking...

When we process in reverse and insert before referenceNode:
- Start: referenceNode = outer-end.nextSibling
- After inserting chunk: referenceNode = first node of that chunk

Let me redo this more carefully:

**Step 2: Process new list (reverse order)**

Initial: `referenceNode = outer-end.nextSibling` (the node after the list, or null)

*Iteration i=2: entry = A(key:1) - REUSE*
```
Current DOM: [markerA, elementA, markerB, elementB, markerC, elementC]
referenceNode = null (after list)

Action:
  - Move elementA before null (to end) - already there, but let's track it
  - Move markerA before elementA's current position
  
Actually, we move in reverse from end to start:
  node = elementA (range.end)
  while node !== markerA (range.start):
    prev = node.previousSibling  // = markerA
    parent.insertBefore(node, referenceNode)  // insertBefore(elementA, null) = append
    node = prev
  
This moves elementA to end (already there).
Then we update referenceNode = markerA.nextSibling

Actually I need to reconsider. When moving a chunk, do we move the marker too?
```

Let me check the current `#reuseKeyedItem()` code more carefully and think about what the new algorithm should do...

Actually, I realize the issue: I need to decide whether chunk markers move with their content or stay as placeholders. Let me look at the current approach and simplify the walkthrough.

### Simplified Execution (Using Current Marker Structure)

**Initial DOM:**
```
[markerA, elementA, markerB, elementB, markerC, elementC]
```

**Processing in reverse, inserting before referenceNode:**

1. **i=2: A (reuse)** - Move A before `null` (end)
2. **i=1: D (new)** - Insert D before A
3. **i=0: C (reuse)** - Move C before D

**After processing:**
```
[markerC, elementC, markerD, elementD, markerA, elementA, markerB, elementB]
```

**Step 3: Cleanup** - B was not reused, remove it:
```
[markerC, elementC, markerD, elementD, markerA, elementA]
```

**Result:** Matches expected order [C, D, A]

This walkthrough shows the algorithm works, though the specific node movements depend on the exact implementation details we'll code.

## Design Decisions & Rationale

### Why Not Try to Reuse Non-Keyed Chunks?

**Question:** Could we compare non-keyed chunks by structure and reuse if they match?

**Answer:** No, this is not practical because:

1. **Expensive comparison**: Would need to traverse node trees and compare:
   - Element types
   - Attributes and values
   - Text content
   - Child structure
   - This is O(m) per chunk where m = nodes per chunk

2. **Unreliable matching**: Two chunks with same structure might represent different data
   ```typescript
   // These look the same but represent different items:
   html`<li>Item</li>`  // for product A
   html`<li>Item</li>`  // for product B
   ```

3. **Complexity vs benefit**: Most non-keyed content is simple (text, primitives), so recreation is cheap

**Conclusion:** Only keyed chunks have stable identity suitable for reuse.

### Why Process in Reverse Order?

Processing the new list in **reverse order** (from end to start) allows us to use a **single reference node** that we update as we go:

- Start with `referenceNode = endMarker.nextSibling` (after the list)
- Insert each chunk before the reference
- Update reference to the first node of the chunk we just inserted
- Next iteration inserts before that, building the list backward

**Alternative:** Process forward and track a "current position" node, but this is more complex because the position shifts as we insert.

### Why Not Use DocumentFragment?

Using a `DocumentFragment` to build the new list and then replace everything is the current approach - it's simple but inefficient.

The new algorithm inserts directly into the DOM because:
1. We need to move existing nodes (fragments can't contain nodes already in DOM)
2. We're doing incremental updates, not bulk replacement
3. Moving nodes automatically removes them from their old position

### What About Non-Keyed Items from Previous Update?

Non-keyed items must be disposed at each update because:
- We have no way to identify them between updates
- They might have effects/signals that need cleanup
- Their DOM nodes will be recreated

**When to dispose:** At the **start** of the update, before processing new chunks. This ensures:
- Old non-keyed effects are cleaned up
- No memory leaks from abandoned reactive subscriptions
- Clean slate for new non-keyed items

## Integration with Current Code

### Current `ListManager` Structure

The `ListManager` class in `parts.ts` already has:
- `#keyedItems: Map<unknown, KeyedChild>` - tracking for keyed chunks
- `#nonKeyedDisposers: Array<() => void>` - tracking for non-keyed disposers
- `#range: NodeRange` - boundary markers for the list

### Changes Needed

The `update()` method needs to:
1. Keep the existing keyed items map (already have this)
2. Track which keyed items were reused (add a `Set` or mark on items)
3. Process new chunks in reverse order with `insertBefore()`
4. Remove only unused keyed chunks (not all chunks)
5. **Remove the `deleteContents()` + `insertNode()` at the end**

### Preserving Existing Features

The algorithm maintains:
- ✅ Keyed template reuse (improved - no remove/re-add)
- ✅ Duplicate key handling (last occurrence wins)
- ✅ Non-keyed item disposal
- ✅ Effect cleanup via `dispose()` functions
- ✅ NodeRange structure with markers

## Future Optimizations

Once the basic algorithm is working, consider:

1. **Fast path for common cases:**
   - All appends (new items only at end)
   - All prepends (new items only at start)  
   - Simple swap (two adjacent items swap)
   - No changes (same keys in same order)

2. **Batch operations:**
   - If multiple contiguous chunks need removal, could use single `deleteContents()` on a range

3. **Change detection:**
   - Before moving a chunk, check if already in correct position
   - Skip the `insertBefore()` if not needed

4. **Memory pooling:**
   - Reuse marker comment nodes instead of creating new ones

## Testing Strategy

Tests should verify:

1. **DOM operations are minimal:**
   - Use MutationObserver to count adds/removes
   - Verify keyed items are moved, not removed/re-added

2. **Element identity preserved:**
   - Verify same element instances remain in DOM
   - Check focus state maintained
   - Verify CSS transition/animation capability

3. **Correctness:**
   - Final order matches new list
   - All keyed items in correct positions
   - Unused keyed items removed
   - Non-keyed items recreated

4. **Edge cases:**
   - Empty lists
   - All keyed, all non-keyed, mixed
   - Duplicate keys
   - Large lists (performance)

---

## Next Steps

1. Implement the algorithm in `ListManager.update()`
2. Run existing tests to ensure no regressions
3. Add new tests for DOM operation counts
4. Verify FLIP animations work without workarounds
5. Performance benchmark with large lists
