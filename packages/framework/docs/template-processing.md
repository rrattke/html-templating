# HTML Tagged Template String Processing

This document explains how HTML tagged template strings are converted to DOM and how parts are attached to enable dynamic updates.

## Overview

The template processing system consists of three main phases:

1. **Template String Processing**: Converting a tagged template string into HTML markup with markers
2. **Template Record Creation**: Parsing the HTML into a DOM template and extracting part descriptors
3. **Template Instantiation**: Cloning the template and attaching parts for dynamic updates

## Phase 1: Template String Processing

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

The `buildHTML()` function reconstructs the HTML string by:

1. Interleaving the static strings with special markers
2. Using an `HTMLContextTracker` to determine the current parsing context
3. Inserting different markers based on whether we're in an attribute value or element content

#### Context Tracking

The `HTMLContextTracker` maintains a state machine that tracks:

- `TEXT`: Regular element content
- `TAG`: Inside an element tag
- `COMMENT`: Inside an HTML comment
- `ATTR_VALUE_DOUBLE`: Inside a double-quoted attribute value
- `ATTR_VALUE_SINGLE`: Inside a single-quoted attribute value
- `ATTR_VALUE_UNQUOTED`: Inside an unquoted attribute value

As each string chunk is processed, the tracker advances its state character by character to determine where we are in the HTML structure.

#### Marker Types

**Node Markers** (for element content):

```html
<!--part:0-->
```

Used when the value appears in element content:

```typescript
html`<div>${value}</div>`
// → "<div><!--part:0--></div>"
```

**Attribute Markers** (for attribute values):

```html
%%PART:0%%
```

Used when the value appears in an attribute:

```typescript
html`<div class=${value}></div>`
// → '<div class="%%PART:0%%"></div>'
```

The attribute marker includes quotes automatically when needed based on the parsing context.

**Standard Compliance**: The system fully supports both quoted and unquoted attribute values as per the HTML specification. Unquoted attribute values are standard-compliant HTML and are handled correctly by the context tracker. The marker insertion logic automatically adds quotes when inserting markers into unquoted or pending attribute contexts to ensure the resulting HTML remains valid.

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

## Phase 2: Template Record Creation

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

### Creating Part Descriptors

For each marker found, a descriptor is created:

#### Node Part Descriptor

```typescript
{
  type: 'node',
  path: [0, 1, 2]  // Path from fragment root to the marker comment
}
```

#### Attribute Part Descriptor (single value)

```typescript
{
  type: 'attribute',
  name: 'class',
  path: [0, 1]  // Path to the element
}
```

#### Text Content Part Descriptor (single value in script/style)

```typescript
{
  type: 'textContent',
  path: [0, 0]  // Path to the style/script element
}
```

#### Text Template Part Descriptor (multiple values)

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

Each descriptor includes a `path` array that represents the route from the DocumentFragment root to the target node:

```typescript
function buildPath(node: Node, root: DocumentFragment): number[] {
  const path: number[] = [];
  let current = node;
  while (current !== root) {
    const parent = current.parentNode;
    const index = Array.from(parent.childNodes).indexOf(current);
    path.unshift(index);
    current = parent;
  }
  return path;
}
```

For example, the path `[0, 2, 1]` means:

- Start at the fragment root
- Go to child at index 0
- Then to its child at index 2
- Then to its child at index 1

### Text Templates for Multiple Values

When multiple values appear in a single attribute or text content:

```typescript
html`<div class="btn ${size} ${variant}"></div>`
```

A single `TextTemplatePartDescriptor` is created with:

- `strings`: `["btn ", " ", ""]` - the static parts
- `indices`: `[0, 1]` - which values go in which slots

This descriptor is assigned to **all** value indices it references, so both `descriptors[0]` and `descriptors[1]` point to the same descriptor object.

### Template Caching

Template records are cached using a WeakMap keyed by the `TemplateStringsArray`:

```typescript
const templateCache = new WeakMap<TemplateStringsArray, TemplateRecord>();
```

Since template string arrays are interned by JavaScript engines, the same template literal will always return the same array instance, making caching efficient.

## Phase 3: Template Instantiation

### Cloning the Template

When instantiating a template result:

```typescript
const fragment = record.clone();  // template.content.cloneNode(true)
```

This creates a fresh copy of the DOM structure for each use.

### Creating Parts

For each descriptor, a corresponding Part object is created:

#### NodePart

A `NodePart` manages a dynamic content area between two comment markers:

```typescript
class NodePart {
  #start: Comment;      // "part-start" comment
  #end: Comment;        // "part-end" comment
  #current: Node | null;
  
  constructor(markerNode: Comment, instantiateNested) {
    this.#start = document.createComment('part-start');
    this.#end = document.createComment('part-end');
    markerNode.replaceWith(this.#start, this.#end);
  }
}
```

