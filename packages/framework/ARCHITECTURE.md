# Framework Module Dependency Graph

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

```
template.ts (barrel export)
    ├─→ template/html.ts            (HTML parsing)
    ├─→ template/parts.ts           (parts implementation)
    │       ├─→ html.js             (PartDescriptor types)
    │       └─→ ../reactive/runtime.js (SignalsRuntime)
    ├─→ template/instantiate.ts     (template instantiation)
    │       ├─→ html.js
    │       ├─→ parts.js
    │       └─→ ../reactive/runtime.js
    └─→ template/runtime.ts         (html function facade)
            └─→ instantiate.js      (TemplateBinding)
```

**Dependencies:**

- `html.ts`: No dependencies (leaf)
- `parts.ts`: ← `html.ts`, `reactive/runtime.ts`
- `instantiate.ts`: ← `html.ts`, `parts.ts`, `reactive/runtime.ts`
- `runtime.ts`: ← `instantiate.ts`
- `template.ts`: ← `instantiate.ts`, `parts.ts`, `runtime.ts`

---

### Web Components Module (`wc/`)

```
wc.ts (barrel export)
    ├─→ wc/ReactiveElement.ts       (base class)
    │       └─→ ../template/instantiate.js (TemplateBinding)
    ├─→ wc/decorators.ts            (@state, @attr)
    │       ├─→ ../reactive/runtime.js
    │       └─→ ../reactive/signal.js
    └─→ wc/runtime.ts               (state function facade)
            └─→ decorators.js
```

**Dependencies:**

- `ReactiveElement.ts`: ← `template/instantiate.ts`
- `decorators.ts`: ← `reactive/runtime.ts`, `reactive/signal.ts`
- `runtime.ts`: ← `decorators.ts`
- `wc.ts`: ← `ReactiveElement.ts`, `decorators.ts`, `runtime.ts`

---

### Index Module (`index.ts`)

```
index.ts (main entry - re-exports from all modules)
    ├─→ template/instantiate.js
    ├─→ template/parts.js
    ├─→ reactive/signal.js
    ├─→ reactive/runtime.js
    ├─→ wc/ReactiveElement.js
    └─→ wc/decorators.js
```

---

## Complete Dependency Graph

```
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
   ┌────────▼─────────┐ ┌──────▼──────────┐ ┌─────▼────────┐
   │  template/       │ │  template/      │ │  wc/         │
   │  html.ts         │ │  parts.ts       │ │  decorators  │
   └────────┬─────────┘ └──────┬──────────┘ └─────┬────────┘
            │                   │                   │
            └────────┬──────────┘                   │
                     │                              │
            ┌────────▼─────────┐                    │
            │  template/       │                    │
            │  instantiate.ts  │◄───────────────────┘
            └────────┬─────────┘                    │
                     │                              │
        ┌────────────┼────────────┐                 │
        │            │            │                 │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼────────┐  ┌─────▼────────┐
│  template/   │ │  wc/    │ │  wc/      │  │  reactive.ts │
│  runtime.ts  │ │  Reactive│ │  runtime  │  │  (barrel)    │
│  (html)      │ │  Element│ │  (state)  │  └──────────────┘
└──────────────┘ └─────────┘ └───────────┘
        │            │            │
        └────────────┼────────────┘
                     │
            ┌────────▼─────────┐
            │  template.ts     │
            │  (barrel)        │
            └──────────────────┘
                     │
            ┌────────▼─────────┐
            │  wc.ts           │
            │  (barrel)        │
            └──────────────────┘
                     │
            ┌────────▼─────────┐
            │  index.ts        │
            │  (main entry)    │
            └──────────────────┘
```

## Dependency Layers

**Layer 0 (No dependencies):**

- `reactive/signal.ts`
- `template/html.ts`

**Layer 1:**

- `reactive/runtime.ts` (depends on signal.ts)

**Layer 2:**

- `template/parts.ts` (depends on html.ts, reactive/runtime.ts)
- `wc/decorators.ts` (depends on reactive/runtime.ts, reactive/signal.ts)

**Layer 3:**

- `template/instantiate.ts` (depends on html.ts, parts.ts, reactive/runtime.ts)

**Layer 4:**

- `template/runtime.ts` (depends on instantiate.ts)
- `wc/ReactiveElement.ts` (depends on template/instantiate.ts)
- `wc/runtime.ts` (depends on decorators.ts)

**Layer 5 (Barrel exports):**

- `reactive.ts`
- `template.ts`
- `wc.ts`

**Layer 6 (Main entry):**

- `index.ts`

## Cross-Module Dependencies

```
reactive ──────────┐
    │              │
    ▼              ▼
template ───────> wc
```

- `template` depends on `reactive` (for SignalsRuntime)
- `wc` depends on `reactive` (for SignalsRuntime, Signal types)
- `wc` depends on `template` (for TemplateBinding)
- No circular dependencies ✓

## Build Output with `preserveModules: true`

Each source module becomes a separate output file:

```
lib/
├── index.js                    (main entry)
├── reactive.js                 (barrel export)
├── template.js                 (barrel export)
├── wc.js                       (barrel export)
├── reactive/
│   ├── signal.js              (signals implementation)
│   └── runtime.js             (runtime interface + global)
├── template/
│   ├── html.js                (HTML parser)
│   ├── parts.js               (parts implementation)
│   ├── instantiate.js         (TemplateBinding)
│   └── runtime.js             (html facade)
└── wc/
    ├── ReactiveElement.js     (base element)
    ├── decorators.js          (StateDecorator, attr)
    └── runtime.js             (state facade)
```

**Key Points:**

- No code duplication (shared modules imported, not inlined)
- Clean structure mirrors source code
- Predictable paths (no hashed chunk names)
- Minimal coupling (only 3 cross-module dependencies)
