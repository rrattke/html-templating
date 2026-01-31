# Template System

This document explains how the framework's template system works, from tagged template literals to live DOM updates. It covers parsing, instantiation, part types, and reactive integration.

---

## 1. High-Level Flow

```text
(template literal) --> html() --> DynamicBinding
                          |
                          v
                   getTemplate()
                          |
                          v
               binding.instance()
                          |
                          v
             NodePart/AttributePart setValue()
                          |
                          v
               DOM updates via SignalsRuntime
```

Each stage runs once per component instantiation, while reactive updates flow directly to individual parts without re-parsing templates.

---

## 2. Authoring Templates with `html`

`html` behaves like lit-html: call it inside your component with static markup plus dynamic placeholders.

```ts
const card = html`
  <article class="card">
    <h2>${() => title()}</h2>
    <p>${() => description()}</p>
    <button @click=${onClick}>Launch</button>
  </article>
`;
```

### What `html` Produces

- A `DynamicBinding` containing:
  - `strings`: the static literal chunks
  - `values`: the dynamic expressions
  - `runtime`: the reactive runtime to use for effects
- A cached `Template` per unique `strings` array

### Binding Syntax

| Syntax          | Part Type             | Description                     |
| --------------- | --------------------- | ------------------------------- |
| `${expr}`       | NodePart              | Dynamic content in element body |
| `attr=${expr}`  | StandardAttributePart | Standard HTML attribute         |
| `.prop=${expr}` | PropertyAttributePart | Element property binding        |
| `?attr=${expr}` | BooleanAttributePart  | Boolean attribute (add/remove)  |
| `@event=${fn}`  | EventAttributePart    | Event listener                  |

---

## 3. Template Parsing and Caching

When the framework sees a new `strings` array it:

1. Concatenates the strings while inserting comment markers for node expressions and synthetic attribute markers for attribute expressions
2. Parses the result once via `<template>.innerHTML`
3. Walks the DOM using `TreeWalker` to find comment and attribute placeholders and stores their DOM paths in descriptors
4. Stores the resulting `Template` in a `WeakMap`, so future uses skip parsing entirely

### Marker Anatomy

```text
Node Part Marker       : <!--part:N-->
Attribute Part Marker  : %%PART:N%%
```

The `N` matches the expression index in the original template literal.

---

## 4. Phase 1: Template String Processing

### Tagged Template Syntax

When you write:

```typescript
const name = "Alice";
const template = html`<div>Hello ${name}!</div>`;
```

The `html` tagged template function receives:

- `strings`: `["<div>Hello ", "!</div>"]` - an array of static strings
- `values`: `["Alice"]` - an array of dynamic values

### Building HTML with Markers

The template building process:

1. Interleaves the static strings with special markers
2. Uses an `HTMLContextTracker` to determine the current parsing context
3. Inserts different markers based on whether we're in an attribute value or element content

#### Context Tracking

The `HTMLContextTracker` maintains a state machine that tracks:

- `TEXT`: Regular element content
- `TAG`: Inside an element tag
- `COMMENT`: Inside an HTML comment
- `ATTR_VALUE_DOUBLE`: Inside a double-quoted attribute value
- `ATTR_VALUE_SINGLE`: Inside a single-quoted attribute value
- `ATTR_VALUE_UNQUOTED`: Inside an unquoted attribute value

### Example Transformations

```typescript
// Node part
html`<div>${content}</div>`
// → "<div><!--part:0--></div>"

// Attribute part
html`<div class=${className}></div>`
// → '<div class="%%PART:0%%"></div>'

// Multiple parts
html`<div class=${cls}>${content}</div>`
// → '<div class="%%PART:0%%"><!--part:1--></div>'

// Multiple values in one attribute
html`<div class="btn ${size} ${variant}"></div>`
// → '<div class="btn %%PART:0%% %%PART:1%%"></div>'
```

---

## 5. Phase 2: Template Record Creation

### Parsing HTML into DOM

The processed HTML string is assigned to a `<template>` element's `innerHTML`:

```typescript
const template = document.createElement('template');
template.innerHTML = buildHTML(strings);
```

The browser's native HTML parser creates a DocumentFragment inside the template element.

### Scanning for Parts

The `scanTemplateContent()` function walks the DOM tree using a `TreeWalker` and identifies:

1. **Comment nodes** containing node markers (`<!--part:N-->`)
2. **Element nodes** that may contain:
   - Attribute markers in attribute values
   - Text content markers in `<style>` and `<script>` elements

