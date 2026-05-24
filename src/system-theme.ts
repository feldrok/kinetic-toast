export type KineticResolvedTheme = "light" | "dark";

const prefersDarkQuery = "(prefers-color-scheme: dark)";

export const getSystemThemeSnapshot = (): KineticResolvedTheme => {
	if (typeof window === "undefined") return "light";
	return window.matchMedia(prefersDarkQuery).matches ? "dark" : "light";
};

export const subscribeSystemTheme = (listener: () => void) => {
	if (typeof window === "undefined") return () => {};

	const media = window.matchMedia(prefersDarkQuery);
	media.addEventListener("change", listener);
	return () => media.removeEventListener("change", listener);
};
