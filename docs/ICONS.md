# Part icons

The app can show Satisfactory's own icons next to each part, building and stored item. It looks
much better. It also needs saying plainly what that art is and under what terms it appears, because
the honest answer is not the comfortable one.

## The rule

**The icons never ship with FICSIT Companion.** Not in the repository, not in the installer, not
fetched from a server of ours. They are read from a folder on your own disk, which you fill from
your own copy of the game. If the folder is empty, the app works exactly as before — the icons
decorate, they do not hold anything up.

This is the same treatment the app gives `Docs.json`, for the same reason.

## Why it is not simply allowed

The icons are Coffee Stain's art. They live inside the game's `.pak` files, not as loose images, so
they have to be extracted with a tool such as FModel or UE Viewer.

Plenty of community tools display them, and the official Satisfactory wiki even publishes a
tutorial for extracting them — while stating in that same tutorial that the exported content is
copyrighted and must be tagged as material owned by Coffee Stain Studios. Fan tools that bundle the
icons do so with a notice saying the art is Coffee Stain's and will be removed on request.

So the practice is widespread, and it rests on tolerance rather than on a licence. That is a real
distinction and this project does not paper over it.

What FICSIT Companion commits to:

- The art is **© Coffee Stain Studios**. It is credited in the app and in the README.
- The app is **not affiliated with, nor endorsed by, Coffee Stain Studios**.
- Nothing of theirs is distributed by us. Each user supplies their own copy, from the game they
  own.
- **If Coffee Stain asks us not to use their icons, the feature comes out.** No argument, no delay.

We do not unpack the `.pak` files ourselves either. Reading what the game publishes for the
community in `CommunityResources` and unpacking its shipped assets are two different things, and
the app only does the first.

## How it works

`Docs.json` gives, for each of the 750 items and buildings, the name of the texture it uses:

```
Desc_IronPlate_C -> Texture2D /Game/.../IconDesc_IronPlates_256.IconDesc_IronPlates_256
```

The app keeps only the asset name (`IconDesc_IronPlates_256`). When the icon folder is scanned, it
indexes every image by filename, and the two meet. Of the 750 names, 741 are unique and only 3
repeat, so the match is automatic — no hand-kept table, which is exactly what reading the game's
own documentation saved us from in the first place.

Building icons live on the descriptor class (`Desc_ConstructorMk1_C`), not on the buildable
(`Build_ConstructorMk1_C`), so the lookup tries both.

## Setting it up

1. Open **Settings → Part icons** in the app and press **Open folder**.
2. Extract the UI icons from your own installation with FModel or UE Viewer. The official wiki's
   "Extracting UI icons" tutorial covers the steps.
3. Drop the images into that folder. Subfolders are fine — the scan is recursive. `.png`, `.webp`,
   `.jpg` and `.jpeg` are read.
4. Press **Scan again**. The app reports how many images it found and how many parts it matched.

Keeping the extracted files is up to you; the app only reads them.

## If this ever changes

`docs/IDEAS.md` carries a note to write to Coffee Stain once the app is stronger and ask what they
are willing to make available to tools like this one. If an answer in writing ever widens what is
allowed, this document is the first thing to update.
