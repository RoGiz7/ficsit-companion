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

**Copies before a migration.** Anything that rewrites data already on disk writes a backup first,
in the same Rust command, and writes nothing if the backup fails. The first one is the move of the
history's metrics from names to classes (metrics schema 3): `pre-schema3-<stamp>.json`. These are
named apart from the automatic ones on purpose, so the rotation that keeps the last ten `auto-`
copies never deletes them. They are ordinary backups otherwise: they show in the list and restore
by merging, and a restored pre-migration snapshot is migrated again on the spot.

## Known gap

There is no backup folder setting yet, so automatic copies stay beside the app's data. Pointing
them at a synced folder would make them survive the machine. Deliberately left for later.


## The day the backup earned its keep

On 21 November 2026 the history went from 45 readings across three worlds — one of them going back
to June — down to 4 readings from that afternoon. The automatic backup from 12:17 had all of it,
and restoring merged it back without losing the new ones.

The cause was a chain of two mistakes in the code, both mine, and both now fixed:

1. **Loading did `from_slice(..).unwrap_or_default()`.** Any parse failure silently became an empty
   map instead of an error.
2. **Saving did a direct `fs::write`.** A process killed mid-write leaves a truncated file.

Together they destroy data: an interrupted write breaks the file, the next load reads it as empty,
and the next write saves that emptiness over everything. Stopping and starting `tauri dev` all day
is more than enough to land a kill inside a write.

Now: every write of history, notes, plans, game data and the backups themselves goes to a temporary
file and is renamed into place, which is atomic on the same volume. And a load that fails no longer
returns empty quietly — it moves the unreadable file aside as `<name>.roto-<timestamp>.json` and
says so in the log, so nothing is destroyed even in the case the backup does not cover.

Two things worth carrying forward. **A backup that is written non-atomically is worse than no
backup**, because you believe you are covered; that write is now atomic too. And **the merge-rather
-than-replace rule for restoring**, decided when backups were built, is what made the recovery
painless: the afternoon's four readings survived alongside the forty-five.


## The rule that follows from it

Restoring that backup then failed with `missing field \`cls\``. A field added to `InvItem` that
afternoon had no default, so every snapshot written before it — all forty-five, five months of them
— became unreadable. The loader no longer destroys what it cannot read, but it still could not read
it.

**Every struct that ends up on disk carries `Default` and `#[serde(default)]`.** Without it, adding
one field makes everything saved before that moment unparseable, and the whole file dies for the
sake of three missing words on one line. Checked across `InvItem`, `ItemRate`, `ItemCount`,
`ZoneSnap`, `Snapshot`, `SnapshotMetrics` and `BackupFile`; three were missing it and now are not.

This belongs with the other backup rule: when something new is persisted, decide whether it goes in
the backup **and** give its struct a default. Both or neither.
