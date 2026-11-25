"""The bill's arithmetic, with made-up prices."""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest

from custom_components.utility_cost_tracker.tariff import (
    KIND_CONSTANT,
    KIND_FIXED_FEE,
    KIND_SENSOR,
    PERIODS,
    TIME_OTHER,
    TIME_WINDOW,
    Element,
    Item,
    Ledger,
    Site,
    Window,
    period_start,
)

TZ = ZoneInfo("Europe/Helsinki")
METER = "sensor.meter"
DAY = Window(time(7), time(22))
WINTER_WEEKDAY = Window(time(7), time(22), weekdays=frozenset(range(6)), months=frozenset({11, 12, 1, 2, 3}))


def at(*args: int) -> datetime:
    return datetime(*args, tzinfo=TZ)


def no_sensor(item: Item) -> float | None:
    return None


def site(*items: Item, elements: tuple[Element, ...] = (Element("energy", 25.5), Element("transfer", 25.5)), **kwargs) -> Site:
    return Site(consumption_entity=METER, periods=PERIODS, elements=elements, items=items, **kwargs)


def readings(ledger: Ledger, *steps: tuple[datetime, float], prices=no_sensor) -> None:
    for moment, value in steps:
        ledger.read(METER, value, moment, prices)


def test_period_starts() -> None:
    moment = at(2026, 11, 25, 9, 44, 58)
    assert period_start("hour", moment) == at(2026, 11, 25, 9)
    assert period_start("day", moment) == at(2026, 11, 25)
    assert period_start("week", moment) == at(2026, 11, 23)
    assert period_start("month", moment) == at(2026, 11, 1)
    assert period_start("year", moment) == at(2026, 1, 1)


def test_week_start_across_a_month_and_a_daylight_saving_change() -> None:
    # Summer time ends on Sunday 2026-10-25, so the Monday before is in summer time and the moment in winter time.
    start = period_start("week", at(2026, 10, 25, 12))
    assert start == at(2026, 10, 19)
    assert start.utcoffset() != at(2026, 10, 25, 12).utcoffset()
    assert period_start("week", at(2026, 12, 2, 12)) == at(2026, 11, 30)


def test_windows() -> None:
    night = Window(time(22), time(7))
    assert DAY.matches(at(2026, 11, 25, 7))
    assert not DAY.matches(at(2026, 11, 25, 22))
    assert night.matches(at(2026, 11, 25, 23, 30))
    assert night.matches(at(2026, 11, 25, 6, 59))
    assert not night.matches(at(2026, 11, 25, 12))
    assert WINTER_WEEKDAY.matches(at(2026, 11, 28, 12))  # a Saturday
    assert not WINTER_WEEKDAY.matches(at(2026, 11, 29, 12))  # a Sunday
    assert not WINTER_WEEKDAY.matches(at(2026, 4, 1, 12))
    assert Window(time(0), time(0)).matches(at(2026, 11, 25, 15))


def test_the_first_reading_only_sets_the_start() -> None:
    ledger = Ledger(site(Item("m", "energy", KIND_CONSTANT, price=0.2), scale=0.01))
    assert not ledger.read(METER, 1000.0, at(2026, 11, 25, 9), no_sensor)
    assert ledger.totals("day").items["m"] == 0
    assert ledger.readings[METER] == 1000.0


def test_day_and_night_as_a_window_and_other_times() -> None:
    day = Item("day", "transfer", KIND_CONSTANT, price=3.0, timing=TIME_WINDOW, window=DAY)
    night = Item("night", "transfer", KIND_CONSTANT, price=2.0, timing=TIME_OTHER)
    ledger = Ledger(site(day, night, scale=0.01))
    readings(ledger, (at(2026, 11, 25, 21, 50), 1000.0), (at(2026, 11, 25, 21, 59), 1002.0), (at(2026, 11, 25, 22, 10), 1003.0))
    totals = ledger.totals("day")
    assert totals.items == pytest.approx({"day": 0.06, "night": 0.02})
    assert totals.elements["transfer"]["usage"] == pytest.approx(0.08)


