# Solid Signals Example

This example shows how to consume `@vanishing/framework` while driving updates with Solid's standalone signal core.

## Runtime Adapter

The template system only requires a tiny `PartRuntime` interface. We provide `solidRuntime` in `src/runtime/solid-runtime.ts` by wrapping Solid's `createRoot`/`createEffect`, so every template part re-runs inside Solid's reactive graph.

## Component Highlights

- `SolidSignalsCounter` extends `ReactiveElement` but overrides `partRuntime()` to supply the Solid adapter.
- `SolidSignalsList` showcases Solid signals powering a list with add/remove controls.
- Component state comes from Solid's `createSignal`, and template bindings remain the usual `${() => getter()}` functions.

## Commands

```bash
npm install
npm run dev --workspace=solid-signals-example
npm run build --workspace=solid-signals-example
```
