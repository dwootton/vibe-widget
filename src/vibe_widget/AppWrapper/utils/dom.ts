// Utilities for element filtering and description used by grab/edit flows.

export function isElementVisible(element: Element, computedStyle?: CSSStyleDeclaration): boolean {
  if (!computedStyle) computedStyle = window.getComputedStyle(element);

  if (computedStyle.visibility === "hidden") return false;
  if (computedStyle.display === "none") return false;
  if (parseFloat(computedStyle.opacity) === 0) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}

export function isValidGrabbableElement(element: Element | null): element is Element {
  if (!(element instanceof Element)) return false;

  if (element.closest(".grab-overlay")) return false;
  if (element.closest(".edit-panel")) return false;
  if (element.closest(".loading-overlay")) return false;

  const skipTags = ["SCRIPT", "STYLE", "LINK", "META", "HEAD", "HTML", "BODY", "DEFS", "CLIPPATH"];
  if (skipTags.includes(element.tagName)) return false;

  const computedStyle = window.getComputedStyle(element);

  if (!isElementVisible(element, computedStyle)) return false;

  const isSVGElement = element instanceof SVGElement;
  if (!isSVGElement && computedStyle.pointerEvents === "none") return false;

  const meaningfulTags = [
    "H1", "H2", "H3", "H4", "H5", "H6", "P", "SPAN", "A", "BUTTON",
    "IMG", "SVG", "RECT", "CIRCLE", "PATH", "LINE", "TEXT", "G",
    "CANVAS", "VIDEO", "TABLE", "TH", "TD", "LI", "LABEL", "INPUT",
    "POLYGON", "POLYLINE", "ELLIPSE",
  ];

  const hasMeaningfulTag = meaningfulTags.includes(element.tagName);
  const hasClass = element.classList.length > 0;
  const hasText = element.textContent?.trim().length > 0;

  return hasMeaningfulTag || hasClass || hasText || isSVGElement;
}

export function getElementAtPosition(clientX: number, clientY: number): Element | null {
  const elementsAtPoint = document.elementsFromPoint(clientX, clientY);

  for (const element of elementsAtPoint) {
    if (isValidGrabbableElement(element)) {
      return element;
    }
  }

  return null;
}

export function describeElement(el: Element) {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).join(" ");
  const text = el.textContent?.trim().substring(0, 50);
  const ancestors = getAncestorPath(el);

  const siblingCount = el.parentElement
    ? Array.from(el.parentElement.children).filter((sibling) => sibling.tagName === el.tagName).length
    : 1;

  let attrs = "";
  if (el instanceof SVGElement) {
    attrs = ["fill", "stroke", "d", "cx", "cy", "r", "x", "y", "width", "height"]
      .map((a) => {
        const val = el.getAttribute(a);
        return val ? `${a}="${val.substring(0, 30)}"` : "";
      })
      .filter(Boolean)
      .join(" ");
  }

  const computedStyle = window.getComputedStyle(el);
  const styleHints = {
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor,
    fill: computedStyle.fill,
  };

  return {
    tag,
    classes,
    text: text || null,
    attributes: attrs || null,
    ancestors,
    siblingCount,
    isDataBound: siblingCount > 1,
    styleHints,
    description: `<${tag}${classes ? ` class="${classes}"` : ""}${attrs ? ` ${attrs}` : ""}>${text || ""}</${tag}>`,
  };
}

export function getAncestorPath(el: Element, depth = 3): string {
  const path: string[] = [];
  let current = el.parentElement;
  while (current && path.length < depth) {
    const className =
      typeof current.className === "string"
        ? current.className
        : // @ts-ignore SVGAnimatedString for SVG elements
          current.className?.baseVal || "";

    if (current.tagName !== "DIV" || className) {
      path.push(`${current.tagName.toLowerCase()}${className ? "." + className.split(" ")[0] : ""}`);
    }
    current = current.parentElement;
  }
  return path.reverse().join(" > ");
}