The original marker comment is replaced with start/end boundary markers. Content is inserted between them.

#### AttributePart

An `AttributePart` manages a dynamic attribute on an element:

```typescript
class AttributePart {
  #element: Element;
  #name: string;
  #isPropertyBinding: boolean;  // name starts with '.'
  #isEvent: boolean;            // name starts with 'on'
}
```

It handles:

- Regular attributes: `class`, `id`, etc.
- Property bindings: `.value`, `.checked`
- Event listeners: `onclick`, `oninput`

#### TextContentPart

A `TextContentPart` manages the text content of `<style>` and `<script>` elements:

```typescript
class TextContentPart {
  #element: Element;
  
  setValue(value: unknown): void {
    this.#element.textContent = String(value ?? '');
  }
}
```

#### TextTemplate

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

Multiple `AttributePart` or `TextContentPart` instances can share the same `TextTemplate`, each updating a different slot.

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

This finds the exact node (element or comment) that the part should attach to.

### Setting Initial Values

After parts are created, their initial values are set:

```typescript
parts.forEach((part, index) => {
  const value = result.values[index];
  if (typeof value === 'function' && shouldTreatAsReactive(part)) {
    // Create reactive effect
    const dispose = runtime.effect(() => {
      part.setValue(value());
    });
  } else {
    // Set static value
    part.setValue(value);
  }
});
```

### Part Value Handling

Each part type handles values differently:

#### NodePart Values

- `null`, `undefined`, `false`: Clears content
- `TemplateResult`: Recursively instantiates and inserts nested template
- `Node`: Inserts the node directly
- `Iterable`: Renders each item
  - If items have `.key`, uses keyed reconciliation
  - Otherwise renders sequentially
- Other: Converts to string and creates text node

#### AttributePart Values

- `null`, `undefined`, `false`: Removes attribute
- `true`: Sets boolean attribute (empty value)
- Event (name starts with `on`): Adds/removes event listener
- Property (name starts with `.`): Sets element property
- Other: Converts to string and sets attribute value

#### TextContentPart Values

- Any value: Converts to string and sets `textContent`

### Reactive Updates

When a value is a function (reactive signal):

```typescript
const count = signal(0);
html`<div>${count}</div>`;  // Function, not its value
```

An effect is created that:

1. Calls the function to get the current value
2. Updates the part with that value
3. Automatically re-runs when dependencies change

The effect disposal function is stored so the instance can be cleaned up later.

## Step-by-Step Example with Data Structures

Let's walk through a comprehensive example showing all data structures at each step:

### Input Template

```typescript
const userName = signal('Alice');
const userClass = 'user-active';
const template = html`<div class="card ${userClass}">
  <span>Hello ${userName}!</span>
</div>`;
```

### Step 1: Tagged Template Function Call

The `html` function receives:

```typescript
strings: TemplateStringsArray = [
  '<div class="card ',
  '">\n  <span>Hello ',
  '!</span>\n</div>'
]

values: unknown[] = [
  'user-active',    // index 0
  userName          // index 1 (signal function)
]
```

### Step 2: Build HTML with Context Tracking

Processing each string chunk and inserting markers:

```typescript
result = ''
context = new HTMLContextTracker()  // mode: 'TEXT'

// Process strings[0]: '<div class="card '
context.advance('<div class="card ')
// → mode transitions: TEXT → TAG → ATTR_VALUE_DOUBLE
result += '<div class="card '

// Insert marker for values[0]
// inAttributeValue() = true, mode = 'ATTR_VALUE_DOUBLE'
result += '%%PART:0%%'  // No quotes added (already in quoted context)

// Process strings[1]: '">\n  <span>Hello '
context.advance('">\n  <span>Hello ')
// → mode: ATTR_VALUE_DOUBLE → TAG → TEXT
result += '">\n  <span>Hello '

// Insert marker for values[1]
// inAttributeValue() = false, mode = 'TEXT'
result += '<!--part:1-->'

// Process strings[2]: '!</span>\n</div>'
result += '!</span>\n</div>'
```

**Final HTML string:**

```html
<div class="card %%PART:0%%">
  <span>Hello <!--part:1-->!</span>
</div>
```

### Step 3: Parse HTML to DOM Template

```typescript
const template = document.createElement('template');
template.innerHTML = result;
```

**Resulting DOM tree (template.content):**

```text
DocumentFragment
└─ HTMLDivElement (class="card %%PART:0%%")
   └─ Text "\n  "
   └─ HTMLSpanElement
      └─ Text "Hello "
      └─ Comment "part:1"
      └─ Text "!"
   └─ Text "\n"
```

### Step 4: Scan for Parts and Build Descriptors

Walking the tree with TreeWalker:

**Found in HTMLDivElement:**

