# What the game data unlocks

Notes written after wiring the game's own documentation into the app. Everything below was
verified against the real files, not guessed: the counts are what is actually there.

## What we now have and barely use

| Data | Count | Already used? |
|---|---|---|
| Recipes, with exact rates | 872 | yes — production, consumption, bottlenecks |
| Buildings, with power draw and generation | 546 | yes — vitals |
| Items, named in every language | ~750 | yes — display names |
| **Building costs** (recipes that produce a building) | **546** | **no** |
| **Milestones** (HUB), with exact cost | **42** | **no** |
| **MAM research** | **120** | **no** |
| **Alternate recipes** | **109** | **no** |
| **AWESOME Sink rewards** | **173** | **no** |
| **Sink points per item** | **168 items** | **no** |

The save already tells us which schematics a world has completed. Crossing that with the list
above is where most of the remaining value is.

## 0. One vocabulary: the master table the app already has

Raised by Zigor on 25 Nov 2026, in his words: *a database generated from reading the save and the
game data, master tables where everything is recorded once, and each section calls it and does its
own arithmetic.* That is the right shape, with one correction: **the master table already exists.**
It is `gamedata.json`, extracted from the game's own `Docs.json` — 746 items, 546 buildings, 872
recipes, 574 milestones, named in both languages, keyed by class. The problem is not that it is
missing. It is that four hand-written tables still shadow it, and the history file was written
through them.

This section absorbs items 2, 6 and 7 below, which are three views of the same job.

### The evidence: four vocabularies in one history file

Measured against the owner's real `history.json` — 55 snapshots across three worlds, of which 33
predate the `schema` field entirely and 22 are at schema 1.

| Field | Entries | Current Spanish | Current English | Raw class | Matches nothing |
|---|---|---|---|---|---|
| `production` | 267 | 228 | — | — | **39** |
| `consumption` | 287 | 248 | — | — | **39** |
| `deficits` | 57 | 40 | — | — | **17** |
| `stored` | 845 | 43 | 306 | — | **496** |
| `collectables` | 132 | — | — | 132 | — |

61 distinct names match nothing in the game's catalogue. They are of two kinds, and the first kind
is the important one.

**The app's own older Spanish.** `Placa de hierro`, `Tornillo`, `Hilo de cobre`, `Marco modular`,
`Viga industrial revestida`. Today the game calls these `Plancha de hierro`, `Tornillos`,
`Alambre`, `Armazón modular`, `Viga industrial reforzada`. Same items. The break is visible in the
file: six snapshots say `Placa de hierro` and the next fourteen say `Plancha de hierro` — and the
game build is **identical on both sides** (1.2.6, build 520140). The vocabulary did not change
because Coffee Stain changed it. It changed because `ITEM_ES` was corrected to agree with the game,
and every snapshot written before that edit was orphaned by it.

That is the whole argument in one line: **the display name is the primary key, and the display name
is editable prose.** Any chart following iron plate production across that date sees two unrelated
items and breaks the line.

**De-camel-cased asset names**, in `stored`: `Cement`, `Ore Iron`, `Berry`,
`BP_Equipment Descriptor Candy Cane`. The game says `Concrete`, `Iron Ore`, `Paleberry`. These come
from the Rust string-scan and were never real names in any language, so there is no table that
could ever translate them back.

### What the master table already carries

| `gamedata.json` gives | Hand-written table it replaces |
|---|---|
| `items`: name es/en, fluid flag | `ITEM_ES` (63 lines) |
| `buildings`: name, size w/d/h, power, generation | `BUILDING_ES` (54 lines) |
| `recipes`: building, inputs with rates, output, rate | `RECIPE_OUTPUT` (48) and `RECIPES` (25 entries) |
| `schematics`: **tier**, cost, what it unlocks | the hand-typed `tier` column |

Nothing is missing. Even the tier comes out: each milestone lists the recipes it unlocks, so a
recipe's tier is that of the lowest milestone unlocking it — which is exactly what the hand-typed
column approximates. That is item 2 below, and it is a consequence of this work rather than a
separate task.

### Why it also protects the numbers against game updates

When a recipe is rebalanced, `gamedata.json` notices on the next read and the app says so out loud
— *3 changed rate(s)*. `RECIPES` would go on saying what it always said. The factory panel and the
calculator would disagree, silently, and the one that is wrong is the one with no way to find out.

This is not hypothetical. An audit of all 25 entries against the catalogue on 25 Nov 2026 found
**three wrong buildings and zero wrong rates**: iron, copper and caterium ingot were all assigned
to `Fundición`, which the game uses for the **Foundry**. The Smelter is `Horno`. The error was
invisible in Spanish for months because *Fundición* reads plausibly for smelting; it only surfaced
when the names were translated and the English said *Foundry*. Fixed the same day, in `RECIPES` and
in `BUILDING_ES`, which had the pair inverted as well.

### The work, cheapest and safest first

