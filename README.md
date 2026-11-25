# Utility cost tracker

Home Assistant integration that follows what electricity, water or gas costs by the hour, day, week, month and year,
each item of the bill on its own and in totals.

[![GitHub Release][releases-shield]][releases] [![GitHub Release Date][release-date-shield]][releases] [![Downloads][downloads-shield]][releases] [![Marketplace][marketplace-shield]][marketplace] [![License][license-shield]](LICENSE)

## What is it?

A utility bill is rarely one price times the consumption. An electricity bill can have a spot price, the seller's
margin, a transfer price that is different at night, an electricity tax, monthly fees, and value added tax on all of
it. A water bill has water and wastewater per cubic metre and a basic fee.

Utility cost tracker takes the meter you already have in Home Assistant and the prices of your bill, and keeps a
running total of each item of the bill and of the whole, with sensors you can show on a dashboard and keep in the
long-term statistics. It doesn't fetch prices from anywhere. A price that varies comes from any sensor you already
have, such as a spot price from Nord Pool.

Each place you follow is a **site**, such as the electricity of a home or the water of a cabin. A site's bill is made
of **cost elements**, the parts of the bill that share a tax rate, such as Energy and Transfer. Each element holds
**items**, the lines of the bill.

- **A constant price per unit:** a margin, an electricity tax, a transfer price, a fixed-price contract, water per m³.
- **A price per unit from a sensor:** a spot price, with a multiplier and an addition.
- **A fixed fee** per day, month or year, such as a basic fee or a standing charge. A negative fee is a credit.

Prices are entered as the bill or the contract states them, with or without tax. A price per unit can apply always,
in a time window (hours, weekdays and months), or at other times, whenever none of the element's windowed items
applies. Day and night transfer, or a winter weekday tariff and the price at other times, are then items of their
own, each with its own sensors, and the element adds them up.

The integration counts the costs itself and keeps its totals in Home Assistant's storage, so a restart or a reload
neither loses nor repeats anything. Consumption that came while Home Assistant was down is counted when it is back,
at the prices in force then.

## Installation

### With the Marketplace

1. Open Settings › Marketplace, choose Add from link and paste `https://github.com/jesmak/utility_cost_tracker`
2. Open Utility cost tracker in the Marketplace and choose Install
3. Restart Home Assistant
4. In Settings, open Devices & services, add an integration and choose Utility cost tracker

### Manual

1. Copy `custom_components/utility_cost_tracker` from the source code of the [latest release][releases] to the
   `config/custom_components` folder of your Home Assistant installation
2. Restart Home Assistant
3. In Settings, open Devices & services, add an integration and choose Utility cost tracker

## Settings

Every setting can be changed later. A change applies from then on, and the totals so far are kept.

### Site

Added as an integration entry. Its settings are changed with Reconfigure.

| Name                  | Type                                    | Description                                                                                                                                  | Default          |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Name                  | text                                    | The name of the site and its device, such as Home electricity.                                                                               | required         |
| Utility               | electricity, water, gas, something else | The cost elements a new site starts with (below), and the icon of its sensors.                                                               | electricity      |
| Meter                 | sensor                                  | A sensor with the meter's cumulative reading, such as the total energy imported in kWh or the water used in m³.                              | required         |
| Conversion factor     | number                                  | The reading is multiplied by this before any price, such as from gas m³ to kWh.                                                              | 1                |
| Periods               | hour, day, week, month, year            | Each item and total gets a sensor for each period chosen. A week starts on Monday.                                                           | day, month, year |
| Price unit            | currency, hundredths of the currency    | Whether prices are typed in the currency or in its hundredths, such as cents or öre per kWh. The price sensors show prices in the same unit. | currency         |
| Symbol for hundredths | text                                    | The symbol the price sensors use for a hundredth, such as c, öre or p. Only used when prices are in hundredths.                              | c                |

A new site starts with the cost elements of its utility, named in Home Assistant's language and with no tax. They are Energy
and Transfer for electricity, Water and Wastewater for water, Gas and Transfer for gas, and Costs for something else. They can
be renamed, given a tax rate or removed like any other.

