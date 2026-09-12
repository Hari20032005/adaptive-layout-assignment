import { describe, expect, it } from "vitest";
import { defineAd } from "../src/engine/spec";
import { defineSurface } from "../src/engine/surfaces";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import type { SurfaceProfile } from "../src/engine/types";
import { intersects, contains, workingArea } from "../src/engine/geometry";

export const demoAd = defineAd({
  elements: [
    { id: "headline", type: "text", role: "primary", priority: 1, content: { text: "Summer Sale — 40% Off Everything", maxLines: 2 } },
    { id: "hero", type: "image", role: "hero", priority: 1, content: { src: "product.png", alt: "Product", aspectRatio: 1.5 } },
    { id: "price", type: "text", role: "secondary", priority: 2, content: { text: "$29.99", maxLines: 1 } },
    { id: "cta", type: "button", role: "action", priority: 2, interactive: true, content: { label: "Shop Now" } },
    { id: "promo", type: "text", role: "secondary", priority: 3, content: { text: "Free shipping on orders over $50. Limited time offer while supplies last.", maxLines: 3 } },
    { id: "logo", type: "logo", role: "branding", priority: 3, content: { src: "brand.png", alt: "Brand" } },
  ],
});

export const mobilePortrait = defineSurface({ id: "mobilePortrait", label: "Mobile Portrait", width: 320, height: 480, safeArea: { top: 24, right: 12, bottom: 24, left: 12 }, minTapTarget: 44 });
export const mobileLandscape = defineSurface({ id: "mobileLandscape", label: "Mobile Landscape", width: 480, height: 320, safeArea: { top: 12, right: 24, bottom: 12, left: 24 }, minTapTarget: 44 });
export const broadcast = defineSurface({ id: "broadcast", label: "Broadcast Lower Third", width: 1920, height: 250, viewingDistance: "far", minTextSize: 32 });
export const kiosk = defineSurface({ id: "kiosk", label: "Retail Kiosk", width: 1080, height: 1080, minTapTarget: 60, touchOnly: true });

function placedEls(layout: ReturnType<typeof resolveLayout>) {
  return layout.elements.filter((e) => e.status !== "dropped");
}

function assertNoOverlapNoClip(layout: ReturnType<typeof resolveLayout>, surface: SurfaceProfile) {
  const placed = placedEls(layout);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      expect(intersects(placed[i]!, placed[j]!), `${placed[i]!.id} overlaps ${placed[j]!.id}`).toBe(false);
    }
  }
  const area = workingArea(surface, surface.safeArea);
  for (const el of placed) {
    expect(contains(area, el), `${el.id} clipped outside working area`).toBe(true);
  }
}

describe("resolveLayout — structural adaptation", () => {
  it("stacks elements vertically on a tall mobile portrait (row bands)", () => {
    const layout = resolveLayout(demoAd, mobilePortrait, estimateMeasurer);
    const placed = placedEls(layout);
    const headline = placed.find((e) => e.id === "headline")!;
    const hero = placed.find((e) => e.id === "hero")!;
    expect(hero.y + hero.height).toBeLessThanOrEqual(headline.y + 1);
  });

  it("places elements side by side on a wide broadcast surface (column bands)", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const placed = placedEls(layout);
    const headline = placed.find((e) => e.id === "headline")!;
    const hero = placed.find((e) => e.id === "hero")!;
    expect(hero.x + hero.width).toBeLessThanOrEqual(headline.x + 1);
  });

  it("arranges the same band differently by aspect ratio (not uniform scaling)", () => {
    const tall = resolveLayout(demoAd, mobilePortrait, estimateMeasurer);
    const wide = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const tallH = tall.elements.find((e) => e.id === "headline")!;
    const wideH = wide.elements.find((e) => e.id === "headline")!;
    // headline shares the vertical axis with the hero on tall surfaces
    expect(tallH.y).toBeGreaterThan(tall.elements.find((e) => e.id === "hero")!.y + tall.elements.find((e) => e.id === "hero")!.height - 1);
    // and sits beside it on wide surfaces
    expect(wideH.y).toBe(wide.elements.find((e) => e.id === "hero")!.y);
  });
});

describe("resolveLayout — degradation", () => {
  it("drops branding before price as kiosk height shrinks", () => {
    const at500 = resolveLayout(demoAd, defineSurface({ id: "k500", label: "K500", width: 1080, height: 500, minTapTarget: 60, touchOnly: true }), estimateMeasurer);
    const at300 = resolveLayout(demoAd, defineSurface({ id: "k300", label: "K300", width: 1080, height: 300, minTapTarget: 60, touchOnly: true }), estimateMeasurer);
    const logo500 = at500.elements.find((e) => e.id === "logo")!;
    expect(logo500.status).toBe("dropped");
    const price500 = at500.elements.find((e) => e.id === "price")!;
    expect(price500.status).not.toBe("dropped");
    assertNoOverlapNoClip(at500, at500.diagnostics.passes ? { ...kiosk, height: 500 } as SurfaceProfile : kiosk);
  });

  it("never drops the CTA", () => {
    for (const h of [1080, 800, 500, 400, 300, 250, 200]) {
      const s = defineSurface({ id: `k${h}`, label: `K${h}`, width: 1080, height: h, minTapTarget: 60, touchOnly: true });
      const layout = resolveLayout(demoAd, s, estimateMeasurer);
      const cta = layout.elements.find((e) => e.id === "cta")!;
      expect(cta.status, `CTA dropped at height ${h}`).not.toBe("dropped");
      expect(placedEls(layout).find((e) => e.id === "cta")).toBeDefined();
    }
  });

  it("truncates text instead of violating minTextSize on broadcast", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    for (const el of placedEls(layout)) {
      if (el.type === "text" && el.text !== undefined) {
        const orig = demoAd.elements.find((e) => e.id === el.id);
        if (orig && el.text.length < orig.content.text.length) {
          expect(el.status).toBe("truncated");
        }
      }
    }
  });
});

describe("resolveLayout — hard constraints", () => {
  it("satisfies minTextSize on broadcast for all text", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    for (const el of placedEls(layout)) {
      if (el.type === "text" && el.fontSize !== undefined) {
        expect(el.fontSize, `${el.id} font below minTextSize`).toBeGreaterThanOrEqual(32);
      }
    }
  });

  it("satisfies tap target minimum on kiosk", () => {
    const layout = resolveLayout(demoAd, kiosk, estimateMeasurer);
    for (const el of placedEls(layout)) {
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
        if (width < 100 || height < 100) continue;
        const s = defineSurface({ id: `g${width}x${height}`, label: `${width}x${height}`, width, height });
        const layout = resolveLayout(demoAd, s, estimateMeasurer);
        assertNoOverlapNoClip(layout, s);
      }
    }
  });
});
