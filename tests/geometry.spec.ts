import { describe, expect, it } from "vitest";
import { contains, intersects, workingArea } from "../src/engine/geometry";

describe("intersects", () => {
  it("detects two overlapping rects", () => {
    expect(
      intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toBe(true);
  });

  it("detects shared-edge rects as NOT overlapping", () => {
    expect(
      intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }),
    ).toBe(false);
  });

  it("detects separate rects as not overlapping", () => {
    expect(
      intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 }),
    ).toBe(false);
  });

  it("detects full containment as overlapping", () => {
    expect(
      intersects({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBe(true);
  });
});

describe("contains", () => {
  it("accepts a rect fully inside", () => {
    expect(contains({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
  });

  it("rejects a rect overflowing the right edge", () => {
    expect(contains({ x: 0, y: 0, width: 100, height: 100 }, { x: 90, y: 10, width: 20, height: 20 })).toBe(false);
  });

  it("rejects a rect overflowing the top-left", () => {
    expect(contains({ x: 0, y: 0, width: 100, height: 100 }, { x: -1, y: 0, width: 20, height: 20 })).toBe(false);
  });

  it("accepts a rect exactly matching the bounds", () => {
    expect(contains({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
  });
});

describe("workingArea", () => {
  it("subtracts safe-area insets from all edges", () => {
    const area = workingArea({ width: 320, height: 480 }, { top: 20, right: 10, bottom: 30, left: 10 });
    expect(area).toEqual({ x: 10, y: 20, width: 300, height: 430 });
  });

  it("returns the full surface when no safe area is given", () => {
    const area = workingArea({ width: 320, height: 480 }, undefined);
    expect(area).toEqual({ x: 0, y: 0, width: 320, height: 480 });
  });
});
