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

export interface CoreKineticOptions {
	id?: string;
	title?: string;
	type?: KineticState;
	position?: KineticPosition;
	duration?: number | null;
	fill?: string;
	roundness?: number;
	autopilot?: boolean | KineticAutopilotOptions;
}