def test_a_seasonal_tariff() -> None:
    winter = Item("winter", "transfer", KIND_CONSTANT, price=4.0, timing=TIME_WINDOW, window=WINTER_WEEKDAY)
    other = Item("other", "transfer", KIND_CONSTANT, price=1.0, timing=TIME_OTHER)
    ledger = Ledger(site(winter, other))
    readings(
        ledger,
        (at(2026, 11, 28, 11), 0.0),
        (at(2026, 11, 28, 12), 1.0),  # Saturday daytime in November
        (at(2026, 11, 29, 12), 2.0),  # Sunday
        (at(2026, 11, 30, 23), 3.0),  # Monday night
    )
    assert ledger.totals("month").items == {"winter": 4.0, "other": 2.0}


def test_other_times_only_looks_at_its_own_element() -> None:
    day_energy = Item("day_energy", "energy", KIND_CONSTANT, price=10.0, timing=TIME_WINDOW, window=DAY)
    other_transfer = Item("other", "transfer", KIND_CONSTANT, price=1.0, timing=TIME_OTHER)
    ledger = Ledger(site(day_energy, other_transfer))
    readings(ledger, (at(2026, 11, 25, 12), 0.0), (at(2026, 11, 25, 12, 15), 1.0))
    assert ledger.totals("day").items == {"day_energy": 10.0, "other": 1.0}


def test_a_sensor_price_with_multiplier_and_addend() -> None:
    spot = Item("s", "energy", KIND_SENSOR, price_entity="sensor.spot", multiplier=100, addend=0.1877)
    ledger = Ledger(site(spot, scale=0.01))
    readings(ledger, (at(2026, 11, 25, 9), 10.0), (at(2026, 11, 25, 9, 15), 11.0), prices=lambda item: 0.2)
    assert ledger.totals("day").items["s"] == pytest.approx(0.201877)


def test_prices_that_include_the_tax_are_kept_before_it_and_a_fee_is_in_the_currency() -> None:
    margin = Item("margin", "energy", KIND_CONSTANT, price=0.236, includes_tax=True)
    fee = Item("fee", "energy", KIND_FIXED_FEE, price=3.04, includes_tax=True)
    ledger = Ledger(site(margin, fee, scale=0.01))
    ledger.roll(at(2026, 11, 25, 9))
    readings(ledger, (at(2026, 11, 25, 9), 0.0), (at(2026, 11, 25, 9, 15), 100.0))
    totals = ledger.totals("month")
    assert totals.items["margin"] == pytest.approx(0.236 / 1.255)
    assert totals.items["fee"] == pytest.approx(3.04 / 1.255)
    assert totals.elements["energy"]["total"] == pytest.approx(0.236 + 3.04)


def test_an_untaxed_item_gets_no_tax() -> None:
    taxed = Item("taxed", "energy", KIND_CONSTANT, price=1.0)
    untaxed = Item("untaxed", "energy", KIND_CONSTANT, price=1.0, taxed=False)
    ledger = Ledger(site(taxed, untaxed, elements=(Element("energy", 10),)))
    readings(ledger, (at(2026, 11, 25, 9), 0.0), (at(2026, 11, 25, 9, 15), 1.0))
    assert ledger.totals("day").elements["energy"] == pytest.approx({"usage": 2.0, "usage_with_tax": 2.1, "tax": 0.1, "total": 2.1})


def test_a_missing_sensor_price_falls_back_to_the_last_known_one() -> None:
    spot = Item("s", "energy", KIND_SENSOR, price_entity="sensor.spot")
    ledger = Ledger(site(spot))
    readings(ledger, (at(2026, 11, 25, 9), 10.0), (at(2026, 11, 25, 9, 15), 11.0), prices=lambda item: 0.25)
    readings(ledger, (at(2026, 11, 25, 9, 30), 12.0))
    assert ledger.totals("day").items["s"] == pytest.approx(0.5)


def test_consumption_without_any_known_price_is_not_counted() -> None:
    ledger = Ledger(site(Item("s", "energy", KIND_SENSOR, price_entity="sensor.spot")))
    ledger.read(METER, 10.0, at(2026, 11, 25, 9), no_sensor)
    assert not ledger.read(METER, 11.0, at(2026, 11, 25, 9, 15), no_sensor)
    assert ledger.totals("day").items["s"] == 0


