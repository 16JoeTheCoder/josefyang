# Project pack (format `josefyang-project/1`)

A project pack is a zip file, `<slug>.zip`, that holds one project (a "build" on josefyang.com): its page settings, its sections with all their text, and every image and video. Import it in the admin at **Admin → Builds → Import project (.zip)**. It always lands as a **draft**. It is never published automatically. Exporting a build from the build editor ("Export project (.zip)") writes the same format, so export then import round-trips.

## What is inside the zip

```
my-project.zip
  project.json          required, at the top level
  media/
    hero.webp           images: webp, png, jpg, jpeg, avif
    demo.mp4            videos: mp4 (H.264 + AAC, "faststart")
```

Rules for files:

- Only `project.json` and `media/<name>` are allowed. No sub-folders, no `..`, no absolute paths.
- File names use letters, numbers, `.`, `-` and `_` only (no spaces).
- At most **60 files**, **80 MB in total**, **25 MB per file**.
- Allowed extensions: `webp`, `png`, `jpg`, `jpeg`, `avif`, `mp4`.
- Zip the *contents* of the pack folder (so `project.json` is at the top of the zip), not the folder itself. Zip leftovers such as `__MACOSX/` and `.DS_Store` are ignored.

## project.json

```json
{
  "format": "josefyang-project/1",
  "slug": "my-project",
  "meta": { },
  "sections": [ { "moduleId": "showcase-intro", "content": { } } ]
}
```

- `format` must be exactly `josefyang-project/1`.
- `slug` is the web address `/builds/<slug>`: lowercase letters, numbers and dashes. If a build with this slug already exists, the import **replaces that build's draft** and keeps the same build (its id, versions and published page). If not, a new draft build is created.
- `meta` holds the build's own fields (see `src/core/build-fields.ts`): `title`, `kind`, `status`, `summary`, `year`, `built`, `madeWith`, `startedOn`, `skills`, `links`, `floorImage`, `selectorImage`, `tileImage` and so on. Leave a field out and it gets its default placeholder.
- `sections` is the page, top to bottom. Each section names a module (`moduleId`, the folder name in `src/modules/`) and its `content`. Leave a field out and it gets the module's default. Use the same module twice and the second section gets the id `<moduleId>-2`.

## How each field value is written

The shape follows the module's field descriptors in `src/modules/<id>/module.ts`.

| Field kind | In project.json |
| --- | --- |
| Text (`f.heading`, `f.body`, `f.label`, `f.button`, `f.pill`, ...) | `{ "value": "Text here" }` |
| URL | `"https://example.com"`, `"mailto:me@example.com"` or `"/builds/slug"` (empty `""` is fine) |
| Number | `12` |
| Toggle | `true` or `false` |
| Select | one of the option values, e.g. `"hardware"` |
| Date | `"2026-11"` or `"2026-11-25"` (or `""`) |
| List | an array of item objects, within the field's min and max |
| Group | an object with the group's fields |
| Image | `{ "file": "media/hero.webp", "alt": "What it shows", "mode": "fill", "focal": { "x": 0.5, "y": 0.4 } }` |
| Video | `{ "file": "media/demo.mp4", "alt": "What the clip shows" }` |

Images and videos:

- `file` is required and must be a path inside the zip that exists.
- `alt` is the alt text. It is not required to import, but **publishing is blocked until every image and video has one**.
- `mode` (images only, optional) is `fill`, `fit` or `object`. It must be one of the modes the field allows (the first one is the default).
- `focal` (images only, optional) is the point that must stay visible when the image is cropped, from 0 to 1 on each axis. Default is the centre.
- An image field needs an image file and a video field needs an `.mp4`. A video is always paired with a poster image field in the module.
- To leave a slot empty, leave the field out.
- Images are resized in the browser on import (WebP at 480, 960, 1600 and 2400 px, only up to the original width). Videos are uploaded as they are and not resized.

Text length limits are checked when you publish, not when you import: a too-long text imports fine and is shown in orange in the editor so you can shorten it.

## A full small example

`packs/my-project/project.json`:

```json
{
  "format": "josefyang-project/1",
  "slug": "my-project",
  "meta": {
    "title": { "value": "My project" },
    "kind": "software",
    "status": "in_progress",
    "summary": { "value": "A tiny tool that does one thing. It started from one question." },
    "year": { "value": "2026" },
    "built": { "value": "Oct to Nov 2026" },
    "madeWith": { "value": "TypeScript" },
    "selectorImage": { "file": "media/cover.webp", "alt": "The project's main screen" }
  },
  "sections": [
    {
      "moduleId": "showcase-intro",
      "content": {
        "currentLabel": { "value": "My project" },
        "headline": { "value": "One thing, done well" },
        "body": { "value": "What it is in a sentence or two." },
        "cta": { "value": "See it work" },
        "ctaUrl": "#demo"
      }
    },
    {
      "moduleId": "showcase-media",
      "content": {
        "heading": { "value": "Watch it run" },
        "body": { "value": "A 20 second capture of the real thing." },
        "poster": { "file": "media/cover.webp", "alt": "The project's main screen", "mode": "fit" },
        "video": { "file": "media/demo.mp4", "alt": "Screen recording of the tool finishing a task" },
        "caption": { "value": "Recorded on my laptop." }
      }
    }
  ]
}
```

with `packs/my-project/media/cover.webp` and `packs/my-project/media/demo.mp4` next to it. If the same file is used in two places, list it once in `media/` and refer to it twice.

## Making the zip

From the repo root:

```
npm run pack -- my-project      # writes dist-packs/my-project.zip
npm run pack                    # every folder in packs/
```

`dist-packs/` is git-ignored. The script checks the same limits as the importer.

## Common errors (and the fix)

| What you see on import | What it means |
| --- | --- |
| "project.json is missing from the top level of the zip" | You zipped the folder, not its contents. Use `npm run pack`. |
| "... tries to leave the pack folder (..)" / "is an absolute path" / "is in a sub-folder" | Only `project.json` and `media/<name>` are allowed. |
| "... has odd characters" | Rename the file: letters, numbers, `.`, `-`, `_` only. |
| "... is not an allowed type" | Convert to webp, png, jpg, avif or mp4. |
| "the file "media/x.webp" is not in the zip" | A `file` points at something that is not in `media/`. Check spelling and case. |
| "this spot needs an image, but ... is a video" (or the reverse) | An image field got an `.mp4`, or a video field got a picture. |
| "there is no module called ..." | `moduleId` does not match a folder in `src/modules/`. |
| "mode "object" is not allowed here" | That image field only allows the modes listed in its module. |
| "Section N (...): ... " | The content does not fit the module's schema: wrong shape, list too long, bad URL or select value. |
| "Too many files", "per file", "unpacked" | A limit above was hit. Compress the media. |
| "Videos can be up to 25 MB" | Re-encode the clip smaller (see ADDING-A-PROJECT.md). |
| "X characters over. Shorten it." (when publishing) | A text is longer than its spot allows. Edit it in the build editor. |
| "Add alt text before publishing." | An image or video has an empty `alt`. |
