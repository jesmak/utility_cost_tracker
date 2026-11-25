"""The bill's arithmetic, free of Home Assistant: prices, time windows, periods, and the running totals of a site.

A site's bill is made of cost elements, each with a tax rate, and each element of items: unit prices (a price per unit
of consumption) or fixed fees. Every amount is kept before tax, per item and per followed period, with the tax on it at
the rate in force when it was counted, so a changed rate doesn't rewrite what was already counted.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, time, timedelta
from typing import Any

PERIODS = ("hour", "day", "week", "month", "year")
FEE_PERIODS = ("day", "month", "year")

KIND_CONSTANT = "constant"
KIND_SENSOR = "sensor"
KIND_FIXED_FEE = "fixed_fee"
UNIT_KINDS = (KIND_CONSTANT, KIND_SENSOR)

TIME_ALWAYS = "always"
TIME_WINDOW = "window"
TIME_OTHER = "other_times"

# A drop of more than this share of the previous reading is a meter reset. A smaller one is jitter and is ignored.
RESET_DROP = 0.1


def period_start(period: str, moment: datetime) -> datetime:
    """The start of the period that contains the moment, in the moment's own time zone."""
    if period == "hour":
        return moment.replace(minute=0, second=0, microsecond=0)
    day = moment.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        return day
    if period == "week":
        monday = day.date() - timedelta(days=day.weekday())
        return day.replace(year=monday.year, month=monday.month, day=monday.day)
    if period == "month":
        return day.replace(day=1)
    if period == "year":
        return day.replace(month=1, day=1)
    raise ValueError(f"Unknown period {period}")


def covers(period: str, fee_period: str) -> bool:
    """Whether a fee charged per fee_period shows in the totals of period: only in its own period and longer ones."""
    return PERIODS.index(period) >= PERIODS.index(fee_period)


@dataclass(frozen=True)
class Window:
    """When an item applies. Empty weekdays (0 is Monday) or months mean all of them."""

    start: time
    end: time
    weekdays: frozenset[int] = frozenset()
    months: frozenset[int] = frozenset()

    def matches(self, moment: datetime) -> bool:
        if self.weekdays and moment.weekday() not in self.weekdays:
            return False
        if self.months and moment.month not in self.months:
            return False
        now = moment.time()
        if self.start == self.end:
            return True
        if self.start < self.end:
            return self.start <= now < self.end
        return now >= self.start or now < self.end


@dataclass(frozen=True)
class Item:
    """One line of the bill, its price in the site's price unit as entered."""

    item_id: str
    element_id: str
    kind: str
    price: float = 0.0
    price_entity: str | None = None
    multiplier: float = 1.0
    addend: float = 0.0
    taxed: bool = True
    includes_tax: bool = False
    timing: str = TIME_ALWAYS
    window: Window | None = None
    consumption_entity: str | None = None
    factor: float = 1.0
    fee_period: str = "month"

    def entered_price(self, sensor_price: float | None) -> float | None:
        """The price per unit or the fee as entered, or None when a sensor's price isn't known."""
        if self.kind == KIND_SENSOR:
            return None if sensor_price is None else sensor_price * self.multiplier + self.addend
        return self.price


@dataclass(frozen=True)
class Element:
    element_id: str
    tax: float = 0.0