def test_a_meter_reset_counts_the_new_reading_and_jitter_is_ignored() -> None:
    ledger = Ledger(site(Item("m", "energy", KIND_CONSTANT, price=1.0)))
    ledger.read(METER, 100.0, at(2026, 11, 25, 9), no_sensor)
    assert not ledger.read(METER, 99.5, at(2026, 11, 25, 9, 1), no_sensor)
    readings(ledger, (at(2026, 11, 25, 9, 2), 101.0), (at(2026, 11, 25, 9, 3), 2.0))
    assert ledger.totals("day").items["m"] == pytest.approx(3.0)


def test_factors_and_an_item_with_its_own_meter() -> None:
    water = Item("w", "water", KIND_CONSTANT, price=2.0)
    wastewater = Item("ww", "water", KIND_CONSTANT, price=3.0, factor=0.9)
    garden = Item("g", "water", KIND_CONSTANT, price=1.0, consumption_entity="sensor.garden", factor=2.0)
    ledger = Ledger(site(water, wastewater, garden, elements=(Element("water"),), factor=0.001))
    for source, value in ((METER, 1000.0), ("sensor.garden", 5.0), (METER, 3000.0), ("sensor.garden", 6.0)):
        ledger.read(source, value, at(2026, 11, 25, 9), no_sensor)
    items = ledger.totals("day").items
    assert items["w"] == pytest.approx(2 * 2.0)
    assert items["ww"] == pytest.approx(2 * 0.9 * 3.0)
    assert items["g"] == pytest.approx(1 * 2.0 * 1.0)


def test_periods_start_over() -> None:
    ledger = Ledger(site(Item("m", "energy", KIND_CONSTANT, price=1.0)))
    readings(ledger, (at(2026, 11, 30, 23, 30), 0.0), (at(2026, 11, 30, 23, 45), 1.0), (at(2026, 12, 1, 0, 15), 3.0))
    assert ledger.totals("hour").items["m"] == 2.0
    assert ledger.totals("day").items["m"] == 2.0
    assert ledger.totals("week").items["m"] == 3.0
    assert ledger.totals("month").items["m"] == 2.0
    assert ledger.totals("year").items["m"] == 3.0
    assert ledger.starts["month"] == at(2026, 12, 1)
    assert ledger.totals("day").tax == pytest.approx(2.0 * 0.255)
    assert ledger.totals("month").tax == pytest.approx(2.0 * 0.255)


def test_fixed_fees_go_in_whole_at_the_start_of_their_period_and_only_into_periods_as_long() -> None:
    monthly = Item("basic", "transfer", KIND_FIXED_FEE, price=10.0, fee_period="month")
    daily = Item("standing", "energy", KIND_FIXED_FEE, price=0.5, fee_period="day")
    ledger = Ledger(site(monthly, daily))
    ledger.roll(at(2026, 11, 25, 9))
    ledger.roll(at(2026, 11, 25, 10))
    ledger.roll(at(2026, 11, 26, 0))
    assert ledger.totals("hour").items == {"basic": 0.0, "standing": 0.0}
    assert ledger.totals("day").items == {"basic": 0.0, "standing": 0.5}
    assert ledger.totals("week").items == {"basic": 0.0, "standing": 1.0}
    assert ledger.totals("month").items == {"basic": 10.0, "standing": 1.0}
    ledger.roll(at(2026, 12, 1, 0))
    assert ledger.totals("month").items == {"basic": 10.0, "standing": 0.5}
    assert ledger.totals("year").items == {"basic": 20.0, "standing": 1.5}


def test_totals_and_taxes_per_element() -> None:
    margin = Item("margin", "energy", KIND_CONSTANT, price=1.0)
    transfer = Item("transfer", "transfer", KIND_CONSTANT, price=2.0)
    basic = Item("basic", "transfer", KIND_FIXED_FEE, price=4.0)
    ledger = Ledger(site(margin, transfer, basic, elements=(Element("energy", 10), Element("transfer", 50))))
    readings(ledger, (at(2026, 11, 25, 9), 0.0), (at(2026, 11, 25, 9, 15), 1.0))
    totals = ledger.totals("month")
    assert totals.elements["energy"] == pytest.approx({"usage": 1.0, "usage_with_tax": 1.1, "tax": 0.1, "total": 1.1})
    assert totals.elements["transfer"] == pytest.approx({"usage": 2.0, "usage_with_tax": 3.0, "tax": 3.0, "total": 9.0})
    assert totals.tax == pytest.approx(3.1)
    assert totals.total == pytest.approx(10.1)


