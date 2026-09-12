import { intersectListCheck } from "./geometry";
import type { Placement } from "./place";
import type { ElementConstraints } from "./constraints";
import type { Rect } from "./types";

/**
 * Phase 3 of resolution: degradation loop + truncation.
 * The ladder is: scale → truncate → drop, applied lowest-priority-first
 * until the layout satisfies all hard constraints among placed elements.
 */

export function findDrop(blame: ElementConstraints[], pool: ElementConstraints[]): ElementConstraints | undefined {
  const blameIds = new Set(blame.map((e) => e.element.id));
  const candidates = pool.filter((e) => blameIds.has(e.element.id));
  if (candidates.length === 0) return pool.length > 0 ? lowest(pool) : undefined;
  return lowest(candidates);
}

function lowest(pool: ElementConstraints[]): ElementConstraints {
  return [...pool].sort((a, b) => b.priority - a.priority || a.roleWeight - b.roleWeight)[0]!;
}

export function checkInvariants(rects: Rect[], area: Rect): boolean {
  if (rects.some((r) => r.x < area.x || r.y < area.y || r.x + r.width > area.x + area.width || r.y + r.height > area.y + area.height)) {
    return false;
  }
  return intersectListCheck(rects);
}
