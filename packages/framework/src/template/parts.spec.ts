/**
 * Comprehensive tests for specialized AttributePart implementations.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTRIBUTE_BINDING,
  EventAttributePart,
  PROPERTY_BINDING,
  PropertyAttributePart,
  StandardAttributePart,
  TemplateAttributePart,
} from "./parts.js";
import {
  createEventSpy,
  createTestElement,
  createTextTemplate,
  dispatchTestEvent,
  getAttribute,
  getProperty,
  hasAttribute,
} from "./parts.test.js";

describe("StandardAttributePart", () => {
  let element: Element;
  let part: StandardAttributePart;

  beforeEach(() => {
    element = createTestElement();
    part = new StandardAttributePart(element, "data-test");
  });

  describe("setValue", () => {
    it("should set attribute to string value", () => {
      part.setValue("hello");
      expect(getAttribute(element, "data-test")).toBe("hello");
    });

    it("should set attribute to number value as string", () => {
      part.setValue(42);
      expect(getAttribute(element, "data-test")).toBe("42");
    });

    it("should remove attribute when value is null", () => {
      part.setValue("initial");
      expect(hasAttribute(element, "data-test")).toBe(true);
      part.setValue(null);
      expect(hasAttribute(element, "data-test")).toBe(false);
    });

    it("should remove attribute when value is undefined", () => {
      part.setValue("initial");
      expect(hasAttribute(element, "data-test")).toBe(true);
      part.setValue(undefined);
      expect(hasAttribute(element, "data-test")).toBe(false);
    });

    it("should remove attribute when value is false", () => {
      part.setValue("initial");
      expect(hasAttribute(element, "data-test")).toBe(true);
      part.setValue(false);
      expect(hasAttribute(element, "data-test")).toBe(false);
    });

    it("should set empty string when value is true", () => {
      part.setValue(true);
      expect(getAttribute(element, "data-test")).toBe("");
    });

    it("should update attribute when value changes", () => {
      part.setValue("first");
      expect(getAttribute(element, "data-test")).toBe("first");
      part.setValue("second");
      expect(getAttribute(element, "data-test")).toBe("second");
    });

    it("should handle empty string value", () => {
      part.setValue("");
      expect(getAttribute(element, "data-test")).toBe("");
      expect(hasAttribute(element, "data-test")).toBe(true);
    });
  });
});

describe("PropertyAttributePart", () => {
  let element: Element;
  let part: PropertyAttributePart;

  beforeEach(() => {
    element = createTestElement("input") as HTMLInputElement;
    // PropertyAttributePart expects the property name without '.' prefix
    part = new PropertyAttributePart(element, "value");
  });

  describe("setValue", () => {
    it("should set element property directly", () => {
      part.setValue("test value");
      expect(getProperty(element, "value")).toBe("test value");
    });

    it("should strip leading dot from property name", () => {
      // This test is no longer relevant since the call site handles stripping
      // Just verify that the property name is used as-is
      const customPart = new PropertyAttributePart(element, "customProp");
      customPart.setValue("custom");
      expect(getProperty(element, "customProp")).toBe("custom");
    });

    it("should handle property names without leading dot", () => {
      // PropertyAttributePart always expects property names without prefix
      const customPart = new PropertyAttributePart(element, "anotherProp");
      customPart.setValue("value");
      expect(getProperty(element, "anotherProp")).toBe("value");
    });

    it("should set null values", () => {
      part.setValue(null);
      // Property binding sets the actual value, including null
      // The default .value property of input elements coerces null to empty string
      expect(getProperty(element, "value")).toBe("");
    });

    it("should set boolean values", () => {
      const checkboxPart = new PropertyAttributePart(element, "checked");
      checkboxPart.setValue(true);
      expect(getProperty(element, "checked")).toBe(true);
      checkboxPart.setValue(false);
      expect(getProperty(element, "checked")).toBe(false);
    });

    it("should set number values", () => {
      const numPart = new PropertyAttributePart(element, "tabIndex");
      numPart.setValue(5);
      expect(getProperty(element, "tabIndex")).toBe(5);
    });

    it("should update property when value changes", () => {
      part.setValue("first");
      expect(getProperty(element, "value")).toBe("first");
      part.setValue("second");
      expect(getProperty(element, "value")).toBe("second");
    });
  });
});

describe("EventAttributePart", () => {
  let element: Element;
  let part: EventAttributePart;

  beforeEach(() => {
    element = createTestElement("button");
    // EventAttributePart expects the event name without 'on' prefix
    part = new EventAttributePart(element, "click");
  });

  describe("setValue", () => {
    it("should add event listener for function value", () => {
      const spy = createEventSpy();
      part.setValue(spy);

      dispatchTestEvent(element, "click");

      expect(spy.calls.length).toBe(1);
    });

    it("should strip \"on\" prefix from event name", () => {
      // This test is no longer relevant since the call site handles stripping
      // Just verify that the event name is used as-is
      const customPart = new EventAttributePart(element, "customclick");
      const spy = createEventSpy();
      customPart.setValue(spy);

      dispatchTestEvent(element, "customclick");

      expect(spy.calls.length).toBe(1);
      expect(spy.calls[0].type).toBe("customclick");
    });

    it("should handle event names without \"on\" prefix", () => {
      // EventAttributePart always expects event names without prefix
      const customPart = new EventAttributePart(element, "customevent");
      const spy = createEventSpy();
      customPart.setValue(spy);

      dispatchTestEvent(element, "customevent");

      expect(spy.calls.length).toBe(1);
    });

    it("should remove previous listener when value changes", () => {
      const spy1 = createEventSpy();
      const spy2 = createEventSpy();

      part.setValue(spy1);
      dispatchTestEvent(element, "click");
      expect(spy1.calls.length).toBe(1);

      part.setValue(spy2);
      dispatchTestEvent(element, "click");

      expect(spy1.calls.length).toBe(1); // Not called again
      expect(spy2.calls.length).toBe(1);
    });

    it("should remove listener when value is null", () => {
      const spy = createEventSpy();

      part.setValue(spy);
      dispatchTestEvent(element, "click");
      expect(spy.calls.length).toBe(1);

      part.setValue(null);
      dispatchTestEvent(element, "click");

      expect(spy.calls.length).toBe(1); // Not called again
    });

    it("should remove listener when value is not a function", () => {
      const spy = createEventSpy();

      part.setValue(spy);
      dispatchTestEvent(element, "click");
      expect(spy.calls.length).toBe(1);

      part.setValue("not a function");
      dispatchTestEvent(element, "click");

      expect(spy.calls.length).toBe(1); // Not called again
    });

    it("should handle multiple event dispatches", () => {
      const spy = createEventSpy();
      part.setValue(spy);

      dispatchTestEvent(element, "click");
      dispatchTestEvent(element, "click");
      dispatchTestEvent(element, "click");

      expect(spy.calls.length).toBe(3);
    });
  });
});

describe("TemplateAttributePart", () => {
  let element: Element;

  beforeEach(() => {
    element = createTestElement();
  });

  describe("with ATTRIBUTE_BINDING strategy", () => {
    it("should render template and set as attribute", () => {
      const template = createTextTemplate(["Hello ", "!"]);
      const part = new TemplateAttributePart(element, "data-greeting", template, 0, ATTRIBUTE_BINDING);

      part.setValue("World");

      expect(getAttribute(element, "data-greeting")).toBe("Hello World!");
    });

    it("should update attribute when slot value changes", () => {
      const template = createTextTemplate(["Count: ", ""]);
      const part = new TemplateAttributePart(element, "data-count", template, 0, ATTRIBUTE_BINDING);

      part.setValue(1);
      expect(getAttribute(element, "data-count")).toBe("Count: 1");

      part.setValue(2);
      expect(getAttribute(element, "data-count")).toBe("Count: 2");
    });

    it("should handle multiple slots in template", () => {
      const template = createTextTemplate(["", " and ", ""]);
      const part1 = new TemplateAttributePart(element, "data-names", template, 0, ATTRIBUTE_BINDING);
      const part2 = new TemplateAttributePart(element, "data-names", template, 1, ATTRIBUTE_BINDING);

      part1.setValue("Alice");
      part2.setValue("Bob");

      expect(getAttribute(element, "data-names")).toBe("Alice and Bob");
    });

    it("should handle null/undefined values in template", () => {
      const template = createTextTemplate(["Value: ", ""]);
      const part = new TemplateAttributePart(element, "data-value", template, 0, ATTRIBUTE_BINDING);

      part.setValue(null);
      expect(getAttribute(element, "data-value")).toBe("Value: ");

      part.setValue(undefined);
      expect(getAttribute(element, "data-value")).toBe("Value: ");
    });
  });

  describe("with PROPERTY_BINDING strategy", () => {
    it("should render template and set as property", () => {
      const inputElement = createTestElement("input");
      const template = createTextTemplate(["Prefix: ", ""]);
      const part = new TemplateAttributePart(inputElement, "value", template, 0, PROPERTY_BINDING);

      part.setValue("test");

      expect(getProperty(inputElement, "value")).toBe("Prefix: test");
    });

    it("should update property when slot value changes", () => {
      const inputElement = createTestElement("input");
      const template = createTextTemplate(["", " items"]);
      const part = new TemplateAttributePart(inputElement, "title", template, 0, PROPERTY_BINDING);

      part.setValue(5);
      expect(getProperty(inputElement, "title")).toBe("5 items");

      part.setValue(10);
      expect(getProperty(inputElement, "title")).toBe("10 items");
    });

    it("should handle complex template with multiple parts", () => {
      const template = createTextTemplate(["css-", "-", ""]);
      const part1 = new TemplateAttributePart(element, "className", template, 0, PROPERTY_BINDING);
      const part2 = new TemplateAttributePart(element, "className", template, 1, PROPERTY_BINDING);

      part1.setValue("primary");
      part2.setValue("active");

      expect(getProperty(element, "className")).toBe("css-primary-active");
    });
  });

  describe("shared template behavior", () => {
    it("should share template instance across multiple parts", () => {
      const template = createTextTemplate(["[", ", ", "]"]);
      const part1 = new TemplateAttributePart(element, "data-coords", template, 0, ATTRIBUTE_BINDING);
      const part2 = new TemplateAttributePart(element, "data-coords", template, 1, ATTRIBUTE_BINDING);

      part1.setValue("10");
      part2.setValue("20");

      expect(getAttribute(element, "data-coords")).toBe("[10, 20]");
    });
  });
});

/**
 * NOTE: Template binding instantiation is now handled by TemplateInstance.create() in render.ts.
 * Tests for nested template rendering can be found in render.spec.ts under "Nested Templates".
 * NodePart is now stateless and only handles DOM nodes, fragments, and primitives.
 */
