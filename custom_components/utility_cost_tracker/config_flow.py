"""Setting up a site, and its cost elements and items as subentries."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryData,
    ConfigSubentryFlow,
    SubentryFlowResult,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TimeSelector,
)
from homeassistant.helpers.translation import async_get_translations

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
    CONF_UTILITY,
    CONF_WEEKDAYS,
    CONF_WINDOW,
    DEFAULT_HUNDREDTH_SYMBOL,
    DEFAULT_PERIODS,
    DOMAIN,
    PRICE_UNITS,
    SUBENTRY_ELEMENT,
    SUBENTRY_ITEM,
    UTILITIES,
)
from .tariff import FEE_PERIODS, KIND_CONSTANT, KIND_FIXED_FEE, KIND_SENSOR, PERIODS, TIME_ALWAYS, TIME_OTHER, TIME_WINDOW

SENSOR = EntitySelector(EntitySelectorConfig(domain="sensor"))
DECIMAL = NumberSelector(NumberSelectorConfig(mode=NumberSelectorMode.BOX, step="any"))
TAX = NumberSelector(NumberSelectorConfig(mode=NumberSelectorMode.BOX, min=0, max=100, step="any", unit_of_measurement="%"))


def choice(options: list[str] | tuple[str, ...], key: str, multiple: bool = False, dropdown: bool = True) -> SelectSelector:
    return SelectSelector(
        SelectSelectorConfig(
            options=list(options),
            translation_key=key,
            multiple=multiple,
            mode=SelectSelectorMode.DROPDOWN if dropdown and not multiple else SelectSelectorMode.LIST,
        )
    )


def site_schema(defaults: dict[str, Any], creating: bool) -> vol.Schema:
    fields: dict[Any, Any] = {}
    if creating:
        fields[vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, ""))] = TextSelector()
    fields.update(
        {
            vol.Required(CONF_UTILITY, default=defaults.get(CONF_UTILITY, "electricity")): choice(list(UTILITIES), "utility"),
            vol.Required(CONF_CONSUMPTION_ENTITY, default=defaults.get(CONF_CONSUMPTION_ENTITY)): SENSOR,
            vol.Required(CONF_FACTOR, default=defaults.get(CONF_FACTOR, 1)): DECIMAL,
            vol.Required(CONF_PERIODS, default=defaults.get(CONF_PERIODS, DEFAULT_PERIODS)): choice(PERIODS, "period", True),
            vol.Required(CONF_PRICE_UNIT, default=defaults.get(CONF_PRICE_UNIT, "currency")): choice(PRICE_UNITS, "price_unit"),
            vol.Required(CONF_HUNDREDTH_SYMBOL, default=defaults.get(CONF_HUNDREDTH_SYMBOL, DEFAULT_HUNDREDTH_SYMBOL)): TextSelector(),
        }
    )
    return vol.Schema(fields)


class UtilityCostConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = self._validate(user_input)
            if not errors:
                name = user_input.pop(CONF_NAME)
                return self.async_create_entry(
                    title=name, data=self._with_unit(user_input), subentries=await self._elements(user_input[CONF_UTILITY])
                )
        return self.async_show_form(step_id="user", data_schema=site_schema(user_input or {}, True), errors=errors)

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = self._validate(user_input)
            if not errors:
                # The update listener reloads the entry.
                return self.async_update_and_abort(entry, data=self._with_unit(user_input))
        return self.async_show_form(step_id="reconfigure", data_schema=site_schema(user_input or dict(entry.data), False), errors=errors)

    def _validate(self, user_input: dict[str, Any]) -> dict[str, str]:
        errors: dict[str, str] = {}
        if not user_input[CONF_PERIODS]:
            errors[CONF_PERIODS] = "no_periods"
        if user_input[CONF_FACTOR] <= 0:
            errors[CONF_FACTOR] = "not_positive"
        if user_input[CONF_PRICE_UNIT] == "hundredths" and not user_input[CONF_HUNDREDTH_SYMBOL].strip():
            errors[CONF_HUNDREDTH_SYMBOL] = "no_symbol"
        return errors

    def _with_unit(self, user_input: dict[str, Any]) -> dict[str, Any]:
        """The data with the meter's unit, for the price sensors while the meter has no state."""
        state = self.hass.states.get(user_input[CONF_CONSUMPTION_ENTITY])
        unit = state.attributes.get("unit_of_measurement") if state else None
        return {**user_input, CONF_UNIT: unit}

    async def _elements(self, utility: str) -> list[ConfigSubentryData]:
        """The cost elements a new site of the utility starts with, named in Home Assistant's language."""
        names = await async_get_translations(self.hass, self.hass.config.language, "selector", {DOMAIN})
        prefix = f"component.{DOMAIN}.selector.default_element.options."
        return [
            ConfigSubentryData(subentry_type=SUBENTRY_ELEMENT, title=names.get(prefix + key, key), data={CONF_TAX: 0}, unique_id=None)
            for key in UTILITIES[utility]
        ]

    @classmethod
    @callback
    def async_get_supported_subentry_types(cls, config_entry: ConfigEntry) -> dict[str, type[ConfigSubentryFlow]]:
        return {SUBENTRY_ELEMENT: ElementSubentryFlow, SUBENTRY_ITEM: ItemSubentryFlow}


