//
// ESLint flat config — uniform `warn` severity.
//
// Workflow:
//   * Editor + `npm run lint`        → warnings only, never blocks dev work.
//   * `npm run lint:check` (CI)       → adds `--max-warnings=0`, every warning
//                                    becomes a build failure.
//
// Rule severity is therefore a single bit at the *script* level, not a
// per-rule choice in this file. To keep that invariant, we downgrade every
// `error` from upstream presets (typescript-eslint recommended +
// recommended-type-checked) to `warn` via the `toWarn` helper below.
//
// Pure formatting rules (quotes, semicolons, trailing commas, indent,
// line breaks) are NOT declared here — dprint owns formatting via
// dprint.json + the TypeScript plugin.
//
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import importX from "eslint-plugin-import-x";

import type { Linter } from "eslint";

type RuleSetting = Linter.RuleEntry;

/** Downgrade an ESLint rule severity (`error` / `2`) to `warn`; leave `off` alone. */
function downgradeSeverity(setting: RuleSetting): RuleSetting {
  const severity = Array.isArray(setting) ? setting[0] : setting;
  if (severity === "off" || severity === 0) {
    return setting;
  }
  return Array.isArray(setting) ? ["warn", ...setting.slice(1)] : "warn";
}

/** Map every rule in a flat-config block to `warn` severity. */
function toWarn(block: Linter.Config): Linter.Config {
  if (!block.rules) {
    return block;
  }
  const downgraded = Object.fromEntries(
    Object.entries(block.rules).map(([name, setting]) => [name, downgradeSeverity(setting as RuleSetting)]),
  );
  return { ...block, rules: downgraded };
}

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
  ...tseslint.configs.recommended.map(toWarn),
  // Typed rule set — only for package source files.
  ...tseslint.configs.recommendedTypeChecked.map((block) => toWarn(scope(TYPED_FILES, block))),
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
  // Repo-specific overrides.
  {
    rules: {
      // ── Imports ────────────────────────────────────────────────────
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],

      // ── Language idioms ────────────────────────────────────────────
      "prefer-template": "warn",
      "object-shorthand": "warn",

      // ── Correctness ────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
