/**
 * A dashboard card for one site of the Utility cost tracker integration: what a period has cost, the bill in its
 * elements and items, a chart of the period in parts, each part's share, and an estimate for the whole period.
 *
 * Every part is switched on or off in the editor, so the same card is a whole bill with a chart or two rows with a
 * share bar. The current period comes from the integration's own command, earlier ones and the chart from the
 * long-term statistics the integration writes.
 */
import { LitElement, css, html, nothing } from "lit";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import { CARD_VERSION, DEFAULT_SCROLL_INDICATOR, DOMAIN, ICONS, REFRESH_MS } from "./const";
import { REMOVED, averagePrice, estimate, inPeriod, listed, shown } from "./cost";
import type { Options, Segment, Shown } from "./cost";
import { StatisticsCache, loadView } from "./data";
import type { Column, View } from "./data";
import "./editor";
import { ScrollFade, fadeStyles, scrollIndicator, validScrollIndicator } from "./fade";
import type { HomeAssistant } from "./hass";
import { gridMinRows, heightCardSize, heightMode, heightStyle, validHeight } from "./height";
import type { HeightConfig } from "./height";
import { browserLanguage, translate } from "./localize/localize";
import { PARTS, PERIODS, periodStart, weekNumber } from "./periods";
import type { Period } from "./periods";
import { ROW_PX, drawnScale, fillLimit, filledHeight, filledStyle, spareRoom, validRowStep } from "./rows";
import { LINES, TAX_MODES, shows } from "./types";
import type { Site, UtilityCostCardConfig } from "./types";

const HOUR_MS = 3_600_000;

/** The smallest of 1, 2, 2.5 and 5 times a power of ten that is at least the value. */
function niceUp(value: number): number {
    if (!(value > 0)) {
        return 0;
    }
    const power = 10 ** Math.floor(Math.log10(value));
    const lead = value / power;
    // A hair's allowance, as a division can leave 2.0000000001 of what is 2.
    return (lead <= 1.000001 ? 1 : lead <= 2.000001 ? 2 : lead <= 2.500001 ? 2.5 : lead <= 5.000001 ? 5 : 10) * power;
}

/** A scale of two to four round steps that reaches the value. */
function scale(value: number): { step: number; steps: number } {
    const step = niceUp(value / 3);
    return { step, steps: step ? Math.max(Math.ceil(value / step - 1e-9), 2) : 2 };
}

const PADDING = 16;
const GAP = 12;
// Each part's height, which the texts kept to one line make the same at every width. The card's least height is
// worked out from them, so from its settings alone.
const HEADER_HEIGHT = 24;
const COMPACT_HEIGHT = 40;
const PERIODS_HEIGHT = 28;
const EARLIER_HEIGHT = 36;
const LABEL_HEIGHT = 18;
const TOTAL_HEIGHT = 40;
const CONSUMPTION_HEIGHT = 18;
const ESTIMATE_HEIGHT = 118;
const ESTIMATE_LINE_HEIGHT = 16;
const SHARE_HEIGHT = 10;
const CHART_HEIGHT = 120;
const CHART_PART_HEIGHT = CHART_HEIGHT + 18 + 16;
/** The least a held card's bars are drawn in, which still has room for a scale of four steps. */
const CHART_LEAST_HEIGHT = 76;
const LEGEND_HEIGHT = 20;
// The least of the bill or the legend that stays in view when the card is held lower than them.
const LIST_HEIGHT = 48;

export class UtilityCostCard extends LitElement {
    @property({ attribute: false }) public hass?: HomeAssistant;
    @property({ attribute: false }) public layout?: string;
    @state() private config?: UtilityCostCardConfig;
    @state() private site?: Site;
    @state() private view?: View;
    /** A text key of what went wrong reading the site. */
    @state() private failed?: string;
    /** The period picked in the card, until the page is loaded again. */
    @state() private picked?: Period;
    /** How many periods back from the current one. */
    @state() private offset = 0;
    /** The half of the share bar the pointer is over, which its numbers are shown under. */
    @state() private sharing?: "left" | "right";
    /** The bar the pointer is over, by its place from the left. */
    @state() private hovered?: number;
    @state() private filled = 0;
    /** Held to a height that leaves a row or more over the parts, which then stay at the top. */
    @state() private topped = false;

