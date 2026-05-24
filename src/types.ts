import type { ReactNode } from "react";
import type { CoreKineticOptions } from "./core-types";

export { KINETIC_POSITIONS } from "./core-types";
export type {
	CoreKineticOptions,
	KineticAutopilotOptions,
	KineticEffects,
	KineticPerformanceMode,
	KineticPosition,
	KineticState,
} from "./core-types";

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

export interface ReactKineticOptions extends CoreKineticOptions {
	description?: ReactNode | string;
	icon?: ReactNode | null;
	styles?: KineticStyles;
	button?: KineticButton;
}

export type KineticOptions = ReactKineticOptions;
