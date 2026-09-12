import { describe, expect, it } from "vitest";
import { defineSurface } from "../src/engine/surfaces";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import { demoAd } from "./fixtures";

/** Portrait kiosk: shrinking its height shrinks the main-axis budget, so
 * degradation is actually driven by the height slider (as in the demo). */
function kioskPortrait(height: number) {
  return defineSurface({ id: `kp${height}`, label: `KP${height}`, width: 480, height, minTapTarget: 60, touchOnly: true });
}

function placedIds(height: number) {
  return resolveLayout(demoAd, kioskPortrait(height), estimateMeasurer)
    .elements.filter((e) => e.status !== "dropped")
    .map((e) => e.id);
}

describe("degradation — deterministic priority order", () => {
  it("sheds branding while price and CTA survive once the kiosk is small enough", () => {
    const shedding = [960, 820, 700, 580, 460, 380, 300].find(
      (h) => resolveLayout(demoAd, kioskPortrait(h), estimateMeasurer).elements.find((e) => e.id === "logo")!.status === "dropped",
    );
    expect(shedding, "branding never dropped at any tested height").toBeDefined();

    const layout = resolveLayout(demoAd, kioskPortrait(shedding!), estimateMeasurer);
    expect(layout.elements.find((e) => e.id === "logo")!.status).toBe("dropped");
    expect(layout.elements.find((e) => e.id === "price")!.status).not.toBe("dropped");
    expect(layout.elements.find((e) => e.id === "cta")!.status).not.toBe("dropped");
  });

  it("never drops the CTA at any kiosk height", () => {
    for (const h of [960, 800, 580, 460, 380, 300, 260]) {
      const layout = resolveLayout(demoAd, kioskPortrait(h), estimateMeasurer);
      expect(layout.elements.find((e) => e.id === "cta")!.status, `CTA dropped at height ${h}`).not.toBe("dropped");
    }
  });

  it("reports drop diagnostics and still passes hard constraints", () => {
    const layout = resolveLayout(demoAd, kioskPortrait(460), estimateMeasurer);
    expect(Array.isArray(layout.diagnostics.dropped)).toBe(true);
    expect(layout.diagnostics.passes).toBe(true);
  });

  it("degrades monotonically: a shorter kiosk never places what a taller one dropped", () => {
    let previous = placedIds(960);
    for (const h of [820, 700, 580, 460, 380, 300]) {
      const current = placedIds(h);
      for (const id of current) {
        expect(previous, `${id} placed at height ${h} but missing at a taller height`).toContain(id);
      }
      previous = current;
    }
  });
});
