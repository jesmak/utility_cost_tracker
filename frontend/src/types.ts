import type { ScrollIndicatorConfig } from "./fade";
import type { LovelaceCardConfig } from "./hass";
import type { Period } from "./periods";
import type { RowStepConfig } from "./rows";

/** How tax is shown: in every price, on a row of its own under prices before tax, or left out altogether. */
export type TaxMode = "included" | "separate" | "none";
export const TAX_MODES: TaxMode[] = ["included", "separate", "none"];

/** Which of the bill's lines are shown under their elements: every item, only the picked ones, or none. */
export type Lines = "all" | "picked" | "none";
export const LINES: Lines[] = ["all", "picked", "none"];

/** The card's parts, each switched on or off. All are on unless set to false, except the share bar. */
export const PARTS_SHOWN = {
    show_price: true,
    show_periods: true,
    show_earlier: true,
    show_consumption: true,
    show_estimate: true,
    show_chart: true,
    show_usage: true,
    show_share: false,
    show_bill: true,
    show_legend: true,
} as const;
export type Part = keyof typeof PARTS_SHOWN;

export interface UtilityCostCardConfig extends LovelaceCardConfig, RowStepConfig, ScrollIndicatorConfig, Partial<Record<Part, boolean>> {
    /** The site's config entry. */
    site?: string;
    title?: string;
    /** The period shown first. The month when left out, or the site's longest when it doesn't follow months. */
    period?: Period;
    tax?: TaxMode;
    lines?: Lines;
    /** Elements left out of the card, and so of its total, chart and estimate, by their ids. */
    hidden_elements?: string[];
    /** Items given a colour of their own in the legend, the bars and the share bar, by their ids. */
    picked_items?: string[];
}

export function shows(config: UtilityCostCardConfig | undefined, part: Part): boolean {
    return config?.[part] ?? PARTS_SHOWN[part];
}

/** An amount before tax and the tax counted on it. */
export interface Amount {
    amount: number;
    tax: number;
}

export interface SiteElement {
    id: string;
    name: string;
    /** The tax rate in percent. */
    tax: number;
}

export interface RemovedItem {
    id: string;
    name: string;
    cost_statistic: string;
    tax_statistic: string;
}

export interface SiteItem {
    id: string;
    element: string;
    name: string;
    /** `removed` for an item that is no longer in the site, whose kind is not known. */
    kind: "constant" | "sensor" | "fixed_fee" | "removed";
    fee_period: Period | null;
    cost_statistic: string;
    tax_statistic: string;
}

/** What the integration's `utility_cost_tracker/site` command hands over. */
export interface Site {
    name: string;
    utility: string | null;
    currency: string;
    unit: string | null;
    price_unit: string;
    /** How many of the price unit make one of the currency: 100 when prices are in hundredths. */
    price_scale: number;
    elements: SiteElement[];
    items: SiteItem[];
    /** Items removed from the site, whose statistics still hold what they cost in earlier periods. */
    removed?: RemovedItem[];
    consumption_statistic: string;
    /** The meter the site reads, and what its readings are multiplied by to get the consumption. */
    meter?: { entity: string; factor: number };
    /** What each followed period has counted so far. */
    periods: Partial<Record<Period, { start: string; consumption: number; items: Record<string, Amount> }>>;
    /** The current price per unit with tax, per element and as `total`, in the price unit. */
    prices: Record<string, number | null>;
    /** The hour the statistics began in. */
    since: string | null;
    /** The statistics' running sums as they are now. */
    sums: Record<string, Amount>;
    consumed: number;
}
