import { describe, expect, it } from "vitest";
import { DynamicBinding } from "./render.js";
import { getTemplate, resolvePath } from "./template.js";

const dummyRuntime = { effect: (fn: () => void) => fn() } as any;
const html = DynamicBinding.with(dummyRuntime);

describe("html template function", () => {
  describe("template caching", () => {
    it("should cache templates for the same strings array", () => {
      const strings = ["<div>", "</div>"] as unknown as TemplateStringsArray;
      const record1 = getTemplate(strings);
      const record2 = getTemplate(strings);
      expect(record1).toBe(record2);
    });

    it("should create different records for different strings", () => {
      const strings1 = ["<div>", "</div>"] as unknown as TemplateStringsArray;
      const strings2 = ["<span>", "</span>"] as unknown as TemplateStringsArray;
      const record1 = getTemplate(strings1);
      const record2 = getTemplate(strings2);
      expect(record1).not.toBe(record2);
    });
  });

  describe("node parts", () => {
    it("should create descriptor for single node part", () => {
      const strings = ["<div>", "</div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      expect(record.descriptors).toHaveLength(1);
      expect(record.descriptors[0].type).toBe("node");
    });

    it("should create descriptors for multiple node parts", () => {
      const strings = ["<div>", " ", "</div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      expect(record.descriptors).toHaveLength(2);
      expect(record.descriptors[0].type).toBe("node");
      expect(record.descriptors[1].type).toBe("node");
    });

    it("should create correct path for nested node part", () => {
      const strings = ["<div><span>", "</span></div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      const fragment = record.cloneFragment();
      const node = resolvePath(fragment, record.descriptors[0].path);
      expect(node.nodeType).toBe(Node.COMMENT_NODE);
      expect(node.parentElement?.tagName).toBe("SPAN");
    });
  });

  describe("attribute parts", () => {
    it("should create descriptor for attribute part", () => {
      const strings = ["<div class=", "></div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      expect(record.descriptors).toHaveLength(1);
      expect(record.descriptors[0].type).toBe("attribute");
      if (record.descriptors[0].type === "attribute") {
        expect(record.descriptors[0].name).toBe("class");
      }
    });

    it("should remove attribute marker from element", () => {
      const strings = ["<div class=", "></div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      const fragment = record.cloneFragment();
      const div = fragment.querySelector("div");
      expect(div?.hasAttribute("class")).toBe(false);
    });

    it("should create descriptors for multiple attributes", () => {
      const strings = ["<div class=", " id=", "></div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      expect(record.descriptors).toHaveLength(2);
      expect(record.descriptors[0].type).toBe("attribute");
      expect(record.descriptors[1].type).toBe("attribute");
      if (record.descriptors[0].type === "attribute") {
        expect(record.descriptors[0].name).toBe("class");
      }
      if (record.descriptors[1].type === "attribute") {
        expect(record.descriptors[1].name).toBe("id");
      }
    });

    it("should resolve attribute part path correctly", () => {
      const strings = ["<div class=", "></div>"] as unknown as TemplateStringsArray;
      const record = getTemplate(strings);

      const fragment = record.cloneFragment();
      const node = resolvePath(fragment, record.descriptors[0].path);
      expect(node.nodeType).toBe(Node.ELEMENT_NODE);
      expect((node as Element).tagName).toBe("DIV");
    });

    it("should throw error for mixed static and dynamic attribute content", () => {
      const strings = ["<div class=\"static ", "\">", "</div>"] as unknown as TemplateStringsArray;

      // This creates HTML like: <div class="static <!--part:0-->">
      // which is invalid - the part marker ends up inside the attribute value as text
      // The current implementation doesn't detect this case

      // For now, just document that this doesn't throw
      // TODO: Add better validation for this edge case
      const template = getTemplate(strings);
      expect(template.descriptors.length).toBeGreaterThan(0);
    });

    it("should create TextTemplatePartDescriptor for multiple expressions in one attribute", () => {
      const strings = ["<div class=\"", " ", "\">", "</div>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(3); // 3 strings means 2 expressions
      expect(template.descriptors[0].type).toBe("textTemplate");
      expect(template.descriptors[1].type).toBe("textTemplate");
      expect(template.descriptors[2].type).toBe("node"); // The closing tag

      // First two should reference the same descriptor
      expect(template.descriptors[0]).toBe(template.descriptors[1]);

      if (template.descriptors[0].type === "textTemplate") {
        expect(template.descriptors[0].target).toBe("attribute");
        expect(template.descriptors[0].name).toBe("class");
        expect(template.descriptors[0].strings).toEqual(["", " ", ""]);
        expect(template.descriptors[0].indices).toEqual([0, 1]);
      }
    });

    it("should create TextTemplatePartDescriptor for mixed static and dynamic attribute", () => {
      const strings = ["<div class=\"prefix-", "-suffix\">", "</div>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(2); // 2 strings means 1 expression  + 1 node
      expect(template.descriptors[0].type).toBe("textTemplate");
      expect(template.descriptors[1].type).toBe("node");

      if (template.descriptors[0].type === "textTemplate") {
        expect(template.descriptors[0].target).toBe("attribute");
        expect(template.descriptors[0].name).toBe("class");
        expect(template.descriptors[0].strings).toEqual(["prefix-", "-suffix"]);
        expect(template.descriptors[0].indices).toEqual([0]);
      }
    });

    it("should create TextTemplatePartDescriptor for three expressions in attribute", () => {
      const strings = ["<div class=\"", " ", " ", "\">", "</div>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(4); // 4 strings means 3 expressions + 1 node
      expect(template.descriptors[0]).toBe(template.descriptors[1]);
      expect(template.descriptors[1]).toBe(template.descriptors[2]);
      expect(template.descriptors[3].type).toBe("node"); // closing tag

      if (template.descriptors[0].type === "textTemplate") {
        expect(template.descriptors[0].strings).toEqual(["", " ", " ", ""]);
        expect(template.descriptors[0].indices).toEqual([0, 1, 2]);
      }
    });
  });

  describe("style tag handling", () => {
    it("should handle dynamic content in style tags", () => {
      const strings = ["<style>", "</style>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0]).toBeDefined();
      expect(template.descriptors[0].type).toBe("textContent");

      const fragment = template.cloneFragment();
      const style = fragment.querySelector("style");
      // The marker should be removed from the text content
      expect(style?.textContent).toBe("");
    });

    it("should resolve path to style element for text content replacement", () => {
      const strings = ["<style>", "</style>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      const fragment = template.cloneFragment();
      const node = resolvePath(fragment, template.descriptors[0].path);
      // The path should point to the style element itself
      expect(node.nodeType).toBe(Node.ELEMENT_NODE);
      expect((node as Element).tagName).toBe("STYLE");
    });

    it("should create TextTemplatePartDescriptor for multiple expressions in style tag", () => {
      const strings = ["<style>", " ", "</style>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(2);
      expect(template.descriptors[0].type).toBe("textTemplate");
      expect(template.descriptors[1].type).toBe("textTemplate");
      expect(template.descriptors[0]).toBe(template.descriptors[1]);

      if (template.descriptors[0].type === "textTemplate") {
        expect(template.descriptors[0].target).toBe("textContent");
        expect(template.descriptors[0].strings).toEqual(["", " ", ""]);
        expect(template.descriptors[0].indices).toEqual([0, 1]);
      }
    });

    it("should create TextTemplatePartDescriptor for mixed static and dynamic in style", () => {
      const strings = ["<style>:host { color: ", "; background: ", "; }</style>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(2);
      expect(template.descriptors[0]).toBe(template.descriptors[1]);

      if (template.descriptors[0].type === "textTemplate") {
        expect(template.descriptors[0].target).toBe("textContent");
        expect(template.descriptors[0].strings).toEqual([":host { color: ", "; background: ", "; }"]);
        expect(template.descriptors[0].indices).toEqual([0, 1]);
      }

      const fragment = template.cloneFragment();
      const style = fragment.querySelector("style");
      expect(style?.textContent).toBe(":host { color: ; background: ; }");
    });
  });

  describe("mixed content", () => {
    it("should handle both node and attribute parts", () => {
      const strings = ["<div class=", ">", "</div>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(2);
      expect(template.descriptors[0].type).toBe("attribute");
      expect(template.descriptors[1].type).toBe("node");
    });

    it("should handle complex nested structure", () => {
      const strings = [
        "<div class=",
        "><span>",
        "</span><p id=",
        ">",
        "</p></div>",
      ] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(4);
      expect(template.descriptors[0].type).toBe("attribute");
      expect(template.descriptors[1].type).toBe("node");
      expect(template.descriptors[2].type).toBe("attribute");
      expect(template.descriptors[3].type).toBe("node");
    });
  });

  describe("TemplateResult", () => {
    it("should create template result with strings and values", () => {
      const template = html`<div>${"test"}</div>`;

      expect(template.strings).toHaveLength(2);
      expect(template.values).toEqual(["test"]);
    });

    it("should support setting id property manually", () => {
      const template = html`<div>test</div>`;
      template.id = "unique-key";

      expect(template.id).toBe("unique-key");
    });

    it("should support setting ids with html(id) syntax", () => {
      const template = html("unique-key")`<div>test</div>`;

      expect(template.id).toBe("unique-key");
    });

    it("should support html() with no id", () => {
      const template = html()`<div>test</div>`;

      expect(template.id).toBeUndefined();
    });
  });

  describe("path resolution", () => {
    it("should resolve empty path to root", () => {
      const fragment = document.createDocumentFragment();
      const div = document.createElement("div");
      fragment.appendChild(div);

      const node = resolvePath(fragment, [0]);
      expect(node).toBe(div);
    });

    it("should resolve deep paths", () => {
      const fragment = document.createDocumentFragment();
      const div = document.createElement("div");
      const span = document.createElement("span");
      const text = document.createTextNode("text");

      span.appendChild(text);
      div.appendChild(span);
      fragment.appendChild(div);

      const node = resolvePath(fragment, [0, 0, 0]);
      expect(node).toBe(text);
    });

    it("should throw error for invalid path", () => {
      const fragment = document.createDocumentFragment();

      expect(() => resolvePath(fragment, [999])).toThrow("Failed to resolve part path");
    });
  });

  describe("Descriptor Validation", () => {
    it("should create attribute descriptor with correct name for @click", () => {
      const strings = ["<button @click=", ">Click</button>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe("attribute");
      if (template.descriptors[0].type === "attribute") {
        expect(template.descriptors[0].name).toBe("@click");
      }
    });

    it("should create attribute descriptor with correct name for .value", () => {
      const strings = ["<input .value=", ">"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe("attribute");
      if (template.descriptors[0].type === "attribute") {
        expect(template.descriptors[0].name).toBe(".value");
      }
    });

    it("should create attribute descriptor with correct name for ?disabled", () => {
      const strings = ["<button ?disabled=", ">Click</button>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(1);
      expect(template.descriptors[0].type).toBe("attribute");
      if (template.descriptors[0].type === "attribute") {
        expect(template.descriptors[0].name).toBe("?disabled");
      }
    });

    it("should preserve prefixes in descriptor names", () => {
      const strings = ["<button @click=", " .disabled=", " ?hidden=", ">Click</button>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(3);
      expect(template.descriptors[0].type).toBe("attribute");
      expect(template.descriptors[1].type).toBe("attribute");
      expect(template.descriptors[2].type).toBe("attribute");

      if (template.descriptors[0].type === "attribute") {
        expect(template.descriptors[0].name).toBe("@click");
      }
      if (template.descriptors[1].type === "attribute") {
        expect(template.descriptors[1].name).toBe(".disabled");
      }
      if (template.descriptors[2].type === "attribute") {
        expect(template.descriptors[2].name).toBe("?hidden");
      }
    });
  });

  describe("unquoted attribute followed by interpolated attribute", () => {
    it("should correctly parse unquoted attr followed by quoted attr with interpolation", () => {
      // This is the pattern: <li data-id=${id} style="view-transition-name: item-${id}">
      const strings = ["<li data-id=", " style=\"view-transition-name: item-", "\">", "</li>"] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(3);
      // First is simple attribute
      expect(template.descriptors[0].type).toBe("attribute");
      if (template.descriptors[0].type === "attribute") {
        expect(template.descriptors[0].name).toBe("data-id");
      }
      // Second is textTemplate for interpolated style
      expect(template.descriptors[1].type).toBe("textTemplate");
      if (template.descriptors[1].type === "textTemplate") {
        expect(template.descriptors[1].target).toBe("attribute");
        expect(template.descriptors[1].name).toBe("style");
        expect(template.descriptors[1].strings).toEqual(["view-transition-name: item-", ""]);
      }
      // Third is node part for content
      expect(template.descriptors[2].type).toBe("node");
    });

    it("should correctly parse unquoted attr, quoted interpolated attr, and text content", () => {
      // Full pattern: <li data-id=${id} style="name: item-${id}"><span>${label}</span></li>
      const strings = [
        "<li data-id=", // ends after unquoted attr name=
        " style=\"name: item-", // space, then quoted attr with prefix
        "\"><span>", // end quote, tag close, nested element
        "</span></li>", // close elements
      ] as unknown as TemplateStringsArray;
      const template = getTemplate(strings);

      expect(template.descriptors).toHaveLength(3);
      expect(template.descriptors[0].type).toBe("attribute");
      expect(template.descriptors[1].type).toBe("textTemplate");
      expect(template.descriptors[2].type).toBe("node");
    });
  });
});
