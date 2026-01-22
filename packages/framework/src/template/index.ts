// DOM utilities
export { NodeRange } from './dom.js';

// Template compilation (Layer 1)
export { Template, getTemplate } from './template.js';

// Parts - stateless value application (Layer 2)
export { 
  NodePart, 
  StandardAttributePart, 
  PropertyAttributePart, 
  BooleanAttributePart, 
  EventAttributePart, 
  TemplateAttributePart,
  TextContentPart,
  TextTemplate 
} from './parts.js';

// Rendering - instance management (Layer 3)
export { 
  TemplateBinding, 
  TemplateInstance, 
  InstanceState, 
  Reconciler 
} from './render.js';
export type { Part } from './render.js';

// Backward compatibility aliases
export { Template as PartsTemplate, getTemplate as getPartsTemplate } from './template.js';
