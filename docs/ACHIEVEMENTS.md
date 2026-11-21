# Achievements — design notes

Status: **agreed design, not implemented yet.**
Scope: per world, per calendar month.

## The rule that shapes everything: recompute, never accumulate

Medals are **not stored**. They are recomputed from `history.json` every time the tab opens. The
only thing persisted is which medals the user has already seen, so new ones can be badged.

This matters more than it looks. It means that the day a new medal is added it appears
**retroactively**, dated from the existing history. If earned state were stored instead, every new
medal would start empty and the wall would stay bare for months. It is the difference between
shipping with content and shipping sad.

Consequence: the medal catalogue is plain data in TypeScript. Adding one costs a few lines and
needs no migration.

## What it reads

Everything comes from the snapshot metrics recorded per save (`SnapshotMetrics`, schema 1): tier,
milestones, research, machines with a recipe, overclocked machines, power consumption and
generation, production and consumption per item, **deficits**, stored materials, uncollected
collectables, detected floors and factory extent.

Snapshots before schema 1 have no metrics. Medals that need them simply do not count those months,
and the UI says "not enough data" rather than showing a zero — a zero reads as failure, an absence
reads as an absence.

## Two families

**Certifications** — one-off, dated. Detected as "the first snapshot in which X is true":

- First time each part is produced (iron, steel, plastic, computers…), derived from `production[]`
  with no per-part medal to write by hand
- Each tier reached
- First overclocked machine
- First second floor (`levels >= 2`)
- First snapshot with zero deficits

**Monthly series** — repeatable, graded. Computed from the difference between the first and the
last snapshot of a calendar month.

## The grading scale

Not bronze/silver/gold. The game grades its own Space Elevator phases as *mediocre*, *adequate* and
*efficient* pioneering, which is funnier and entirely in character: FICSIT does not congratulate
you, it evaluates you.

| Level | English | Español |
|---|---|---|
| 1 | Mediocre | Mediocre |
| 2 | Adequate | Aceptable |
| 3 | Efficient | Eficiente |

The month's card is headed **Performance Review — November 2026** / **Evaluación de Desempeño**,
with an overall rating derived from the medals earned.

## Catalogue

Names are written in FICSIT's register but are **original**, not taken from the game. Thresholds
are first guesses and need tuning against real play.

| Id | English | Español | Measures | Mediocre / Adequate / Efficient |
|---|---|---|---|---|
| `structural` | Structural Expansion | Expansión Estructural | buildings raised | 50 / 200 / 500 |
| `billable` | Billable Hours | Horas Facturables | hours played | 5 / 15 / 40 |
| `supply` | Power Supply Contract | Contrato de Suministro | MW of generation added | 50 / 250 / 1000 |
| `throughput` | Aggregate Throughput | Rendimiento Agregado | items/min of production gained | 100 / 500 / 2000 |
| `vertical` | Vertical Development | Desarrollo Vertical | floors built | 2 / 4 / 6 |
| `acquisition` | Asset Acquisition | Adquisición de Activos | collectables picked up | 5 / 20 / 50 |
| `incident` | Incident Resolution | Resolución de Incidencias | bottlenecks resolved | 1 / 5 / 15 |

`incident` is the one no other tool can produce: a part that was in deficit in one snapshot and is
not in the next. It requires having been watching. That is why `deficits[]` is recorded.

Descriptions carry the voice — dry corporate with a passive-aggressive edge:

> **Horas Facturables** — FICSIT no remunera las horas extra, pero las registra.
> **Desarrollo Vertical** — El suelo es un recurso finito. Su uso creativo ha sido anotado en su expediente.
> **Resolución de Incidencias** — Un cuello de botella resuelto es un cuello de botella que nunca debió existir.

## The hook: what you can still earn this month

The top card shows the current month's medals and the distance to the next grade:
*"Structural Expansion: 180/200 for Adequate — 20 machines to go."*

The historical wall is the past. This is the present, and it is what brings someone back into the
app. It should be the first thing on the tab.

## Two things found while implementing this

Both were caught by running the design against a real history before shipping it, and both would
have produced confident lies on screen.

**Measure along the world's clock, not the calendar.** A month's snapshots can come from the
manual save and its three rotating autosaves — different files of the same world. Ordering them by
date mixes states, and measuring each metric independently can end up subtracting one file's
buildings from another file's hours. So the month picks **two** snapshots, the one with the lowest
`play_seconds` and the one with the highest, and every metric is measured between those two. On
real data this changed "3 floors built this month" into the correct 0: the 3 was the difference
between two save slots, not anything that was built.

**A date you cannot know must not be stated.** Tier, floors and overclock only exist in snapshots
that carry metrics, and metrics only began being recorded recently. Reading "first reached Tier 4"
off the earliest snapshot that *could* show it dated a milestone from months ago to today. Every
certification now carries an `exact` flag: if the condition already held in the first snapshot able
to see it, the app says **"no later than"** instead of naming a day. An app that states a date it
does not know is lying with great confidence.

## Edge cases that must be handled

- **A month needs two snapshots** to produce a series medal. One snapshot gives no delta.
- **Deltas can be negative.** Tearing down half a factory to rebuild it must not produce a negative
  score. Clamp at zero and never penalise: nobody wants a medal that scolds them for reorganising.
- **Months with no play** do not exist in the timeline. They are skipped, not shown as failures.
- **Retroactive coverage is thin.** The saves on disk give roughly four snapshots per world,
  clustered in a few days. The certification wall will fill in reasonably; the monthly series
  effectively starts now.
- **Item names are Spanish in schema 1** (see `SnapshotMetrics`). Medals that match item names must
  go through the same mapping, and the migration to canonical English names must update them.

## Where it lives

A new **Achievements** tab, between Map and Plan: current month card, then the monthly timeline,
then the certification wall with dates.
