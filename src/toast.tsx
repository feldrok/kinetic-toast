import {
	type CSSProperties,
	type MouseEventHandler,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
	AUTO_COLLAPSE_DELAY,
	AUTO_EXPAND_DELAY,
	DEFAULT_MAX_AGE,
	DEFAULT_TOAST_DURATION,
	EXIT_DURATION,
} from "./constants";
import { createKineticStore } from "./core-store";
import { Kinetic } from "./kinetic";
import { getSystemThemeSnapshot, subscribeSystemTheme } from "./system-theme";
import type { KineticOptions, KineticPosition, KineticState } from "./types";

const pillAlign = (pos: KineticPosition) =>
	pos.includes("right") ? "right" : pos.includes("center") ? "center" : "left";
const expandDir = (pos: KineticPosition) =>
	pos.startsWith("top") ? ("bottom" as const) : ("top" as const);

/* ---------------------------------- Types --------------------------------- */

interface InternalKineticOptions extends KineticOptions {
	state?: KineticState;
}

interface KineticItem extends InternalKineticOptions {
	id: string;
	instanceId: string;
	exiting?: boolean;
	autoExpandDelayMs?: number;
	autoCollapseDelayMs?: number;
	/**
	 * Wall-clock timestamp when this toast (or its current instance, after a
	 * `kinetic.success({ id })` style update) was placed in the store. Used
	 * by the Toaster to enforce `maxAge` independently of hover-pause.
	 */
	createdAt: number;
}

type KineticOffsetValue = number | string;
type KineticOffsetConfig = Partial<
	Record<"top" | "right" | "bottom" | "left", KineticOffsetValue>
>;

export interface KineticToasterProps {
	children?: ReactNode;
	position?: KineticPosition;
	offset?: KineticOffsetValue | KineticOffsetConfig;
	options?: Partial<KineticOptions>;
	theme?: "light" | "dark" | "system";
	closeButton?: boolean;
	navigation?: boolean;
	/**
	 * Default wall-clock cap on how long any toast in this Toaster stays in
	 * the navigation history. Defaults to 60s. Independent of `duration`
	 * and ignores hover-pause so old toasts age out even while you're
	 * navigating with `<` `>`. Per-toast `maxAge` overrides this; pass
	 * `null` to disable globally.
	 */
	maxAge?: number | null;
	/**
	 * Inline style applied to every viewport. The shadcn wrapper uses this to
	 * map host theme tokens (e.g. `--popover`) to the kinetic CSS variables
	 * (`--kinetic-toast-fill`, `--kinetic-toast-fg-muted`) so toasts inherit
	 * the app theme.
	 */
	style?: CSSProperties;
}

interface KineticViewportModel {
	position: KineticPosition;
	pill: "left" | "center" | "right";
	expand: "top" | "bottom";
	items: KineticItem[];
	live: KineticItem[];
	selectedId?: string;
	showNav: boolean;
	selectedIndex: number;
}

const groupToastsByPosition = (
	toasts: readonly KineticItem[],
	fallbackPosition: KineticPosition,
) => {
	const map = new Map<KineticPosition, KineticItem[]>();
	for (const toast of toasts) {
		const pos = toast.position ?? fallbackPosition;
		const items = map.get(pos);
		if (items) {
			items.push(toast);
		} else {
			map.set(pos, [toast]);
		}
	}
	return map;
};

const getSelectedToastId = (
	items: readonly KineticItem[],
	live: readonly KineticItem[],
	selectedId?: string,
) => {
	if (selectedId && items.some((toast) => toast.id === selectedId)) {
		return selectedId;
	}
	return (live[live.length - 1] ?? items[items.length - 1])?.id;
};

const deriveViewportModels = ({
	toasts,
	fallbackPosition,
	selectedIds,
	navigation,
}: {
	toasts: readonly KineticItem[];
	fallbackPosition: KineticPosition;
	selectedIds: Partial<Record<KineticPosition, string>>;
	navigation: boolean;
}): KineticViewportModel[] => {
	const grouped = groupToastsByPosition(toasts, fallbackPosition);
	const models: KineticViewportModel[] = [];

	for (const [pos, items] of grouped) {
		const live = items.filter((toast) => !toast.exiting);
		const selectedId = getSelectedToastId(items, live, selectedIds[pos]);
		const displayItem = items.find((toast) => toast.id === selectedId);
		const showNav = navigation && live.length > 1 && !displayItem?.exiting;

		models.push({
			position: pos,
			pill: pillAlign(pos),
			expand: expandDir(pos),
			items,
			live,
			selectedId,
			showNav,
			selectedIndex: live.findIndex((toast) => toast.id === selectedId),
		});
	}

	return models;
};

