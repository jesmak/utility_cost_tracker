"""The card that comes with the integration: served, and kept in the dashboards' resources."""

import logging

import pytest
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration
from homeassistant.setup import async_setup_component
from pytest_homeassistant.common import MockConfigEntry

from custom_components.utility_cost_tracker.const import DOMAIN

from .conftest import METER, SPOT

CARD = "/utility_cost_tracker/utility-cost-card.js"
OLD = f"{CARD}?v=0.9.0"
OLDER = f"{CARD}?v=0.8.0"
OTHER = "/hacsfiles/some-card/some-card.js"
# Stands for the card's resource at the integration's current version.
CURRENT = "current"


async def _url(hass: HomeAssistant, url: str) -> str:
    return f"{CARD}?v={(await async_get_integration(hass, DOMAIN)).version}" if url == CURRENT else url


async def _setup(hass: HomeAssistant, hass_storage, entry: MockConfigEntry, resources: list[str], yaml: bool = False) -> None:
    """The made-up site, started with the given resources."""
    urls = [await _url(hass, url) for url in resources]
    if yaml:
        config = {"resource_mode": "yaml", "resources": [{"url": url, "type": "module"} for url in urls]}
        assert await async_setup_component(hass, "lovelace", {"lovelace": config})
    else:
        # As Home Assistant keeps them between starts, not yet loaded when the integration starts.
        items = [{"id": f"resource{index}", "type": "module", "url": url} for index, url in enumerate(urls)]
        hass_storage["lovelace_resources"] = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": items}}
        assert await async_setup_component(hass, "lovelace", {})
    hass.states.async_set(SPOT, "0.10")
    hass.states.async_set(METER, "100", {"unit_of_measurement": "kWh"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def _urls(hass: HomeAssistant) -> list[str]:
    resources = hass.data[LOVELACE_DATA].resources
    await resources.async_get_info()
    return [item["url"] for item in resources.async_items()]


def _warnings(caplog) -> list[str]:
    return [record.getMessage() for record in caplog.records if record.name.endswith(".card") and record.levelno == logging.WARNING]


@pytest.mark.parametrize(
    ("before", "after"),
    [
        # One resource of the card's own, at the current version, is kept in place of any others of its own.
        ([], [CURRENT]),
        ([OTHER], [OTHER, CURRENT]),
        ([CURRENT], [CURRENT]),
        ([OLD], [CURRENT]),
        ([CARD], [CURRENT]),
        ([OLD, CURRENT], [CURRENT]),
        ([OLDER, OLD], [CURRENT]),
        ([CURRENT, CURRENT], [CURRENT]),
        ([OTHER, OLD, OTHER], [OTHER, CURRENT, OTHER]),
        # The current one is the one kept, and nothing else moves.
        ([OLD, OTHER, CURRENT], [OTHER, CURRENT]),
    ],
)
async def test_storage_mode_keeps_one_resource_at_the_current_version(hass: HomeAssistant, hass_storage, entry, caplog, before, after):
    await _setup(hass, hass_storage, entry, before)
    assert await _urls(hass) == [await _url(hass, url) for url in after]
    assert _warnings(caplog) == []


@pytest.mark.parametrize(
    ("resources", "asked"),
    [([], "add"), ([OTHER], "add"), ([OLD], "change"), ([CURRENT], None), ([OLD, CURRENT], None), ([OLDER, OLD], "change")],
)
async def test_yaml_mode_is_left_alone_and_asks_for_the_current_line(hass: HomeAssistant, hass_storage, entry, caplog, resources, asked):
    await _setup(hass, hass_storage, entry, resources, yaml=True)
    current = await _url(hass, CURRENT)
    assert await _urls(hass) == [await _url(hass, url) for url in resources]
    warnings = _warnings(caplog)
    if asked is None:
        assert warnings == []
    elif asked == "add":
        assert warnings == [
            f"Dashboard resources are set in YAML, so the utility cost card can't add itself. Add url: {current}, type: module to them"
        ]
    else:
        assert len(warnings) == 1
        assert f"Change {resources[0]} in them to {current}" in warnings[0]


async def test_the_card_stays_until_the_last_site_is_removed(hass: HomeAssistant, hass_storage, entry):
    await _setup(hass, hass_storage, entry, [OTHER])
    second = MockConfigEntry(domain=DOMAIN, title="Example cabin", data=dict(entry.data))
    second.add_to_hass(hass)
    assert await hass.config_entries.async_setup(second.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert await _urls(hass) == [OTHER, await _url(hass, CURRENT)]
    assert await hass.config_entries.async_remove(second.entry_id)
    await hass.async_block_till_done()
    assert await _urls(hass) == [OTHER]


async def test_removing_the_last_site_in_yaml_mode_asks_to_remove_its_lines(hass: HomeAssistant, hass_storage, entry, caplog):
    await _setup(hass, hass_storage, entry, [OTHER, OLD, CURRENT], yaml=True)
    caplog.clear()
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    warnings = _warnings(caplog)
    assert len(warnings) == 2
    assert f"Remove {OLD} from them" in warnings[0]


async def test_the_card_is_served(hass: HomeAssistant, hass_storage, entry, hass_client):
    await _setup(hass, hass_storage, entry, [])
    client = await hass_client()
    response = await client.get(CARD)
    assert response.status == 200
    assert "utility-cost-card" in await response.text()
