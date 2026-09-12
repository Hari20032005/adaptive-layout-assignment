import { describe, expect, it } from "vitest";
import { demoAd, mobilePortrait, broadcast, kiosk } from "./resolver.spec";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import { defineSurface } from "../src/engine/surfaces";
import { intersects, contains, workingArea } from "../src/engine/geometry";
import type { ResolvedLayout, SurfaceProfile } from "../src/engine/types";

function placed(layout: ResolvedLayout) {
  return layout.elements.filter((e) => e.status !== "dropped");
}

function assertNoOverlapNoClip(layout: ResolvedLayout, surface: SurfaceProfile) {
  const placedEls = placed(layout);
  for (let i = 0; i < placedEls.length; i++) {
    for (let j = i + 1; j < placedEls.length; j++) {
      expect(intersects(placedEls[i]!, placedEls[j]!), `${placedEls[i]!.id} overlaps ${placedEls[j]!.id}`).toBe(false);
    }
  }
  const area = workingArea(surface, surface.safeArea);
  for (const el of placedEls) {
    expect(contains(area, el), `${el.id} clipped outside working area`).toBe(true);
  }
}

describe("invariants — no overlap, no clipping across required surfaces", () => {
  it("mobile portrait", () => {
    assertNoOverlapNoClip(resolveLayout(demoAd, mobilePortrait, estimateMeasurer), mobilePortrait);
  });

  it("mobile landscape", () => {
    const s = defineSurface({ id: "ml", label: "Mobile Landscape", width: 480, height: 320, safeArea: { top: 12, right: 24, bottom: 12, left: 24 }, minTapTarget: 44 });
    assertNoOverlapNoClip(resolveLayout(demoAd, s, estimateMeasurer), s);
  });

  it("broadcast lower third with min text size", () => {
    assertNoOverlapNoClip(resolveLayout(demoAd, broadcast, estimateMeasurer), broadcast);
  });

  it("retail kiosk with 60px tap targets", () => {
    assertNoOverlapNoClip(resolveLayout(demoAd, kiosk, estimateMeasurer), kiosk);
  });
});

describe("invariants — property test across a size matrix", () => {
  it("never overlaps or clips across 5×7 surface sizes", () => {
    for (const width of [320, 480, 640, 1080, 1920]) {
      for (const height of [200, 250, 320, 480, 700, 1080, 1400]) {
        const s = defineSurface({ id: `g${width}x${height}`, label: `${width}x${height}`, width, height });
        const layout = resolveLayout(demoAd, s, estimateMeasurer);
        try {
          assertNoOverlapNoClip(layout, s);
        } catch (err) {
          throw new Error(`failed at ${width}x${height}: ${(err as Error).message}`);
        }
      }
    }
  });

  it("every required surface satisfies its declared hard constraints", () => {
    const layouts = [mobilePortrait, broadcast, kiosk].map((s) => resolveLayout(demoAd, s, estimateMeasurer));
    for (const layout of layouts) expect(layout.diagnostics.passes).toBe(true);
  });
});
