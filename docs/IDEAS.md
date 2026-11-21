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
