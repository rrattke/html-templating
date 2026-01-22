# html.ts Roles and Responsibilities

This document focuses only on the types and helpers declared in `src/template/html.ts`, leaving `templating.md` as the higher-level authoring guide.

## Surface API

- **`createTemplateDescriptor(strings): TemplateDescriptor`** — Parses template strings into a compiled `HTMLTemplateElement` plus `descriptors` array mapping each expression to its DOM location.
- **`resolvePath(root, path): Node`** — Replays a stored path against a cloned fragment to find the node a descriptor points to.

## Part Descriptors

```typescript
type PartDescriptor = 
  | NodePartDescriptor        // Expression in node position: ${expr}
  | AttributePartDescriptor   // Single expression as attribute value
  | TextContentPartDescriptor // Expression inside <style> or <script>
  | TextTemplatePartDescriptor; // Multiple expressions in attribute or textContent
```

- **`NodePartDescriptor`** — `{ type: 'node', path }` — Comment marker in content flow
- **`AttributePartDescriptor`** — `{ type: 'attribute', name, path }` — Single expression replacing entire attribute value
- **`TextContentPartDescriptor`** — `{ type: 'textContent', path }` — Single expression as textContent (for `<style>`, `<script>`)
- **`TextTemplatePartDescriptor`** — `{ type: 'textTemplate', target, name?, path, strings, indices }` — Multiple expressions with static text between them

## Marker Construction

- **`createHtmlTemplate(strings)`** — Builds the HTML string by:
  1. Tracking context with `HTMLContextTracker`
  2. Inserting node markers: `<!--part:N-->`
  3. Inserting attribute markers: `%%PART:N%%` (with quotes if needed)
  
- **`HTMLContextTracker`** — State machine that tracks parser position:
  - Modes: `TEXT`, `TAG`, `COMMENT`, `ATTR_VALUE_DOUBLE`, `ATTR_VALUE_SINGLE`, `ATTR_VALUE_UNQUOTED`
  - `advance(chunk)` — Processes a static chunk, updating mode
  - `inAttributeValue()` — Returns true if next expression is in attribute context
  - `getMode()` — Returns current parser mode (used to decide if quotes needed)

- **`createNodeMarker(index)`** — Generates `<!--part:N-->`
- **`createAttributeMarker(index)`** — Generates `%%PART:N%%`
- **`needsQuotes(mode)`** — Returns true for unquoted attribute values

## Parsing and Descriptor Extraction

- **`scanTemplateContent(fragment, descriptors)`** — Walks the compiled template with `TreeWalker`, detecting markers:
  - **Comments** → `extractNodePart()` records `NodePartDescriptor`
  - **`<style>` / `<script>` elements** → `extractTextContentPart()` handles expressions in textContent
  - **Element attributes** → `extractAttributeParts()` handles attribute expressions

- **`extractNodePart(comment, root, descriptors)`** — Parses comment marker, records `NodePartDescriptor` with path

- **`extractTextContentPart(element, root, descriptors)`** — Handles expressions inside `<style>` or `<script>`:
  - Single expression → `TextContentPartDescriptor`
  - Multiple expressions → `TextTemplatePartDescriptor` with `strings` and `indices`

- **`extractAttributeParts(element, root, descriptors)`** — Handles attribute expressions:
  - Single expression (whole value) → `AttributePartDescriptor`
  - Multiple expressions or mixed → `TextTemplatePartDescriptor`

- **`buildPath(node, root)`** — Encodes a node's location as array of child indices from fragment root
- **`resolvePath(root, path)`** — Replays indices against cloned fragment to find target node

## Caching Strategy

Template caching is handled in `instantiate.ts`:

- **`templateCache: WeakMap<TemplateStringsArray, Template>`** — Relies on the JS guarantee that each tagged template literal shares the same `TemplateStringsArray` object identity. Templates are parsed once and reused; the GC can collect cache entries when the originating module becomes unreachable.

## Why this separation exists

- **`html.ts`** — Template parsing: markers, descriptors, paths. No knowledge of bindings or values.
- **`instantiate.ts`** — Template instantiation: `Template`, `TemplateBinding`, caching, part creation.
- **`parts.ts`** — Part implementations: `NodePart`, `AttributePart`, etc. Value application only.

This separation keeps parsing rules isolated from rendering concerns.
