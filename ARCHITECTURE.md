# ARCHITECTURE.md — Adaptive Layout Engine

## Overview

The engine answers a single question: *given one declarative ad spec and one surface profile, what exact rectangles should each element occupy?* Resolution and rendering are strictly separated; the resolver is pure, framework-agnostic TypeScript with zero DOM imports.

```
Ad Spec + Surface Profile
    →  constraint derivation        (src/engine/constraints.ts)
    →  axis selection               (src/engine/band.ts · selectAxis)
    →  band formation               (src/engine/band.ts · formBands)
    →  cross-axis placement         (src/engine/place.ts · layoutBands)
    →  degradation cascade          (src/engine/degrade.ts + resolver loop)
    →  ResolvedLayout               (typed, statuses + diagnostics)
    →  renderer                     (src/render/render-dom.ts)
```

## 1. Constraint derivation

`deriveConstraints(spec, surface, measurer)` maps each element to a prioritized constraint set:

| Field | Meaning |
|---|---|
| `requiredMin` | hard minimum size, never violated (floor of all scale operations) |
| `preferredSize` | the size the spec intends (content-derived) |
| `priority` | degradation order (1 = most important … 5) |
| `roleWeight` | tie-break within equal priority (hero 5 > primary/action 4 > secondary 2 > branding 1) |
| `needsTapTarget` | true for interactive elements or `touchOnly` surfaces |
| `effectiveMinTextSize` | `surface.minTextSize` when `viewingDistance === "far"`, else the default floor |

Hard constraints applied at derivation time:

- **Tap targets** — any interactive element on a surface with `minTapTarget` gets `requiredMin ≥ minTapTarget` in both dimensions (accessibility as a first-class constraint).
- **Minimum text size** — on far-viewing surfaces (e.g. broadcast), text cannot render below `minTextSize`; the degradation ladder never scales type below this floor. Instead it **truncates**.
- **Safe area** — `workingArea = surface − safeArea insets`; every resolved rect must lie fully inside it.

Elements are sorted by `(priority ↑, roleWeight ↓)` before banding, so the greedy pass makes the highest-priority choices first.

## 2. Axis selection — numeric, not per-surface

`selectAxis(area)` compares `area.width / area.height` against the threshold `2.0`:

- ratio **> 2.0** → `column` axis: bands are vertical strips placed left→right; entries stack within each strip
- otherwise → `row` axis: bands are horizontal strips stacked top→down; entries sit side-by-side within each strip

This is why a 1920×250 broadcast bar and a 320×480 interstitial produce *structurally different* compositions from the same spec with no surface-name conditional anywhere (checked by a CI grep guard).

## 3. Band formation (greedy, priority-ordered)

Each element, in priority order, is allocated along the main axis:

1. **Fresh band** (preferred): if the remaining budget (`budget − usedTotal − gap`) fits at least the element's hard minimum, the element opens its own band sized `min(preferred, room)`, floored at its minimum. Its `scale = allocated/preferred` records compression.
2. **Co-occupy**: when no fresh band fits, the element may join the current band *if it fits inside the band's current length without growing it* (`mainSize ≤ bandLen`, capped per axis: 3 for rows, 2 for columns).
3. **Grow**: otherwise the band may extend, bounded by the remaining budget.
4. **Drop candidate**: if even the minimum doesn't fit anywhere, the element is marked a drop candidate.

Band bookkeeping: `usedTotal = Σ bandLen + GAP per band` — fresh-band decisions are post-flush-corrected (`budget − usedTotal − currentLen − GAP`) which prevents the last band from overflowing the budget.

A global **compress pass** (`compressFactor` / `applyCompress`) is applied when total demand exceeds the budget: every band's allocation shrinks by `budget/demand`, floored at each element's hard minimum, so compression never creates constraint violations.

## 4. Cross-axis placement

`layoutBands` walks bands along the main axis and lays entries inside each band along the cross axis:

- total cross room = cross budget − gaps between entries; shares distributed ∝ preferred cross sizes, floored at required minimums (`distributeCross`);
- **images** derive their cross size from `aspectRatio × allocated main` (capped at share and room) so the aspect ratio is honored rather than forcibly stretched;
- each element's final `Rect` is centered within its share by the renderer.

Blame contract: an element that cannot get a valid rect within its band *without violating a hard constraint* is reported in `blame` rather than silently clamped or overlapped.