### Part Descriptors

For each marker found, a descriptor is created:

#### NodePartDescriptor

```typescript
{
  type: 'node',
  path: [0, 1, 2]  // Path from fragment root to the marker comment
}
```

#### AttributePartDescriptor

```typescript
{
  type: 'attribute',
  name: 'class',
  path: [0, 1]  // Path to the element
}
```

#### TextContentPartDescriptor

```typescript
{
  type: 'textContent',
  path: [0, 0]  // Path to the style/script element
}
```

#### TextTemplatePartDescriptor

```typescript
{
  type: 'textTemplate',
  target: 'attribute',  // or 'textContent'
  name: 'class',       // attribute name (if target is 'attribute')
  path: [0],
  strings: ['btn ', ' ', ''],
  indices: [0, 1]      // Which value indices are part of this template
}
```

### Path Building

Each descriptor includes a `path` array that represents the route from the DocumentFragment root to the target node. For example, the path `[0, 2, 1]` means:

- Start at the fragment root
- Go to child at index 0
- Then to its child at index 2
- Then to its child at index 1

### Template Caching

Template records are cached using a WeakMap keyed by the `TemplateStringsArray`:

```typescript
const templateCache = new WeakMap<TemplateStringsArray, Template>();
```

Since template string arrays are interned by JavaScript engines, the same template literal will always return the same array instance, making caching efficient.

---

## 6. Phase 3: Template Instantiation

### The `.instance()` Method

`binding.instance()` creates a live DOM instance from a `DynamicBinding`:

1. Loads the cached `Template` for the `binding.strings`
2. Clones the template's `DocumentFragment`
3. Creates Part instances by resolving descriptor paths against the clone
4. Iterates through `binding.values`:
   - Functions (signals/effects) become tracked reactions via `runtime.effect`
   - Event handlers get their own disposal tracking
   - All other values are written once
5. Returns `{ fragment, parts, dispose }`, where `dispose` tears down every effect

### Cloning the Template

```typescript
const fragment = template.cloneFragment();  // template.content.cloneNode(true)
```

This creates a fresh copy of the DOM structure for each use.

### Resolving Paths

The `resolvePath()` function traverses the cloned fragment using the path from the descriptor:

```typescript
function resolvePath(root: DocumentFragment, path: number[]): Node {
  let node: Node = root;
  for (const index of path) {
    node = node.childNodes[index];
  }
  return node;
}
```

---

## 7. Part Types

### NodePart

- Manages a dynamic content area marked by a comment
- Uses `NodeRange` to track content boundaries
- Supports:
  - Text (`string` / `number`)
  - DOM nodes
  - Nested `DynamicBinding` instances (recursively instantiated)
  - Iterables (lists of primitives, nodes, or templates)
  - `null` / `false` (clears the part)

### StandardAttributePart

- Sets regular HTML attributes
- Handles boolean values: `null`/`false` removes attribute, `true` sets empty string

### PropertyAttributePart

- Sets element properties directly (`.value`, `.checked`)
- Uses dot prefix syntax: `.value=${signal}`

### BooleanAttributePart

- Adds/removes attributes based on truthiness
- Uses question mark prefix: `?disabled=${condition}`

### EventAttributePart

- Attaches event listeners
- Uses at-sign prefix: `@click=${handler}`
- Manages listener lifecycle (add/remove)

### TextContentPart

- Manages the text content of `<style>` and `<script>` elements
- Converts value to string and sets `textContent`

### TextTemplate

For multiple values in a single location, a shared `TextTemplate` instance is created:

```typescript
class TextTemplate {
  #strings: string[];
  #values: unknown[];
  
  setSlot(index: number, value: unknown): void {
    this.#values[index] = value;
  }
  
  render(): string {
    let result = this.#strings[0];
    for (let i = 0; i < this.#values.length; i++) {
      result += String(this.#values[i] ?? '');
      result += this.#strings[i + 1];
    }
    return result;
  }
}
```

---

## 8. Reactive Runtime Adapter

`SignalsRuntime` is an interface that provides reactive primitives:

```ts
interface SignalsRuntime {
  effect(run: () => void): () => void;
  createSignal<T>(initial: T): Signal<T>;
  createMemo<T>(fn: () => T): Memo<T>;
  batch<T>(fn: () => T): T;
  untrack<T>(fn: () => T): T;
  onCleanup(fn: () => void): void;
}
```

Create runtime-specific template functions:

