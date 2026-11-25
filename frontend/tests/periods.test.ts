import { describe, expect, it } from "vitest";

import { covers, periodStart, shift, weekNumber } from "../src/periods";

const ZONE = "Europe/Helsinki";
const at = (iso: string) => Date.parse(iso);

describe("period starts", () => {
    it("are counted in Home Assistant's zone, not the machine's", () => {
        // 23:30 UTC on the 30th is already 1 December in Helsinki.
        const moment = at("2026-11-30T23:30:00Z");
        expect(periodStart("hour", moment, ZONE)).toBe(at("2026-11-30T23:00:00Z"));
        expect(periodStart("day", moment, ZONE)).toBe(at("2026-11-30T22:00:00Z"));
        expect(periodStart("week", moment, ZONE)).toBe(at("2026-11-29T22:00:00Z"));
        expect(periodStart("month", moment, ZONE)).toBe(at("2026-11-30T22:00:00Z"));
        expect(periodStart("year", moment, ZONE)).toBe(at("2025-12-31T22:00:00Z"));
    });

    it("of a week is its Monday, across a month and a clock change", () => {
        // Summer time ends on Sunday 2026-10-25, so the Monday before is in summer time.
        expect(periodStart("week", at("2026-10-25T12:00:00Z"), ZONE)).toBe(at("2026-10-18T21:00:00Z"));
        expect(periodStart("week", at("2026-11-01T12:00:00Z"), ZONE)).toBe(at("2026-10-25T22:00:00Z"));
    });

    it("of a day and a week are right on the days the clocks change", () => {
        // Summer time begins on Sunday 2027-03-28 at 03:00, and ended on Sunday 2026-10-25 at 04:00.
        expect(periodStart("day", at("2027-03-28T12:00:00Z"), ZONE)).toBe(at("2027-03-27T22:00:00Z"));
        expect(periodStart("day", at("2027-03-29T12:00:00Z"), ZONE)).toBe(at("2027-03-28T21:00:00Z"));
        expect(periodStart("week", at("2027-03-29T12:00:00Z"), ZONE)).toBe(at("2027-03-28T21:00:00Z"));
        expect(periodStart("day", at("2026-10-25T23:30:00Z"), ZONE)).toBe(at("2026-10-25T22:00:00Z"));
        expect(periodStart("day", at("2026-10-25T00:30:00Z"), ZONE)).toBe(at("2026-10-24T21:00:00Z"));
        expect(shift("day", at("2027-03-27T22:00:00Z"), 1, ZONE)).toBe(at("2027-03-28T21:00:00Z"));
        expect(shift("day", at("2027-03-28T21:00:00Z"), -1, ZONE)).toBe(at("2027-03-27T22:00:00Z"));
    });

    it("of an hour tells the two hours apart when summer time ends", () => {
        expect(periodStart("hour", at("2026-10-25T00:40:00Z"), ZONE)).toBe(at("2026-10-25T00:00:00Z"));
        expect(periodStart("hour", at("2026-10-25T01:40:00Z"), ZONE)).toBe(at("2026-10-25T01:00:00Z"));
    });

    it("of an hour is on the zone's own hour where the zone is half an hour off", () => {
        expect(periodStart("hour", at("2026-11-25T10:40:00Z"), "Asia/Kolkata")).toBe(at("2026-11-25T10:30:00Z"));
    });
});

describe("shifting a period", () => {
    it("keeps to the calendar: a day is 23 or 25 hours at a clock change, a month 28 to 31 days", () => {
        const day = at("2026-10-24T21:00:00Z");
        expect(shift("day", day, 1, ZONE)).toBe(at("2026-10-25T21:00:00Z") + 3_600_000);
        expect(shift("day", at("2027-03-27T22:00:00Z"), 1, ZONE)).toBe(at("2027-03-28T21:00:00Z"));
        expect(shift("month", at("2027-01-31T22:00:00Z"), 1, ZONE)).toBe(at("2027-02-28T22:00:00Z"));
        expect(shift("month", at("2026-12-31T22:00:00Z"), -1, ZONE)).toBe(at("2026-11-30T22:00:00Z"));
        expect(shift("year", at("2025-12-31T22:00:00Z"), -1, ZONE)).toBe(at("2024-12-31T22:00:00Z"));
        expect(shift("week", at("2026-10-18T21:00:00Z"), 1, ZONE)).toBe(at("2026-10-25T22:00:00Z"));
        expect(shift("hour", at("2026-10-25T00:00:00Z"), 1, ZONE)).toBe(at("2026-10-25T01:00:00Z"));
    });
});

describe("week numbers", () => {
    it("follow ISO 8601, where the week's Thursday decides the year", () => {
        expect(weekNumber(at("2026-11-22T22:00:00Z"), ZONE)).toBe(48);
        // Monday 2026-12-28 starts week 53 of 2026, and Monday 2027-01-04 week 1 of 2027.
        expect(weekNumber(at("2026-12-27T22:00:00Z"), ZONE)).toBe(53);
        expect(weekNumber(at("2027-01-03T22:00:00Z"), ZONE)).toBe(1);
        // Monday 2024-12-30 starts week 1 of 2025.
        expect(weekNumber(at("2024-12-29T22:00:00Z"), ZONE)).toBe(1);
    });
});

it("a period covers the ones no longer than itself", () => {
    expect(covers("month", "day")).toBe(true);
    expect(covers("month", "month")).toBe(true);
    expect(covers("day", "month")).toBe(false);
});
