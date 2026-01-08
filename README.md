# HTML Templating Framework

An experimental web framework exploring the intersection of emerging web standards for signals and template parts.

## Background

The modern web platform has a significant gap when it comes to reactive templating and state management. While frameworks like React, Vue, and Solid have demonstrated the value of reactive primitives and efficient DOM updates, these capabilities haven't been available as native web standards—until now.

### The Standards Gap

Currently, web developers face two key challenges:

1. **Templating**: While the platform provides basic templating through `<template>` elements, there's no standard way to efficiently update parts of instantiated templates when data changes.

2. **Reactivity/Signals**: There's no native way to create reactive state that automatically triggers UI updates when values change. This has led to countless framework-specific implementations.

### Emerging Standards

This project is inspired by and aligned with emerging web standards that aim to close these gaps:

- **[DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)**: A proposal for efficiently marking and updating specific parts of the DOM tree, enabling frameworks to surgically update only the parts that need to change.

- **[Signals Standard](https://github.com/proposal-signals/proposal-signals)**: A TC39 proposal bringing reactive primitives to JavaScript, providing a standard way to create observable values that notify when they change.

These standards promise to enable lightweight, framework-less reactive applications with near-native performance.

## Project Goals

This experimental framework aims to:

- Explore practical implementations of the emerging signals and DOM parts standards
- Provide a lightweight reactive templating solution inspired by these standards
- Demonstrate how these primitives can work together for efficient UI updates
- Experiment with ergonomic APIs for developers

## Inspiration

The implementation draws inspiration from:

- **Emerging Web Standards**: DOM Parts and TC39 Signals proposals
- **[Arrow-js](https://www.arrow-js.com/)**: A lightweight reactive framework that demonstrates elegant reactive templating patterns

## Project Structure

- `packages/framework/`: Core templating and reactive framework
  - `src/template/`: Template instantiation and DOM parts implementation
  - `src/reactive/`: Signal-based reactivity system
  - `src/wc/`: Web Components integration
- `apps/native-signals-example/`: Example using native signals (when available)
- `apps/solid-signals-example/`: Example using Solid.js signals

## Getting Started

### Prerequisites

- Node.js 24 or later
- npm 10 or later

### Installation

1. Clone the repository
2. Install dependencies from the workspace root:

```bash
npm install
```

### Running the Examples

#### Native Signals Example

```bash
npm run dev -w native-signals-example
```

Then open http://localhost:5173 in your browser.

#### Solid Signals Example

```bash
npm run dev -w solid-signals-example
```

Then open http://localhost:5173 in your browser.

### Building

Build all packages and applications:

```bash
npm run build
```

Build a specific workspace:

```bash
npm run build -w framework
npm run build -w native-signals-example
npm run build -w solid-signals-example
```

## Status

This is an experimental project exploring future web standards. The APIs and implementation are subject to change as the underlying standards evolve.

## Learn More

- [DOM Parts Proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)
- [TC39 Signals Proposal](https://github.com/proposal-signals/proposal-signals)
- [Arrow-js Documentation](https://www.arrow-js.com/)
