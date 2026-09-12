import { GAP } from "./band";
import type { Band, BandAxis, BandEntry } from "./band";
import type { ElementConstraints } from "./constraints";
import type { Rect } from "./types";

/**
 * Phase 2 of resolution: cross-axis placement within bands.
 * Entry shares along the cross axis are distributed proportionally to their
 * preferred sizes, floored at their required minimum, then re-balanced
 * (waterfilled) so the band never overflows. Images derive their cross-axis
 * size from the aspect ratio but never exceed their waterfilled share.
 */

export interface Placement {
  constraints: ElementConstraints;
  rect: Rect;
  scale: number;
}

export interface BandLayout {
  placements: Placement[];
  /** elements that had no valid rect without violating a hard constraint */
  blame: ElementConstraints[];
}

export function bandMainLength(band: Band): number {
  return band.entries.reduce((m, e) => Math.max(m, e.mainSize), 0);
}

function preferredCross(entry: BandEntry, axis: BandAxis): number {
  return axis === "row"
    ? entry.constraints.preferredSize.width
    : entry.constraints.preferredSize.height;
}

const MIN_MAIN_FACTOR = 0.35;
/**
 * Elements may be scaled down to this fraction of their preferred size before
 * the resolver starts dropping low-priority elements. Keeps degradation
 * legible (branding drops) instead of squeezing everything to its hard floor.
 */
const COMFORT_SCALE_FLOOR = 0.5;

/**
 * Priority-aware scene reservation. Before banding, every element's preferred
 * main-axis size is scaled down (never below its hard minimum) so that the sum
 * of all main-axis demands plus the worst-case inter-element gaps fits the
 * budget. This is the "scale" rung of the degradation ladder: high-priority
 * elements are preserved by shrinking everyone proportionally, instead of a
 * greedy pass spending the whole budget on early elements and starving (then
 * dropping) later high-value ones such as the CTA.
 *
 * Idempotent: always recomputes from `basePreferredSize`, so repeated calls
 * across degradation iterations do not compound.
 */
export function reserveMain(ordered: ElementConstraints[], axis: BandAxis, area: Rect): void {
  if (ordered.length === 0) return;
  const budget = axis === "row" ? area.height : area.width;
  const reservedGaps = GAP * (ordered.length - 1);
  const available = Math.max(0, budget - reservedGaps);

  const totalPreferred = ordered.reduce(
    (sum, e) => sum + (axis === "row" ? e.basePreferredSize.height : e.basePreferredSize.width),
    0,
  );
  const rawFactor = totalPreferred > available ? available / totalPreferred : 1;
  // never squeeze below the comfort floor: past it, low-priority elements drop
  const factor = Math.max(rawFactor, COMFORT_SCALE_FLOOR);

  for (const e of ordered) {
    if (axis === "row") {
      const base = e.basePreferredSize.height;
      const min = Math.min(e.requiredMin.height, budget);
      e.preferredSize = { ...e.basePreferredSize, height: Math.max(min, base * factor) };
    } else {
      const base = e.basePreferredSize.width;
      const min = Math.min(e.requiredMin.width, budget);
      e.preferredSize = { ...e.basePreferredSize, width: Math.max(min, base * factor) };
    }
  }
}

export function compressFactor(bands: Band[], axis: BandAxis, area: Rect): number | null {
  const budget = axis === "row" ? area.height : area.width;
  const demand = totalMainDemand(bands, axis);
  if (demand <= budget) return null;
  const factor = budget / demand;
  if (factor < MIN_MAIN_FACTOR) return null;
  // verify the compressed demand (floored at hard minimums) actually fits
  const clampedDemand = bands.reduce((s, band) => {
    const len = band.entries.reduce(
      (m, e) => Math.max(m, Math.max(minMainOf(e.constraints, axis), e.mainSize * factor)),
      0,
    );
    return s + len;
  }, GAP * (bands.length - 1));
  if (clampedDemand > budget && bands.length <= 1) return null;
  return factor;
}

export function applyCompress(bands: Band[], axis: BandAxis, factor: number): void {
  for (const band of bands) {
    for (const e of band.entries) {
      const preferredMain = axis === "row" ? e.constraints.preferredSize.height : e.constraints.preferredSize.width;
      e.mainSize = Math.max(minMainOf(e.constraints, axis), e.mainSize * factor);
      e.scale = preferredMain > 0 ? e.mainSize / preferredMain : e.scale;
    }
  }
}

export function totalMainDemand(bands: Band[], _axis: BandAxis): number {
  if (bands.length === 0) return 0;
  return bands.reduce((s, band) => s + bandMainLength(band), 0) + GAP * (bands.length - 1);
}

function minCrossOf(el: ElementConstraints, axis: BandAxis): number {
  return axis === "row" ? el.requiredMin.width : el.requiredMin.height;
}

