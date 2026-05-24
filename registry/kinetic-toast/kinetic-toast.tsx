"use client";

import { type CSSProperties, useMemo } from "react";

import "./kinetic-toast/styles.css";

import {
	kinetic,
	Toaster as KineticToaster,
	type KineticToasterProps,
} from "./kinetic-toast/toast";

/*
 * Map shadcn design tokens onto kinetic's public surface variables so toasts
 * inherit the host app theme. This is pure CSS — any theme manager that
 * toggles `.dark` (or another class) on html/body (next-themes, Tailwind
 * class mode, your own useState toggle, prefers-color-scheme) flips
 * `--popover` and therefore the toast surface, with no JS dependency.
 *
 * Each var() reference includes an explicit fallback to a private
 * `--_kinetic-toast-*-default` variable. The kinetic stylesheet defines
 * those defaults on `:root` and `.dark`, so when a host project doesn't
 * expose shadcn tokens the kinetic light/dark cascade still takes over.
 * Without the explicit fallback an unresolved `var(--popover)` would make
 * the consuming property invalid-at-computed-value-time and reset to its
 * initial value (e.g. `fill: black`), not inherit.
 *
 * Note: theme tokens must be reachable from html or body. A section-scoped
 * `.dark` deep in the page won't reach the body-portaled toast.
 */
const themeStyle = {
	"--kinetic-toast-fill":
		"var(--popover, var(--_kinetic-toast-fill-default))",
	"--kinetic-toast-fg":
		"var(--popover-foreground, var(--_kinetic-toast-fg-default))",
	"--kinetic-toast-fg-muted":
		"color-mix(in oklab, var(--popover-foreground, var(--_kinetic-toast-fg-default)) 60%, transparent)",
} as CSSProperties;

function Toaster({ style, theme, ...props }: KineticToasterProps) {
	// When the caller passes an explicit `theme`, skip the shadcn token
	// mapping so the inner Toaster's `data-theme` selector wins. Inline style
	// on the viewport otherwise outranks `[data-kinetic-viewport][data-theme]`
	// and silently overrides the explicit theme.
	const mergedStyle = useMemo<CSSProperties | undefined>(
		() => (theme === undefined ? { ...themeStyle, ...style } : style),
		[style, theme],
	);

	return <KineticToaster style={mergedStyle} theme={theme} {...props} />;
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
