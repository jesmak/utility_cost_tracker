/** The little of Home Assistant a card needs, so the unmaintained custom-card-helpers isn't a dependency. */

export interface HomeAssistant {
    callWS?<T>(message: Record<string, unknown>): Promise<T>;
    language?: string;
    locale?: { language?: string };
    config?: { time_zone?: string };
}

export interface LovelaceCardConfig {
    type: string;
    [key: string]: unknown;
}
