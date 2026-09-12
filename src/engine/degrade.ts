import { intersectListCheck } from "./geometry";
import type { Rect } from "./types";

/**
 * Hard-constraint validation for a resolved layout: every rect must sit
 * inside the working area and no two rects may overlap.
 */
export function checkInvariants(rects: Rect[], area: Rect): boolean {
  const outOfBounds = rects.some(
    (r) => r.x < area.x || r.y < area.y || r.x + r.width > area.x + area.width || r.y + r.height > area.y + area.height,
  );
  if (outOfBounds) return false;
  return intersectListCheck(rects);
}
