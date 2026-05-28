# Copilot Instructions for HTML Templating Framework

## Code Style & Architecture

### Separation of Concerns

- Keep utility classes pure with no business logic (e.g., `NodeRange`)
- Business logic belongs in orchestrator classes (e.g., `TemplateInstance`)
- Converter/adapter layers should be thin (e.g., `NodePart`)

### Simplicity Over Cleverness

- Prefer direct solutions over abstractions
- Remove unnecessary helper methods when standard APIs suffice
- Question whether additional layers/wrappers add value
- Example: Use `new NodeRange(start, end).deleteContents()` directly rather than creating a wrapper method

### TypeScript

- Use explicit types for public APIs
- Add non-null assertions (`!`) only when we control the invariants
- Fix all TypeScript errors immediately - don't leave them
- Prefer `readonly` for arrays that shouldn't be modified
- Use `unknown` over `any` for values we'll type-check

**ECMAScript Style (Not TypeScript-Specific Modifiers)**:

- **Avoid** TypeScript accessibility modifiers: `private`, `protected`, `public`
- Use ECMAScript private fields (`#fieldName`) for truly private properties
- Use ECMAScript getters to expose read-only access: `get fieldName() { return this.#fieldName; }`
- Slightly prefer class-based implementations, but always consider functional approaches
- Choose classes for stateful objects with behavior (e.g., `TemplateInstance`, `NodeRange`)
- Choose functions for stateless transformations (e.g., `processValue`, `computeItemsToMove`)

### Naming & Structure

- Use descriptive function/variable names that explain intent
- Private fields: `#fieldName`
- Group related functionality together
- Helper functions before the main functions that use them

## Testing

### Test-Driven Problem Solving

1. Write a failing test that demonstrates the problem
2. Implement the solution
3. Verify all tests pass
4. Refactor if needed while keeping tests green

### Always Verify

- Run tests after every code change
- Check for TypeScript errors with `get_errors` tool
- Don't commit until all tests pass

## Documentation

### Code Comments

- Add JSDoc for all exported functions and classes
- Include `@example` blocks for non-obvious APIs
- Inline comments for complex algorithms (e.g., LIS, reconciliation logic)
- Comment the "why" not the "what" when code is self-explanatory

### Architecture Documentation

- Create markdown docs in `docs/` for complex algorithms
- Include examples, diagrams (ASCII), edge cases
- Document performance characteristics when relevant
- Explain the problem being solved, not just the solution

## Git Workflow

### Commit Messages

Format: `<type>: <short description>`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

**Body should include**:

- Bullet points explaining what changed
- Technical details about implementation
- Performance implications if relevant
- Why the change was made

Example:

```
refactor: remove marker nodes from list items to reduce DOM overhead

- Changed NodeRange to accept any Node as start (not just Comment)
- Added skipMarker parameter to TemplateInstance.create() for list items
- List items now use their first content node as range start
- Updated reconcileKeyedList to create list items with skipMarker=true
- Fixed TypeScript errors by adding non-null assertions

This optimization saves one Comment node per list item while maintaining
the same reconciliation behavior and DOM identity preservation.
```

### When to Commit

- After implementing a complete feature
- After successful refactoring with all tests passing
- Before starting a major architectural change (create a checkpoint)

## Problem-Solving Approach

1. **Understand the problem** - Ask clarifying questions if needed, but generally infer intent
2. **Verify the issue** - Write tests or inspect code to confirm
3. **Implement solution** - Make it work first
4. **Refactor** - Clean up the implementation
5. **Document** - Add comments/docs for complex parts
6. **Test** - Ensure everything still works

## Preferences

### Tool Usage

- Use parallel tool calls when operations are independent
- Combine multiple file edits with `multi_replace_string_in_file`
- Don't announce which tools you're using - just use them
- Skip asking permission before using tools - act decisively

### Communication

- Be concise but complete
- Provide technical details when relevant
- Skip unnecessary pleasantries - get to the point
- Use markdown links for file references: `[file.ts](file.ts#L10)`

### File Operations

- Only create files that are essential
- Don't create summary markdown files unless explicitly requested
- When creating documentation, make it comprehensive with examples

## Markdown Formatting

Ensure all markdown files are **markdownlint compliant**:

- Empty line after every heading
- Empty line before and after code blocks
- Empty line before and after lists
- No trailing whitespace
- Single blank line at end of file

### Code Blocks

Use fenced code blocks with language identifiers for syntax highlighting:

````markdown
```typescript
const example = "highlighted";
```
````

Common language identifiers:

- `typescript`, `javascript`, `ts`, `js` - Code
- `json` - Configuration files
- `bash`, `shell` - Terminal commands
- `html`, `css` - Markup and styles
- `text` - Plain text, diagrams, or output without highlighting
- `markdown`, `md` - Markdown examples

### When to Use `text`

Use `` ```text `` for:

- ASCII diagrams or flowcharts
- Generic output or logs
- Content that shouldn't be syntax-highlighted
- Dependency chains: `framework → components → app`

### Inline Code

Use backticks for:

- File names: \`package.json\`
- Function/variable names: \`setRuntime()\`
- CLI commands inline: \`npm run dev\`
- Short code snippets: \`const x = 1\`

## Project-Specific Patterns

### Template System

- Templates are immutable and cached by template strings
- Template instances are stateful (have ranges, children, effects)
- List reconciliation uses LIS algorithm to minimize DOM mutations
- Keyed items use `html(key)\`...\`` syntax

### Performance

