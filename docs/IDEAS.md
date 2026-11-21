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
asking about item and building icons, the map image, and whether the FICSIT name can be used in a
free tool's title.

Until there is an answer in writing, the rule stands: nothing of theirs ships with the app, and
anything of theirs the app uses is read from the user's own installation.

## Not worth doing

- **Bundling the game's data files.** They are Coffee Stain's. Reading the user's own copy is both
  correct and always current.
- **Supporting modded recipes properly.** What a modded machine produces lives in the mod, not in
  the save. Counting them and saying where they come from, which the app already does, is the
  honest limit.