1. **Delete `ITEM_ES` and `BUILDING_ES`** (~117 lines). Pure translation; `gamedata` has it. Keep a
   minimal fallback for the no-game-data case, or accept class names there.
   **Done, 25 Nov 2026.** Every call site asks gamedata first. Old snapshots carry no class, only the name the
   Rust scan's `prettify` produced — not the TypeScript `prettyBuild`, which spaces class names
   slightly differently. `prettify` only ever inserts spaces, and class names contain none, so
   removing them inverts it exactly: 59 of 68 distinct names in the real history. `HUB_PARTS` holds the five HUB classes the catalogue lacks, consulted
   after it, each named with the HUB marker. The rest (undocumented pieces, mods) keep their
   generated English name; with no game installed, every name is the generated English one.
2. **Delete `RECIPE_OUTPUT`** (48 lines). Already keyed by the same recipe class as
   `gamedata.recipes`, so this is close to a straight removal.
   **Done, 25 Nov 2026.** The table had 37 entries; all 37 were in the catalogue with the same
   output name and rate. Two of the three call sites were already `gdRecipe(x) || RECIPE_OUTPUT[x]`
   and lost only the fallback. The third, `perItemFromRecipeCounts`, lived on the table alone; it
   now calls `gdRecipe` (the Rust scan's `rc.recipe` is the same class leaf, `Recipe_IngotIron`),
   and goes from knowing 37 recipes to every one in the catalogue.
   **Without game data, that path now gives no figures instead of the table's. This is
   deliberate.** A 37-recipe table returns a number that looks complete and is not: it would say
   you make three things when you make thirty. The settings panel already says the game data is
   missing.
   For the same reason the snapshot stores **`recipe_coverage: null`**, not 0, when no game data
   is loaded — the convention it already used with no machines: null is "I cannot say". 0 means
   "I looked and recognise none of your recipes"; null means "I had no catalogue to look in".
   Those are different facts and the history has to tell them apart, or a year from now a zero
   will read as a factory full of mods.
3. **Derive the calculator from `gamedata`**, reusing `canonRecipe()` — which already excludes
   `Build_Converter_C`, a trap that has caught this project three times. Gains every base-game
   recipe instead of 25, and the tier filter of item 2 for free.
   **Done, 25 Nov 2026.** `RECIPES` is gone. The calculator works on classes through
   `canonRecipe()` and offers 132 parts instead of 25; names are only put on when painting. The
   `<select>` is now a type-to-filter field with a datalist, like the planner's "I want" bar.
   Without game data the calculator is empty, as decided in step 2.
   - **Unpackaging joined the Converter in `fakeSource()`** — the fourth time a raw resource
     slipped in as a made part. Twelve `Recipe_Unpackage*` recipes gave twelve cycles (crude oil
     made from packaged oil made from crude oil); a recursive calculator would have blown the
     stack, and the planner was saying crude oil comes from a Packager. Zero cycles without them,
     across every combination of standard recipes. `computeProduction` still carries a cycle
     guard in case a game update brings one back.
   - **The filter is the real one, not the tier** (item 2 below). A part is offered if any of its
     recipes is in the unlocks of a schematic this save has completed — milestones, MAM, events,
     shop. Rust now publishes every schematic class in `ProgressInfo.schematics`. On `Lurra bi`
     the tier filter offered 17 parts; this offers 23. **If the list comes back empty, every part
     is shown**: empty means "could not read it", not "nothing unlocked".
   - **Eight parts have several standard recipes** and nothing in `gamedata` ranks them: Biomass
     (4), Alien Protein (4), Power Shard (4), Plastic, Rubber, Fuel, Aluminum Ingot and Turbo
     Rifle Ammo (2 each). `canonRecipe()` keeps the ones the open save has unlocked and, among
     those, catalogue order — not a favourite, just never a recipe the player cannot make. The
     planner gets the same choice. When more than one is left, the result says so in one line.
     Preferring the earliest unlock was tried and dropped: it fixes Biomass and worsens Plastic,
     Fuel, Aluminum and Turbo Rifle Ammo. Note what catalogue order gives on `Lurra bi`, where all
     four Biomass recipes are unlocked: Biomass from Alien Protein, not from Leaves. The line under
     the result says so. **The real fix is to let the player choose**, and that is separate work.
     Two catalogue quirks in that list: "Alternate: Pure Aluminum Ingot" has a class without
     `Alternate` (`Recipe_PureAluminumIngot_C`), so it counts as standard; and the two Turbo Rifle
     Ammo recipes share one display name, so the line cannot tell them apart.
   - **Known limitation:** `extract_schematics` returns every schematic path in the save, not only
     completed ones, plus classes that are not schematics (`BP_SchematicManager_C`,
     `BPD_ResearchTree_*`). Those match nothing in `gamedata.schematics` and do no harm. If an
     active milestone not yet finished were in the list, the calculator would offer its parts a
     little early — which, by the fog-of-war rule, is better than hiding them.
4. **Stop writing beautified names into the snapshot.** Smaller than it looks: `renderStored`
   already takes classes, and `storedByClass` is computed on the line beside the one that is
   actually stored (`stored: toCounts(a.stored)`). Verify whether `production`, `consumption` and
   `deficits` have a class-keyed twin available at the same point; if not, that is the real work
   here.
5. **Migrate the history.** Bump the metrics `schema` to 2 and resolve old names to classes through
   `nameIndex()`, which indexes every language and so handles the Spanish and English entries
   together. Budget for the orphans: the app's own older Spanish may be recoverable with a short
   alias table (five or six entries covers most of the 39), the de-camel-cased asset names are
   probably not. Do not silently drop a snapshot — a chart with a gap is honest, a chart quietly
   missing a year is not.
   **Steps 4 and 5 done together, 25 Nov 2026 — metrics schema 3** (2 had gone to byproducts).
   - *Step 4.* `production`, `consumption` and `deficits` are written by class through `a.clsOf`,
     `stored` from `a.storedByClass`. A name with no known class is written as is rather than
     dropped. `collectables` was already classes. `types`: Rust already emits `cls` on every new
     snapshot (it is a `String`, not an `Option`); the 1365 old entries with an empty `cls` were
     left alone, since `invName` recovers their class at read time.
   - *Step 5.* Old names resolve in `src/migrate.ts`, in order: `nameIndex()`; the mechanical
     inverse (remove spaces, try `Desc_X_C`, `BP_X_C`, `X_C`); and a one-off map of the app's own
     old Spanish, eight entries, commented as migration, not translation. On the real history:
     108 distinct names, 47 by the index, 49 by the inverse, 8 by the old-Spanish map, **4 left**
     (`Hard Drive`, `Boom Box`, `BP_Equipment Descriptor Cup`, `BP_Item Descriptor Portable
     Miner` — not in the catalogue) and keeping their strings. In entries: 1393 resolved, 63 kept,
     22 snapshots. The alias table turned out to need eight, not "five or six", and the
     de-camel-cased names were the easy part, not the lost cause.
   - Rust writes: `migrate_history` takes the name map, **writes a backup first**
     (`pre-schema3-<stamp>.json`, see `docs/BACKUP.md`) and writes nothing if that fails, then
     renames and saves atomically. Nothing is dropped; if two old names land on one class they
     are summed into one entry. It runs at startup once game data is loaded, and again after a
     restore, since an old backup can bring schema-2 snapshots back. Without game data it does
     not run.
   - Verified with a Rust test against a **copy** of the real `history.json`: 55 snapshots in, 55
     out; the sum of every rate and count unchanged; all 22 at schema 3; a second run does
     nothing. Iron plate is one line across all 20 of `Lurra bi`'s snapshots with production.

### Caveats worth stating before starting

- Steps 4 and 5 touch Rust, the save parser and a migration of real user history. They want their
  own branch and a release behind them, not to be wedged in front of one.
- Step 3 turns a 25-item dropdown into a several-hundred-item one. The tier filter helps, but the
  list needs a thought it has not had.
- `collectables` is already consistent (132 of 132 raw classes). It is the one field that needs
  resolving for display rather than fixing at the source.

## 1. "What the next milestone costs, and what you are missing"

The flagship. Each milestone carries its exact cost — Base Building is 200 concrete, 100 iron
plates, 100 iron rods — and the save already gives the contents of every container and the
Dimensional Depot. Subtract one from the other:

> **Next milestone: Coal Power.** You have 150 of the 150 reinforced plates and 32 of the 100
> rotors. Missing 68 rotors — about 17 minutes at your current rate.

That last clause is the part no other tool can produce, because it needs the live production
figures the app already computes. This is the original question the app exists to answer, and
every piece of it is now in hand.

## 2. Tier filtering that is actually correct

The calculator currently filters recipes by a `tier` number typed in by hand. Every schematic
declares its tier and the recipes it unlocks, so the real unlock graph is available: recipe →
schematic → tier. Replacing the hand-typed numbers removes a whole class of quiet errors, and it
makes the filter exact rather than approximate.

**Done, 25 Nov 2026, with step 3 of section 0** — and by schematic rather than by tier, which is
more exact still: FICSMAS decorations and Alien Protein are opened by an event or by the MAM, not
by a tier, and the tier filter let them through or kept them out for the wrong reason.

## 3. Alternate recipes

109 of them, and the save knows which ones a world has unlocked from hard drives. The calculator
could offer "you have the alternate recipe for this — it would cut your iron use by 30%". That is
a genuinely useful suggestion that depends on knowing both the catalogue and this particular save.

## 4. What your build plan costs

The Plan tab lets you set goals like "30 constructors". Building recipes give the material cost of
each one, so the plan can price itself: "your plan needs 1,200 iron plates and 400 cables". With
stored materials subtracted, it becomes a shopping list.

## 5. Your warehouse, in AWESOME Sink points

168 items carry a sink point value. The stored-materials panel could total it: "your warehouses
hold 2.1 million points". Cheap to add, and it reframes a pile of leftovers as a number that means
something.

## 6. Bilingual, the cheap half

Item, building, recipe and milestone names now come from the game in whichever language we ask
for, keyed by class name. What remains for a bilingual app is only the app's own chrome — tab
labels, headings, messages — which is a contained job. The hand-written `ITEM_ES` and
`BUILDING_ES` tables can be deleted once the fallback path is no longer needed.

## 7. Inventory from the same source as everything else

The building inventory still comes from the Rust string-scan heuristic and is labelled through the
hand-written translation table, so it can disagree with the names shown on the map. Making
`count_buildings` return the class name alongside the count would put the whole app on one
vocabulary. Small backend change, removes a visible inconsistency.

## 8. Byproducts in the calculator's chain

Since `GAMEDATA_SCHEMA` 4 (25 Nov 2026) every recipe carries `byproducts`: the rest of
`mProduct`, per minute, fluids already in m³. 37 of 872 recipes have one — the whole oil branch
(plastic and rubber leave heavy oil residue, fuel leaves polymer resin), nuclear (non-fissile
uranium leaves water, uranium cells leave sulfuric acid), alumina, batteries, and the late-game
recipes that leave dark matter residue. In all 37 the first product is the one the recipe is named
after, so `out` stays the first. One item exists only as a byproduct: Dissolved Silica.

The factory balance already counts them as production, in the full parser and in
`perItemFromRecipeCounts`. **The calculator's chain does not, on purpose.** Today it walks one
recipe per part, back from the goal. With byproducts, the residue a plastic refinery leaves can
feed a residual-fuel refinery, which changes how much of everything else is needed: the chain
stops being a tree and becomes a flow problem, solved as a whole rather than one step at a time.
That is the next piece of work here, not a tweak to `computeProduction`.

Three more things that came with it:

- **Fluid byproducts nobody consumes are named in the balance**, as a fact: "you make 20 m³/min of
  heavy oil residue and nothing consumes it". Fluids only: a solid can go to a container or the
  AWESOME Sink, a fluid only has a buffer, and when it fills the machine stops. Worded as a fact,
  not a prediction, because the app cannot see whether a buffer is in place.
- **The snapshot `schema` went from 1 to 2**: `production` now includes byproducts, so a
  parts/min chart would show a step for anyone with refineries that did not happen in the
  factory. Same case as `recipe_coverage`.
- **Known limitation: `diffGameData` compares only the main product.** The "N changed rate(s)"
  notice after a game update compares `out` and `rate`; a rebalanced byproduct goes unnoticed.
  Not fixed on purpose — noted so nobody trusts that notice for byproducts.

## Later: ask Coffee Stain

Once the app is stronger and more stable, write to Coffee Stain and ask what they are willing to
make available to tools like this one. Their press page is aimed at press and content creators and
states no terms for fan projects, so it grants nothing: it points to emailing them instead. Worth
asking about the map image and whether the FICSIT name can be used in a free tool's title.

Item and building icons are no longer on that list as a blocker: the app now displays them from
the user's own extracted copy and ships none of them (`docs/ICONS.md`). The question to Coffee
Stain becomes a better one — not "may we?", but whether they would rather supply an icon set for
tools like this than have every tool extract its own.

Until there is an answer in writing, the rule stands: nothing of theirs ships with the app, and
anything of theirs the app uses is read from the user's own installation.

The name and the map were evaluated before the first release rather than left to be discovered
later; `docs/LEGAL.md` records what was decided, on what evidence, and what each piece would cost
to undo. The short version: the map borrows nothing, the name is better precedented than the icons
are, and the bundle identifier is frozen so that a rename could never cost a user their data.

## Icons on the map: the blocker is zoom, not the icons

Now that the app can show the game's icons, the obvious next thought is to use them as map markers
instead of coloured shapes. It does not work as things stand, and the reason is worth writing down
so it is not re-proposed every few months.

The map is a single SVG of 720×620 fitted to the pane, with markers of radius 3.4 — about seven
pixels on screen. The game's icons are drawn for inventory slots at 256 and 512 pixels. At seven
pixels they are mud. A mature save has over two thousand buildings, so that is also two thousand
images to decode and paint where today there are two thousand vector shapes.

The accessibility argument is the stronger one. The map's four categories were revalidated against
the dark surface and the best in-band palette leaves 7.6 separation between the closest pair for
deuteranopia, under the 8 the checker wants. That is acceptable **only** because the four shapes —
circle, triangle, square, diamond — carry the category independently of colour. Replacing shapes
with icons would delete that second channel and leave colour alone doing work it cannot do.

So the shapes stay, and icons went where the map has few of something and the size can be read:
the zone list, where each zone shows what it makes.

What would actually unlock icons as markers is **zoom and pan**. The Satisfactory Calculator
interactive map is built on Leaflet with canvas rendering, which is exactly what lets it afford
per-building icons: at close zoom there is room for them, and at far zoom it can draw something
simpler. Our map is a static fit-to-view plan, so it only ever has the far-zoom case. Adding
zoom and pan is the real feature; icons as markers are a consequence of it, not a prerequisite.

## The house rule: the app never reveals what the game has not

Stated by the owner and it governs everything the app says about the world:
**no cheating. The app helps with what you have already seen and know, with the
tasks along the way.**

The save makes this enforceable, because it carries the fog of war.
`FGMapManager.mFogOfWarRawData` is 1,048,576 bytes: 512 × 512 cells of four bytes each. The data
lives in the **third** byte — red and green are zero, alpha is always 255. A quarter of the array
being non-zero is just the alpha channel, so read the byte, not the array.

The grid maps onto the world rectangle the wiki gives, (-3246, -3750) to (4253, 3750) in metres,
with **no Y flip**. That was not assumed: with those bounds, 947 of 947 buildings in one save and
5,839 of 5,839 in another land in explored cells, which is what must happen because a pioneer has
seen their own factory. Flipping Y gives zero percent, so the data fixes the orientation too.

What it enforces today: collectables outside explored ground are **not given a position and not
counted by type**. The panel says how many are still out there and refuses to say where. The map
draws the unexplored ground as a veil.

If the fog cannot be read, nothing is hidden. Withholding things because a parse failed would be
worse than showing them.

This rule should be applied to anything added later that knows more than the player does — resource
nodes above all, since the save locates 1,147 of them whether or not the pioneer has ever been
there.

## FGStatisticsSubsystem: counters the app was not reading

The save carries a statistics subsystem with five counters, and the app ignored all of them while
calling itself a statistics app.

**`mCreaturesKilledCount`** is a map from creature class to kills, and it does **not** group by
family: a real save shows `Char_Hog_C` 99, `Char_SpitterDesertSmall_C` 68,
`Char_SpitterDesertAlpha_C` 11, `Char_AlphaHog_C` 9. Variants are separate entries. That settles a
question the bestiary could not answer any other way — an elite is recorded, by name and count,
without needing the player to save with the creature on screen or to still hold its remains.

The other four: `mConsumablesConsumedCount` (berries, medkits — a medkit count is a danger signal),
`mItemsPickedUp`, `mItemsManuallyCraftedCount` and `mActorsBuiltCount`. The last three nest their
values per player inside a struct, so they have to be summed; the first two are plain class→int.

Still unread and worth doing: a FICSIT statistics panel from the other four. `mActorsBuiltCount`
alone has 115 entries in one save, which is a complete build history by building type.

## What the save does NOT carry about dying

Checked, because it was asked. There is **no death count and no cause of death**. There are no
death crates in any of the three saves examined. The only death-related value in the whole file is
`mNumberOfDaysSinceLastDeath` on the time subsystem — days since, nothing else. Health exists on
creatures and on the player, but as a current value, not a log.

So "you died 7 times, 3 of them to hogs" is not available and should not be promised. Days without
an accident is, and that is already on the vitals panel.

## Hostile fauna: what the save knows, and why there is no to-do list

Every creature nest in the save carries, per creature, `WasKilled`, `NumTimesKilled` and
`KilledOnDayNr`. `BP_TimeOfDaySubsystem` carries `mNumberOfPassedDays`, so a day number becomes
"cleared six days ago", and `mNumberOfDaysSinceLastDeath`, which is a days-without-an-accident
board that writes itself.

Two things the data decided, against the obvious design.

**Proximity is computed here, not read.** Nests carry `mCachedIsNearBase`, which looks perfect and
is not: it is only written when it differs from the default, so its absence means unknown, not far.
Same trap as the generator fuel flag. Distance to the nearest building is unambiguous and the
threshold is ours.

**There is no list of nests to clear.** The first version listed untouched nests near the factory.
Measured against real saves: 26 nests within 150 m of one plant and 59 of another, essentially
none cleared. That is not a backlog, it is what living on this planet looks like — pioneers wall
them off or ignore them, and cleared nests repopulate anyway. So the panel gives the counts, the
nearest one and the last hunt, and stops. A to-do list nobody asked for is worse than no panel.

Worth knowing: the save only contains nests in areas that have been loaded, so 95-99% of them pass
the fog filter already. The filter stays because it costs nothing and the rule is the rule, but the
save was already honest here by construction.

## The map in time: matching blocks between readings

Each snapshot now stores its blocks — centre and machine count, at most forty, nothing else. Not
the index, because indices are recomputed from scratch on every reading, and not the name, because
names depend on the language. **Two readings can only be matched by position.**

Matching runs in two passes, and the second one exists because of a specific failure. A block that
grows drags its centre: with a single tolerance, a block that doubled and shifted eighty metres
reads as one new block plus one that disappeared — two wrong answers instead of one right one.

So: first pass at 60 m tolerance, nearest pair first, each block used once, which settles the
confident matches without letting neighbouring blocks cross-match. Second pass at 150 m over the
leftovers only, where the wide tolerance is safe precisely because everything confident is already
paired and what remains has nothing to be confused with.

Verified against synthetic cases: growth, birth, genuine dismantling, an eighty-metre drift, two
neighbours fifty metres apart, and no change at all. The drift case is the one that drove the
design; the neighbours case is the one that constrains it.

The feature starts empty, by construction. Readings taken before this existed carry no blocks, so
the comparison offers nothing until at least two new readings have accumulated. That is the cost
of any feature that measures time, and the reason to add it early rather than when it is wanted.

## Alerts: which signal in the save can be trusted

A save carries two signals about whether a machine is working, and only one of them is usable.
Writing this down because the tempting one is the wrong one.

**`mIsProducing` looks perfect and is useless.** It is the state at the instant the save was
written, and people save when they stop playing. Measured across three real worlds: 1 of 195
machines producing in one, 0 of 49 in another, 13 of 30 in the third. A machine waiting two seconds
for an iron plate reads identically to one that has been starved for a week. An app that alerted on
this would announce that the entire factory is dead, most of the time, and be ignored within a day.

**The productivity measurement is the real one.** The game keeps
`mLastProductivityMeasurementProduceDuration` over `mLastProductivityMeasurementDuration` — how
much of the last stretch the machine actually produced. It is the game's own readout, and it
discriminates: across the same three worlds it spread from 0% to 100% instead of collapsing to one
value.

The threshold matters as much as the signal. At 60% it fired on 29 of 40 machines in one world,
which is shouting that three quarters of the factory is broken. Running below 100% is normal in
this game and usually deliberate — a smelter fed by a Mk1 miner, a machine using its output slot as
a buffer. Only below 15% is it fair to say the thing is not working. Slow groups are counted in one
line, not listed.

Every building carries a transform, so every alert is locatable, and clicking one takes the map to
that spot.

**Generators out of fuel** are detected too, and that one was settled by ground truth rather than
by inference. The owner said one of his worlds was stopped because its biomass burners had run dry.
The file agreed exactly: all ten generators there carry `mHasFuelCached` as **false**, while every
generator in the other two worlds carries it as **true**. An earlier pass had dismissed this signal
by checking whether the property was *absent* instead of reading its *value* — the property is
present, it is the value that matters.

Two traps around it. `mCurrentFuelAmount` still reports large numbers on dry generators, so the
amount is not the signal. And the hand-crank starter generators do not carry the property at all,
which means "unknown", not "empty".

This also fixed a place where the app was quietly lying. Generation was summed from each
generator's catalogue rating, so a world whose entire power plant had run dry was reported as
generating happily. Dry generators no longer count toward generation, the vitals panel says how
many megawatts are being left out and why, and the alert panel leads with them — because when the
generators are dry, everything else that looks stopped is a consequence rather than a separate
problem.

## The pioneer on the map, and why there is no pedometer

The save carries the player: `Char_Player_C`, with a transform and `mCachedPlayerName`. Worlds
played with others carry one per player, so it is read as a list.

Two things were built from it, and one was deliberately not.

**Built: where you are, and how far away the problem is.** The pioneer is drawn on the map with a
glyph of its own — not another category, because they are not part of the factory, they are the
one looking at it. Every alert now says how many metres away it is. That is what turns "a smelter
has stopped" into a decision: walk, or get the vehicle.

The distance is straight-line. What it costs to get there depends on cliffs, and cliffs are not in
the save.

**Built: a track, as dots.** Each snapshot stores the position, so over time the readings show
where the pioneer tends to be. They are drawn as separate dots, never joined into a line: joining
them would draw a path nobody walked.

**Not built: steps or distance travelled.** This is the one to resist. Autosaves in a real world
land about thirty minutes apart. Between two of them a player can walk five kilometres and come
back to the same spot, and the straight line between the samples would record zero. A number that
can be wrong by that much is not a measurement, and a pedometer that counts every half hour is not
a pedometer. Any future "distance walked" would have to be labelled as displacement between
readings, which is a worse thing to read than no number at all.

## Measuring ourselves against the community tools

Satisfactory Calculator (SCIM) is the reference point and does a superb job. It reads the binary
save into JSON and is a full save editor, built on Leaflet with canvas rendering, with a database
of 551 buildings, 178 items, 887 recipes and 414 schematics, plus support for 93 mods. The official
wiki lists it among the community tools.

Where it is ahead: a zoomable editable map, mod support, resource and collectable markers on the
world map, and nothing to install.

Where this app is a different thing rather than a worse one:

- **It never uploads anything.** SCIM works by sending the save to a website. This app reads the
  file where it already is and has no server at all.
- **It reads the game's own documentation** from the user's installation, so recipes and buildings
  are current the day the game updates, instead of being a database someone has to maintain.
- **It watches time.** SCIM shows a save as it is now. This app records snapshots and can answer
  how the factory changed — power over time, growth, monthly medals. That is the thing none of the
  upload-a-save tools do, and it is where the app should keep pushing.
- **It never writes to a save.** Not a missing feature: a rule.

The honest summary is that SCIM is a better map and a better editor, and this is a better logbook.
Trying to out-map them would be a losing race; being the thing that remembers is not.

## Not worth doing

- **Bundling the game's data files.** They are Coffee Stain's. Reading the user's own copy is both
  correct and always current.
- **Supporting modded recipes properly.** What a modded machine produces lives in the mod, not in
  the save. Counting them and saying where they come from, which the app already does, is the
  honest limit.

## The name

The app is called OttO. FICSIT is Coffee Stain's fictional company, so the name leans
on something that is clearly theirs — a bigger borrow than the icons ever were, and it sits in the
repository title, the window title and every screenshot. This is on the list to ask them about,
alongside the icons.

If it has to change, the brief Zigor set is a good one: **the short form should sound like serious
industrial software, and the expansion should be the joke.** That is exactly how the game does it —
FICSIT sounds like a real contractor until you read what the letters stand for.

Candidates, kept here so the thinking is not lost:

| Short | Expansion (ES) | Expansion (EN) | Why |
|---|---|---|---|
| **MIRA** | Módulo de Inventario, Rendimiento y Almacén | Machine Inventory & Resource Analytics | *Mira* means "look". A whole department that exists to look at things. Also a famous variable star. |
| **VELA** | Vigilancia de Energía, Logística y Almacén | Vigilance, Energy, Logistics & Assets | *Velar* is to stay awake watching over something, which is what it does while you sleep. A southern constellation. |
| **OTTO** | Observatorio de Tasas, Transporte y Operaciones | Observatory of Throughput, Transport & Operations | Palindrome, sounds like a foreman, brushes against *auto*. An entire observatory to count conveyor belts is the kind of excess FICSIT would fund. |
| **EVA** | Evaluación de Vigilancia y Alrededores | Extravehicular Analytics | Started as a joke about ADA being Adam — ADA is female, so that does not land. But EVA means Extra-Vehicular Activity, which is what a pioneer does every time they leave the HUB. |

Mira and Vela are both stars, so there is a naming system there already if the project ever grows
more pieces, instead of inventing one name at a time.

Zigor picked OTTO, and then saw the thing that makes it work: **O T T O written out is two eyes with
a nose between them.** For an app whose whole job is watching a factory, a name that is already a
face watching you is not a pun you have to explain.

A sketch is in `branding/otto-sketch.svg`. The rule learned while drawing it: it has to still spell
OTTO, with **both** T's. The first attempt fused them into a single T and the logo spelled OTO — a
mark that misspells the name is not a mark, however good the face looks. The two T's sharing one
crossbar solves it: two letters, one nose.

Drawn at 196, 84 and 45 px, because small is where these either work or die. The face reads at
large sizes; at favicon size it reads as a wordmark, which is the right way round — the joke is for
whoever leans in, not a requirement for the icon to function.

Then Zigor spotted the better version: **OttO**, capital O and lowercase t. It is not a cosmetic
change. A lowercase t is shorter and carries its crossbar halfway down, so the eyes dominate and the
nose stays small in the middle; two capital T's put so much weight in the centre that the face
disappears. He also noticed the same shape reads as the front of a truck — two headlights and a
grille — and that people seeing different things in it is the point, not a flaw: they are looking
with their own eyes.

The sketch now uses lowercase t's with curved feet, which is what makes them read as typography
rather than two posts.

That rule has now failed three times, in three different ways, which is why it is written in the
file itself: fusing the t's spelled OTO, joining them at the foot spelled OtJO, and giving them a
second crossbar spelled O#O. The moment the letters stop being letters it does not matter how good
the face looks.

### Why the name fits the game, and where to stop

The game's own vehicles are named flatly and functionally — Tractor, Truck, Explorer, Factory Cart,
Cyber Wagon — and then the pioneers hang nicknames on them. The Truck is "The Unit". The Tractor is
"Sugarcube", which the wiki explains as a double joke: it is "pretty sweet, y'know?" and the frame
is a cube. The in-game copy runs the same way; the Explorer is sold as designed by "our best Vehicle
Designers™ … *Wifi hotspot not included". Plain name, mischief in the small print.

That is the same rule Zigor set for the acronym, and it is why OttO sits inside the game's culture
rather than next to it: a blunt short name carrying a second meaning in its shape. The pattern is
borrowed, which is fine. Patterns are not owned.

**Where to stop: do not tune the mark against their vehicles.** Two round headlights with a grille
between them is a universal industrial shape — tractors, lorries, locomotives, a Land Rover. Nobody
owns it, and that is exactly why it is safe to use and why it reads instantly. Matching the
Satisfactory Truck's actual front would put the logo back where the icons were: depending on a
permission we do not have, for a gain we do not need. The mark already sounds like that world
because it uses the genre's grammar, not because it copies a specific asset. That is the stronger
position, not the weaker one.

**The cost is not the name, it is the identifier.** `com.rogiz7.otto` decides where the
app's data lives. Changing it orphans the history — 45 readings for Lurra bi at the time of
writing. The displayed name is free to change; the identifier needs a deliberate migration that
moves the folder first and verifies the readings survived, or it must simply stay as it is. Those
are two separate decisions and should not be made in the same breath.

## Seeing it while you play

Zigor plays fullscreen, so the app is behind the game while the factory is actually running. Two
very different ways to fix that, and they should not be confused with each other.

**A floating window.** Tauri can make a window always-on-top, borderless and remembered in size and
position, and the app can have a compact mode that shows only what you picked — alerts, power, one
chart. That is a weekend of work, breaks nothing, and keeps every rule the project has: it still
only reads the `.sav` file, it still never touches the game. The catch is that an overlay only
survives **borderless** fullscreen, not exclusive fullscreen, where Windows hands the whole screen
to the game and nothing else is allowed to draw. That is a setting in the game's own options, not
something the app can work around, and it has to be said plainly rather than discovered.

**A mod.** Rendering inside the game means Satisfactory Mod Loader, Unreal, C++ and Blueprints,
distribution through ficsit.app, and a rebuild every time the game updates. It is a different
codebase and a different skill, not an extension of this one.

It also costs the project its central promise. Right now the honest pitch is *it reads the file the
game already wrote, and it cannot break your save because it never writes anything and never
touches the running game*. A mod loads code into the game process. Live data would be better data —
no waiting for an autosave — but the thing that makes this app safe to recommend to a stranger
would be gone, and every mod-related crash report would land here first.

So: the floating window is a real feature of this app. The mod is a different project that happens
to share an author. If both ever exist, they should be two things, and the one that cannot break
anything should stay the one that carries the name.

## The planner: laying a factory out before you build it

Zigor's idea, and the strongest one the project has had. Not a calculator — those exist, SCIM has a
good one and so do we. A **layout**: pick a room size, drop machines into it, snap them to a grid,
see whether they fit and how much space is left, with the production target driving how many of each
you need.

The pain he named is specific and real: *tearing down something you did not like costs as much time
as building it, or more.* Nobody is solving that. The game's own blueprint designer is deliberately
limited to a small box. SCIM computes ratios but has nowhere to put them. Between those two there is
nothing.

**The foundation checks out.** `mClearanceData` in the game's own documentation carries the real
bounding box of every building, in centimetres. Measured against a real install:

| Building | w × d × h (m) |
|---|---|
| Constructor | 8 × 10 × 6 |
| Smelter | 5 × 10 × 4.5 |
| Assembler | 9 × 16 × 3 |
| Manufacturer | 18 × 12 × 11 |
| Foundry | 10 × 10 × 4.5 |
| Refinery | 10 × 22 × 15 |
| Miner Mk1 | 6 × 14 × 4 |
| Coal generator | 10 × 26 × 9 |

11 of 12 tested have a box. The exception is the conveyor belt, which has none — belts are splines,
not boxes. That exception is the whole shape of the hard part (below).

So we already hold: real footprints, a map in world metres, official recipes and rates, fog of war
so you only plan where you have actually been, and **every machine you have already built, with its
position and its recipe**. That last one is the part no website can match. A site gives you a blank
page; this can open the plan on top of the factory that already exists.

### Why it is still risky

Not the data. Two other things.

**Drawing tools live or die on feel.** Drag, snap, undo, nudge one metre with an arrow key. If that
is rough, nobody uses the tool no matter how right the numbers are. It is a lot of interface work
and it cannot be done halfway.

**Belts are the actual hard problem**, and the fact that they are the one thing without a clearance
box says why. Placing machines and drawing which feeds which is tractable. Answering "will the belts
physically route through here" is a different and much harder question, and promising it before it
works would be the worst thing this feature could do.

### Where to start

Not the map. Zigor did not describe a world-scale planner — he described *a ten by ten room where
you put machines and then comes the madness of connecting them.* So: **one room**. Give it a size,
drop machines, snap to grid, say whether they fit and how much floor is left, with the production
target setting the counts.

That is small enough to find out whether the feel is right before committing to a spatial editor,
and it answers the real complaint — "do I like this before I build it" — on its own.

### The belt problem, solved by not solving it

Zigor's answer to the hard part, and it is the right division of labour: the planner does the
arithmetic and the fitting, the **game** does the belts — it is the thing with real physics and real
snapping — and the pioneer finishes it by hand, which he wants anyway because layouts are personal.

Both halves of that check out against the game's own data.

**Belt tier is computable exactly.** `mSpeed` divided by two is items per minute, and it matches the
game: Mk1 60, Mk2 120, Mk3 270, Mk4 480, Mk5 780, Mk6 1200. Lifts carry the same table. Combined
with the recipe rates and the tier derivation we already have, the planner can say *this line is
540/min, you need Mk4, and you only have Mk3 unlocked — run two Mk3 lines or research Mk4.*

**The blueprint designer has a hard limit, and it is in `mDimensions`,** counted in 8-metre
foundations: Mk1 is 4×4×4 (32 m cube), Mk2 5×5×5 (40 m), Mk3 6×6×6 (48 m). So the planner can say
*this fits in a Mk1* or *you are four metres over, split it here* **before** anything is built. That
is precisely the demolition the whole feature exists to prevent.

**What not to build: a `.sbp` exporter.** The blueprint format is binary and undocumented; it would
have to be reverse-engineered by trial and error, and a malformed blueprint could break the designer
or worse. It also breaks the rule that makes this app safe to recommend — we do not write anything
the game reads.

And it is not needed. The handoff is not a file, it is **a plan you can follow**: each machine with
its position and facing, the total footprint, which designer tier it needs, and the belt tier each
line requires. The pioneer builds it in the game, where belts behave properly, and the design stays
his.

### A medal for finishing your own plans

Zigor again, and it closes the loop: plan it here, build it in the game, and **the app notices and
gives you a medal for it**. His reasoning is the part worth keeping: *the point is always to play the
game*, so the app should push you back into it rather than hold you here.

It measures something no tool in this space measures. Every calculator tells you what to produce.
None of them tell you whether you **finish what you start**.

And it needs nothing new to detect. The save already carries every machine with its class and
position. The trick is to **match composition inside a zone, not coordinates**: you planned three
smelters and two constructors, and somewhere in the world a cluster now contains at least that. It
will be rotated and twenty metres off from the plan, and it is still the same plan. Zone clustering
already exists and has been running for months.

What not to do: require the pioneer to tick a box saying "I built it". If the app can see it, the
app should see it.

### Truck or train, for factories far apart

Also Zigor's. Half of it is already certain and half needs checking, and the two should not be
promised together.

**Certain:** distances between zones are already computed in metres, and belt throughput per tier
is now extracted from the game's own data. So *this line needs 540/min over 1,200 m, and Mk3 does
not carry it* is answerable today.

**Not checked:** the economics. Material cost of a belt per metre, cost of a train station, fuel a
truck burns over a route. That is probably in the documentation, but it has not been looked at, and
until it has, the comparison should not be offered. Saying "a train pays off here" on unverified
numbers would be worse than saying nothing.