def test_current_prices() -> None:
    spot = Item("spot", "energy", KIND_SENSOR, price_entity="sensor.spot", multiplier=100)
    margin = Item("margin", "energy", KIND_CONSTANT, price=0.236, includes_tax=True)
    day = Item("day", "transfer", KIND_CONSTANT, price=3.0, timing=TIME_WINDOW, window=DAY)
    night = Item("night", "transfer", KIND_CONSTANT, price=2.0, timing=TIME_OTHER)
    garden = Item("garden", "transfer", KIND_CONSTANT, price=9.0, consumption_entity="sensor.garden")
    ledger = Ledger(site(spot, margin, day, night, garden, scale=0.01))
    prices = ledger.current_prices(at(2026, 11, 25, 12), lambda item: 0.2)
    assert prices["energy"] == pytest.approx(0.2 * 1.255 + 0.00236)
    assert prices["transfer"] == pytest.approx(0.03 * 1.255)
    assert prices["total"] == pytest.approx(prices["energy"] + prices["transfer"])
    assert ledger.current_prices(at(2026, 11, 25, 23), lambda item: 0.2)["transfer"] == pytest.approx(0.02 * 1.255)
    unknown = Ledger(site(spot)).current_prices(at(2026, 11, 25, 12), no_sensor)
    assert unknown["energy"] is None
    assert unknown["total"] is None


def test_dump_and_load_continue_where_they_left_and_drop_removed_items() -> None:
    fee = Item("basic", "transfer", KIND_FIXED_FEE, price=4.0)
    ledger = Ledger(site(Item("m", "energy", KIND_CONSTANT, price=1.0), fee))
    readings(ledger, (at(2026, 11, 25, 9), 0.0), (at(2026, 11, 25, 9, 15), 2.0))
    data = ledger.dump()
    data["amounts"]["day"]["gone"] = 7.0
    data["taxes"]["day"]["gone"] = 1.0

    restored = Ledger(ledger.site)
    restored.load(data, ("m", "basic"))
    assert not restored.roll(at(2026, 11, 25, 9, 30))
    restored.read(METER, 3.0, at(2026, 11, 25, 9, 45), no_sensor)
    assert restored.totals("month").items == {"m": 3.0, "basic": 4.0}
    assert "gone" not in restored.amounts["day"]
    assert "gone" not in restored.taxes["day"]


def test_a_changed_tax_rate_applies_only_from_then_on() -> None:
    margin = Item("m", "energy", KIND_CONSTANT, price=1.0)
    ledger = Ledger(site(margin, elements=(Element("energy", 24),)))
    readings(ledger, (at(2026, 8, 31, 12), 0.0), (at(2026, 8, 31, 13), 1.0))
    changed = Ledger(site(margin, elements=(Element("energy", 25.5),)))
    changed.load(ledger.dump(), ("m",))
    readings(changed, (at(2026, 9, 1, 12), 2.0))
    assert changed.totals("year").elements["energy"]["tax"] == pytest.approx(0.24 + 0.255)
    assert changed.totals("year").total == pytest.approx(2.495)


def test_the_hour_repeated_when_summer_time_ends_is_an_hour_of_its_own() -> None:
    # Summer time ends at 04:00 on 2026-10-25, and the clock runs 03:00 to 04:00 twice.
    first = datetime(2026, 10, 25, 3, 30, tzinfo=TZ)
    second = datetime(2026, 10, 25, 3, 30, fold=1, tzinfo=TZ)
    ledger = Ledger(site(Item("m", "energy", KIND_CONSTANT, price=1.0)))
    readings(ledger, (first, 0.0), (first.replace(minute=45), 1.0), (second, 3.0))
    assert ledger.totals("hour").items["m"] == 2.0
    assert ledger.totals("day").items["m"] == 3.0


