# Native Signals Example (Vite + TypeScript)

This workspace package demonstrates how to consume the `@vanishing/framework` library from a modern Vite toolchain. Everything is written in TypeScript and compiled/bundled by Vite.

## Scripts

```bash
# from repo root
npm install          # installs workspace deps
npm run build -w @vanishing/framework   # build the library once
npm run dev          # launches Vite dev server for the app
npm run build        # builds every workspace (lib + app)
```

The Vite build emits production assets to `packages/native-signals-example/bin`, respecting the "applications → bin" requirement.

## Entry Points

- `index.html` – Vite HTML entry.
- `src/main.ts` – bootstraps the native signals components.
- `src/components/native-counter.ts` – minimal counter card powered by framework signals.
- `src/components/native-list.ts` – task list with add/remove actions rendered via the `html` helper.

Use this package as a playground while iterating on the framework package.
