# Development Notes

## Principles

SuttaCentral.now is built HTML first, with CSS where it's needed and JavaScript only as an enhancement. Every change is held to these:

- Every page, text and core feature is server-rendered HTML and CSS, and works without JavaScript. Of suttacentral.net's features, only word lookup needs JS here. The rest of the optional ~13 kB (gzipped) on a text adds extras such as text-to-speech and hot keys to pages that already work
- Every kind of page passes the W3C's [Nu validator](https://validator.w3.org/nu/) with no errors or warnings, and their JSON-LD fits the schema.org vocabulary. Slips in SuttaCentral's markup are mended as each page renders. The one warning let through is for text in its data that isn't in Unicode Normalization Form C, such as some Bengali names
- Pages are built and tested to [WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA, with no axe-core violations in light and dark mode or at a phone's width. With more contrast set, text meets AAA contrast ratios. Forced colours and reduced motion are respected throughout. See [ACCESSIBILITY.md](ACCESSIBILITY.md)
- There's no render-blocking JS, with 0 ms Total Blocking Time and no layout shift
- CSS is compiled for Chrome 107 and Safari 16, and newer features (popovers, anchor positioning, `:has()`) sit behind `@supports` with a plainer fallback. Without JS, the site still reads and navigates in Chrome 109, the last on Windows 7 and 8.1

[`pnpm test`](#tests) checks validity and accessibility on a sample of every kind of page, in English and another language.

Data the site takes from SuttaCentral or elsewhere ahead of time, such as dictionaries, maps, sitemaps and translations, is fetched by a script and committed, so builds are reproducible and an upstream change shows up in the diff.

## View Settings

The texts have every view setting .net has and more. They only show on texts they work on. All but root-word lookup work without JS, though only the Pali script and Simplified Chinese are remembered from page to page without it, as JS saves the rest to the cookie. Those two are rendered by the server, so changing either loads the page again, keeping the reader's place. Two are narrower than on .net: references come as Main, PTS and Others rather than one per edition, and the Pali script list has 18 of .net's 141, the ones devices ship a font for, so none needs a web font.

.net links carry the reader's view settings in the query, e.g. `/mn1/en/sujato?lang=en&layout=sidebyside&reference=main/pts&notes=asterisk&highlight=true&script=latin`. They're honoured here too, so a shared .net link (or one redirected here from .net) opens as it was sent. The server reads them over the browser's cookie, so they work without JS, and as on .net they apply to that page only and are never saved over the reader's own settings.

## Word Lookup

.net ships the full dictionaries and DPD tables (~30 MB) as client-side JS. Here [`/api/lookup`](src/pages/api/lookup.ts) looks up each word as it's clicked and returns only its matches. The build splits each dictionary into ~100 KB shards, served as static files, and a lookup fetches the few its word touches all at once, as each is a round trip, and taking them in turn left a click waiting 1–2 seconds. Answers are cached for a month, in the data centre, so a word anyone nearby has looked up skips the shards, and in the browser.

A text in Simplified Chinese is looked up in a copy of the Chinese dictionary keyed by simplified characters, which the build makes alongside the shards. Terms that simplify alike, such as 發 and 髮, share one entry there.

### Updating Dictionaries

`data/` holds SuttaCentral's lookup dictionaries and DPD's inflection and compound tables, fetched from SuttaCentral's API and committed:

```sh
pnpm fetch-dicts
```

## Listen

Listen is text-to-speech via the browser's [Web Speech API](https://developer.mozilla.org/docs/Web/API/Web_Speech_API) and the voices on the user's device, so there's no audio file to store or serve, and it works offline. The API needs JS. It reads a segment at a time, or a sentence at a time on legacy texts. The voice is automatically picked for the text's language, if it exists, and user's voice preferences are preserved.

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

Every page is rendered from SuttaCentral's API as it's requested, so a change in .net's data can fail a test as well as a change here. To check a few pages, or a server that's already running, such as `pnpm dev`:

```sh
TEST_PAGES=/mn1/en/sujato,/about pnpm test
TEST_ORIGIN=http://localhost:4321 pnpm test
```

## Internationalisation

Site language is automatically selected based on the browsers preferred language. UI translations live in `src/i18n/locales/`, in three kinds of file: SuttaCentral's own (`interface_en.json` etc.), this project's labels (`_scx_interface_en.json` etc.) and machine translations to fill the gaps in either (`_machine_interface_cs.json`, `_machine_scx_interface_cs.json` etc.). A human translation wins over a machine one with the same key. It falls back to English if strings are missing for a locale.

SuttaCentral's own are synced from its static assets and committed:

```sh
pnpm sync-i18n
```
