import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant } from "../src/hass";
import "../src/utility-cost-card";
import type { UtilityCostCard } from "../src/utility-cost-card";

import { site as exampleSite } from "./site";

/** A site that follows days and months, with a month of 59 and 20 in usage and fees of 3 and 10, all before tax. */
function site() {
    const amount = (value: number) => ({ amount: value, tax: value * 0.255 });
    return {
        ...exampleSite(),
        since: new Date(Date.now() - 400 * 86_400_000).toISOString(),
        periods: {
            day: { start: "", consumption: 20, items: { spot: amount(2), transfer: amount(1) } },
            month: {
                start: "",
                consumption: 500,
                items: { spot: amount(59), monthly: amount(3), transfer: amount(20), basic: amount(10) },
            },
        },
    };
}

interface Asked {
    type: string;
    [key: string]: unknown;
}

function hass(asked: Asked[] = [], answer: () => unknown = site): HomeAssistant {
    return {
        locale: { language: "en" },
        config: { time_zone: "Europe/Helsinki" },
        callWS: async <T>(message: Record<string, unknown>) => {
            asked.push(message as Asked);
            return (message.type === "utility_cost_tracker/site" ? answer() : {}) as T;
        },
    };
}

async function card(config: Record<string, unknown> = {}, from = hass()): Promise<UtilityCostCard> {
    const element = document.createElement("utility-cost-card") as UtilityCostCard;
    element.setConfig({ type: "custom:utility-cost-card", site: "home", ...config } as never);
    element.hass = from;
    document.body.append(element);
    await settled(element);
    return element;
}

/** The card reads in the background, so it is given a few turns to finish and draw. */
async function settled(element: UtilityCostCard): Promise<void> {
    for (let turn = 0; turn < 5; turn++) {
        await new Promise((resolve) => setTimeout(resolve));
        await element.updateComplete;
    }
}

const text = (element: Element, selector: string) => element.shadowRoot!.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim();
/** Each matching row as its cells' texts, joined by a space. */
const rows = (element: Element, selector: string) =>
    [...element.shadowRoot!.querySelectorAll(selector)].map((row) =>
        [...row.children].map((cell) => cell.textContent?.replace(/\s+/g, " ").trim()).join(" "),
    );
const all = (element: Element, selector: string) => [...element.shadowRoot!.querySelectorAll<HTMLElement>(selector)];

// Wednesday 25 November 2026 at 15:40 in Helsinki. Only the clock is held, so the card's own timers run.
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-11-25T13:40:00Z") });
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
});

