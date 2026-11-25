"""Which sensors a site starts with."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant.common import MockConfigEntry

from custom_components.utility_cost_tracker.const import DOMAIN

from .conftest import METER, SPOT


async def test_only_the_totals_of_the_site_and_its_elements_start_enabled(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    hass.states.async_set(SPOT, "0.2")
    hass.states.async_set(METER, "1000", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    enabled = {
        entity.unique_id.removeprefix(f"{entry.entry_id}_")
        for entity in er.async_entries_for_config_entry(registry, entry.entry_id)
        if not entity.disabled_by
    }
    assert enabled == {f"{key}_{period}" for period in ("hour", "day", "month") for key in ("total", "energy_total", "transfer_total")}
    for key in ("tax_day", "energy_usage_day", "margin_day", "basic_month", "price", "transfer_price"):
        assert registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{key}"), key
