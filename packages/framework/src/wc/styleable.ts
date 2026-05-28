/**
 * A constructor type for classes that can be mixed with Styleable.
 */
type Constructor<T = object> = abstract new(...args: any[]) => T;

/**
 * Interface for classes with lifecycle callbacks.
 */
interface HasConnectedCallback {
  connectedCallback?(): void;
  shadowRoot: ShadowRoot | null;
  attachShadow(init: ShadowRootInit): ShadowRoot;
}

/**
 * Interface for the static side of a Styleable component.
 * Allows defining base styles and accepting custom style overrides.
 */
export interface StyleableStatic {
  /**
   * Base styles for the component, wrapped in @layer base.
   * Can be a CSSStyleSheet or raw CSS string.
   */
  styles?: CSSStyleSheet | string;

  /**
   * Custom styles injected by the user for white-labeling.
   * These are added to @layer custom which has higher priority than base.
   */
  customStyles?: CSSStyleSheet | string;
}

/**
 * Interface for Styleable instances.
 */
export interface StyleableInstance {
  /**
   * Instance-level custom styles that override class-level customStyles.
   */
  customStyles?: CSSStyleSheet | string;
}

// Cache for converted stylesheets
const sheetCache = new WeakMap<object, CSSStyleSheet>();
const stringSheetCache = new Map<string, CSSStyleSheet>();

/**
 * Converts a CSS string or CSSStyleSheet to a CSSStyleSheet.
 */
function toStyleSheet(css: CSSStyleSheet | string): CSSStyleSheet {
  if (css instanceof CSSStyleSheet) {
    return css;
  }

  // Check string cache
  let sheet = stringSheetCache.get(css);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    stringSheetCache.set(css, sheet);
  }
  return sheet;
}

/**
 * Wraps CSS in a layer if not already layered.
 */
function wrapInLayer(css: string, layer: string): string {
  if (css.includes("@layer")) {
    return css;
  }
  return `@layer ${layer} { ${css} }`;
}

/**
 * Creates a stylesheet with layer declarations for proper cascade ordering.
 */
function createLayerOrderSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync("@layer base, custom;");
  return sheet;
}

const layerOrderSheet = createLayerOrderSheet();

/**
 * Mixin that adds adoptable stylesheet support with layer-based theming.
 *
 * @example
 * ```typescript
 * import styles from './my-component.css?inline';
 *
 * class MyComponent extends Styleable(ReactiveElement) {
 *   static styles = styles;
 *
 *   template() {
 *     return html`<div>content</div>`;
 *   }
 * }
 *
 * // User customization:
 * MyComponent.customStyles = `
 *   button { background: red; }
 * `;
 * ```
 */
export function Styleable<TBase extends Constructor<HTMLElement & HasConnectedCallback>>(
  Base: TBase,
): TBase & Constructor<StyleableInstance> {
  abstract class StyleableElement extends Base implements StyleableInstance {
    /**
     * Instance-level custom styles.
     */
    customStyles?: CSSStyleSheet | string;

    override connectedCallback(): void {
      this.#adoptStyles();
      super.connectedCallback?.();
    }

    #adoptStyles(): void {
      const ctor = this.constructor as unknown as StyleableStatic;
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });

      const sheets: CSSStyleSheet[] = [layerOrderSheet];

      // Add base styles from static property
      if (ctor.styles) {
        const baseCSS = typeof ctor.styles === "string"
          ? wrapInLayer(ctor.styles, "base")
          : ctor.styles;
        sheets.push(toStyleSheet(baseCSS));
      }

      // Add custom styles (instance takes precedence over static)
      const customCSS = this.customStyles ?? ctor.customStyles;
      if (customCSS) {
        const wrappedCustom = typeof customCSS === "string"
          ? wrapInLayer(customCSS, "custom")
          : customCSS;
        sheets.push(toStyleSheet(wrappedCustom));
      }

      root.adoptedStyleSheets = sheets;
    }
  }

  return StyleableElement;
}
