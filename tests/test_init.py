"""Counting in Home Assistant: from the meter's state changes to the sensors, across reloads and restarts."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant.common import MockConfigEntry, async_fire_time_changed

from custom_components.utility_cost_tracker.const import DOMAIN

from .conftest import METER, SPOT

TZ = ZoneInfo("Europe/Helsinki")

pytestmark = pytest.mark.usefixtures("helsinki")


def sensor(hass: HomeAssistant, unique_id: str) -> float | None:
    entity_id = er.async_get(hass).async_get_entity_id("sensor", DOMAIN, unique_id)
    assert entity_id, unique_id
    state = hass.states.get(entity_id)
    assert state
    return None if state.state in ("unknown", STATE_UNAVAILABLE) else float(state.state)


async def setup(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def meter(hass: HomeAssistant, value: float | str) -> None:
    hass.states.async_set(METER, str(value), {"unit_of_measurement": "kWh"})
    await hass.async_block_till_done()


async def test_counts_each_part_and_the_totals(hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory) -> None:
    freezer.move_to(datetime(2026, 11, 25, 12, 0, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    await meter(hass, 1002)

    id_ = entry.entry_id
    assert sensor(hass, f"{id_}_spot_day") == pytest.approx(2 * 20 * 0.01)
    assert sensor(hass, f"{id_}_margin_day") == pytest.approx(2 * 0.5 * 0.01)
    assert sensor(hass, f"{id_}_day_day") == pytest.approx(2 * 4.0 * 0.01)
    assert sensor(hass, f"{id_}_night_day") == 0
    assert sensor(hass, f"{id_}_transfer_usage_day") == pytest.approx(0.08)
    # The monthly fee shows in the month, never in the day or hour.
    assert sensor(hass, f"{id_}_basic_month") == pytest.approx(10.0)
    assert sensor(hass, f"{id_}_basic_day") == 0
    assert sensor(hass, f"{id_}_energy_usage_with_tax_day") == pytest.approx(0.41 * 1.255)
    assert sensor(hass, f"{id_}_transfer_total_month") == pytest.approx((0.08 + 10.0) * 1.255)
    assert sensor(hass, f"{id_}_total_month") == pytest.approx((0.41 + 0.08 + 10.0) * 1.255)
    assert sensor(hass, f"{id_}_tax_day") == pytest.approx((0.41 + 0.08) * 0.255)
    assert sensor(hass, f"{id_}_price") == pytest.approx((20.5 + 4.0) * 0.01 * 1.255)

    state = hass.states.get(er.async_get(hass).async_get_entity_id("sensor", DOMAIN, f"{id_}_total_month"))
    assert state.attributes["unit_of_measurement"] == "EUR"
    assert state.attributes["state_class"] == "total"
    assert state.attributes["last_reset"] == datetime(2026, 11, 1, tzinfo=TZ).isoformat()


async def test_an_unavailable_meter_and_a_reload_count_nothing_twice(
    hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    freezer.move_to(datetime(2026, 11, 25, 12, 0, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    await meter(hass, 1001)
    await meter(hass, STATE_UNAVAILABLE)
    await meter(hass, 1001)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await meter(hass, 1001)

    assert sensor(hass, f"{entry.entry_id}_margin_month") == pytest.approx(0.005)
    assert sensor(hass, f"{entry.entry_id}_basic_month") == pytest.approx(10.0)


async def test_continues_from_storage_and_counts_what_came_while_it_was_away(
    hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    freezer.move_to(datetime(2026, 11, 25, 12, 0, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    await meter(hass, 1001)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED

    await meter(hass, 1003)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert sensor(hass, f"{entry.entry_id}_margin_month") == pytest.approx(3 * 0.005)


async def test_a_new_day_and_month_start_at_midnight_and_the_monthly_fee_comes_with_the_month(
    hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    freezer.move_to(datetime(2026, 11, 30, 23, 50, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    await meter(hass, 1001)
    assert sensor(hass, f"{entry.entry_id}_margin_day") == pytest.approx(0.005)

    freezer.move_to(datetime(2026, 12, 1, 0, 0, 0, tzinfo=TZ))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert sensor(hass, f"{entry.entry_id}_margin_day") == 0
    assert sensor(hass, f"{entry.entry_id}_margin_month") == 0
    assert sensor(hass, f"{entry.entry_id}_basic_month") == pytest.approx(10.0)


async def test_the_night_price_applies_at_night(hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory) -> None:
    freezer.move_to(datetime(2026, 11, 25, 23, 0, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    await meter(hass, 1001)
    assert sensor(hass, f"{entry.entry_id}_night_day") == pytest.approx(0.02)
    assert sensor(hass, f"{entry.entry_id}_day_day") == 0


async def test_removing_the_entry_removes_its_storage(hass: HomeAssistant, entry: MockConfigEntry, hass_storage: dict) -> None:
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    assert await hass.config_entries.async_unload(entry.entry_id)
    key = f"{DOMAIN}.{entry.entry_id}"
    assert key in hass_storage
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert key not in hass_storage


async def test_removing_an_item_removes_its_sensors(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    registry = er.async_get(hass)
    assert registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_margin_day")
    assert hass.config_entries.async_remove_subentry(entry, "margin")
    await hass.async_block_till_done()
    assert registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_margin_day") is None
    assert registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_spot_day")


async def test_the_price_unit_comes_from_the_meter_when_the_site_was_saved_without_one(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title=entry.title, data={**entry.data, "unit": None}, subentries_data=[])
    hass.states.async_set(SPOT, "0.2")
    await meter(hass, 1000)
    await setup(hass, entry)
    entity_id = er.async_get(hass).async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_price")
    assert hass.states.get(entity_id).attributes["unit_of_measurement"] == "EUR/kWh"
