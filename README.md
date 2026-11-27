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

| Name                  | Type                                                      | Description                                                                                                                                  | Default          |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Name                  | text                                                      | The name of the site and its device, such as Home electricity.                                                                               | required         |
| Utility               | electricity, water, gas, district heating, something else | The cost elements a new site starts with (below), and the icon of its sensors.                                                               | electricity      |
| Meter                 | sensor                                                    | A sensor with the meter's cumulative reading, such as the total energy imported in kWh or the water used in m³.                              | required         |
| Conversion factor     | number                                                    | The reading is multiplied by this before any price, such as from gas m³ to kWh.                                                              | 1                |
| Periods               | hour, day, week, month, year                              | Each item and total gets a sensor for each period chosen. A week starts on Monday.                                                           | day, month, year |
| Price unit            | currency, hundredths of the currency                      | Whether prices are typed in the currency or in its hundredths, such as cents or öre per kWh. The price sensors show prices in the same unit. | currency         |
| Symbol for hundredths | text                                                      | The symbol the price sensors use for a hundredth, such as c, öre or p. Only used when prices are in hundredths.                              | c                |

A new site starts with the cost elements of its utility, named in Home Assistant's language and with no tax. They are Energy
and Transfer for electricity, Water and Wastewater for water, Gas and Transfer for gas, Energy and Basic fee for district heating, and Costs for something else. They can
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

| Sensor                           | What it shows                                                          | Enabled |
| -------------------------------- | ---------------------------------------------------------------------- | ------- |
| _Item_ today                     | The item's cost before tax                                             | no      |
| _Element_ usage before tax today | The element's items priced per unit, before tax and without fixed fees | no      |
| _Element_ usage with tax today   | The same with the tax                                                  | no      |
| _Element_ tax today              | The element's tax, fixed fees included                                 | no      |
| _Element_ total today            | All of the element's items, fixed fees included, with tax              | yes     |
| Tax today                        | The site's taxes                                                       | no      |
| Total today                      | The site's total                                                       | yes     |
| _Element_ price now              | The element's price per unit of the site's meter now, with tax         | no      |
| Price now                        | The site's price per unit now, with tax                                | no      |

A site starts with only the totals enabled, its own and each element's, so it doesn't begin with a sensor for
everything. The rest are enabled on the device's page, as many as you need. Their costs are counted all the same, so a
sensor enabled later shows its period so far, and its long-term statistics start from then.

A fixed fee is added in full at the start of its period, whatever the consumption. It shows only in the sensors of
its own period and longer ones, so a monthly fee is in the month's and the year's totals but not in the week's, the
day's or the hour's. The fee's own sensors exist only for those periods too, so a monthly fee has a sensor for the
month and the year. A fee added in the middle of its period is added at once, as it is due for that period.

A yearly fee is likewise only in the year's sensors. A fee that a contract states per year but bills every month, as
district heating's basic fee often is, is entered as a monthly fee of a twelfth of it, so the months show it too.

The price sensors leave out items with a separate meter, as those aren't priced per unit of the site's meter.

### How consumption is priced

Each time the meter reports a new reading, the consumption since its previous reading is priced at the prices in force
at that moment. The integration knows nothing of price periods, so a spot price that changes every hour, every 15
minutes or at any other pace works the same way.

How exactly the costs follow a changing price depends on how often the meter reports. A meter that reports every few
seconds puts practically all consumption on the right price. One that reports once an hour has each hour's consumption
priced at the price in force when its reading arrives, which a spot price changing every 15 minutes makes coarse.

Consumption from while Home Assistant was down is priced as one reading when it is back, at the prices in force then.

## Statistics

Besides the sensors, the integration writes long-term statistics of its own for every item, whether or not the item's
sensors are enabled. They are found by the site's name wherever Home Assistant offers statistics, such as the
statistics graph card and Developer tools › Statistics.

| Statistic          | What it holds                       |
| ------------------ | ----------------------------------- |
| _Site_ _Item_      | The item's cost before tax          |
| _Site_ _Item_ tax  | The tax on the item                 |
| _Site_ consumption | The consumption of the site's meter |

Each is a running sum since the site was added, written once an hour for the hour that ended, so Home Assistant can
show its change over any hour, day, week, month or year. They need the recorder, which Home Assistant has on by
default. An item that is removed keeps its statistics, so earlier periods stay whole. Removing the site removes
them all.

## Utility cost card

The integration comes with a dashboard card for one site. It shows what a period has cost, the bill in its elements
and items, a chart of the period in parts, each part's share of the total, and an estimate for the whole period. The
period is changed in the card, and earlier periods are a tap away. Every part can be switched off, so the same card is
a whole bill with a chart, or two rows with a total and a share bar.

It works with whatever a site is set up for, with any utility, unit and currency, any elements and items, and with or
without fixed fees. The periods it offers are the ones the site follows.