    private readonly statistics = new StatisticsCache();
    private timer?: number;
    private frame?: number;
    /** Counts the reads started, so an answer that a later read has overtaken is dropped. */
    private reads = 0;
    private readonly resizes = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => this.measureSoon());

    constructor() {
        super();
        // Fades the list's edges while the card is held to a height, through the card's own lifecycle.
        new ScrollFade(
            this,
            () => (this.held() ? [...this.renderRoot.querySelectorAll<HTMLElement>(".list")] : []),
            () => scrollIndicator(this.config ?? {}, DEFAULT_SCROLL_INDICATOR),
        );
    }

    public static getConfigElement(): HTMLElement {
        return document.createElement("utility-cost-card-editor");
    }

    /** The first site there is, so the card picker's preview shows a bill. */
    public static async getStubConfig(hass?: HomeAssistant): Promise<Record<string, unknown>> {
        try {
            const entries = await hass?.callWS?.<{ entry_id: string }[]>({ type: "config_entries/get", domain: DOMAIN });
            return entries?.length ? { site: entries[0].entry_id } : {};
        } catch {
            return {};
        }
    }

    public setConfig(config: UtilityCostCardConfig): void {
        const fail = (key: string) => new Error(translate(browserLanguage(), `common.${key}`));
        if (!config) {
            throw fail("invalid_configuration");
        }
        if (!validHeight(config)) {
            throw fail("invalid_height");
        }
        if (!validRowStep(config)) {
            throw fail("invalid_row_step");
        }
        if (!validScrollIndicator(config)) {
            throw fail("invalid_scroll_indicator");
        }
        if (config.period != null && !PERIODS.includes(config.period)) {
            throw fail("invalid_period");
        }
        if (config.tax != null && !TAX_MODES.includes(config.tax)) {
            throw fail("invalid_tax");
        }
        if (config.lines != null && !LINES.includes(config.lines)) {
            throw fail("invalid_lines");
        }
        if (config.site !== this.config?.site) {
            this.site = undefined;
            this.view = undefined;
            this.failed = undefined;
            this.picked = undefined;
            this.offset = 0;
            this.statistics.clear();
        }
        this.config = config;
    }

    /** In units of 50 px, for a masonry view. */
    public getCardSize(): number {
        return heightCardSize(this.config ?? {}, Math.ceil(this.minimumHeight() / 50), this.minimumHeight());
    }

    /** The chart's bars and the bill's amounts need about a phone's section, so the card takes a whole section. */
    public getGridOptions(): Record<string, unknown> {
        return { columns: 12, min_columns: 12, rows: "auto", min_rows: gridMinRows(this.minimumHeight()) };
    }

    public connectedCallback(): void {
        super.connectedCallback();
        this.timer = window.setInterval(() => void this.read(), REFRESH_MS);
        // Back on the page, what was read may be old. The first time, the first update reads.
        if (this.hasUpdated) {
            void this.read();
        }
    }

    public disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearInterval(this.timer);
        this.resizes?.disconnect();
        cancelAnimationFrame(this.frame ?? 0);
    }

    /** Home Assistant hands over a new `hass` on every state change, none of which the card reads. */
    protected shouldUpdate(changed: PropertyValues): boolean {
        if (changed.size > 1 || !changed.has("hass")) {
            return true;
        }
        const before = changed.get("hass") as HomeAssistant | undefined;
        return !before || this.language(before) !== this.language() || before.config?.time_zone !== this.hass?.config?.time_zone;
    }

    protected willUpdate(changed: PropertyValues): void {
        if (changed.has("config") || changed.has("picked") || changed.has("offset") || (changed.has("hass") && !changed.get("hass"))) {
            void this.read();
        }
    }

    protected render(): TemplateResult | typeof nothing {
        if (!this.hass || !this.config) {
            return nothing;
        }
        const message = !this.config.site ? "no_site" : (this.failed ?? (this.site && this.view ? undefined : ""));
        if (message !== undefined) {
            return html`<ha-card class=${this.cardClass()} style=${this.cardStyle()}
                ><div class="content"><div class="part message">${message ? this.text(`common.${message}`) : nothing}</div></div></ha-card
            >`;
        }
        const site = this.site!;
        const view = this.view!;
        const config = this.config;
        const bill = shown(site, view.ledger, view.period, this.options());
        const full = shows(config, "show_periods") || shows(config, "show_earlier");
        return html`
            <ha-card class=${this.cardClass()} style=${this.cardStyle()}>
                <div class="content">
                    ${full ? this.header(site, view, bill) : this.compact(site, view, bill)}
                    ${full && shows(config, "show_estimate") && this.boxed() ? this.estimate(site, view, bill) : nothing}
                    ${shows(config, "show_share") ? this.share(site, bill) : nothing}
                    ${shows(config, "show_chart") ? this.chart(site, view, bill) : nothing}
                    ${shows(config, "show_bill") ? this.bill(site, bill) : shows(config, "show_legend") ? this.legend(site, bill) : nothing}
                </div>
            </ha-card>
        `;
    }

    protected updated(): void {
        const card = this.renderRoot.querySelector("ha-card");
        if (card && this.isConnected) {
            this.resizes?.observe(card);
            this.measureSoon();
        }
    }

    /** Reads the site, and the period shown with what the options need of its history. */
    private async read(): Promise<void> {
        const hass = this.hass;
        const entry = this.config?.site;
        if (!hass?.callWS || !entry || !this.isConnected) {
            return;
        }
        const read = ++this.reads;
        try {
            const site = await hass.callWS<Site>({ type: `${DOMAIN}/site`, entry_id: entry });
            const period = this.periodOf(site);
            const wants = {
                chart: shows(this.config, "show_chart"),
                previous: shows(this.config, "show_estimate"),
                line: shows(this.config, "show_usage"),
            };
            const view = period ? await loadView(hass, this.statistics, site, period, this.offset, Date.now(), wants) : undefined;
            if (read !== this.reads) {
                return;
            }
            this.site = site;
            this.view = view;
            this.failed = view ? undefined : "unavailable";
        } catch (error) {
            if (read !== this.reads) {
                return;
            }
            const missing = (error as { code?: string })?.code === "not_found";
            // What was read earlier stays in view over a passing failure, such as a restart.
            if (missing || !this.site) {
                this.failed = missing ? "not_found" : "unavailable";
            }
        }
    }

    /** The periods the site follows, shortest first. */
    private followed(site: Site): Period[] {
        return PERIODS.filter((period) => site.periods[period]);
    }

    /** The period picked in the card, else the configured one, else the month, else the site's longest. */
    private periodOf(site: Site): Period | undefined {
        const followed = this.followed(site);
        return (
            [this.picked, this.config?.period, "month" as Period].find((period) => period && followed.includes(period)) ?? followed.at(-1)
        );
    }

    private options(): Options {
        return {
            tax: this.config?.tax ?? "included",
            hidden: this.config?.hidden_elements ?? [],
            picked: this.config?.picked_items ?? [],
            removed: this.text("card.removed"),
        };
    }

    private pick(period: Period): void {
        this.picked = period;
        this.offset = 0;
    }

    private header(site: Site, view: View, bill: Shown): TemplateResult {
        const config = this.config!;
        const price = site.prices.total;
        const [label, detail] = this.label(view);
        const followed = this.followed(site);
        return html`
            <div class="part header">
                <ha-icon .icon=${ICONS[site.utility ?? ""] ?? ICONS.other}></ha-icon>
                <span class="name" title=${this.heading(site)}>${this.heading(site)}</span>
                ${
                    shows(config, "show_price") && price != null
                        ? html`<span class="price"
                              ><span class="price-label">${this.text("card.price_now")} </span><b>${this.price(site, price)}</b></span
                          >`
                        : nothing
                }
            </div>
            ${
                shows(config, "show_periods") && followed.length > 1
                    ? html`<div class="part periods" role="group">
                          ${followed.map(
                              (period) =>
                                  html`<button
                                      type="button"
                                      class=${period === view.period ? "on" : ""}
                                      aria-pressed=${period === view.period}
                                      @click=${() => this.pick(period)}
                                  >
                                      ${this.text(`periods.${period}`)}
                                  </button>`,
                          )}
                      </div>`
                    : nothing
            }
            ${
                shows(config, "show_earlier")
                    ? html`<div class="part earlier">
                          <button
                              type="button"
                              ?disabled=${!view.earlier}
                              title=${this.text("card.earlier")}
                              aria-label=${this.text("card.earlier")}
                              @click=${() => (this.offset -= 1)}
                          >
                              <ha-icon icon="mdi:chevron-left"></ha-icon>
                          </button>
                          <div class="label">${label}<small>${detail}</small></div>
                          <button
                              type="button"
                              ?disabled=${view.current}
                              title=${this.text("card.later")}
                              aria-label=${this.text("card.later")}
                              @click=${() => (this.offset += 1)}
                          >
                              <ha-icon icon="mdi:chevron-right"></ha-icon>
                          </button>
                      </div>`
                    : html`<div class="part plain-label">${label}</div>`
            }
            <div class="part amount">
                <div class="total">${this.money(site, bill.total)}</div>
                ${shows(config, "show_consumption") ? html`<div class="consumption">${this.consumption(site, view, bill)}</div>` : nothing}
                ${shows(config, "show_estimate") && !this.boxed() ? this.estimateLine(site, view, bill) : nothing}
            </div>
        `;
    }

    /** Without the period switch and the earlier periods, the whole head is one row, and a tap on the period changes it. */
    private compact(site: Site, view: View, bill: Shown): TemplateResult {
        const config = this.config!;
        const followed = this.followed(site);
        const next = followed[(followed.indexOf(view.period) + 1) % followed.length];
        const details: string[] = [];
        const guess = shows(config, "show_estimate") ? this.estimated(site, view, bill) : undefined;
        if (guess) {
            details.push(this.text("card.estimate_short").replace("{amount}", this.money(site, guess.total, 0)));
        }
        const average = averagePrice(site, bill, view.ledger.consumption);
        if (shows(config, "show_consumption") && average !== undefined) {
            details.push(this.price(site, average));
        }
        if (shows(config, "show_price") && site.prices.total != null) {
            details.push(this.text("card.now").replace("{price}", this.number(site.prices.total, 2)));
        }
        const detail = details.join(" · ");
        return html`<div class="part compact">
            <div class="badge"><ha-icon .icon=${ICONS[site.utility ?? ""] ?? ICONS.other}></ha-icon></div>
            <div class="names">
                <b title=${this.heading(site)}>${this.heading(site)}</b>
                ${
                    followed.length > 1
                        ? html`<button type="button" title=${this.text("card.next_period")} @click=${() => this.pick(next)}>
                              ${this.label(view)[0]} <ha-icon icon="mdi:swap-horizontal"></ha-icon>
                          </button>`
                        : html`<span>${this.label(view)[0]}</span>`
                }
            </div>
            <div class="value">${this.money(site, bill.total)}<small title=${detail}>${detail}</small></div>
        </div>`;
    }

    private consumption(site: Site, view: View, bill: Shown): TemplateResult {
        const used = view.ledger.consumption;
        const average = averagePrice(site, bill, used);
        return html`<b>${this.number(used, used < 10 ? 2 : 1)}${site.unit ? ` ${site.unit}` : ""}</b>${
                average === undefined
                    ? nothing
                    : html` · ${this.text("card.average").replace("{price}", "")}<b>${this.price(site, average)}</b>`
            }`;
    }

    /** The whole period's estimate, when this is the current period and the previous one is whole in the history. */
    private estimated(site: Site, view: View, bill: Shown): { rest: number; total: number; previous: number; same: number } | undefined {
        if (!view.previous || !view.previousSame) {
            return undefined;
        }
        const previous = shown(site, view.previous, view.period, this.options()).total;
        const same = shown(site, view.previousSame, view.period, this.options()).total;
        return { ...estimate(bill.total, previous, same), previous, same };
    }

    private estimate(site: Site, view: View, bill: Shown): TemplateResult | typeof nothing {
        if (!view.previous) {
            return nothing;
        }
        const row = (label: string, value: TemplateResult | string, strong = false) =>
            html`<div class="row">
                <span class="row-label" title=${this.text(label)}>${this.text(label)}</span
                >${strong ? html`<b>${value}</b>` : html`<span>${value}</span>`}
            </div>`;
        const guess = this.estimated(site, view, bill);
        if (!guess) {
            // An hour has no estimate, and a part of one doesn't compare with a whole one.
            const previous = shown(site, view.previous, view.period, this.options()).total;
            return html`<div class="part estimate">
                ${row("card.previous", html`${this.money(site, previous)} ${view.current ? nothing : this.change(bill.total, previous)}`)}
            </div>`;
        }
        return html`<div class="part estimate">
            ${row("card.estimate", this.money(site, guess.total), true)}
            <div class="progress"><i style="width: ${view.elapsed * 100}%"></i></div>
            ${row("card.so_far", this.money(site, bill.total))} ${row("card.rest", `+ ${this.money(site, guess.rest)}`)}
            ${row("card.previous_same", html`${this.money(site, guess.same)} ${this.change(bill.total, guess.same)}`)}
            ${row("card.previous_whole", this.money(site, guess.previous))}
        </div>`;
    }

    /** The estimate as a line under the total, for a card held too low for the estimate's box. */
    private estimateLine(site: Site, view: View, bill: Shown): TemplateResult | typeof nothing {
        if (!view.previous) {
            return nothing;
        }
        const guess = this.estimated(site, view, bill);
        if (guess) {
            return html`<div class="estimate-line">${this.text("card.estimate")} <b>${this.money(site, guess.total)}</b></div>`;
        }
        const previous = shown(site, view.previous, view.period, this.options()).total;
        return html`<div class="estimate-line">
            ${this.text("card.previous")} <b>${this.money(site, previous)}</b> ${view.current ? nothing : this.change(bill.total, previous)}
        </div>`;
    }

    /** How much more or less `value` is than `against`, in percent. */
    private change(value: number, against: number): TemplateResult {
        const percent = (value / against - 1) * 100;
        if (!Number.isFinite(percent) || Math.abs(percent) < 0.5) {
            return html`<span class="change">${this.text("card.no_change")}</span>`;
        }
        return html`<span class="change ${percent > 0 ? "up" : "down"}"
            >${percent > 0 ? "▲" : "▼"} ${this.number(Math.abs(percent), 0)} %</span
        >`;
    }

    private segments(site: Site, segments: Segment[], total: number, along: "width" | "height", titled = true): TemplateResult[] {
        return segments
            .filter((segment) => segment.value > 0)
            .map(
                (segment) =>
                    html`<i
                        title=${titled ? `${segment.name} ${this.money(site, segment.value)}` : nothing}
                        style="${along}: ${(segment.value / total) * 100}%; background: ${segment.color}"
                    ></i>`,
            );
    }

    private share(site: Site, bill: Shown): TemplateResult {
        const segments = bill.segments.filter((segment) => segment.value > 0);
        const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
        const side = (event: PointerEvent) => {
            if (event.pointerType === "touch") {
                return;
            }
            const bar = (event.currentTarget as HTMLElement).getBoundingClientRect();
            this.sharing = event.clientX - bar.left < bar.width / 2 ? "left" : "right";
        };
        return html`<div class="part share" @pointermove=${side} @pointerleave=${() => (this.sharing = undefined)}>
            <div class="share-bar" role="img" aria-label=${this.text("card.share")}>
                ${this.segments(site, segments, total, "width", false)}
            </div>
            ${
                this.sharing
                    ? html`<div class="tip" style="${this.sharing}: 0" aria-hidden="true">
                          ${segments.map(
                              (segment) =>
                                  html`<span
                                      ><span><i class="dot" style="background: ${segment.color}"></i>${segment.name}</span
                                      ><span
                                          >${this.money(site, segment.value)} · ${this.number((segment.value / total) * 100, 0)} %</span
                                      ></span
                                  >`,
                          )}
                          <span><span>${this.text("card.total")}</span><b>${this.money(site, bill.total)}</b></span>
                      </div>`
                    : nothing
            }
        </div>`;
    }

    private chart(site: Site, view: View, bill: Shown): TemplateResult | typeof nothing {
        const part = PARTS[view.period];
        if (!view.columns || !part) {
            return nothing;
        }
        const options = this.options();
        const columns = view.columns.map((column) => ({ column, bill: shown(site, column.ledger, part, options) }));
        const top = Math.max(...columns.map((column) => column.bill.segments.reduce((sum, segment) => sum + segment.value, 0)), 0);
        // What the period's bill has that none of its parts do: the fixed fees of a period longer than a bar's.
        const fees = bill.elements
            .flatMap((element) => element.items)
            .filter((item) => !inPeriod(item.item, part))
            .reduce((sum, item) => sum + item.value, 0);
        // A chart whose tallest bar is under five cents is read in tenths of a cent, as it would otherwise show zeros.
        const digits = top > 0 && top < 0.05 ? 3 : 2;
        // The line is drawn by what was consumed per hour, so stretches of different lengths share a scale.
        const rates = (view.line ?? [])
            .filter((point) => point.end > point.start)
            .map((point) => ({ at: (point.start + point.end) / 2, rate: (point.amount * HOUR_MS) / (point.end - point.start) }));
        const most = Math.max(...rates.map((point) => point.rate), 0);
        // A bar opens its own period, where the site follows it and the card has a way back.
        const opens = Boolean(site.periods[part]) && (shows(this.config, "show_periods") || !shows(this.config, "show_earlier"));
        const hovered = this.hovered === undefined ? undefined : columns[this.hovered];
        // Both scales have the same steps, so one set of lines across the chart serves the bars and the line.
        const cost = scale(top);
        const rate = { step: niceUp(most / cost.steps), steps: cost.steps };
        const ticks = Array.from({ length: cost.steps }, (_, index) => cost.steps - index);
        const costTop = cost.step * cost.steps || 1;
        const rateTop = rate.step * rate.steps || 1;
        const currency =
            new Intl.NumberFormat(this.language(), { style: "currency", currency: site.currency })
                .formatToParts(0)
                .find((piece) => piece.type === "currency")?.value ?? site.currency;
        const side = (unit: string, step: number, kind: string) =>
            html`<div class="scale ${kind}" aria-hidden="true">
                <span class="unit">${unit}</span>
                ${step ? ticks.map((tick) => html`<span style="bottom: ${(tick / cost.steps) * 100}%">${this.number(tick * step, 0, 3)}</span>`) : nothing}
            </div>`;
        return html`<div class="part chart ${most > 0 ? "lined" : ""}">
            <div class="plot">
                ${side(currency, cost.step, "cost")}
                <div
                    class="bars ${columns.length > 40 ? "dense" : ""}"
                    role="group"
                    aria-label=${this.text("card.chart")}
                    @pointermove=${(event: PointerEvent) => this.hover(event, columns.length)}
                    @pointerleave=${() => (this.hovered = undefined)}
                >
                    ${ticks.map((tick) => html`<i class="grid" style="bottom: ${(tick / cost.steps) * 100}%"></i>`)}
                    ${columns.map(({ column, bill: columnBill }) => {
                        const label = `${this.columnLabel(part, column)} ${this.money(site, columnBill.total, digits)}`;
                        const bars = column.future ? nothing : this.segments(site, columnBill.segments, costTop, "height", false);
                        return opens && !column.future
                            ? html`<button
                                  type="button"
                                  class="column ${column.current ? "current" : ""}"
                                  aria-label=${label}
                                  @click=${() => this.open(part, column.start)}
                              >
                                  ${bars}
                              </button>`
                            : html`<div class="column ${column.current ? "current" : ""}" role="img" aria-label=${label}>${bars}</div>`;
                    })}
                    ${
                        most > 0
                            ? html`<svg
                                  class="usage-line"
                                  viewBox="0 0 ${columns.length} 100"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                              >
                                  <polyline
                                      points=${rates
                                          .map(
                                              (point) =>
                                                  `${this.across(view.columns!, point.at).toFixed(3)},${(100 - (point.rate / rateTop) * 100).toFixed(2)}`,
                                          )
                                          .join(" ")}
                                  />
                              </svg>`
                            : nothing
                    }
                    ${hovered ? this.tip(site, part, hovered.column, hovered.bill, digits, this.hovered! / columns.length) : nothing}
                </div>
                ${most > 0 ? side(this.rateUnit(site), rate.step, "rate") : nothing}
            </div>
            <div class="axis">${this.axis(view, part).map((label) => html`<span>${label}</span>`)}</div>
            <div class="note">
                ${Math.abs(fees) > 0.005 ? this.text("card.fees_not_in_bars").replace("{amount}", this.money(site, fees)) : nothing}
            </div>
        </div>`;
    }

    /** What the bar under the pointer holds: its cost by element and its consumption. */
    private tip(site: Site, part: Period, column: Column, bill: Shown, digits: number, across: number): TemplateResult {
        const segments = bill.segments.filter((segment) => segment.value > 0);
        const used = column.ledger.consumption;
        // On the bar's far side from the nearer edge, so it is never cut by the card.
        const side = across < 0.5 ? `left: ${(across + 1 / 48) * 100}%` : `right: ${(1 - across + 1 / 48) * 100}%`;
        return html`<div class="tip" style=${side} aria-hidden="true">
            <b>${this.columnLabel(part, column)}</b>
            <span><span>${this.text("card.total")}</span><b>${this.money(site, bill.total, digits)}</b></span>
            ${
                segments.length > 1
                    ? segments.map(
                          (segment) =>
                              html`<span
                                  ><span><i class="dot" style="background: ${segment.color}"></i>${segment.name}</span
                                  ><span>${this.money(site, segment.value, digits)}</span></span
                              >`,
                      )
                    : nothing
            }
            ${
                column.future || !shows(this.config, "show_usage")
                    ? nothing
                    : html`<span
                          ><span>${this.text("card.used")}</span
                          ><span>${this.number(used, 0, used < 10 ? 2 : 1)}${site.unit ? ` ${site.unit}` : ""}</span></span
                      >`
            }
        </div>`;
    }

    /** Follows a mouse or a pen over the bars. A finger's touch opens the bar instead. */
    private hover(event: PointerEvent, count: number): void {
        if (event.pointerType === "touch") {
            return;
        }
        const plot = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const index = Math.floor(((event.clientX - plot.left) / plot.width) * count);
        this.hovered = index >= 0 && index < count ? index : undefined;
    }

    /** Where a moment is along the bars, in bars from the left, as a year's first and last weeks are shorter than their bars. */
    private across(columns: Column[], at: number): number {
        const index = columns.findIndex((column) => at < column.end);
        const column = columns[index];
        return column ? index + Math.max(at - column.start, 0) / (column.end - column.start) : columns.length;
    }

    /** Shows the period a bar stands for: a day's hour, a week's or a month's day, a year's week. */
    private open(part: Period, start: number): void {
        const zone = this.zone();
        const span = { hour: HOUR_MS, day: 24 * HOUR_MS, week: 7 * 24 * HOUR_MS }[part as "hour" | "day" | "week"];
        this.hovered = undefined;
        this.picked = part;
        // Rounded, as a day is an hour off its length when the clocks change.
        this.offset = Math.round((periodStart(part, start, zone) - periodStart(part, Date.now(), zone)) / span);
    }

    /** The unit of consumption per hour, which for energy in kWh is the power in kW. */
    private rateUnit(site: Site): string {
        return site.unit ? `${site.unit}/h` : "/h";
    }

    private bill(site: Site, bill: Shown): TemplateResult {
        const config = this.config!;
        const mode = this.options().tax;
        const several = this.several(site, bill);
        const rates = [...new Set(bill.elements.map((element) => element.element.tax).filter((rate) => rate > 0))];
        return html`<div class="part list bill">
            ${bill.elements.map(
                (element) => html`
                    ${
                        several
                            ? html`<div class="element">
                                  <span class="line-name" title=${element.element.name}
                                      ><i class="dot" style="background: ${element.color}"></i>${element.element.name}</span
                                  ><span>${this.money(site, element.value)}</span>
                              </div>`
                            : nothing
                    }
                    ${listed(element, config.lines ?? "all").map(
                        (item) =>
                            html`<div class="item ${several ? "" : "flat"}">
                                <span class="line-name" title=${item.item.name}
                                    >${item.color ? html`<i class="dot" style="background: ${item.color}"></i>` : nothing}${item.item.name}</span
                                ><span>${this.money(site, item.value)}</span>
                            </div>`,
                    )}
                `,
            )}
            <div class="rule"></div>
            ${
                mode === "separate" && bill.tax !== 0
                    ? html`<div class="sum">
                              <span>${this.text("card.before_tax")}</span><span>${this.money(site, bill.beforeTax)}</span>
                          </div>
                          <div class="sum">
                              <span
                                  >${
                                      rates.length === 1
                                          ? this.text("card.tax_rate").replace("{rate}", this.number(rates[0], 0, 2))
                                          : this.text("card.tax")
                                  }</span
                              ><span>${this.money(site, bill.tax)}</span>
                          </div>`
                    : nothing
            }
            <div class="sum big">
                <span>${this.text(mode === "none" && bill.tax !== 0 ? "card.total_before_tax" : "card.total")}</span
                ><span>${this.money(site, bill.total)}</span>
            </div>
            ${
                mode === "included" && bill.tax !== 0
                    ? html`<div class="sum small">
                          <span>${this.text("card.of_which_tax")}</span><span>${this.money(site, bill.tax)}</span>
                      </div>`
                    : nothing
            }
        </div>`;
    }

    /** Whether the bill is told by element: with more than one, or with removed items, which must not pass for the site's own. */
    private several(site: Site, bill: Shown): boolean {
        return site.elements.length > 1 || bill.elements.some((element) => element.element.id === REMOVED);
    }

    /** Without the bill, the colours are told by a legend, when a bar or a chart shows them. */
    private legend(site: Site, bill: Shown): TemplateResult | typeof nothing {
        if (!shows(this.config, "show_share") && !shows(this.config, "show_chart")) {
            return nothing;
        }
        const entries = bill.elements.flatMap((element) => [
            ...(this.several(site, bill) ? [{ name: element.element.name, value: element.value, color: element.color }] : []),
            ...element.items.filter((item) => item.color).map((item) => ({ name: item.item.name, value: item.value, color: item.color! })),
        ]);
        if (!entries.length) {
            return nothing;
        }
        return html`<div class="part list legend">
            ${entries.map(
                (entry) =>
                    html`<span><i class="dot" style="background: ${entry.color}"></i>${entry.name} ${this.money(site, entry.value)}</span>`,
            )}
        </div>`;
    }

    /** The period's name, and a second line that places it, when it needs one. */
    private label(view: View): [string, string] {
        const date = (at: number, options: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() }).format(at);
        const day: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "numeric" };
        switch (view.period) {
            case "hour": {
                const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
                return [`${date(view.from, time)}–${date(view.to, time)}`, date(view.from, day)];
            }
            case "day":
                if (this.offset === 0 || this.offset === -1) {
                    return [this.text(this.offset === 0 ? "card.today" : "card.yesterday"), date(view.from, day)];
                }
                return [date(view.from, { ...day, year: "numeric" }), ""];
            case "week": {
                const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric" };
                return [
                    this.text("card.week").replace("{number}", String(weekNumber(view.from, this.zone()))),
                    `${date(view.from, short)}–${date(view.to - 1, short)}`,
                ];
            }
            case "month": {
                const month = date(view.from, { month: "long", year: "numeric" });
                return [month.charAt(0).toUpperCase() + month.slice(1), ""];
            }
            default:
                return [date(view.from, { year: "numeric" }), ""];
        }
    }

    private columnLabel(part: Period, column: Column): string {
        const date = (at: number, options: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() }).format(at);
        if (part === "hour") {
            const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
            return `${date(column.start, time)}–${date(column.end, time)}`;
        }
        if (part === "week") {
            const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric" };
            const week = this.text("card.week").replace(
                "{number}",
                String(weekNumber(periodStart("week", column.start, this.zone()), this.zone())),
            );
            return `${week}, ${date(column.start, short)}–${date(column.end - 1, short)}`;
        }
        return date(column.start, { weekday: "short", day: "numeric", month: "numeric" });
    }

    /** A few labels spread evenly under the bars: hours of a day, weekdays, days of a month, the months a year's weeks are in. */
    private axis(view: View, part: Period): string[] {
        const columns = view.columns ?? [];
        const format = (options: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat(this.language(), { ...options, timeZone: this.zone() });
        if (part === "hour") {
            return ["0", "6", "12", "18", "24"];
        }
        if (view.period === "week") {
            const weekday = format({ weekday: "short" });
            return columns.map((column) => weekday.format(column.start));
        }
        const label = view.period === "year" ? format({ month: "short" }) : format({ day: "numeric" });
        const last = columns.length - 1;
        return [0, 1, 2, 3, 4].map((step) => label.format(columns[Math.round((step * last) / 4)].start));
    }

    private heading(site: Site): string {
        return this.config?.title || site.name;
    }

    private money(site: Site, value: number, digits = 2): string {
        return new Intl.NumberFormat(this.language(), {
            style: "currency",
            currency: site.currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);
    }

    private price(site: Site, value: number): string {
        return `${this.number(value, 2)} ${site.price_unit}`;
    }

    private number(value: number, digits: number, most = digits): string {
        return new Intl.NumberFormat(this.language(), { minimumFractionDigits: digits, maximumFractionDigits: most }).format(value);
    }

    /** Home Assistant's own zone, which the integration's periods and the recorder's days are counted in. */
    private zone(): string | undefined {
        return this.hass?.config?.time_zone;
    }

    private language(hass = this.hass): string {
        return hass?.locale?.language ?? hass?.language ?? browserLanguage();
    }

    private text(key: string): string {
        return translate(this.language(), key);
    }

    /**
     * The height the parts need, from the settings alone. The bill, the legend and the chart count for the least they are
     * held to, and the estimate for a line under the total, unless `boxed` asks what the card needs with the estimate's box.
     */
    private minimumHeight(boxed = false): number {
        const config = this.config;
        const parts: number[] = [];
        if (shows(config, "show_periods") || shows(config, "show_earlier")) {
            parts.push(HEADER_HEIGHT);
            if (shows(config, "show_periods")) parts.push(PERIODS_HEIGHT);
            parts.push(shows(config, "show_earlier") ? EARLIER_HEIGHT : LABEL_HEIGHT);
            const estimate = shows(config, "show_estimate");
            parts.push(
                TOTAL_HEIGHT +
                    (shows(config, "show_consumption") ? CONSUMPTION_HEIGHT : 0) +
                    (estimate && !boxed ? ESTIMATE_LINE_HEIGHT : 0),
            );
            // The estimate's box, which is lower as a comparison alone and missing without a previous period.
            if (estimate && boxed) parts.push(ESTIMATE_HEIGHT);
        } else {
            parts.push(COMPACT_HEIGHT);
        }
        if (shows(config, "show_share")) parts.push(SHARE_HEIGHT);
        if (shows(config, "show_chart")) parts.push(CHART_PART_HEIGHT - CHART_HEIGHT + CHART_LEAST_HEIGHT);
        if (shows(config, "show_bill")) {
            parts.push(LIST_HEIGHT);
        } else if (shows(config, "show_legend") && (shows(config, "show_share") || shows(config, "show_chart"))) {
            parts.push(LEGEND_HEIGHT);
        }
        return 2 * PADDING + parts.reduce((sum, part) => sum + part, 0) + GAP * (parts.length - 1);
    }

    /** Whether the estimate is drawn as its box: when the height follows the content, or is held high enough for the box. */
    private boxed(): boolean {
        const config: HeightConfig = this.config ?? {};
        const rows = config.grid_options ? config.grid_options.rows : config.layout_options?.grid_rows;
        const mode = heightMode(config);
        let room: number | undefined;
        if (this.layout === "grid" && typeof rows === "number") {
            // Home Assistant never gives fewer rows than the card's least.
            room = Math.max(rows, gridMinRows(this.minimumHeight())) * ROW_PX - (ROW_PX - 56);
        } else if (mode === "fixed" && config.height) {
            room = config.height;
        } else if (mode === "max" && config.max_height) {
            room = config.max_height;
        }
        return room === undefined || room >= this.minimumHeight(true);
    }

    /** Whether the card's height is set from outside: a fixed height, a limit, or rows set in the layout tab. */
    private held(): boolean {
        return heightStyle(this.config ?? {}, this.layout, this.minimumHeight()) !== "";
    }

    private measureSoon(): void {
        cancelAnimationFrame(this.frame ?? 0);
        this.frame = requestAnimationFrame(() => this.fillRows());
    }

    /**
     * In a sections view whose rows are left automatic, the card takes the whole rows its content needs, or the half rows
     * with `row_step: half`, so the cards under it stay on the rows. The room left over is spread between the parts. A
     * card held to a height spreads its room the same way while it is less than a row, and from a row up keeps its parts
     * at the top with the room under them.
     */
    private fillRows(): void {
        const card = this.renderRoot.querySelector<HTMLElement>("ha-card");
        const content = card?.querySelector<HTMLElement>(":scope > .content");
        if (!card || !content || !card.clientWidth) {
            return;
        }
        // The parts' own heights, not where the last one ends, as the spread room pushes it down to the card's bottom.
        // Drawn sizes are unscaled, as the padding and border added to them are the layout's. A list that scrolls counts
        // for all of its content, and the chart for its own height, as it takes the spare room and gives way when held.
        const scale = drawnScale(card);
        const parts = [...content.children] as HTMLElement[];
        const style = getComputedStyle(card);
        const needed =
            parts.reduce(
                (sum, part) =>
                    sum +
                    (part.classList.contains("list")
                        ? part.scrollHeight
                        : part.classList.contains("chart")
                          ? CHART_PART_HEIGHT
                          : part.getBoundingClientRect().height / scale),
                0,
            ) +
            GAP * (parts.length - 1) +
            2 * PADDING +
            px(style.borderTopWidth) +
            px(style.borderBottomWidth);
        const limit = fillLimit(this.config ?? {}, this.layout, this.minimumHeight());
        if (!limit) {
            this.filled = 0;
            this.topped = spareRoom(card.getBoundingClientRect().height / scale, needed) >= ROW_PX;
            return;
        }
        this.topped = false;
        this.filled = filledHeight(needed, this.config ?? {}, limit);
    }

    private cardClass(): string {
        return [this.topped ? "topped" : "", this.held() ? "held" : ""].filter(Boolean).join(" ");
    }

    private cardStyle(): string {
        return filledStyle(this.config ?? {}, this.layout, this.minimumHeight(), this.filled);
    }

    public static get styles(): CSSResultGroup {
        return [
            fadeStyles,
            css`
                ha-card {
                    container-type: inline-size;
                    overflow: hidden;
                    /* Its own transition: all would slide every change in the rows filled. */
                    transition: none;
                    /* A card taller than its parts, on filled rows or held with less than a row to spare, spreads the
                       room between the parts under its head. Held with more, the parts stay at the top. */
                    display: flex;
                    flex-direction: column;
                }
                .content {
                    flex: 1 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: ${GAP}px;
                    padding: ${PADDING}px;
                    box-sizing: border-box;
                }
                /* Held lower than its parts, the card keeps all but the bill or the legend whole, and scrolls that. */
                .held .content {
                    flex: 1 1 auto;
                    min-height: 0;
                }
                .part {
                    flex: none;
                    margin-top: auto;
                }
                /* The head keeps its place when the period changes, as the switch and its arrows are pressed in turn. */
                .part:first-child,
                .part.periods,
                .part.earlier,
                .part.plain-label,
                .part.amount,
                .topped .part {
                    margin-top: 0;
                }
                /* With a chart, the spare room is the chart's, and the other parts keep their gaps. */
                .content:has(.chart) .part {
                    margin-top: 0;
                }
                .chart {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    /* Set, as a flex item's own least height is its content's, which would keep the bars from giving way. */
                    min-height: ${CHART_PART_HEIGHT - CHART_HEIGHT + CHART_LEAST_HEIGHT}px;
                }
                .chart > * {
                    flex: none;
                }
                /* A card held low scrolls its bill or legend first, and only then draws its bars lower. */
                .held .list {
                    flex: 0 1000 auto;
                    min-height: ${LIST_HEIGHT}px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    /* Whether it scrolls or not, so the amounts don't move when it starts to. */
                    scrollbar-gutter: stable;
                    padding-inline-end: 8px;
                }
                button {
                    font: inherit;
                    color: inherit;
                    background: none;
                    border: 0;
                    padding: 0;
                    cursor: pointer;
                }
                button:disabled {
                    cursor: default;
                }
                button:focus-visible {
                    outline: 2px solid var(--primary-color);
                    outline-offset: 1px;
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: ${HEADER_HEIGHT}px;
                    --mdc-icon-size: 22px;
                    color: var(--state-icon-color, var(--secondary-text-color));
                }
                .name {
                    flex: 1;
                    min-width: 0;
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--primary-text-color);
                }
                .name,
                .names b,
                .names span,
                .names button,
                .value small,
                .row-label,
                .line-name,
                .note,
                .consumption,
                .plain-label {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .price {
                    font-size: 12px;
                    white-space: nowrap;
                    color: var(--secondary-text-color);
                }
                b {
                    font-weight: 500;
                    color: var(--primary-text-color);
                }
                .periods {
                    display: flex;
                    height: ${PERIODS_HEIGHT}px;
                    box-sizing: border-box;
                    border: 1px solid var(--divider-color);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .periods button {
                    flex: 1 1 0;
                    min-width: 0;
                    font-size: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--secondary-text-color);
                }
                .periods button.on {
                    color: var(--primary-color);
                    font-weight: 500;
                    background: color-mix(in srgb, var(--primary-color) 14%, transparent);
                }
                .periods button:focus-visible {
                    outline-offset: -2px;
                }
                .earlier {
                    display: flex;
                    align-items: center;
                    height: ${EARLIER_HEIGHT}px;
                    margin: 0 -6px;
                }
                .earlier button {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    color: var(--secondary-text-color);
                }
                .earlier button:disabled {
                    opacity: 0.25;
                }
                .label {
                    flex: 1;
                    min-width: 0;
                    text-align: center;
                    font-weight: 500;
                    line-height: 20px;
                    white-space: nowrap;
                }
                .label small {
                    display: block;
                    font-weight: 400;
                    font-size: 11px;
                    line-height: 14px;
                    color: var(--secondary-text-color);
                }
                .plain-label {
                    height: ${LABEL_HEIGHT}px;
                    line-height: ${LABEL_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .total {
                    font-size: 34px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: ${TOTAL_HEIGHT}px;
                    white-space: nowrap;
                }
                .consumption {
                    height: ${CONSUMPTION_HEIGHT}px;
                    line-height: ${CONSUMPTION_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .estimate-line {
                    height: ${ESTIMATE_LINE_HEIGHT}px;
                    line-height: ${ESTIMATE_LINE_HEIGHT}px;
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .estimate-line b {
                    color: var(--primary-text-color);
                }
                .compact {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    height: ${COMPACT_HEIGHT}px;
                }
                .badge {
                    flex: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    --mdc-icon-size: 20px;
                    color: var(--state-icon-color, var(--secondary-text-color));
                    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
                }
                .names {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    line-height: 20px;
                }
                .names b,
                .names span,
                .names button {
                    max-width: 100%;
                }
                .names span,
                .names button {
                    font-size: 12px;
                    color: var(--secondary-text-color);
                    --mdc-icon-size: 13px;
                }
                .value {
                    flex: 0 1 auto;
                    min-width: 0;
                    text-align: right;
                    font-size: 22px;
                    font-weight: 700;
                    line-height: 24px;
                    white-space: nowrap;
                }
                .value small {
                    display: block;
                    font-size: 11px;
                    font-weight: 400;
                    line-height: 16px;
                    color: var(--secondary-text-color);
                }
                .estimate {
                    border-radius: 10px;
                    padding: 8px 10px;
                    font-size: 12.5px;
                    line-height: 18px;
                    background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
                }
                .row {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    white-space: nowrap;
                }
                .row-label {
                    min-width: 0;
                    color: var(--secondary-text-color);
                }
                .progress {
                    height: 4px;
                    border-radius: 2px;
                    margin: 5px 0 3px;
                    overflow: hidden;
                    background: var(--divider-color);
                }
                .progress i {
                    display: block;
                    height: 100%;
                    background: var(--primary-color);
                }
                .change.up {
                    color: var(--error-color, #db4437);
                }
                .change.down {
                    color: var(--success-color, #43a047);
                }
                .share {
                    position: relative;
                }
                .share .tip {
                    top: ${SHARE_HEIGHT + 4}px;
                }
                .share-bar {
                    display: flex;
                    height: ${SHARE_HEIGHT}px;
                    border-radius: 5px;
                    overflow: hidden;
                    background: var(--divider-color);
                }
                .share-bar i {
                    display: block;
                    height: 100%;
                }
                .chart {
                    --scale: 32px;
                }
                .held .legend {
                    min-height: ${LEGEND_HEIGHT}px;
                }
                .chart > .plot {
                    flex: 1 1 ${CHART_HEIGHT}px;
                    min-height: ${CHART_LEAST_HEIGHT}px;
                }
                .plot {
                    display: flex;
                    /* Room for the scales' units, and for the top step's number. */
                    padding-top: 14px;
                    box-sizing: border-box;
                }
                .bars {
                    position: relative;
                    flex: 1 1 0;
                    min-width: 0;
                    display: flex;
                    align-items: flex-end;
                    gap: 2px;
                    border-bottom: 1px solid var(--divider-color);
                }
                .bars.dense {
                    gap: 1px;
                }
                .grid {
                    position: absolute;
                    left: 0;
                    right: 0;
                    border-top: 1px solid var(--divider-color);
                    opacity: 0.6;
                    pointer-events: none;
                }
                .scale {
                    position: relative;
                    flex: none;
                    width: var(--scale);
                    font-size: 10.5px;
                    line-height: 14px;
                    color: var(--secondary-text-color);
                    white-space: nowrap;
                }
                .scale span {
                    position: absolute;
                    right: 6px;
                    transform: translateY(50%);
                }
                .scale.rate span {
                    right: auto;
                    left: 6px;
                }
                /* The units are over the bars' ends, in the room above the top line, clear of the steps' numbers. */
                .scale .unit {
                    top: -14px;
                    left: 100%;
                    right: auto;
                    margin: 0 4px;
                    transform: none;
                }
                .scale.rate .unit {
                    left: auto;
                    right: 100%;
                }
                .column {
                    flex: 1 1 0;
                    cursor: default;
                    min-width: 0;
                    height: 100%;
                    display: flex;
                    flex-direction: column-reverse;
                }
                .column i {
                    display: block;
                    flex: none;
                }
                button.column {
                    cursor: pointer;
                }
                .plot:hover .column:hover {
                    filter: brightness(1.15);
                }
                .tip {
                    position: absolute;
                    top: 0;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 110px;
                    max-width: 60%;
                    padding: 6px 8px;
                    border-radius: 8px;
                    background: var(--card-background-color, var(--ha-card-background));
                    border: 1px solid var(--divider-color);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    font-size: 11px;
                    line-height: 15px;
                    pointer-events: none;
                    white-space: nowrap;
                }
                .tip > span {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    color: var(--secondary-text-color);
                }
                .tip > span > b {
                    color: var(--primary-text-color);
                }
                .tip .dot {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 2px;
                    margin-inline-end: 5px;
                }
                /* The part under way is marked under the baseline, clear of its bar and in no bar's colour. */
                .column {
                    position: relative;
                }
                .column.current::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: -5px;
                    height: 2px;
                    border-radius: 1px;
                    background: var(--primary-text-color);
                }
                .usage-line {
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                    pointer-events: none;
                }
                .usage-line polyline {
                    fill: none;
                    stroke: var(--utility-cost-usage-color, var(--primary-text-color));
                    /* See-through, so a busy line doesn't hide the bars under it. */
                    stroke-opacity: 0.8;
                    stroke-width: 1.5px;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                    vector-effect: non-scaling-stroke;
                }
                .axis {
                    display: flex;
                    justify-content: space-between;
                    margin-left: var(--scale);
                    height: 18px;
                    line-height: 18px;
                    font-size: 10.5px;
                    color: var(--secondary-text-color);
                }
                .lined .axis {
                    margin-right: var(--scale);
                }
                .note {
                    height: 16px;
                    line-height: 16px;
                    font-size: 11px;
                    color: var(--secondary-text-color);
                }
                .dot {
                    display: inline-block;
                    flex: none;
                    width: 10px;
                    height: 10px;
                    border-radius: 3px;
                    margin-right: 8px;
                }
                .element,
                .item,
                .sum {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    line-height: 20px;
                }
                .element span:last-child,
                .item span:last-child,
                .sum span:last-child {
                    flex: none;
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                }
                .line-name {
                    min-width: 0;
                }
                .element {
                    font-weight: 500;
                    padding: 6px 0 2px;
                }
                .element:first-child {
                    padding-top: 0;
                }
                .item {
                    padding: 2px 0 2px 18px;
                    color: var(--secondary-text-color);
                }
                .item.flat {
                    padding-left: 0;
                }
                .rule {
                    border-top: 1px solid var(--divider-color);
                    margin: 8px 0 4px;
                }
                .sum {
                    padding: 2px 0;
                }
                .sum.big {
                    font-weight: 700;
                    font-size: 15px;
                }
                .sum.small {
                    font-size: 12.5px;
                    color: var(--secondary-text-color);
                }
                .legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px 14px;
                    font-size: 12px;
                    line-height: 20px;
                    color: var(--secondary-text-color);
                }
                .legend span {
                    display: inline-flex;
                    align-items: center;
                }
                .message {
                    color: var(--secondary-text-color);
                }
                /* At a card narrower than about 350 px, by its width inside its border. */
                @container (max-width: 346px) {
                    .total {
                        font-size: 28px;
                    }
                    .price-label {
                        display: none;
                    }
                }
            `,
        ];
    }
}

const px = (value: string) => Number.parseFloat(value) || 0;

interface CardRegistration {
    type: string;
    name: string;
    description: string;
    documentationURL?: string;
    preview?: boolean;
}

if (!customElements.get("utility-cost-card")) {
    console.info(
        `%c  UTILITY-COST-CARD \n%c  ${CARD_VERSION}    `,
        "color: lightblue; font-weight: bold; background: black",
        "color: white; font-weight: bold; background: dimgray",
    );

    const registry = window as unknown as { customCards?: CardRegistration[] };
    registry.customCards = registry.customCards ?? [];
    registry.customCards.push({
        type: "utility-cost-card",
        name: translate(browserLanguage(), "common.name"),
        description: translate(browserLanguage(), "common.description"),
        documentationURL: "https://github.com/jesmak/utility_cost_tracker#utility-cost-card",
        preview: true,
    });
    customElements.define("utility-cost-card", UtilityCostCard);
}

declare global {
    interface HTMLElementTagNameMap {
        "utility-cost-card": UtilityCostCard;
    }
}
