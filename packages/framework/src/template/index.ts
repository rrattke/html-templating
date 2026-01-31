// DOM utilities
export { NodeRange } from './dom.js';

// Template compilation (Layer 1)
export { 
  Template, 
  getTemplate,
  resolvePath,
  type Descriptor,
  type PartDescriptor,
  type NodePartDescriptor,
  type AttributePartDescriptor,
  type TextContentPartDescriptor,
  type TextTemplatePartDescriptor
} from './template.js';

// Parts - stateless value application (Layer 2)
export { 
  NodePart, 
  StandardAttributePart, 
  PropertyAttributePart, 
  BooleanAttributePart, 
  EventAttributePart, 
  TemplateAttributePart,
  TextContentPart,
  TextTemplate,
  createParts,
  type Part
} from './parts.js';

// Rendering - instance management (Layer 3)
export { 
  StaticBinding,
  DynamicBinding,
  TemplateInstance, 
  InstanceState, 
  Reconciler
} from './render.js';
