import type { Rect, SurfaceProfile, AdElementSpec, AdSpec, Priority, Size } from "./types";
import { workingArea } from "./geometry";
import type { TextMeasurer } from "./measure";
import { estimateMeasurer } from "./measure";

const ROLE_WEIGHTS: Record<string, number> = {
  hero: 5,
  primary: 4,
  action: 4,
  secondary: 2,
  branding: 1,
};

const DEFAULT_MIN_FONT_SIZE = 12;
const DEFAULT_FONT_SIZE = 16;

/** role-aware preferred font sizes give real typographic hierarchy */
const ROLE_FONT_SIZE: Record<string, number> = {
  primary: 28,
  secondary: 16,
  action: 16,
  hero: 16,
  branding: 40,
};

export interface ElementConstraints {
  element: AdElementSpec;
  requiredMin: Size;
  preferredSize: Size;
  /** the content-derived preferred size before any scene compression */
  basePreferredSize: Size;
  priority: Priority;
  roleWeight: number;
  needsTapTarget: boolean;
  effectiveMinTextSize: number;
  /** the font size the spec intends to render this element at */
  preferredFont?: number;
}

export interface DerivedConstraints {
  workingArea: Rect;
  elements: ElementConstraints[];
}

function elementMinFontSize(surface: SurfaceProfile, element: AdElementSpec): number {
  if (element.type !== "text") return DEFAULT_MIN_FONT_SIZE;
  if (surface.viewingDistance === "far" && surface.minTextSize !== undefined) {
    return surface.minTextSize;
  }
  return DEFAULT_MIN_FONT_SIZE;
}

function preferredFontSize(element: AdElementSpec, minFont: number): number {
  const base = ROLE_FONT_SIZE[element.role] ?? DEFAULT_FONT_SIZE;
  return Math.max(minFont, base);
}

export function deriveConstraints(
  spec: AdSpec,
  surface: SurfaceProfile,
  measurer: TextMeasurer = estimateMeasurer,
): DerivedConstraints {
  const area = workingArea(surface, surface.safeArea);

  const elements = [...spec.elements]
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const wa = ROLE_WEIGHTS[a.role] ?? 0;
      const wb = ROLE_WEIGHTS[b.role] ?? 0;
      return wb - wa;
    })
    .map((element): ElementConstraints => {
      const minFont = elementMinFontSize(surface, element);
      const font = preferredFontSize(element, minFont);
      const needsTapTarget = surface.touchOnly === true || element.interactive === true;
      const tapMin = needsTapTarget ? (surface.minTapTarget ?? 44) : 0;

      let requiredMin: Size = { width: 0, height: 0 };
      let preferredSize: Size;

      if (element.type === "text") {
        const m = measurer.measure(
          element.content.text,
          font,
          element.preferredSize?.width ?? area.width,
          element.content.maxLines,
        );
        requiredMin = { width: minFont * 2, height: minFont };
        // leave a safety margin: canvas measureText and the browser's final
        // layout differ slightly (font weight, kerning), so the box must be
        // a little wider than the raw measurement
        preferredSize = { width: m.width + 16, height: m.height * 1.08 };
      } else if (element.type === "image") {
        const ratio = element.content.aspectRatio ?? 1;
        const prefH = element.preferredSize?.height ?? Math.min(area.height * 0.5, area.height);
        const prefW = element.preferredSize?.width ?? Math.min(prefH * ratio, area.width);
        requiredMin = { width: 24, height: 24 };
        preferredSize = { width: prefW, height: prefH };
      } else if (element.type === "button") {
        const m = measurer.measure(element.content.label, font, area.width, 1);
        requiredMin = { width: m.width + 16, height: m.height + 12 };
        preferredSize = { width: m.width + 32, height: m.height + 16 };
      } else {
        // logo
        preferredSize = element.preferredSize ?? { width: 96, height: 48 };
        requiredMin = { width: 32, height: 16 };
      }

      requiredMin = {
        width: Math.max(requiredMin.width, tapMin),
        height: Math.max(requiredMin.height, tapMin),
      };

      return {
        element,
        requiredMin,
        preferredSize,
        basePreferredSize: { ...preferredSize },
        priority: element.priority,
        roleWeight: ROLE_WEIGHTS[element.role] ?? 0,
        needsTapTarget,
        effectiveMinTextSize: minFont,
        preferredFont: minFont > 0 ? font : undefined,
      };
    });

  return { workingArea: area, elements };
}
