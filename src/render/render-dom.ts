/**
 * Pure-function DOM renderer. It consumes a fully resolved layout and makes
 * zero layout decisions of its own — element objects get exact positions and
 * sizes from ResolvedLayout.
 */
import type { AdSpec, ResolvedLayout, SurfaceProfile } from "../engine/types";

export interface RenderDomOptions {
  /** draw debug band boundaries / dropped markers */
  debug?: boolean;
  /** scale the surface down for display (e.g. 0.5) */
  displayScale?: number;
}

function styleFor(el: { role: string; type: string }): Partial<CSSStyleDeclaration> {
  const base: Partial<CSSStyleDeclaration> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    borderRadius: "6px",
    overflow: "hidden",
  };
  switch (el.role) {
    case "hero":
      return { ...base, background: "linear-gradient(135deg,#ffd8a8,#ff922b)", color: "#1a1a1a" };
    case "primary":
      return { ...base, color: "#111", fontWeight: "700", lineHeight: "1.3" };
    case "action":
      return { ...base, background: "#1971c2", color: "#fff", fontWeight: "600" };
    case "secondary":
      return { ...base, color: "#333" };
    case "branding":
      return { ...base, background: "#f1f3f5", opacity: "0.9" };
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
  host.innerHTML = "";
  host.style.position = "relative";
  host.style.width = `${surface.width * scale}px`;
  host.style.height = `${surface.height * scale}px`;
  host.style.overflow = "hidden";
  host.style.background = "#fafafa";

  for (const resolved of layout.elements) {
    if (resolved.status === "dropped") {
      if (options.debug) {
        const marker = document.createElement("div");
        marker.textContent = `✕ ${resolved.id}`;
        Object.assign(marker.style, {
          position: "absolute",
          left: "4px",
          bottom: "4px",
          fontSize: "10px",
          color: "#e03131",
          fontFamily: "monospace",
        });
        host.appendChild(marker);
      }
      continue;
    }

    const specEl = spec.elements.find((e) => e.id === resolved.id)!;
    const box = document.createElement("div");
    box.dataset.elementId = resolved.id;
    Object.assign(box.style, {
      position: "absolute",
      left: `${resolved.x * scale}px`,
      top: `${resolved.y * scale}px`,
      width: `${resolved.width * scale}px`,
      height: `${resolved.height * scale}px`,
      ...styleFor(specEl),
    } as CSSStyleDeclaration);

    if (resolved.status === "truncated" && options.debug !== false) {
      box.style.border = "1px dashed orange";
    }
    if (resolved.scale !== undefined) box.title = `scaled to ${(resolved.scale * 100).toFixed(0)}%`;

    if (resolved.fontSize !== undefined) {
      box.style.fontSize = `${resolved.fontSize * scale}px`;
    }

    if (specEl.type === "text") {
      box.textContent = resolved.text ?? "";
      box.style.whiteSpace = "nowrap";
      box.style.textOverflow = "ellipsis";
    } else if (specEl.type === "button") {
      box.textContent = specEl.content.label;
    } else {
      // image / logo: draw a placeholder visual (no real asset needed)
      const ph = document.createElement("div");
      const label = specEl.type === "logo" ? "LOGO" : "IMAGE";
      Object.assign(ph.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontSize: "12px",
        letterSpacing: "2px",
        color: specEl.type === "logo" ? "#495057" : "rgba(0,0,0,0.55)",
      } as CSSStyleDeclaration);
      ph.textContent = label;
      box.appendChild(ph);
    }

    host.appendChild(box);
  }
}
