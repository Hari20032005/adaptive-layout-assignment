import { describe, expect, it } from "vitest";
import { defineAd } from "../src/engine/spec";
import { defineSurface } from "../src/engine/surfaces";

describe("defineAd", () => {
  it("accepts a valid spec and freezes it", () => {
    const ad = defineAd({
      elements: [
        { id: "headline", type: "text", role: "primary", priority: 1, content: { text: "Hello" } },
        { id: "cta", type: "button", role: "action", priority: 2, content: { label: "Buy" } },
      ],
    });
    expect(ad.elements).toHaveLength(2);
    expect(Object.isFrozen(ad)).toBe(true);
  });

  it("throws SpecValidationError on duplicate element ids", () => {
    expect(() =>
      defineAd({
        elements: [
          { id: "x", type: "text", role: "primary", priority: 1, content: { text: "a" } },
          { id: "x", type: "text", role: "secondary", priority: 2, content: { text: "b" } },
        ],
      }),
    ).toThrowError(/id/);
  });

  it("throws SpecValidationError when priority is out of range", () => {
    expect(() =>
      defineAd({
        elements: [
          {
            id: "x",
            type: "text",
            role: "primary",
            priority: 9,
            content: { text: "a" },
          } as never,
        ],
      }),
    ).toThrowError(/priority/);
  });

  it("throws SpecValidationError when a button lacks a label", () => {
    expect(() =>
      defineAd({
        elements: [
          { id: "cta", type: "button", role: "action", priority: 2, content: {} } as never,
        ],
      }),
    ).toThrowError(/label/);
  });
});

describe("defineSurface", () => {
  it("accepts a valid surface profile", () => {
    const s = defineSurface({
      id: "kiosk",
      label: "Retail Kiosk",
      width: 1080,
      height: 1080,
      minTapTarget: 60,
      touchOnly: true,
    });
    expect(s.width).toBe(1080);
  });

  it("throws when safe area exceeds surface dimensions", () => {
    expect(() =>
      defineSurface({
        id: "tiny",
        label: "Tiny",
        width: 100,
        height: 100,
        safeArea: { top: 60, right: 60, bottom: 60, left: 60 },
      }),
    ).toThrowError(/safeArea/);
  });

  it("throws when minTextSize is physically impossible for the height", () => {
    expect(() =>
      defineSurface({
        id: "impossible",
        label: "Impossible",
        width: 400,
        height: 100,
        minTextSize: 120,
        viewingDistance: "far",
      }),
    ).toThrowError(/minTextSize/);
  });

  it("throws when minTapTarget exceeds the smaller dimension", () => {
    expect(() =>
      defineSurface({
        id: "tap",
        label: "Tap",
        width: 40,
        height: 40,
        minTapTarget: 60,
      }),
    ).toThrowError(/minTapTarget/);
  });
});