### Cost element

Added to a site with Add cost element.

| Name     | Type   | Description                                                                                     | Default  |
| -------- | ------ | ----------------------------------------------------------------------------------------------- | -------- |
| Name     | text   | Such as Energy, Transfer, Water or Wastewater.                                                  | required |
| Tax rate | number | The element's tax rate in per cent, such as value added tax. Each item says whether it's taxed. | 0        |

### Item

Added to a site with Add item, which first asks for its kind. Prices per unit are in the site's price unit, and fixed
fees always in the currency.

| Name               | Kinds            | Description                                                                                                                 | Default  |
| ------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| Name               | all              | Such as Spot price, Margin, Day transfer or Monthly fee.                                                                    | required |
| Cost element       | all              | The element the item belongs to.                                                                                            | required |
| Price per unit     | constant         | The price per unit of consumption.                                                                                          | 0        |
| Price sensor       | sensor           | The sensor with the price.                                                                                                  | required |
| Multiplier         | sensor           | Turns the sensor's value into the site's price unit, such as 100 from the currency to its hundredths.                       | 1        |
| Addition           | sensor           | Added to the price after the multiplier.                                                                                    | 0        |
| Amount             | fixed fee        | The fee per period, in the currency. A negative amount is a credit.                                                         | 0        |
| Charged every      | fixed fee        | Day, month or year.                                                                                                         | month    |
| Taxed              | all              | The element's tax rate is added to the item.                                                                                | on       |
| Price includes tax | all              | The price is typed with tax, the way a contract or bill shows it. Only for a taxed item.                                    | off      |
| When it applies    | constant, sensor | Always, at set times, or at other times, whenever none of the element's items at set times applies.                         | always   |
| Separate meter     | constant, sensor | A sub-meter to read instead of the site's meter, such as a car charger's. The site's conversion factor doesn't apply to it. |          |
| Conversion factor  | constant, sensor | The consumption is multiplied by this before the price, such as 0.9 for wastewater billed on 90 % of the water.             | 1        |

An item at set times then asks for the times.

| Name     | Type     | Description                                                                                                | Default |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| From     | time     | The window's start.                                                                                        | 07:00   |
| Until    | time     | The window's end. A time earlier than the start runs past midnight. The same time as the start is all day. | 22:00   |
| Weekdays | weekdays | The days the window applies on. None chosen for every day.                                                 |         |
| Months   | months   | The months the window applies in. None chosen for every month.                                             |         |

Windows of the same element shouldn't overlap, as consumption in an overlap is counted by both items.

A price from a sensor that is unavailable is taken as its last known value. Until a sensor has had a value once, its
item counts nothing.

## Sensors

All sensors of a site are on its device. The cost sensors are in the currency set in Home Assistant (Settings ›
System › General), whatever it is, with the state class `total` and a `last_reset` at the start of their period, so
the long-term statistics keep every period's cost. Each exists once for each period the site follows, named by it
(Total today, Total this month). The price sensors are in the site's price unit per the meter's unit, such as EUR/kWh,
or c/kWh when prices are typed in hundredths.

| Sensor                           | What it shows                                                          |
| -------------------------------- | ---------------------------------------------------------------------- |
| _Item_ today                     | The item's cost before tax                                             |
| _Element_ usage before tax today | The element's items priced per unit, before tax and without fixed fees |
| _Element_ usage with tax today   | The same with the tax                                                  |
| _Element_ tax today              | The element's tax, fixed fees included                                 |
| _Element_ total today            | All of the element's items, fixed fees included, with tax              |
| Tax today                        | The site's taxes                                                       |
| Total today                      | The site's total                                                       |
| _Element_ price now              | The element's price per unit of the site's meter now, with tax         |
| Price now                        | The site's price per unit now, with tax                                |

A fixed fee is added in full at the start of its period, whatever the consumption. It shows only in the sensors of
its own period and longer ones, so a monthly fee is in the month's and the year's sensors but not in the day's or the
hour's. A fee added in the middle of its period is added at once, as it is due for that period.

