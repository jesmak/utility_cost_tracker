/**
 * What the card reads from Home Assistant: the site from the integration's command, and its history from the long-term
 * statistics the integration writes, an hourly running sum per item and for the consumption.
 */
import { STATISTICS_DELAY_MS } from "./const";
import { add, emptyLedger } from "./cost";
import type { Ledger } from "./cost";
import type { HomeAssistant } from "./hass";
import { PARTS, periodStart, shift } from "./periods";
import type { Period } from "./periods";
import type { Site } from "./types";

const HOUR_MS = 3_600_000;

interface Row {
    start: number;
    end: number;
    change?: number | null;
    sum?: number | null;
}
type Statistics = Record<string, Row[] | undefined>;
type Bucket = "5minute" | "hour" | "day" | "month";

/** The rows a period is read in. A week by its hours, though drawn by its days, for a finer line of consumption. */
const BUCKETS: Record<Period, Bucket> = { hour: "hour", day: "hour", week: "hour", month: "day", year: "day" };
const FIVE_MINUTES_MS = 300_000;
/** How many of the meter's steps a point of the line needs for the steps not to show in it. */
const STEPS_FOR_A_POINT = 8;
/** Amounts closer than this share of a typical amount are on the same level. */
const LEVEL_GAP = 0.05;
/** With this many different amounts among the points, the meter's steps don't show at five minutes. */
const FINE_KINDS = 20;
/** The points it takes to tell a coarse meter from a quiet start of a day. */
const JUDGED_FROM = 24;

/** A stretch of the period and what was consumed in it, for the line over the chart's bars. */
export interface Point {
    start: number;
    end: number;
    amount: number;
}

export interface Column {
    start: number;
    end: number;
    ledger: Ledger;
    /** Not started yet. */
    future: boolean;
    /** The one now is in. */
    current: boolean;
}

export interface View {
    period: Period;
    from: number;
    to: number;
    /** The period now is in. */
    current: boolean;
    ledger: Ledger;
    /** The period in parts, for the chart. None for an hour. */
    columns?: Column[];
    /** The consumption over the period, in stretches as short as the history has them. */
    line?: Point[];
    /** The whole previous period, when the site's history covers all of it. */
    previous?: Ledger;
    /** The previous period up to the point this one is at now. */
    previousSame?: Ledger;
    /** How much of the period has passed, 0 to 1. */
    elapsed: number;
    /** Whether the history reaches the period before. */
    earlier: boolean;
}

/** Keeps the statistics asked for until the hour's rows have been written, as nothing in them changes before. */
export class StatisticsCache {
    private stamp = -1;
    private readonly asked = new Map<string, Promise<Statistics>>();

    public read(
        hass: HomeAssistant,
        now: number,
        ids: string[],
        from: number,
        to: number,
        period: Bucket,
        types: string[],
    ): Promise<Statistics> {
        const stamp = Math.floor((now - STATISTICS_DELAY_MS) / HOUR_MS);
        if (stamp !== this.stamp) {
            this.stamp = stamp;
            this.asked.clear();
        }
        // The meter's own rows come every five minutes, so they are asked again as often.
        const fresh = period === "5minute" ? Math.floor((now - STATISTICS_DELAY_MS) / FIVE_MINUTES_MS) : "";
        const key = [from, to, period, fresh, types.join(), ids.join()].join("|");
        let answer = this.asked.get(key);
        if (!answer) {
            answer = hass.callWS!<Statistics>({
                type: "recorder/statistics_during_period",
                start_time: new Date(from).toISOString(),
                end_time: new Date(to).toISOString(),
                statistic_ids: ids,
                period,
                types,
            });
            this.asked.set(key, answer);
            // A failed answer isn't kept, so the next refresh asks again.
            answer.catch(() => {
                if (this.asked.get(key) === answer) {
                    this.asked.delete(key);
                }
            });
        }
        return answer;
    }

    public clear(): void {
        this.asked.clear();
    }
}