function minMainOf(el: ElementConstraints, axis: BandAxis): number {
  return axis === "row" ? el.requiredMin.height : el.requiredMin.width;
}

/** min-aware cross-axis distribution.
 * Elements keep their preferred cross size and are only shrunk (waterfilled)
 * when the band cannot fit them all — never inflated to fill the axis, so a
 * lone element in a band does not stretch edge-to-edge.
 * Returns null when even the hard minimums cannot fit. */
export function distributeCross(
  entries: BandEntry[],
  axis: BandAxis,
  usable: number,
): Map<BandEntry, number> | null {
  const mins = entries.map((e) => minCrossOf(e.constraints, axis));
  const minsTotal = mins.reduce((a, b) => a + b, 0);
  if (minsTotal > usable) return null;

  const desired = entries.map((e, i) => {
    const min = mins[i]!;
    if (e.constraints.element.type === "image") {
      const derived = imageDerivedCross(e, axis);
      return Math.max(min, Math.min(derived, preferredCross(e, axis)));
    }
    return Math.max(min, preferredCross(e, axis));
  });

  const total = desired.reduce((a, b) => a + b, 0);
  const result = new Map<BandEntry, number>();

  if (total <= usable) {
    entries.forEach((e, i) => result.set(e, desired[i]!));
    return result;
  }

  // waterfill: keep minimums, shrink the flexible portion proportionally
  const flexibleTotal = desired.reduce((s, d, i) => s + (d - mins[i]!), 0);
  const excess = total - usable;
  const scale = flexibleTotal > 0 ? Math.max(0, (flexibleTotal - excess) / flexibleTotal) : 0;
  entries.forEach((e, i) => result.set(e, mins[i]! + (desired[i]! - mins[i]!) * scale));
  return result;
}

export function layoutBands(bands: Band[], axis: BandAxis, area: Rect): BandLayout {
  const placements: Placement[] = [];
  const blame: ElementConstraints[] = [];
  const budget = axis === "row" ? area.height : area.width;
  // center the band group along the main axis so leftover space is balanced
  // rather than dumped at one edge
  const demand = totalMainDemand(bands, axis);
  let offset = Math.max(0, (budget - demand) / 2);

  for (const band of bands) {
    const bandLen = bandMainLength(band);

    if (offset + bandLen > budget + 0.0001 && band.entries.length > 0) {
      for (const entry of band.entries) blame.push(entry.constraints);
    } else {
      const { list, blame: b } = placeEntries(band.entries, axis, area, offset, bandLen);
      blame.push(...b);
      placements.push(...list);
    }

    offset += bandLen + GAP;
  }

  return { placements, blame };
}

function placeEntries(
  entries: BandEntry[],
  axis: BandAxis,
  area: Rect,
  offset: number,
  bandLen: number,
): { list: Placement[]; blame: ElementConstraints[] } {
  const list: Placement[] = [];
  const blame: ElementConstraints[] = [];

  const usable = (axis === "row" ? area.width : area.height) - GAP * Math.max(0, entries.length - 1);
  const cross = distributeCross(entries, axis, usable);
  if (cross === null) {
    for (const e of entries) blame.push(e.constraints);
    return { list, blame };
  }

  // center the group along the cross axis rather than packing it to one edge
  const crossExtent = entries.reduce((s, e, i) => s + (cross.get(e) ?? 0) + (i > 0 ? GAP : 0), 0);
  const crossBudget = axis === "row" ? area.width : area.height;
  let cursor = Math.max(0, (crossBudget - crossExtent) / 2);

  for (const entry of entries) {
    const el = entry.constraints;
    const crossSize = cross.get(entry) ?? 0;
    const remaining = usable - cursor;
    if (remaining <= 0 || crossSize > remaining + 0.0001) {
      blame.push(el);
      continue;
    }

    const mainLim = axis === "row" ? area.height - offset : area.width - offset;
    const main = Math.min(entry.mainSize, Math.max(bandLen, mainLim));
    if (main < minMainOf(el, axis)) {
      blame.push(el);
      continue;
    }

    const rect: Rect =
      axis === "row"
        ? { x: area.x + cursor, y: area.y + offset, width: crossSize, height: main }
        : { x: area.x + offset, y: area.y + cursor, width: main, height: crossSize };

    cursor += crossSize + GAP;
    list.push({ constraints: el, rect, scale: entry.scale });
  }

  return { list, blame };
}

function imageDerivedCross(entry: BandEntry, axis: BandAxis): number {
  const ratio = (entry.constraints.element.content as { aspectRatio?: number }).aspectRatio ?? 1;
  return axis === "row" ? entry.mainSize * ratio : entry.mainSize / ratio;
}
