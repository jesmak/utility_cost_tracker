import { expect, test, vi } from "vitest";

// A file of its own, as the first copy has to be loaded into a page that has none.
test("the first copy registers the card and its editor, lists it in the picker and logs its version", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await import("../src/utility-cost-card");

    expect(customElements.get("utility-cost-card")).toBeDefined();
    expect(customElements.get("utility-cost-card-editor")).toBeDefined();
    const registry = window as unknown as { customCards?: { type: string }[] };
    expect(registry.customCards?.filter((card) => card.type === "utility-cost-card")).toEqual([
        {
            type: "utility-cost-card",
            name: "Utility cost",
            description: expect.any(String),
            documentationURL: "https://github.com/jesmak/utility_cost_tracker#utility-cost-card",
            preview: true,
        },
    ]);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toContain("UTILITY-COST-CARD");
});
