"""Constants for Utility cost tracker."""

DOMAIN = "utility_cost_tracker"

SUBENTRY_ELEMENT = "element"
SUBENTRY_ITEM = "item"

CONF_UTILITY = "utility"
CONF_CONSUMPTION_ENTITY = "consumption_entity"
CONF_UNIT = "unit"
CONF_FACTOR = "factor"
CONF_PERIODS = "periods"
CONF_PRICE_UNIT = "price_unit"
CONF_HUNDREDTH_SYMBOL = "hundredth_symbol"
CONF_TAX = "tax"
CONF_ELEMENT = "element"
CONF_KIND = "kind"
CONF_PRICE = "price"
CONF_PRICE_ENTITY = "price_entity"
CONF_MULTIPLIER = "multiplier"
CONF_ADDEND = "addend"
CONF_TAXED = "taxed"
CONF_INCLUDES_TAX = "includes_tax"
CONF_TIMING = "timing"
CONF_WINDOW = "window"
CONF_FEE_PERIOD = "fee_period"
CONF_START = "start"
CONF_END = "end"
CONF_WEEKDAYS = "weekdays"
CONF_MONTHS = "months"

DEFAULT_PERIODS = ["day", "month", "year"]

PRICE_UNITS = ("currency", "hundredths")
# Home Assistant knows a currency's code but has no name or symbol for its hundredths, so the user gives one.
DEFAULT_HUNDREDTH_SYMBOL = "c"

# The elements a new site starts with, by its utility. Their names come from the translations.
UTILITIES = {
    "electricity": ("energy", "transfer"),
    "water": ("water", "wastewater"),
    "gas": ("gas", "transfer"),
    "other": ("costs",),
}
ICONS = {"electricity": "mdi:lightning-bolt", "water": "mdi:water", "gas": "mdi:fire", "other": "mdi:cash"}

STORAGE_VERSION = 1