def test_running_sums_never_start_over_and_an_ended_hour_is_handed_out_once() -> None:
    fee = Item("fee", "energy", KIND_FIXED_FEE, price=10, fee_period="day")
    ledger = Ledger(site(Item("energy", "energy", KIND_CONSTANT, price=2), fee))
    readings(ledger, (at(2026, 11, 25, 22, 10), 100), (at(2026, 11, 25, 22, 50), 101))
    assert ledger.closed == []
    # The next reading is past midnight: the hour that ended has the first day's fee and consumption, not the second's.
    readings(ledger, (at(2026, 11, 26, 0, 20), 103))
    (hour,) = ledger.closed
    assert hour.start == at(2026, 11, 25, 22)
    assert hour.amounts == pytest.approx({"energy": 2, "fee": 10})
    assert hour.taxes == pytest.approx({"energy": 0.51, "fee": 2.55})
    assert hour.consumed == pytest.approx(1)
    assert ledger.sums == pytest.approx({"energy": 6, "fee": 20})
    assert ledger.consumed == pytest.approx(3)
    assert ledger.totals("day").items == pytest.approx({"energy": 4, "fee": 10})
    assert ledger.used["day"] == pytest.approx(2)
    assert ledger.used["month"] == pytest.approx(3)


def test_only_the_sites_own_meter_is_its_consumption() -> None:
    charger = Item("charger", "energy", KIND_CONSTANT, price=1, consumption_entity="sensor.charger")
    ledger = Ledger(site(Item("energy", "energy", KIND_CONSTANT, price=2), charger))
    moment = at(2026, 11, 25, 12)
    readings(ledger, (moment, 100), (moment, 104))
    ledger.read("sensor.charger", 10, moment, no_sensor)
    ledger.read("sensor.charger", 13, moment, no_sensor)
    assert ledger.consumed == pytest.approx(4)
    assert ledger.sums == pytest.approx({"energy": 8, "charger": 3})


def test_the_running_sums_continue_from_storage() -> None:
    ledger = Ledger(site(Item("energy", "energy", KIND_CONSTANT, price=2)))
    readings(ledger, (at(2026, 11, 25, 12), 100), (at(2026, 11, 25, 12, 30), 101))
    restored = Ledger(ledger.site)
    restored.load(ledger.dump(), ["energy"])
    readings(restored, (at(2026, 11, 25, 13, 5), 102))
    (hour,) = restored.closed
    assert (hour.start, hour.amounts, hour.consumed) == (at(2026, 11, 25, 12), pytest.approx({"energy": 2}), pytest.approx(1))
    assert restored.sums == pytest.approx({"energy": 4})


def test_storage_from_before_the_running_sums_loads_and_the_sums_start_from_there() -> None:
    old = Ledger(site(Item("energy", "energy", KIND_CONSTANT, price=2)))
    readings(old, (at(2026, 11, 25, 12), 100), (at(2026, 11, 25, 12, 30), 101))
    stored = {key: value for key, value in old.dump().items() if key not in ("used", "sums", "tax_sums", "consumed", "since", "hour")}
    ledger = Ledger(old.site)
    ledger.load(stored, ["energy"])
    readings(ledger, (at(2026, 11, 25, 12, 40), 102), (at(2026, 11, 25, 13, 5), 103))
    # The day's total holds what was counted before, the sums and the history only what came after.
    assert ledger.totals("day").items == pytest.approx({"energy": 6})
    assert ledger.since == at(2026, 11, 25, 12)
    (hour,) = ledger.closed
    assert (hour.start, hour.amounts, hour.consumed) == (at(2026, 11, 25, 12), pytest.approx({"energy": 2}), pytest.approx(1))
    assert ledger.sums == pytest.approx({"energy": 4})


def test_consumption_of_a_period_no_longer_followed_is_dropped_from_storage() -> None:
    ledger = Ledger(site(Item("energy", "energy", KIND_CONSTANT, price=2)))
    readings(ledger, (at(2026, 11, 25, 12), 100), (at(2026, 11, 25, 12, 30), 101))
    fewer = Ledger(Site(consumption_entity=METER, periods=("day",), elements=ledger.site.elements, items=ledger.site.items))
    fewer.load(ledger.dump(), ["energy"])
    assert fewer.used == pytest.approx({"day": 1})