- Minimize DOM mutations - only move items that actually changed
- Reuse instances by key where possible
- Avoid creating unnecessary marker nodes
- Track ranges efficiently using start/end nodes

### Testing

- Tests use mock runtime with `effect: (fn) => { fn(); return () => {}; }`
- Track DOM mutations by spying on methods like `extractContent`
- Verify DOM identity preservation for reconciliation tests
- Use data attributes (`data-id`) to identify elements in tests

---

## Branches & Commits

### Branch names

Pattern: **`<type>/<short-slug>`** — kebab-case, ≤ 50 chars, no author prefix.

```text
feat/keyed-list-reconciliation
fix/template-cache-leak
docs/reactive-architecture
```

### Commit messages

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): **`<type>(<scope>): <subject>`** — imperative, ≤ 72
chars, no period.

```text
feat(template): cache template instances by literal
fix(wc): release effect disposer on disconnect
refactor(runtime): extract NodeRange helper
```

### Allowed types

`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.

### Allowed scopes

`framework`, `wc`, `runtime`, `template`, `reactive`, `demo`, `apps`, `docs`, `infra`, `ci`.

Omit the scope when the change genuinely spans many; never invent a new scope ad-hoc — add it to this list first in a separate
commit.

### Anti-examples

```text
feature/AddSearchBar              # wrong type word, PascalCase slug
fix-1234                          # missing type prefix
Fixed bug in renderer             # not imperative, no type/scope
feat: add stuff                   # vague subject
chore(misc): cleanup              # invented scope
```

### Agent-specific rules

- **Propose the branch name and commit message in the plan before executing.**
- **Use the scope that matches the files you changed.** If the change spans multiple scopes, split into multiple commits or omit the
  scope.

---

## Tooling

### Formatting — dprint

`dprint` owns formatting for TS, JS, JSON, YAML, Markdown. Config lives at [dprint.json](dprint.json). Run `npm run format` to
auto-format and `npm run format:check` in CI.

### Linting — fix-by-default

Two linters run in lockstep:

- **ESLint** ([eslint.config.ts](eslint.config.ts)) — TS/JS correctness and conventions.
- **markdownlint-cli2** ([.markdownlint-cli2.jsonc](.markdownlint-cli2.jsonc)) — semantic markdown rules (duplicate headings, list
  prefix continuity, etc.). Pure formatting (line length, list marker style, blank lines) is disabled here because dprint owns it.

Scripts follow the same fix-by-default / explicit-check pattern as `format`:

| Script                                   | Behavior                                          |
| ---------------------------------------- | ------------------------------------------------- |
| `npm run lint` (= `lint:js` + `lint:md`) | Auto-fix everything fixable; report what remains  |
| `npm run lint:check` (CI)                | No fixing; ESLint adds `--max-warnings=0`; strict |
| `npm run lint:js` / `lint:js:check`      | ESLint only — fix or check                        |
| `npm run lint:md` / `lint:md:check`      | markdownlint only — fix or check                  |

ESLint severity model — correctness rules from `typescript-eslint`'s `recommended` and `recommendedTypeChecked` presets stay as
`error` (red in editor); repo-specific style/convention nudges (imports, type-imports, unused-vars) are declared as `warn` (yellow
in editor). ESLint is not part of the build chain, so `error` severity never blocks `npm run build` or `npm run dev`.

- Typed rules (`recommendedTypeChecked`) are scoped to `**/src/**/*.ts` only — config files and specs get the untyped rule set.
- `import-x/extensions` enforces `.js` extension on relative imports (required for ESM).
- `import-x/order` enforces external → internal → type grouping with blank-line separators.
- `consistent-type-imports` auto-splits type imports into separate `import type` statements.

### Build — Vite 8 / Rolldown

All packages and apps use **Vite 8**, which ships with **Rolldown** (Rust bundler) instead of Rollup. Notes:

- Build target is **ES2024** everywhere. The old `esbuild: { target: 'es2022', keepNames: true }` workaround for the TC39 `accessor`
  keyword is no longer needed — Rolldown parses it natively.
- Library configs use `rolldownOptions` (not `rollupOptions`).
- External deps are filtered with a function: `(id) => !(id.startsWith(".") || id.startsWith("~") || path.isAbsolute(id))`. Reads as
  "external unless relative, aliased, or absolute" — cross-platform (handles Windows drive letters).
- `dts({ rollupTypes: false })` — do not roll declarations into one file. Per-file `.d.ts` avoids name collisions on globals
  (`Disposable`, `MessageChannel`, etc.).
- `vite-plugin-checker` runs `tsc --noEmit` during `vite build --watch` (`enableBuild: false` keeps prod builds fast).

### Path alias — `~/`

Every package configures `~/` to resolve to its own `src/`:

- `vite.config.ts`: `resolve: { alias: { "~": path.resolve(dirname, "src") } }`
- `tsconfig.json`: `"paths": { "~/*": ["./src/*"] }`

Prefer `~/Foo.js` over `../../Foo.js` for cross-directory imports inside a package.

### Script naming — `{verb}:{category}:{name}`

Root [package.json](package.json) scripts follow this pattern:

| Category | Purpose                        |
| -------- | ------------------------------ |
| `lib`    | Buildable libraries            |
| `app`    | Runnable apps (vite dev/build) |

Aggregates: `build:lib`, `build:app`, `build`. Each is implemented with `npm-run-all2` (`run-s` for sequential, `run-p` for
parallel) instead of `&&` / `concurrently` / `wait-on`.
