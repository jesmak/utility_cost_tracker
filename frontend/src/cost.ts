/**
 * The bill as the card shows it: which elements and items are in it, with or without their tax, and the coloured
 * segments of a bar.
 */
import { ELEMENT_COLORS } from "./const";
import { covers } from "./periods";
import type { Period } from "./periods";
import type { Amount, Lines, Site, SiteElement, SiteItem, TaxMode } from "./types";

/** What a site has counted over some time: each item before tax with its tax, and the consumption. */
export interface Ledger {
    items: Record<string, Amount>;
    consumption: number;
}

export function emptyLedger(): Ledger {
    return { items: {}, consumption: 0 };
}

/** Adds `more` to `ledger`, each amount times `factor`. */
export function add(ledger: Ledger, more: Ledger, factor = 1): Ledger {
    for (const [id, amount] of Object.entries(more.items)) {
        const sum = (ledger.items[id] ??= { amount: 0, tax: 0 });
        sum.amount += amount.amount * factor;
        sum.tax += amount.tax * factor;
    }
    ledger.consumption += more.consumption * factor;
    return ledger;
}

export interface Options {
    tax: TaxMode;
    hidden: string[];
    picked: string[];
    /** What the items removed from the site are listed under. */
    removed?: string;
}

/** The id of the element that removed items are listed under, as theirs may be gone too. */
export const REMOVED = "";
const REMOVED_COLOR = "var(--secondary-text-color)";

export interface ShownItem {
    item: SiteItem;
    /** With tax when tax is in the prices. */
    value: number;
    /** The item's own colour when it is picked. */
    color?: string;
}

export interface ShownElement {
    element: SiteElement;
    color: string;
    /** With tax when tax is in the prices. */
    value: number;
    items: ShownItem[];
}

export interface Segment {
    name: string;
    value: number;
    color: string;
}

export interface Shown {
    elements: ShownElement[];
    beforeTax: number;
    tax: number;
    /** With tax, unless tax is left out. */
    total: number;
    /** An element's main colour for all of it but its picked items, which follow in their own. With tax, unless left out. */
    segments: Segment[];
}

/** Whether an item belongs in a period's bill: a fixed fee only in periods as long as its own. */
export function inPeriod(item: SiteItem, period: Period): boolean {
    return item.kind !== "fixed_fee" || item.fee_period === null || covers(period, item.fee_period);
}

/** An element's main colour, by its place among all of the site's elements, so hiding one doesn't recolour the rest. */
export function elementColor(site: Site, element: SiteElement): string {
    return ELEMENT_COLORS[site.elements.indexOf(element) % ELEMENT_COLORS.length];
}

/** A picked item's colour: its element's, mixed towards the text colour a step further for each picked item before it. */
export function itemColor(site: Site, item: SiteItem, picked: string[]): string | undefined {
    const mine = site.items.filter((other) => other.element === item.element && picked.includes(other.id));
    const place = mine.indexOf(item);
    const element = site.elements.find((candidate) => candidate.id === item.element);
    if (place < 0 || !element) {
        return undefined;
    }
    const share = Math.round(68 - place * (48 / mine.length));
    return `color-mix(in srgb, ${elementColor(site, element)} ${share}%, var(--primary-text-color))`;
}

export function shown(site: Site, ledger: Ledger, period: Period, options: Options): Shown {
    const result: Shown = { elements: [], beforeTax: 0, tax: 0, total: 0, segments: [] };
    for (const element of site.elements) {
        if (options.hidden.includes(element.id)) {
            continue;
        }
        const color = elementColor(site, element);
        const items: ShownItem[] = [];
        const picked: Segment[] = [];
        let beforeTax = 0;
        let tax = 0;
        let rest = 0;
        for (const item of site.items) {
            if (item.element !== element.id || !inPeriod(item, period)) {
                continue;
            }
            const amount = ledger.items[item.id] ?? { amount: 0, tax: 0 };
            beforeTax += amount.amount;
            tax += amount.tax;
            const own = itemColor(site, item, options.picked);
            items.push({ item, value: amount.amount + (options.tax === "included" ? amount.tax : 0), color: own });
            const part = amount.amount + (options.tax === "none" ? 0 : amount.tax);
            if (own) {
                picked.push({ name: item.name, value: Math.max(part, 0), color: own });
            } else {
                rest += part;
            }
        }
        result.elements.push({ element, color, value: beforeTax + (options.tax === "included" ? tax : 0), items });
        result.segments.push({ name: element.name, value: Math.max(rest, 0), color }, ...picked);
        result.beforeTax += beforeTax;
        result.tax += tax;
    }
    removedItems(site, ledger, options, result);
    result.total = result.beforeTax + (options.tax === "none" ? 0 : result.tax);
    return result;
}

/** What the period has of items removed from the site since, as an element of their own after the others. */
function removedItems(site: Site, ledger: Ledger, options: Options, result: Shown): void {
    const items: ShownItem[] = [];
    let beforeTax = 0;
    let tax = 0;
    for (const removed of site.removed ?? []) {
        const amount = ledger.items[removed.id];
        if (!amount || (Math.abs(amount.amount) < 1e-9 && Math.abs(amount.tax) < 1e-9)) {
            continue;
        }
        beforeTax += amount.amount;
        tax += amount.tax;
        items.push({
            item: { ...removed, element: REMOVED, kind: "removed", fee_period: null },
            value: amount.amount + (options.tax === "included" ? amount.tax : 0),
        });
    }
    if (!items.length) {
        return;
    }
    const element = { id: REMOVED, name: options.removed ?? "", tax: 0 };
    result.elements.push({ element, color: REMOVED_COLOR, value: beforeTax + (options.tax === "included" ? tax : 0), items });
    result.segments.push({ name: element.name, value: Math.max(beforeTax + (options.tax === "none" ? 0 : tax), 0), color: REMOVED_COLOR });
    result.beforeTax += beforeTax;
    result.tax += tax;
}

/** The items a bill lists under an element. */
export function listed(element: ShownElement, lines: Lines): ShownItem[] {
    return lines === "all" ? element.items : lines === "picked" ? element.items.filter((item) => item.color) : [];
}

/**
 * The rest of a period at the rate of the days before it: `share` of what those days held. A daily fee comes whole at
 * each midnight, so it takes `feeShare`, the days still to start over the days counted. A longer fee has already come
 * for the period, however many of them the days before happened to hold.
 */
export function atRate(site: Site, days: Ledger, share: number, feeShare: number): Ledger {
    const rest = add(emptyLedger(), days, share);
    for (const item of site.items) {
        const amount = days.items[item.id];
        if (item.kind === "fixed_fee" && amount) {
            const factor = item.fee_period === "day" ? feeShare : 0;
            rest.items[item.id] = { amount: amount.amount * factor, tax: amount.tax * factor };
        }
    }
    return rest;
}

/**
 * The average price paid per unit, in the price unit. Fixed fees are left out, as they don't follow the consumption and
 * come whole at a period's start, when little has been used. So are removed items, which may have been fees.
 */
export function averagePrice(site: Site, bill: Shown, consumption: number): number | undefined {
    const metered = bill.elements
        .flatMap((element) => element.items)
        .filter((item) => item.item.kind !== "fixed_fee" && item.item.kind !== "removed")
        .reduce((sum, item) => sum + item.value, 0);
    return consumption > 0 ? (metered / consumption) * site.price_scale : undefined;
}
