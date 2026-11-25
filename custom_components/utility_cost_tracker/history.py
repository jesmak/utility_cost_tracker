"""A site's long-term statistics, written by the integration itself: every item's cost and tax, and the consumption.

They have no entity behind them, so an item's history exists whether or not its sensors are enabled. Each is an hourly
running sum since the site was added, which Home Assistant turns into the change over any hour, day, month or year.
"""

from __future__ import annotations

from homeassistant.components.recorder import get_instance
from homeassistant.components.recorder.models import StatisticData, StatisticMeanType, StatisticMetaData
from homeassistant.components.recorder.statistics import async_add_external_statistics, async_list_statistic_ids
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import CONF_UNIT, DOMAIN
from .tariff import HourSums

COST = "cost"
TAX = "tax"
CONSUMPTION = "consumption"


def statistic_id(entry: ConfigEntry, *parts: str) -> str:
    return f"{DOMAIN}:{'_'.join((entry.entry_id, *parts)).lower()}"


@callback
def async_write(hass: HomeAssistant, entry: ConfigEntry, hours: list[HourSums]) -> None:
    """Write the hours that ended. Without the recorder there is no history, only the current periods."""
    if not hours or "recorder" not in hass.config.components:
        return
    series: dict[str, tuple[str, str | None, list[StatisticData]]] = {}

    def add(key: str, name: str, unit: str | None, hour: HourSums, value: float) -> None:
        rows = series.setdefault(key, (name, unit, []))[2]
        rows.append(StatisticData(start=hour.start, state=value, sum=value))

    currency = hass.config.currency
    for hour in hours:
        for item_id, amount in hour.amounts.items():
            # An item removed since is left as it was: its history stays, and nothing more is written to it.
            if (subentry := entry.subentries.get(item_id)) is None:
                continue
            name = f"{entry.title} {subentry.title}"
            add(statistic_id(entry, item_id, COST), name, currency, hour, amount)
            add(statistic_id(entry, item_id, TAX), f"{name} tax", currency, hour, hour.taxes.get(item_id, 0.0))
        add(statistic_id(entry, CONSUMPTION), f"{entry.title} consumption", entry.data.get(CONF_UNIT), hour, hour.consumed)
    for key, (name, unit, rows) in series.items():
        metadata = StatisticMetaData(
            mean_type=StatisticMeanType.NONE,
            has_sum=True,
            name=name,
            source=DOMAIN,
            statistic_id=key,
            unit_class=None,
            unit_of_measurement=unit,
        )
        async_add_external_statistics(hass, metadata, rows)


async def async_clear(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Remove a removed site's statistics, those of items removed earlier too."""
    if "recorder" not in hass.config.components:
        return
    prefix = statistic_id(entry, "")
    ids = [row["statistic_id"] for row in await async_list_statistic_ids(hass) if row["statistic_id"].startswith(prefix)]
    if ids:
        get_instance(hass).async_clear_statistics(ids)
