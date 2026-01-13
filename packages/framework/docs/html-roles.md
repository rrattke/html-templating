# html.ts Roles and Responsibilities

This document focuses only on the types and helpers declared in `src/template/html.ts`, leaving `templating.md` as the higher-level authoring guide.

## Surface API

- **`html(strings, ...values): TemplateResult`** — Tagged template entry point that packages the static `strings` array and the dynamic `values` into a `TemplateResult` instance.
- **`TemplateResult` / `TemplateResultImpl`** — Immutable pairing of `strings` (static chunks), `values` (dynamic expressions), and an optional `key` used for keyed list reconciliation. The `setKey()` helper mutates the instance to attach a stable identity.
- **`TemplateRecord`** — Parsed, cached representation of a template: the compiled `HTMLTemplateElement`, its `descriptors` (dynamic hole locations), and a cheap `clone()` method that returns a fresh `DocumentFragment` copy.
- **`getTemplateRecord(strings)`** — Retrieves or creates a `TemplateRecord` keyed by the unique `TemplateStringsArray` identity, guaranteeing parsing happens only once per template definition.

## Marker Construction

- **`buildHTML(strings)`** — Concatenates static chunks while inserting synthetic markers where expressions appear.
  - Node position → comment marker: `<!--part:N-->`
  - Attribute position → quoted marker: `"%%PART:N%%"`
- **`isAttributePosition(chunk)`** — Heuristic that detects whether the current expression sits in an attribute value context (looks for trailing `=` before the hole).
- **`nodeMarkerForIndex` / `attributeMarkerForIndex`** — Generate the marker strings for node and attribute expressions.

## Parsing and Descriptor Extraction

- **`createTemplateRecord(strings)`** — Core parser pipeline: create `<template>`, set `innerHTML` to the marker-filled string, allocate descriptor slots, and call `scanTemplateContent()` to populate them.
- **`scanTemplateContent(fragment, descriptors)`** — Walks the template content with `TreeWalker`, detecting markers in two passes:
  - **Node markers** — `extractNodePart()` records a `NodePartDescriptor { type: 'node', path }` when encountering a matching comment.
  - **Attribute markers** — `extractAttributeParts()` records an `AttributePartDescriptor { type: 'attribute', name, path }` for attributes whose values exactly match the marker pattern.
- **`buildPath(node, root)`** — Encodes a node’s location as an array of child indices from the fragment root; stored in descriptors so clones can be resolved quickly.
- **`resolvePath(root, path)`** — Replays the stored indices against a cloned fragment to find the node or element that a descriptor points to.

## Caching Strategy

- **`templateCache: WeakMap<TemplateStringsArray, TemplateRecord>`** — Relies on the JS guarantee that each tagged template literal shares the same `TemplateStringsArray` object identity. Templates are parsed once and reused; the GC can collect cache entries when the originating module becomes unreachable.

## Why this separation exists

- Authoring uses only `html` and receives a `TemplateResult`.
- Instantiation (in `instantiate.ts`) consumes the `TemplateRecord` plus descriptor paths to create concrete `NodePart` / `AttributePart` instances.
- Marker generation and descriptor extraction remain co-located in `html.ts`, so the parsing rules are centralized and isolated from rendering concerns.
