/**
 * The card's visual editor: the site, the title, the period shown first, each part, how tax and the bill's lines are
 * shown, the elements hidden and the items picked, the height's rounding and how a scrolling bill shows there is more.
 * The height mode is set in YAML only.
 */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import { DEFAULT_SCROLL_INDICATOR, DOMAIN } from "./const";
import { scrollIndicatorData, scrollIndicatorSchema, tidyScrollIndicator } from "./fade";
import type { HomeAssistant } from "./hass";
import { browserLanguage, translate } from "./localize/localize";
import { PERIODS } from "./periods";
import { rowStepData, rowStepSchema, tidyRowStep } from "./rows";
import { LINES, PARTS_SHOWN, TAX_MODES } from "./types";
import type { Site, UtilityCostCardConfig } from "./types";

interface SchemaEntry {
    name: string;
}

const DEFAULTS: Record<string, unknown> = { ...PARTS_SHOWN, tax: "included", lines: "all" };

function schema(site: Site | undefined, config: UtilityCostCardConfig, text: (key: string) => string) {
    const select = (name: string, values: readonly string[], prefix: string) => ({
        name,
        selector: { select: { mode: "dropdown", options: values.map((value) => ({ value, label: text(`${prefix}${value}`) })) } },
    });
    const elementName = (id: string) => site?.elements.find((element) => element.id === id)?.name ?? "";
    return [
        { name: "site", required: true, selector: { config_entry: { integration: DOMAIN } } },
        { name: "title", selector: { text: {} } },
        select("period", site ? PERIODS.filter((period) => site.periods[period]) : PERIODS, "periods."),
        {
            name: "parts",
            type: "expandable",
            flatten: true,
            title: text("editor.parts"),
            schema: Object.keys(PARTS_SHOWN).map((name) => ({ name, selector: { boolean: {} } })),
        },
        select("tax", TAX_MODES, "editor.tax_"),
        select("lines", LINES, "editor.lines_"),
        // Named by the site, so they are offered once the site has been read.
        ...(site
            ? [
                  {
                      name: "hidden_elements",
                      selector: {
                          select: { multiple: true, options: site.elements.map((element) => ({ value: element.id, label: element.name })) },
                      },
                  },
                  {
                      name: "picked_items",
                      selector: {
                          select: {
                              multiple: true,
                              options: site.items.map((item) => ({
                                  value: item.id,
                                  label: site.elements.length > 1 ? `${elementName(item.element)} · ${item.name}` : item.name,
                              })),
                          },
                      },
                  },
              ]
            : []),
        ...rowStepSchema(config, text),
        ...scrollIndicatorSchema(text),
    ];
}

export class UtilityCostCardEditor extends LitElement {
    @property({ attribute: false }) public hass?: HomeAssistant;
    @state() private config: UtilityCostCardConfig = { type: "custom:utility-cost-card" };
    @state() private site?: Site;
    /** The site last asked for, so it is asked once. */
    private asked?: string;

    public setConfig(config: UtilityCostCardConfig): void {
        this.config = { ...config };
    }

    protected willUpdate(changed: PropertyValues): void {
        if (changed.has("config") || changed.has("hass")) {
            this.readSite();
        }
    }

    protected render(): TemplateResult | typeof nothing {
        if (!this.hass) {
            return nothing;
        }
        return html`
            <ha-form
                .hass=${this.hass}
                .data=${{ ...DEFAULTS, ...scrollIndicatorData(rowStepData(this.config), DEFAULT_SCROLL_INDICATOR) }}
                .schema=${schema(this.site, this.config, (key) => this.text(key))}
                .computeLabel=${(entry: SchemaEntry) => this.text(`editor.${entry.name}`)}
                .computeHelper=${(entry: SchemaEntry) => this.helper(entry.name)}
                @value-changed=${this.valueChanged}
            ></ha-form>
        `;
    }

    /** The site's elements and items, for the lists of the ones to hide and to pick. */
    private readSite(): void {
        const entry = this.config.site;
        if (!this.hass?.callWS || entry === this.asked) {
            return;
        }
        this.asked = entry;
        this.site = undefined;
        if (!entry) {
            return;
        }
        this.hass
            .callWS<Site>({ type: `${DOMAIN}/site`, entry_id: entry })
            .then((site) => {
                if (this.asked === entry) {
                    this.site = site;
                }
            })
            .catch(() => {
                // Without the site the two lists are left out, and the rest of the editor works.
            });
    }

    private valueChanged(event: CustomEvent<{ value: UtilityCostCardConfig }>): void {
        const config: UtilityCostCardConfig = tidyScrollIndicator(tidyRowStep(event.detail.value), DEFAULT_SCROLL_INDICATOR);
        if (config.site !== this.config.site) {
            // Another site's elements and items have other ids.
            delete config.hidden_elements;
            delete config.picked_items;
        }
        for (const key of ["title", "period", "site"]) {
            if (!config[key]) {
                delete config[key];
            }
        }
        for (const key of ["hidden_elements", "picked_items"] as const) {
            if (!config[key]?.length) {
                delete config[key];
            }
        }
        // The defaults are shown in the form but left out of the configuration.
        for (const [key, value] of Object.entries(DEFAULTS)) {
            if (config[key] === value || config[key] === undefined || config[key] === null) {
                delete config[key];
            }
        }
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    }

    private text(key: string): string {
        return translate(this.language(), key);
    }

    private helper(name: string): string | undefined {
        const key = `editor.${name}_helper`;
        const helper = translate(this.language(), key);
        return helper === key ? undefined : helper;
    }

    private language(): string {
        return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
    }
}

if (!customElements.get("utility-cost-card-editor")) {
    customElements.define("utility-cost-card-editor", UtilityCostCardEditor);
}

declare global {
    interface HTMLElementTagNameMap {
        "utility-cost-card-editor": UtilityCostCardEditor;
    }
}
