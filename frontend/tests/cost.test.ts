import { describe, expect, it } from "vitest";

import { add, atRate, averagePrice, emptyLedger, listed, shown } from "../src/cost";
import type { Options } from "../src/cost";

import { ledger, site } from "./site";

const MONTH = ledger({ spot: 40, margin: 2, monthly: 3, transfer: 20, basic: 10 }, 500);
const options = (changes: Partial<Options> = {}): Options => ({ tax: "included", hidden: [], picked: [], ...changes });

describe("the bill shown", () => {
    it("has tax in every price by default", () => {
        const bill = shown(site(), MONTH, "month", options());
        expect(bill.elements.map((element) => [element.element.id, element.value])).toEqual([
            ["energy", expect.closeTo(45 * 1.255)],
            ["transfer", expect.closeTo(30 * 1.255)],
        ]);
        expect(bill.elements[0].items.map((item) => item.value)).toEqual([40, 2, 3].map((value) => expect.closeTo(value * 1.255)));
        expect(bill.beforeTax).toBeCloseTo(75);
        expect(bill.tax).toBeCloseTo(75 * 0.255);
        expect(bill.total).toBeCloseTo(75 * 1.255);
    });

    it("with tax on its own row has prices before tax and a total with it", () => {
        const bill = shown(site(), MONTH, "month", options({ tax: "separate" }));
        expect(bill.elements[0].value).toBeCloseTo(45);
        expect(bill.elements[0].items[0].value).toBeCloseTo(40);
        expect(bill.total).toBeCloseTo(75 * 1.255);
    });

    it("with tax left out is before tax throughout, the bar's segments too", () => {
        const bill = shown(site(), MONTH, "month", options({ tax: "none" }));
        expect(bill.total).toBeCloseTo(75);
        expect(bill.segments.map((segment) => segment.value)).toEqual([expect.closeTo(45), expect.closeTo(30)]);
    });

    it("leaves a fixed fee out of a period shorter than its own", () => {
        const bill = shown(site(), MONTH, "day", options({ tax: "none" }));
        expect(bill.elements[0].items.map((item) => item.item.id)).toEqual(["spot", "margin"]);
        expect(bill.total).toBeCloseTo(62);
    });

    it("leaves a hidden element out of the total, and the others keep their colours", () => {
        const all = shown(site(), MONTH, "month", options());
        const bill = shown(site(), MONTH, "month", options({ tax: "none", hidden: ["energy"] }));
        expect(bill.elements.map((element) => element.element.id)).toEqual(["transfer"]);
        expect(bill.total).toBeCloseTo(30);
        expect(bill.elements[0].color).toBe(all.elements[1].color);
    });

    it("gives a picked item a segment and a colour of its own, after the rest of its element", () => {
        const bill = shown(site(), MONTH, "month", options({ tax: "none", picked: ["spot", "basic"] }));
        expect(bill.segments.map((segment) => [segment.name, segment.value])).toEqual([
            ["Energy", expect.closeTo(5)],
            ["Spot price", expect.closeTo(40)],
            ["Transfer", expect.closeTo(20)],
            ["Basic fee", expect.closeTo(10)],
        ]);
        expect(bill.segments[1].color).not.toBe(bill.segments[0].color);
        expect(bill.elements[0].items.map((item) => item.color !== undefined)).toEqual([true, false, false]);
    });

    it("gives two picked items of one element different colours", () => {
        const bill = shown(site(), MONTH, "month", options({ picked: ["spot", "margin"] }));
        const [spot, margin] = bill.elements[0].items;
        expect(spot.color).toBeDefined();
        expect(margin.color).toBeDefined();
        expect(spot.color).not.toBe(margin.color);
    });

    it("draws a credit as nothing in a bar, and still counts it in the total", () => {
        const bill = shown(site(), ledger({ spot: -4, transfer: 20 }), "month", options({ tax: "none" }));
        expect(bill.segments[0].value).toBe(0);
        expect(bill.total).toBeCloseTo(16);
    });

    it("lists all of an element's lines, only the picked ones, or none", () => {
        const [energy] = shown(site(), MONTH, "month", options({ picked: ["margin"] })).elements;
        expect(listed(energy, "all").map((item) => item.item.id)).toEqual(["spot", "margin", "monthly"]);
        expect(listed(energy, "picked").map((item) => item.item.id)).toEqual(["margin"]);
        expect(listed(energy, "none")).toEqual([]);
    });
});

it("the rest at the days' rate takes a daily fee by the days to start, and no longer fee", () => {
    const daily = { ...site().items[2], id: "daily", fee_period: "day" as const };
    const home = { ...site(), items: [...site().items, daily] };
    // 14 days that held a month's first day: 28 in usage, the month's fee of 3, and 14 daily fees of 0.5.
    const days = ledger({ spot: 28, monthly: 3, daily: 7 }, 280);
    // Five and a half days are left, five of them still to start.
    const rest = atRate(home, days, 5.5 / 14, 5 / 14);
    expect(rest.items.spot.amount).toBeCloseTo(11);
    expect(rest.items.spot.tax).toBeCloseTo(11 * 0.255);
    expect(rest.items.monthly).toEqual({ amount: 0, tax: 0 });
    expect(rest.items.daily.amount).toBeCloseTo(2.5);
    expect(rest.consumption).toBeCloseTo(110);
});

it("lists what removed items cost under an element of their own, only in a period that has any", () => {
    const removed = [{ id: "old", name: "Old fee", cost_statistic: "", tax_statistic: "" }];
    const bill = shown({ ...site(), removed }, add(ledger({ old: 5 }), MONTH), "month", options({ tax: "none", removed: "Removed items" }));
    expect(bill.elements.at(-1)).toMatchObject({ element: { name: "Removed items" }, value: 5 });
    expect(bill.elements.at(-1)!.items.map((item) => item.item.name)).toEqual(["Old fee"]);
    expect(bill.total).toBe(80);
    // Left out of the average, as a removed item may have been a fee.
    expect(averagePrice(site(), bill, 500)).toBeCloseTo(12.4);
    expect(shown({ ...site(), removed }, MONTH, "month", options({ tax: "none" })).elements).toHaveLength(2);
});

it("the average price is in the price unit without the fixed fees, and there is none without consumption", () => {
    // 62 of the month's 75 follow the consumption of 500.
    const bill = shown(site(), MONTH, "month", options({ tax: "none" }));
    expect(averagePrice(site(), bill, 500)).toBeCloseTo(12.4);
    expect(averagePrice(site(), bill, 0)).toBeUndefined();
});

it("ledgers add up, a part of one too", () => {
    const sum = add(add(emptyLedger(), ledger({ spot: 10 }, 4)), ledger({ spot: 2, margin: 1 }, 2), 0.5);
    expect(sum.items.spot.amount).toBeCloseTo(11);
    expect(sum.items.margin.tax).toBeCloseTo(0.1275);
    expect(sum.consumption).toBeCloseTo(5);
});
