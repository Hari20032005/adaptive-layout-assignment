/**
 * Canvas rendering backend. Consumes the exact same ResolvedLayout as the
 * DOM renderer and makes zero layout decisions — proving the resolver is
 * renderer-agnostic.
 */
import type { AdSpec, ResolvedLayout } from "../engine/types";

export interface RenderCanvasOptions {
  debug?: boolean;
}

const ROLE_FILL: Record<string, string> = {
  hero: "#ffb35c",
  primary: "transparent",
  action: "#1971c2",
  secondary: "transparent",
  branding: "#e9ecef",
};

const ROLE_TEXT: Record<string, string> = {
  hero: "#412d16",
  primary: "#111111",
  action: "#ffffff",
  secondary: "#333333",
  branding: "#495057",
};

export function renderToCanvas(
  spec: AdSpec,
  layout: ResolvedLayout,
  surface: { width: number; height: number },
  canvas: HTMLCanvasElement,
  options: RenderCanvasOptions = {},
): void {
  canvas.width = surface.width;
  canvas.height = surface.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (options.debug) {
    ctx.strokeStyle = "#dee2e6";
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }

  for (const el of layout.elements) {
    if (el.status === "dropped") {
      if (options.debug) {
        ctx.fillStyle = "#e03131";
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`✕ ${el.id}`, 6, canvas.height - 6);
      }
      continue;
    }

    const specEl = spec.elements.find((e) => e.id === el.id);
    if (!specEl) continue;

    if (el.status === "truncated") {
      ctx.strokeStyle = "#ff922b";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(el.x + 0.5, el.y + 0.5, el.width - 1, el.height - 1);
      ctx.setLineDash([]);
    }

    const fill = ROLE_FILL[el.role] ?? "transparent";
    if (fill !== "transparent") {
      ctx.fillStyle = fill;
      roundRect(ctx, el.x, el.y, el.width, el.height, 6);
      ctx.fill();
    }

    ctx.fillStyle = ROLE_TEXT[el.role] ?? "#111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (specEl.type === "text") {
      ctx.font = `${el.fontSize ?? 16}px system-ui, sans-serif`;
      clipText(ctx, el.text ?? "", el.x + 4, el.y + el.height / 2, el.width - 8, 1);
    } else if (specEl.type === "button") {
      ctx.font = "16px system-ui, sans-serif";
      roundRect(ctx, el.x + 2, el.y + 2, el.width - 4, el.height - 4, 6);
      ctx.fill();
      ctx.fillStyle = "white";
      clipText(ctx, specEl.content.label, el.x + el.width / 2, el.y + el.height / 2, el.width - 8, 1);
    } else {
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = el.role === "hero" ? "rgba(0,0,0,0.45)" : "#495057";
      roundRect(ctx, el.x + 2, el.y + 2, el.width - 4, el.height - 4, 6);
      ctx.stroke();
      clipText(ctx, specEl.type === "logo" ? "LOGO" : "IMAGE", el.x + el.width / 2, el.y + el.height / 2, el.width - 8, 1);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clipText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, _lines: number): void {
  _lines;
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) {
    out = `${out.slice(0, -2)}…`;
  }
  ctx.fillText(out, x, y, maxWidth);
}
