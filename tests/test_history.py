"""The long-term statistics the integration writes itself, and the websocket command the card reads a site with."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components.recorder import Recorder, get_instance
from homeassistant.components.recorder.statistics import list_statistic_ids, statistics_during_period
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant.common import MockConfigEntry
from pytest_homeassistant.components.recorder.common import async_wait_recording_done
from pytest_homeassistant.typing import WebSocketGenerator

from custom_components.utility_cost_tracker.history import async_removed, async_write, statistic_id
from custom_components.utility_cost_tracker.tariff import HourSums

from .conftest import METER, SPOT

TZ = ZoneInfo("Europe/Helsinki")


async def reading(hass: HomeAssistant, freezer: FrozenDateTimeFactory, moment: datetime, value: float) -> None:
    freezer.move_to(moment)
    hass.states.async_set(METER, str(value), {"unit_of_measurement": "kWh"})
    await hass.async_block_till_done()


async def two_days(hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory) -> None:
    """2 kWh and 1 kWh on the first day and 2 kWh on the second, each in an hour that has ended, at 10 c/kWh."""
    freezer.move_to(datetime(2026, 11, 25, 12, 0, tzinfo=TZ))
    hass.states.async_set(SPOT, "0.10")
    hass.states.async_set(METER, "100", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await reading(hass, freezer, datetime(2026, 11, 25, 12, 30, tzinfo=TZ), 102)
    await reading(hass, freezer, datetime(2026, 11, 25, 13, 10, tzinfo=TZ), 103)
    await reading(hass, freezer, datetime(2026, 11, 26, 9, 5, tzinfo=TZ), 105)
    await reading(hass, freezer, datetime(2026, 11, 26, 10, 5, tzinfo=TZ), 105.5)
    await async_wait_recording_done(hass)


async def changes(hass: HomeAssistant, key: str, period: str) -> list[float]:
    start = datetime(2026, 11, 1, tzinfo=TZ)
    rows = await get_instance(hass).async_add_executor_job(statistics_during_period, hass, start, None, {key}, period, None, {"change"})
    return [row["change"] for row in rows.get(key, [])]


async def test_every_item_has_its_history_per_calendar_period_without_a_sensor(
    recorder_mock: Recorder, hass: HomeAssistant, helsinki: None, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    await two_days(hass, entry, freezer)
    spot = statistic_id(entry, "spot", "cost")
    assert await changes(hass, spot, "hour") == pytest.approx([0.2, 0.1, 0.2])
    assert await changes(hass, spot, "day") == pytest.approx([0.3, 0.2])
    assert await changes(hass, spot, "month") == pytest.approx([0.5])
    assert await changes(hass, statistic_id(entry, "spot", "tax"), "day") == pytest.approx([0.0765, 0.051])
    # The monthly fee came when the site was added, in its first hour.
    assert await changes(hass, statistic_id(entry, "basic", "cost"), "day") == pytest.approx([10, 0])
    assert await changes(hass, statistic_id(entry, "consumption"), "day") == pytest.approx([3, 2])


async def test_a_removed_items_history_stays_and_gets_nothing_more(
    recorder_mock: Recorder, hass: HomeAssistant, helsinki: None, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    await two_days(hass, entry, freezer)
    hass.config_entries.async_remove_subentry(entry, "margin")
    await hass.async_block_till_done()
    await reading(hass, freezer, datetime(2026, 11, 26, 10, 30, tzinfo=TZ), 107.5)
    await reading(hass, freezer, datetime(2026, 11, 26, 11, 5, tzinfo=TZ), 108)
    await async_wait_recording_done(hass)
    assert len(await changes(hass, statistic_id(entry, "margin", "cost"), "hour")) == 3
    assert await changes(hass, statistic_id(entry, "spot", "cost"), "hour") == pytest.approx([0.2, 0.1, 0.2, 0.25])
    # An hour that ended with the item still in the ledger, written after the item was removed but before the reload.
    late = HourSums(datetime(2026, 11, 26, 11, tzinfo=TZ), {"margin": 9.0, "spot": 0.8}, {"margin": 0.0, "spot": 0.0}, 8.5)
    async_write(hass, entry, [late])
    await async_wait_recording_done(hass)
    assert len(await changes(hass, statistic_id(entry, "margin", "cost"), "hour")) == 3
    assert len(await changes(hass, statistic_id(entry, "spot", "cost"), "hour")) == 5


async def test_the_card_is_told_of_a_removed_item_with_history(
    recorder_mock: Recorder, hass: HomeAssistant, helsinki: None, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    await two_days(hass, entry, freezer)

    def items() -> list[str]:
        return [item.item_id for item in entry.runtime_data.site.items]

    assert await async_removed(hass, entry, items()) == []
    hass.config_entries.async_remove_subentry(entry, "margin")
    await hass.async_block_till_done()
    assert await async_removed(hass, entry, items()) == [
        {
            "id": "margin",
            "name": "Margin",
            "cost_statistic": statistic_id(entry, "margin", "cost"),
            "tax_statistic": statistic_id(entry, "margin", "tax"),
        }
    ]
    # An item left without its element is out of the site as well, though its subentry stays.
    hass.config_entries.async_remove_subentry(entry, "transfer")
    await hass.async_block_till_done()
    assert "basic" in entry.subentries
    assert {"margin", "day", "basic"} <= {item["id"] for item in await async_removed(hass, entry, items())}
    assert "spot" not in {item["id"] for item in await async_removed(hass, entry, items())}


async def test_removing_the_site_removes_its_statistics(
    recorder_mock: Recorder, hass: HomeAssistant, helsinki: None, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    await two_days(hass, entry, freezer)
    assert await get_instance(hass).async_add_executor_job(list_statistic_ids, hass)
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    assert await get_instance(hass).async_add_executor_job(list_statistic_ids, hass) == []


async def test_the_card_reads_a_site_over_the_websocket(
    hass: HomeAssistant, helsinki: None, entry: MockConfigEntry, hass_ws_client: WebSocketGenerator
) -> None:
    # On the real clock, as a frozen one makes the websocket's login token invalid.
    hass.states.async_set(SPOT, "0.10")
    hass.states.async_set(METER, "100", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    hass.states.async_set(METER, "102", {"unit_of_measurement": "kWh"})
    await hass.async_block_till_done()
    now = dt_util.now()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "utility_cost_tracker/site", "entry_id": entry.entry_id})
    site = (await client.receive_json())["result"]
    assert (site["name"], site["currency"], site["unit"], site["price_unit"]) == ("Example home", "EUR", "kWh", "c/kWh")
    assert site["elements"] == [{"id": "energy", "name": "Energy", "tax": 25.5}, {"id": "transfer", "name": "Transfer", "tax": 25.5}]
    assert [(item["id"], item["element"], item["kind"], item["fee_period"]) for item in site["items"]] == [
        ("spot", "energy", "sensor", None),
        ("margin", "energy", "constant", None),
        ("day", "transfer", "constant", None),
        ("night", "transfer", "constant", None),
        ("basic", "transfer", "fixed_fee", "month"),
    ]
    assert site["items"][0]["cost_statistic"] == statistic_id(entry, "spot", "cost")
    assert list(site["periods"]) == ["hour", "day", "month"]
    day = site["periods"]["day"]
    assert day["start"] == dt_util.start_of_local_day(now).isoformat()
    assert day["consumption"] == pytest.approx(2)
    assert day["items"]["spot"] == pytest.approx({"amount": 0.2, "tax": 0.051})
    assert day["items"]["basic"] == {"amount": 0, "tax": 0}
    assert site["periods"]["month"]["items"]["basic"] == pytest.approx({"amount": 10, "tax": 2.55})
    # Spot 10 and margin 0.5 c/kWh, and transfer 4 by day and 2 at night, with 25.5 % tax.
    transfer = 4 if 7 <= now.hour < 22 else 2
    assert site["prices"]["total"] == pytest.approx((10.5 + transfer) * 1.255)
    assert site["price_scale"] == 100
    assert site["meter"] == {"entity": METER, "factor": 1}
    assert site["removed"] == []
    # The running sums, which the statistics are written from, and the hour they began in.
    assert site["since"] == now.replace(minute=0, second=0, microsecond=0).isoformat()
    assert site["sums"]["spot"] == pytest.approx({"amount": 0.2, "tax": 0.051})
    assert site["sums"]["basic"] == pytest.approx({"amount": 10, "tax": 2.55})
    assert site["consumed"] == pytest.approx(2)

    await client.send_json_auto_id({"type": "utility_cost_tracker/site", "entry_id": "nothing"})
    assert (await client.receive_json())["error"]["code"] == "not_found"


async def test_a_zone_half_an_hour_off_utc_has_its_history_by_its_own_hours_and_days(
    recorder_mock: Recorder, hass: HomeAssistant, entry: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    zone = ZoneInfo("Asia/Kolkata")
    await hass.config.async_set_time_zone("Asia/Kolkata")
    hass.config.currency = "EUR"
    freezer.move_to(datetime(2026, 11, 25, 22, 10, tzinfo=zone))
    hass.states.async_set(SPOT, "0.10")
    hass.states.async_set(METER, "100", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    # 2 kWh before midnight, 1 kWh in the half hour after it, which is still the 25th in UTC, and 2 kWh later that day.
    await reading(hass, freezer, datetime(2026, 11, 25, 23, 40, tzinfo=zone), 102)
    await reading(hass, freezer, datetime(2026, 11, 26, 0, 20, tzinfo=zone), 103)
    await reading(hass, freezer, datetime(2026, 11, 26, 9, 5, tzinfo=zone), 105)
    await reading(hass, freezer, datetime(2026, 11, 26, 10, 5, tzinfo=zone), 105.5)
    await async_wait_recording_done(hass)

    spot = statistic_id(entry, "spot", "cost")
    start = datetime(2026, 11, 1, tzinfo=zone)

    def read(period: str) -> list[tuple[datetime, float]]:
        rows = statistics_during_period(hass, start, None, {spot}, period, None, {"change"})
        return [(dt_util.utc_from_timestamp(row["start"]).astimezone(zone), row["change"]) for row in rows.get(spot, [])]

    hours = await get_instance(hass).async_add_executor_job(read, "hour")
    days = await get_instance(hass).async_add_executor_job(read, "day")
    # The recorder keeps a row where it was written, on the zone's own hour, and counts a day from the zone's midnight.
    assert [(moment.day, moment.hour, moment.minute) for moment, _ in hours] == [(25, 23, 0), (26, 0, 0), (26, 9, 0)]
    assert [change for _, change in hours] == pytest.approx([0.2, 0.1, 0.2])
    assert [(moment.day, moment.hour, moment.minute) for moment, _ in days] == [(25, 0, 0), (26, 0, 0)]
    assert [change for _, change in days] == pytest.approx([0.2, 0.3])
