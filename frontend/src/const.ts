import type { ScrollIndicator } from "./fade";

/** Replaced at build time with the integration's version from manifest.json. */
declare const __CARD_VERSION__: string;

export const CARD_VERSION = __CARD_VERSION__;

export const DOMAIN = "utility_cost_tracker";

/** A held card's bill shows both its fading edges and a thin scrollbar. */
export const DEFAULT_SCROLL_INDICATOR: ScrollIndicator = "both";

/** How often the card asks for the site again. The integration counts every reading, but tells no one. */
export const REFRESH_MS = 60_000;

/**
 * How long after the hour the statistics are asked again. The integration writes an ended hour at the first minute of
 * the next, and the recorder stores it a moment later.
 */
export const STATISTICS_DELAY_MS = 90_000;

/** How many whole days before today give the rate a week's and a month's estimate counts the rest of the period at. */
export const RATE_DAYS = 14;

/** An icon per utility, as the integration's sensors have. */
export const ICONS: Record<string, string> = {
    electricity: "mdi:lightning-bolt",
    water: "mdi:water",
    gas: "mdi:fire",
    district_heating: "mdi:radiator",
    other: "mdi:cash",
};

/** The names of the elements' main colours in turn, as Home Assistant names its colours (`--<name>-color`). */
export const ELEMENT_COLOR_NAMES = ["primary", "purple", "success", "warning"];
const FALLBACKS = ["#03a9f4", "#926bc7", "#43a047", "#ffa600"];

/** The elements' main colours, in turn. Each can be changed in a theme. */
export const ELEMENT_COLORS = ELEMENT_COLOR_NAMES.map(
    (name, index) => `var(--utility-cost-color-${index + 1}, var(--${name}-color, ${FALLBACKS[index]}))`,
);