/** What the statistics' rows that start in [from, to) add up to. A row that `cut` falls in counts for its part before it. */
export function ledgerOf(site: Site, statistics: Statistics, from: number, to: number, cut = Infinity): Ledger {
    const sum = (id: string) => {
        let total = 0;
        for (const row of statistics[id] ?? []) {
            if (row.start < from || row.start >= to || row.start >= cut) {
                continue;
            }
            const share = row.end > cut ? (cut - row.start) / (row.end - row.start) : 1;
            total += (row.change ?? 0) * share;
        }
        return total;
    };
    const ledger = emptyLedger();
    for (const item of [...site.items, ...(site.removed ?? [])]) {
        ledger.items[item.id] = { amount: sum(item.cost_statistic), tax: sum(item.tax_statistic) };
    }
    ledger.consumption = sum(site.consumption_statistic);
    return ledger;
}

/** What the running sums hold that no statistics row has yet: the hour that hasn't ended. */
export function running(site: Site, statistics: Statistics): Ledger {
    const last = (id: string) => statistics[id]?.at(-1)?.sum ?? 0;
    const ledger = emptyLedger();
    for (const item of site.items) {
        const sums = site.sums[item.id] ?? { amount: 0, tax: 0 };
        ledger.items[item.id] = { amount: sums.amount - last(item.cost_statistic), tax: sums.tax - last(item.tax_statistic) };
    }
    ledger.consumption = site.consumed - last(site.consumption_statistic);
    return ledger;
}

/**
 * The consumption over a period for the chart's line. A day comes from the meter's own statistics, which the recorder
 * keeps by five minutes for its last days, and anything else from the rows the period was read in.
 */
async function line(
    hass: HomeAssistant,
    cache: StatisticsCache,
    site: Site,
    period: Period,
    from: number,
    to: number,
    now: number,
    rows: Statistics,
    unwritten: number,
): Promise<Point[]> {
    const points = (found: Row[] | undefined, factor = 1) =>
        (found ?? [])
            .filter((row) => row.start >= from && row.start < to)
            .map((row) => ({ start: row.start, end: Math.min(row.end, now), amount: (row.change ?? 0) * factor }));
    if (period === "day" && site.meter) {
        const read = await cache.read(hass, now, [site.meter.entity], from, to, "5minute", ["change"]);
        const fine = points(read[site.meter.entity], site.meter.factor);
        if (fine.length) {
            return steady(fine, from);
        }
    }
    const coarse = points(rows[site.consumption_statistic]);
    if (unwritten > 0) {
        // The hour under way is in no row. By days, it belongs to the day's row, which is there once the day has an hour.
        const start = periodStart(BUCKETS[period] === "day" ? "day" : "hour", now, hass.config?.time_zone);
        const last = coarse.at(-1);
        if (last && last.start === start) {
            last.amount += unwritten;
        } else if (now - start >= FIVE_MINUTES_MS) {
            coarse.push({ start, end: now, amount: unwritten });
        }
    }
    return coarse;
}

/**
 * Five-minute points joined into quarters of an hour or hours, when the meter's steps are too coarse for five minutes.
 * A meter that counts in thousandths shows a steady 40 W as three steps and four in turn, which draws as a saw.
 */
export function steady(points: Point[], from: number): Point[] {
    const amounts = [...new Set(points.map((point) => Math.round(point.amount * 1e6)))]
        .filter((amount) => amount > 0)
        .sort((a, b) => a - b);
    // Too little to judge by, or amounts of many kinds, which a meter fine enough gives over a couple of hours.
    if (points.length < JUDGED_FROM || amounts.length >= FINE_KINDS) {
        return points;
    }
    const middle = amounts[Math.floor(amounts.length / 2)];
    // The levels the amounts fall on. Amounts a hair apart are one level, as a meter's reading has a float's noise in it.
    const levels = amounts.filter((amount, index) => index === 0 || amount - amounts[index - 1] > middle * LEVEL_GAP);
    if (levels.length < 2) {
        return points;
    }
    const step = levels.slice(1).reduce((least, level, index) => Math.min(least, level - levels[index]), Infinity);
    const together = [1, 3, 12].find((count) => (middle * count) / step >= STEPS_FOR_A_POINT) ?? 12;
    if (together === 1) {
        return points;
    }
    const joined = new Map<number, Point>();
    for (const point of points) {
        const key = Math.floor((point.start - from) / (together * FIVE_MINUTES_MS));
        const whole = joined.get(key);
        if (whole) {
            whole.end = point.end;
            whole.amount += point.amount;
        } else {
            joined.set(key, { ...point });
        }
    }
    return [...joined.values()];
}

