"""Writes docs/screenshots.json, the plan for the README's hero image (see hass-screenshots).

A made-up home's electricity on a January evening, on the contract of the README's first example, shown by the
integration's own card: the month's bill, today by its hours and the week as a share bar. The card reads a site from
the integration's websocket command and its history from the statistics the integration writes, so the plan answers
the command and imports those statistics, and every amount on the dashboard adds up. Run it after changing the data,
then shoot the image: python3 docs/screenshots.py && npm run shoot -- <this repo> in hass-screenshots.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

LOCAL = timezone(timedelta(hours=2))
TAX_RATE = 25.5
# Prices in cents per kWh before tax, as the README's example types them. The margin and the electricity tax are typed
# with tax.
MARGIN = 0.49 / 1.255
DAY_TRANSFER = 3.1
NIGHT_TRANSFER = 1.6
ELECTRICITY_TAX = 2.8 / 1.255
FEES = {"monthly_fee": 3.99 / 1.255, "basic_fee": 12.50 / 1.255}
SPOT_NOW = 11.42
# Each day of January so far: kWh from 07 to 22, kWh at other times, and the day's mean spot price before tax. The last
# is today up to the clock.
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
TODAY = CLOCK.replace(hour=0, minute=0)
# December, the month before, is January's days in another order, a little milder and cheaper.
DECEMBER = [(by_day * 0.9, at_night * 0.9, spot * 0.8) for by_day, at_night, spot in (DAYS[(n * 7) % 20] for n in range(31))]
DAY_HOURS = range(7, 22)
# How a day goes by its hours: the share of its window's kWh each hour takes, with a morning and an evening peak, and
# the spot price against the day's mean, cheap at night.
LOAD = [1.0, 0.95, 0.9, 0.9, 0.95, 1.05, 1.2, 1.5, 1.3, 0.9, 0.8, 0.75, 0.8, 0.85, 0.8, 0.9, 1.1, 1.5, 1.7, 1.6, 1.4, 1.2, 1.1, 1.0]
SPOT = [0.62, 0.58, 0.55, 0.55, 0.6, 0.7, 0.9, 1.25, 1.4, 1.3, 1.15, 1.05, 1.0, 0.95, 0.95, 1.05, 1.2, 1.4, 1.45, 1.3, 1.1, 0.95, 0.8, 0.7]
ENTRY = "home"
DOMAIN = "utility_cost_tracker"
# The bill's lines by element: an id, a name and a kind each.
ELEMENTS = {
    "energy": (
        "Energy",
        [("spot_price", "Spot price", "sensor"), ("margin", "Margin", "constant"), ("monthly_fee", "Monthly fee", "fixed_fee")],
    ),
    "transfer": (
        "Transfer",
        [
            ("day_transfer", "Day transfer", "constant"),
            ("night_transfer", "Night transfer", "constant"),
            ("electricity_tax", "Electricity tax", "constant"),
            ("basic_fee", "Basic fee", "fixed_fee"),
        ],
    ),
}
ITEMS = [item for _, items in ELEMENTS.values() for item, _, _ in items]


def usage(by_day: float, at_night: float, spot: float) -> dict[str, float]:
    """What the kWh used in the day transfer's window and outside it cost by item, in euros before tax."""
    kwh = by_day + at_night
    cents = {
        "spot_price": kwh * spot,
        "margin": kwh * MARGIN,
        "day_transfer": by_day * DAY_TRANSFER,
        "night_transfer": at_night * NIGHT_TRANSFER,
        "electricity_tax": kwh * ELECTRICITY_TAX,
    }
    return {key: value / 100 for key, value in cents.items()} | {"kwh": kwh}


def hours(day: tuple[float, float, float], until: float = 24) -> list[dict[str, float]]:
    """A day by its hours up to `until`, each window's kWh shared between its hours that have passed."""
    by_day, at_night, spot = day
    passed = [min(max(until - hour, 0), 1) * LOAD[hour] for hour in range(24)]
    day_time = sum(passed[hour] for hour in DAY_HOURS)
    night_time = sum(passed) - day_time
    return [
        usage(by_day * share / day_time, 0, spot * SPOT[hour])
        if hour in DAY_HOURS
        else usage(0, at_night * share / night_time, spot * SPOT[hour])
        for hour, share in enumerate(passed)
        if share
    ]


def total(parts: list[dict[str, float]]) -> dict[str, float]:
    return {key: sum(part.get(key, 0) for part in parts) for key in [*ITEMS, "kwh"]}


