# Development Notes

## Principles

SuttaCentral.now is built HTML first, with CSS where it's needed and JavaScript only as an enhancement. Every change is held to these:

- Every page, text and core feature is server-rendered HTML and CSS, and works without JavaScript. Of suttacentral.net's features, only word lookup needs JS here. The rest of the optional ~13 kB (gzipped) on a text adds extras such as text-to-speech and hot keys to pages that already work
- Every kind of page passes the W3C's [Nu validator](https://validator.w3.org/nu/) with no errors or warnings, and their JSON-LD fits the schema.org vocabulary. Slips in SuttaCentral's markup are mended as each page renders. The one warning let through is for text in its data that isn't in Unicode Normalization Form C, such as some Bengali names
- Pages are built and tested to [WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA, with no axe-core violations in light and dark mode or at a phone's width. With more contrast set, text meets AAA contrast ratios. Forced colours and reduced motion are respected throughout. See [ACCESSIBILITY.md](ACCESSIBILITY.md)
- There's no render-blocking JS, with 0 ms Total Blocking Time and no layout shift
- CSS is compiled for Chrome 107 and Safari 16, and newer features (popovers, anchor positioning, `:has()`) sit behind `@supports` with a plainer fallback. Without JS, the site still reads and navigates in Chrome 109, the last on Windows 7 and 8.1

[`pnpm test`](#tests) checks validity and accessibility on a sample of every kind of page, in English and another language.

Data the site takes from SuttaCentral or elsewhere ahead of time, such as dictionaries, maps, sitemaps and translations, is fetched by a script and committed, so builds are reproducible and an upstream change shows up in the diff. Each section below gives its script. Run it again when its source changes, then review the diff and commit.

## Word Lookup

Clicking a root language word (Pali/Chinese) shows DPD dictionary definitions in a HTML popover when the "Word Lookup" checkbox is enabled. It is the one feature carried over from suttacentral.net that needs JS: without it, or without popovers, its checkbox stays hidden. This is to reduce the HTML payload by up to almost 50% (`/dn1/en/sujato`) for almost every user, who has JS enabled.

### Design Decisions

1. **Server-side, one word at a time.** .net ships the full dictionaries and DPD tables (~30 MB) as client-side JS. Here [`/api/lookup`](src/pages/api/lookup.ts) looks up each word as it's clicked and returns only its matches, so readers download only the definitions they ask for, not all the entire dictionaries. Parsing a whole dictionary (21 MB for Pali–English), or looking up every word on a page at once, runs past the Worker's 10 ms CPU limit on the free plan and fails with Error 1102.
1. **Sharded dictionaries, served as assets.** The build splits each dictionary into ~100 KB shards, so a lookup parses only the few its word touches. They're served as static files rather than bundled, which keeps the Worker under Cloudflare's 25 MB limit. A lookup fetches all its shards at once up front, as each is a round trip in production, and fetching them one by one made clicks take 1–2 seconds.
1. **Cached for a month.** Answers are kept in the data centre's cache, so a word anyone nearby has looked up recently skips the shards entirely. Browsers keep them for a month too, by URL alone, so after a `pnpm fetch-dicts` a returning visitor may see an old definition until theirs expires.
1. **No markup per word.** The root text is plain text. A link to `/define/` on every word made up 40–48% of a long text's elements, only for readers without JS. Now the script wraps a segment's Pali words in spans as the pointer reaches it, finds a tapped Chinese character from the caret, and highlights it with the CSS Custom Highlight API. The text selects, drags and gets the OS dictionary (a hard press on macOS) like any other.
1. **One tab stop per segment.** While the setting is on, each segment's root text takes focus, and Enter looks up its first word and moves focus into the popover. ← and → step through the words from there, and Tab leaves it for the segments either side.

### Updating Dictionaries

`data/` holds SuttaCentral's lookup dictionaries and DPD's inflection and compound tables, fetched from SuttaCentral's API and committed:

```sh
pnpm fetch-dicts
```

### Simplified Chinese

Chinese root texts have a "Simplified" view setting, which swaps traditional characters and phrases for simplified ones in the browser, as OpenCC does. Its map is generated from OpenCC's dictionaries and committed:

```sh
pnpm build-hans
```

## Map

`/map` and the mini maps on a place's `/define` page are SVG, drawn from [Natural Earth](https://www.naturalearthdata.com/)'s land, rivers and borders (public domain) and SuttaCentral's `/api/map_data` rather than .net's map tiles, so they load nothing from elsewhere and show without JS. Both are generated and committed:

```sh
pnpm build-map
```

## Sitemap

Every page is rendered on request, so the build has no list of pages to make a sitemap from. The sitemaps are generated from SuttaCentral's API and committed instead:

```sh
pnpm build-sitemap
```

## Caching

Pages are never cached, so every view has SuttaCentral's live data. Their assets are cached for good instead: everything Vite builds into `/_astro/` (styles, scripts and imported files) has a hash in its name, and `@astrojs/cloudflare` gives that path a year's `immutable` `Cache-Control` in the `_headers` it writes at build. There's no additional `_headers` needed in this code.

Files in `public/` keep their names, so Cloudflare serves them with `max-age=0, must-revalidate`. Pages load only the favicons from there, which don't hold up rendering. A file a page needs to render belongs in `src/assets/` instead, imported with `?url` when the page links to it rather than inlining it, as [`src/assets/map-base.svg`](src/assets/map-base.svg) is.

## Tests

The tests check a sample of every kind of page, from the last build:

```sh
pnpm build
pnpm test
```

`pnpm test` fetches each page in [`tests/lib/site.ts`](tests/lib/site.ts) once, in English and in another language, and checks that it [renders](tests/pages.test.ts), is [valid HTML](tests/html-validity.test.ts), has [valid structured data](tests/structured-data.test.ts) and has no [accessibility problems](tests/accessibility.test.ts) axe-core can find. Whatever they need that isn't installed, such as Java or a browser, is downloaded into `node_modules` on the first run. The accessibility tests take about 9 minutes, mostly on the longest texts.

Every page is rendered from SuttaCentral's API as it's requested, so a change in .net's data can fail a test as well as a change here. To check a few pages, or another server:

```sh
TEST_PAGES=/mn1/en/sujato,/about pnpm test
TEST_ORIGIN=https://suttacentral.now pnpm test
```

## Internationalisation

UI translations live in `src/i18n/locales/`, in three kinds of file: SuttaCentral's own (`interface_en.json` etc.), this project's labels (`_scx_interface_en.json` etc.) and machine translations to fill the gaps in either (`_machine_interface_cs.json`, `_machine_scx_interface_cs.json` etc.). A human translation wins over a machine one with the same key.

To add a string, put the English in the `_scx_<namespace>_en.json` it belongs to, and its translation in each other locale's `_machine_scx_<namespace>_<lang>.json`. Until a locale has it, `t()` falls back to English.

SuttaCentral's own are synced from its static assets and committed:

```sh
pnpm sync-i18n
```

## View Settings & Redirect Links

.net links carry the reader's view settings in the query, e.g. `/mn1/en/sujato?lang=en&layout=sidebyside&reference=main/pts&notes=asterisk&highlight=true&script=latin`. They're honoured here too, so a shared .net link (or one redirected here from .net) opens as it was sent. As on .net, they apply to that page only and are never saved over the reader's own settings. Internal links are built from paths alone, so the next page is back to the reader's settings and language. That's on purpose: the feature is for links, not for browsing.

They're merged over the cookie on the server, so they work without JS. Once the reader changes a setting a param set, the whole param becomes theirs and leaves the address, so a reload shows what they chose. `<link rel="canonical">` drops the query, so settings links aren't separate pages, while `og:url` keeps it, so shared links keep their settings.
