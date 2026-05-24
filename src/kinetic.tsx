import { motion } from "motion/react";
import {
	type CSSProperties,
	type MouseEventHandler,
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BLUR_RATIO,
	DEFAULT_ROUNDNESS,
	HEADER_EXIT_MS,
	HEIGHT,
	MIN_EXPAND_RATIO,
	PILL_PADDING,
	SPRING,
	WIDTH,
} from "./constants";
import {
	ArrowRight,
	Check,
	ChevronLeft,
	ChevronRight,
	CircleAlert,
	LifeBuoy,
	LoaderCircle,
	X,
} from "./icons";
import type {
	KineticButton,
	KineticEffects,
	KineticPerformanceMode,
	KineticState,
	KineticStyles,
} from "./types";

type State = KineticState;

interface VisualEffects {
	gooey: boolean;
	blur: boolean;
}

const resolveVisualEffects = (
	performanceMode?: KineticPerformanceMode,
	effects?: KineticEffects,
): VisualEffects => {
	const defaults =
		performanceMode === "minimal"
			? { gooey: false, blur: false }
			: { gooey: true, blur: true };

	return {
		gooey: effects?.gooey ?? defaults.gooey,
		blur: effects?.blur ?? defaults.blur,
	};
};

interface View {
	title?: string;
	description?: ReactNode | string;
	state: State;
	icon?: ReactNode | null;
	styles?: KineticStyles;
	button?: KineticButton;
	fill?: string;
}

interface KineticProps {
	id: string;
	fill?: string;
	state?: State;
	title?: string;
	description?: ReactNode | string;
	position?: "left" | "center" | "right";
	expand?: "top" | "bottom";
	className?: string;
	icon?: ReactNode | null;
	styles?: KineticStyles;
	button?: KineticButton;
	roundness?: number;
	performanceMode?: KineticPerformanceMode;
	effects?: KineticEffects;
	exiting?: boolean;
	autoExpandDelayMs?: number;
	autoCollapseDelayMs?: number;
	canExpand?: boolean;
	interruptKey?: string;
	refreshKey?: string;
	closeButton?: boolean;
	navIndex?: number;
	navTotal?: number;
	onNavigate?: (dir: -1 | 1) => void;
	onMouseEnter?: MouseEventHandler<HTMLDivElement>;
	onMouseLeave?: MouseEventHandler<HTMLDivElement>;
	onDismiss?: () => void;
}

/* ---------------------------------- Icons --------------------------------- */

const STATE_ICON: Record<State, ReactNode> = {
	success: <Check />,
	loading: <LoaderCircle data-kinetic-icon="spin" aria-hidden="true" />,
	error: <X />,
	warning: <CircleAlert />,
	info: <LifeBuoy />,
	action: <ArrowRight />,
};

/* ----------------------------- Memoised Defs ------------------------------ */
const GooeyDefs = memo(function GooeyDefs({
	filterId,
	blur,
}: {
	filterId: string;
	blur: number;
}) {
	return (
		<defs>
			<filter
				id={filterId}
				x="-20%"
				y="-20%"
				width="140%"
				height="140%"
				colorInterpolationFilters="sRGB"
			>
				<feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
				<feColorMatrix
					in="blur"
					mode="matrix"
					values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
					result="goo"
				/>
				<feComposite in="SourceGraphic" in2="goo" operator="atop" />
			</filter>
		</defs>
	);
});

/* ------------------------------- Component -------------------------------- */

