export interface TextMeasurement {
  /** width of the widest wrapped line, never larger than maxWidth */
  width: number;
  height: number;
  lines: number;
  /** true when the text needs more lines than maxLines allows */
  overflowed?: boolean;
}

export interface TextMeasurer {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number, weight?: string): TextMeasurement;
}

const CHAR_WIDTH_FACTOR = 0.55;
export const LINE_HEIGHT_FACTOR = 1.3;

export const estimateMeasurer: TextMeasurer = {
  measure(text: string, fontSize: number, maxWidth: number, maxLines?: number): TextMeasurement {
    const charWidth = fontSize * CHAR_WIDTH_FACTOR;
    const totalWidth = text.length * charWidth;
    const naturalLines = maxWidth > 0 ? Math.max(1, Math.ceil(totalWidth / maxWidth)) : 1;
    const lines = maxLines !== undefined ? Math.min(naturalLines, maxLines) : naturalLines;
    const perLineWidth = totalWidth / naturalLines;
    return {
      width: maxWidth > 0 ? Math.min(perLineWidth, maxWidth) : perLineWidth,
      height: lines * fontSize * LINE_HEIGHT_FACTOR,
      lines,
      overflowed: maxLines !== undefined && naturalLines > maxLines,
    };
  },
};