describe("the card", () => {
    it("shows the month's bill with tax in the prices by default", async () => {
        const element = await card();
        expect(text(element, ".name")).toBe("Example home");
        expect(text(element, ".total")).toBe("€115.46");
        expect(text(element, ".consumption")).toBe("500.0 kWh · average 19.83 c/kWh");
        expect(text(element, ".price")).toBe("Price now 17.00 c/kWh");
        expect(all(element, ".periods button").map((button) => button.textContent?.trim())).toEqual(["Day", "Month"]);
        expect(rows(element, ".element")).toEqual(["Energy €77.81", "Transfer €37.65"]);
        expect(all(element, ".item")).toHaveLength(5);
        expect(rows(element, ".sum")).toEqual(["Total €115.46", "of which tax €23.46"]);
    });

    it("shows tax on a row of its own, or leaves it out", async () => {
        const separate = await card({ tax: "separate" });
        expect(rows(separate, ".sum")).toEqual(["Before tax €92.00", "Tax 25.5 % €23.46", "Total €115.46"]);
        const none = await card({ tax: "none" });
        expect(text(none, ".total")).toBe("€92.00");
        expect(rows(none, ".sum")).toEqual(["Total before tax €92.00"]);
    });

    it("leaves a hidden element out of everything, and lists only the picked lines when asked", async () => {
        const element = await card({ hidden_elements: ["transfer"], picked_items: ["spot"], lines: "picked", tax: "none" });
        expect(text(element, ".total")).toBe("€62.00");
        expect(all(element, ".element")).toHaveLength(1);
        expect(rows(element, ".item")).toEqual(["Spot price €59.00"]);
        expect(all(element, ".item .dot")).toHaveLength(1);
    });

    it("changes the period from the switch, and a fee is left out of a day", async () => {
        const asked: Asked[] = [];
        const element = await card({ tax: "none", show_chart: false, show_estimate: false }, hass(asked));
        all(element, ".periods button")[0].click();
        await settled(element);
        expect(text(element, ".total")).toBe("€3.00");
        expect(text(element, ".label")).toContain("Today");
        expect(rows(element, ".item")).toEqual(["Spot price €2.00", "Margin €0.00", "Transfer €1.00"]);
        expect(asked.filter((message) => message.type === "utility_cost_tracker/site")).toHaveLength(2);
    });

    it("goes to earlier periods and back, and no further than now", async () => {
        const element = await card({ show_chart: false, show_estimate: false });
        const [earlier, later] = all(element, ".earlier button") as HTMLButtonElement[];
        expect(later.disabled).toBe(true);
        earlier.click();
        await settled(element);
        // The stand-in recorder has no rows, so an earlier month is empty.
        expect(text(element, ".total")).toBe("€0.00");
        expect((all(element, ".earlier button")[1] as HTMLButtonElement).disabled).toBe(false);
    });

    it("is one row without the period switch and the earlier periods, with a share bar and a legend", async () => {
        const element = await card({
            show_periods: false,
            show_earlier: false,
            show_bill: false,
            show_chart: false,
            show_estimate: false,
            show_share: true,
            picked_items: ["spot"],
        });
        expect(all(element, ".header, .periods, .earlier, .bill")).toEqual([]);
        expect(text(element, ".value")).toContain("€115.46");
        expect(text(element, ".value small")).toBe("19.83 c/kWh · now 17.00");
        expect(all(element, ".share i")).toHaveLength(3);
        expect(all(element, ".legend span").map((entry) => entry.textContent?.replace(/\s+/g, " ").trim())).toEqual([
            "Energy €77.81",
            "Spot price €74.05",
            "Transfer €37.65",
        ]);
        all(element, ".names button")[0].click();
        await settled(element);
        expect(text(element, ".names button")).toContain("Today");
    });

    it("draws a bar for each part of the period, and tells what the bars leave out", async () => {
        const element = await card({ show_estimate: false });
        expect(all(element, ".column").length).toBeGreaterThanOrEqual(28);
        expect(all(element, ".column.current")).toHaveLength(1);
        expect(text(element, ".note")).toBe("Fixed fees of €16.32 are not in the bars");
    });

    it("lists removed items under a heading of their own, on a site with one element too", async () => {
        const removed = [{ id: "old", name: "Old fee", cost_statistic: "old_cost", tax_statistic: "old_tax" }];
        const single = () => {
            const whole = site();
            return {
                ...whole,
                elements: whole.elements.slice(0, 1),
                items: whole.items.filter((item) => item.element === "energy"),
                removed,
            };
        };
        const answers = {
            ...hass(),
            callWS: async <T>(message: Record<string, unknown>) =>
                (message.type === "utility_cost_tracker/site"
                    ? single()
                    : message.period === "month"
                      ? {}
                      : {
                            old_cost: [
                                {
                                    start: Date.parse(message.start_time as string),
                                    end: Date.parse(message.start_time as string) + 1,
                                    change: 5,
                                },
                            ],
                        }) as T,
        };
        const element = await card({ show_estimate: false, show_chart: false, tax: "none", period: "month", lines: "picked" }, answers);
        // The month before, which is read from the statistics.
        all(element, ".earlier button")[0].click();
        await settled(element);
        expect(rows(element, ".element")).toEqual(["Energy €0.00", "Removed items €5.00"]);
        expect(text(element, ".total")).toBe("€5.00");
    });

    it("tells what a bar holds under the pointer, and opens the bar's own period when it is pressed", async () => {
        const element = await card({ show_estimate: false });
        const plot = all(element, ".bars")[0];
        plot.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
        plot.dispatchEvent(new MouseEvent("pointermove", { clientX: 1 }));
        await settled(element);
        expect(text(element, ".tip b")).toBe("Sun, 11/1");
        expect(rows(element, ".tip > span")[0]).toBe("Total €0.00");
        plot.dispatchEvent(new MouseEvent("pointerleave"));
        await settled(element);
        expect(all(element, ".tip")).toHaveLength(0);

        all(element, "button.column")[0].click();
        await settled(element);
        expect(all(element, ".periods .on")[0].textContent).toContain("Day");
        expect(all(element, ".column")).toHaveLength(24);
        // A day's hours open nothing, as the site doesn't follow hours.
        expect(all(element, "button.column")).toHaveLength(0);
    });

    it("draws the consumption as a line over the bars, up to the part under way, unless switched off", async () => {
        // 4.8 kWh in the month's first day, which is 0.2 an hour, and nothing written since.
        const used = {
            ...hass(),
            callWS: async <T>(message: Record<string, unknown>) =>
                (message.type === "utility_cost_tracker/site"
                    ? site()
                    : {
                          "utility_cost_tracker:home_consumption": [
                              {
                                  start: Date.parse(message.start_time as string),
                                  end: Date.parse(message.start_time as string) + 24 * 3_600_000,
                                  change: 4.8,
                                  sum: 4.8,
                              },
                          ],
                      }) as T,
        };
        const element = await card({ show_estimate: false }, used);
        const points = element.shadowRoot!.querySelector(".usage-line polyline")!.getAttribute("points")!.split(" ");
        expect(points).toEqual(["0.500,0.00"]);
        // The scale has two steps when nothing has cost anything, and the line's follows it.
        expect(rows(element, ".scale.rate")).toEqual(["kWh/h 0.2 0.1"]);
        expect(text(element, ".scale.cost")).toBe("€");
        expect(all(await card({ show_estimate: false, show_usage: false }), ".usage-line")).toHaveLength(0);
    });

    it("asks for a site when it has none, and says when the site is gone", async () => {
        const asked: Asked[] = [];
        const empty = await card({ site: undefined }, hass(asked));
        expect(text(empty, ".message")).toBe("Choose a site in the card's settings");
        expect(asked).toEqual([]);
        const gone = await card(
            {},
            hass([], () => {
                throw { code: "not_found" };
            }),
        );
        expect(text(gone, ".message")).toBe("The site wasn't found. It may have been removed, or it isn't loaded.");
    });

    it("refuses settings it can't use", () => {
        const element = document.createElement("utility-cost-card") as UtilityCostCard;
        for (const config of [{ period: "decade" }, { tax: "some" }, { lines: "few" }, { row_step: "third" }, { height: -1 }]) {
            expect(() => element.setConfig({ type: "custom:utility-cost-card", ...config } as never)).toThrow();
        }
    });

    it("takes a whole section, and its least height follows its parts", async () => {
        const whole = (await card()).getGridOptions();
        const small = (
            await card({ show_periods: false, show_earlier: false, show_bill: false, show_chart: false, show_estimate: false })
        ).getGridOptions();
        expect(whole).toMatchObject({ columns: 12, min_columns: 12, rows: "auto" });
        expect(whole.min_rows as number).toBeGreaterThan(small.min_rows as number);
    });
});
