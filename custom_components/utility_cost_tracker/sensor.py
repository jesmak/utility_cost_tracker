"""Cost sensors per item, element and site for every followed period, and the current price per unit."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigSubentry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import UtilityCostConfigEntry
from .const import CONF_HUNDREDTH_SYMBOL, CONF_PRICE_UNIT, CONF_UNIT, CONF_UTILITY, DEFAULT_HUNDREDTH_SYMBOL, DOMAIN, ICONS
from .tracker import Tracker

ELEMENT_VALUES = ("usage", "usage_with_tax", "tax", "total")
SITE_VALUES = ("tax", "total")
# The breakdowns of an element and the site's tax start disabled, so a site doesn't begin with a sensor for everything.
# Their totals are counted all the same, so one enabled later shows its period so far.
ENABLED_BY_DEFAULT = ("total",)


async def async_setup_entry(hass: HomeAssistant, entry: UtilityCostConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback) -> None:
    tracker = entry.runtime_data
    site = tracker.site
    entities: list[TrackerSensor] = [SiteCost(tracker, period, value) for period in site.periods for value in SITE_VALUES]
    entities.append(SitePrice(tracker))
    for element in site.elements:
        subentry = entry.subentries[element.element_id]
        entities += [ElementCost(tracker, subentry, period, value) for period in site.periods for value in ELEMENT_VALUES]
        entities.append(ElementPrice(tracker, subentry))
    for item in site.items:
        entities += [ItemCost(tracker, entry.subentries[item.item_id], period) for period in site.periods]
    # Every sensor is on the site's one device, as Home Assistant ties a device to a single subentry. So no sensor is
    # tied to a subentry, and the ones a removed item, element or period leaves behind are removed here.
    registry = er.async_get(hass)
    current = {entity.unique_id for entity in entities}
    for registered in er.async_entries_for_config_entry(registry, entry.entry_id):
        if registered.unique_id not in current:
            registry.async_remove(registered.entity_id)
    async_add_entities(entities)


class TrackerSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    _clock = False

    def __init__(self, tracker: Tracker, key: str) -> None:
        entry = tracker.entry
        self._tracker = tracker
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, entry.entry_id)}, name=entry.title)
        self._attr_icon = ICONS.get(entry.data.get(CONF_UTILITY, "other"))

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._tracker.async_add_listener(self._updated, self._clock))

    @callback
    def _updated(self) -> None:
        self.async_write_ha_state()


class CostSensor(TrackerSensor):
    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_state_class = SensorStateClass.TOTAL
    _attr_suggested_display_precision = 2

    def __init__(self, tracker: Tracker, key: str, period: str) -> None:
        super().__init__(tracker, f"{key}_{period}")
        self._period = period
        self._attr_native_unit_of_measurement = tracker.hass.config.currency

    @property
    def last_reset(self) -> datetime | None:
        return self._tracker.ledger.starts.get(self._period)


class SiteCost(CostSensor):
    def __init__(self, tracker: Tracker, period: str, value: str) -> None:
        super().__init__(tracker, value, period)
        self._value = value
        self._attr_translation_key = f"site_{value}_{period}"
        self._attr_entity_registry_enabled_default = value in ENABLED_BY_DEFAULT

    @property
    def native_value(self) -> float:
        totals = self._tracker.ledger.totals(self._period)
        return totals.tax if self._value == "tax" else totals.total


class ElementCost(CostSensor):
    def __init__(self, tracker: Tracker, subentry: ConfigSubentry, period: str, value: str) -> None:
        super().__init__(tracker, f"{subentry.subentry_id}_{value}", period)
        self._element_id = subentry.subentry_id
        self._value = value
        self._attr_translation_key = f"element_{value}_{period}"
        self._attr_entity_registry_enabled_default = value in ENABLED_BY_DEFAULT
        self._attr_translation_placeholders = {"name": subentry.title}

    @property
    def native_value(self) -> float:
        return self._tracker.ledger.totals(self._period).elements[self._element_id][self._value]


class ItemCost(CostSensor):
    def __init__(self, tracker: Tracker, subentry: ConfigSubentry, period: str) -> None:
        super().__init__(tracker, subentry.subentry_id, period)
        self._item_id = subentry.subentry_id
        self._attr_translation_key = f"item_{period}"
        self._attr_translation_placeholders = {"name": subentry.title}

    @property
    def native_value(self) -> float:
        return self._tracker.ledger.totals(self._period).items[self._item_id]


class PriceSensor(TrackerSensor):
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 4
    # A time window's price starts and ends with the clock.
    _clock = True

    def __init__(self, tracker: Tracker, key: str, ref: str) -> None:
        super().__init__(tracker, key)
        self._ref = ref
        self._hundredths = tracker.entry.data.get(CONF_PRICE_UNIT) == "hundredths"

    @property
    def native_unit_of_measurement(self) -> str:
        """The price unit per the meter's unit, read from the meter as it is now, or as it was when the site was saved."""
        tracker = self._tracker
        state = tracker.hass.states.get(tracker.site.consumption_entity)
        unit = (state.attributes.get("unit_of_measurement") if state else None) or tracker.entry.data.get(CONF_UNIT)
        if self._hundredths:
            money = tracker.entry.data.get(CONF_HUNDREDTH_SYMBOL) or DEFAULT_HUNDREDTH_SYMBOL
        else:
            money = tracker.hass.config.currency
        return f"{money}/{unit}" if unit else money

    @property
    def native_value(self) -> float | None:
        """The price in the unit the site's prices are typed in."""
        price = self._tracker.current_prices().get(self._ref)
        return None if price is None else price * 100 if self._hundredths else price


class SitePrice(PriceSensor):
    _attr_translation_key = "site_price"

    def __init__(self, tracker: Tracker) -> None:
        super().__init__(tracker, "price", "total")


class ElementPrice(PriceSensor):
    _attr_translation_key = "element_price"

    def __init__(self, tracker: Tracker, subentry: ConfigSubentry) -> None:
        super().__init__(tracker, f"{subentry.subentry_id}_price", subentry.subentry_id)
        self._attr_translation_placeholders = {"name": subentry.title}
