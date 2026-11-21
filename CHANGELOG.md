# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Bilingual interface (English / Spanish) with a language switcher in the top bar.
- Automatic detection of the Satisfactory save folder, with the chosen folder remembered between
  runs.
- "About" panel with project, author and donation links.
- Project documentation: bilingual README, MIT license, security policy and this changelog.

### Changed
- Project metadata is no longer the Tauri starter template.

### Fixed
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
