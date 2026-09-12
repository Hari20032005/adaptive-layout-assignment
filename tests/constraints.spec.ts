import { describe, expect, it } from "vitest";
import { defineAd } from "../src/engine/spec";
import { defineSurface } from "../src/engine/surfaces";
import { deriveConstraints } from "../src/engine/constraints";
import { estimateMeasurer } from "../src/engine/measure";

const kiosk = defineSurface({
  id: "kiosk",
  label: "Retail Kiosk",
  width: 1080,
  height: 1080,
  minTapTarget: 60,
  touchOnly: true,
});

const broadcast = defineSurface({
  id: "broadcast",
  label: "Broadcast Lower Third",
  width: 1920,
  height: 250,
  viewingDistance: "far",
  minTextSize: 32,
});

const safeSurface = defineSurface({
  id: "mobile",
  label: "Mobile",
  width: 320,
  height: 480,
  safeArea: { top: 20, right: 10, bottom: 30, left: 10 },
});

describe("deriveConstraints", () => {
  const ad = defineAd({
    elements: [
      { id: "headline", type: "text", role: "primary", priority: 1, content: { text: "Summer Sale" } },
      { id: "hero", type: "image", role: "hero", priority: 1, content: { src: "x.png", aspectRatio: 1.5 } },
      { id: "cta", type: "button", role: "action", priority: 2, interactive: true, content: { label: "Shop Now" } },
    ],
  });

  it("requires tap targets of at least minTapTarget on touch-only surfaces", () => {
    const c = deriveConstraints(ad, kiosk, estimateMeasurer);
    const byId = new Map(c.elements.map((e) => [e.element.id, e]));
    expect(byId.get("cta")!.requiredMin.height).toBeGreaterThanOrEqual(60);
    expect(byId.get("cta")!.requiredMin.width).toBeGreaterThanOrEqual(60);
  });

  it("does not require tap targets on non-touch surfaces", () => {
    const c = deriveConstraints(ad, broadcast, estimateMeasurer);
    const byId = new Map(c.elements.map((e) => [e.element.id, e]));
    expect(byId.get("cta")!.requiredMin.height).toBeLessThan(60);
  });

  it("raises minimum font size for text on far-viewing surfaces", () => {
    const c = deriveConstraints(ad, broadcast, estimateMeasurer);
    const byId = new Map(c.elements.map((e) => [e.element.id, e]));
    expect(byId.get("headline")!.effectiveMinTextSize).toBe(32);
  });

  it("uses default font size floor on near-viewing surfaces", () => {
    const c = deriveConstraints(ad, kiosk, estimateMeasurer);
    const byId = new Map(c.elements.map((e) => [e.element.id, e]));
    expect(byId.get("headline")!.effectiveMinTextSize).toBeLessThan(32);
  });

  it("respects safe area in working area", () => {
    const c = deriveConstraints(ad, safeSurface, estimateMeasurer);
    expect(c.workingArea).toEqual({ x: 10, y: 20, width: 300, height: 430 });
  });

  it("sorts elements by priority then role weight (most important first)", () => {
    const c = deriveConstraints(ad, kiosk, estimateMeasurer);
    expect(c.elements[0]!.element.id).toBe("hero");
    expect(c.elements[c.elements.length - 1]!.element.id).toBe("cta");
  });
});
