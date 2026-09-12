import { describe, expect, it } from "vitest";
import { estimateMeasurer } from "../src/engine/measure";

describe("estimateMeasurer", () => {
  it("returns single line for short text with wide room", () => {
    const m = estimateMeasurer.measure("Buy Now", 24, 400);
    expect(m.lines).toBe(1);
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThanOrEqual(24);
  });

  it("wraps into multiple lines when text exceeds maxWidth", () => {
    const m = estimateMeasurer.measure("Super Amazing Headline Product Text", 24, 100);
    expect(m.lines).toBeGreaterThan(1);
    expect(m.height).toBeGreaterThan(24);
  });

  it("respects maxLines cap", () => {
    const m = estimateMeasurer.measure("A Very Long Headline That Will Not Fit In Two Lines At All", 24, 80, 2);
    expect(m.lines).toBeLessThanOrEqual(2);
  });
});
