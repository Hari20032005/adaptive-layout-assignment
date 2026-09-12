/**
 * Browser-side adapter: real text measurement via an offscreen canvas.
 * Lives outside src/engine/ to keep the resolver pure and DOM-free.
 */
import { estimateMeasurer, type TextMeasurement, type TextMeasurer } from "../engine/measure";

const LINE_HEIGHT_FACTOR = 1.3;

interface MockableContext {
  font: string;
  measureText(text: string): { width: number };
}

let cachedCanvas: HTMLCanvasElement | null = null;

function getContext(): MockableContext | null {
  if (typeof document === "undefined") return null;
  if (!cachedCanvas) cachedCanvas = document.createElement("canvas");
  return (cachedCanvas.getContext("2d") as unknown as MockableContext | null) ?? null;
}

/** Test hook: drop the cached canvas so a fresh mock can take effect. */
export function resetTextMetricsCache(): void {
  cachedCanvas = null;
}

export const canvasMeasurer: TextMeasurer = {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number): TextMeasurement {
    if (typeof document === "undefined" || maxWidth <= 0) {
      return estimateMeasurer.measure(text, fontSize, maxWidth, maxLines);
    }
    const ctx = getContext();
    if (!ctx) return estimateMeasurer.measure(text, fontSize, maxWidth, maxLines);

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);

    const naturalLines = lines.length;
    const overflowed = maxLines !== undefined && naturalLines > maxLines;
    const shown = overflowed ? lines.slice(0, maxLines) : lines;
    if (overflowed && shown.length > 0) {
      shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
    }

    // real width of the widest rendered line — NOT the available maxWidth
    const width = shown.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);

    return {
      width: Math.min(width, maxWidth),
      height: shown.length * fontSize * LINE_HEIGHT_FACTOR,
      lines: shown.length,
      overflowed,
    };
  },
};
