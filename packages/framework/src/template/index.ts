// DOM utilities
export { NodeRange } from "./dom.js";

// Template compilation (Layer 1)
export {
  type AttributePartDescriptor,
  type Descriptor,
  getTemplate,
  type NodePartDescriptor,
  type PartDescriptor,
  resolvePath,
  Template,
  type TextContentPartDescriptor,
  type TextTemplatePartDescriptor,
} from "./template.js";

// Parts - stateless value application (Layer 2)
export {
  BooleanAttributePart,
  createParts,
  EventAttributePart,
  NodePart,
  type Part,
  PropertyAttributePart,
  StandardAttributePart,
  TemplateAttributePart,
  TextContentPart,
  TextTemplate,
} from "./parts.js";

// Rendering - instance management (Layer 3)
export {
  DynamicBinding,
  StaticBinding,
  TemplateInstance,
} from "./render.js";
