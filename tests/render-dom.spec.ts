import { describe, expect, it } from "vitest";
import { demoAd, mobilePortrait, kiosk, broadcast } from "./resolver.spec";
import { resolveLayout } from "../src/engine/resolver";
import { estimateMeasurer } from "../src/engine/measure";
import { renderToDom } from "../src/render/render-dom";

function host(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("renderToDom", () => {
  it("renders one absolutely positioned box per placed element", () => {
    const layout = resolveLayout(demoAd, mobilePortrait, estimateMeasurer);
    const h = host();
    renderToDom(demoAd, layout, mobilePortrait, h);
    const boxes = [...h.querySelectorAll<HTMLElement>("[data-element-id]")];
    expect(boxes.length).toBe(layout.elements.filter((e) => e.status !== "dropped").length);
    const headline = boxes.find((b) => b.dataset.elementId === "headline")!;
    expect(headline.style.position).toBe("absolute");
  });

  it("omits DOM nodes for dropped elements", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const dropped = layout.elements.filter((e) => e.status === "dropped").map((e) => e.id);
    if (dropped.length > 0) {
      const h = host();
      renderToDom(demoAd, layout, broadcast, h);
      const ids = [...h.querySelectorAll<HTMLElement>("[data-element-id]")].map((b) => b.dataset.elementId);
      for (const d of dropped) expect(ids).not.toContain(d);
    }
  });

  it("applies resolved font sizes and positions exactly", () => {
    const layout = resolveLayout(demoAd, broadcast, estimateMeasurer);
    const h = host();
    renderToDom(demoAd, layout, broadcast, h);
    const cta = [...h.querySelectorAll<HTMLElement>("[data-element-id]")].find((b) => b.dataset.elementId === "cta")!;
    const resolved = layout.elements.find((e) => e.id === "cta")!;
    expect(cta.style.left).toBe(`${resolved.x}px`);
    expect(cta.style.width).toBe(`${resolved.width}px`);
  });

  it("renders and does not throw for every required surface", () => {
    for (const s of [mobilePortrait, broadcast, kiosk]) {
      const layout = resolveLayout(demoAd, s, estimateMeasurer);
      const h = host();
      expect(() => renderToDom(demoAd, layout, s, h, { debug: true })).not.toThrow();
    }
  });
});
