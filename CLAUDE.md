# OttO — read this first

**Read `docs/HANDOFF.md` before doing anything.** It carries the project's state, the working
method, the traps that have bitten more than once, and what is next. This file is only the part
that must be known even if nothing else is read.

- The owner is **Zigor**. **He works in Spanish. The repository is in English** — code, comments
  and docs in English, conversation in Spanish. Both, always.
- **Never push and never publish a release.** Zigor runs `npm run tauri dev`, `npm run tauri icon`
  and `git push` himself. Committing locally is fine.
- **The private signing key is never read and never committed.** The public key only.
- **Nothing of Coffee Stain's ships** with the app or the repo — no `Docs.json`, no icons, no map
  art, no game screenshots. Anything of theirs the app uses is read from the user's own
  installation. See `docs/LEGAL.md`.
- **The app only ever reads `.sav` files. It never writes to one.**
- **The app never reveals what the game has not revealed to the player.** The fog-of-war rule.
- **Only the world `Lurra bi` has real data.** Measuring against the other two proves nothing.

Before handing work back: `npx tsc --noEmit` must be clean, and anything visual must have been
looked at, not only compiled.