@dataclass(frozen=True)
class Site:
    consumption_entity: str
    periods: tuple[str, ...]
    factor: float = 1.0
    # Prices per unit are entered in the currency's hundredths (cents or öre per kWh) when this is 0.01.
    scale: float = 1.0
    elements: tuple[Element, ...] = ()
    items: tuple[Item, ...] = ()

    def source_of(self, item: Item) -> str:
        return item.consumption_entity or self.consumption_entity

    def sources(self) -> set[str]:
        return {self.source_of(item) for item in self.items if item.kind in UNIT_KINDS}

    def consumption_factor(self, item: Item) -> float:
        """The factor from the source's reading to the units the item is priced in."""
        site_factor = self.factor if item.consumption_entity is None else 1.0
        return site_factor * item.factor

    def tax_rate(self, item: Item) -> float:
        """The share of tax on the item's price before tax, 0 for an untaxed item."""
        if not item.taxed:
            return 0.0
        element = next(element for element in self.elements if element.element_id == item.element_id)
        return element.tax / 100

    def before_tax(self, item: Item, price: float) -> float:
        """The entered price as currency before tax. A fixed fee is always entered in the currency."""
        if item.kind in UNIT_KINDS:
            price *= self.scale
        return price / (1 + self.tax_rate(item)) if item.includes_tax else price

    def applies(self, item: Item, moment: datetime) -> bool:
        """Whether a unit price is in force: always, in its window, or when no windowed item of its element is."""
        if item.timing == TIME_WINDOW:
            return item.window is not None and item.window.matches(moment)
        if item.timing == TIME_OTHER:
            return not any(
                other.element_id == item.element_id and other.timing == TIME_WINDOW and self.applies(other, moment) for other in self.items
            )
        return True


@dataclass
class Totals:
    """A period's totals in the currency, from the items' amounts before tax and the tax counted on them."""

    items: dict[str, float]
    elements: dict[str, dict[str, float]]
    tax: float
    total: float


