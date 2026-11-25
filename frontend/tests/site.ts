import type { Site } from "../src/types";

/** A made-up home's electricity: energy by a spot price with a margin and a monthly fee, and transfer with a basic fee. */
export function site(): Site {
    const item = (id: string, element: string, name: string, kind: "constant" | "sensor" | "fixed_fee" = "constant") => ({
        id,
        element,
        name,
        kind,
        fee_period: kind === "fixed_fee" ? ("month" as const) : null,
        cost_statistic: `utility_cost_tracker:home_${id}_cost`,
        tax_statistic: `utility_cost_tracker:home_${id}_tax`,
    });
    return {
        name: "Example home",
        utility: "electricity",
        currency: "EUR",
        unit: "kWh",
        price_unit: "c/kWh",
        price_scale: 100,
        elements: [
            { id: "energy", name: "Energy", tax: 25.5 },
            { id: "transfer", name: "Transfer", tax: 25.5 },
        ],
        items: [
            item("spot", "energy", "Spot price", "sensor"),
            item("margin", "energy", "Margin"),
            item("monthly", "energy", "Monthly fee", "fixed_fee"),
            item("transfer", "transfer", "Transfer"),
            item("basic", "transfer", "Basic fee", "fixed_fee"),
        ],
        consumption_statistic: "utility_cost_tracker:home_consumption",
        periods: {},
        prices: { energy: 12, transfer: 5, total: 17 },
        since: "2026-01-01T00:00:00+02:00",
        sums: {},
        consumed: 0,
    };
}

/** Amounts before tax by item, each with 25.5 % tax. */
export function ledger(amounts: Record<string, number>, consumption = 0) {
    return {
        items: Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [id, { amount, tax: amount * 0.255 }])),
        consumption,
    };
}
