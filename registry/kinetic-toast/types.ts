import type { ReactNode } from "react";

export type KineticState =
	| "success"
	| "loading"
	| "error"
	| "warning"
	| "info"
	| "action";

export interface KineticStyles {
	title?: string;
	description?: string;
	badge?: string;
	button?: string;
}

export interface KineticButton {
	title: string;
	onClick: () => void;
}

export const KINETIC_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
] as const;

export type KineticPosition = (typeof KINETIC_POSITIONS)[number];

export interface KineticOptions {
	id?: string;
	title?: string;
	description?: ReactNode | string;
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
	icon?: ReactNode | null;
	styles?: KineticStyles;
	fill?: string;
	roundness?: number;
	autopilot?: boolean | { expand?: number; collapse?: number };
	button?: KineticButton;
}