class ElementSubentryFlow(ConfigSubentryFlow):
    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data={CONF_TAX: user_input[CONF_TAX]})
        return self.async_show_form(step_id="user", data_schema=self._schema({}))

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        if user_input is not None:
            return self.async_update_and_abort(
                self._get_entry(), subentry, title=user_input[CONF_NAME], data={CONF_TAX: user_input[CONF_TAX]}
            )
        return self.async_show_form(step_id="reconfigure", data_schema=self._schema({CONF_NAME: subentry.title, **subentry.data}))

    def _schema(self, defaults: dict[str, Any]) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, "")): TextSelector(),
                vol.Required(CONF_TAX, default=defaults.get(CONF_TAX, 0)): TAX,
            }
        )


class ItemSubentryFlow(ConfigSubentryFlow):
    """An item: its kind first, then its own fields, then its time window when it has one."""

    def __init__(self) -> None:
        self._name = ""
        self._item: dict[str, Any] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        if not self._elements():
            return self.async_abort(reason="no_elements")
        return self.async_show_menu(step_id="user", menu_options=[KIND_CONSTANT, KIND_SENSOR, KIND_FIXED_FEE])

    async def async_step_constant(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        return await self._kind_step(KIND_CONSTANT, KIND_CONSTANT, user_input, {})

    async def async_step_sensor(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        return await self._kind_step(KIND_SENSOR, KIND_SENSOR, user_input, {})

    async def async_step_fixed_fee(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        return await self._kind_step(KIND_FIXED_FEE, KIND_FIXED_FEE, user_input, {})

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        return await self._kind_step("reconfigure", subentry.data[CONF_KIND], user_input, {CONF_NAME: subentry.title, **subentry.data})

    async def async_step_window(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        if user_input is not None:
            self._item[CONF_WINDOW] = {
                CONF_START: user_input[CONF_START],
                CONF_END: user_input[CONF_END],
                CONF_WEEKDAYS: [int(day) for day in user_input.get(CONF_WEEKDAYS, [])],
                CONF_MONTHS: [int(month) for month in user_input.get(CONF_MONTHS, [])],
            }
            return self._finish()
        defaults = self._item.get(CONF_WINDOW) or {}
        if not defaults and self.source == "reconfigure":
            defaults = self._get_reconfigure_subentry().data.get(CONF_WINDOW) or {}
        schema = vol.Schema(
            {
                vol.Required(CONF_START, default=defaults.get(CONF_START, "07:00:00")): TimeSelector(),
                vol.Required(CONF_END, default=defaults.get(CONF_END, "22:00:00")): TimeSelector(),
                vol.Optional(CONF_WEEKDAYS, default=[str(day) for day in defaults.get(CONF_WEEKDAYS, [])]): choice(
                    [str(day) for day in range(7)], "weekday", True
                ),
                vol.Optional(CONF_MONTHS, default=[str(month) for month in defaults.get(CONF_MONTHS, [])]): choice(
                    [str(month) for month in range(1, 13)], "month", True
                ),
            }
        )
        return self.async_show_form(step_id="window", data_schema=schema)

    async def _kind_step(self, step_id: str, kind: str, user_input: dict[str, Any] | None, defaults: dict[str, Any]) -> SubentryFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            if user_input.get(CONF_INCLUDES_TAX) and not user_input.get(CONF_TAXED):
                errors[CONF_INCLUDES_TAX] = "includes_untaxed"
            else:
                values = dict(user_input)
                self._name = values.pop(CONF_NAME)
                self._item = {CONF_KIND: kind, **values}
                if values.get(CONF_TIMING) == TIME_WINDOW:
                    return await self.async_step_window()
                return self._finish()
        return self.async_show_form(step_id=step_id, data_schema=self._schema(kind, user_input or defaults), errors=errors)

    def _finish(self) -> SubentryFlowResult:
        data = dict(self._item)
        if data.get(CONF_TIMING) != TIME_WINDOW:
            data.pop(CONF_WINDOW, None)
        if self.source == "reconfigure":
            return self.async_update_and_abort(self._get_entry(), self._get_reconfigure_subentry(), title=self._name, data=data)
        return self.async_create_entry(title=self._name, data=data)

    def _elements(self) -> dict[str, str]:
        entry = self._get_entry()
        return {sub.subentry_id: sub.title for sub in entry.subentries.values() if sub.subentry_type == SUBENTRY_ELEMENT}

    def _schema(self, kind: str, defaults: dict[str, Any]) -> vol.Schema:
        elements = self._elements()
        element_selector = SelectSelector(SelectSelectorConfig(options=[{"value": key, "label": title} for key, title in elements.items()]))
        fields: dict[Any, Any] = {
            vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, "")): TextSelector(),
            # An item whose element was removed defaults to the first one left.
            vol.Required(
                CONF_ELEMENT, default=element if (element := defaults.get(CONF_ELEMENT)) in elements else next(iter(elements), None)
            ): element_selector,
        }
        if kind == KIND_SENSOR:
            fields[vol.Required(CONF_PRICE_ENTITY, default=defaults.get(CONF_PRICE_ENTITY))] = SENSOR
            fields[vol.Required(CONF_MULTIPLIER, default=defaults.get(CONF_MULTIPLIER, 1))] = DECIMAL
            fields[vol.Required(CONF_ADDEND, default=defaults.get(CONF_ADDEND, 0))] = DECIMAL
        else:
            fields[vol.Required(CONF_PRICE, default=defaults.get(CONF_PRICE, 0))] = DECIMAL
        if kind == KIND_FIXED_FEE:
            fields[vol.Required(CONF_FEE_PERIOD, default=defaults.get(CONF_FEE_PERIOD, "month"))] = choice(FEE_PERIODS, "fee_period")
        fields[vol.Required(CONF_TAXED, default=defaults.get(CONF_TAXED, True))] = BooleanSelector()
        fields[vol.Required(CONF_INCLUDES_TAX, default=defaults.get(CONF_INCLUDES_TAX, False))] = BooleanSelector()
        if kind != KIND_FIXED_FEE:
            timings = [TIME_ALWAYS, TIME_WINDOW, TIME_OTHER]
            fields[vol.Required(CONF_TIMING, default=defaults.get(CONF_TIMING, TIME_ALWAYS))] = choice(timings, "timing", dropdown=False)
            # A suggested value rather than a default, so the field can be emptied to read the site's meter again.
            entity = defaults.get(CONF_CONSUMPTION_ENTITY)
            fields[vol.Optional(CONF_CONSUMPTION_ENTITY, description={"suggested_value": entity})] = SENSOR
            fields[vol.Required(CONF_FACTOR, default=defaults.get(CONF_FACTOR, 1))] = DECIMAL
        return vol.Schema(fields)
