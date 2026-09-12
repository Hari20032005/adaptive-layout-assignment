import { formBands, selectAxis } from "./band";
import { applyCompress, compressFactor, layoutBands, reserveMain, type Placement } from "./place";
import { checkInvariants } from "./degrade";
import { deriveConstraints, type ElementConstraints } from "./constraints";
import type {
  AdSpec,
  Diagnostics,
  ResolvedElement,
  ResolvedLayout,
  SurfaceProfile,
} from "./types";
import type { TextMeasurer, TextMeasurement } from "./measure";
import { estimateMeasurer } from "./measure";

export const LINE_HEIGHT = 1.3;

/**
 * Entry point of the engine.
 *
 * Ad Spec + Surface Profile → Constraint Derivation → Axis Selection →
 * Priority-ordered Band Formation → Cross-axis Placement →
 * Degradation (compress → truncate → drop) → ResolvedLayout
 */
export function resolveLayout(
  spec: AdSpec,
  surface: SurfaceProfile,
  measurer: TextMeasurer = estimateMeasurer,
): ResolvedLayout {
  let derived = deriveConstraints(spec, surface, measurer);
  const area = derived.workingArea;
  const axis = selectAxis(area);

  const dropped: ElementConstraints[] = [];
  let placements: Placement[] = [];
  let valid = false;

  const maxIterations = spec.elements.length + 1;

  for (let i = 0; i <= maxIterations; i++) {
    reserveMain(derived.elements, axis, area);
    const { bands, dropCandidates } = formBands(derived.elements, axis, area);
    const factor = compressFactor(bands, axis, area);
    if (factor !== null) applyCompress(bands, axis, factor);

    const { placements: placed, blame } = layoutBands(bands, axis, area);
    const invariantsOk =
      blame.length === 0 &&
      checkInvariants(
        placed.map((p) => p.rect),
        area,
      );

    placements = placed;
    if (invariantsOk) {
      valid = true;
      for (const dc of dropCandidates) {
        if (!dropped.includes(dc)) dropped.push(dc);
      }
      break;
    }

    // Degradation drop: sacrifice the lowest-priority element overall. The
    // reservation pass deliberately over-subscribes below the comfort floor,
    // so the correct response is priority order — not whichever element the
    // greedy pass happened to blame.
    const victim = lowestPriority(derived.elements);
    if (!victim) break;
    dropped.push(victim);
    derived = { workingArea: area, elements: derived.elements.filter((e) => e !== victim) };
  }

  const diagnostics: Diagnostics = {
    dropped: dropped.map((e) => e.element.id),
    scaled: [],
    truncated: [],
    passes: valid,
  };

  const elements = emitElements(placements, dropped, diagnostics, measurer);
  return { surfaceId: surface.id, elements, diagnostics };
}

function emitElements(
  placements: Placement[],
  dropped: ElementConstraints[],
  diagnostics: Diagnostics,
  measurer: TextMeasurer,
): ResolvedElement[] {
  const droppedIds = new Set(dropped.map((e) => e.element.id));
  const out: ResolvedElement[] = [];

  for (const p of placements) {
    const el = p.constraints.element;
    const resolved: ResolvedElement = {
      id: el.id,
      type: el.type,
      role: el.role,
      priority: el.priority,
      status: "placed",
      ...p.rect,
      scale: p.scale < 0.995 ? p.scale : undefined,
    };

    if (el.type === "text") {
      const minFont = p.constraints.effectiveMinTextSize;
      const fontSize = Math.round(Math.max(minFont, p.constraints.preferredFont ?? minFont));
      const lineHeight = fontSize * LINE_HEIGHT;
      const linesThatFit = Math.max(1, Math.floor(p.rect.height / lineHeight));
      const requested = Math.max(1, Math.min(el.content.maxLines ?? linesThatFit, linesThatFit));
      const measurement: TextMeasurement = measurer.measure(el.content.text, fontSize, p.rect.width, requested);
      const original = el.content.text;
      const overflowed = measurement.overflowed === true || measurement.height > p.rect.height + 0.5;

      resolved.fontSize = fontSize;
      resolved.lines = measurement.lines;
      resolved.text = original;
      if (overflowed) {
        resolved.status = "truncated";
        diagnostics.truncated.push(el.id);
      }
    }

    if (p.scale < 0.995 && resolved.status === "placed") {
      resolved.status = "scaled";
      diagnostics.scaled.push(el.id);
    }

    if (droppedIds.has(el.id)) {
      resolved.status = "dropped";
    }
    out.push(resolved);
  }

  for (const d of dropped) {
    if (!out.some((e) => e.id === d.element.id)) {
      out.push({
        id: d.element.id,
        type: d.element.type,
        role: d.element.role,
        priority: d.element.priority,
        status: "dropped",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  }

  return out;
}

function lowestPriority(pool: ElementConstraints[]): ElementConstraints | undefined {
  if (pool.length === 0) return undefined;
  return [...pool].sort((a, b) => b.priority - a.priority || a.roleWeight - b.roleWeight)[0]!;
}
