/**
 * Test utilities for parts module.
 * This file contains helper functions for creating test fixtures and assertions.
 */

import { TextTemplate } from './parts.js';

/**
 * Creates a test element with the specified tag name.
 */
export function createTestElement(tag: string = 'div'): Element {
  return document.createElement(tag);
}

/**
 * Creates a TextTemplate instance for testing.
 */
export function createTextTemplate(strings: string[]): TextTemplate {
  return new TextTemplate(strings);
}

/**
 * Helper to create a spy function for event listeners.
 */
export function createEventSpy(): EventListener & { calls: Event[] } {
  const calls: Event[] = [];
  const spy = ((event: Event) => {
    calls.push(event);
  }) as EventListener & { calls: Event[] };
  spy.calls = calls;
  return spy;
}

/**
 * Helper to dispatch a custom event on an element.
 */
export function dispatchTestEvent(element: Element, eventName: string): Event {
  const event = new Event(eventName);
  element.dispatchEvent(event);
  return event;
}

/**
 * Helper to check if an element has an attribute.
 */
export function hasAttribute(element: Element, name: string): boolean {
  return element.hasAttribute(name);
}

/**
 * Helper to get an attribute value.
 */
export function getAttribute(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

/**
 * Helper to get a property value from an element.
 */
export function getProperty(element: Element, name: string): unknown {
  return (element as unknown as Record<string, unknown>)[name];
}

/**
 * Helper to set a property value on an element.
 */
export function setProperty(element: Element, name: string, value: unknown): void {
  (element as unknown as Record<string, unknown>)[name] = value;
}