export const Kinetic = memo(function Kinetic({
	id,
	fill,
	state = "success",
	title = state,
	description,
	position = "left",
	expand = "bottom",
	className,
	icon,
	styles,
	button,
	roundness,
	performanceMode,
	effects,
	exiting = false,
	autoExpandDelayMs,
	autoCollapseDelayMs,
	canExpand,
	interruptKey,
	refreshKey,
	closeButton = false,
	navIndex,
	navTotal,
	onNavigate,
	onMouseEnter,
	onMouseLeave,
	onDismiss,
}: KineticProps) {
	const next: View = useMemo(
		() => ({ title, description, state, icon, styles, button, fill }),
		[title, description, state, icon, styles, button, fill],
	);

	const [view, setView] = useState<View>(next);
	const [applied, setApplied] = useState(refreshKey);
	const [isExpanded, setIsExpanded] = useState(false);
	const [ready, setReady] = useState(false);
	const [pillWidth, setPillWidth] = useState(0);
	const [contentHeight, setContentHeight] = useState(0);
	const hasDesc = Boolean(view.description) || Boolean(view.button);
	const isLoading = view.state === "loading";
	const open = hasDesc && isExpanded && !isLoading;
	const allowExpand = isLoading
		? false
		: (canExpand ?? (!interruptKey || interruptKey === id));

	const headerKey = `${view.state}-${view.title}`;
	const filterId = `kinetic-gooey-${id}`;
	const resolvedRoundness = Math.max(0, roundness ?? DEFAULT_ROUNDNESS);
	const visualEffects = resolveVisualEffects(performanceMode, effects);
	const gooeyBlur = visualEffects.gooey ? resolvedRoundness * BLUR_RATIO : 0;
	const headerBlur = visualEffects.blur ? "6px" : "0px";

	const headerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const headerExitRef = useRef<number | null>(null);
	const autoExpandRef = useRef<number | null>(null);
	const autoCollapseRef = useRef<number | null>(null);
	const lastRefreshKeyRef = useRef(refreshKey);
	const [headerLayer, setHeaderLayer] = useState<{
		current: { key: string; view: View };
		prev: { key: string; view: View } | null;
	}>({ current: { key: headerKey, view }, prev: null });

	/* ------------------------------ Measurements ------------------------------ */

	const innerRef = useRef<HTMLDivElement>(null);

	const headerPadRef = useRef<number | null>(null);

	const pillRoRef = useRef<ResizeObserver | null>(null);
	const pillRafRef = useRef(0);
	const pillObservedRef = useRef<Element | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: headerLayer.current.key is used to force a re-render
	useLayoutEffect(() => {
		const el = innerRef.current;
		const header = headerRef.current;
		if (!el || !header) return;
		if (headerPadRef.current === null) {
			const cs = getComputedStyle(header);
			headerPadRef.current =
				parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
		}
		const px = headerPadRef.current;
		const measure = () => {
			const w = el.scrollWidth + px + PILL_PADDING;
			if (w > PILL_PADDING) {
				setPillWidth((prev) => (prev === w ? prev : w));
			}
		};
		measure();

		if (!pillRoRef.current) {
			pillRoRef.current = new ResizeObserver(() => {
				cancelAnimationFrame(pillRafRef.current);
				pillRafRef.current = requestAnimationFrame(() => {
					const inner = innerRef.current;
					const pad = headerPadRef.current ?? 0;
					if (!inner) return;
					const w = inner.scrollWidth + pad + PILL_PADDING;
					if (w > PILL_PADDING) {
						setPillWidth((prev) => (prev === w ? prev : w));
					}
				});
			});
		}

		if (pillObservedRef.current !== el) {
			if (pillObservedRef.current) {
				pillRoRef.current.unobserve(pillObservedRef.current);
			}
			pillRoRef.current.observe(el);
			pillObservedRef.current = el;
		}
	}, [headerLayer.current.key]);

	useEffect(() => {
		return () => {
			cancelAnimationFrame(pillRafRef.current);
			pillRoRef.current?.disconnect();
		};
	}, []);

	useLayoutEffect(() => {
		if (!hasDesc) {
			setContentHeight(0);
			return;
		}
		const el = contentRef.current;
		if (!el) return;
		const measure = () => {
			const h = el.scrollHeight;
			setContentHeight((prev) => (prev === h ? prev : h));
		};
		measure();
		let rafId = 0;
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(measure);
		});
		ro.observe(el);
		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
		};
	}, [hasDesc]);

	useEffect(() => {
		const raf = requestAnimationFrame(() => setReady(true));
		return () => cancelAnimationFrame(raf);
	}, []);

	useLayoutEffect(() => {
		setHeaderLayer((state) => {
			if (state.current.key === headerKey) {
				if (state.current.view === view) return state;
				return { ...state, current: { key: headerKey, view } };
			}
			return {
				prev: state.current,
				current: { key: headerKey, view },
			};
		});
	}, [headerKey, view]);

	useEffect(() => {
		if (!headerLayer.prev) return;
		if (headerExitRef.current) {
			clearTimeout(headerExitRef.current);
		}
		headerExitRef.current = window.setTimeout(() => {
			headerExitRef.current = null;
			setHeaderLayer((state) => ({ ...state, prev: null }));
		}, HEADER_EXIT_MS);
		return () => {
			if (headerExitRef.current) {
				clearTimeout(headerExitRef.current);
				headerExitRef.current = null;
			}
		};
	}, [headerLayer.prev]);

	/* ----------------------------- Sync fill ---------------------------------- */

	useEffect(() => {
		setView((prev) => (prev.fill === fill ? prev : { ...prev, fill }));
	}, [fill]);

	/* ----------------------------- Refresh logic ------------------------------ */

	useEffect(() => {
		if (refreshKey === undefined) {
			setView(next);
			setApplied(undefined);
			lastRefreshKeyRef.current = refreshKey;
			return;
		}

		if (lastRefreshKeyRef.current === refreshKey) return;
		lastRefreshKeyRef.current = refreshKey;

		setView(next);
		setApplied(refreshKey);
	}, [refreshKey, next]);

	/* ----------------------------- Auto expand/collapse ----------------------- */

	// biome-ignore lint/correctness/useExhaustiveDependencies: applied is used to force a re-render
	useEffect(() => {
		if (!hasDesc) return;

		if (autoExpandRef.current) clearTimeout(autoExpandRef.current);
		if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);

		if (exiting || !allowExpand) {
			setIsExpanded(false);
			return;
		}

		if (autoExpandDelayMs == null && autoCollapseDelayMs == null) return;

		const expandDelay = autoExpandDelayMs ?? 0;
		const collapseDelay = autoCollapseDelayMs ?? 0;

		if (expandDelay > 0) {
			autoExpandRef.current = window.setTimeout(
				() => setIsExpanded(true),
				expandDelay,
			);
		} else {
			setIsExpanded(true);
		}

		if (collapseDelay > 0) {
			autoCollapseRef.current = window.setTimeout(
				() => setIsExpanded(false),
				collapseDelay,
			);
		}

		return () => {
			if (autoExpandRef.current) clearTimeout(autoExpandRef.current);
			if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
		};
	}, [
		autoCollapseDelayMs,
		autoExpandDelayMs,
		hasDesc,
		allowExpand,
		exiting,
		applied,
	]);

	/* ------------------------------ Derived values ---------------------------- */

	const showNav = navTotal !== undefined && navTotal > 1;
	const minExpanded = HEIGHT * MIN_EXPAND_RATIO;
	const rawExpanded = hasDesc
		? Math.max(minExpanded, HEIGHT + contentHeight)
		: minExpanded;

	const frozenExpandedRef = useRef(rawExpanded);
	if (open) {
		frozenExpandedRef.current = rawExpanded;
	}

	const contentGap = open && !visualEffects.gooey ? 6 : 0;
	const expanded = (open ? rawExpanded : frozenExpandedRef.current) + contentGap;
	const svgHeight = hasDesc ? Math.max(expanded, minExpanded) : HEIGHT;
	const expandedContent = Math.max(0, expanded - HEIGHT - contentGap);
	// 50 reserves room for the two nav chevrons + gap. When the close
	// button is also rendered, the nav cluster is shifted left via the CSS
	// `:has([data-kinetic-close])` rule by `var(--kinetic-height) - 0.5rem`
	// (32px when HEIGHT=40); add HEIGHT here so the pill grows enough that
	// the auto-margin can still resolve to a non-zero value instead of
	// overflowing into the close button.
	const navExtra = showNav ? (closeButton ? 50 + HEIGHT : 50) : 0;
	const resolvedPillWidth = Math.max(pillWidth || HEIGHT, HEIGHT) + navExtra;
	const pillHeight = HEIGHT + gooeyBlur * 3;

	const pillX =
		position === "right"
			? WIDTH - resolvedPillWidth
			: position === "center"
				? (WIDTH - resolvedPillWidth) / 2
				: 0;

	/* ------------------------------- Memoised animate targets ----------------- */

	const pillAnimate = useMemo(
		() => ({
			x: pillX,
			width: resolvedPillWidth,
			height: open ? pillHeight : HEIGHT,
		}),
		[pillX, resolvedPillWidth, open, pillHeight],
	);

	const bodyAnimate = useMemo(
		() => ({
			y: HEIGHT + contentGap,
			height: open ? expandedContent : 0,
			opacity: open ? 1 : 0,
		}),
		[open, expandedContent, contentGap],
	);

	const bodyTransition = useMemo(
		() => (open ? SPRING : { ...SPRING, bounce: 0 }),
		[open],
	);

	const pillTransition = useMemo(
		() => (ready ? SPRING : { duration: 0 }),
		[ready],
	);

	const viewBox = `0 0 ${WIDTH} ${svgHeight}`;

	const canvasStyle = useMemo<CSSProperties | undefined>(
		() =>
			visualEffects.gooey ? { filter: `url(#${filterId})` } : undefined,
		[filterId, visualEffects.gooey],
	);

	const shapeStyle = useMemo<CSSProperties | undefined>(
		() => (view.fill ? { fill: view.fill } : undefined),
		[view.fill],
	);

	/* ------------------------------- Inline styles ---------------------------- */

	const rootStyle = useMemo<CSSProperties & Record<string, string>>(
		() => ({
			"--_h": `${open ? expanded : HEIGHT}px`,
			"--_pw": `${resolvedPillWidth}px`,
			"--_px": `${pillX}px`,
			"--_ht": "translateY(0px) scale(1)",
			"--_co": `${open ? 1 : 0}`,
			"--_cg": `${contentGap}px`,
			"--_hb": headerBlur,
		}),
		[open, expanded, resolvedPillWidth, pillX, contentGap, headerBlur],
	);

	/* -------------------------------- Handlers -------------------------------- */

	const handleEnter: MouseEventHandler<HTMLDivElement> = useCallback(
		(e) => {
			onMouseEnter?.(e);
			if (hasDesc) setIsExpanded(true);
		},
		[hasDesc, onMouseEnter],
	);

	const handleLeave: MouseEventHandler<HTMLDivElement> = useCallback(
		(e) => {
			onMouseLeave?.(e);
			setIsExpanded(false);
		},
		[onMouseLeave],
	);

	/* -------------------------------- Swipe ----------------------------------- */

	const SWIPE_DISMISS = 30;
	const SWIPE_MAX = 20;
	const rootRef = useRef<HTMLDivElement>(null);
	const pointerStartRef = useRef<number | null>(null);
	const onDismissRef = useRef(onDismiss);
	onDismissRef.current = onDismiss;

	const swipeHandlersRef = useRef<{
		onMove: (e: PointerEvent) => void;
		onUp: (e: PointerEvent) => void;
		onCancel: () => void;
	} | null>(null);

	const cleanupSwipe = useCallback(() => {
		const el = rootRef.current;
		const h = swipeHandlersRef.current;
		pointerStartRef.current = null;
		if (!el || !h) return;
		el.style.transform = "";
		el.removeEventListener("pointermove", h.onMove);
		el.removeEventListener("pointerup", h.onUp);
		el.removeEventListener("pointercancel", h.onCancel);
		el.removeEventListener("lostpointercapture", h.onCancel);
	}, []);

	if (!swipeHandlersRef.current) {
		const handlers = {
			onMove: (e: PointerEvent) => {
				const el = rootRef.current;
				if (pointerStartRef.current === null || !el) return;
				const dy = e.clientY - pointerStartRef.current;
				const sign = dy > 0 ? 1 : -1;
				const clamped = Math.min(Math.abs(dy), SWIPE_MAX) * sign;
				el.style.transform = `translateY(${clamped}px)`;
			},
			onUp: (e: PointerEvent) => {
				if (pointerStartRef.current === null) return;
				const dy = e.clientY - pointerStartRef.current;
				cleanupSwipe();
				if (Math.abs(dy) > SWIPE_DISMISS) {
					onDismissRef.current?.();
				}
			},
			onCancel: () => cleanupSwipe(),
		};
		swipeHandlersRef.current = handlers;
	}

	useEffect(() => cleanupSwipe, [cleanupSwipe]);

	const handleButtonClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();
			view.button?.onClick();
		},
		[view.button],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (exiting || !onDismiss) return;
			const target = e.target as HTMLElement;
			if (target.closest("[data-kinetic-button]")) return;
			if (target.closest("[data-kinetic-close]")) return;
			if (target.closest("[data-kinetic-nav]")) return;
			pointerStartRef.current = e.clientY;
			e.currentTarget.setPointerCapture(e.pointerId);
			const el = rootRef.current;
			const h = swipeHandlersRef.current;
			if (el && h) {
				el.addEventListener("pointermove", h.onMove, { passive: true });
				el.addEventListener("pointerup", h.onUp, { passive: true });
				el.addEventListener("pointercancel", h.onCancel, { passive: true });
				el.addEventListener("lostpointercapture", h.onCancel, { passive: true });
			}
		},
		[exiting, onDismiss],
	);

	/* --------------------------------- Render --------------------------------- */

	return (
		<div
			ref={rootRef}
			data-kinetic-toast
			data-ready={ready}
			data-expanded={open}
			data-exiting={exiting}
			data-edge={expand}
			data-position={position}
			data-state={view.state}
			data-gooey={visualEffects.gooey}
			data-blur={visualEffects.blur}
			className={className}
			style={rootStyle}
			onMouseEnter={handleEnter}
			onMouseLeave={handleLeave}
			onPointerDown={handlePointerDown}
		>
			<div data-kinetic-canvas data-edge={expand} style={canvasStyle}>
				<svg data-kinetic-svg width={WIDTH} height={svgHeight} viewBox={viewBox}>
					<title>Kinetic Notification</title>
					{visualEffects.gooey && (
						<GooeyDefs filterId={filterId} blur={gooeyBlur} />
					)}
					<motion.rect
						data-kinetic-pill
						rx={resolvedRoundness}
						ry={resolvedRoundness}
						style={shapeStyle}
						initial={false}
						animate={pillAnimate}
						transition={pillTransition}
					/>
					<motion.rect
						data-kinetic-body
						width={WIDTH}
						rx={resolvedRoundness}
						ry={resolvedRoundness}
						style={shapeStyle}
						initial={false}
						animate={bodyAnimate}
						transition={bodyTransition}
					/>
				</svg>
			</div>

			<div ref={headerRef} data-kinetic-header data-edge={expand}>
				<div data-kinetic-header-stack>
					<div
						ref={innerRef}
						key={headerLayer.current.key}
						data-kinetic-header-inner
						data-layer="current"
					>
						<div
							data-kinetic-badge
							data-state={headerLayer.current.view.state}
							className={headerLayer.current.view.styles?.badge}
						>
							{headerLayer.current.view.icon ??
								STATE_ICON[headerLayer.current.view.state]}
						</div>
						<span
							data-kinetic-title
							data-state={headerLayer.current.view.state}
							className={headerLayer.current.view.styles?.title}
						>
							{headerLayer.current.view.title}
						</span>
					</div>
					{headerLayer.prev && (
						<div
							key={headerLayer.prev.key}
							data-kinetic-header-inner
							data-layer="prev"
							data-exiting="true"
						>
							<div
								data-kinetic-badge
								data-state={headerLayer.prev.view.state}
								className={headerLayer.prev.view.styles?.badge}
							>
								{headerLayer.prev.view.icon ??
									STATE_ICON[headerLayer.prev.view.state]}
							</div>
							<span
								data-kinetic-title
								data-state={headerLayer.prev.view.state}
								className={headerLayer.prev.view.styles?.title}
							>
								{headerLayer.prev.view.title}
							</span>
						</div>
					)}
				</div>
				{showNav && (
					<div data-kinetic-nav>
						<button
							type="button"
							disabled={navIndex === 0}
							aria-label="Previous notification"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (navIndex !== 0) onNavigate?.(-1);
							}}
						>
							<ChevronLeft />
						</button>
						<button
							type="button"
							disabled={
								navIndex !== undefined &&
								navTotal !== undefined &&
								navIndex >= navTotal - 1
							}
							aria-label="Next notification"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (
									navIndex !== undefined &&
									navTotal !== undefined &&
									navIndex >= navTotal - 1
								) {
									return;
								}
								onNavigate?.(1);
							}}
						>
							<ChevronRight />
						</button>
					</div>
				)}
			</div>

			{closeButton && onDismiss && (
				<button
					type="button"
					data-kinetic-close
					aria-label="Close notification"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDismiss();
					}}
				>
					<X />
				</button>
			)}

			{hasDesc && (
				<div data-kinetic-content data-edge={expand} data-visible={open}>
					<div
						ref={contentRef}
						data-kinetic-description
						className={view.styles?.description}
					>
						{view.description}
						{view.button && (
							<button
								type="button"
								data-kinetic-button
								data-state={view.state}
								className={view.styles?.button}
								onClick={handleButtonClick}
							>
								{view.button.title}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
});
