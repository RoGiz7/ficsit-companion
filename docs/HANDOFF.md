# Handoff

For a session picking this project up cold. Written 25 Nov 2026.

The owner is Zigor (GitHub `RoGiz7`), in Santander, Spain. **He works in Spanish; the repository is
in English.** Both, always — code, comments and docs in English, conversation in Spanish.

OttO is a free Tauri v2 desktop app that reads Satisfactory save files and tells a pioneer how
their factory is doing. Repo: `RoGiz7/otto-satisfactory`. Current release **v0.3.0**.

## Rules that are not negotiable

- **Claude never pushes and never publishes a release.** Zigor runs `npm run tauri dev`,
  `npm run tauri icon` and `git push` himself and pastes the output. Committing locally is fine.
- **The private signing key is never seen and never committed.** The public key only.
- **Nothing of Coffee Stain's ships** — no `Docs.json`, no icons, no map art, no game screenshots,
  in the app or the repo. Anything of theirs the app uses is read from the user's own installation.
  See `docs/LEGAL.md` and `docs/ICONS.md`.
- **The app only ever reads `.sav` files. It never writes to one.**
- **The app never reveals what the game has not revealed.** The fog-of-war rule, in `IDEAS.md`.
  Stated by Zigor and it governs everything the app says about the world.
- **Only the world `Lurra bi` has real data.** The other two saves are nearly empty; measuring
  anything against them proves nothing.
- A session of this type **cannot create or edit GitHub releases** — the API answers 403. Reading
  them works. Zigor publishes and writes release notes himself.

## The working method, which has earned its keep

This is the part most worth inheriting. Four habits, each of which has caught a real bug here:

1. **Measure against his real save before trusting a signal.** His data lives at
   `com.rogiz7.ficsitcompanion/` (`gamedata.json`, `history.json`). Nearly every finding in
   `IDEAS.md` came from reading it rather than reasoning about it.
2. **Render it and look before shipping anything visual.** Three bugs in one day were visible only
   in a screenshot of the running app and in no reading of the code.
3. **Verify a helper's name before calling it.** Invented `itemName`/`recipeName` once; the real
   ones are `gdItemName` and a local `nomReceta`.
4. **Put assertions in every edit script, so a wrong guess writes nothing.** Substitutions assert
   an exact occurrence count. This has stopped several bad edits mid-flight, including one that
   would have broken a fresh install's first-run path.

A pattern worth naming, because it has recurred: **a rule written for a specific case where a
generic one was needed.** The missing `.hidden` class, `input[type="number"]` instead of all
inputs, unstyled checkboxes — all the same shape.

## Traps that have bitten more than once

- **`Build_Converter_C`** converts anything into anything, so it pollutes any "what makes X" query.
  `canonRecipe()` already excludes it. **Reuse it; do not re-derive.** It has caught this project
  three times.
- **`mStackSize` is an enum**, not a number (`SS_ONE`/`SS_SMALL`/…/`SS_FLUID`). Container capacity
  in items would need a hand table. This is why "minutes of buffer" was not built.
- **`tauri_build` does not watch `icons/`.** Regenerating icons alone will not rebuild, and the
  executable keeps the old one. `build.rs` now has `cargo:rerun-if-changed=icons`; a stale
  executable once masked a real icon-geometry bug and cost an afternoon.
- **Git leaves `.lock` files it cannot delete** in a connected folder unless the session has been
  granted delete permission, and the next git command then fails with `File exists`. Ask for
  deletion permission on the project folder early.
- **Regex over the stylesheet backtracks into things it should not.** A `border-radius` sweep once
  ate the four intentional 50% circles. Count what you changed and check the count.

## Design language, in one paragraph

Satisfactory's UI: **no rounded rectangles anywhere** — there is no `rx` left in the project and
none should return. Circles are full circles. Active means an orange fill with dark text, never an
underline. Section headers are full-width bands, counts are orange keycaps, the primary action is a
wide amber-to-orange gradient. Orange fills are always narrow: a full-width orange row is too loud,
which was only discovered by rendering it. Validate any palette with
`node scripts/validate_palette.js "<hex,…>" --mode dark --surface "#1b1f27"` rather than by eye —
within this warm palette almost no three-colour severity scale survives deuteranopia.

## Where things stand

Released: v0.3.0. Since then, on `main`:

- Storage panel (`src/buffers.ts`) — what a container actually does, with his 31.
- README screenshot galleries, both languages (`docs/img/`).
- **Uncommitted at the time of writing:** the bilingual fix described below.

### Just done: the app was half in Spanish when set to English

Found by asking Zigor for English screenshots for the README. Two distinct bugs under one symptom:

1. **Thirteen hand-written Spanish strings** that never went through `i18n.ts` — world-progress
   labels, the calculator's `/min de` and its button, the log form placeholders, the map's
   `sobre el suelo`, the whole map legend, the save-list chips, `minero(s) Mk1`. Plus
   `describeDiff`, which took a `lang` parameter, used it for recipe names and then wrote all its
   own prose in Spanish regardless.
2. **Blocks drawn exactly once at startup**, which the language button never redrew: the settings
   panel, the planner's machine palette and the plan itself. There is now a `relocalize()` that
   redraws them, and `showGameData()` stores *how* the game-data block was drawn rather than the
   text it produced, so it can be drawn again in the other language.

The calculator turned out to run entirely on a hand-written 25-recipe table keyed by Spanish names,
which is why its frame translated and its contents did not. Its keys cannot simply be renamed — the
saved history is indexed by them — so names are now translated at paint time through `nameIndex()`,
which knows every language. Verified: 36 of 36 names resolve against his real `gamedata.json`.

That audit then found a **data** bug: the table sent iron, copper and caterium ingot to
`Fundición`, which is the game's word for the **Foundry**. They come from the Smelter, `Horno`.
Wrong in Spanish too, for months, and invisible until English made it read as *Foundry*.

**Still pending: Zigor has not yet eyeballed the calculator in the running app.** Everything else
in the change he has confirmed from screenshots. If the calculator is off, start there.

### Next, and it is already specified

`docs/IDEAS.md` section 0, *One vocabulary*. Zigor asked for master tables generated from the game
data; they already exist as `gamedata.json`, and four hand-written tables still shadow them. The
evidence, the five steps in order, and the caveats are all written down there. Steps 1 to 3 are
safe and independently verifiable; steps 4 and 5 touch Rust, the save parser and a migration of his
real history, and want their own branch with a release behind them.

Also open, from the same file: milestone costs with what he is missing, sink points (191 items
carry `mResourceSinkPoints`), the build-plan shopping list, and the `FGStatisticsSubsystem`
counters.

## Checks before handing anything back

```sh
npx tsc --noEmit                 # must be clean
npx vite build --outDir /tmp/x --emptyOutDir   # dist/ may be undeletable without permission
node scripts/check-release.mjs   # the three versions, the pubkey, the endpoint
```

For anything touching translation, check that no key is used without being declared and that every
entry has both languages. For anything touching the recipe tables, re-run the audit against his
`gamedata.json` — buildings and rates both.
