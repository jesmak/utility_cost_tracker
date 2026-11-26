"""Writes docs/screenshots.json, the plan for the README's hero image (see hass-screenshots).

A made-up home's electricity on a January evening, on the contract of the README's first example, so every amount on
the dashboard adds up. Run it after changing the data, then shoot the image: python3 docs/screenshots.py && npm run
shoot -- <this repo> in hass-screenshots.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

LOCAL = timezone(timedelta(hours=2))
TAX = 1.255
# Prices in cents per kWh, as the README's example types them. The margin and the electricity tax are typed with tax.
MARGIN = 0.49 / TAX
DAY_TRANSFER = 3.1
NIGHT_TRANSFER = 1.6
ELECTRICITY_TAX = 2.8 / TAX
MONTHLY_FEE = 3.99 / TAX
BASIC_FEE = 12.50 / TAX
SPOT_NOW = 11.42
# Each day of January so far: kWh from 07 to 22, kWh at other times, and the day's mean spot price before tax.
DAYS = [
    (17.2, 13.1, 4.1),
    (19.8, 12.4, 6.3),
    (18.1, 12.9, 5.2),
    (20.6, 11.8, 9.8),
    (22.4, 12.2, 12.6),
    (21.0, 13.6, 7.4),
    (19.3, 11.5, 8.9),
    (20.1, 12.0, 11.2),
    (23.5, 13.3, 14.8),
    (18.4, 12.7, 6.1),
    (17.6, 11.9, 3.9),
    (21.9, 12.6, 9.4),
    (22.8, 13.9, 13.1),
    (20.4, 12.1, 10.3),
    (19.0, 11.4, 7.7),
    (18.7, 13.0, 5.6),
    (17.9, 12.8, 4.4),
    (22.1, 12.3, 10.9),
    (24.0, 13.5, 16.2),
    (21.3, 12.5, 12.0),
    (14.9, 9.7, 8.6),
]
CLOCK = datetime(2027, 1, len(DAYS), 18, 40, tzinfo=LOCAL)
LINES = {
    "spot_price": "Spot price",
    "margin": "Margin",
    "monthly_fee": "Monthly fee",
    "day_transfer": "Day transfer",
    "night_transfer": "Night transfer",
    "electricity_tax": "Electricity tax",
    "basic_fee": "Basic fee",
}
DEVICE = "home_electricity"


def usage(day: tuple[float, float, float]) -> dict[str, float]:
    """A day's items priced per unit, in euros before tax."""
    by_day, at_night, spot = day
    kwh = by_day + at_night
    cents = {
        "spot_price": kwh * spot,
        "margin": kwh * MARGIN,
        "day_transfer": by_day * DAY_TRANSFER,
        "night_transfer": at_night * NIGHT_TRANSFER,
        "electricity_tax": kwh * ELECTRICITY_TAX,
    }
    return {key: value / 100 for key, value in cents.items()}


def totals(items: dict[str, float]) -> tuple[float, float]:
    """The energy's and the transfer's totals with tax."""
    energy = items["spot_price"] + items["margin"] + items.get("monthly_fee", 0)
    transfer = items["day_transfer"] + items["night_transfer"] + items["electricity_tax"] + items.get("basic_fee", 0)
    return energy * TAX, transfer * TAX


def entity(key: str) -> str:
    return f"sensor.{DEVICE}_{key}"


