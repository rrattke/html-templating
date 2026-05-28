//
// ESLint flat config.
//
// Severity model — natural two-tier:
//
//   * `error` (red in editor)   — correctness bugs from upstream presets
//                                 (typescript-eslint recommended +
//                                 recommendedTypeChecked). These are
//                                 things you almost certainly want to fix
//                                 before merging.
//   * `warn`  (yellow in editor) — style nudges and repo conventions
//                                 declared in the overrides block below.
//
// ESLint is NOT part of the build chain (Vite/Rolldown don't invoke it),
// so `error` severity never blocks `npm run build` or `npm run dev`.
//
// Workflow:
//   * Editor          → red squiggles for errors, yellow for warnings,
//                       exactly as the preset authors intended.
//   * `npm run lint`  → reports both; exit code reflects errors only,
//                       so it doesn't block local iteration on warnings.
//   * `npm run lint:check` (CI) → adds `--max-warnings=0`; both errors
//                                 and warnings fail the build.
//
// Pure formatting rules (quotes, semicolons, trailing commas, indent,
// line breaks) are NOT declared here — dprint owns formatting via
// dprint.json + the TypeScript plugin.
//
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import importX from "eslint-plugin-import-x";

import type { Linter } from "eslint";

/** Scope a config block to the given file globs. */
function scope(files: string[], block: Linter.Config): Linter.Config {
  return { ...block, files };
}

// Source files that are part of a package tsconfig — these get the
// type-checked rule set.
const TYPED_FILES = ["**/src/**/*.ts", "**/src/**/*.tsx"];
const TYPED_FILE_EXCLUDES = ["**/*.spec.ts", "**/*.bench.ts", "**/*.test.ts"];

export default defineConfig(
  // Ignore generated and installed code only.
  {
    ignores: [
      "**/lib/**",
      "**/bin/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/coverage/**",
    ],
  },
  // Untyped rule set — applies to every .ts file (including configs and specs).
  ...tseslint.configs.recommended,
  // Typed rule set — only for package source files.
  ...tseslint.configs.recommendedTypeChecked.map((block) => scope(TYPED_FILES, block)),
  {
    files: TYPED_FILES,
    ignores: TYPED_FILE_EXCLUDES,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Specs live alongside source but are excluded from tsconfigs. Disable
  // typed rules there so they don't trip the parser.
  {
    files: TYPED_FILE_EXCLUDES,
    ...tseslint.configs.disableTypeChecked,
  },
  // Import hygiene — relative imports must end in `.js`, type-only imports
  // grouped above value imports, and groups separated by a blank line.
  // These are repo conventions, not correctness — keep as `warn`.
  {
    plugins: { "import-x": importX },
    rules: {
      "import-x/extensions": [
        "warn",
        "ignorePackages",
        {
          ts: "never",
          tsx: "never",
          js: "always",
          jsx: "always",
          mjs: "always",
        },
      ],
      "import-x/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
            "type",
          ],
          "newlines-between": "always",
        },
      ],
      "import-x/no-duplicates": "warn",
    },
  },
  // Repo-specific overrides — style/convention nudges as `warn`.
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "prefer-template": "warn",
      "object-shorthand": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
