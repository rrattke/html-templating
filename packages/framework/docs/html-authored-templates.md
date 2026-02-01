# HTML-Authored Templates (Initial Thoughts)

This document explores a more "HTML-authored" alternative for Scenario 1 (lists from arrays), inspired by frameworks like Aurelia.

It is intentionally a design sketch: a mental model, authoring syntax options, and an incremental implementation path that fits this framework’s existing template/parts/reconciliation model.

---

## Goal

Let application templates look like HTML documents (or fragments) while still supporting:

- lists (`repeat`)
- basic bindings (text, attributes, properties)
- keyed reconciliation (stable DOM identity)
- rendering into light DOM (no custom element required)

---

## Mental model

- Author writes a `<template>` in HTML.
- A runtime `mount()` function instantiates it into the DOM.
- Declarative directives inside the template describe how data flows into the DOM.

This is similar to the platform’s own model:

- `<template>` is inert HTML.
- Your runtime “activates” it by cloning + binding.

---

## The key question: "what is an expression?"

To stay safe and predictable, the first version should avoid `eval`/`new Function`.

A good v1 expression model:

- **property paths only**: `user.name`, `signal.color`, `item.id`
- plus a few reserved locals: `$index`, `$key`

Later (optional): add filters/pipes or small operators, but keep it explicit.

---

## Authoring syntax options

You can implement any of these; they differ mainly in how much parsing you want.

### Option A: Aurelia-like attributes (closest to your mental model)

```html
<template id="todo-view">
  <ul>
    <li repeat.for="todo of todos" key.bind="todo.id">
      <span text.bind="todo.title"></span>
      <button @click="remove(todo.id)">Delete</button>
    </li>
  </ul>
</template>
```

Notes:

- `repeat.for` introduces a local (`todo`).
- `text.bind` sets `textContent`.
- `key.bind` supplies the key for reconciliation.
- Events are tricky if you don’t want to evaluate arbitrary expressions; see below.

### Option B: Mustache interpolation (very HTML-ish)

```html
<template id="todo-view">
  <ul>
    <li data-repeat="todo of todos" data-key="todo.id">
      {{todo.title}}
    </li>
  </ul>
</template>
```

This requires parsing text nodes and attribute values for `{{...}}` markers.

### Option C: Minimal "binding attributes" only

```html
<template id="todo-view">
  <ul>
    <li data-repeat="todos" data-key="id">
      <span data-text="title"></span>
    </li>
  </ul>
</template>
```

This is less expressive but much easier to implement without a full expression language.

---

## How list rendering would work

### What the author writes

```html
<template id="signals">
  <x-plot>
    <x-signal repeat.for="s of signals" key.bind="s.id" src.bind="s.src" color.bind="s.color"></x-signal>
  </x-plot>
</template>
```

### What the runtime *does*

Conceptually, it compiles that template into something equivalent to:

```ts
html`<x-plot>
  ${repeat(
    () => signals,
    s => s.id,
    s => html`<x-signal src=${s.src} color=${s.color}></x-signal>`,
  )}
</x-plot>`
```

So you still reuse the existing reconciliation engine; you’re just moving control-flow out of the user’s JS.

---

## Events: keep them declarative without arbitrary eval

Events are the hardest part of "HTML-authored" templating because `@click="remove(todo.id)"` implies a general expression evaluator.

Safer v1 options:

1. **Method by name + argument paths**

```html
<button on.click="remove" args="todo.id">Delete</button>
```

Runtime looks up `ctx.remove` and calls it with the resolved argument.

2. **Custom events only** (the component emits, the app listens outside)

For many UI elements, you can avoid binding event handlers in the template entirely.

3. **Allow a constrained expression model**

Support only `fnName(argPath)` where `fnName` must exist on the context and `argPath` must be a property path.

---

## How this fits the current framework architecture

A plausible implementation has two layers:

1. **Compiler (DOM → instruction tree)**
   - reads a `HTMLTemplateElement`
   - finds `repeat.for`, `text.bind`, `attr.bind` markers
   - produces a compact instruction tree

2. **Runtime (instruction tree + context → DOM updates)**
   - clones the fragment
   - sets up NodeRanges for dynamic regions
   - uses the existing `repeat()` + keyed reconciliation for lists

The important point: the list diffing and DOM movement logic stays where it is today (Layer 3).

---

## Incremental implementation plan (recommended)

1. **Static only**: `mountStatic(templateEl, data)` for `data-text`, `data-attr-*` (no reactivity).
2. **Repeat only**: `data-repeat` + `data-key` that drives the existing `repeat()` and updates on explicit `update()` calls.
3. **Reactive**: integrate with `SignalsRuntime.effect` so bindings update when signals change.
4. **Events**: add a safe event wiring story (method name + arg paths).

This lets you prove the authoring model quickly before committing to a full expression language.

---

## Tradeoffs

- Pros:
  - templates look like HTML fragments
  - works well with "document as model" workflows and visual editors
  - keeps list reconciliation and DOM identity semantics

- Cons:
  - you’re building (and documenting) a binding language
  - event binding and expression evaluation need careful design
  - debugging moves from TypeScript into template authoring
