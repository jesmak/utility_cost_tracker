import { describe, expect, it } from "vitest";

import { StatisticsCache, loadView, steady } from "../src/data";
import type { HomeAssistant } from "../src/hass";
import { periodStart, shift } from "../src/periods";
import type { Site } from "../src/types";

import { site as exampleSite } from "./site";

const ZONE = "Europe/Helsinki";
const HOUR = 3_600_000;
const at = (iso: string) => Date.parse(iso);
// Wednesday 25 November 2026 at 15:40 in Helsinki.
const NOW = at("2026-11-25T13:40:00Z");
const SINCE = at("2026-09-30T21:00:00Z");

/**
 * A stand-in for the recorder: every statistic gains `rate` an hour since the history began, the hour that hasn't ended
 * not written yet, and the rows are answered by the hour, the day or the month as the recorder does, or by five minutes
 * for a meter's own statistics.
 */
function recorder(rates: Record<string, number>, since = SINCE) {
    const asked: Record<string, unknown>[] = [];
    const hass: HomeAssistant = {
        config: { time_zone: ZONE },
        callWS: async <T>(message: Record<string, unknown>) => {
            asked.push(message);
            const from = Date.parse(message.start_time as string);
            const to = Date.parse(message.end_time as string);
            const five = message.period === "5minute";
            const bucket = five ? "hour" : (message.period as "hour" | "day" | "month");
            const next = (start: number) => (five ? start + HOUR / 12 : shift(bucket, start, 1, ZONE));
            const written = five ? NOW - (NOW % (HOUR / 12)) : periodStart("hour", NOW, ZONE);
            const answer: Record<string, { start: number; end: number; change: number; sum: number }[]> = {};
            for (const id of message.statistic_ids as string[]) {
                if (!(id in rates)) {
                    continue;
                }
                const rows = [];
                for (let start = periodStart(bucket, from, ZONE); start < to; start = next(start)) {
                    const end = next(start);
                    const hours = (Math.min(end, written) - Math.max(start, since)) / HOUR;
                    if (hours > 0) {
                        rows.push({
                            start,
                            end,
                            change: hours * (rates[id] ?? 0),
                            sum: ((Math.min(end, written) - since) / HOUR) * (rates[id] ?? 0),
                        });
                    }
                }
                if (rows.length) {
                    answer[id] = rows;
                }
            }
            return answer as T;
        },
    };
    return { hass, asked };
}

/** The spot price gains 0.10 an hour before tax and the consumption 2 kWh. The basic fee came on the 1st of each month. */
const RATES = {
    "utility_cost_tracker:home_spot_cost": 0.1,
    "utility_cost_tracker:home_spot_tax": 0.0255,
    "utility_cost_tracker:home_consumption": 2,
};

function site(since = SINCE): Site {
    const hours = (NOW - since) / HOUR;
    const written = (periodStart("hour", NOW, ZONE) - since) / HOUR;
    return {
        ...exampleSite(),
        since: new Date(since).toISOString(),
        // The running sums are 40 minutes ahead of the last row written.
        sums: { spot: { amount: hours * 0.1, tax: hours * 0.0255 } },
        consumed: written * 2 + 1.5,
        periods: {
            day: { start: "", consumption: 31, items: { spot: { amount: 1.55, tax: 0.4 } } },
            month: { start: "", consumption: 1200, items: { spot: { amount: 59, tax: 15 }, basic: { amount: 10, tax: 2.55 } } },
        },
    };
}

const load = (
    hass: HomeAssistant,
    period: "hour" | "day" | "week" | "month" | "year",
    offset: number,
    wants: { chart: boolean; previous: boolean; line?: boolean } = { chart: true, previous: true },
    from = site(),
) => loadView(hass, new StatisticsCache(), from, period, offset, NOW, wants);

