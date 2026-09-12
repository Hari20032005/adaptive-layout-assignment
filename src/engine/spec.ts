import { SpecValidationError, type AdElementSpec, type AdSpec, type Priority } from "./types";

const VALID_PRIORITIES: readonly Priority[] = [1, 2, 3, 4, 5];

const CONTENT_VALIDATORS: Record<string, (content: unknown) => string | null> = {
  text: (c) => {
    const content = c as { text?: unknown };
    if (typeof content.text !== "string" || content.text.length === 0) return "text content requires a non-empty 'text' string";
    return null;
  },
  image: (c) => {
    const content = c as { src?: unknown };
    if (typeof content.src !== "string" || content.src.length === 0) return "image content requires a non-empty 'src' string";
    return null;
  },
  button: (c) => {
    const content = c as { label?: unknown };
    if (typeof content.label !== "string" || content.label.length === 0) return "button content requires a non-empty 'label' string";
    return null;
  },
  logo: (c) => {
    const content = c as { src?: unknown };
    if (typeof content.src !== "string" || content.src.length === 0) return "logo content requires a non-empty 'src' string";
    return null;
  },
};

export function defineAd(spec: { elements: AdElementSpec[] }): AdSpec {
  const seen = new Set<string>();
  for (const el of spec.elements) {
    if (seen.has(el.id)) {
      throw new SpecValidationError(`elements[${el.id}].id`, `duplicate element id '${el.id}'`);
    }
    seen.add(el.id);

    if (!VALID_PRIORITIES.includes(el.priority)) {
      throw new SpecValidationError(`elements[${el.id}].priority`, `priority must be 1-5, got ${el.priority}`);
    }

    const validator = CONTENT_VALIDATORS[el.type];
    if (!validator) {
      throw new SpecValidationError(`elements[${el.id}].type`, `unknown element type '${el.type}'`);
    }
    const contentError = validator(el.content);
    if (contentError) {
      throw new SpecValidationError(`elements[${el.id}].content`, contentError);
    }
  }
  return Object.freeze({ elements: Object.freeze([...spec.elements]) });
}
