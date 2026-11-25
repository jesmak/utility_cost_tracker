"""Setting up a site, its cost elements and its items."""

from __future__ import annotations

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant.common import MockConfigEntry

from custom_components.utility_cost_tracker.const import DOMAIN

from .conftest import METER, SPOT

SITE = {"name": "Example home", "utility": "electricity", "consumption_entity": METER, "factor": 1, "periods": ["day"], "cents": True}


async def start_item(hass: HomeAssistant, entry: MockConfigEntry, kind: str) -> dict:
    result = await hass.config_entries.subentries.async_init((entry.entry_id, "item"), context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.MENU
    return await hass.config_entries.subentries.async_configure(result["flow_id"], {"next_step_id": kind})


def created(entry: MockConfigEntry, title: str) -> dict:
    return dict(next(sub for sub in entry.subentries.values() if sub.title == title).data)


async def test_a_site_starts_with_its_utility_s_elements_in_the_user_s_language(hass: HomeAssistant) -> None:
    hass.config.language = "fi"
    hass.states.async_set(METER, "1000", {"unit_of_measurement": "kWh"})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {**SITE, "periods": []})
    assert result["errors"] == {"periods": "no_periods"}
    result = await hass.config_entries.flow.async_configure(result["flow_id"], SITE)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {
        "utility": "electricity",
        "consumption_entity": METER,
        "factor": 1,
        "periods": ["day"],
        "cents": True,
        "unit": "kWh",
    }
    entry = result["result"]
    assert sorted((sub.subentry_type, sub.title, dict(sub.data)) for sub in entry.subentries.values()) == [
        ("element", "Energia", {"tax": 0}),
        ("element", "Siirto", {"tax": 0}),
    ]


async def test_other_starts_with_one_generic_element(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {**SITE, "utility": "other"})
    assert [sub.title for sub in result["result"].subentries.values()] == ["Costs"]


async def test_reconfiguring_the_site(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"utility": "water", "consumption_entity": METER, "factor": 0.5, "periods": ["year"], "cents": False}
    )
    assert result["reason"] == "reconfigure_successful"
    assert entry.data["factor"] == 0.5
    assert entry.data["utility"] == "water"


async def test_an_item_needs_an_element(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, data={"consumption_entity": METER, "periods": ["day"]})
    entry.add_to_hass(hass)
    result = await hass.config_entries.subentries.async_init((entry.entry_id, "item"), context={"source": SOURCE_USER})
    assert result["reason"] == "no_elements"


async def test_an_element(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    result = await hass.config_entries.subentries.async_init((entry.entry_id, "element"), context={"source": SOURCE_USER})
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {"name": "Water", "tax": 10})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert created(entry, "Water") == {"tax": 10}


async def test_a_sensor_item_that_includes_the_tax(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    result = await start_item(hass, entry, "sensor")
    fields = {"name": "Spot 2", "element": "energy", "price_entity": SPOT, "multiplier": 100, "addend": 0, "timing": "always", "factor": 1}
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {**fields, "taxed": False, "includes_tax": True})
    assert result["errors"] == {"includes_tax": "includes_untaxed"}
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {**fields, "taxed": True, "includes_tax": True})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert created(entry, "Spot 2") == {
        "kind": "sensor",
        **{k: v for k, v in fields.items() if k != "name"},
        "taxed": True,
        "includes_tax": True,
    }


async def test_an_item_in_a_time_window(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    result = await start_item(hass, entry, "constant")
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"],
        {
            "name": "Winter weekday",
            "element": "transfer",
            "price": 4.0,
            "taxed": True,
            "includes_tax": False,
            "timing": "window",
            "factor": 1,
        },
    )
    assert result["step_id"] == "window"
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"],
        {"start": "07:00:00", "end": "22:00:00", "weekdays": ["0", "1", "2", "3", "4", "5"], "months": ["11", "12", "1", "2", "3"]},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert created(entry, "Winter weekday")["window"] == {
        "start": "07:00:00",
        "end": "22:00:00",
        "weekdays": [0, 1, 2, 3, 4, 5],
        "months": [11, 12, 1, 2, 3],
    }


async def test_a_fixed_fee_has_no_timing(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    result = await start_item(hass, entry, "fixed_fee")
    assert "timing" not in {str(key) for key in result["data_schema"].schema}
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"],
        {"name": "Monthly fee", "element": "energy", "price": 3.04, "fee_period": "month", "taxed": True, "includes_tax": True},
    )
    assert created(entry, "Monthly fee") == {
        "kind": "fixed_fee",
        "element": "energy",
        "price": 3.04,
        "fee_period": "month",
        "taxed": True,
        "includes_tax": True,
    }


async def test_reconfiguring_a_window_shows_it_and_leaving_it_drops_it(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    fields = {"name": "Day transfer", "element": "transfer", "price": 4.5, "taxed": True, "includes_tax": False, "factor": 1}
    result = await entry.start_subentry_reconfigure_flow(hass, "day")
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {**fields, "timing": "window"})
    assert result["step_id"] == "window"
    defaults = {str(key): key.default() for key in result["data_schema"].schema}
    assert defaults == {"start": "07:00:00", "end": "22:00:00", "weekdays": [], "months": []}
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {"start": "06:00:00", "end": "22:00:00"})
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    assert entry.subentries["day"].data["window"] == {"start": "06:00:00", "end": "22:00:00", "weekdays": [], "months": []}

    result = await entry.start_subentry_reconfigure_flow(hass, "day")
    result = await hass.config_entries.subentries.async_configure(result["flow_id"], {**fields, "timing": "always"})
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    assert "window" not in entry.subentries["day"].data