## 5. Degradation cascade

The resolver loop (priority order, lowest-first):

1. **compress** — uniform scene compression (step 3's pass)
2. **scale** — per-element `scale < 1` recorded as status `"scaled"`
3. **truncate** — text only: if allocated height/width cannot hold the requested text at font ≥ `effectiveMinTextSize`, the text is cut with an ellipsis (status `"truncated"`, resolved `text`/`lines`/`fontSize` emitted); type never shrinks below `minTextSize` on far surfaces
4. **drop** — lowest-priority offender removed from the set entirely; re-run

The loop terminates when all hard constraints hold among placed elements (`diagnostics.passes = true`) or no elements remain. Unbanded drop candidates are reported in `diagnostics.dropped` even when they were never placed.

Worked example — Kiosk Compact (1080×430): headline+hero+CTA+price fit as bands; promo and logo cannot satisfy their minimums and drop cleanly. Shrinking height via the slider drops `logo` before `promo` before `price`; the CTA (priority 2) survives even at 180px. This exact trace is asserted in `tests/degradation.spec.ts`.

## 6. Resolved layout contract

```ts
interface ResolvedElement {
  id: string;
  type: "text" | "image" | "button" | "logo";
  role: "primary" | "hero" | "action" | "secondary" | "branding";
  priority: 1 | 2 | 3 | 4 | 5;
  status: "placed" | "scaled" | "truncated" | "dropped";
  x: number; y: number; width: number; height: number;  // exact geometry
  scale?: number;       // present when scaled
  fontSize?: number;    // text only — final computed font size
  lines?: number;       // text only
  text?: string;        // text-only — final (possibly truncated) string
}

interface ResolvedLayout {
  surfaceId: string;
  elements: ResolvedElement[];   // includes dropped entries (geometry zeroed)
  diagnostics: {
    dropped: string[]; scaled: string[]; truncated: string[];
    passes: boolean;              // all hard constraints hold among placed
  };
}
```

Renderers are pure consumers: `renderToDom` positions boxes by the resolved rects, renders `resolved.text`, sets `resolved.fontSize`, and omits `dropped` elements — it makes no layout decisions (also enforced by tests).

## 7. TypeScript safety design

- **Content/type pairing**: `AdElementSpec` is a mapped union — element `type` keys which `content` shape is legal. A button with `{ text: "..." }` is a compile-time error.
- **Priority literals**: `1 | 2 | 3 | 4 | 5`.
- **Runtime validation with typed errors**: `defineSurface` rejects `safeArea` larger than the surface, impossible `minTextSize` for the surface height (a single line plus padding could not fit), tap targets larger than the smaller dimension; `defineAd` rejects unknown types, empty content, duplicate ids. All throw `SpecValidationError` carrying a field path.
- **Frozen outputs**: specs and surfaces are `Object.freeze`d so resolution can safely assume immutability.

## 8. Extension story

| Extension | What changes |
|---|---|
| New surface profile | **Data only** — add an object via `defineSurface()`. The resolver has zero surface-name references (grep-guarded). An unseen 5th surface resolves correctly out of the box. |
| New renderer (Canvas) | Implement a `ResolvedLayout` consumer. The resolver never touches rendering. |
| New element type | Add to the content-type map in `types.ts`, one branch in `constraints.ts` for measurement, one branch in `render-dom.ts`. |
| New constraint type (broadcast safe-area, print bleed) | Add one optional field on `SurfaceProfile` and its enforcement rule in `constraints.ts` — e.g. `printBleed: number` insets content by machine-bleed margins exactly as `safeArea` does today. |

## 9. Testing strategy

- **Geometry unit tests** — intersection (shared edges are NOT overlaps), containment, safe-area math.
- **Validation tests** — every invalid combination must throw with the right field.
- **Derivation tests** — tap targets on touch surfaces, min font on far surfaces, priority sort order.
- **Structural tests** — same spec ⇒ stacked on tall, side-by-side on wide (proves adaptation, not scaling).
- **Degradation tests** — deterministic drop order as height shrinks; CTA can never drop; text truncates before violating `minTextSize`.
- **Invariant property tests** — a 5×7 matrix of surface sizes (widths 320→1920, heights 200→1400): **zero overlaps and zero out-of-bounds among placed elements in every case** (`tests/invariants.spec.ts`).
- **Renderer tests** — DOM boxes match resolved rects exactly; dropped elements are absent.
