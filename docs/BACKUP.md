# What gets backed up, and why

Short version: **history, notes and plans. Not game data.**

## The rule for anything new

> Every time the app starts persisting something new, decide whether it goes into the backup and
> at what level, and write the decision down here.

This is not bureaucracy. Anything not decided explicitly ends up outside the backup by omission,
and you find out on the day you need it.

To decide, ask one question: **if this file disappeared, could it be rebuilt?**

| Level | Meaning | Goes in? |
|---|---|---|
| **Irreplaceable** | Cannot be rebuilt from anything that still exists | Always |
| **Hand-written** | A person typed it; rebuilding means typing it again | Always |
| **Re-derivable** | Can be regenerated from something the machine still has | No |

## What that gives today

| File | Level | In the backup | Why |
|---|---|---|---|
| `history.json` | Irreplaceable | **Yes** | The game rotates and overwrites its autosaves. A snapshot not taken on the day exists nowhere else, ever. This is the one that matters. |
| `notes.json` | Hand-written | **Yes** | Written by a person about their own world. |
| `plans.json` | Hand-written | **Yes** | Quick to redo, but still theirs. |
| `gamedata.json` | Re-derivable | No | Rebuilt by re-reading the game's own documentation. Backing it up would add megabytes and protect nothing. |

Save files themselves are never touched. They are the game's, they are large, and the app only
ever reads them.

## How it behaves

**Automatic copies.** One a day at most, written after startup finishes so it captures a settled
state rather than a half-loaded one. The last ten are kept; older automatic copies are deleted.
Nothing is written when there is nothing to save.

**Restoring merges, it never replaces.** History is cumulative by nature, so merging two copies by
world and timestamp always yields at least as much as either one alone. A button that can destroy
months of history in a single click should not exist. Where a snapshot exists on both sides and
only the backup's copy carries rich metrics, the richer one wins. Notes and plans only fill gaps:
what is already on this machine stays, because it is the most recent thing its owner wrote.

**The honest limit.** A copy on the same machine protects against the app misbehaving, not against
the disk dying. Only a file taken somewhere else does that. The app says so in the interface
rather than letting anyone assume otherwise, and the folder opens in one click so the file can be
moved out.

## Known gap

There is no backup folder setting yet, so automatic copies stay beside the app's data. Pointing
them at a synced folder would make them survive the machine. Deliberately left for later.
