/* --------------------------------- Layout --------------------------------- */

export const HEIGHT = 40;
export const WIDTH = 350;
export const DEFAULT_ROUNDNESS = 16;

/* --------------------------------- Timing --------------------------------- */

export const DURATION_MS = 600;
export const DURATION_S = DURATION_MS / 1000;

export const DEFAULT_TOAST_DURATION = 6000;
export const EXIT_DURATION = DEFAULT_TOAST_DURATION * 0.1;
export const AUTO_EXPAND_DELAY = DEFAULT_TOAST_DURATION * 0.025;
export const AUTO_COLLAPSE_DELAY = DEFAULT_TOAST_DURATION - 2000;

// Hard wall-clock cap on how long a toast may stay in the navigation
// history. Independent of `duration` and ignores hover-pause, so even
// sticky toasts (`duration: null`) age out and stop cluttering the
// `<` `>` queue after this interval. Override per-toast via
// `kinetic.success({ ..., maxAge })`, globally via `<Toaster maxAge>`,
// or opt out with `maxAge: null`.
export const DEFAULT_MAX_AGE = 60000;

export const SPRING = {
	type: "spring" as const,
	bounce: 0.25,
	duration: DURATION_S,
};

/* --------------------------------- Render --------------------------------- */

export const BLUR_RATIO = 0.5;
export const PILL_PADDING = 10;
export const MIN_EXPAND_RATIO = 2.25;
export const HEADER_EXIT_MS = DURATION_MS * 0.7;
