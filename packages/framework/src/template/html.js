const NODE_MARKER_PREFIX = 'part:';
const ATTR_MARKER_PREFIX = '%%PART:';
const ATTR_MARKER_SUFFIX = '%%';
const templateCache = new WeakMap();

export class TemplateResult {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
  }
}

export function html(strings, ...values) {
  return new TemplateResult(strings, values);
}

export function getTemplateRecord(strings) {
  let record = templateCache.get(strings);
  if (!record) {
    record = createTemplateRecord(strings);
    templateCache.set(strings, record);
  }
  return record;
}

function createTemplateRecord(strings) {
  const template = document.createElement('template');
  template.innerHTML = buildHTML(strings);
  const partCount = strings.length - 1;
  const descriptors = new Array(partCount);
  scanTemplateContent(template.content, descriptors);
  return {
    template,
    descriptors,
    partCount,
    clone() {
      return template.content.cloneNode(true);
    }
  };
}

function buildHTML(strings) {
  let result = '';
  for (let i = 0; i < strings.length - 1; i++) {
    const chunk = strings[i];
    result += chunk;
    if (isAttributePosition(chunk)) {
      result += attributeMarkerForIndex(i);
    } else {
      result += nodeMarkerForIndex(i);
    }
  }
  result += strings[strings.length - 1];
  return result;
}

function nodeMarkerForIndex(index) {
  return `<!--${NODE_MARKER_PREFIX}${index}-->`;
}

function attributeMarkerForIndex(index) {
  return `"${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}"`;
}

function isAttributePosition(chunk) {
  return /=\s*$/.test(chunk);
}

function scanTemplateContent(fragment, descriptors) {
  const walker = document.createTreeWalker(
    fragment,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.COMMENT_NODE) {
      extractNodePart(node, fragment, descriptors);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      extractAttributeParts(node, fragment, descriptors);
    }
  }
}

function extractNodePart(commentNode, root, descriptors) {
  const data = commentNode.data.trim();
  if (!data.startsWith(NODE_MARKER_PREFIX)) {
    return;
  }
  const numeric = data.slice(NODE_MARKER_PREFIX.length);
  const index = Number.parseInt(numeric, 10);
  if (Number.isNaN(index)) {
    throw new Error('Invalid node marker index.');
  }
  descriptors[index] = { type: 'node', path: buildPath(commentNode, root) };
}

function extractAttributeParts(element, root, descriptors) {
  for (const attr of Array.from(element.attributes)) {
    const value = attr.value;
    const markerIndex = value.indexOf(ATTR_MARKER_PREFIX);
    if (markerIndex === -1) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith(ATTR_MARKER_PREFIX) || !trimmed.endsWith(ATTR_MARKER_SUFFIX)) {
      throw new Error('Attribute expressions must only contain a single placeholder.');
    }
    const index = parseAttributeMarker(trimmed);
    const canonical = `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}`;
    if (trimmed !== canonical) {
      throw new Error('Attribute expressions cannot mix static text with placeholders.');
    }
    element.removeAttribute(attr.name);
    descriptors[index] = {
      type: 'attribute',
      name: attr.name,
      path: buildPath(element, root)
    };
  }
}

function parseAttributeMarker(text) {
  const start = text.indexOf(ATTR_MARKER_PREFIX);
  const end = text.indexOf(ATTR_MARKER_SUFFIX, start + ATTR_MARKER_PREFIX.length);
  const numeric = text.slice(start + ATTR_MARKER_PREFIX.length, end);
  return Number.parseInt(numeric, 10);
}

function buildPath(node, root) {
  const path = [];
  let current = node;
  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) {
      break;
    }
    const index = Array.prototype.indexOf.call(parent.childNodes, current);
    path.unshift(index);
    current = parent;
  }
  return path;
}

export function resolvePath(root, path) {
  let node = root;
  for (const index of path) {
    node = node.childNodes[index];
  }
  return node;
}
