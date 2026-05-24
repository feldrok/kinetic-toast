"use client";

import type { CSSProperties } from "react";

import "./kinetic-toast/styles.css";

import {
	kinetic,
	Toaster as KineticToaster,
	type KineticToasterProps,
} from "./kinetic-toast/toast";

/*
 * Map shadcn design tokens onto kinetic's surface variables so toasts inherit
 * the host app theme. This is pure CSS — any theme manager that toggles
 * `.dark` on an ancestor (next-themes, Tailwind class mode, your own useState
 * toggle, prefers-color-scheme) flips `--popover` and therefore the toast
 * surface, with no JS dependency. If `--popover` isn't defined, these
 * declarations become invalid-at-computed-value-time and the kinetic defaults
 * from the colocated stylesheet take over.
 */
const themeStyle = {
	"--kinetic-fill": "var(--popover)",
	"--kinetic-fg-muted":
		"color-mix(in oklab, var(--popover-foreground) 60%, transparent)",
} as CSSProperties;

function Toaster({ style, ...props }: KineticToasterProps) {
	return <KineticToaster style={{ ...themeStyle, ...style }} {...props} />;
}

export { kinetic, Toaster };
export type { KineticPromiseOptions, KineticToasterProps } from "./kinetic-toast/toast";
export type {
	KineticButton,
	KineticOptions,
	KineticPosition,
	KineticState,
	KineticStyles,
} from "./kinetic-toast/types";
