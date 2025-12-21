# Web Components with the Vanishing Framework

This example demonstrates how to consume the `@vanishing/framework` package that lives in the sibling workspace. The framework combines:

- HTML-first templating (`html` tagged template literal + Parts)
- Solid-style signals (`createSignal`, `createEffect`)
- A lightweight `ReactiveElement` base class for Web Components

Together they deliver a "vanishing" runtime: templates are parsed once, signals update individual DOM nodes directly, and no diffing or re-rendering occurs.

## How to Run

From the repository root run:

```bash
npm install
npm start
```

The workspace root wires `npm start` to this package via `live-server`, so you will see `packages/example-app/index.html` in the browser with hot reloads.

## How It Works

- `my-component.js` defines a `<demo-counter>` element that extends `ReactiveElement`.
- The component creates a signal with `createSignal(0)` and renders a template using `html`.
- The button's `onclick` attribute and the counter text are bound directly to signal-driven functions, so updates happen without re-rendering.

Use this package as a sandbox for experimenting with new features from the framework package.
