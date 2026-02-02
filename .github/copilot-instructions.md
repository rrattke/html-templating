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

Use ` ```text ` for:

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
