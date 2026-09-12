import { describe, expect, it } from "vitest";
import { defineSurface } from "../src/engine/surfaces";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import type { SurfaceProfile } from "../src/engine/types";
import { intersects, contains, workingArea } from "../src/engine/geometry";
import { broadcast, demoAd, kiosk, mobilePortrait, placed } from "./fixtures";

function assertNoOverlapNoClip(layout: ReturnType<typeof resolveLayout>, surface: SurfaceProfile) {
  const els = placed(layout);
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      expect(intersects(els[i]!, els[j]!), `${els[i]!.id} overlaps ${els[j]!.id}`).toBe(false);
    }
  }
  const area = workingArea(surface, surface.safeArea);
  for (const el of els) {
    expect(contains(area, el), `${el.id} clipped outside working area`).toBe(true);
  }
}

describe("resolveLayout — structural adaptation", () => {
  it("stacks elements vertically on a tall mobile portrait (row bands)", () => {
    const layout = resolveLayout(demoAd, mobilePortrait, estimateMeasurer);
    const els = placed(layout);
    const headline = els.find((e) => e.id === "headline")!;
    const hero = els.find((e) => e.id === "hero")!;
    expect(hero.y + hero.height).toBeLessThanOrEqual(headline.y + 1);
  });

  it("places elements side by side on a wide broadcast surface (column bands)", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const els = placed(layout);
    const headline = els.find((e) => e.id === "headline")!;
    const hero = els.find((e) => e.id === "hero")!;
    expect(hero.x + hero.width).toBeLessThanOrEqual(headline.x + 1);
  });

  it("arranges the same elements differently by aspect ratio (not uniform scaling)", () => {
    const tall = resolveLayout(demoAd, mobilePortrait, estimateMeasurer);
    const wide = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const tallHero = tall.elements.find((e) => e.id === "hero")!;
    const tallH = tall.elements.find((e) => e.id === "headline")!;
    const wideHero = wide.elements.find((e) => e.id === "hero")!;
    const wideH = wide.elements.find((e) => e.id === "headline")!;
    // tall surface: headline is stacked below the hero
    expect(tallH.y).toBeGreaterThan(tallHero.y);
    // wide surface: hero and headline are side-by-side (hero strip left of headline)
    expect(wideHero.x + wideHero.width).toBeLessThanOrEqual(wideH.x + 1);
  });
});

describe("resolveLayout — hard constraints", () => {
  it("satisfies minTextSize on broadcast for all text", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    for (const el of placed(layout)) {
      if (el.type === "text" && el.fontSize !== undefined) {
        expect(el.fontSize, `${el.id} font below minTextSize`).toBeGreaterThanOrEqual(32);
      }
    }
  });

  it("satisfies tap target minimum on kiosk", () => {
    const layout = resolveLayout(demoAd, kiosk, estimateMeasurer);
    for (const el of placed(layout)) {
      if (el.type === "button" || el.type === "logo") {
        expect(Math.min(el.width, el.height), `${el.id} below 60px tap target`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

describe("resolveLayout — invariant matrix", () => {
  it("never overlaps or clips across a grid of surface sizes", () => {
    for (const width of [320, 480, 640, 1080, 1920]) {
      for (const height of [200, 250, 320, 480, 700, 1080, 1400]) {
        const s = defineSurface({ id: `g${width}x${height}`, label: `${width}x${height}`, width, height });
        const layout = resolveLayout(demoAd, s, estimateMeasurer);
        assertNoOverlapNoClip(layout, s);
      }
    }
  });
});
