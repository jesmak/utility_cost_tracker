/**
 * Calendar periods in Home Assistant's own time zone, which is the one the integration counts its periods in and the
 * recorder its days and months, whatever zone the browser is in.
 */
export type Period = "hour" | "day" | "week" | "month" | "year";

export const PERIODS: Period[] = ["hour", "day", "week", "month", "year"];

/** What a period's chart is drawn in: a day by its hours, a year by its weeks. An hour has no chart. */
export const PARTS: Partial<Record<Period, "hour" | "day" | "week">> = { day: "hour", week: "day", month: "day", year: "week" };

const HOUR_MS = 3_600_000;

/** A wall clock's reading in a time zone. The month is 1 to 12. */
interface Wall {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

const formats = new Map<string, Intl.DateTimeFormat>();

function wall(at: number, zone: string | undefined): Wall {
    const key = zone ?? "";
    let format = formats.get(key);
    if (!format) {
        format = new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
        formats.set(key, format);
    }
    const parts: Record<string, number> = {};
    for (const part of format.formatToParts(at)) {
        parts[part.type] = Number(part.value);
    }
    return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

const asUtc = (reading: Wall) => Date.UTC(reading.year, reading.month - 1, reading.day, reading.hour, reading.minute);

/** The moment a zone's clock shows the reading. Of an hour repeated when summer time ends, the first. */
function moment(reading: Wall, zone: string | undefined): number {
    const target = asUtc(reading);
    // The zone's offset at the guess, then at the moment that offset gives, as the two differ across a clock change.
    let at = target - (asUtc(wall(target, zone)) - target);
    at = target - (asUtc(wall(at, zone)) - at);
    const earlier = at - HOUR_MS;
    return asUtc(wall(earlier, zone)) === target ? earlier : at;
}

/** The start of the period the moment is in. Weeks start on Monday, as the integration's and the recorder's do. */
export function periodStart(period: Period, at: number, zone: string | undefined): number {
    const reading = wall(at, zone);
    if (period === "hour") {
        // Not through the wall clock, which can't tell the two hours apart when summer time ends.
        return at - reading.minute * 60_000 - (at % 60_000);
    }
    const start: Wall = { ...reading, hour: 0, minute: 0 };
    if (period === "week") {
        const weekday = (new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay() + 6) % 7;
        start.day -= weekday;
    } else if (period === "month") {
        start.day = 1;
    } else if (period === "year") {
        start.day = 1;
        start.month = 1;
    }
    return moment(normal(start), zone);
}

/** The start of the period `count` periods after the one that starts at `start`, or before it when negative. */
export function shift(period: Period, start: number, count: number, zone: string | undefined): number {
    if (period === "hour") {
        return start + count * HOUR_MS;
    }
    const reading = wall(start, zone);
    if (period === "day") {
        reading.day += count;
    } else if (period === "week") {
        reading.day += 7 * count;
    } else if (period === "month") {
        reading.month += count;
    } else {
        reading.year += count;
    }
    return moment(normal(reading), zone);
}

/** A reading with its day and month brought back into range, such as the 0th of a month or month 13. */
function normal(reading: Wall): Wall {
    const date = new Date(Date.UTC(reading.year, reading.month - 1, reading.day, reading.hour, reading.minute));
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
    };
}

/** Whether a period is at least as long as another, as a fee is shown only in periods as long as its own. */
export function covers(period: Period, other: Period): boolean {
    return PERIODS.indexOf(period) >= PERIODS.indexOf(other);
}

/** The ISO week number of the week that starts at `start`. */
export function weekNumber(start: number, zone: string | undefined): number {
    const reading = wall(start, zone);
    // The week's Thursday decides its year.
    const thursday = new Date(Date.UTC(reading.year, reading.month - 1, reading.day + 3));
    const first = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    return Math.floor((thursday.getTime() - first) / (7 * 24 * HOUR_MS)) + 1;
}
