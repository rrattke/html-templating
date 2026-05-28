import { StaticBinding } from "@vanishing/framework/template";

// Use StaticBinding.html - no runtime needed!
const html = StaticBinding.html;

// =============================================================================
// Static Model
// =============================================================================

const model = {
  title: "Static Rendering Demo",
  description: "This page was rendered once, statically. No signals, no updates, no disposal needed.",

  items: [
    { id: 1, name: "Template Composition", desc: "Nest templates within templates" },
    { id: 2, name: "Array Mapping", desc: "Map data arrays to template arrays" },
    { id: 3, name: "No Runtime Overhead", desc: "No effect tracking or disposal" },
  ],

  features: [
    "Lightweight - no reactive runtime needed",
    "Fast - direct DOM fragment creation",
    "Composable - same html`` syntax as dynamic rendering",
  ],
};

// =============================================================================
// Single Composed Template
// =============================================================================

const page = html`
  <div class="container">
    <h1>${model.title}</h1>
    <p class="description">${model.description}</p>
    
    <h2>Features</h2>
    <ul>
      ${
  model.items.map((item) =>
    html`
        <li>
          <strong>${item.name}</strong>
          <br />
          <small>${item.desc}</small>
        </li>
      `
  )
}
    </ul>
    
    <div class="nested-section">
      <h2>Why Static Rendering?</h2>
      <ul>
        ${model.features.map((feature) => html`<li>${feature}</li>`)}
      </ul>
    </div>
  </div>
`;

// =============================================================================
// Render Once
// =============================================================================

// .render() returns a DocumentFragment - no instance, no dispose needed
document.getElementById("app")!.appendChild(page.render());

console.log("Static rendering complete. No reactive subscriptions created.");
