import { defineAd } from "../engine/spec";
import { defineSurface } from "../engine/surfaces";
import { BRAND_LOGO, PRODUCT_IMAGE } from "./placeholders";

export const adSpec = defineAd({
  elements: [
    { id: "headline", type: "text", role: "primary", priority: 1, content: { text: "Summer Sale — 40% Off Everything", maxLines: 2 } },
    { id: "hero", type: "image", role: "hero", priority: 1, preferredSize: { width: 360, height: 300 }, content: { src: PRODUCT_IMAGE, alt: "Product photo", aspectRatio: 1.5 } },
    { id: "price", type: "text", role: "secondary", priority: 2, content: { text: "$29.99", maxLines: 1 } },
    { id: "cta", type: "button", role: "action", priority: 2, interactive: true, content: { label: "Shop Now" } },
    { id: "promo", type: "text", role: "secondary", priority: 3, content: { text: "Free shipping on orders over $50. Limited time offer while supplies last.", maxLines: 3 } },
    { id: "logo", type: "logo", role: "branding", priority: 3, content: { src: BRAND_LOGO, alt: "Brand logo" } },
    { id: "rating", type: "text", role: "secondary", priority: 4, content: { text: "★★★★★ 2,340 verified reviews", maxLines: 1 } },
    { id: "terms", type: "text", role: "secondary", priority: 5, content: { text: "Terms apply. Offer ends Sunday.", maxLines: 1 } },
  ],
});

export const surfaceProfiles = {
  mobilePortrait: defineSurface({
    id: "mobilePortrait",
    label: "Mobile Interstitial (portrait)",
    width: 320,
    height: 480,
    safeArea: { top: 24, right: 12, bottom: 24, left: 12 },
    minTapTarget: 44,
  }),
  mobileLandscape: defineSurface({
    id: "mobileLandscape",
    label: "Mobile Landscape",
    width: 480,
    height: 320,
    safeArea: { top: 12, right: 24, bottom: 12, left: 24 },
    minTapTarget: 44,
  }),
  broadcastLowerThird: defineSurface({
    id: "broadcastLowerThird",
    label: "Broadcast Lower Third",
    width: 1920,
    height: 250,
    viewingDistance: "far",
    minTextSize: 32,
  }),
  retailKiosk: defineSurface({
    id: "retailKiosk",
    label: "Retail Kiosk (square, touch)",
    width: 1080,
    height: 1080,
    minTapTarget: 60,
    touchOnly: true,
  }),
  kioskCompact: defineSurface({
    id: "kioskCompact",
    label: "Kiosk Portrait (degradation demo)",
    width: 480,
    height: 1280,
    minTapTarget: 60,
    touchOnly: true,
  }),
} as const;

export type SurfaceKey = keyof typeof surfaceProfiles;
