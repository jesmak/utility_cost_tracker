import { describe, expect, it } from "vitest";

import { StatisticsCache, loadView } from "../src/data";
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
function recorder(rates: Record<string, number>, since = SINCE, zone = ZONE, now = NOW) {
    const asked: Record<string, unknown>[] = [];
    const hass: HomeAssistant = {
        config: { time_zone: zone },
        callWS: async <T>(message: Record<string, unknown>) => {
            asked.push(message);
            const from = Date.parse(message.start_time as string);
            const to = Date.parse(message.end_time as string);
            const five = message.period === "5minute";
            const bucket = five ? "hour" : (message.period as "hour" | "day" | "month");
            const next = (start: number) => (five ? start + HOUR / 12 : shift(bucket, start, 1, zone));
            const written = five ? now - (now % (HOUR / 12)) : periodStart("hour", now, zone);
            const answer: Record<string, { start: number; end: number; change: number; sum: number }[]> = {};
            for (const id of message.statistic_ids as string[]) {
                if (!(id in rates)) {
                    continue;
                }
                const rows = [];
                for (let start = periodStart(bucket, from, zone); start < to; start = next(start)) {
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

describe("when an hour ends", () => {
    it("the hour is counted once when its row is written between the two things asked", async () => {
        // The week's rows were answered before the last hour's row was written, and the last sums after it.
        const { hass } = recorder(RATES);
        const raced: HomeAssistant = {
            ...hass,
            callWS: async <T>(message: Record<string, unknown>) => {
                const answer = await hass.callWS!<Record<string, unknown[]>>(message);
                const early = Object.fromEntries(Object.entries(answer).map(([id, rows]) => [id, rows.slice(0, -1)]));
                return (message.period === "hour" ? early : answer) as T;
            },
        };
        const view = await load(raced, "week", 0, { chart: true, previous: false });
        const drawn = view.columns!.reduce((sum, column) => sum + column.ledger.items.spot.amount, 0);
        // 63 hours written and the 40 minutes under way.
        expect(drawn).toBeCloseTo(0.1 * (63 + 40 / 60));
        expect(view.ledger.items.spot.amount).toBeCloseTo(drawn);
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
        // To 15:40 on the 25th, a day an hour longer as summer time ended on it.
        expect(view.previousSame!.items.spot.amount).toBeCloseTo(0.1 * (24 * 24 + 16 + 40 / 60));
        expect(view.previousSame!.consumption).toBeCloseTo(2 * (24 * 24 + 16 + 40 / 60));
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

describe("the rest of the period under way", () => {
    // From 15:40 to midnight.
    const TODAY_LEFT = 8 + 20 / 60;
    const previous = { chart: false, previous: true };

    it("of a month and a week is counted at the rate of the last 14 whole days", async () => {
        const month = await load(recorder(RATES).hass, "month", 0);
        expect(month.rest!.items.spot.amount).toBeCloseTo(0.1 * (5 * 24 + TODAY_LEFT));
        expect(month.rest!.consumption).toBeCloseTo(2 * (5 * 24 + TODAY_LEFT));
        const week = await load(recorder(RATES).hass, "week", 0);
        expect(week.rest!.items.spot.amount).toBeCloseTo(0.1 * (4 * 24 + TODAY_LEFT));
    });

    it("of a month needs no whole month before it, only the 14 days", async () => {
        const enough = at("2026-11-10T22:00:00Z");
        const view = await load(recorder(RATES, enough).hass, "month", 0, previous, site(enough));
        expect(view.previous).toBeUndefined();
        expect(view.rest!.items.spot.amount).toBeCloseTo(0.1 * (5 * 24 + TODAY_LEFT));
        const short = at("2026-11-11T09:00:00Z");
        expect((await load(recorder(RATES, short).hass, "month", 0, previous, site(short))).rest).toBeUndefined();
    });

    it("of a day is yesterday from the same time on", async () => {
        const view = await load(recorder(RATES).hass, "day", 0);
        expect(view.rest!.items.spot.amount).toBeCloseTo(0.1 * TODAY_LEFT);
        expect(view.rest!.consumption).toBeCloseTo(2 * TODAY_LEFT);
    });

    it("of a year is last year from the same date on, though the history has no more of that year", async () => {
        const since = at("2025-11-20T22:00:00Z");
        const view = await load(recorder(RATES, since).hass, "year", 0, previous, site(since));
        expect(view.previous).toBeUndefined();
        // The rest of 25 November, and the 36 days from the 26th to the year's end.
        expect(view.rest!.items.spot.amount).toBeCloseTo(0.1 * (TODAY_LEFT + 36 * 24));
        expect((await load(recorder(RATES).hass, "year", 0)).rest).toBeUndefined();
    });

    it("counts the time left and the days to start across the day summer time starts on", async () => {
        const daily = { ...exampleSite().items[2], id: "daily", fee_period: "day" as const };
        const fee = { cost_statistic: "utility_cost_tracker:home_daily_cost", tax_statistic: "utility_cost_tracker:home_daily_tax" };
        const home = { ...site(), items: [...site().items, { ...daily, ...fee }] };
        const rates = { ...RATES, [fee.cost_statistic]: 0.01 };
        const rest = async (now: number, period: "week" | "month") =>
            (await loadView(recorder(rates, SINCE, ZONE, now).hass, new StatisticsCache(), home, period, 0, now, previous)).rest!;
        // Thursday 25 March 2027 at noon. The clocks go forward on Sunday the 28th, a day of 23 hours.
        const before = at("2027-03-25T10:00:00Z");
        const month = await rest(before, "month");
        expect(month.items.spot.amount).toBeCloseTo(0.1 * (6.5 * 24 - 1));
        // Six days are still to start, of the 14 that held 24 hours of the fee each.
        expect(month.items.daily.amount).toBeCloseTo(0.01 * 24 * 6);
        expect((await rest(before, "week")).items.spot.amount).toBeCloseTo(0.1 * (3.5 * 24 - 1));
        // On the 30th the short day is among the 14, and the rate is still what an hour holds.
        expect((await rest(at("2027-03-30T09:00:00Z"), "month")).items.spot.amount).toBeCloseTo(0.1 * 36);
    });

    it("is none for an hour or an earlier period", async () => {
        expect((await load(recorder(RATES).hass, "hour", 0)).rest).toBeUndefined();
        expect((await load(recorder(RATES).hass, "month", -1)).rest).toBeUndefined();
    });
});

it("the statistics are asked when an hour ends and once more soon after, and again after a failure", async () => {
    const { hass, asked } = recorder(RATES);
    const cache = new StatisticsCache();
    await loadView(hass, cache, site(), "day", -1, NOW, { chart: true, previous: false });
    await loadView(hass, cache, site(), "day", -1, NOW + 60_000, { chart: true, previous: false });
    expect(asked).toHaveLength(1);
    // Again when the hour ends, and once more after its rows have had time to be written.
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:00:30Z"), { chart: true, previous: false });
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:01:10Z"), { chart: true, previous: false });
    expect(asked).toHaveLength(2);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:02:00Z"), { chart: true, previous: false });
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:30:00Z"), { chart: true, previous: false });
    expect(asked).toHaveLength(3);

    const failing: HomeAssistant = { config: { time_zone: ZONE }, callWS: () => Promise.reject(new Error("no recorder")) };
    const failed = new StatisticsCache();
    await expect(loadView(failing, failed, site(), "day", -1, NOW, { chart: true, previous: false })).rejects.toThrow();
    await loadView(hass, failed, site(), "day", -1, NOW, { chart: true, previous: false });
    expect(asked).toHaveLength(4);
});

it("where the zone is half an hour off, the statistics are asked when its own hour ends, not UTC's", async () => {
    // 19:10 in Kolkata, whose hours end at half past UTC's.
    const { hass, asked } = recorder(RATES, SINCE, "Asia/Kolkata");
    const cache = new StatisticsCache();
    const wants = { chart: true, previous: false };
    await loadView(hass, cache, site(), "day", -1, NOW, wants);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:00:30Z"), wants);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:02:00Z"), wants);
    expect(asked).toHaveLength(1);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:30:30Z"), wants);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:31:10Z"), wants);
    expect(asked).toHaveLength(2);
    await loadView(hass, cache, site(), "day", -1, at("2026-11-25T14:32:00Z"), wants);
    expect(asked).toHaveLength(3);
});
