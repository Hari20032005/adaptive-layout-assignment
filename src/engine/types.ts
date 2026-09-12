export type AdElementType = "text" | "image" | "button" | "logo";

export type AdElementRole = "primary" | "hero" | "action" | "secondary" | "branding";

export type Priority = 1 | 2 | 3 | 4 | 5;

export type Size = { width: number; height: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ViewingDistance = "near" | "medium" | "far";

export interface SurfaceProfile {
  id: string;
  label: string;
  width: number;
  height: number;
  safeArea?: SafeArea;
  minTapTarget?: number;
  minTextSize?: number;
  viewingDistance?: ViewingDistance;
  touchOnly?: boolean;
}

type ElementContentMap = {
  text: { text: string; maxLines?: number };
  image: { src: string; alt?: string; aspectRatio?: number };
  button: { label: string };
  logo: { src: string; alt?: string };
};

export type AdElementSpec = {
  [K in keyof ElementContentMap]: {
    id: string;
    type: K;
    role: AdElementRole;
    priority: Priority;
    content: ElementContentMap[K];
    minSize?: Size;
    preferredSize?: Size;
    interactive?: boolean;
  };
}[keyof ElementContentMap];

export interface AdSpec {
  elements: readonly AdElementSpec[];
}

export type ElementStatus = "placed" | "scaled" | "truncated" | "dropped";

export interface ResolvedElement extends Rect {
  id: string;
  type: AdElementType;
  role: AdElementRole;
  priority: Priority;
  status: ElementStatus;
  scale?: number;
  fontSize?: number;
  lines?: number;
  text?: string;
}

export interface Diagnostics {
  dropped: string[];
  scaled: string[];
  truncated: string[];
  passes: boolean;
}

export interface ResolvedLayout {
  surfaceId: string;
  elements: ResolvedElement[];
  diagnostics: Diagnostics;
}

export class SpecValidationError extends Error {
  readonly field: string;
  readonly reason: string;

  constructor(field: string, reason: string) {
    super(`[spec:${field}] ${reason}`);
    this.name = "SpecValidationError";
    this.field = field;
    this.reason = reason;
  }
}
