export type KineticState =
	| "success"
	| "loading"
	| "error"
	| "warning"
	| "info"
	| "action";

export const KINETIC_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
] as const;

export type KineticPosition = (typeof KINETIC_POSITIONS)[number];

export interface KineticAutopilotOptions {
	expand?: number;
	collapse?: number;
}

export type KineticPerformanceMode = "quality" | "minimal";

export interface KineticEffects {
	gooey?: boolean;
	blur?: boolean;
}

export interface CoreKineticOptions {
	id?: string;
	title?: string;
	type?: KineticState;
	position?: KineticPosition;
	duration?: number | null;
	/**
	 * Hard wall-clock cap on how long this toast may stay in the navigation
	 * history. Independent of `duration` and ignores hover-pause — even
	 * sticky toasts (`duration: null`) age out at `maxAge` so old toasts
	 * stop cluttering the `<` `>` queue. Falls back to `<Toaster maxAge>`
	 * if unset; pass `null` to opt this toast out (e.g. long-running
	 * promise loading states).
	 */
	maxAge?: number | null;
	fill?: string;
	roundness?: number;
	autopilot?: boolean | KineticAutopilotOptions;
	performanceMode?: KineticPerformanceMode;
	effects?: KineticEffects;
}
