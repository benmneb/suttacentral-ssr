# Development Notes

## Principles

SuttaCentral.now is built HTML first, with CSS where it's needed and JavaScript only as an enhancement. Every change is held to these:

- Every page, text and core feature is server-rendered HTML and CSS, and works without JavaScript. Word lookup is the one feature that needs JS. The rest of the optional ~13 kB (gzipped) on a text adds to pages that already work
- Every kind of page passes the W3C's [Nu validator](https://validator.w3.org/nu/) with no errors or warnings, and their JSON-LD fits the schema.org vocabulary. Slips in SuttaCentral's markup are mended as each page renders. The one warning let through is for text in its data that isn't in Unicode Normalization Form C, such as some Bengali names
- Pages are built and tested to [WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA, with no axe-core violations in light and dark mode or at a phone's width. With more contrast set, text meets AAA contrast ratios. Forced colours and reduced motion are respected throughout. See [ACCESSIBILITY.md](ACCESSIBILITY.md)
- There's no render-blocking JS, with 0 ms Total Blocking Time and no layout shift
- CSS is compiled for Chrome 107 and Safari 16, and newer features (popovers, anchor positioning, `:has()`) sit behind `@supports` with a plainer fallback. Without JS, the site still reads and navigates in Chrome 109, the last on Windows 7 and 8.1, and on an iPhone 6

[`pnpm test`](#tests) checks validity and accessibility on a sample of every kind of page, in English and another language.

---

## Word Lookup Feature

Clicking a root language word (Pali/Chinese) shows DPD dictionary definitions in a HTML popover when the "Word Lookup" checkbox is enabled. It is the one feature that needs JS: without it, or without popovers, its checkbox stays hidden. This is to reduce the HTML payload by up to almost 50% (`/dn1/en/sujato`) for almost every user, who has JS enabled.

### Architecture

Dictionary data lives in `data/`, one JSON file per dictionary. On `build` and `dev`, [`scripts/shard-dictionaries.ts`](scripts/shard-dictionaries.ts) splits each one into ~100 KB shards in `public/data/` (gitignored), which are served as static assets (not bundled into the Worker, to stay under Cloudflare's 25 MB worker size limit) and fetched at runtime via Cloudflare's ASSETS binding.

The endpoint looks up one word per request, as it's clicked, and parses only the shards that word touches. The index of which prefix lives in which shard is bundled into the Worker (`src/generated/dictionary-indexes.json`, also gitignored), and the shards a word will need are all fetched in parallel before the lookup starts — each `ASSETS.fetch` is a round trip in production, so fetching them one by one as the lookup reaches them made clicks take 1–2 seconds. Parsing a whole dictionary (21 MB for Pali–English), or looking up every word on a page at once, runs past the Worker's 10 ms CPU limit on the free plan and fails with Error 1102.

Answers are kept in the data centre's cache (the Workers Cache API) for a month, keyed on the word, the language pair and a hash of the dictionaries, so a word anyone nearby has looked up recently skips the shards entirely, and updated dictionaries never serve stale answers from there. Browsers keep answers for a month too, by URL alone, so after a `pnpm fetch-dicts` a returning visitor may see an old definition until theirs expires. Pages are never cached. On mouse and pen, the request starts on `pointerdown` rather than `click`.

Key files:

- [`src/pages/api/lookup.ts`](src/pages/api/lookup.ts) — GET endpoint that processes one word server-side and returns only matched results
- [`src/constants/lookup.ts`](src/constants/lookup.ts) — `AVAILABLE_LOOKUPS` (single source of truth for supported language pairs as per current SC), Pali endings, Hanzi variant normalization
- [`src/utils/lookup.ts`](src/utils/lookup.ts) — Pali compound decomposition and DPD inflection mapping logic
- [`src/utils/sharded-dict.ts`](src/utils/sharded-dict.ts) — Fetches and caches the shards a lookup needs
- [`scripts/fetch-dictionaries.ts`](scripts/fetch-dictionaries.ts) — Fetches and compacts dictionary data from SuttaCentral API
- `data/` — Dictionary JSON files (~30 MB)

### Updating Dictionaries

Dictionary files are committed to the repo for reproducible builds. To re-fetch the latest data from SuttaCentral's API:

```sh
pnpm fetch-dicts
```

The script writes one entry per line, so an upstream edit to a definition shows up as a single changed line rather than a multi-line hunk. `data` is in `.prettierignore` to keep it that way — prettier wraps at 80 characters, which turns `lookup-pli-en.json` into 600k+ lines and makes the diff unreadable (and slow enough to hang an editor).

### Dictionary Sources

- **Pali/Chinese → target language**: `https://suttacentral.net/api/dictionaries/lookup?from={from}&to={to}`
- **DPD inflection-to-headword** (`dpd-i2h.json`): maps inflected Pali forms to headwords (e.g. "naṁ" → "ta")
- **DPD deconstructor** (`dpd-deconstructor.json`): splits compound Pali words into components

### Design Decisions

1. **Server-side processing, minimal payload.** Official SC ships the full dictionary + DPD tables (~30MB) as client-side JS. This project processes words server-side and returns only matched results (~70-500KB) that are relevant to the current text.
1. **JS only, with no markup per word.** The root text is plain text. A link to `/define/` on every word made up 40–48% of a long text's elements, only for readers without JS. Now the script wraps a segment's Pali words in spans as the pointer reaches it, finds a tapped Chinese character from the caret, and highlights it with the CSS Custom Highlight API. The text selects, drags and gets the OS dictionary (a hard press on macOS) like any other.
1. **One tab stop per segment.** While the setting is on, each segment's root text takes focus, and Enter looks up its first word and moves focus into the popover. ← and → step through the words from there, and Tab leaves it for the segments either side.

### Simplified Chinese

Chinese root texts have a "Simplified" view setting, which swaps traditional characters and phrases for simplified ones in the browser, as OpenCC does. Its map, [`src/constants/hans.json`](src/constants/hans.json), is generated from OpenCC's dictionaries and committed:

```sh
pnpm build-hans
```

The script ([`scripts/build-hans.ts`](scripts/build-hans.ts)) pins an OpenCC release, so the map only changes when that does. It keeps only same-length swaps, so word lookup can read the traditional text at the same offsets, and the page imports the map only once the setting is on.

---

## Map

`/map` and the mini maps on a place's `/define` page are SVG, drawn from [Natural Earth](https://www.naturalearthdata.com/)'s land, rivers and borders (public domain) and SuttaCentral's `/api/map_data`. Both are generated and committed:

```sh
pnpm build-map
```

The script ([`scripts/build-map.ts`](scripts/build-map.ts)) cuts the world to the places, thins it and projects it in Web Mercator, as .net's tiles are. It writes:

- [`src/assets/map-base.svg`](src/assets/map-base.svg): the land, rivers, borders, marker symbols and each region's and journey's outline, which the pages `<use>`. They take their colours from the page's `--map-*` variables.
- [`src/constants/map.json`](src/constants/map.json): the first view, present-day towns (named in the user's language where Natural Earth has it) and countries, the places in their layers, and each place by its `/define` word.

It pins a Natural Earth release, so only SuttaCentral's places change between runs. Run it again when .net's map data changes.

---

## Sitemap

Every page is rendered on request, so the build has no list of pages to make a sitemap from. The sitemaps are generated from SuttaCentral's API and committed instead:

```sh
pnpm build-sitemap
```

The script ([`scripts/build-sitemap.ts`](scripts/build-sitemap.ts)) takes a minute or two. It walks the menu from `/api/tipitaka_menu` down to the chapters with the same rules as the `/pitaka` pages, then reads each chapter's texts from one `/api/suttaplex` call. It writes [`public/sitemap.xml`](public/sitemap.xml), an index of:

- `sitemap-pages-N.xml`: the site pages, `/pitaka` pages, chapters, shortcuts, each text's suttaplex (individual range suttas such as `/an1.33` too), `/languages` and `/edition` pages
- `sitemap-texts-N.xml`: every translation of every text, in every language
- `sitemap-define-N.xml`: every word in the dictionaries .net's `/api/dictionary_full` serves (DPD, NCPED, PTS, DPPN, Dhammika)

Each file holds up to 40,000 URLs, under the protocol's 50,000. Each URL is the path the site links to, so none redirects, and it matches the page's canonical. Search and `/parallels` pages are `noindex`, so they're left out. If any request fails, the script writes nothing. Run it again when SuttaCentral adds texts or translations.

---

## Caching

Pages are never cached, so every view has SuttaCentral's live data. Their assets are cached for good instead: everything Vite builds into `/_astro/` (styles, scripts and imported files) has a hash in its name, and `@astrojs/cloudflare` gives that path a year's `immutable` `Cache-Control` in the `_headers` it writes at build. There's no additional `_headers` needed in this code.

Files in `public/` keep their names, so Cloudflare serves them with `max-age=0, must-revalidate`. Pages load only the favicons from there, which don't hold up rendering. A file a page needs to render belongs in `src/assets/` instead, imported with `?url` when the page links to it rather than inlining it, as [`src/assets/map-base.svg`](src/assets/map-base.svg) is.

---

## Tests

The tests check a sample of every kind of page, from the last build:

```sh
pnpm build
pnpm test
```

`pnpm test` starts `astro preview` on a free port and fetches each page in [`tests/lib/site.ts`](tests/lib/site.ts) once, in English and in another language. Then:

- [`pages.test.ts`](tests/pages.test.ts): each page renders, and a missing one is a 404
- [`html-validity.test.ts`](tests/html-validity.test.ts): each page is valid HTML by the [Nu validator](https://validator.w3.org/nu/), with no errors or warnings. It needs Java 11+, from `JAVA`, `JAVA_HOME` or the `PATH`, and otherwise downloads one into `node_modules`
- [`structured-data.test.ts`](tests/structured-data.test.ts): each page's JSON-LD fits the schema.org vocabulary (pinned to a release, fetched once into `node_modules/.cache`), and its meta and Open Graph tags are right
- [`accessibility.test.ts`](tests/accessibility.test.ts): [axe-core](https://github.com/dequelabs/axe-core) finds nothing by WCAG 2.2 AA and its best practices, at a phone's width and on a desktop in light and dark mode, nor any AAA contrast problem with more contrast set. It uses Brave or Chrome if one is installed, or `BROWSER_PATH`, and otherwise downloads Chrome Headless Shell into `node_modules/.cache`. It takes about 9 minutes, mostly on the longest texts

Every page is rendered from SuttaCentral's API as it's requested, so a change in .net's data can fail a test as well as a change here. To check a few pages, or another server:

```sh
TEST_PAGES=/mn1/en/sujato,/about pnpm test
TEST_ORIGIN=https://suttacentral.now pnpm test
```

---

## Internationalisation

UI translations are synced from SuttaCentral's static assets. Three types of files exist in `src/i18n/locales/`:

- `interface_en.json` etc. — Official SC translations, synced via `pnpm sync-i18n`
- `_scx_interface_en.json` etc. — Project-specific labels, maintained in this repo
- `_machine_interface_cs.json`, `_machine_scx_interface_cs.json` etc. — Machine translation fallbacks, maintained in this repo

Machine translations exist to fill the gaps. A human translation wins over a machine one with the same key. To add a string, put the English in the `_scx_<namespace>_en.json` it belongs to, and its translation in each other locale's `_machine_scx_<namespace>_<lang>.json`. Until a locale has it, `t()` falls back to English.

To pull the latest official translations:

```sh
pnpm sync-i18n
```

To skip syncing a file that's intentionally modified locally, comment it out in the `FILE_BASES` array at the top of [scripts/sync-i18n.ts](scripts/sync-i18n.ts).

The script applies `TRANSFORMATIONS` to all fetched data before comparing or writing — these normalize intentional local differences so they don't appear as changes on every sync.

The interface language is `Astro.locals.userLanguage`, set once per request in [src/middleware.ts](src/middleware.ts): `?lang=` if it names a language in `src/i18n/locales/`, otherwise the first `Accept-Language`. Read it from there rather than calling `getPreferredLanguage` again.

---

## View Settings & Redirect Links

.net links carry the reader's view settings in the query, e.g. `/mn1/en/sujato?lang=en&layout=sidebyside&reference=main/pts&notes=asterisk&highlight=true&script=latin`. They're honoured here too, so a shared .net link (or one redirected here from .net) opens as it was sent. As on .net, they apply to that page only and are never saved over the reader's own settings. Internal links are built from paths alone, so the next page is back to the reader's settings and language. That's on purpose: the feature is for links, not for browsing.

- [`src/utils/url-prefs.ts`](src/utils/url-prefs.ts) maps `layout`, `notes`, `highlight` and `reference` onto the `viewPrefs` checkboxes. The values are .net's, from `_setTextViewState` in its `sc-text-bilara.js`. `script` has no equivalent here, and invalid values are ignored.
- The text page merges these over the cookie before rendering, so it works without JS. Each checkbox a param set is marked `data-from-url="<param>"`, so the prefs script neither saves it nor puts the cookie's value back over it.
- When the reader changes one of those checkboxes, the whole param becomes theirs: every checkbox it set is saved, and the param is removed from the address with `history.replaceState`, so a reload shows what they chose.
- `<link rel="canonical">` drops the query, so settings links aren't separate pages. `og:url` keeps it, so shared links keep their settings.