- Attribute `class` has value: `"card %%PART:0%%"`
- Matches pattern: one marker at index 0, mixed with static text "card "
- Creates TextTemplatePartDescriptor

**Found Comment node:**

- Content: `"part:1"`
- Creates NodePartDescriptor

**Part Descriptors Array:**

```typescript
descriptors: PartDescriptor[] = [
  // descriptors[0] - for userClass
  {
    type: 'textTemplate',
    target: 'attribute',
    name: 'class',
    path: [0],           // div is first child of fragment
    strings: ['card ', ''],
    indices: [0]         // value index 0 goes here
  },
  // descriptors[1] - for userName
  {
    type: 'node',
    path: [0, 2, 1]      // div → span (skip text nodes) → comment
  }
]
```

**Cleaned Template (markers removed from attributes):**

```text
DocumentFragment
└─ HTMLDivElement (no class attribute yet)
   └─ Text "\n  "
   └─ HTMLSpanElement
      └─ Text "Hello "
      └─ Comment "part:1"
      └─ Text "!"
   └─ Text "\n"
```

### Step 5: Template Record

```typescript
const record: TemplateRecord = {
  template: template,
  descriptors: [
    { type: 'textTemplate', target: 'attribute', name: 'class', 
      path: [0], strings: ['card ', ''], indices: [0] },
    { type: 'node', path: [0, 2, 1] }
  ],
  clone: () => template.content.cloneNode(true)
}

// Cached in WeakMap
templateCache.set(strings, record);
```

### Step 6: Instantiate Template

```typescript
const instance = instantiate(template, runtime);
```

**Clone the template:**

```typescript
const fragment = record.clone();
// Creates fresh copy of the DOM structure
```

**Create Parts:**

```typescript
// Create shared TextTemplate for descriptor[0]
const textTemplate = new TextTemplate(['card ', '']);
textTemplate.#strings = ['card ', ''];
textTemplate.#values = [''];  // one slot

// Resolve path [0] → div element
const divElement = fragment.childNodes[0];

// Part 0: AttributePart with TextTemplate
parts[0] = new AttributePart(divElement, 'class', textTemplate, 0);
parts[0].#element = divElement
parts[0].#name = 'class'
parts[0].#textTemplate = textTemplate
parts[0].#slotIndex = 0

// Resolve path [0, 2, 1] → comment in span
const spanElement = divElement.childNodes[2];
const markerComment = spanElement.childNodes[1];

// Part 1: NodePart (replaces marker with start/end comments)
parts[1] = new NodePart(markerComment, instantiateNested);
// Replaces <!--part:1--> with:
// <!--part-start--><!--part-end-->
```

**Fragment DOM after NodePart creation:**

```text
DocumentFragment
└─ HTMLDivElement (no class yet)
   └─ Text "\n  "
   └─ HTMLSpanElement
      └─ Text "Hello "
      └─ Comment "part-start"
      └─ Comment "part-end"
      └─ Text "!"
   └─ Text "\n"
```

### Step 7: Set Initial Values

```typescript
// parts[0] - AttributePart for class with static value
parts[0].setValue('user-active');
// → textTemplate.setSlot(0, 'user-active')
// → textTemplate.render() = 'card user-active'
// → divElement.setAttribute('class', 'card user-active')

// parts[1] - NodePart with reactive signal
const dispose = runtime.effect(() => {
  parts[1].setValue(userName());  // Calls userName.get()
});
// First run: userName() = 'Alice'
// → NodePart creates text node "Alice"
// → Inserts between start/end comments
```

**Final DOM in fragment:**

```text
DocumentFragment
└─ HTMLDivElement (class="card user-active")
   └─ Text "\n  "
   └─ HTMLSpanElement
      └─ Text "Hello "
      └─ Comment "part-start"
      └─ Text "Alice"
      └─ Comment "part-end"
      └─ Text "!"
   └─ Text "\n"
```

**Complete Instance Object:**

```typescript
{
  fragment: DocumentFragment (shown above),
  parts: [
    AttributePart {
      #element: divElement,
      #name: 'class',
      #textTemplate: TextTemplate { #strings: ['card ', ''], #values: ['user-active'] },
      #slotIndex: 0
    },
    NodePart {
      #start: Comment "part-start",
      #end: Comment "part-end",
      #current: Text "Alice"
    }
  ],
  dispose: () => { /* cleanup function */ }
}
```

### Step 8: Update Values

When the signal changes:

```typescript
userName.set('Bob');
// → Effect re-runs
// → parts[1].setValue('Bob')
// → NodePart updates text node: "Alice" → "Bob"
```

**Updated DOM:**

