"""A made-up electricity site: a meter, a spot price, a margin, day and night transfer and a basic fee."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.config_entries import ConfigSubentryData
from homeassistant.core import HomeAssistant
from pytest_homeassistant.common import MockConfigEntry

from custom_components.utility_cost_tracker.const import DOMAIN, SUBENTRY_ELEMENT, SUBENTRY_ITEM

METER = "sensor.meter_energy"
SPOT = "sensor.spot_price"


def element(subentry_id: str, title: str, tax: float) -> ConfigSubentryData:
    return ConfigSubentryData(subentry_id=subentry_id, subentry_type=SUBENTRY_ELEMENT, title=title, data={"tax": tax}, unique_id=None)


def item(subentry_id: str, title: str, data: dict[str, Any]) -> ConfigSubentryData:
    return ConfigSubentryData(subentry_id=subentry_id, subentry_type=SUBENTRY_ITEM, title=title, data=data, unique_id=None)


DAY_WINDOW = {"start": "07:00:00", "end": "22:00:00", "weekdays": [], "months": []}


@pytest.fixture
def entry() -> MockConfigEntry:
    return MockConfigEntry(
        domain=DOMAIN,
        title="Example home",
        data={
            "utility": "electricity",
            "consumption_entity": METER,
            "factor": 1,
            "periods": ["hour", "day", "month"],
            "cents": True,
            "unit": "kWh",
        },
        subentries_data=[
            element("energy", "Energy", 25.5),
            element("transfer", "Transfer", 25.5),
            item("spot", "Spot", {"element": "energy", "kind": "sensor", "price_entity": SPOT, "multiplier": 100, "addend": 0}),
            item("margin", "Margin", {"element": "energy", "kind": "constant", "price": 0.5}),
            item(
                "day", "Day transfer", {"element": "transfer", "kind": "constant", "price": 4.0, "timing": "window", "window": DAY_WINDOW}
            ),
            item("night", "Night transfer", {"element": "transfer", "kind": "constant", "price": 2.0, "timing": "other_times"}),
            item("basic", "Basic fee", {"element": "transfer", "kind": "fixed_fee", "price": 1000, "fee_period": "month"}),
        ],
    )


@pytest.fixture
async def helsinki(hass: HomeAssistant) -> None:
    await hass.config.async_set_time_zone("Europe/Helsinki")
    hass.config.currency = "EUR"