@dataclass
class Ledger:
    """The running totals of one site, and what it needs to remember to continue them after a restart."""

    site: Site
    readings: dict[str, float] = field(default_factory=dict)
    starts: dict[str, datetime] = field(default_factory=dict)
    amounts: dict[str, dict[str, float]] = field(default_factory=dict)
    taxes: dict[str, dict[str, float]] = field(default_factory=dict)
    charged: dict[str, str] = field(default_factory=dict)
    prices: dict[str, float] = field(default_factory=dict)

    def roll(self, moment: datetime) -> bool:
        """Start new periods and charge the fees due at the moment. Returns whether anything changed."""
        changed = False
        for period in self.site.periods:
            start = period_start(period, moment)
            previous = self.starts.get(period)
            # Compared in UTC: within one time zone Python ignores fold, so the hour repeated when summer time ends
            # would otherwise equal the first one.
            if previous is None or previous.astimezone(UTC) != start.astimezone(UTC):
                self.starts[period] = start
                self.amounts[period] = {}
                self.taxes[period] = {}
                changed = True
        for item in self.site.items:
            if item.kind != KIND_FIXED_FEE:
                continue
            due = period_start(item.fee_period, moment).isoformat()
            if self.charged.get(item.item_id) == due:
                continue
            self.charged[item.item_id] = due
            amount = self.site.before_tax(item, item.price)
            for period in self.site.periods:
                if covers(period, item.fee_period):
                    self._add(period, item, amount)
            changed = True
        return changed

    def read(self, source: str, value: float, moment: datetime, sensor_prices: Callable[[Item], float | None]) -> bool:
        """Count a new reading of a consumption source. Returns whether any amount changed."""
        previous = self.readings.get(source)
        if previous is not None and value < previous and value >= previous * (1 - RESET_DROP):
            return False
        self.readings[source] = value
        if previous is None:
            return False
        delta = value if value < previous else value - previous
        if delta == 0:
            return False
        self.roll(moment)
        changed = False
        for item in self.site.items:
            if item.kind not in UNIT_KINDS or self.site.source_of(item) != source or not self.site.applies(item, moment):
                continue
            price = self.price_of(item, sensor_prices)
            if price is None:
                continue
            amount = delta * self.site.consumption_factor(item) * self.site.before_tax(item, price)
            for period in self.site.periods:
                self._add(period, item, amount)
            changed = True
        return changed

    def price_of(self, item: Item, sensor_prices: Callable[[Item], float | None]) -> float | None:
        """An item's price as entered, falling back to a sensor's last known price while the sensor has none."""
        sensor_price = None
        if item.kind == KIND_SENSOR:
            sensor_price = sensor_prices(item)
            if sensor_price is None:
                sensor_price = self.prices.get(item.item_id)
            else:
                self.prices[item.item_id] = sensor_price
        return item.entered_price(sensor_price)

    def totals(self, period: str) -> Totals:
        amounts = self.amounts.get(period, {})
        taxes = self.taxes.get(period, {})
        items = {item.item_id: amounts.get(item.item_id, 0.0) for item in self.site.items}
        elements: dict[str, dict[str, float]] = {}
        for element in self.site.elements:
            members = [item for item in self.site.items if item.element_id == element.element_id]
            usage = [item for item in members if item.kind in UNIT_KINDS]
            usage_before_tax = sum(items[item.item_id] for item in usage)
            usage_tax = sum(taxes.get(item.item_id, 0.0) for item in usage)
            tax = sum(taxes.get(item.item_id, 0.0) for item in members)
            elements[element.element_id] = {
                "usage": usage_before_tax,
                "usage_with_tax": usage_before_tax + usage_tax,
                "tax": tax,
                "total": sum(items[item.item_id] for item in members) + tax,
            }
        tax = sum(values["tax"] for values in elements.values())
        total = sum(values["total"] for values in elements.values())
        return Totals(items=items, elements=elements, tax=tax, total=total)

    def current_prices(self, moment: datetime, sensor_prices: Callable[[Item], float | None]) -> dict[str, float | None]:
        """The price per unit of the site's own meter now, with tax, per element and as "total", in the currency.

        An element whose price can't be known (a sensor without a price yet) is None, and so is the total then.
        """
        prices: dict[str, float | None] = {}
        for element in self.site.elements:
            price: float | None = 0.0
            for item in self.site.items:
                if item.element_id != element.element_id or item.kind not in UNIT_KINDS or item.consumption_entity:
                    continue
                if not self.site.applies(item, moment):
                    continue
                entered = self.price_of(item, sensor_prices)
                if entered is None or price is None:
                    price = None
                    continue
                unit = self.site.before_tax(item, entered) * (1 + self.site.tax_rate(item))
                price += unit * self.site.factor * item.factor
            prices[element.element_id] = price
        values = list(prices.values())
        prices["total"] = None if None in values else sum(value for value in values if value is not None)
        return prices

    def _add(self, period: str, item: Item, amount: float) -> None:
        """Add an amount before tax, and the tax on it at the rate in force now."""
        amounts = self.amounts.setdefault(period, {})
        amounts[item.item_id] = amounts.get(item.item_id, 0.0) + amount
        taxes = self.taxes.setdefault(period, {})
        taxes[item.item_id] = taxes.get(item.item_id, 0.0) + amount * self.site.tax_rate(item)

    def dump(self) -> dict[str, Any]:
        return {
            "readings": self.readings,
            "starts": {period: start.isoformat() for period, start in self.starts.items()},
            "amounts": self.amounts,
            "taxes": self.taxes,
            "charged": self.charged,
            "prices": self.prices,
        }

    def load(self, data: dict[str, Any], known_items: Iterable[str]) -> None:
        """Continue from stored totals. Amounts of items no longer in the site are dropped."""
        known = set(known_items)
        self.readings = {source: float(value) for source, value in data.get("readings", {}).items()}
        self.starts = {period: datetime.fromisoformat(start) for period, start in data.get("starts", {}).items()}
        self.amounts = {
            period: {item_id: float(amount) for item_id, amount in amounts.items() if item_id in known}
            for period, amounts in data.get("amounts", {}).items()
        }
        self.taxes = {
            period: {item_id: float(tax) for item_id, tax in taxes.items() if item_id in known}
            for period, taxes in data.get("taxes", {}).items()
        }
        self.charged = {item_id: due for item_id, due in data.get("charged", {}).items() if item_id in known}
        self.prices = {item_id: float(price) for item_id, price in data.get("prices", {}).items() if item_id in known}