```text
DocumentFragment
└─ HTMLDivElement (class="card user-active")
   └─ Text "\n  "
   └─ HTMLSpanElement
      └─ Text "Hello "
      └─ Comment "part-start"
      └─ Text "Bob"        ← Changed
      └─ Comment "part-end"
      └─ Text "!"
   └─ Text "\n"
```

The text node is reused and only its `data` property is updated - no DOM node creation or removal needed.

## Complete Example Flow

Let's trace a complete example:

```typescript
const className = signal('active');
const content = signal('Hello');
const template = html`<div class=${className}>${content}</div>`;
```

### Step 1: Build HTML with Markers

```text
Input strings: ["<div class=", ">", "</div>"]
Input values: [className, content]

Context tracking:
  - "<div class=" → ends in TAG mode, attrValuePending=true
  - Insert attribute marker: "%%PART:0%%"
  - ">" → ends in TEXT mode
  - Insert node marker: "<!--part:1-->"
  
Output: '<div class="%%PART:0%%"><!--part:1--></div>'
```

### Step 2: Create Template Record

```text
Parse HTML → <template>
             └─ <div class="%%PART:0%%">
                └─ <!--part:1-->

Scan for parts:
  - Found attribute marker in class → descriptors[0] = {type: 'attribute', name: 'class', path: [0]}
  - Found comment marker → descriptors[1] = {type: 'node', path: [0, 0]}
  
Cleanup: Remove attribute markers, leave comment as-is
Result template: <div><!--part:1--></div>
```

### Step 3: Instantiate

```typescript
// Clone template
fragment = <div><!--part:1--></div>

// Create parts
const divElement = resolvePath(fragment, [0]);  // the <div>
const markerComment = resolvePath(fragment, [0, 0]);  // the comment

parts[0] = new AttributePart(divElement, 'class');
parts[1] = new NodePart(markerComment, instantiateNested);

// NodePart replaces marker:
<div><!--part-start--><!--part-end--></div>

// Set initial values with reactive effects
effect(() => parts[0].setValue(className()));  // 'active'
effect(() => parts[1].setValue(content()));    // 'Hello'

// Final DOM
<div class="active"><!--part-start-->Hello<!--part-end--></div>
```

### Step 4: Updates

```typescript
className.set('inactive');
// → Effect re-runs → AttributePart.setValue('inactive')
// → div.setAttribute('class', 'inactive')

content.set('Goodbye');
// → Effect re-runs → NodePart.setValue('Goodbye')
// → Updates text node between markers
```

## Advanced Features

### Keyed Lists

When rendering arrays with `.setKey()`:

```typescript
items.map(item => html`<li>${item.name}</li>`.setKey(item.id))
```

NodePart maintains a `Map<key, KeyedChild>` and:

- Reuses existing DOM nodes when keys match
- Moves nodes to new positions without recreating them
- Removes nodes whose keys are no longer present
- Creates new nodes for new keys

### Nested Templates

Templates can contain other templates:

```typescript
const inner = html`<span>Inner</span>`;
const outer = html`<div>${inner}</div>`;
```

When NodePart receives a `TemplateResult`, it:

1. Recursively instantiates it (with the same runtime)
2. Stores the disposal function
3. Inserts the resulting fragment

### Event Handlers

Attribute names starting with `on` are treated as events:

```typescript
html`<button onclick=${handleClick}>Click</button>`
```

The AttributePart:

1. Extracts event name: `click` (removes `on` prefix)
2. Removes previous listener if any
3. Adds new listener if value is a function

### Property Bindings

Attribute names starting with `.` set element properties:

```typescript
html`<input .value=${text}>`
```

This sets `element.value` directly instead of using `setAttribute()`.

## Performance Optimizations

1. **Template Caching**: Template records are created once and reused
2. **Efficient Cloning**: Uses native `cloneNode(true)` for fast DOM duplication
3. **Minimal Parsing**: The HTML parser runs only once per unique template
4. **Path-based Lookup**: Direct navigation to nodes via index arrays
5. **Keyed Reconciliation**: Reuses DOM nodes when rendering lists with keys
6. **Shared TextTemplates**: Multiple parts can share one template for multi-value locations

## Summary

The template system transforms tagged template strings into efficient, updatable DOM through:

1. **Static Analysis**: Parsing the template structure once to identify dynamic locations
2. **Marker Injection**: Inserting placeholders that survive HTML parsing
3. **Descriptor Extraction**: Creating a map of where each value should go
4. **Part Attachment**: Creating specialized objects that know how to update specific DOM locations
5. **Reactive Integration**: Connecting parts to reactive signals for automatic updates

This architecture separates the work into:

- **One-time work** (phases 1-2): Template parsing and analysis, cached per unique template
- **Per-instance work** (phase 3): Cloning and part creation, happens each time the template is used
- **Update work**: Just the part value updates, minimal and targeted

The result is a system that combines the expressiveness of template literals with the performance of incremental DOM updates.
