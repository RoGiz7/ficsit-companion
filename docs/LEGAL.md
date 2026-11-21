# What is ours, what is theirs, and on what terms

This project touches Coffee Stain's intellectual property in several places. This file records what
each one is, how exposed it is, and what it would cost to undo — so the decisions are not
relitigated every few months and so a future rewrite is never a surprise.

Nobody here is a lawyer. This is a record of reasoning and evidence, not legal advice.

## The ranking that matters

The useful question is not "is this allowed?" but **"what would it cost to reverse?"** A borrowed
thing that takes one commit to remove is a small problem. One baked into every installed copy is a
large one, however safe it looks today.

| Piece | Whose | How exposed | Cost to undo |
|---|---|---|---|
| Part icons | Coffee Stain | Tolerated, not licensed | **Trivial** — the app ships none; an empty folder is already the "off" state |
| Game data (`Docs.json`) | Coffee Stain | Published by them for the community | **Trivial** — read from the user's install, never bundled |
| The name "FICSIT Companion" | Coffee Stain's fiction | Well precedented (see below) | **Low for the display name, high for the identifier** |
| The map | Ours | None | — |
| The logo | Ours | None | — |

## The map: nothing borrowed

The map is drawn from coordinates in the user's own save — our rendering of their own data. No art
of Coffee Stain's is involved, and none is wanted: the game renders its map at runtime, so there is
no map image to extract even if we wanted one. Nothing here needs changing now or later.

## The name: keep it, and here is why

"FICSIT" is the fictional company in Satisfactory, so the instinct to be careful is a good one. The
evidence from the ecosystem points the other way.

The largest third-party project in Satisfactory's community is the Satisfactory Mod Repository,
which lives at **ficsit.app** and is also called the FICSIT Augmentation Database. The official
Satisfactory wiki points players to it. The organisation behind it states plainly that its members
are volunteers, that they are **not affiliated with Coffee Stain Studios**, and that they
appreciate Coffee Stain's support of the modding community — and Coffee Stain pointed the community
at the mod manager hosted there.

So a prominent, long-running, FICSIT-named third-party project operates with Coffee Stain's open
encouragement while explicitly disclaiming affiliation. That is a far stronger signal than the
tolerance the icons rest on.

What keeps this true for us:

- The app is **free**, and stays free. Donations are optional and change nothing.
- It never presents itself as official. The disclaimer is in both READMEs and in the app.
- It does not impersonate FICSIT or Coffee Stain, and uses none of their logos.

If any of those three stopped being true, this entry would need re-reading.

## The decision that is expensive, and how we made it cheap

The display name is a string. The **bundle identifier** (`com.rogiz7.ficsitcompanion`) is not: it is
what the installer, the updater and the user's data folder key off. Changing it after a release
does not rename the app — installed users get a second, separate app and lose their history, notes,
plans and backups.

**So the identifier is frozen, whatever happens to the name.** Identifiers are opaque; an app
called something else can keep this one forever with no user-visible trace. That decouples the
expensive decision from the reversible one: if the display name ever has to change, it costs a
string and a release note, not anyone's data.

This was settled before the first release, deliberately, while it was still free to settle.

## If Coffee Stain ever asks

The commitments, in order of how fast they can be honoured:

1. **Icons** — removed immediately. The app already runs without them.
2. **Name** — the display name changes in the next release; the identifier stays so nobody loses
   data.
3. **Anything else of theirs** — it is read from the user's own installation, never distributed by
   us, so it stops at their word.

`docs/IDEAS.md` carries the note to write to them once the app is stronger. The question to ask is
not "may we?" but whether they would rather supply something for tools like this than have each
tool extract its own.

See also [ICONS.md](ICONS.md) for how the icon feature works and how to set it up.
