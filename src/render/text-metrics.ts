/**
 * Browser-side adapter: real text measurement via an offscreen canvas.
 * Lives outside src/engine/ to keep the resolver pure and DOM-free.
 */
import { estimateMeasurer, type TextMeasurement, type TextMeasurer } from "../engine/measure";

export const canvasMeasurer: TextMeasurer = {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number): TextMeasurement {
    if (typeof document === "undefined" || maxWidth <= 0) {
      return estimateMeasurer.measure(text, fontSize, maxWidth, maxLines);
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
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

    let out = lines;
    if (maxLines !== undefined && lines.length > maxLines) {
      out = lines.slice(0, maxLines);
      out[maxLines - 1] = `${out[maxLines - 1]}…`;
    }

    return {
      width: maxWidth,
      height: out.length * fontSize * 1.3,
      lines: out.length,
    };
  },
};
