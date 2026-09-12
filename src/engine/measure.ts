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
