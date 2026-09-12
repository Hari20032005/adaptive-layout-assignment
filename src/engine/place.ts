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

export function totalMainDemand(bands: Band[], axis: BandAxis): number {
  if (bands.length === 0) return 0;
  return bands.reduce((s, band) => s + bandMainLength(band), 0) + GAP * (bands.length - 1);
}

function minCrossOf(el: ElementConstraints, axis: BandAxis): number {
  return axis === "row" ? el.requiredMin.width : el.requiredMin.height;
}

function minMainOf(el: ElementConstraints, axis: BandAxis): number {
  return axis === "row" ? el.requiredMin.height : el.requiredMin.width;
}

/** min-aware proportional cross-axis distribution; null when mins alone can't fit */
export function distributeCross(
  entries: BandEntry[],
  axis: BandAxis,
  usable: number,
): Map<BandEntry, number> | null {
  const mins = entries.map((e) => minCrossOf(e.constraints, axis));
  const minsTotal = mins.reduce((a, b) => a + b, 0);
  if (minsTotal > usable) return null;

  const result = new Map<BandEntry, number>();
  const totalPreferredCross = entries.reduce((s, e) => s + preferredCross(e, axis), 0);
  // distribute within the room left after inter-entry gaps
  const effectiveUsable = usable - GAP * Math.max(0, entries.length - 1);

  const flexible: { entry: BandEntry; want: number; base: number }[] = [];
  entries.forEach((e, i) => {
    const min = mins[i]!;
    const prefer = preferredCross(e, axis);
    if (e.constraints.element.type === "image") {
      const derived = Math.max(min, Math.min(imageDerivedCross(e, axis), prefer));
      if (derived > min) {
        flexible.push({ entry: e, want: derived, base: min });
        result.set(e, min);
      } else {
        result.set(e, min);
      }
      return;
    }
    const share = totalPreferredCross > 0 ? (prefer / totalPreferredCross) * effectiveUsable : min;
    if (share > min) {
      flexible.push({ entry: e, want: share, base: min });
      result.set(e, min);
    } else {
      result.set(e, min);
    }
  });

  const flexPool = Math.max(
    0,
    effectiveUsable - mins.reduce((a, b) => a + b, 0) + flexible.reduce((s, f) => s + f.base, 0),
  );
  const wantTotal = flexible.reduce((s, f) => s + f.want, 0);
  if (flexible.length > 0 && wantTotal > 0) {
    const scale = Math.min(1, flexPool / wantTotal);
    for (const f of flexible) {
      result.set(f.entry, Math.min(f.base + (f.want - f.base) * scale, f.base + (f.want - f.base)));
    }
  }

  return result;
}

export function layoutBands(bands: Band[], axis: BandAxis, area: Rect): BandLayout {
  const placements: Placement[] = [];
  const blame: ElementConstraints[] = [];
  const budget = axis === "row" ? area.height : area.width;
  let offset = 0;

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

  let cursor = 0;
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
