"""The websocket command the card reads a site with: its structure and what each followed period has counted so far."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback

from .const import CONF_UTILITY, DOMAIN
from .history import CONSUMPTION, COST, TAX, statistic_id
from .tariff import KIND_FIXED_FEE


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_site)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/site", vol.Required("entry_id"): str})
@callback
def ws_site(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "No such site")
        return
    tracker = entry.runtime_data
    site, ledger = tracker.site, tracker.ledger
    # The running hour is in no statistics until it ends, so the current periods come from the ledger.
    periods = {
        period: {
            "start": ledger.starts[period].isoformat(),
            "consumption": ledger.used.get(period, 0.0),
            "items": {
                item.item_id: {
                    "amount": ledger.amounts.get(period, {}).get(item.item_id, 0.0),
                    "tax": ledger.taxes.get(period, {}).get(item.item_id, 0.0),
                }
                for item in site.items
            },
        }
        for period in site.periods
    }
    connection.send_result(
        msg["id"],
        {
            "name": entry.title,
            "utility": entry.data.get(CONF_UTILITY),
            "currency": hass.config.currency,
            "unit": tracker.meter_unit(),
            "price_unit": tracker.price_unit(),
            # How many of the price unit make one of the currency.
            "price_scale": round(1 / site.scale),
            "elements": [
                {"id": element.element_id, "name": entry.subentries[element.element_id].title, "tax": element.tax}
                for element in site.elements
            ],
            "items": [
                {
                    "id": item.item_id,
                    "element": item.element_id,
                    "name": entry.subentries[item.item_id].title,
                    "kind": item.kind,
                    "fee_period": item.fee_period if item.kind == KIND_FIXED_FEE else None,
                    "cost_statistic": statistic_id(entry, item.item_id, COST),
                    "tax_statistic": statistic_id(entry, item.item_id, TAX),
                }
                for item in site.items
            ],
            "consumption_statistic": statistic_id(entry, CONSUMPTION),
            "periods": periods,
            # The statistics' running sums as they are now, and the hour they began in. A sum less the last one written
            # is what the running hour holds.
            "since": ledger.since.isoformat() if ledger.since else None,
            "sums": {
                item.item_id: {"amount": ledger.sums.get(item.item_id, 0.0), "tax": ledger.tax_sums.get(item.item_id, 0.0)}
                for item in site.items
            },
            "consumed": ledger.consumed,
            "prices": tracker.shown_prices(),
        },
    )