describe("the period shown", () => {
    it("now is what the integration has counted, and its chart ends in the hour that hasn't been written", async () => {
        const view = await load(recorder(RATES).hass, "day", 0);
        expect(view.current).toBe(true);
        expect(view.ledger.items.spot.amount).toBe(1.55);
        expect(view.ledger.consumption).toBe(31);
        expect(view.columns).toHaveLength(24);
        const amounts = view.columns!.map((column) => column.ledger.items.spot.amount);
        expect(amounts.slice(0, 15)).toEqual(Array(15).fill(expect.closeTo(0.1)));
        // 40 minutes of the hour from 15 to 16.
        expect(amounts[15]).toBeCloseTo(0.1 * (40 / 60));
        expect(view.columns![15].ledger.consumption).toBeCloseTo(1.5);
        expect(view.columns![15].current).toBe(true);
        expect(view.columns!.slice(16).every((column) => column.future && column.ledger.items.spot.amount === 0)).toBe(true);
        expect(view.elapsed).toBeCloseTo((15 + 40 / 60) / 24);
    });

    it("earlier is the sum of the statistics over the calendar period", async () => {
        const view = await load(recorder(RATES).hass, "month", -1);
        expect(view.current).toBe(false);
        expect([view.from, view.to]).toEqual([at("2026-09-30T21:00:00Z"), at("2026-10-31T22:00:00Z")]);
        // October has an hour more than its 31 days, as summer time ends in it.
        expect(view.ledger.items.spot.amount).toBeCloseTo(0.1 * (31 * 24 + 1));
        expect(view.ledger.items.spot.tax).toBeCloseTo(0.0255 * (31 * 24 + 1));
        expect(view.ledger.consumption).toBeCloseTo(2 * (31 * 24 + 1));
        expect(view.columns).toHaveLength(31);
        expect(view.columns![24].ledger.items.spot.amount).toBeCloseTo(2.5);
        expect(view.columns!.some((column) => column.current || column.future)).toBe(false);
    });

    it("a year is drawn by its weeks, the first and the last cut at the year's ends", async () => {
        const view = await load(recorder(RATES).hass, "year", 0, { chart: true, previous: false }, { ...site(), periods: {} });
        const columns = view.columns!;
        // 2026 begins on a Thursday and ends on one.
        expect(columns).toHaveLength(53);
        expect(columns[0].end - columns[0].start).toBe(4 * 24 * HOUR);
        expect(columns.at(-1)!.end).toBe(at("2026-12-31T22:00:00Z"));
        const october = columns.find((column) => column.start === at("2026-10-04T21:00:00Z"))!;
        expect(october.ledger.items.spot.amount).toBeCloseTo(0.1 * 7 * 24);
        expect(columns.reduce((sum, column) => sum + column.ledger.items.spot.amount, 0)).toBeCloseTo(((NOW - SINCE) / HOUR) * 0.1);
        // The year isn't a period this site follows, so its total is the statistics and the hour not yet written.
        expect(view.ledger.items.spot.amount).toBeCloseTo(((NOW - SINCE) / HOUR) * 0.1);
    });

    it("an hour has no chart", async () => {
        const view = await load(recorder(RATES).hass, "hour", -1);
        expect(view.columns).toBeUndefined();
        expect(view.ledger.items.spot.amount).toBeCloseTo(0.1);
    });
});

describe("what the recorder is asked", () => {
    it("is kept from one minute to the next for the period under way", async () => {
        const { hass, asked } = recorder(RATES);
        const cache = new StatisticsCache();
        const wants = { chart: true, previous: false };
        await loadView(hass, cache, site(), "week", 0, NOW, wants);
        const first = asked.length;
        await loadView(hass, cache, site(), "week", 0, NOW + 60_000, wants);
        expect(first).toBe(2);
        expect(asked).toHaveLength(first);
    });
});

describe("an item removed from the site", () => {
    const removed = [
        {
            id: "old",
            name: "Old fee",
            cost_statistic: "utility_cost_tracker:home_old_cost",
            tax_statistic: "utility_cost_tracker:home_old_tax",
        },
    ];

    it("is still in the earlier periods it has history in, and has no running part", async () => {
        const rates = { ...RATES, "utility_cost_tracker:home_old_cost": 0.5 };
        const view = await load(recorder(rates).hass, "week", 0, { chart: true, previous: false }, { ...site(), removed });
        // 63 whole hours of the week are written.
        expect(view.ledger.items.old.amount).toBeCloseTo(0.5 * 63);
        expect(view.columns![0].ledger.items.old.amount).toBeCloseTo(0.5 * 24);
    });
});

