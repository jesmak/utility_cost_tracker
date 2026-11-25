"""Utility cost tracker: what electricity, water or gas costs per period, each part of the bill on its own."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .tracker import Tracker

PLATFORMS = [Platform.SENSOR]

type UtilityCostConfigEntry = ConfigEntry[Tracker]


async def async_setup_entry(hass: HomeAssistant, entry: UtilityCostConfigEntry) -> bool:
    tracker = Tracker(hass, entry)
    await tracker.async_start()
    entry.runtime_data = tracker
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: UtilityCostConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        await entry.runtime_data.async_stop()
    return unloaded


async def async_remove_entry(hass: HomeAssistant, entry: UtilityCostConfigEntry) -> None:
    await Tracker(hass, entry).async_remove()


async def async_update_listener(hass: HomeAssistant, entry: UtilityCostConfigEntry) -> None:
    # A changed site, group or part changes which sensors exist, so the entry is set up again from its stored totals.
    await hass.config_entries.async_reload(entry.entry_id)
