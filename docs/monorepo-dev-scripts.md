# Monorepo Dev & Start Scripts

This document describes the solution for coordinating development and production scripts across npm workspaces with dependencies
between packages.

## Problem

In a monorepo with dependent packages:

```text
framework → components → app
```

Running `vite dev` in an app that imports from library packages fails because:

1. Libraries need to be built first (Vite dev server doesn't transpile workspace dependencies)
2. TypeScript declarations (`.d.ts` files) must exist for type checking
3. When developing, all packages need to rebuild on changes

## Solution Overview

Use a combination of:

- **`vite build --watch`** for library packages (continuous transpilation)
- **`wait-on`** to block dependent builds until prerequisites are ready
- **`concurrently`** to run all watchers in parallel with labeled output

## Package Structure

### Root package.json

```json
{
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "build:packages": "npm run build --workspace=<framework> && npm run build --workspace=<components>",

    "dev:fw": "npm run dev --workspace=<framework>",
    "dev:components": "wait-on packages/<framework>/lib/index.d.ts && npm run dev --workspace=<components>",
    "dev:packages": "concurrently -n fw,comp -c blue,green \"npm run dev:fw\" \"npm run dev:components\"",

    "dev:app": "wait-on packages/<components>/lib/index.d.ts && npm run dev --workspace=<app>",
    "dev": "concurrently -n fw,comp,app -c blue,green,yellow \"npm run dev:fw\" \"npm run dev:components\" \"npm run dev:app\"",

    "start": "npm run build:packages && npm run start --workspace=<app>",
    "start:app": "npm run build:packages && npm run start --workspace=<app>"
  },
  "devDependencies": {
    "concurrently": "^9.0.1",
    "wait-on": "^8.0.0"
  }
}
```

### Library Package (framework, components)

```json
{
  "name": "<package-name>",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "devDependencies": {
    "vite": "^5.4.21",
    "vite-plugin-dts": "^4.5.4"
  }
}
```

### App Package

```json
{
  "name": "<app-name>",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "vite build && vite preview"
  },
  "dependencies": {
    "<framework>": "*",
    "<components>": "*"
  }
}
```

## Vite Configuration for Libraries

Libraries must output to a `lib/` directory with TypeScript declarations:

```typescript
// packages/<library>/vite.config.ts
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(dirname, "src/index.ts"),
        // Add additional entry points as needed
        utils: path.resolve(dirname, "src/utils.ts"),
      },
      formats: ["es"],
    },
    outDir: "lib",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [
    dts({
      tsconfigPath: path.resolve(dirname, "tsconfig.json"),
      outDir: "lib",
      insertTypesEntry: true,
      exclude: ["**/*.spec.ts", "**/*.test.ts"],
      rollupTypes: false,
    }),
  ],
});
```

## Package Exports

Libraries should use the `exports` field for subpath imports:

```json
{
  "name": "<package-name>",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": {
    ".": {
      "import": "./lib/index.js",
      "types": "./lib/index.d.ts"
    },
    "./utils": {
      "import": "./lib/utils.js",
      "types": "./lib/utils.d.ts"
    }
  },
  "files": ["lib"]
}
```

## How It Works

### Development Mode (`npm run dev`)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        concurrently                             │
├─────────────────┬─────────────────────┬─────────────────────────┤
│   [fw] blue     │   [comp] green      │      [app] yellow       │
│                 │                     │                         │
│  vite build     │  wait-on            │  wait-on                │
│  --watch        │  <framework>/lib/*.d.ts│  <components>/lib/*.d.ts │
│                 │       ↓             │         ↓               │
│  Rebuilds on    │  vite build         │  vite (dev server)      │
│  file changes   │  --watch            │                         │
│                 │                     │  HMR enabled            │
│  Outputs to     │  Rebuilds on        │  Hot reloads on         │
│  lib/*.js       │  file changes       │  dependency changes     │
│  lib/*.d.ts     │                     │                         │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

1. **Framework** starts building immediately with `--watch`
2. **Components** waits for `packages/<framework>/lib/index.d.ts` (or any key `.d.ts` file)
3. **App** waits for `packages/<components>/lib/index.d.ts`
4. All three run concurrently after initial startup
5. Changes propagate: framework → components → app (via Vite's file watching)

### Production Mode (`npm run start`)

1. Build all packages sequentially (respecting dependencies)
2. Build the app
3. Start preview server

## Key Dependencies

```json
{
  "devDependencies": {
    "concurrently": "^9.0.1",
    "wait-on": "^8.0.0",
    "vite": "^5.4.21",
    "vite-plugin-dts": "^4.5.4"
  }
}
```

## Script Naming Convention

| Script    | Purpose                                            |
| --------- | -------------------------------------------------- |
| `dev`     | Development with HMR, file watching, fast rebuilds |
| `start`   | Production build + preview server                  |
| `build`   | One-time production build                          |
| `dev:*`   | Individual package dev scripts                     |
| `start:*` | Individual app start scripts                       |

## Wait-on File Selection

Choose a `.d.ts` file that:

1. Is generated late in the build (indicates completion)
2. Is imported by dependent packages
3. Exists in a predictable location

Examples:

```bash
# Wait for main export
wait-on packages/<library>/lib/index.d.ts

# Wait for specific subpath export
wait-on packages/<library>/lib/utils.d.ts

# Wait for multiple files
wait-on packages/<library>/lib/index.d.ts packages/<library>/lib/utils.d.ts
```

## Troubleshooting

### TypeScript errors on first run

During initial startup, you may see transient TypeScript errors in the console:

```
Cannot find module '<package>' or its corresponding type declarations.
```

These are expected race conditions—the errors resolve once all packages finish their first build.

### HMR not triggering

Ensure the app's Vite config doesn't cache dependencies. Add problematic packages to `optimizeDeps.exclude`:

```typescript
// apps/<app>/vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ["<framework>", "<components>"],
  },
});
```

### Build order issues

If builds fail due to missing dependencies, check:

1. `wait-on` is waiting for the correct file
2. The file path is relative to the monorepo root
3. The `.d.ts` files are being generated (check `vite-plugin-dts` config)
