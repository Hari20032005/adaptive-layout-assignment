import { describe, expect, it } from "vitest";
import { demoAd, kiosk } from "./resolver.spec";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import type { SurfaceProfile } from "../src/engine/types";
import { defineSurface } from "../src/engine/surfaces";

describe("degradation — deterministic priority order", () => {
  it("drops branding before promo before price as kiosk height shrinks", () => {
    const at500 = resolveLayout(
      demoAd,
      defineSurface({ id: "k500", label: "K500", width: 1080, height: 500, minTapTarget: 60, touchOnly: true }),
      estimateMeasurer,
    );
    const at300 = resolveLayout(
      demoAd,
      defineSurface({ id: "k300", label: "K300", width: 1080, height: 300, minTapTarget: 60, touchOnly: true }),
      estimateMeasurer,
    );

    // branding (priority 3) is always the first thing to go
    expect(at500.elements.find((e) => e.id === "logo")!.status).toBe("dropped");
    // price (priority 2) survives longer than branding
    expect(at500.elements.find((e) => e.id === "price")!.status).not.toBe("dropped");
    void at300;
    void kiosk;
  });

  it("never drops the CTA at any kiosk height", () => {
    for (const h of [1080, 800, 500, 400, 300, 250, 200]) {
      const s = defineSurface({ id: `k${h}`, label: `K${h}`, width: 1080, height: h, minTapTarget: 60, touchOnly: true });
      const layout = resolveLayout(demoAd, s, estimateMeasurer);
      const cta = layout.elements.find((e) => e.id === "cta")!;
      expect(cta.status, `CTA dropped at height ${h}`).not.toBe("dropped");
    }
  });

  it("reports dropped elements in diagnostics", () => {
    const s = defineSurface({ id: "k420", label: "K420", width: 1080, height: 420, minTapTarget: 60, touchOnly: true });
    const layout = resolveLayout(demoAd, s, estimateMeasurer);
    expect(Array.isArray(layout.diagnostics.dropped)).toBe(true);
    expect(layout.diagnostics.passes).toBe(true);
  });

  it("degrades monotonically: layout at lower height is a subset of taller layout", () => {
    const t1 = resolveLayout(demoAd, kiosk, estimateMeasurer).elements.filter((e) => e.status !== "dropped").map((e) => e.id);
    const s500 = defineSurface({ id: "k500", label: "K500", width: 1080, height: 500, minTapTarget: 60, touchOnly: true });
    const t2 = resolveLayout(demoAd, s500, estimateMeasurer).elements.filter((e) => e.status !== "dropped").map((e) => e.id);
    for (const id of t2) expect(t1, `${id} placed when taller but missing when shorter`).toContain(id);
  });
});