```ts
export const html = DynamicBinding.with(myRuntime);
```

Create runtime-specific state decorators:

```ts
export const state = StateDecorator.with(myRuntime);
```

Each `DynamicBinding` carries its runtime, so nested templates inherit it automatically.

### Reactive Lifecycles

```text
value is a function --> runtime.effect(() => part.setValue(value()))
value is static     --> part.setValue(value)
```

The runtime decides when to re-run `part.setValue`, ensuring updates target only the affected DOM nodes.

---

## 9. Nested Templates & Lists

Because `NodePart` understands `DynamicBinding` values and generic iterables, you can compose declarative lists:

```ts
html`
  <ul>
    ${() => items().map((item, index) => html`
      <li>
        <span>${item.label}</span>
        <button @click=${() => remove(index)}>Remove</button>
      </li>
    `)}
  </ul>
`;
```

- Every nested `html` call becomes its own template instance
- The parent tracks all child disposers
- Iterables can be nested arbitrarily

### Keyed Lists

For DOM node reuse during reordering, use keyed templates:

```ts
html`
  <ul>
    ${() => items().map(item => html(item.id)`
      <li>${item.label}</li>
    `)}
  </ul>
`;
```

- Existing keys keep their DOM and reactive disposers intact
- Only moved nodes are reordered, removed keys are disposed

---

## 10. Complete Example Flow

### Input Template

```typescript
const userName = signal('Alice');
const userClass = 'user-active';
const template = html`<div class="card ${userClass}">
  <span>Hello ${userName}!</span>
</div>`;
```

### Step 1: Build HTML with Markers

```typescript
// Input
strings: ['<div class="card ', '">\n  <span>Hello ', '!</span>\n</div>']
values: ['user-active', userName]

// Output HTML
'<div class="card %%PART:0%%">\n  <span>Hello <!--part:1-->!</span>\n</div>'
```

### Step 2: Parse and Extract Descriptors

```typescript
descriptors: [
  {
    type: 'textTemplate',
    target: 'attribute',
    name: 'class',
    path: [0],
    strings: ['card ', ''],
    indices: [0]
  },
  {
    type: 'node',
    path: [0, 2, 1]
  }
]
```

### Step 3: Instantiate

```typescript
// Clone template
const fragment = template.cloneFragment();

// Create parts
parts[0] = new TemplateAttributePart(divElement, 'class', textTemplate, 0);
parts[1] = new NodePart(markerComment);

// Set values with reactive effects
parts[0].setValue('user-active');  // Static
runtime.effect(() => parts[1].setValue(userName()));  // Reactive

// Final DOM
<div class="card user-active">
  <span>Hello Alice!</span>
</div>
```

### Step 4: Reactive Update

```typescript
userName.set('Bob');
// → Effect re-runs → NodePart.setValue('Bob')
// → DOM updates: "Alice" → "Bob"
```

---

## 11. Module Structure

The template system is organized into layers:

| Module        | Layer | Responsibility                                                     |
| ------------- | ----- | ------------------------------------------------------------------ |
| `dom.ts`      | 0     | `NodeRange`, `buildPath()`, `resolvePath()`                        |
| `template.ts` | 1     | HTML parsing, `Template` class, compile + cache + clone            |
| `parts.ts`    | 2     | Part implementations + `createParts()` factory                     |
| `render.ts`   | 3     | `StaticBinding`, `DynamicBinding`, `TemplateInstance`, `Reconciler`|

---

## 12. Performance Optimizations

1. **Template Caching**: Template records are created once and reused
2. **Efficient Cloning**: Uses native `cloneNode(true)` for fast DOM duplication
3. **Minimal Parsing**: The HTML parser runs only once per unique template
4. **Path-based Lookup**: Direct navigation to nodes via index arrays
5. **Keyed Reconciliation**: Reuses DOM nodes when rendering lists with keys
6. **Shared TextTemplates**: Multiple parts can share one template for multi-value locations

---

## 13. Tips for Authors

- Prefer functions for reactive expressions (`${() => count()}`) and plain values for static content
- Use property bindings for non-string attributes (`.value=${signal}`)
- Use `@event` syntax for event handlers (`@click=${handler}`)
- Use `?attr` for boolean attributes (`?disabled=${condition}`)
- Compose nested templates for lists instead of manual DOM APIs
- When integrating third-party reactive systems, implement the `SignalsRuntime` interface

---

*This document provides a comprehensive reference for understanding and using the template system.*
