# Node Range Model

## Core Concept

The template system manages DOM content through **chunks** - contiguous sequences of nodes that can be uniformly described and manipulated using the NodeRange abstraction.

## Chunk Characteristics

Every chunk in the system has these properties:

1. **Start Node**: The node immediately before the content
   - For the first chunk in a NodePart: the comment marker
   - For subsequent chunks in a list: the last element of the previous chunk
   - The start node always exists

2. **Content Nodes**: Zero or more nodes in sequence
   - Can be any DOM nodes (elements, text, comments)
   - Form a contiguous sibling sequence

3. **End Node**: The last content node
   - Always exists (may be same as start if chunk is empty/collapsed)
   - Points to the actual last content node, not a marker

## Uniform Chunk Handling

**Key Insight**: Multiple chunks have the same characteristics as a single chunk.

This means:
- A single template fragment is a chunk
- Each list item is a chunk
- Multiple list items are just multiple chunks
- All chunks can be described by `NodeRange(start, end)`

## Implications

### No Artificial Markers Needed

Since chunks are self-describing through their start/end nodes:
- **Only one marker needed**: The initial NodePart comment
- **List items don't need markers**: They use their first content node as the range start
- **Reconciliation works uniformly**: Whether moving one chunk or multiple chunks

### Range Boundaries

```
NodePart (single chunk):
  #comment (start) → <div>content</div> (end)

NodePart (list with 3 items):
  #comment (start of part)
  <li>A</li> (end of chunk 1, start of chunk 2)
  <li>B</li> (end of chunk 2, start of chunk 3)
  <li>C</li> (end of chunk 3, end of part)
```

## DOM Operations on Chunks

All chunk operations are instances of these primitives:

### Extract Chunk
Remove nodes from DOM into a DocumentFragment:
```typescript
// From start.nextSibling to end (inclusive)
const fragment = range.extractContents();
```

### Insert Chunk
Add nodes from a DocumentFragment after a position:
```typescript
// After insertionPoint
parent.insertBefore(fragment, insertionPoint.nextSibling);
```

### Delete Chunk
Remove nodes from DOM:
```typescript
range.deleteContents();
```

### Move Chunk
Extract then insert:
```typescript
const fragment = range.extractContents();
parent.insertBefore(fragment, newPosition.nextSibling);
```

## Reconciliation Model

List reconciliation is just:
1. Track insertion point (starts at NodePart comment)
2. For each chunk in new order:
   - If new: insert after insertion point
   - If moved: extract and insert after insertion point
   - If unmoved: just clean up orphaned nodes before it
3. Advance insertion point to chunk end
4. Clean up remaining orphaned chunks

The algorithm doesn't need to know if it's handling one chunk or many - they all follow the same pattern.

## Benefits

1. **Simplicity**: One abstraction (chunk) for all cases
2. **Minimal DOM overhead**: No artificial markers
3. **Uniform operations**: Same primitives for fragments and list items
4. **Clear boundaries**: Start/end nodes always defined
5. **Efficient reconciliation**: Only move what changed

## NodeRange Implementation

NodeRange encapsulates chunk operations:

```typescript
class NodeRange {
  #start: Node;  // Node before content
  #end: Node;    // Last content node
  
  extractContents(): DocumentFragment
  deleteContents(): void
  insertNode(content: Node): void
  setEnd(node: Node): void
}
```

The range tracks the chunk boundaries and provides the primitive operations needed for reconciliation.
