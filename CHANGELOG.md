# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Achievements: FICSIT's performance review.** A new tab grading each calendar month per world on
  the game's own scale — mediocre, adequate, efficient — across seven monthly medals, plus a wall
  of one-off certifications. Nothing is stored: everything is recomputed from the history, so a
  medal added tomorrow still appears dated when it was actually earned. Thresholds were calibrated
  against a real history rather than guessed, and they are plain data, easy to retune.
- **Backups.** History, notes and plans are copied automatically once a day, the last ten are kept,
  and a copy can be made on demand. **Restoring merges rather than replaces**: history is
  cumulative, so combining two copies always yields at least as much as either alone, and a button
  that could wipe months in one click should not exist. Game data is deliberately excluded — it
  rebuilds itself from the game. See `docs/BACKUP.md`, which also carries the rule for deciding
  whether anything added later belongs in the backup, and at what level.
- **Next milestone, and what you are missing for it.** The game publishes the exact cost of every
  HUB milestone and the save knows what is sitting in your containers, machines and Dimensional
  Depot, so the app now subtracts one from the other: the next pending milestones, item by item,
  with a progress bar and — for anything you are already producing — how many minutes of current
  output would close the gap. Completed milestones are inferred from the schematic paths present
  in the save, which is approximate, and the panel says so.
- **The game's own documentation as the source of truth.** Satisfactory ships every recipe, item,
  building and milestone — translated into every language it supports — in
  `CommunityResources/Docs`. The app now finds that folder in your own installation (Steam library
  folders and the usual Epic paths), reads the Spanish and English files, distils out what it needs
  and caches the result. It is re-read only when the game updates, and when that happens it reports
  what changed: recipes added, rates altered, buildings added. Those files are never bundled with
  the app — they are Coffee Stain's, and they are read from your own copy.
  Everything is keyed by class name rather than by a translated string, which is what makes a part
  the same part in both languages. Milestones and MAM research are extracted too — tier, exact
  cost, build time and what each unlocks — ready for the features that will use them.
- **Save compatibility check.** Each save's header is now read with the parser library instead of
  hand-rolled byte offsets, which takes about half a millisecond per save. The saves list shows
  whether a save needs mods (and which ones, with versions), whether it was written in an older
  format than your newest save, and whether creative mode was on.
- Biomass recipes (from leaves, wood and mycelia), Solid Biofuel and Smart Plating, which were
  missing from the recipe tables entirely even though they are among the first machines anyone
  builds. `RECIPE_OUTPUT` entries can now carry their own ingredient list, which matters for parts
  that can be made several ways: biomass consumption depends on which recipe the machine is set to,
  and a single recipe per part cannot express that.
- **Honest reporting of what the app cannot interpret.** The save is read in full, but the recipe
  tables only know the base game, so a modded machine produces something the app has never heard
  of. Instead of silently dropping those machines, it now counts them and says where they come
  from. Modded recipes and base-game recipes are reported separately and worded differently: a
  modded recipe is something only the mod knows, while a missing base-game recipe is the app's own
  gap and says so. Snapshots record the coverage figure, so history knows which numbers to trust.
- **Rich history snapshots.** Every snapshot now stores what the save actually contained: tier,
  milestones and research, machines with a recipe and how many are overclocked, estimated power
  consumption and generation, production and consumption per item, the deficits found, stored
  materials, uncollected collectables, detected floors and the factory's extent in metres. The
  format is versioned (`schema`) and every new field is optional, so existing histories keep
  loading. This is the groundwork for achievements and medals: history that is not recorded today
  cannot be reconstructed tomorrow.
- Snapshots that were recorded before this change are **upgraded in place** the next time that save
  is opened, so the existing history fills itself in instead of staying poor forever.
- "Import my saves" now parses each save properly instead of only dating it, which rescues the
  metrics of the rotating autosaves before the game overwrites them.
- **Bilingual interface (English / Spanish)** with a switcher in the top bar, no restart needed.
  The app picks your browser's language the first time and remembers your choice. Game terms —
  items, buildings, recipes, milestones — come from the game's own documentation in the chosen
  language rather than from a translation table, so they match what you read in-game. Switching
  language re-reads the open save, since those names come out of the analysis.
  One gap: the fallback tables used when the game is not installed are Spanish-only, so English
  without the game shows Spanish part names.
- **Automatic detection of the save folder.** The path used to be hardcoded, complete with a
  Windows username and a Steam ID, so the app worked on exactly one computer in the world. It now
  looks where the game actually saves (Windows, and the Steam Play and Epic paths on Linux), lists
  the account folders that really contain saves, and picks the one with the most recent game. The
  chosen folder is remembered between runs, and if nothing is found the folder box opens by itself
  with an explanation instead of leaving the app blank.
- "About" panel with project, author and donation links.
- Project documentation: bilingual README, MIT license, security policy and this changelog.

### Changed
- **The Summary tab now fits on one screen.** It kept stacking eight blocks vertically. Progress,
  inventory, stored materials, exploration and evolution are now collapsible sections, closed by
  default and remembering whether you left them open; "Resume here" and the vitals stay in view.
  The production calculator collapses the same way. Built on native `<details>`, so it works with
  the keyboard and needs no library.
- The save folder row is collapsed behind a heading, since it is set once and then never touched.
  It opens by itself if the folder turns out to be unreadable.
- Empty sections hide themselves instead of showing a header that leads nowhere.
- Project metadata is no longer the Tauri starter template.

### Fixed
- The game version no longer shows as "unknown" for older saves. It was being read by searching the
  decompressed body for a `++FactoryGame` marker that simply is not present in saves from earlier
  versions; the build number is now taken from the header, where it always is.
- Non-game `.sav` files living in the save folder (`ServerManager.sav`, `TelemetrySettings.sav`) are
  now ignored instead of being parsed as worlds.

## [0.1.0] - Pre-release

First working version, developed before the project was put under version control.

### Added
- Save detection and folder watching, with automatic refresh when the game saves.
- Save header reading: world, session, play time and game version.
- Factory inventory: machines grouped and counted by type.
- Real production per machine from the save, including overclock, with estimated power draw.
- Bottleneck detector: production minus consumption per item, with a suggestion of how many
  machines would close the gap.
- Production calculator: target rate to machines, chain and raw materials.
- Evolution history: one snapshot per save, with a chart over time.
- Logbook: notes per world.
- Build plan: goals per machine type with progress bars.
- Stored materials from containers and the Dimensional Depot.
- 2D factory map with machines by category, conveyor belts and automatic floor detection.
