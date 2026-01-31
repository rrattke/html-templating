# Static Rendering Example

This example demonstrates one-time static rendering using `StaticBinding`.

## Use Case

When you need to render templates once without any reactive updates:
- Server-side rendering (SSR) hydration targets
- Static page generation
- Email templates
- PDF generation
- Any scenario where content doesn't change after initial render

## Key Differences from Dynamic Rendering

| Feature | Static (`StaticBinding`) | Dynamic (`DynamicBinding`) |
|---------|-------------------------|---------------------------|
| Class | `StaticBinding` | `DynamicBinding` |
| Runtime required | No | Yes |
| Reactive updates | No | Yes (functions wrapped in effects) |
| Disposal needed | No | Yes (cleanup effects/listeners) |
| Render method | `.render()` → `DocumentFragment` | `.instance()` → `TemplateInstance` |
| Nested templates | Rendered immediately | Tracked for disposal |

## Running

```bash
npm run dev -w static-example
```

## Code Example

```typescript
import { StaticBinding } from '@vanishing/framework/template';

// No runtime needed - just use StaticBinding.html directly
const html = StaticBinding.html;

// Compose templates with plain values (not functions)
const page = html`
  <div>
    <h1>${title}</h1>
    <ul>${items.map(item => html`<li>${item.name}</li>`)}</ul>
  </div>
`;

// Render once - returns DocumentFragment directly
document.body.appendChild(page.render());
```
