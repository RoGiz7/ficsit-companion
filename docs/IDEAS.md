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

The app is called FICSIT Companion. FICSIT is Coffee Stain's fictional company, so the name leans
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

**The cost is not the name, it is the identifier.** `com.rogiz7.ficsitcompanion` decides where the
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
