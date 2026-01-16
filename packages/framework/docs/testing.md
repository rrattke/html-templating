# Testing Guide

This document outlines testing conventions and best practices for the framework.

## File Naming Conventions

The framework follows a strict naming convention for test-related files:

### `.spec.ts` Files - Test Suites

Files with the `.spec.ts` extension contain **actual test suites** using Vitest. These files:

- Define test cases using `describe()`, `it()`, `test()`, etc.
- Are executed by the test runner
- Are excluded from the build bundle
- Should focus on testing specific modules or features

**Example:**

```typescript
// parts.spec.ts
import { describe, it, expect } from 'vitest';
import { StandardAttributePart } from './parts.js';

describe('StandardAttributePart', () => {
  it('should set attribute value', () => {
    // test implementation
  });
});
```

### `.test.ts` Files - Test Utilities

Files with the `.test.ts` extension contain **test utilities and helpers**. These files:

- Export helper functions, fixtures, and utilities for use in test suites
- Do NOT contain actual test cases
- Are excluded from the build bundle
- Should be imported by `.spec.ts` files to reduce duplication

**Example:**

```typescript
// parts.test.ts
export function createTestElement(tag: string = 'div'): Element {
  return document.createElement(tag);
}

export function createTextTemplate(strings: string[]): TextTemplate {
  return new TextTemplate(strings);
}
```

## Test Organization

### Module-Level Tests

Keep test files co-located with the modules they test:

```text
src/
  template/
    parts.ts              # Implementation
    parts.test.ts         # Test utilities
    parts.spec.ts         # Test suite
    html.ts               # Implementation
    html.spec.ts          # Test suite
```

### Shared Test Utilities

For framework-wide test utilities that are used across multiple test suites, consider creating a shared test utilities file:

```text
src/
  test-utils.test.ts     # Framework-wide test utilities
```

## Build Configuration

The build configuration (vite.config.ts) is set up to exclude both `.spec.ts` and `.test.ts` files from the production bundle. This ensures:

- Test code never ships to production
- Bundle size remains minimal
- Clear separation between production and test code

## Best Practices

### 1. Reduce Duplication with Utilities

Instead of repeating setup code in every test, extract common patterns into `.test.ts` utility files:

**❌ Don't:**

```typescript
// parts.spec.ts
describe('StandardAttributePart', () => {
  it('test 1', () => {
    const element = document.createElement('div');
    // test...
  });
  
  it('test 2', () => {
    const element = document.createElement('div');
    // test...
  });
});
```

**✅ Do:**

```typescript
// parts.test.ts
export function createTestElement() {
  return document.createElement('div');
}

// parts.spec.ts
import { createTestElement } from './parts.test.js';

describe('StandardAttributePart', () => {
  it('test 1', () => {
    const element = createTestElement();
    // test...
  });
  
  it('test 2', () => {
    const element = createTestElement();
    // test...
  });
});
```

### 2. Organize Tests by Feature

Group related tests using `describe()` blocks:

```typescript
describe('StandardAttributePart', () => {
  describe('setValue', () => {
    it('should set string values', () => { /* ... */ });
    it('should handle null values', () => { /* ... */ });
    it('should handle boolean values', () => { /* ... */ });
  });
});
```

### 3. Use Descriptive Test Names

Test names should clearly describe what they test:

**❌ Don't:**

```typescript
it('works', () => { /* ... */ });
it('test 1', () => { /* ... */ });
```

**✅ Do:**

```typescript
it('should remove attribute when value is null', () => { /* ... */ });
it('should set empty string when value is true', () => { /* ... */ });
```

### 4. Keep Tests Focused

Each test should verify one specific behavior:

**❌ Don't:**

```typescript
it('should handle all attribute operations', () => {
  part.setValue('value1');
  expect(element.getAttribute('name')).toBe('value1');
  part.setValue(null);
  expect(element.hasAttribute('name')).toBe(false);
  part.setValue(true);
  expect(element.getAttribute('name')).toBe('');
});
```

**✅ Do:**

```typescript
it('should set attribute to string value', () => {
  part.setValue('value1');
  expect(element.getAttribute('name')).toBe('value1');
});

it('should remove attribute when value is null', () => {
  part.setValue(null);
  expect(element.hasAttribute('name')).toBe(false);
});

it('should set empty string when value is true', () => {
  part.setValue(true);
  expect(element.getAttribute('name')).toBe('');
});
```

### 5. Clean Up After Tests

Use `beforeEach()` and `afterEach()` for setup and cleanup:

```typescript
describe('EventAttributePart', () => {
  let element: Element;
  let part: EventAttributePart;
  
  beforeEach(() => {
    element = createTestElement();
    part = new EventAttributePart(element, 'onclick');
  });
  
  it('should add event listener', () => {
    // test...
  });
});
```

## Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test -- --watch
```

Run tests with coverage:

```bash
npm test -- --coverage
```

## Coverage Goals

Aim for high test coverage, especially for:

- Public APIs
- Complex logic
- Edge cases and error conditions
- Integration points between modules

Focus on meaningful tests that verify behavior, not just coverage percentages.