describe("the line of consumption", () => {
    const wants = { chart: true, previous: false, line: true };
    const METER = "sensor.meter";

    it("is by the hour over a week, and ends in the hour under way", async () => {
        const view = await load(recorder(RATES).hass, "week", 0, wants);
        // From Monday's first hour to Wednesday's 15th, and the 40 minutes after it.
        expect(view.line).toHaveLength(2 * 24 + 15 + 1);
        expect(view.line![0]).toEqual({ start: at("2026-11-22T22:00:00Z"), end: at("2026-11-22T23:00:00Z"), amount: 2 });
        expect(view.line!.at(-1)).toEqual({ start: at("2026-11-25T13:00:00Z"), end: NOW, amount: 1.5 });
    });

    it("is by five minutes over a day from the meter's own statistics, scaled by the site's factor", async () => {
        const metered = { ...site(), meter: { entity: METER, factor: 0.001 } };
        const view = await load(recorder({ ...RATES, [METER]: 2000 }).hass, "day", 0, wants, metered);
        expect(view.line).toHaveLength((15 * 60 + 40) / 5);
        expect(view.line![0].amount).toBeCloseTo(2 / 12);
        expect(view.line![0].end - view.line![0].start).toBe(HOUR / 12);
    });

    it("joins five minutes into quarters of an hour when the meter's steps would show", () => {
        const five = HOUR / 12;
        const points = (amounts: number[]) => amounts.map((amount, index) => ({ start: index * five, end: (index + 1) * five, amount }));
        // About 40 W on a meter that counts in thousandths of a kWh, with a float's noise in its readings, which must not
        // pass for finer steps.
        const saw = Array.from({ length: 8 }, () => [0.003967, 0.002991, 0.002991, 0.003052]).flat();
        const coarse = steady(points(saw), 0);
        expect(coarse).toHaveLength(Math.ceil(saw.length / 3));
        expect(coarse[0]).toMatchObject({ start: 0, end: 3 * five });
        expect(coarse[0].amount).toBeCloseTo(0.009949);
        // A meter whose amounts are of many kinds is left as it is, however close together they are.
        const fine = points(Array.from({ length: 30 }, (_, index) => 0.105469 + index * 0.001953));
        expect(steady(fine, 0)).toBe(fine);
        // And so is a day's start, which is too little to judge by.
        expect(steady(points(saw.slice(0, 12)), 0)).toHaveLength(12);
    });

    it("is by the hour over a day the meter has no rows for", async () => {
        const metered = { ...site(), meter: { entity: METER, factor: 1 } };
        const view = await load(recorder(RATES).hass, "day", 0, wants, metered);
        expect(view.line).toHaveLength(15 + 1);
    });

    it("is by the day over a month, the day under way with its hour not yet written", async () => {
        const view = await load(recorder(RATES).hass, "month", 0, wants);
        expect(view.line).toHaveLength(25);
        expect(view.line!.at(-1)).toEqual({ start: at("2026-11-24T22:00:00Z"), end: NOW, amount: 15 * 2 + 1.5 });
    });
});

describe("the previous period", () => {
    it("is read whole and up to the point this period is at, to the minute", async () => {
        const view = await load(recorder(RATES).hass, "month", 0);
        expect(view.previous!.items.spot.amount).toBeCloseTo(0.1 * (31 * 24 + 1));
        // 24 days, 15 hours and 40 minutes into the month.
        expect(view.previousSame!.items.spot.amount).toBeCloseTo(0.1 * (24 * 24 + 15 + 40 / 60));
        expect(view.previousSame!.consumption).toBeCloseTo(2 * (24 * 24 + 15 + 40 / 60));
    });

    it("of a day is read by its hours", async () => {
        const view = await load(recorder(RATES).hass, "day", 0);
        expect(view.previous!.items.spot.amount).toBeCloseTo(2.4);
        expect(view.previousSame!.items.spot.amount).toBeCloseTo(0.1 * (15 + 40 / 60));
    });

    it("is left out when the history began after it started", async () => {
        const since = at("2026-10-10T09:00:00Z");
        const view = await load(recorder(RATES, since).hass, "month", 0, { chart: false, previous: true }, site(since));
        expect(view.previous).toBeUndefined();
        expect(view.previousSame).toBeUndefined();
        // The month the history began in can still be looked at, the one before it not.
        expect(view.earlier).toBe(true);
        expect((await load(recorder(RATES, since).hass, "month", -1, { chart: false, previous: true }, site(since))).earlier).toBe(false);
    });

    it("of an earlier period is read whole, with no point to compare at", async () => {
        const view = await load(recorder(RATES).hass, "day", -1);
        expect(view.previous!.items.spot.amount).toBeCloseTo(2.4);
        expect(view.previousSame).toBeUndefined();
    });

    it("isn't asked for when the card doesn't show it", async () => {
        const { hass, asked } = recorder(RATES);
        const view = await load(hass, "month", 0, { chart: false, previous: false });
        expect(view.previous).toBeUndefined();
        expect(asked).toEqual([]);
    });
});

it("the statistics are asked once an hour, and again after a failure", async () => {
    const { hass, asked } = recorder(RATES);
    const cache = new StatisticsCache();
    await loadView(hass, cache, site(), "day", -1, NOW, { chart: true, previous: false });
    await loadView(hass, cache, site(), "day", -1, NOW + 60_000, { chart: true, previous: false });
    expect(asked).toHaveLength(1);
    // The hour's rows are written a moment after it ends.
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:00:30Z"), { chart: true, previous: false });
    expect(asked).toHaveLength(1);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:02:00Z"), { chart: true, previous: false });
    expect(asked).toHaveLength(2);

    const failing: HomeAssistant = { config: { time_zone: ZONE }, callWS: () => Promise.reject(new Error("no recorder")) };
    const failed = new StatisticsCache();
    await expect(loadView(failing, failed, site(), "day", -1, NOW, { chart: true, previous: false })).rejects.toThrow();
    await loadView(hass, failed, site(), "day", -1, NOW, { chart: true, previous: false });
    expect(asked).toHaveLength(3);
});
