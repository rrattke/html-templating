# Module Architecture

This document describes the module dependency graph and build structure for the framework.

---

## Entry Points (Public API)

```
┌─────────────────────────────────────────────────────────────┐
│                       Entry Points                          │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  index.ts   │ reactive.ts │ template.ts │     wc.ts         │
└─────────────┴─────────────┴─────────────┴───────────────────┘
      │             │              │                │
      ▼             ▼              ▼                ▼
```

---

## Core Module Structure

### Reactive Module (`reactive/`)

```
reactive.ts (barrel export)
    ├─→ reactive/signal.ts          (core signals implementation)
    └─→ reactive/runtime.ts         (runtime interface + global runtime)
            └─→ signal.ts           (Signal, Memo types)
```

**Dependencies:**

- `signal.ts`: No dependencies (leaf)
- `runtime.ts`: ← `signal.ts`
- `reactive.ts`: ← `signal.ts`, `runtime.ts`

---

### Template Module (`template/`)

The template module follows a three-layer architecture:

```text
template.ts (barrel export)
    │
    ├─→ template/dom.ts             (Layer 0: DOM utilities: NodeRange, path helpers)
    │
    ├─→ template/template.ts        (Layer 1: Template class + parsing + caching)
    │       └─→ dom.js
    │
    ├─→ template/parts.ts           (Layer 2: Part implementations + createParts)
    │       ├─→ dom.js
    │       └─→ template.js
    │
    ├─→ template/render.ts          (Layer 3: Instance management + reconciliation)
    │       ├─→ dom.js
    │       ├─→ template.js
    │       ├─→ parts.js
    │       └─→ ../runtime.js
    │
    └─→ template/runtime.ts         (html function facade)
            └─→ render.js
```

**Dependencies:**

- `dom.ts`: No dependencies (leaf)
- `template.ts`: ← `dom.ts`
- `parts.ts`: ← `dom.ts`, `template.ts`
- `render.ts`: ← `dom.ts`, `template.ts`, `parts.ts`, `runtime.ts`
- `runtime.ts`: ← `render.ts`

---

### Web Components Module (`wc/`)

```text
wc.ts (barrel export)
    ├─→ wc/ReactiveElement.ts       (base class)
    │       └─→ ../template/render.js (DynamicBinding)
    ├─→ wc/decorators.ts            (@state, @attr)
    │       ├─→ ../reactive/runtime.js
    │       └─→ ../reactive/signal.js
    └─→ wc/runtime.ts               (state function facade)
            └─→ decorators.js
```

**Dependencies:**

- `ReactiveElement.ts`: ← `template/render.ts`
- `decorators.ts`: ← `reactive/runtime.ts`, `reactive/signal.ts`
- `runtime.ts`: ← `decorators.ts`
- `wc.ts`: ← `ReactiveElement.ts`, `decorators.ts`, `runtime.ts`

---

### Index Module (`index.ts`)

```text
index.ts (main entry - re-exports from all modules)
    ├─→ template/render.js
    ├─→ template/parts.js
    ├─→ reactive/signal.js
    ├─→ reactive/runtime.js
    ├─→ wc/ReactiveElement.js
    └─→ wc/decorators.js
```

---

## Complete Dependency Graph