export function statisticIds(site: Site): string[] {
    const items = [...site.items, ...(site.removed ?? [])];
    return [...items.flatMap((item) => [item.cost_statistic, item.tax_statistic]), site.consumption_statistic];
}

/** The period `offset` periods from the one now is in, with what the options need of its history. */
export async function loadView(
    hass: HomeAssistant,
    cache: StatisticsCache,
    site: Site,
    period: Period,
    offset: number,
    now: number,
    wants: { chart: boolean; previous: boolean; line?: boolean },
): Promise<View> {
    const zone = hass.config?.time_zone;
    const from = shift(period, periodStart(period, now, zone), offset, zone);
    const to = shift(period, from, 1, zone);
    const current = offset === 0;
    const since = site.since ? Date.parse(site.since) : now;
    const ids = statisticIds(site);
    const read = (start: number, end: number, bucket: Bucket, types = ["change"]) => cache.read(hass, now, ids, start, end, bucket, types);
    const view: View = {
        period,
        from,
        to,
        current,
        ledger: emptyLedger(),
        elapsed: Math.min(Math.max((now - from) / (to - from), 0), 1),
        earlier: from > since,
    };

    const part = PARTS[period];
    const counted = site.periods[period];
    const needsRows = !current || !counted || (wants.chart && part !== undefined);
    const rows = needsRows ? await read(from, to, BUCKETS[period]) : {};
    // The last sum written, from the months since the history began, is a row or two however long the history.
    // Asked up to the hour's end, not to this minute, so the answer is kept until the hour's rows are written.
    const unwritten =
        current && needsRows ? running(site, await read(since, periodStart("hour", now, zone) + HOUR_MS, "month", ["sum"])) : emptyLedger();
    if (current && counted) {
        view.ledger = { items: counted.items, consumption: counted.consumption };
    } else {
        view.ledger = add(ledgerOf(site, rows, from, to), unwritten);
    }
    if (wants.chart && part) {
        view.columns = [];
        // A year's first and last weeks are cut at the year's ends, so the bars add up to the year.
        const next = (start: number) => Math.min(shift(part, periodStart(part, start, zone), 1, zone), to);
        for (let start = from; start < to; start = next(start)) {
            const end = next(start);
            const column: Column = {
                start,
                end,
                ledger: ledgerOf(site, rows, start, end),
                future: start > now,
                current: start <= now && now < end,
            };
            if (column.current) {
                add(column.ledger, unwritten);
            }
            view.columns.push(column);
        }
        if (wants.line) {
            view.line = await line(hass, cache, site, period, from, to, now, rows, current ? unwritten.consumption : 0);
        }
    }

    const previousFrom = shift(period, from, -1, zone);
    if (wants.previous && previousFrom >= since) {
        const bucket: Bucket = period === "hour" || period === "day" ? "hour" : "day";
        const previous = await read(previousFrom, from, bucket);
        view.previous = ledgerOf(site, previous, previousFrom, from);
        if (current && period !== "hour") {
            const cut = Math.min(previousFrom + (now - from), from);
            if (bucket === "hour") {
                view.previousSame = ledgerOf(site, previous, previousFrom, from, cut);
            } else {
                // Whole days up to the day the point falls in, and that day by its hours.
                const day = periodStart("day", cut, zone);
                const hours = await read(day, shift("day", day, 1, zone), "hour");
                view.previousSame = add(ledgerOf(site, previous, previousFrom, day), ledgerOf(site, hours, day, from, cut));
            }
        }
    }
    return view;
}
