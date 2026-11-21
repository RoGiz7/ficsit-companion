<h1 align="center">FICSIT Companion</h1>

<p align="center">
  🇬🇧 <strong>English</strong> ·
  <a href="README.es.md">🇪🇸 Español</a>
</p>

<p align="center">
  A local-first, open source desktop app for <strong>Satisfactory</strong>: it reads your save
  files and tells you what you have built, how it has grown, and what is missing.
</p>

<p align="center">
  <a href="https://github.com/RoGiz7/ficsit-companion/releases">⬇️ Releases</a> ·
  <a href="https://ko-fi.com/rogiz7">☕ Buy me a coffee</a> ·
  <a href="https://github.com/RoGiz7/FICSIT-Factory-Manager">🌐 Sister project (web)</a>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0a7bbd">
  <img alt="UI languages" src="https://img.shields.io/badge/UI-English%20%7C%20Espa%C3%B1ol-ff9e3d">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Price" src="https://img.shields.io/badge/price-free-brightgreen">
</p>

> Built for the community: free, non-commercial, and not trying to compete with anyone.

FICSIT Companion runs on Windows, and the whole interface is available in **English and Spanish** —
switch language from the top bar, no restart needed.

## 🎯 What makes it different

Most Satisfactory tools are calculators: you type what you want to build and they tell you the
ratios. Useful, but they know nothing about *your* factory.

This one starts from your save file. It reads what you have actually built — every machine, its
recipe, its overclock — and keeps a local history across saves, so it can answer the question that
made this app exist:

> *"I came back after two weeks. What was I doing, and what do I do next?"*

Because it stores a snapshot every time you save, it can show you your factory growing over weeks,
compare what you planned against what you built, and point at the item that is actually short.

## ✨ What's in it

- ↩️ **"Resume here"** — open a world and it tells you what changed since your last save, shows your
  own note, flags current bottlenecks and points at the next milestone. The reason this app exists.
- 🔍 **Finds your saves by itself** — detects the game's save folder, groups saves by world, and
  watches the folder: save in-game and the app refreshes on its own.
- 🏭 **Factory inventory** — every machine you own, grouped by type and counted.
- ⚙️ **Real production** — the exact recipe running in each machine, including overclock, turned
  into output per minute and estimated power draw. Read from the save, not guessed from a plan.
- 🧮 **Bottleneck detector** — production minus consumption, item by item. When something is short
  it says how many machines would close the gap, and marks them in red on the map.
- ⚡ **Power balance and factory health** — estimated consumption vs generation with the margin left,
  rolled up into a 0–100 health score.
- 📈 **Evolution** — a chart of your factory over time, built from a snapshot per save.
- 🧭 **Progress** — current tier and milestones, read from the save.
- 📝 **Logbook** — notes per world, so future-you knows what past-you was in the middle of.
- 🎯 **Build plan** — set goals per machine type and watch the progress bars fill.
- 🧮 **Production calculator** — pick a target rate and get the machines, the chain and the raw
  materials. It is **tier-aware**: it only offers what that world has actually unlocked.
- 📦 **Stored materials** — what is sitting in your containers and your Dimensional Depot.
- 🔭 **Exploration** — collectables and drop pods still waiting out there, uncollected.
- 🗺️ **2D map** — a top-down plan of your factory with machines by category, conveyor belts traced
  from the save, and **automatic floor detection** so a multi-level build reads as separate levels.
- 🔒 **Read-only by design** — the app opens your saves to read them and never writes to them.

## 🗺️ Roadmap

- **Achievements and medals** — a monthly series built from your own local history: milestones hit,
  machines raised, bottlenecks cleared. Your factory's story, told back to you.
- **Compare two saves** — a diff between any two snapshots.
- **Blueprint library** — read the `blueprints` folder and show what each one costs to build.
- **Game map underlay**, zoom and pan.
- **First packaged release** — signed-ish installer and automatic updates.

## ⬇️ Install

No installer is published yet — the first release is still being prepared. For now you can build it
yourself:

```bash
git clone https://github.com/RoGiz7/ficsit-companion.git
cd ficsit-companion
npm install
npm run tauri dev      # run it
npm run tauri build    # build an installer
```

You will need [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) and the Visual Studio
C++ build tools. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

When releases do arrive, Windows will show a **SmartScreen** warning ("Windows protected your PC")
because the app is not signed with a certificate yet. Click **More info → Run anyway**. This is
normal for indie apps.

## 🔒 Privacy

Everything is local. The app has no server, no account and no telemetry: it reads the `.sav` files
already on your disk and stores its notes, plans and history in your own user folder. Nothing is
uploaded anywhere, and your saves are never modified.

## 🙏 Credits

- **Coffee Stain Studios** for Satisfactory.
- [@etothepii/satisfactory-file-parser](https://github.com/etothepii4/satisfactory-file-parser) for
  reading the save format.
- Built with [Tauri](https://tauri.app/), Rust and TypeScript.
- Designed and written side by side with **Claude** (Anthropic). This project is openly
  AI-assisted: the ideas, the decisions and the testing are mine, the pair programming is shared,
  and the commits say so.

## ⚠️ Disclaimer

Satisfactory, FICSIT and their logos are trademarks of **Coffee Stain Studios**. This is an
unofficial third-party fan project, **not affiliated with or endorsed by Coffee Stain Studios**.

## ☕ Donations

The app is free and always will be. If it saves you some time and you feel like buying me a coffee,
there is a [Ko-fi page](https://ko-fi.com/rogiz7) — but every feature is the same whether you
donate or not.

## 📄 License

[MIT](LICENSE) — use it, change it, share it.
