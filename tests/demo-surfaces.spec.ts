import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLayout } from "../src/engine/resolver";
import { canvasMeasurer, resetTextMetricsCache } from "../src/render/text-metrics";
import { adSpec, surfaceProfiles } from "../src/demo/sample-ad";

/**
 * End-to-end regression tests using the REAL demo spec and the browser text
 * measurer. These guard the bug where canvasMeasurer returned `maxWidth` as
 * the text width, which inflated the CTA's required size and caused the
 * resolver to drop the CTA on every surface.
 */

function mockBrowserMetrics(charWidthFactor = 0.6) {
  const original = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName !== "canvas") return original(tagName);
    const ctx = {
      font: "16px system-ui",
      measureText(text: string) {
        const size = Number.parseInt(ctx.font.match(/(\d+)px/)?.[1] ?? "16", 10) || 16;
        return { width: text.length * size * charWidthFactor };
      },
    };
    return { getContext: () => ctx } as unknown as HTMLElement;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  resetTextMetricsCache();
});

describe("demo spec + real browser measurer", () => {
  it("never drops the CTA on any demo surface", () => {
    mockBrowserMetrics();
    for (const [key, surface] of Object.entries(surfaceProfiles)) {
      const layout = resolveLayout(adSpec, surface, canvasMeasurer);
      const cta = layout.elements.find((e) => e.id === "cta");
      expect(cta, `CTA missing on ${key}`).toBeDefined();
      expect(cta!.status, `CTA dropped on ${key}`).not.toBe("dropped");
    }
  });

  it("satisfies all hard constraints on every demo surface", () => {
    mockBrowserMetrics();
    for (const [key, surface] of Object.entries(surfaceProfiles)) {
      const layout = resolveLayout(adSpec, surface, canvasMeasurer);
      expect(layout.diagnostics.passes, `constraints unresolved on ${key}`).toBe(true);
    }
  });

  it("stays valid across many measurement biases (0.4x–0.75x char width)", () => {
    for (const factor of [0.4, 0.5, 0.6, 0.75]) {
      vi.restoreAllMocks();
      resetTextMetricsCache();
      mockBrowserMetrics(factor);
      for (const [key, surface] of Object.entries(surfaceProfiles)) {
        const layout = resolveLayout(adSpec, surface, canvasMeasurer);
        const cta = layout.elements.find((e) => e.id === "cta")!;
        expect(cta.status, `CTA dropped on ${key} at factor ${factor}`).not.toBe("dropped");
      }
    }
  });
});

describe("progressive degradation on the portrait kiosk", () => {
  it("sheds elements in at least four distinct steps as height shrinks, always keeping the CTA", () => {
    mockBrowserMetrics();
    const base = surfaceProfiles.kioskCompact;
    const dropSets = new Set<string>();

    for (let height = base.height; height >= 240; height -= 40) {
      const layout = resolveLayout(adSpec, { ...base, height }, canvasMeasurer);
      dropSets.add([...layout.diagnostics.dropped].sort().join(","));
      const cta = layout.elements.find((e) => e.id === "cta")!;
      expect(cta.status, `CTA dropped at height ${height}`).not.toBe("dropped");
    }

    // a genuinely stepped cascade, not all-or-nothing
    expect(dropSets.size).toBeGreaterThanOrEqual(4);
  });

  it("drops branding before the CTA at any height", () => {
    mockBrowserMetrics();
    const base = surfaceProfiles.kioskCompact;
    for (const height of [base.height, 800, 600, 400, 260]) {
      const layout = resolveLayout(adSpec, { ...base, height }, canvasMeasurer);
      const logo = layout.elements.find((e) => e.id === "logo")!;
      const cta = layout.elements.find((e) => e.id === "cta")!;
      if (logo.status === "dropped") expect(cta.status).not.toBe("dropped");
    }
  });

  it("degrades monotonically across the slider — no element reappears when shrinking", () => {
    mockBrowserMetrics();
    const base = surfaceProfiles.kioskCompact;
    let previous: Set<string> | null = null;
    for (let height = base.height; height >= 240; height -= 20) {
      const layout = resolveLayout(adSpec, { ...base, height }, canvasMeasurer);
      const placedIds = new Set(layout.elements.filter((e) => e.status !== "dropped").map((e) => e.id));
      if (previous) {
        for (const id of placedIds) {
          expect(previous.has(id), `${id} reappears at height ${height}`).toBe(true);
        }
      }
      previous = placedIds;
    }
  });
});
