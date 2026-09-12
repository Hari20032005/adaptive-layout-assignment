export interface TextMeasurement {
  width: number;
  height: number;
  lines: number;
}

export interface TextMeasurer {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number): TextMeasurement;
}

const CHAR_WIDTH_FACTOR = 0.55;
const LINE_HEIGHT_FACTOR = 1.3;

export const estimateMeasurer: TextMeasurer = {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number): TextMeasurement {
    const charWidth = fontSize * CHAR_WIDTH_FACTOR;
    const totalWidth = text.length * charWidth;
    let lines = maxWidth > 0 ? Math.max(1, Math.ceil(totalWidth / maxWidth)) : 1;
    if (maxLines !== undefined) lines = Math.min(lines, maxLines);
    const perLineWidth = totalWidth / lines;
    return {
      width: maxWidth > 0 ? Math.min(perLineWidth, maxWidth) : perLineWidth,
      height: lines * fontSize * LINE_HEIGHT_FACTOR,
      lines,
    };
  },
};

/**
 * Real text measurement using an offscreen canvas — the browser's actual
 * text metrics rather than a char-count estimate. Falls back to the
 * estimator when no canvas context is available (e.g. in Node tests).
 */
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
      height: out.length * fontSize * LINE_HEIGHT_FACTOR,
      lines: out.length,
    };
  },
};
