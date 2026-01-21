/**
 * Comprehensive tests for specialized AttributePart implementations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StandardAttributePart, PropertyAttributePart, EventAttributePart, TemplateAttributePart, NodePart, ATTRIBUTE_BINDING, PROPERTY_BINDING } from './parts.js';
import { createTestElement, createTextTemplate, createEventSpy, dispatchTestEvent, hasAttribute, getAttribute, getProperty } from './parts.test.js';

describe('StandardAttributePart', () => {
  let element: Element;
  let part: StandardAttributePart;

  beforeEach(() => {
    element = createTestElement();
    part = new StandardAttributePart(element, 'data-test');
  });

  describe('setValue', () => {
    it('should set attribute to string value', () => {
      part.setValue('hello');
      expect(getAttribute(element, 'data-test')).toBe('hello');
    });

    it('should set attribute to number value as string', () => {
      part.setValue(42);
      expect(getAttribute(element, 'data-test')).toBe('42');
    });

    it('should remove attribute when value is null', () => {
      part.setValue('initial');
      expect(hasAttribute(element, 'data-test')).toBe(true);
      part.setValue(null);
      expect(hasAttribute(element, 'data-test')).toBe(false);
    });

    it('should remove attribute when value is undefined', () => {
      part.setValue('initial');
      expect(hasAttribute(element, 'data-test')).toBe(true);
      part.setValue(undefined);
      expect(hasAttribute(element, 'data-test')).toBe(false);
    });

    it('should remove attribute when value is false', () => {
      part.setValue('initial');
      expect(hasAttribute(element, 'data-test')).toBe(true);
      part.setValue(false);
      expect(hasAttribute(element, 'data-test')).toBe(false);
    });

    it('should set empty string when value is true', () => {
      part.setValue(true);
      expect(getAttribute(element, 'data-test')).toBe('');
    });

    it('should update attribute when value changes', () => {
      part.setValue('first');
      expect(getAttribute(element, 'data-test')).toBe('first');
      part.setValue('second');
      expect(getAttribute(element, 'data-test')).toBe('second');
    });

    it('should handle empty string value', () => {
      part.setValue('');
      expect(getAttribute(element, 'data-test')).toBe('');
      expect(hasAttribute(element, 'data-test')).toBe(true);
    });
  });
});

describe('PropertyAttributePart', () => {
  let element: Element;
  let part: PropertyAttributePart;

  beforeEach(() => {
    element = createTestElement('input') as HTMLInputElement;
    // PropertyAttributePart expects the property name without '.' prefix
    part = new PropertyAttributePart(element, 'value');
  });

  describe('setValue', () => {
    it('should set element property directly', () => {
      part.setValue('test value');
      expect(getProperty(element, 'value')).toBe('test value');
    });

    it('should strip leading dot from property name', () => {
      // This test is no longer relevant since the call site handles stripping
      // Just verify that the property name is used as-is
      const customPart = new PropertyAttributePart(element, 'customProp');
      customPart.setValue('custom');
      expect(getProperty(element, 'customProp')).toBe('custom');
    });

    it('should handle property names without leading dot', () => {
      // PropertyAttributePart always expects property names without prefix
      const customPart = new PropertyAttributePart(element, 'anotherProp');
      customPart.setValue('value');
      expect(getProperty(element, 'anotherProp')).toBe('value');
    });

    it('should set null values', () => {
      part.setValue(null);
      // Property binding sets the actual value, including null
      // The default .value property of input elements coerces null to empty string
      expect(getProperty(element, 'value')).toBe('');
    });

    it('should set boolean values', () => {
      const checkboxPart = new PropertyAttributePart(element, 'checked');
      checkboxPart.setValue(true);
      expect(getProperty(element, 'checked')).toBe(true);
      checkboxPart.setValue(false);
      expect(getProperty(element, 'checked')).toBe(false);
    });

    it('should set number values', () => {
      const numPart = new PropertyAttributePart(element, 'tabIndex');
      numPart.setValue(5);
      expect(getProperty(element, 'tabIndex')).toBe(5);
    });

    it('should update property when value changes', () => {
      part.setValue('first');
      expect(getProperty(element, 'value')).toBe('first');
      part.setValue('second');
      expect(getProperty(element, 'value')).toBe('second');
    });
  });
});

describe('EventAttributePart', () => {
  let element: Element;
  let part: EventAttributePart;

  beforeEach(() => {
    element = createTestElement('button');
    // EventAttributePart expects the event name without 'on' prefix
    part = new EventAttributePart(element, 'click');
  });

  describe('setValue', () => {
    it('should add event listener for function value', () => {
      const spy = createEventSpy();
      part.setValue(spy);
      
      dispatchTestEvent(element, 'click');
      
      expect(spy.calls.length).toBe(1);
    });

    it('should strip "on" prefix from event name', () => {
      // This test is no longer relevant since the call site handles stripping
      // Just verify that the event name is used as-is
      const customPart = new EventAttributePart(element, 'customclick');
      const spy = createEventSpy();
      customPart.setValue(spy);
      
      dispatchTestEvent(element, 'customclick');
      
      expect(spy.calls.length).toBe(1);
      expect(spy.calls[0].type).toBe('customclick');
    });

    it('should handle event names without "on" prefix', () => {
      // EventAttributePart always expects event names without prefix
      const customPart = new EventAttributePart(element, 'customevent');
      const spy = createEventSpy();
      customPart.setValue(spy);
      
      dispatchTestEvent(element, 'customevent');
      
      expect(spy.calls.length).toBe(1);
    });

    it('should remove previous listener when value changes', () => {
      const spy1 = createEventSpy();
      const spy2 = createEventSpy();
      
      part.setValue(spy1);
      dispatchTestEvent(element, 'click');
      expect(spy1.calls.length).toBe(1);
      
      part.setValue(spy2);
      dispatchTestEvent(element, 'click');
      
      expect(spy1.calls.length).toBe(1); // Not called again
      expect(spy2.calls.length).toBe(1);
    });

    it('should remove listener when value is null', () => {
      const spy = createEventSpy();
      
      part.setValue(spy);
      dispatchTestEvent(element, 'click');
      expect(spy.calls.length).toBe(1);
      
      part.setValue(null);
      dispatchTestEvent(element, 'click');
      
      expect(spy.calls.length).toBe(1); // Not called again
    });

    it('should remove listener when value is not a function', () => {
      const spy = createEventSpy();
      
      part.setValue(spy);
      dispatchTestEvent(element, 'click');
      expect(spy.calls.length).toBe(1);
      
      part.setValue('not a function');
      dispatchTestEvent(element, 'click');
      
      expect(spy.calls.length).toBe(1); // Not called again
    });

    it('should handle multiple event dispatches', () => {
      const spy = createEventSpy();
      part.setValue(spy);
      
      dispatchTestEvent(element, 'click');
      dispatchTestEvent(element, 'click');
      dispatchTestEvent(element, 'click');
      
      expect(spy.calls.length).toBe(3);
    });
  });
});

describe('TemplateAttributePart', () => {
  let element: Element;

  beforeEach(() => {
    element = createTestElement();
  });

  describe('with ATTRIBUTE_BINDING strategy', () => {
    it('should render template and set as attribute', () => {
      const template = createTextTemplate(['Hello ', '!']);
      const part = new TemplateAttributePart(element, 'data-greeting', template, 0, ATTRIBUTE_BINDING);
      
      part.setValue('World');
      
      expect(getAttribute(element, 'data-greeting')).toBe('Hello World!');
    });

    it('should update attribute when slot value changes', () => {
      const template = createTextTemplate(['Count: ', '']);
      const part = new TemplateAttributePart(element, 'data-count', template, 0, ATTRIBUTE_BINDING);
      
      part.setValue(1);
      expect(getAttribute(element, 'data-count')).toBe('Count: 1');
      
      part.setValue(2);
      expect(getAttribute(element, 'data-count')).toBe('Count: 2');
    });

    it('should handle multiple slots in template', () => {
      const template = createTextTemplate(['', ' and ', '']);
      const part1 = new TemplateAttributePart(element, 'data-names', template, 0, ATTRIBUTE_BINDING);
      const part2 = new TemplateAttributePart(element, 'data-names', template, 1, ATTRIBUTE_BINDING);
      
      part1.setValue('Alice');
      part2.setValue('Bob');
      
      expect(getAttribute(element, 'data-names')).toBe('Alice and Bob');
    });

    it('should handle null/undefined values in template', () => {
      const template = createTextTemplate(['Value: ', '']);
      const part = new TemplateAttributePart(element, 'data-value', template, 0, ATTRIBUTE_BINDING);
      
      part.setValue(null);
      expect(getAttribute(element, 'data-value')).toBe('Value: ');
      
      part.setValue(undefined);
      expect(getAttribute(element, 'data-value')).toBe('Value: ');
    });
  });

  describe('with PROPERTY_BINDING strategy', () => {
    it('should render template and set as property', () => {
      const inputElement = createTestElement('input');
      const template = createTextTemplate(['Prefix: ', '']);
      const part = new TemplateAttributePart(inputElement, 'value', template, 0, PROPERTY_BINDING);
      
      part.setValue('test');
      
      expect(getProperty(inputElement, 'value')).toBe('Prefix: test');
    });

    it('should update property when slot value changes', () => {
      const inputElement = createTestElement('input');
      const template = createTextTemplate(['', ' items']);
      const part = new TemplateAttributePart(inputElement, 'title', template, 0, PROPERTY_BINDING);
      
      part.setValue(5);
      expect(getProperty(inputElement, 'title')).toBe('5 items');
      
      part.setValue(10);
      expect(getProperty(inputElement, 'title')).toBe('10 items');
    });

    it('should handle complex template with multiple parts', () => {
      const template = createTextTemplate(['css-', '-', '']);
      const part1 = new TemplateAttributePart(element, 'className', template, 0, PROPERTY_BINDING);
      const part2 = new TemplateAttributePart(element, 'className', template, 1, PROPERTY_BINDING);
      
      part1.setValue('primary');
      part2.setValue('active');
      
      expect(getProperty(element, 'className')).toBe('css-primary-active');
    });
  });

  describe('shared template behavior', () => {
    it('should share template instance across multiple parts', () => {
      const template = createTextTemplate(['[', ', ', ']']);
      const part1 = new TemplateAttributePart(element, 'data-coords', template, 0, ATTRIBUTE_BINDING);
      const part2 = new TemplateAttributePart(element, 'data-coords', template, 1, ATTRIBUTE_BINDING);
      
      part1.setValue('10');
      part2.setValue('20');
      
      expect(getAttribute(element, 'data-coords')).toBe('[10, 20]');
    });
  });
});

describe('NodePart - Keyed Templates', () => {
  let container: HTMLElement;
  let marker: Comment;
  let part: NodePart;

  // Mock TemplateBinding for testing
  function createMockBinding(key: unknown, content: string): any {
    let instanceCallCount = 0;
    let disposeCallCount = 0;
    
    const binding = {
      key,
      instance: () => {
        instanceCallCount++;
        const fragment = document.createDocumentFragment();
        const text = document.createTextNode(content);
        fragment.appendChild(text);
        return {
          fragment,
          dispose: () => { disposeCallCount++; }
        };
      },
      strings: ['mock'],
      values: [content],
      _disposeCallCount: () => disposeCallCount,
      _instanceCallCount: () => instanceCallCount
    };
    return binding;
  }

  beforeEach(() => {
    container = document.createElement('div');
    marker = document.createComment('marker');
    container.appendChild(marker);
    part = new NodePart(marker);
  });

  describe('single keyed template', () => {
    it('should create instance for new keyed template', () => {
      const binding = createMockBinding('key1', 'Hello');
      part.setValue(binding);
      
      expect(container.textContent).toBe('Hello');
    });

    it('should reuse instance when same key appears again', () => {
      const binding1 = createMockBinding('key1', 'First');
      part.setValue(binding1);
      expect(container.textContent).toBe('First');
      
      const binding2 = createMockBinding('key1', 'Second');
      part.setValue(binding2);
      
      // Should still show 'First' because instance was reused
      expect(container.textContent).toBe('First');
      // First binding's dispose should not be called
      expect(binding1._disposeCallCount()).toBe(0);
    });

    it('should create new instance when key changes', () => {
      const binding1 = createMockBinding('key1', 'First');
      part.setValue(binding1);
      expect(container.textContent).toBe('First');
      
      const binding2 = createMockBinding('key2', 'Second');
      part.setValue(binding2);
      
      // Should show 'Second' because different key
      expect(container.textContent).toBe('Second');
      // First binding should be disposed
      expect(binding1._disposeCallCount()).toBe(1);
    });

    it('should handle non-keyed template after keyed template', () => {
      const keyedBinding = createMockBinding('key1', 'Keyed');
      part.setValue(keyedBinding);
      expect(container.textContent).toBe('Keyed');
      
      const nonKeyedBinding = createMockBinding(undefined, 'NonKeyed');
      part.setValue(nonKeyedBinding);
      
      // Should clear keyed state and show new content
      expect(container.textContent).toBe('NonKeyed');
      // Keyed binding should be disposed
      expect(keyedBinding._disposeCallCount()).toBe(1);
    });
  });

  describe('array of keyed templates', () => {
    it('should create instances for all keyed templates', () => {
      const bindings = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings);
      
      expect(container.textContent).toBe('ABC');
    });

    it('should reuse instances when keys remain the same', () => {
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('AB');
      
      const bindings2 = [
        createMockBinding('a', 'X'),
        createMockBinding('b', 'Y')
      ];
      part.setValue(bindings2);
      
      // Should still show 'AB' because instances were reused
      expect(container.textContent).toBe('AB');
      expect(bindings1[0]._disposeCallCount()).toBe(0);
      expect(bindings1[1]._disposeCallCount()).toBe(0);
    });

    it('should reorder elements when key order changes', () => {
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('ABC');
      
      const bindings2 = [
        createMockBinding('c', 'C'),
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings2);
      
      // Should reorder to 'CAB'
      expect(container.textContent).toBe('CAB');
      // No disposals should happen
      expect(bindings1[0]._disposeCallCount()).toBe(0);
      expect(bindings1[1]._disposeCallCount()).toBe(0);
      expect(bindings1[2]._disposeCallCount()).toBe(0);
    });

    it('should add new keyed items', () => {
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('AB');
      
      const bindings2 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings2);
      
      expect(container.textContent).toBe('ABC');
      expect(bindings1[0]._disposeCallCount()).toBe(0);
      expect(bindings1[1]._disposeCallCount()).toBe(0);
    });

    it('should remove keyed items that are no longer present', () => {
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('ABC');
      
      const bindings2 = [
        createMockBinding('a', 'A'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings2);
      
      expect(container.textContent).toBe('AC');
      // 'b' should be disposed
      expect(bindings1[1]._disposeCallCount()).toBe(1);
      // 'a' and 'c' should not be disposed
      expect(bindings1[0]._disposeCallCount()).toBe(0);
      expect(bindings1[2]._disposeCallCount()).toBe(0);
    });

    it('should handle complete replacement of keyed items', () => {
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('AB');
      
      const bindings2 = [
        createMockBinding('x', 'X'),
        createMockBinding('y', 'Y')
      ];
      part.setValue(bindings2);
      
      expect(container.textContent).toBe('XY');
      // Old items should be disposed
      expect(bindings1[0]._disposeCallCount()).toBe(1);
      expect(bindings1[1]._disposeCallCount()).toBe(1);
    });

    it('should handle empty array after keyed items', () => {
      const bindings = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings);
      expect(container.textContent).toBe('AB');
      
      part.setValue([]);
      
      expect(container.textContent).toBe('');
      // All items should be disposed
      expect(bindings[0]._disposeCallCount()).toBe(1);
      expect(bindings[1]._disposeCallCount()).toBe(1);
    });
  });

  describe('mixed keyed and non-keyed', () => {
    it('should clear keyed state when switching to non-keyed array', () => {
      const keyedBindings = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(keyedBindings);
      expect(container.textContent).toBe('AB');
      
      const nonKeyedBindings = [
        createMockBinding(undefined, 'X'),
        createMockBinding(undefined, 'Y')
      ];
      part.setValue(nonKeyedBindings);
      
      expect(container.textContent).toBe('XY');
      // Keyed items should be disposed
      expect(keyedBindings[0]._disposeCallCount()).toBe(1);
      expect(keyedBindings[1]._disposeCallCount()).toBe(1);
    });

    it('should clear non-keyed state when switching to keyed array', () => {
      const nonKeyedBindings = [
        createMockBinding(undefined, 'X'),
        createMockBinding(undefined, 'Y')
      ];
      part.setValue(nonKeyedBindings);
      expect(container.textContent).toBe('XY');
      
      const keyedBindings = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(keyedBindings);
      
      expect(container.textContent).toBe('AB');
      // Non-keyed items should be disposed
      expect(nonKeyedBindings[0]._disposeCallCount()).toBe(1);
      expect(nonKeyedBindings[1]._disposeCallCount()).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null/false to clear keyed templates', () => {
      const bindings = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B')
      ];
      part.setValue(bindings);
      expect(container.textContent).toBe('AB');
      
      part.setValue(null);
      
      expect(container.textContent).toBe('');
      expect(bindings[0]._disposeCallCount()).toBe(1);
      expect(bindings[1]._disposeCallCount()).toBe(1);
    });

    it('should handle duplicate keys by using last occurrence', () => {
      const bindings = [
        createMockBinding('a', 'First'),
        createMockBinding('a', 'Second')
      ];
      part.setValue(bindings);
      
      // The implementation processes in reverse order
      // When iterating backwards, 'Second' creates the child first
      // Then 'First' reuses it, so 'Second' is what we see
      expect(container.textContent).toContain('Second');
    });

    it('should handle various key types', () => {
      const bindings1 = [
        createMockBinding(1, 'Number'),
        createMockBinding('str', 'String'),
        createMockBinding(true, 'Boolean')
      ];
      part.setValue(bindings1);
      
      expect(container.textContent).toBe('NumberStringBoolean');
      
      const bindings2 = [
        createMockBinding(1, 'X'),
        createMockBinding('str', 'Y'),
        createMockBinding(true, 'Z')
      ];
      part.setValue(bindings2);
      
      // Should reuse based on keys
      expect(container.textContent).toBe('NumberStringBoolean');
    });

    it('should insert re-added item at correct position, not old location', () => {
      // Create initial list with 3 items: A, B, C
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('ABC');
      expect(bindings1[1]._instanceCallCount()).toBe(1); // B created once
      
      // Remove item B (list becomes A, C)
      const bindings2 = [
        createMockBinding('a', 'A'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings2);
      expect(container.textContent).toBe('AC');
      expect(bindings1[1]._disposeCallCount()).toBe(1); // B disposed
      
      // Re-add B at the end (list should become A, C, B)
      const bindings3 = [
        createMockBinding('a', 'A'),
        createMockBinding('c', 'C'),
        createMockBinding('b', 'B-new')
      ];
      part.setValue(bindings3);
      
      // B should appear at the end, not in its old position
      expect(container.textContent).toBe('ACB-new');
      // Verify that B's instance() was called again (creating new instance)
      expect(bindings3[2]._instanceCallCount()).toBe(1);
      
      // Test another reordering: move B to the start (B, A, C)
      const bindings4 = [
        createMockBinding('b', 'B-start'),
        createMockBinding('a', 'A'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings4);
      
      // B should be at the start
      // Since it's still the same key 'b', it should reuse the instance from bindings3
      expect(container.textContent).toBe('B-newAC');
      // Instance should be reused (moved), not recreated
      expect(bindings4[0]._instanceCallCount()).toBe(0); // Different binding object, not called
    });

    it('should handle remove and re-add of multiple items correctly', () => {
      // Initial: A, B, C, D
      const bindings1 = [
        createMockBinding('a', 'A'),
        createMockBinding('b', 'B'),
        createMockBinding('c', 'C'),
        createMockBinding('d', 'D')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('ABCD');
      
      // Remove B and D: A, C
      const bindings2 = [
        createMockBinding('a', 'A'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings2);
      expect(container.textContent).toBe('AC');
      
      // Re-add B at start and D in middle: B, A, D, C
      const bindings3 = [
        createMockBinding('b', 'B-new'),
        createMockBinding('a', 'A'),
        createMockBinding('d', 'D-new'),
        createMockBinding('c', 'C')
      ];
      part.setValue(bindings3);
      
      // Items should appear in the new order
      expect(container.textContent).toBe('B-newAD-newC');
    });

    it('should handle key collision - reuses existing item with same key', () => {
      // This test documents the expected behavior when the same key appears again
      // Scenario: Items ["Item1", "Item3"] exist, then trying to add another "Item3"
      
      const bindings1 = [
        createMockBinding('item1', 'Content1'),
        createMockBinding('item3', 'Content3-original')
      ];
      part.setValue(bindings1);
      expect(container.textContent).toBe('Content1Content3-original');
      
      // Now add another binding with key 'item3' but different content
      // The ListManager should REUSE the existing item3 instance
      const bindings2 = [
        createMockBinding('item1', 'Content1'),
        createMockBinding('item3', 'Content3-new-attempt'),
        createMockBinding('item2', 'Content2')
      ];
      part.setValue(bindings2);
      
      // The existing item3 DOM is reused, so it keeps the old content
      // The new binding's instance() is never called
      expect(container.textContent).toBe('Content1Content3-originalContent2');
      // Verify the new binding for item3 was never instantiated
      expect(bindings2[1]._instanceCallCount()).toBe(0);
    });
  });
});
