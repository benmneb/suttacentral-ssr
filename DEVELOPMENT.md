# Development Notes

## Word Lookup Feature

Clicking a root language word (Pali/Chinese) shows DPD dictionary definitions in a HTML popover when the "Word Lookup" checkbox is enabled. The feature is progressive enhancement — it falls back to `/define/{word}` links when JS is unavailable.

### Architecture

Dictionary data lives in `public/data/` as static assets (not bundled into the Worker, to stay under Cloudflare's 25 MB worker size limit). They are fetched at runtime via Cloudflare's ASSETS binding.

Key files:

- [`src/pages/api/lookup.ts`](src/pages/api/lookup.ts) — POST endpoint that processes words server-side and returns only matched results
- [`src/constants/lookup.ts`](src/constants/lookup.ts) — `AVAILABLE_LOOKUPS` (single source of truth for supported language pairs as per current SC), Pali endings, Hanzi variant normalization
- [`src/utils/lookup.ts`](src/utils/lookup.ts) — Pali compound decomposition and DPD inflection mapping logic
- [`scripts/fetch-dictionaries.ts`](scripts/fetch-dictionaries.ts) — Fetches and compacts dictionary data from SuttaCentral API
- `public/data/` — Dictionary JSON files (~30 MB)

### Updating Dictionaries

Dictionary files are committed to the repo for reproducible builds. To re-fetch the latest data from SuttaCentral's API:

```sh
pnpm fetch-dicts
```

The script writes one entry per line, so an upstream edit to a definition shows up as a single changed line rather than a multi-line hunk. `public/data` is in `.prettierignore` to keep it that way — prettier wraps at 80 characters, which turns `lookup-pli-en.json` into 600k+ lines and makes the diff unreadable (and slow enough to hang an editor).

### Dictionary Sources

- **Pali/Chinese → target language**: `https://suttacentral.net/api/dictionaries/lookup?from={from}&to={to}`
- **DPD inflection-to-headword** (`dpd-i2h.json`): maps inflected Pali forms to headwords (e.g. "naṁ" → "ta")
- **DPD deconstructor** (`dpd-deconstructor.json`): splits compound Pali words into components

### Design Decisions

1. **Server-side processing, minimal payload.** Official SC ships the full dictionary + DPD tables (~30MB) as client-side JS. This project processes words server-side and returns only matched results (~70-500KB) that are relevant to the current text.
1. **Works without JavaScript.** Every word is an `<a href="/define/word">` link. If JS fails or is disabled, ticking the "Word Lookup" checkbox makes those links navigable, so definitions are still reachable via the `/define/` route.
1. **Clicks are blocked in CSS, and JS enables them.** The words are `pointer-events: none` so they can't be followed without JS; `data-lookup-js` on `<html>` lifts that and a delegated click handler on `main` blocks the clicks instead. Don't move this back into CSS: `pointer-events: none` takes the words out of hit-testing, which stops Firefox/macOS offering the native dictionary on a 3D press. For the same reason JS sets `draggable = false` on each link, so dragging selects text rather than dragging a URL. This mirrors the "listen" menu, whose controls ship disabled and are enabled by script.

---

## Internationalisation

UI translations are synced from SuttaCentral's static assets. Three types of files exist in `src/i18n/locales/`:

- `interface_en.json` etc. — Official SC translations, synced via `pnpm sync-i18n`
- `_scx_interface_en.json` etc. — Project-specific labels, maintained in this repo
- `_machine_interface_cs.json` etc. — Machine translation fallbacks, maintained in this repo

To pull the latest official translations:

```sh
pnpm sync-i18n
```

To skip syncing a file that's intentionally modified locally, comment it out in the `FILE_BASES` array at the top of [scripts/sync-i18n.ts](scripts/sync-i18n.ts).

The script applies `TRANSFORMATIONS` to all fetched data before comparing or writing — these normalize intentional local differences so they don't appear as changes on every sync.