def main() -> None:
    month = {key: sum(usage(day)[key] for day in DAYS) for key in usage(DAYS[0])}
    month |= {"monthly_fee": MONTHLY_FEE, "basic_fee": BASIC_FEE}
    month_energy, month_transfer = totals(month)
    today_energy, today_transfer = totals(usage(DAYS[-1]))
    month_start = CLOCK.replace(day=1, hour=0, minute=0).isoformat()
    today_start = CLOCK.replace(hour=0, minute=0).isoformat()

    states: dict[str, dict] = {}
    entities: dict[str, dict] = {}

    def sensor(key: str, name: str, value: float, attributes: dict) -> None:
        states[entity(key)] = {
            "state": f"{value:.4f}",
            "attributes": {"friendly_name": f"Home electricity {name}", "icon": "mdi:lightning-bolt"} | attributes,
        }
        entities[entity(key)] = {"platform": "utility_cost_tracker", "device_id": DEVICE, "name": name, "display_precision": 2}

    def cost(key: str, name: str, value: float, start: str) -> None:
        sensor(key, name, value, {"unit_of_measurement": "EUR", "device_class": "monetary", "state_class": "total", "last_reset": start})

    cost("energy_total_today", "Energy total today", today_energy, today_start)
    cost("transfer_total_today", "Transfer total today", today_transfer, today_start)
    cost("total_today", "Total today", today_energy + today_transfer, today_start)
    cost("energy_total_this_month", "Energy total this month", month_energy, month_start)
    cost("transfer_total_this_month", "Transfer total this month", month_transfer, month_start)
    cost("tax_this_month", "Tax this month", sum(month.values()) * (TAX - 1), month_start)
    cost("total_this_month", "Total this month", month_energy + month_transfer, month_start)
    for key, name in LINES.items():
        cost(f"{key}_this_month", f"{name} this month", month[key], month_start)
    # The clock is in the day transfer's window.
    price_now = (SPOT_NOW + MARGIN + DAY_TRANSFER + ELECTRICITY_TAX) * TAX
    sensor("price_now", "Price now", price_now, {"unit_of_measurement": "c/kWh", "state_class": "measurement"})

    # The day sensors' running sums, a row a day at noon, which is all a chart of the change per day reads. A fixed
    # fee is never in a day's sensor, so these are the usage alone.
    statistics = {}
    for key, index in (("energy_total_today", 0), ("transfer_total_today", 1)):
        total = 0.0
        rows = []
        for number, day in enumerate(DAYS, start=1):
            total += totals(usage(day))[index]
            rows.append([CLOCK.replace(day=number, hour=12, minute=0).isoformat(), round(total, 4)])
        statistics[entity(key)] = {"unit": "EUR", "sum": rows}

    view = {
        "type": "sections",
        "max_columns": 2,
        "sections": [
            {
                "type": "grid",
                "cards": [
                    {"type": "heading", "heading": "Home electricity", "icon": "mdi:lightning-bolt"},
                    {"type": "tile", "entity": entity("total_today"), "name": "Today", "icon": "mdi:calendar-today"},
                    {"type": "tile", "entity": entity("price_now"), "name": "Price now", "icon": "mdi:cash-clock"},
                    {
                        "type": "statistics-graph",
                        "title": "Cost per day",
                        "chart_type": "bar",
                        "period": "day",
                        "days_to_show": 14,
                        "stat_types": ["change"],
                        "entities": [
                            {"entity": entity("energy_total_today"), "name": "Energy"},
                            {"entity": entity("transfer_total_today"), "name": "Transfer"},
                        ],
                    },
                    {"type": "tile", "entity": entity("energy_total_this_month"), "name": "Energy this month"},
                    {
                        "type": "tile",
                        "entity": entity("transfer_total_this_month"),
                        "name": "Transfer this month",
                        "icon": "mdi:transmission-tower",
                    },
                ],
            },
            {
                "type": "grid",
                "cards": [
                    {"type": "heading", "heading": "The bill so far this month", "icon": "mdi:receipt-text-outline"},
                    {
                        "type": "entities",
                        "entities": [
                            *({"entity": entity(f"{key}_this_month"), "name": name} for key, name in LINES.items()),
                            {"type": "divider"},
                            {"entity": entity("tax_this_month"), "name": "Tax", "icon": "mdi:percent"},
                            {"entity": entity("total_this_month"), "name": "Total", "icon": "mdi:sigma"},
                        ],
                    },
                ],
            },
        ],
    }
    plan = {
        "clock": CLOCK.isoformat(),
        "resources": [],
        "devices": {DEVICE: {"name": "Home electricity"}},
        "entities": entities,
        "states": states,
        "statistics": statistics,
        "shots": [{"name": "dashboard", "width": 1000, "view": view}],
    }
    Path(__file__).with_name("screenshots.json").write_text(json.dumps(plan, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
