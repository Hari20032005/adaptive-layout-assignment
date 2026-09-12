/**
 * Pure-function DOM renderer. It consumes a fully resolved layout and makes
 * zero layout decisions of its own — element objects get exact positions and
 * sizes from ResolvedLayout.
 *
 * DOM nodes are keyed by element id and reused between renders, which allows
 * CSS transitions to animate position/size when the surface changes.
 */
import type { AdSpec, ResolvedLayout, SurfaceProfile } from "../engine/types";

export interface RenderDomOptions {
  /** draw debug band boundaries / dropped markers */
  debug?: boolean;
  /** scale the surface down for display (e.g. 0.5) */
  displayScale?: number;
}

const TRANSITION = "all 320ms cubic-bezier(0.22, 1, 0.36, 1)";

function styleFor(role: string): Partial<CSSStyleDeclaration> {
  const base: Partial<CSSStyleDeclaration> = {
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
    borderRadius: "8px",
    overflow: "hidden",
    transition: TRANSITION,
    willChange: "left, top, width, height",
  };
  switch (role) {
    case "hero":
      return { ...base, background: "linear-gradient(135deg,#ffd8a8,#ff922b)", color: "#1a1a1a" };
    case "primary":
      return { ...base, color: "#111", fontWeight: "700", lineHeight: "1.25" };
    case "action":
      return { ...base, background: "linear-gradient(180deg,#228be6,#1971c2)", color: "#fff", fontWeight: "600" };
    case "secondary":
      return { ...base, color: "#333" };
    case "branding":
      return { ...base, background: "transparent", color: "#495057" };
    default:
      return base;
  }
}

export function renderToDom(
  spec: AdSpec,
  layout: ResolvedLayout,
  surface: SurfaceProfile,
  host: HTMLElement,
  options: RenderDomOptions = {},
): void {
  const scale = options.displayScale ?? 1;
  host.style.position = "relative";
  host.style.width = `${surface.width * scale}px`;
  host.style.height = `${surface.height * scale}px`;
  host.style.overflow = "hidden";
  host.style.background = "linear-gradient(160deg,#fdfdfd,#f3f4f6)";

  const existing = new Map<string, HTMLElement>();
  for (const child of Array.from(host.children) as HTMLElement[]) {
    const id = child.dataset.elementId;
    if (id) existing.set(id, child);
  }

  const seen = new Set<string>();

  for (const resolved of layout.elements) {
    if (resolved.status === "dropped") continue;
    seen.add(resolved.id);

    const specEl = spec.elements.find((e) => e.id === resolved.id);
    if (!specEl) continue;

    let box = existing.get(resolved.id);
    if (!box) {
      box = document.createElement("div");
      box.dataset.elementId = resolved.id;
      host.appendChild(box);
    }

    Object.assign(box.style, {
      position: "absolute",
      left: `${resolved.x * scale}px`,
      top: `${resolved.y * scale}px`,
      width: `${resolved.width * scale}px`,
      height: `${resolved.height * scale}px`,
      ...styleFor(specEl.role),
    } as CSSStyleDeclaration);

    box.style.border = "";
    box.style.padding = "";
    box.style.justifyContent = "";
    box.style.whiteSpace = "";
    box.style.webkitLineClamp = "";
    box.style.webkitBoxOrient = "";
    box.style.textAlign = "";
    box.replaceChildren();

    if (resolved.status === "truncated" && options.debug) {
      box.style.outline = "1px dashed orange";
      box.style.outlineOffset = "-2px";
    } else {
      box.style.outline = "";
    }
    box.title = resolved.scale !== undefined ? `scaled to ${(resolved.scale * 100).toFixed(0)}%` : "";

    if (resolved.fontSize !== undefined) {
      box.style.fontSize = `${resolved.fontSize * scale}px`;
    }

    if (specEl.type === "text") {
      box.style.textAlign = "left";
      box.style.padding = `${4 * scale}px ${6 * scale}px`;
      box.textContent = resolved.text ?? "";
      // wrap within the resolved box and ellipsize at the resolved line count
      box.style.display = "-webkit-box";
      box.style.webkitBoxOrient = "vertical";
      box.style.webkitLineClamp = String(resolved.lines ?? 1);
      box.style.whiteSpace = "normal";
      box.style.wordBreak = "break-word";
      box.style.overflow = "hidden";
    } else if (specEl.type === "button") {
      box.style.justifyContent = "center";
      box.textContent = specEl.content.label;
    } else {
      const img = document.createElement("img");
      img.src = specEl.content.src;
      img.alt = specEl.type === "logo" ? "Brand logo" : "Product image";
      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        objectFit: specEl.type === "logo" ? "contain" : "cover",
        padding: specEl.type === "logo" ? `${8 * scale}px` : "0",
        display: "block",
      } as CSSStyleDeclaration);
      box.appendChild(img);
    }
  }

  for (const [id, node] of existing) {
    if (!seen.has(id)) node.remove();
  }

  if (options.debug) {
    const marker = host.querySelector<HTMLElement>("[data-dropped-marker]");
    const dropped = layout.elements.filter((e) => e.status === "dropped");
    if (dropped.length > 0) {
      const el = marker ?? document.createElement("div");
      el.dataset.droppedMarker = "true";
      el.textContent = `dropped: ${dropped.map((d) => d.id).join(", ")}`;
      Object.assign(el.style, {
        position: "absolute",
        left: "6px",
        bottom: "6px",
        fontSize: "10px",
        color: "#e03131",
        fontFamily: "monospace",
        background: "rgba(255,255,255,0.85)",
        padding: "2px 4px",
        borderRadius: "4px",
        transition: TRANSITION,
      } as CSSStyleDeclaration);
      host.appendChild(el);
    } else if (marker) {
      marker.remove();
    }
  }
}
