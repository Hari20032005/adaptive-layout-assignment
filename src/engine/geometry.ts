import type { Rect, SafeArea, SurfaceProfile } from "./types";

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function workingArea(surface: Pick<SurfaceProfile, "width" | "height">, safeArea?: SafeArea): Rect {
  if (!safeArea) {
    return { x: 0, y: 0, width: surface.width, height: surface.height };
  }
  return {
    x: safeArea.left,
    y: safeArea.top,
    width: surface.width - safeArea.left - safeArea.right,
    height: surface.height - safeArea.top - safeArea.bottom,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function anyIntersect(rects: Rect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (intersects(rects[i], rects[j])) return true;
    }
  }
  return false;
}

export function intersectListCheck(rects: Rect[]): boolean {
  return !anyIntersect(rects);
}