def amounts(sums: dict[str, float]) -> dict[str, dict[str, float]]:
    """Each item before tax with its tax, as the integration's command gives them."""
    return {item: {"amount": round(sums[item], 6), "tax": round(sums[item] * TAX_RATE / 100, 6)} for item in ITEMS}


def statistic(*parts: str) -> str:
    return f"{DOMAIN}:{'_'.join((ENTRY, *parts))}"


def water(month_start: datetime) -> tuple[dict, dict]:
    """The same home's water, a second site with a bill of its own, and the statistics its estimate reads."""
    # m³ a day from the 1st to yesterday, and today so far.
    days = [0.31, 0.36, 0.29, 0.4, 0.33, 0.3, 0.35, 0.28, 0.34, 0.37, 0.3, 0.32, 0.39, 0.31, 0.29, 0.36, 0.33, 0.3, 0.35, 0.32, 0.2]
    prices = {"water": 1.62 / 1.255, "wastewater": 2.31 / 1.255}
    fees = {"water_fee": 4.10 / 1.255, "wastewater_fee": 5.20 / 1.255}
    names = {"water": "Water", "wastewater": "Wastewater", "water_fee": "Basic fee", "wastewater_fee": "Basic fee"}
    statistics: dict[str, dict] = {}
    used = 0.0
    for number, amount in enumerate(days[:-1]):
        used += amount
        sums = {key: used * price for key, price in prices.items()} | fees
        series = [(f"{DOMAIN}:water_consumption", "m³", used)]
        for key, value in sums.items():
            series += [(f"{DOMAIN}:water_{key}_cost", "EUR", value), (f"{DOMAIN}:water_{key}_tax", "EUR", value * TAX_RATE / 100)]
        for name, unit, value in series:
            start = month_start + timedelta(days=number, hours=12)
            statistics.setdefault(name, {"unit": unit, "sum": []})["sum"].append([start.isoformat(), round(value, 6)])
    used = round(used + days[-1], 6)
    items = {
        key: {"amount": round(value, 6), "tax": round(value * TAX_RATE / 100, 6)}
        for key, value in ({key: used * price for key, price in prices.items()} | fees).items()
    }
    site = {
        "name": "Home water",
        "utility": "water",
        "currency": "EUR",
        "unit": "m³",
        "price_unit": "€/m³",
        "price_scale": 1,
        "elements": [{"id": "water", "name": "Water", "tax": TAX_RATE}, {"id": "wastewater", "name": "Wastewater", "tax": TAX_RATE}],
        "items": [
            {
                "id": key,
                "element": key.removesuffix("_fee"),
                "name": names[key],
                "kind": "fixed_fee" if key in fees else "constant",
                "fee_period": "month" if key in fees else None,
                "cost_statistic": f"{DOMAIN}:water_{key}_cost",
                "tax_statistic": f"{DOMAIN}:water_{key}_tax",
            }
            for key in ("water", "water_fee", "wastewater", "wastewater_fee")
        ],
        "removed": [],
        "consumption_statistic": f"{DOMAIN}:water_consumption",
        "meter": {"entity": "sensor.home_water_meter", "factor": 1},
        "periods": {"month": {"start": month_start.isoformat(), "consumption": used, "items": items}},
        "since": month_start.isoformat(),
        "sums": items,
        "consumed": used,
        "prices": {"water": 1.62, "wastewater": 2.31, "total": 3.93},
    }
    return site, statistics


