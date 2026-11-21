# The app seen by a pioneer who has just landed

Written as an exercise: walk the game from the drop pod forward and ask, at each stage, what the
app gives and what it withholds. Every claim here was checked against real save files rather than
imagined, and the game's own wiki was used for what the save cannot say.

The short verdict first.

**This app is a logbook for a factory that already exists. The pioneer's first twenty hours are not
about a factory — they are about a planet. The save contains that planet, in detail, and we throw
almost all of it away and keep the machine counts.**

## Hour zero: the capsule

Most panels are empty, and that is correct. No history means no charts; no month means no medals;
nothing built means nothing that can stop. An app that invented content here would be worse.

One thing is wrong, though, and it is wrong silently. **The next-milestone panel — the single most
useful thing for someone in their first hour — returns nothing at all when the game data has not
been read.** Not a message, not a prompt, just an absent panel. That is exactly the user who has
not been into Settings yet.

## Hours one to twenty: the exploration phase

This is where the gap is widest.

The early game is not spent optimising ratios. It is spent walking: hunting caterium for the MAM,
chasing power slugs across cliffs, cracking drop pods for hard drives, and noting "there is a
geyser here, remember it".

The app says: *Collectables: 33 drop pods, 36 Mercer spheres, 50 blue slugs.*

Thirty-three. **Where?**

Checked in a real save: every one of them carries an exact position — 50 blue slugs, 28 yellow, 15
purple, 8 somersloops, 36 Mercer spheres, 33 drop pods, all located. We keep the count and discard
the coordinates. Meanwhile the map now has zoom, a board, the pioneer drawn on it and a
distance-to-anything function. Everything needed is already built.

## The planet itself

The save carries **1,147 resource nodes, deposits and geysers**, each with a position.

It does not carry what is in them. Node objects hold only `mResourcesLeft` and a transform; the ore
type lives in the world generation data, not the save. So a resource map from the save alone can
show where the nodes are and not what they contain — except for the ones with a miner on them,
where the machine says what it extracts.

That limitation is worth embracing rather than apologising for: a node you have not tapped is a
node you have not scanned. Showing "something is here, you have not touched it" is honest, useful,
and happens to match the fiction exactly.

## Fauna and danger

This was the surprise. Every creature nest in the save carries, per creature:

- `WasKilled` — whether you have cleared it
- `NumTimesKilled` — how many times
- `KilledOnDayNr` — on which in-game day

One real world holds **654 nests and 904 creature entries, 28 of them marked killed, with hunting
days spanning day 50 to day 153.** The save keeps a hunting log and nobody is reading it.

Nests also carry `mCachedIsNearBase` — the game itself caches which nests sit next to your factory.
Read with the same care the generator fuel flag needed: the property is only present when it is
non-default, so absent means unknown, not false.

What that enables: a danger layer on the map showing where the nests are, which ones you have
cleared, how long ago (creatures come back), and which ones are close to where you work.

## Radiation

The wiki is precise about the mechanic. A pioneer takes no damage below 0.2 intensity, and beyond
45 the damage is capped at a level that kills in five seconds or burns an Iodine-Infused Filter
every twelve. The Hazmat Suit stops radiation but not poison gas. A vehicle makes you immune.
Crucially, **the intensities of multiple sources sum — including items sitting in different
containers.**

That last part is computable from the save. Every container's contents and position are in there.
A pioneer who parks a crate of nuclear waste beside a walkway will walk through radiation every
day and never know why. The app can know, because it can see every radioactive item in every
container and where that container stands.

Nothing of this kind exists today.

## Where the app already is the tablet

The blackout case works, and it works well. Generators dry, the alert says so, says the rest is
probably a consequence, takes you to the spot, tells you how far. That is the thing this exercise
is asking for, already built — it just only exists for one kind of problem.

## What this says about priorities

The features are not missing in a random way. They are missing in one specific way: **everything
the app knows is about machines, and nothing is about the world the machines sit in.** The save
holds both. We read one.

Ranked by value to an actual pioneer:

1. **Collectables on the map.** The data is there, the map is ready, and this is the single most
   wanted thing in the first twenty hours. Smallest work, largest return.
2. **The danger layer.** Nests, cleared or not, how long ago, and which are near the factory. Needs
   care with the near-base flag, for the reason the fuel flag taught us.
3. **A radiation map from stored radioactive items.** Genuinely protective, genuinely novel, and
   the wiki gives the thresholds to make it accurate rather than alarmist.
4. **Resource nodes, honestly labelled.** Where they are, which are tapped, what the tapped ones
   yield. Not what the untapped ones hold, and say so.
5. **Fix the silent empty milestone panel.** Small, but it is the first impression of every new
   user.

Notes pinned to places on the map would tie all of this together — the pioneer's own marks
alongside what the save knows — and that is closer to a real in-game tablet than any chart.