/* ------------------------------ Global State ------------------------------ */

const store = createKineticStore<KineticItem>();
let defaultPosition: KineticPosition = "top-right";
let defaultOptions: Partial<KineticOptions> | undefined;

let idCounter = 0;
const generateId = () =>
	`${++idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const timeoutKey = (t: KineticItem) => `${t.id}:${t.instanceId}`;

/* ------------------------------- Toast API -------------------------------- */

const dismissToast = (id: string, instanceId?: string) => {
	const item = store.getSnapshot().find((t) =>
		instanceId ? t.id === id && t.instanceId === instanceId : t.id === id,
	);
	if (!item || item.exiting) return;
	const currentInstanceId = item.instanceId;

	store.update((prev) =>
		prev.map((t) =>
			t.id === id && t.instanceId === currentInstanceId
				? { ...t, exiting: true }
				: t,
		),
	);

	setTimeout(
		() =>
			store.update((prev) =>
				prev.filter(
					(t) => !(t.id === id && t.instanceId === currentInstanceId),
				),
			),
		EXIT_DURATION,
	);
};

const resolveAutopilot = (
	opts: InternalKineticOptions,
	duration: number | null,
): { expandDelayMs?: number; collapseDelayMs?: number } => {
	if (opts.autopilot === false || !duration || duration <= 0) return {};
	const cfg = typeof opts.autopilot === "object" ? opts.autopilot : undefined;
	const clamp = (v: number) => Math.min(duration, Math.max(0, v));
	return {
		expandDelayMs: clamp(cfg?.expand ?? AUTO_EXPAND_DELAY),
		collapseDelayMs: clamp(cfg?.collapse ?? AUTO_COLLAPSE_DELAY),
	};
};

const mergeOptions = (options: InternalKineticOptions) => ({
	...defaultOptions,
	...options,
	styles: { ...defaultOptions?.styles, ...options.styles },
});

const buildKineticItem = (
	merged: InternalKineticOptions,
	id: string,
	fallbackPosition?: KineticPosition,
): KineticItem => {
	const duration = merged.duration ?? DEFAULT_TOAST_DURATION;
	const auto = resolveAutopilot(merged, duration);
	return {
		...merged,
		id,
		instanceId: generateId(),
		position: merged.position ?? fallbackPosition ?? defaultPosition,
		autoExpandDelayMs: auto.expandDelayMs,
		autoCollapseDelayMs: auto.collapseDelayMs,
		createdAt: Date.now(),
	};
};

const resolveMaxAge = (
	item: KineticItem,
	defaultMaxAge: number | null,
): number | null => {
	if (item.maxAge === null) return null;
	if (typeof item.maxAge === "number") return item.maxAge;
	return defaultMaxAge;
};

const createToast = (options: InternalKineticOptions) => {
	const live = store.getSnapshot().filter((t) => !t.exiting);
	const merged = mergeOptions(options);

	const id = merged.id ?? generateId();
	const prev = live.find((t) => t.id === id);
	const item = buildKineticItem(merged, id, prev?.position);

	if (prev) {
		store.update((p) => p.map((t) => (t.id === id ? item : t)));
	} else {
		store.update((p) => [...p.filter((t) => t.id !== id), item]);
	}
	return { id, duration: merged.duration ?? DEFAULT_TOAST_DURATION };
};

const updateToast = (id: string, options: InternalKineticOptions) => {
	const existing = store.getSnapshot().find((t) => t.id === id);
	if (!existing) return;

	const item = buildKineticItem(mergeOptions(options), id, existing.position);
	store.update((prev) => prev.map((t) => (t.id === id ? item : t)));
};

export interface KineticPromiseOptions<T = unknown> {
	loading: KineticOptions;
	success: KineticOptions | ((data: T) => KineticOptions);
	error: KineticOptions | ((err: unknown) => KineticOptions);
	action?: KineticOptions | ((data: T) => KineticOptions);
	position?: KineticPosition;
}

export const kinetic = {
	show: (opts: KineticOptions) => createToast({ ...opts, state: opts.type }).id,
	success: (opts: KineticOptions) =>
		createToast({ ...opts, state: "success" }).id,
	error: (opts: KineticOptions) => createToast({ ...opts, state: "error" }).id,
	warning: (opts: KineticOptions) =>
		createToast({ ...opts, state: "warning" }).id,
	info: (opts: KineticOptions) => createToast({ ...opts, state: "info" }).id,
	action: (opts: KineticOptions) => createToast({ ...opts, state: "action" }).id,

	promise: <T,>(
		promise: Promise<T> | (() => Promise<T>),
		opts: KineticPromiseOptions<T>,
	): Promise<T> => {
		const { id } = createToast({
			...opts.loading,
			state: "loading",
			duration: null,
			// Long-running promises must not be killed by the navigation
			// history cap. Callers can still opt back in by passing
			// `maxAge: <ms>` in `opts.loading`.
			maxAge: opts.loading.maxAge ?? null,
			position: opts.position,
		});

		const p = typeof promise === "function" ? promise() : promise;

		p.then((data) => {
			if (opts.action) {
				const actionOpts =
					typeof opts.action === "function" ? opts.action(data) : opts.action;
				updateToast(id, { ...actionOpts, state: "action", id });
			} else {
				const successOpts =
					typeof opts.success === "function"
						? opts.success(data)
						: opts.success;
				updateToast(id, { ...successOpts, state: "success", id });
			}
		}).catch((err) => {
			const errorOpts =
				typeof opts.error === "function" ? opts.error(err) : opts.error;
			updateToast(id, { ...errorOpts, state: "error", id });
		});

		return p;
	},

	dismiss: dismissToast,

	clear: (position?: KineticPosition) =>
		store.update((prev) =>
			position ? prev.filter((t) => t.position !== position) : [],
		),
};

/* ------------------------------ Toaster Component ------------------------- */

function useResolvedTheme(
	theme: "light" | "dark" | "system" | undefined,
): "light" | "dark" {
	const systemTheme = useSyncExternalStore(
		subscribeSystemTheme,
		getSystemThemeSnapshot,
		() => "light" as const,
	);

	return theme === "light" || theme === "dark" ? theme : systemTheme;
}

export function Toaster({
	children,
	position = "top-right",
	offset,
	options,
	theme,
	closeButton = false,
	navigation = false,
	maxAge = DEFAULT_MAX_AGE,
	style,
}: KineticToasterProps) {
	const resolvedTheme = useResolvedTheme(theme);
	const toasts = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const [activeId, setActiveId] = useState<string>();
	const [mounted, setMounted] = useState(false);
	const [selectedIds, setSelectedIds] = useState<
		Partial<Record<KineticPosition, string>>
	>({});

	const hoverRef = useRef(false);
	const timersRef = useRef(new Map<string, number>());
	// Wall-clock max-age timers. Separate from `timersRef` because they MUST
	// NOT pause on hover — even sticky toasts should age out of the nav queue.
	const maxAgeTimersRef = useRef(new Map<string, number>());
	const listRef = useRef<readonly KineticItem[]>(toasts);
	const latestRef = useRef<string | undefined>(undefined);
	const prevLiveIdsRef = useRef(new Set<string>());
	const handlersCache = useRef(
		new Map<
			string,
			{
				enter: MouseEventHandler<HTMLDivElement>;
				leave: MouseEventHandler<HTMLDivElement>;
				dismiss: () => void;
			}
		>(),
	);

	useEffect(() => {
		const previousPosition = defaultPosition;
		const previousOptions = defaultOptions;
		defaultPosition = position;
		defaultOptions = options;

		return () => {
			if (defaultPosition === position) defaultPosition = previousPosition;
			if (defaultOptions === options) defaultOptions = previousOptions;
		};
	}, [position, options]);

	useEffect(() => {
		setMounted(true);
	}, []);

	const clearAllTimers = useCallback(() => {
		for (const t of timersRef.current.values()) clearTimeout(t);
		timersRef.current.clear();
	}, []);

	const clearAllMaxAgeTimers = useCallback(() => {
		for (const t of maxAgeTimersRef.current.values()) clearTimeout(t);
		maxAgeTimersRef.current.clear();
	}, []);

	const schedule = useCallback((items: readonly KineticItem[]) => {
		if (hoverRef.current) return;

		for (const item of items) {
			if (item.exiting) continue;
			const key = timeoutKey(item);
			if (timersRef.current.has(key)) continue;

			if (item.duration === null) continue;
			const dur = item.duration ?? DEFAULT_TOAST_DURATION;
			if (dur <= 0) continue;

			timersRef.current.set(
				key,
				window.setTimeout(() => dismissToast(item.id, item.instanceId), dur),
			);
		}
	}, []);

	const scheduleMaxAge = useCallback(
		(items: readonly KineticItem[]) => {
			for (const item of items) {
				if (item.exiting) continue;
				const key = timeoutKey(item);
				if (maxAgeTimersRef.current.has(key)) continue;

				const max = resolveMaxAge(item, maxAge);
				if (max === null || max <= 0) continue;

				const elapsed = Date.now() - item.createdAt;
				const remaining = Math.max(0, max - elapsed);

				maxAgeTimersRef.current.set(
					key,
					window.setTimeout(
						() => dismissToast(item.id, item.instanceId),
						remaining,
					),
				);
			}
		},
		[maxAge],
	);

	useEffect(
		() => () => {
			clearAllTimers();
			clearAllMaxAgeTimers();
		},
		[clearAllTimers, clearAllMaxAgeTimers],
	);

	useEffect(() => {
		listRef.current = toasts;

		const toastKeys = new Set(toasts.map(timeoutKey));
		const toastIds = new Set(toasts.map((t) => t.id));
		for (const [key, timer] of timersRef.current) {
			if (!toastKeys.has(key)) {
				clearTimeout(timer);
				timersRef.current.delete(key);
			}
		}
		for (const id of handlersCache.current.keys()) {
			if (!toastIds.has(id)) handlersCache.current.delete(id);
		}

		const currentLive = toasts.filter((t) => !t.exiting);
		const newToasts = currentLive.filter((t) => !prevLiveIdsRef.current.has(t.id));
		if (newToasts.length > 0) {
			setSelectedIds((prev) => {
				const next = { ...prev };
				for (const t of newToasts) {
					const pos = t.position ?? position;
					delete next[pos];
				}
				return next;
			});
		}
		prevLiveIdsRef.current = new Set(currentLive.map((t) => t.id));

		schedule(toasts);
		// Recompute every pass so `maxAge` prop changes take effect and so
		// stale timers from removed/updated toast instances are dropped.
		// Each delay is computed as `max - (now - createdAt)`, so rebuilding
		// the timer for an existing toast preserves its absolute deadline.
		clearAllMaxAgeTimers();
		scheduleMaxAge(toasts);
	}, [toasts, schedule, scheduleMaxAge, clearAllMaxAgeTimers, position]);

	const handleMouseEnterRef =
		useRef<MouseEventHandler<HTMLDivElement>>(null);
	const handleMouseLeaveRef =
		useRef<MouseEventHandler<HTMLDivElement>>(null);

	handleMouseEnterRef.current = useCallback<
		MouseEventHandler<HTMLDivElement>
	>(() => {
		if (hoverRef.current) return;
		hoverRef.current = true;
		clearAllTimers();
	}, [clearAllTimers]);

	handleMouseLeaveRef.current = useCallback<
		MouseEventHandler<HTMLDivElement>
	>(() => {
		if (!hoverRef.current) return;
		hoverRef.current = false;
		schedule(listRef.current);
	}, [schedule]);

	const latest = useMemo(() => {
		for (let i = toasts.length - 1; i >= 0; i--) {
			if (!toasts[i].exiting) return toasts[i].id;
		}
		return undefined;
	}, [toasts]);

	useEffect(() => {
		latestRef.current = latest;
		setActiveId(latest);
	}, [latest]);

	const getHandlers = useCallback((toastId: string) => {
		let cached = handlersCache.current.get(toastId);
		if (cached) return cached;

		cached = {
			enter: ((e) => {
				setActiveId((prev) => (prev === toastId ? prev : toastId));
				handleMouseEnterRef.current?.(e);
			}) as MouseEventHandler<HTMLDivElement>,
			leave: ((e) => {
				setActiveId((prev) =>
					prev === latestRef.current ? prev : latestRef.current,
				);
				handleMouseLeaveRef.current?.(e);
			}) as MouseEventHandler<HTMLDivElement>,
			dismiss: () => dismissToast(toastId),
		};

		handlersCache.current.set(toastId, cached);
		return cached;
	}, []);

	const getViewportStyle = useCallback(
		(pos: KineticPosition): CSSProperties | undefined => {
			const s: CSSProperties = style ? { ...style } : {};

			if (offset !== undefined) {
				const o =
					typeof offset === "object"
						? offset
						: { top: offset, right: offset, bottom: offset, left: offset };

				const px = (v: KineticOffsetValue) =>
					typeof v === "number" ? `${v}px` : v;

				if (pos.startsWith("top") && o.top) s.top = px(o.top);
				if (pos.startsWith("bottom") && o.bottom) s.bottom = px(o.bottom);
				if (pos.endsWith("left") && o.left) s.left = px(o.left);
				if (pos.endsWith("right") && o.right) s.right = px(o.right);
			}

			return Object.keys(s).length > 0 ? s : undefined;
		},
		[offset, style],
	);

	const viewportModels = deriveViewportModels({
		toasts,
		fallbackPosition: position,
		selectedIds,
		navigation,
	});

	const navigate = useCallback(
		(pos: KineticPosition, dir: -1 | 1) => {
			const items =
				groupToastsByPosition(listRef.current, position).get(pos) ?? [];
			const live = items.filter((toast) => !toast.exiting);
			setSelectedIds((prev) => {
				const currentId =
					prev[pos] && live.some((toast) => toast.id === prev[pos])
						? prev[pos]
						: live[live.length - 1]?.id;
				const currentIndex = live.findIndex((toast) => toast.id === currentId);
				const nextIndex = Math.max(
					0,
					Math.min(live.length - 1, currentIndex + dir),
				);
				const nextId = live[nextIndex]?.id;
				if (!nextId || nextId === prev[pos]) return prev;
				return { ...prev, [pos]: nextId };
			});
		},
		[position],
	);

	const viewports = viewportModels.map((model) => {
		// In navigation mode, render ONE Kinetic per viewport with a stable
		// React key so switching toasts via `<` `>` updates props on the same
		// instance and triggers Kinetic's existing morph animation, rather
		// than unmounting + remounting (which would re-render abruptly).
		if (navigation && model.selectedId) {
			const selected =
				model.items.find((toast) => toast.id === model.selectedId) ??
				model.items[model.items.length - 1];
			if (!selected) return null;
			const h = getHandlers(selected.id);
			return (
				<section
					key={model.position}
					data-kinetic-viewport
					data-position={model.position}
					data-theme={theme ? resolvedTheme : undefined}
					aria-live="polite"
					style={getViewportStyle(model.position)}
				>
					<Kinetic
						key={`viewport-${model.position}`}
						id={selected.id}
						state={selected.state}
						title={selected.title}
						description={selected.description}
						position={model.pill}
						expand={model.expand}
						icon={selected.icon}
						fill={selected.fill}
						styles={selected.styles}
						button={selected.button}
						roundness={selected.roundness}
						performanceMode={selected.performanceMode}
						effects={selected.effects}
						exiting={selected.exiting}
						autoExpandDelayMs={selected.autoExpandDelayMs}
						autoCollapseDelayMs={selected.autoCollapseDelayMs}
						refreshKey={selected.instanceId}
						canExpand={
							activeId === undefined || activeId === selected.id
						}
						closeButton={closeButton}
						navIndex={model.showNav ? model.selectedIndex : undefined}
						navTotal={model.showNav ? model.live.length : undefined}
						onNavigate={(dir) => navigate(model.position, dir)}
						onMouseEnter={h.enter}
						onMouseLeave={h.leave}
						onDismiss={h.dismiss}
					/>
				</section>
			);
		}

		return (
			<section
				key={model.position}
				data-kinetic-viewport
				data-position={model.position}
				data-theme={theme ? resolvedTheme : undefined}
				aria-live="polite"
				style={getViewportStyle(model.position)}
			>
				{model.items.map((item) => {
					const h = getHandlers(item.id);
					return (
						<Kinetic
							key={item.id}
							id={item.id}
							state={item.state}
							title={item.title}
							description={item.description}
							position={model.pill}
							expand={model.expand}
							icon={item.icon}
							fill={item.fill}
							styles={item.styles}
							button={item.button}
							roundness={item.roundness}
							performanceMode={item.performanceMode}
							effects={item.effects}
							exiting={item.exiting}
							autoExpandDelayMs={item.autoExpandDelayMs}
							autoCollapseDelayMs={item.autoCollapseDelayMs}
							refreshKey={item.instanceId}
							canExpand={activeId === undefined || activeId === item.id}
							closeButton={closeButton}
							onMouseEnter={h.enter}
							onMouseLeave={h.leave}
							onDismiss={h.dismiss}
						/>
					);
				})}
			</section>
		);
	});

	return (
		<>
			{children}
			{!mounted || typeof document === "undefined"
				? null
				: createPortal(<>{viewports}</>, document.body)}
		</>
	);
}
