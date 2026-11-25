"""Which sensors a site starts with."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant.common import MockConfigEntry

from custom_components.utility_cost_tracker.const import DOMAIN

from .conftest import METER, SPOT


async def test_the_breakdowns_start_disabled_and_the_totals_items_and_prices_enabled(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    hass.states.async_set(SPOT, "0.2")
    hass.states.async_set(METER, "1000", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    disabled = {
        entity.unique_id.removeprefix(f"{entry.entry_id}_")
        for entity in er.async_entries_for_config_entry(registry, entry.entry_id)
        if entity.disabled_by
    }
    periods = ("hour", "day", "month")
    assert disabled == {
        f"{key}_{period}"
        for period in periods
        for key in (
            "tax",
            "energy_usage",
            "energy_usage_with_tax",
            "energy_tax",
            "transfer_usage",
            "transfer_usage_with_tax",
            "transfer_tax",
        )
    }
    for key in ("total_day", "energy_total_month", "margin_day", "price", "transfer_price"):
        assert hass.states.get(registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{key}")), key
