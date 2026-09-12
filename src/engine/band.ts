import type { ElementConstraints } from "./constraints";
import type { Rect } from "./types";

/**
 * Phase 1 of resolution: greedy, priority-ordered band formation.
 *
 * A "band" is a strip of elements that share space along the band-advance
 * axis. With the `row` axis, bands are horizontal strips stacked top→bottom
 * and elements inside a band sit side-by-side. With the `column` axis, bands
 * are vertical strips placed left→right and elements inside a band stack
 * top-down. The axis is chosen numerically from the working-area aspect
 * ratio — never from a surface id.
 */

export const COLUMN_AXIS_THRESHOLD = 2.0;
export const GAP = 16;
const ROW_MAX_ENTRIES = 3;
const COLUMN_MAX_ENTRIES = 2;

export type BandAxis = "row" | "column";

export interface BandEntry {
  constraints: ElementConstraints;
  /** allocation along the band-advance axis (height for rows, width for columns) */
  mainSize: number;
  /** allocation along the in-band axis (width for rows, height for columns) */
  crossSize: number;
  scale: number;
}

export interface Band {
  entries: BandEntry[];
}

export function selectAxis(area: Rect): BandAxis {
  const ratio = Math.max(area.width, 1) / Math.max(area.height, 1);
  return ratio > COLUMN_AXIS_THRESHOLD ? "column" : "row";
}

export function maxEntriesPerBand(axis: BandAxis): number {
  return axis === "row" ? ROW_MAX_ENTRIES : COLUMN_MAX_ENTRIES;
}

export interface BandFormation {
  bands: Band[];
  /** elements that could not satisfy their hard minimum anywhere */
  dropCandidates: ElementConstraints[];
}

export function formBands(
  ordered: ElementConstraints[],
  axis: BandAxis,
  area: Rect,
): BandFormation {
  const budget = axis === "row" ? area.height : area.width;
  const cap = maxEntriesPerBand(axis);

  const bands: Band[] = [];
  const dropCandidates: ElementConstraints[] = [];
  let current: BandEntry[] = [];
  let currentLen = 0;
  let usedTotal = 0; // cumulative sum of band lengths + gaps between bands

  const flush = () => {
    if (current.length > 0) {
      bands.push({ entries: current });
      usedTotal += currentLen + GAP;
    }
    current = [];
    currentLen = 0;
  };

  for (const constraints of ordered) {
    const preferredMain = axis === "row" ? constraints.preferredSize.height : constraints.preferredSize.width;
    const minMain = Math.min(
      axis === "row" ? constraints.requiredMin.height : constraints.requiredMin.width,
      budget,
    );

    const assignFresh = (room: number) => {
      const main = Math.max(minMain, Math.min(preferredMain, room));
      current.push({ constraints, mainSize: main, crossSize: 0, scale: preferredMain > 0 ? main / preferredMain : 1 });
      currentLen = main;
    };

    let placed = false;

    if (current.length === 0) {
      const room = budget - usedTotal;
      if (room >= minMain) {
        assignFresh(room);
        placed = true;
      }
    } else {
      // flushing the current band will consume its length + a gap before the
      // fresh one — account for that when deciding if a fresh band is possible
      const freshRoom = budget - usedTotal - currentLen - GAP;
      if (freshRoom >= minMain) {
        flush();
        assignFresh(budget - usedTotal);
        placed = true;
      }
    }

    if (!placed && current.length > 0 && current.length < cap) {
      // co-occupy: fits within the current band length without growing it
      if (minMain <= currentLen) {
        current.push({
          constraints,
          mainSize: Math.max(minMain, Math.min(preferredMain, currentLen)),
          crossSize: 0,
          scale: preferredMain > 0 ? Math.min(preferredMain, currentLen) / preferredMain : 1,
        });
        placed = true;
      } else {
        const growRoom = budget - usedTotal - currentLen - GAP;
        if (growRoom >= minMain) {
          const main = Math.max(minMain, Math.min(preferredMain, currentLen + growRoom));
          current.push({ constraints, mainSize: main, crossSize: 0, scale: preferredMain > 0 ? main / preferredMain : 1 });
          currentLen = Math.max(currentLen, main);
          placed = true;
        }
      }
    }

    if (!placed) {
      // cannot satisfy the hard minimum on this surface at all
      dropCandidates.push(constraints);
    }
  }
  flush();

  return { bands, dropCandidates };
}
