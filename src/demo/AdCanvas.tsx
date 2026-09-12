import { useMemo } from "react";
import { resolveLayout } from "../engine/resolver";
import { canvasMeasurer } from "../render/text-metrics";
import { adSpec, surfaceProfiles, type SurfaceKey } from "./sample-ad";
import type { ResolvedLayout, SurfaceProfile } from "../engine/types";

/**
 * Live re-resolution hook: returns the surface (possibly height-overridden)
 * and the freshly resolved layout for it. Single source of truth for the
 * demo pages.
 */
export function useLiveLayout(surfaceKey: SurfaceKey, heightOverride: number | null) {
  return useMemo(() => {
    const base = surfaceProfiles[surfaceKey];
    const surface: SurfaceProfile =
      heightOverride !== null && heightOverride !== base.height ? { ...base, height: heightOverride } : base;
    return {
      surface,
      layout: resolveLayout(adSpec, surface, canvasMeasurer) as ResolvedLayout,
    };
  }, [surfaceKey, heightOverride]);
}
