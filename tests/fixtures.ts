import { defineAd } from "../src/engine/spec";
import { defineSurface } from "../src/engine/surfaces";
import type { ResolvedLayout } from "../src/engine/types";

/** Shared fixtures for engine specs. Kept out of *.spec.ts so importing a
 * fixture does not execute another spec's tests. */

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

export const mobilePortrait = defineSurface({
  id: "mobilePortrait",
  label: "Mobile Portrait",
  width: 320,
  height: 480,
  safeArea: { top: 24, right: 12, bottom: 24, left: 12 },
  minTapTarget: 44,
});

export const mobileLandscape = defineSurface({
  id: "mobileLandscape",
  label: "Mobile Landscape",
  width: 480,
  height: 320,
  safeArea: { top: 12, right: 24, bottom: 12, left: 24 },
  minTapTarget: 44,
});

export const broadcast = defineSurface({
  id: "broadcast",
  label: "Broadcast Lower Third",
  width: 1920,
  height: 250,
  viewingDistance: "far",
  minTextSize: 32,
});

export const kiosk = defineSurface({
  id: "kiosk",
  label: "Retail Kiosk",
  width: 1080,
  height: 1080,
  minTapTarget: 60,
  touchOnly: true,
});

export function placed(layout: ResolvedLayout) {
  return layout.elements.filter((e) => e.status !== "dropped");
}