def main() -> None:
    # What the integration has written: a row a day up to the day before yesterday, which is all a month's chart and
    # its estimate read, and a row an hour for yesterday and today, which a day's chart and estimate read. The hour
    # under way is in no row.
    month_start = TODAY.replace(day=1)
    since = month_start.replace(year=2026, month=12)
    rows: list[tuple[datetime, dict[str, float]]] = []
    for number, day in enumerate(DECEMBER):
        rows.append((since + timedelta(days=number, hours=12), usage(*day) | (FEES if number == 0 else {})))
    for number, day in enumerate(DAYS[:-2]):
        rows.append((month_start + timedelta(days=number, hours=12), usage(*day) | (FEES if number == 0 else {})))
    yesterday = hours(DAYS[-2])
    rows += [(TODAY - timedelta(hours=24 - hour), part) for hour, part in enumerate(yesterday)]
    today = hours(DAYS[-1], CLOCK.hour + CLOCK.minute / 60)
    rows += [(TODAY + timedelta(hours=hour), part) for hour, part in enumerate(today[:-1])]

    statistics: dict[str, dict] = {}
    running = dict.fromkeys([*ITEMS, "kwh"], 0.0)
    for start, part in rows:
        for key in running:
            running[key] += part.get(key, 0)
            if key == "kwh":
                series = [(statistic("consumption"), "kWh", running[key])]
            else:
                series = [(statistic(key, "cost"), "EUR", running[key]), (statistic(key, "tax"), "EUR", running[key] * TAX_RATE / 100)]
            for name, unit, value in series:
                statistics.setdefault(name, {"unit": unit, "sum": []})["sum"].append([start.isoformat(), round(value, 6)])
    now = total([running, today[-1]])

    january = [*(usage(*day) for day in DAYS[:-2]), total(yesterday), total(today)]
    monday = TODAY - timedelta(days=TODAY.weekday())
    periods = {
        "day": (TODAY, total([january[-1]])),
        "week": (monday, total(january[monday.day - 1 :])),
        "month": (month_start, total([*january, FEES])),
        "year": (month_start, total([*january, FEES])),
    }
    energy_now = (SPOT_NOW + MARGIN) * (1 + TAX_RATE / 100)
    # The clock is in the day transfer's window.
    transfer_now = (DAY_TRANSFER + ELECTRICITY_TAX) * (1 + TAX_RATE / 100)
    site = {
        "name": "Home electricity",
        "utility": "electricity",
        "currency": "EUR",
        "unit": "kWh",
        "price_unit": "c/kWh",
        "price_scale": 100,
        "elements": [{"id": element, "name": name, "tax": TAX_RATE} for element, (name, _) in ELEMENTS.items()],
        "items": [
            {
                "id": item,
                "element": element,
                "name": name,
                "kind": kind,
                "fee_period": "month" if kind == "fixed_fee" else None,
                "cost_statistic": statistic(item, "cost"),
                "tax_statistic": statistic(item, "tax"),
            }
            for element, (_, items) in ELEMENTS.items()
            for item, name, kind in items
        ],
        "removed": [],
        "consumption_statistic": statistic("consumption"),
        "meter": {"entity": "sensor.home_electricity_meter", "factor": 1},
        "periods": {
            period: {"start": start.isoformat(), "consumption": round(sums["kwh"], 6), "items": amounts(sums)}
            for period, (start, sums) in periods.items()
        },
        "since": since.isoformat(),
        "sums": amounts(now),
        "consumed": round(now["kwh"], 6),
        "prices": {"energy": round(energy_now, 4), "transfer": round(transfer_now, 4), "total": round(energy_now + transfer_now, 4)},
    }

    water_site, water_statistics = water(month_start)
    price = "sensor.home_electricity_price_now"
    card = {"type": "custom:utility-cost-card", "site": ENTRY}
    head = {"show_periods": False, "show_earlier": False, "show_bill": False}
    view = {
        "type": "sections",
        "max_columns": 2,
        "sections": [
            {
                "type": "grid",
                "cards": [
                    {"type": "heading", "heading": "The bill so far this month", "icon": "mdi:receipt-text-outline"},
                    card | {"period": "month"},
                ],
            },
            {
                "type": "grid",
                "cards": [
                    {"type": "heading", "heading": "Today and this week", "icon": "mdi:lightning-bolt"},
                    card | head | {"period": "day"},
                    card | head | {"period": "week", "show_chart": False, "show_share": True, "show_legend": False},
                    {"type": "tile", "entity": price, "name": "Price now", "icon": "mdi:cash-clock"},
                    {"type": "heading", "heading": "Water", "icon": "mdi:water"},
                    {
                        "type": "custom:utility-cost-card",
                        "site": "water",
                        "show_periods": False,
                        "show_earlier": False,
                        "show_chart": False,
                    },
                ],
            },
        ],
    }
    plan = {
        "clock": CLOCK.isoformat(),
        "resources": [f"custom_components/{DOMAIN}/www/utility-cost-card.js"],
        "devices": {"home_electricity": {"name": "Home electricity"}},
        "entities": {price: {"platform": DOMAIN, "device_id": "home_electricity", "name": "Price now", "display_precision": 2}},
        "states": {
            price: {
                "state": f"{energy_now + transfer_now:.4f}",
                "attributes": {
                    "friendly_name": "Home electricity Price now",
                    "icon": "mdi:lightning-bolt",
                    "unit_of_measurement": "c/kWh",
                    "state_class": "measurement",
                },
            }
        },
        "statistics": statistics | water_statistics,
        "commands": {
            f"{DOMAIN}/site": [{"with": {"entry_id": ENTRY}, "result": site}, {"with": {"entry_id": "water"}, "result": water_site}]
        },
        "shots": [{"name": "dashboard", "width": 1000, "view": view}],
    }
    Path(__file__).with_name("screenshots.json").write_text(json.dumps(plan, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