The integration serves the card itself and adds it to the dashboards' resources when it starts, so the card is always
the integration's own version. With the resources set in YAML (`resource_mode: yaml`), it can't add or update
itself, and the log says which line to add, change or remove.

The current period comes straight from the integration, so it needs none of the site's sensors enabled. Earlier
periods, the chart and the estimate come from the integration's [statistics](#statistics), so they reach back to when
the site was added and need the recorder.

### Card options

The card has a visual editor. Add **Utility cost** from the card picker and choose the site. The options can also be
written by hand, and `height_mode`, `height` and `max_height` only by hand. In a sections view the layout tab sets the
card's height. They are for where there is no layout tab, such as a masonry or panel view, or a stack or other card
the card is inside, even in a sections view.

| Name               | Type    | Description                                                                                                                                                                                                                                                                                                                | Default                                                                         |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `type`             | string  | `custom:utility-cost-card`                                                                                                                                                                                                                                                                                                 | required                                                                        |
| `site`             | string  | The site, as the id of its entry. The editor lists the sites by name                                                                                                                                                                                                                                                       | required                                                                        |
| `title`            | string  | A title in place of the site's name                                                                                                                                                                                                                                                                                        | the site's name                                                                 |
| `period`           | string  | The period shown first, `hour`, `day`, `week`, `month` or `year`, when the site follows it                                                                                                                                                                                                                                 | `month`, or the site's longest period when it doesn't follow months             |
| `show_price`       | boolean | The current price per unit, with tax                                                                                                                                                                                                                                                                                       | `true`                                                                          |
| `show_periods`     | boolean | The switch between the periods the site follows                                                                                                                                                                                                                                                                            | `true`                                                                          |
| `show_earlier`     | boolean | The arrows to earlier periods                                                                                                                                                                                                                                                                                              | `true`                                                                          |
| `show_consumption` | boolean | The period's consumption and the average price paid per unit, fixed fees left out                                                                                                                                                                                                                                          | `true`                                                                          |
| `show_estimate`    | boolean | [The estimate](#the-estimate) for the whole period, and the previous period to compare with                                                                                                                                                                                                                                | `true`                                                                          |
| `show_chart`       | boolean | [The chart](#the-chart) of the period in parts                                                                                                                                                                                                                                                                             | `true`                                                                          |
| `show_usage`       | boolean | The consumption as a line over the chart's bars                                                                                                                                                                                                                                                                            | `true`                                                                          |
| `show_share`       | boolean | A bar of each element's share of the total, with the amounts under the pointer                                                                                                                                                                                                                                             | `false`                                                                         |
| `show_bill`        | boolean | The bill, with the elements, their items, the tax and the total. Without it, a legend tells the colours of the chart and the share bar, unless `show_legend` is off                                                                                                                                                        | `true`                                                                          |
| `show_legend`      | boolean | The legend shown when the bill is off                                                                                                                                                                                                                                                                                      | `true`                                                                          |
| `tax`              | string  | How tax is shown. `included` has it in every amount, `separate` shows amounts before tax and the tax on a row of its own, `none` leaves it out, the total included                                                                                                                                                         | `included`                                                                      |
| `lines`            | string  | Which items the bill lists under their elements, `all`, only the `picked` ones, or `none`                                                                                                                                                                                                                                  | `all`                                                                           |
| `hidden_elements`  | list    | Elements left out of the card, by their ids. A hidden element is out of the total, the chart and the estimate too. The editor lists them by name                                                                                                                                                                           |                                                                                 |
| `picked_items`     | list    | Items given a [colour](#colours) of their own in the bill, the chart and the share bar, by their ids. The editor lists them by name                                                                                                                                                                                        |                                                                                 |
| `height_mode`      | string  | How tall the card is. `auto` fits its content, `fixed` keeps it at `height`, `max` lets it grow up to `max_height`. In `fixed` and `max` the bill scrolls under the other parts. A height in grid rows, set in the layout tab of a sections view, is used instead                                                          | `fixed` when `height` is set, `max` when only `max_height` is, otherwise `auto` |
| `height`           | number  | The card's height in pixels, for `fixed`                                                                                                                                                                                                                                                                                   |                                                                                 |
| `max_height`       | number  | The card's greatest height in pixels, for `max`                                                                                                                                                                                                                                                                            |                                                                                 |
| `row_step`         | string  | How the card rounds its height on automatic rows in a sections view, with `height_mode` `auto` or `max`. `full` rounds it up to whole rows, so the cards under it stay on the rows. `half` rounds it up to half rows, which saves space but can leave the cards under it half a row off the rows of the sections beside it | `full`                                                                          |
| `scroll_indicator` | string  | How the bill shows that there is more when it scrolls in a card held to a height. `both` fades the edges where the bill runs on and shows a thin scrollbar, `fade` only fades the edges, `scrollbar` only shows the scrollbar                                                                                              | `both`                                                                          |

Without the period switch and the arrows to earlier periods, the card's head is a single row of the site's name, the
period and the total. Tapping the period there changes it to the next one the site follows.

### The estimate

For the period under way, the card estimates what the whole period will cost. It is what the period has cost so far
and an estimate of the rest, which each period counts in the way that suits it.

- **A day and a year** take the rest as it went in the previous one from the same point to its end. At noon on
  12 November, a year's estimate is this year so far and last year from noon on 12 November to the end of December. A
  day's is today so far and yesterday from the same time of day on.
- **A week and a month** take the rest at the rate of the last 14 whole days, whichever period those days were in. A
  daily fixed fee is counted once for each day still to start, and a monthly one not at all, as the month already has it.
- **An hour** has no estimate.

The estimate needs that much history in the statistics. A week's and a month's come once the site has 14 whole days of
it, a day's a day after the site was added, and a year's a year after it. With the whole previous period in the
statistics, the estimate also shows what that period cost in all and up to the same point. An earlier period is compared
with the one before it instead.

### The chart

A day is drawn by its hours, a week and a month by their days and a year by its weeks, each bar stacked by element.
A year's first and last weeks are cut at the year's ends. The bar under way is marked on the baseline. The cost's scale is on the left. An hour has no chart. A
fixed fee belongs to no single hour or day, so a fee of a period longer than a bar's is left out of the bars, and the
card says how much they leave out.

An item removed from the site stays in the earlier periods it has history in, listed under Removed items. The periods
under way leave it out at once, and have it again once they have ended. It is left out of the average price, as the
card can't tell whether it was a fixed fee.

Pointing at a bar shows its cost by element and its consumption. Pressing a bar opens its own period, such as a day
of a month, when the site follows that period.

A line over the bars follows the consumption, so a dear hour with little use stands apart from a cheap one with much.
It is drawn by what was used per hour, on a scale of its own on the right. For energy in
kWh that is the power in kW. The line is finer than the bars where the history allows. A week's line goes by the hour.
A day's goes by five minutes, from the meter's own statistics, which Home Assistant keeps that fine only for as long as
it keeps its history, and only for a meter with a state class. Other days go by the hour. The line is see-through, so the bars show under it. Its
colour is the text's, or the theme's `--utility-cost-usage-color`.

### Colours

Each element has a colour of its own, in the bill, the chart and the share bar. An item picked in the options gets a
shade of its element's colour, and the rest of the element stays in the element's own. The four element colours are
used in turn and can be set in a theme.

| Variable                 | Default                           |
| ------------------------ | --------------------------------- |
| `--utility-cost-color-1` | the theme's `--primary-color`     |
| `--utility-cost-color-2` | Home Assistant's `--purple-color` |
| `--utility-cost-color-3` | the theme's `--success-color`     |
| `--utility-cost-color-4` | the theme's `--warning-color`     |

### Sizes

The card takes a whole section. With neither the period switch nor the earlier periods, and neither a chart nor a
bill, it fits in half of one, and a card narrower than 300 px has the name and the period on a line above the total.
On automatic rows in a sections view, it ends on whole rows, or on half rows with
`row_step: half`, and any room left over goes to the chart, or is spread between the parts when there is no chart.
Held to a height lower than its content, it scrolls the bill, and then draws the chart lower. A card held taller
has a taller chart. A card held too low for the estimate's box has the estimate as a line under the total.

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

## Translating

The integration's texts are in `custom_components/utility_cost_tracker/translations/`, one JSON file per language,
named by its language code, such as `en.json` and `fi.json`. To add a language, copy `en.json` to the new language's
code and translate the values.

The utility cost card's texts are in `frontend/src/localize/languages/`, in the same way. The card finds a new file by
itself and uses it when Home Assistant is set to that language. A text left out falls back to English. A file may
name a region, such as `pt-br.json`. It is used for `pt-BR`, falling back to a file for the language alone (`pt.json`),
and then to English.

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
| `custom_components/utility_cost_tracker/history.py`     | The long-term statistics of every item               |
| `custom_components/utility_cost_tracker/websocket.py`   | A site as a card reads it                            |
| `custom_components/utility_cost_tracker/config_flow.py` | The site, its cost elements and its items            |
| `custom_components/utility_cost_tracker/card.py`        | Serving the card and its dashboard resource          |
| `custom_components/utility_cost_tracker/www/`           | The built card, committed                            |
| `frontend/`                                             | The card's source, TypeScript and lit                |
| `tests/`                                                | Tests, run with pytest and made-up meters and prices |

The card is a project of its own in `frontend/`, and takes its version from the integration's `manifest.json`. Its
checks need Node 22.13 or newer.

```
cd frontend
npm install
npm run check
```

`npm run check` type-checks, lints, checks the formatting, runs the tests and builds the card into
`custom_components/utility_cost_tracker/www/`. A pre-commit hook refuses a built card that the staged sources don't
build to. Switch it on once per clone with `git config core.hooksPath .githooks`.

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
