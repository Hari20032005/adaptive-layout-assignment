# Adaptive Layout Engine for Multi-Surface Ads

One declarative ad spec + one surface profile → a fully typed resolved layout, resolved by a priority-ordered constraint algorithm that re-composes the arrangement per surface — never `if (surface === "mobile")`, never CSS breakpoints making layout decisions.

## Setup

```bash
npm install
npm run dev      # starts the demo (default http://localhost:5173)
npm test         # 77 tests: invariants, degradation, validation, renderer
npm run build    # production build
```

Requires Node.js 20+.

## How to run the demo and switch surfaces

1. `npm run dev`
2. Pick a surface profile from the top bar: **Mobile Interstitial (portrait)**, **Mobile Landscape**, **Broadcast Lower Third**, **Retail Kiosk (square touch)**, and **Kiosk Compact** (a degradation demo surface that is intentionally too small for all elements).
3. The same ad spec re-resolves live. The right panel shows resolution diagnostics: which elements were scaled, truncated, or dropped, and whether all hard constraints hold.
4. On the kiosk surfaces, drag the **height slider** to shrink the surface and watch degradation happen live: the logo (`branding`, priority 3) drops cleanly first; promo text truncates/scales; price and CTA stay intact.

The ad used everywhere (5 elements of 4 types: headline, hero image, price, CTA button, promo text, brand logo) is defined exactly once in [`src/demo/sample-ad.ts`](src/demo/sample-ad.ts).

## Layout algorithm (summary — full detail in ARCHITECTURE.md)

```
Ad Spec + Surface Profile
      → constraint derivation (hard & soft constraints per element)
      → axis selection (numeric aspect-ratio rule, not surface names)
      → priority-ordered band formation (greedy)
      → cross-axis placement (aspect-ratio aware for images)
      → degradation cascade (compress → scale → truncate → drop)
      → ResolvedLayout (typed rects + statuses + diagnostics)
      → renderer (DOM today; the resolver is renderer-agnostic)
```

Degradation order is deterministic: **compress the scene → scale lowest-priority elements → truncate text (never below `minTextSize` on far-view surfaces) → drop the lowest-priority element** and re-resolve. No overlap or clipping is possible among placed elements — this is enforced by property tests over a matrix of surface sizes (see `tests/invariants.spec.ts`).

## Resolution flow

```
Ad Spec + Surface Profile → Constraint Resolver → Resolved Layout → Renderer
```

- `src/engine/` — pure TypeScript, zero DOM/framework imports
- `src/render/` — renderers consuming `ResolvedLayout` (DOM today)
- `src/demo/` — React demo application

Module mapping to the assignment's list: `spec.ts` ↔ `src/engine/spec.ts`, `surfaces.ts` ↔ `src/engine/surfaces.ts`, `resolver.ts` ↔ `src/engine/resolver.ts` (with `band.ts`, `place.ts`, `degrade.ts`, `constraints.ts`, `geometry.ts`, `measure.ts` as its internal phases), `render-dom.ts` ↔ `src/render/render-dom.ts`, `App.tsx` ↔ `src/demo/App.tsx`.

## TypeScript design

- `defineAd()` / `defineSurface()` produce frozen, validated objects. Element `content` is a discriminated union keyed by element `type` — a button without a `label` or a text element without `text` **fails at compile time**.
- Priorities are the literal union `1 | 2 | 3 | 4 | 5`; any other number is a type error.
- Constraint-inconsistency errors (safe area larger than the surface, `minTextSize` physically impossible for the surface height, tap target larger than the smaller dimension, duplicate element ids) throw a typed `SpecValidationError` with a field path and reason at definition time — an invalid combination can never reach the resolver.
- `ResolvedLayout` carries exact geometry (`x/y/width/height`), status flags, resolved font sizes/line counts/text, and diagnostics; a renderer consumes it without guessing (see `ARCHITECTURE.md`).

## Known limitations

- Fixed element-type set (`text`, `image`, `button`, `logo`) — adding a type requires one new branch in `constraints.ts` (measurement) and renderer.
- Band-based composition: elements never break across bands; very dense specs degrade by dropping rather than complex reflow.
- Image placeholders: the engine positions images, but the demo renders them as labeled placeholders (no asset loading).
- No animation between surfaces (single-surface re-resolution is instant).
- `minTapTarget` applies to interactive elements and `touchOnly` surfaces only; no contrast-aware branding placement yet.

## Time spent

Approximately **8 hours** across one focused session: algorithm design and iteration, engine implementation, test suite, and documentation.

## AI tools disclosure

This project was implemented with the help of AI coding tools (OpenCode/GLM). AI was used for: scaffolding guidance, writing and refining the resolution pipeline, and generating the test suite. All final code was reviewed, verified via the test suite, and can be explained by the author — the algorithm description in ARCHITECTURE.md matches the implementation.