The price sensors leave out items with a separate meter, as those aren't priced per unit of the site's meter.

## Examples

An electricity contract on the spot price in Finland, with day and night transfer. The site follows
`sensor.example_meter_energy_import`, with prices typed in hundredths of the currency, here cents. Both elements have a
tax rate of 25.5.

| Element  | Item            | Kind      | Price                                              | Includes tax | When           |
| -------- | --------------- | --------- | -------------------------------------------------- | ------------ | -------------- |
| Energy   | Spot price      | sensor    | the Nord Pool price sensor (€/kWh), multiplier 100 | no           | always         |
| Energy   | Margin          | constant  | 0.49                                               | yes          | always         |
| Energy   | Monthly fee     | fixed fee | 3.99 per month                                     | yes          |                |
| Transfer | Day transfer    | constant  | 3.1                                                | no           | 07:00–22:00    |
| Transfer | Night transfer  | constant  | 1.6                                                | no           | at other times |
| Transfer | Electricity tax | constant  | 2.8                                                | yes          | always         |
| Transfer | Basic fee       | fixed fee | 12.50 per month                                    | yes          |                |

Transfer usage before tax this month is then the whole transfer, day and night together, Day transfer this month and
Night transfer this month show them apart, and Total this month is the month's bill so far.

A seasonal transfer tariff has a winter weekday price and another at other times.

| Element  | Item           | Kind     | Price | When                                               |
| -------- | -------------- | -------- | ----- | -------------------------------------------------- |
| Transfer | Winter weekday | constant | 4.2   | 07:00–22:00, Monday to Saturday, November to March |
| Transfer | Other times    | constant | 1.9   | at other times                                     |

A water bill has wastewater billed on the whole volume and a yearly basic fee. Its prices are typed in the currency, and
the element's tax rate is 24.

| Element | Item       | Kind      | Price       | Includes tax |
| ------- | ---------- | --------- | ----------- | ------------ |
| Water   | Water      | constant  | 1.85        | no           |
| Water   | Wastewater | constant  | 2.40        | no           |
| Water   | Basic fee  | fixed fee | 96 per year | no           |

## Data

The integration uses no outside service. It reads the sensors it is given and counts from the moment a site is added,
so the totals start from zero then and have no history from before it.

## Development

Requires Python 3.14, the version the current Home Assistant needs.

```
python3.14 -m venv .venv
.venv/bin/pip install -r requirements_test.txt
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest
```

| Path                                                    | What it contains                                     |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `custom_components/utility_cost_tracker/tariff.py`      | The bill's arithmetic, free of Home Assistant        |
| `custom_components/utility_cost_tracker/tracker.py`     | A site's meters, clock and storage                   |
| `custom_components/utility_cost_tracker/sensor.py`      | The cost and price sensors                           |
| `custom_components/utility_cost_tracker/config_flow.py` | The site, its cost elements and its items            |
| `tests/`                                                | Tests, run with pytest and made-up meters and prices |

## Support

Hey dude! Help me out for a couple of :beers: or a :coffee:!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/jesmak)

## License

MIT, see [LICENSE](LICENSE).

[releases-shield]: https://img.shields.io/github/release/jesmak/utility_cost_tracker.svg?style=for-the-badge
[release-date-shield]: https://img.shields.io/github/release-date/jesmak/utility_cost_tracker?style=for-the-badge
[releases]: https://github.com/jesmak/utility_cost_tracker/releases
[downloads-shield]: https://img.shields.io/github/downloads/jesmak/utility_cost_tracker/total.svg?style=for-the-badge
[marketplace-shield]: https://img.shields.io/badge/Marketplace-Custom-orange.svg?style=for-the-badge
[marketplace]: https://my.home-assistant.io/redirect/marketplace_repository/?owner=jesmak&repository=utility_cost_tracker&category=integration
[license-shield]: https://img.shields.io/github/license/jesmak/utility_cost_tracker.svg?style=for-the-badge
