import { expect, test, vi } from "vitest";

// A copy of the card installed on its own, as a file of its own, may be loaded first.
test("a copy of the card loaded earlier stays the card and its editor, and the picker lists it once", async () => {
    class Earlier extends HTMLElement {}
    class EarlierEditor extends HTMLElement {}
    customElements.define("utility-cost-card", Earlier);
    customElements.define("utility-cost-card-editor", EarlierEditor);
    const registry = window as unknown as { customCards?: unknown[] };
    registry.customCards = [{ type: "utility-cost-card" }];
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await import("../src/utility-cost-card");

    expect(customElements.get("utility-cost-card")).toBe(Earlier);
    expect(customElements.get("utility-cost-card-editor")).toBe(EarlierEditor);
    expect(registry.customCards).toHaveLength(1);
    expect(info).not.toHaveBeenCalled();
});
