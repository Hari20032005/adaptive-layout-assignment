import { afterEach, describe, expect, it, vi } from "vitest";
import { canvasMeasurer, resetTextMetricsCache } from "../src/render/text-metrics";

/**
 * Regression tests for the browser text measurer. The original bug: it
 * returned `width: maxWidth` for every call, which inflated the CTA button's
 * required width to the full surface width and caused the engine to drop the
 * CTA on every surface.
 */

function mockCanvasWithMetrics(charWidthFactor = 0.6) {
  const original = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName !== "canvas") return original(tagName);
    const ctx = {
      font: "16px system-ui",
      measureText(text: string) {
        const size = Number.parseInt(ctx.font, 10) || 16;
        return { width: text.length * size * charWidthFactor };
      },
    };
    return { getContext: () => ctx } as unknown as HTMLElement;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  resetTextMetricsCache();
});

describe("canvasMeasurer", () => {
  it("returns the real measured text width, not the available maxWidth", () => {
    mockCanvasWithMetrics(0.6);
    const m = canvasMeasurer.measure("AB", 10, 1000, 1);
    expect(m.width).toBeCloseTo(12, 1); // 2 chars * 10px * 0.6
    expect(m.width).toBeLessThan(1000);
  });

  it("reports a short label's intrinsic width so it fits small surfaces", () => {
    mockCanvasWithMetrics(0.6);
    const m = canvasMeasurer.measure("Shop Now", 16, 320, 1);
    // 8 chars * 16 * 0.6 = 76.8 — a fraction of the surface width
    expect(m.width).toBeLessThan(120);
  });

  it("wraps long text into multiple lines and never exceeds maxWidth", () => {
    mockCanvasWithMetrics(0.6);
    const m = canvasMeasurer.measure("Free shipping on orders over fifty dollars today", 16, 120);
    expect(m.lines).toBeGreaterThan(1);
    expect(m.width).toBeLessThanOrEqual(120.5);
  });

  it("flags overflow when wrapped lines exceed maxLines", () => {
    mockCanvasWithMetrics(0.6);
    const m = canvasMeasurer.measure("a b c d e f g h i j k l m n o p", 16, 40, 2);
    expect(m.lines).toBeLessThanOrEqual(2);
    expect(m.overflowed).toBe(true);
  });

  it("does not flag overflow when the text fits", () => {
    mockCanvasWithMetrics(0.6);
    const m = canvasMeasurer.measure("Hi", 16, 400, 2);
    expect(m.overflowed).toBe(false);
  });
});