```text
                       ┌──────────────────┐
                       │  reactive/       │
                       │  signal.ts       │ (leaf - no deps)
                       └────────┬─────────┘
                                │
                       ┌────────▼─────────┐
                       │  reactive/       │
                       │  runtime.ts      │
                       └────────┬─────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
   ┌────────▼─────────┐        │           ┌───────▼────────┐
   │  template/       │        │           │  wc/           │
   │  dom.ts          │ (leaf) │           │  decorators.ts │
   └────────┬─────────┘        │           └───────┬────────┘
            │                  │                   │
   ┌────────▼─────────┐        │                   │
   │  template/       │        │                   │
   │  template.ts     │        │                   │
   └────────┬─────────┘        │                   │
            │                  │                   │
   ┌────────▼─────────┐        │                   │
   │  template/       │        │                   │
   │  parts.ts        │        │                   │
   └────────┬─────────┘        │                   │
            │                  │                   │
   ┌────────▼─────────┐◄───────┘                   │
   │  template/       │                            │
   │  render.ts       │◄───────────────────────────┘
   └────────┬─────────┘                            │
            │                                      │
   ┌────────▼─────────┐               ┌────────────▼─────────┐
   │  template/       │               │  wc/                 │
   │  runtime.ts      │               │  ReactiveElement.ts  │
   └────────┬─────────┘               └──────────┬───────────┘
            │                                    │
            └──────────────┬─────────────────────┘
                           │
                  ┌────────▼─────────┐
                  │  template.ts     │
                  │  (barrel)        │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  wc.ts           │
                  │  (barrel)        │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  index.ts        │
                  │  (main entry)    │
                  └──────────────────┘
```

---

## Template Module Layers

The template module is organized into three conceptual layers:

| Layer | Module        | Responsibility                                               |
| ----- | ------------- | ------------------------------------------------------------ |
| 0     | `dom.ts`      | DOM utilities: `NodeRange`, `buildPath()`, `resolvePath()`   |
| 1     | `template.ts` | HTML parsing, `Template` class, compile + cache + clone      |
| 2     | `parts.ts`    | Part implementations + `createParts()` factory               |
| 3     | `render.ts`   | `StaticBinding`, `DynamicBinding`, `TemplateInstance`, `Reconciler` |

---

## Dependency Layers

**Layer 0 (No dependencies):**

- `reactive/signal.ts`
- `template/dom.ts`

**Layer 1:**

- `reactive/runtime.ts` (depends on signal.ts)
- `template/template.ts` (depends on dom.ts)

**Layer 2:**

- `template/parts.ts` (depends on dom.ts, template.ts)
- `wc/decorators.ts` (depends on reactive/runtime.ts, reactive/signal.ts)

**Layer 3:**

- `template/render.ts` (depends on dom.ts, template.ts, parts.ts, runtime.ts)

**Layer 5:**

- `template/runtime.ts` (depends on render.ts)
- `wc/ReactiveElement.ts` (depends on template/render.ts)
- `wc/runtime.ts` (depends on decorators.ts)

**Layer 6 (Barrel exports):**

- `reactive.ts`
- `template.ts`
- `wc.ts`

**Layer 7 (Main entry):**

- `index.ts`

---

## Cross-Module Dependencies

```
reactive ──────────┐
    │              │
    ▼              ▼
template ───────> wc
```

- `template` depends on `reactive` (for SignalsRuntime)
- `wc` depends on `reactive` (for SignalsRuntime, Signal types)
- `wc` depends on `template` (for DynamicBinding)
- No circular dependencies ✓

---

## Build Output

With `preserveModules: true`, each source module becomes a separate output file:

```text
lib/
├── index.js                    (main entry)
├── reactive.js                 (barrel export)
├── template.js                 (barrel export)
├── wc.js                       (barrel export)
├── reactive/
│   ├── signal.js               (signals implementation)
│   └── runtime.js              (runtime interface + global)
├── template/
│   ├── dom.js                  (DOM utilities)
│   ├── template.js             (Template class + HTML parsing)
│   ├── parts.js                (Part implementations + createParts)
│   ├── render.js               (StaticBinding, DynamicBinding, TemplateInstance, Reconciler)
│   └── runtime.js              (html facade)
└── wc/
    ├── ReactiveElement.js      (base element)
    ├── decorators.js           (StateDecorator, attr)
    └── runtime.js              (state facade)
```

**Key Points:**

- No code duplication (shared modules imported, not inlined)
- Clean structure mirrors source code
- Predictable paths (no hashed chunk names)
- Minimal coupling (only 3 cross-module dependencies)

---

*This document reflects the current module structure after the three-layer architecture refactoring.*
