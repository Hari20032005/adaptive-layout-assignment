import { useMemo, useRef, useEffect } from "react";
import { resolveLayout } from "../engine/resolver";
import { renderToDom, type RenderDomOptions } from "../render/render-dom";
import { estimateMeasurer } from "../engine/measure";
import { adSpec, surfaceProfiles, type SurfaceKey } from "./sample-ad";
import type { ResolvedLayout, SurfaceProfile } from "../engine/types";

export interface AdCanvasProps extends RenderDomOptions {
  surface: SurfaceProfile;
}

export function AdCanvas({ surface, debug }: AdCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const layout = resolveLayout(adSpec, surface, estimateMeasurer);
    renderToDom(adSpec, layout, surface, hostRef.current, { debug });
  }, [surface, debug]);

  return <div ref={hostRef} className="ad-host" style={{ position: "relative" }} />;
}

export interface DemoState {
  surfaceKey: SurfaceKey;
  heightOverride: number | null;
}

export function useLiveLayout(surfaceKey: SurfaceKey, heightOverride: number | null) {
  return useMemo(() => {
    const base = surfaceProfiles[surfaceKey];
    const surface: SurfaceProfile =
      heightOverride !== null && heightOverride !== base.height
        ? { ...base, height: heightOverride }
        : base;
    return {
      surface,
      layout: resolveLayout(adSpec, surface, estimateMeasurer) as ResolvedLayout,
    };
  }, [surfaceKey, heightOverride]);
}
