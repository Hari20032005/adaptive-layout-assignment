import { SpecValidationError, type SurfaceProfile } from "./types";

const MAX_SINGLE_LINE_TEXT_RATIO = 0.5;

export function defineSurface(profile: SurfaceProfile): SurfaceProfile {
  const pos = (field: string) =>
    new SpecValidationError(field, "must be a positive number");

  if (!(profile.width > 0)) throw pos(`${profile.id}.width`);
  if (!(profile.height > 0)) throw pos(`${profile.id}.height`);

  if (profile.safeArea) {
    const { top, right, bottom, left } = profile.safeArea;
    if (top + bottom > profile.height || left + right > profile.width) {
      throw new SpecValidationError(
        `${profile.id}.safeArea`,
        `safe area insets (${left}+${right}w, ${top}+${bottom}h) exceed surface dimensions ${profile.width}x${profile.height}`,
      );
    }
  }

  if (profile.minTapTarget !== undefined && profile.minTapTarget > Math.min(profile.width, profile.height)) {
    throw new SpecValidationError(
      `${profile.id}.minTapTarget`,
      `minTapTarget ${profile.minTapTarget} exceeds smaller surface dimension ${Math.min(profile.width, profile.height)}`,
    );
  }

  if (
    profile.minTextSize !== undefined &&
    profile.minTextSize > profile.height * MAX_SINGLE_LINE_TEXT_RATIO
  ) {
    throw new SpecValidationError(
      `${profile.id}.minTextSize`,
      `minTextSize ${profile.minTextSize} is physically impossible for surface height ${profile.height}`,
    );
  }

  return Object.freeze({ ...profile, safeArea: profile.safeArea ? Object.freeze({ ...profile.safeArea }) : undefined });
}
