"""A site's ledger in Home Assistant: the meters it listens to, the clock, and the storage it continues from."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, time
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ADDEND,
    CONF_CONSUMPTION_ENTITY,
    CONF_ELEMENT,
    CONF_END,
    CONF_FACTOR,
    CONF_FEE_PERIOD,
    CONF_HUNDREDTH_SYMBOL,
    CONF_INCLUDES_TAX,
    CONF_KIND,
    CONF_MONTHS,
    CONF_MULTIPLIER,
    CONF_PERIODS,
    CONF_PRICE,
    CONF_PRICE_ENTITY,
    CONF_PRICE_UNIT,
    CONF_START,
    CONF_TAX,
    CONF_TAXED,
    CONF_TIMING,
    CONF_UNIT,
    CONF_WEEKDAYS,
    CONF_WINDOW,
    DEFAULT_HUNDREDTH_SYMBOL,
    DOMAIN,
    STORAGE_VERSION,
    SUBENTRY_ELEMENT,
    SUBENTRY_ITEM,
)
from .history import async_write
from .tariff import PERIODS, TIME_ALWAYS, Element, Item, Ledger, Site, Window

_LOGGER = logging.getLogger(__name__)

# Saving is delayed so a meter that reports every few seconds doesn't write the disk as often. Readings and amounts
# are saved together, so whatever a crash loses is counted again from the stored reading, not lost or doubled.
SAVE_DELAY = 30


def number(state: State | None) -> float | None:
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(state.state)
    except ValueError:
        return None


def window_of(data: dict[str, Any] | None) -> Window | None:
    if not data:
        return None
    return Window(
        start=time.fromisoformat(data[CONF_START]),
        end=time.fromisoformat(data[CONF_END]),
        weekdays=frozenset(int(day) for day in data.get(CONF_WEEKDAYS, [])),
        months=frozenset(int(month) for month in data.get(CONF_MONTHS, [])),
    )


def site_of(entry: ConfigEntry) -> Site:
    elements = tuple(
        Element(subentry.subentry_id, float(subentry.data.get(CONF_TAX, 0)))
        for subentry in entry.subentries.values()
        if subentry.subentry_type == SUBENTRY_ELEMENT
    )
    element_ids = {element.element_id for element in elements}
    items = tuple(
        Item(
            item_id=subentry.subentry_id,
            element_id=subentry.data[CONF_ELEMENT],
            kind=subentry.data[CONF_KIND],
            price=float(subentry.data.get(CONF_PRICE, 0)),
            price_entity=subentry.data.get(CONF_PRICE_ENTITY),
            multiplier=float(subentry.data.get(CONF_MULTIPLIER, 1)),
            addend=float(subentry.data.get(CONF_ADDEND, 0)),
            taxed=bool(subentry.data.get(CONF_TAXED, True)),
            includes_tax=bool(subentry.data.get(CONF_INCLUDES_TAX, False)),
            timing=subentry.data.get(CONF_TIMING, TIME_ALWAYS),
            window=window_of(subentry.data.get(CONF_WINDOW)),
            consumption_entity=subentry.data.get(CONF_CONSUMPTION_ENTITY) or None,
            factor=float(subentry.data.get(CONF_FACTOR, 1)),
            fee_period=subentry.data.get(CONF_FEE_PERIOD, "month"),
        )
        for subentry in entry.subentries.values()
        # An item whose element was removed is left out, and its totals so far are dropped at the next save.
        if subentry.subentry_type == SUBENTRY_ITEM and subentry.data.get(CONF_ELEMENT) in element_ids
    )
    periods = tuple(period for period in PERIODS if period in entry.data[CONF_PERIODS])
    return Site(
        consumption_entity=entry.data[CONF_CONSUMPTION_ENTITY],
        periods=periods,
        factor=float(entry.data.get(CONF_FACTOR, 1)),
        scale=0.01 if entry.data.get(CONF_PRICE_UNIT) == "hundredths" else 1.0,
        elements=elements,
        items=items,
    )


class Tracker:
    """Keeps one site's ledger up to date and tells its sensors when it changes."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.ledger = Ledger(site_of(entry))
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}")
        self._listeners: list[Callable[[], None]] = []
        self._clock_listeners: list[Callable[[], None]] = []
        self._unsubscribe: list[CALLBACK_TYPE] = []
        # The removed items with statistics, looked up once, as removing an item reloads the site.
        self.removed: list[dict[str, str]] | None = None

    @property
    def site(self) -> Site:
        return self.ledger.site

    async def async_start(self) -> None:
        stored = await self._store.async_load()
        if stored:
            self.ledger.load(stored, (item.item_id for item in self.site.items))
        self.ledger.roll(dt_util.now())
        for source in self.site.sources():
            value = number(self.hass.states.get(source))
            if value is not None:
                self.ledger.read(source, value, dt_util.now(), self.sensor_price)
        self._changed()
        watched = self.site.sources() | {item.price_entity for item in self.site.items if item.price_entity}
        if watched:
            self._unsubscribe.append(async_track_state_change_event(self.hass, sorted(watched), self._state_changed))
        # Every minute: periods start on the hour, and a schedule's price may change at any minute.
        self._unsubscribe.append(async_track_time_change(self.hass, self._tick, second=0))

    async def async_stop(self) -> None:
        for unsubscribe in self._unsubscribe:
            unsubscribe()
        self._unsubscribe.clear()
        await self._store.async_save(self.ledger.dump())

    async def async_remove(self) -> None:
        await self._store.async_remove()

    def sensor_price(self, item: Item) -> float | None:
        return number(self.hass.states.get(item.price_entity)) if item.price_entity else None

    def current_prices(self) -> dict[str, float | None]:
        return self.ledger.current_prices(dt_util.now(), self.sensor_price)

    def shown_prices(self) -> dict[str, float | None]:
        """The current prices in the unit the site's prices are typed in."""
        scale = 100 if self.entry.data.get(CONF_PRICE_UNIT) == "hundredths" else 1
        return {key: None if price is None else price * scale for key, price in self.current_prices().items()}

    def meter_unit(self) -> str | None:
        """The meter's unit as it is now, or as it was when the site was saved."""
        state = self.hass.states.get(self.site.consumption_entity)
        return (state.attributes.get("unit_of_measurement") if state else None) or self.entry.data.get(CONF_UNIT)

    def price_unit(self) -> str:
        """The unit of a price per unit: the currency or its hundredths, per the meter's unit."""
        if self.entry.data.get(CONF_PRICE_UNIT) == "hundredths":
            money = self.entry.data.get(CONF_HUNDREDTH_SYMBOL) or DEFAULT_HUNDREDTH_SYMBOL
        else:
            money = self.hass.config.currency
        unit = self.meter_unit()
        return f"{money}/{unit}" if unit else money

    @callback
    def async_add_listener(self, listener: Callable[[], None], clock: bool = False) -> CALLBACK_TYPE:
        """Call the listener when the totals change, and every minute too when it depends on the clock."""
        listeners = self._clock_listeners if clock else self._listeners
        listeners.append(listener)
        return lambda: listeners.remove(listener)

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        if entity_id in self.site.sources():
            value = number(event.data["new_state"])
            if value is not None:
                # Saved even when nothing was priced, as the reading is where the next change is counted from.
                self.ledger.read(entity_id, value, dt_util.now(), self.sensor_price)
                self._changed()
        self._notify()

    @callback
    def _tick(self, moment: datetime) -> None:
        if self.ledger.roll(dt_util.as_local(moment)):
            self._changed()
            self._notify()
        else:
            for listener in list(self._clock_listeners):
                listener()

    def _changed(self) -> None:
        """Save the ledger, and write the hours that have ended into the long-term statistics."""
        async_write(self.hass, self.entry, self.ledger.closed)
        self.ledger.closed.clear()
        self._store.async_delay_save(self.ledger.dump, SAVE_DELAY)

    def _notify(self) -> None:
        for listener in self._listeners + self._clock_listeners:
            listener()
