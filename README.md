[![SourceHut](https://img.shields.io/badge/-on_SourceHut-212529?logo=sourcehut)](https://git.sr.ht/~benmneb/suttacentral-ssr)
[![Codeberg mirror](<https://img.shields.io/badge/-Codeberg_(mirror)-4793cc.svg?logo=codeberg&logoColor=white>)](https://codeberg.org/benmneb/suttacentral-ssr)
[![GitHub mirror](<https://img.shields.io/badge/-GitHub_(mirror)-010409.svg?logo=github>)](https://github.com/benmneb/suttacentral-ssr)

# [SuttaCentral.now](https://suttacentral.now) [![builds.sr.ht status](https://builds.sr.ht/~benmneb/suttacentral-ssr.svg?search=refs/heads/main)](https://builds.sr.ht/~benmneb/suttacentral-ssr?search=refs/heads/main) [![WCAG 2.2: AA target](https://img.shields.io/badge/WCAG_2.2-AA_target-green?style=flat)](ACCESSIBILITY.md)

## A fast and minimal alternative frontend for [SuttaCentral.net](https://suttacentral.net)

This project fetches data from SuttaCentral's public APIs at request time and serves it as static HTML.

- **Complete text library** — All suttas, vinaya, and abhidhamma in root languages and every available translation
- **Server-side rendering** — Pages rendered on-demand with latest data from SuttaCentral's APIs
- **Internationalised** — Automatic language detection from your browsers preferred language
- **Instant search** — Fast, powerful search using SuttaCentral's API (includes Pali dictionary lookups)
- **URLs you know and love** — Mirrors SuttaCentral.net URL structure (just change `.net` to `.now`, or use the [browser extension](https://sr.ht/~benmneb/suttacentral-redirect))
- **Flexible text settings** — Customizable reading preferences for footnotes, root-text views, and reference links
- **Minimal JavaScript** — Every text and core feature works without it. About 13kb (gzipped) of optional client-side JS on a text adds inline Pali & Chinese dictionary lookups, text-to-speech via the Web Speech API and hot keys

## Performance Comparisons

All benchmarks measured via <https://pagespeed.web.dev> for desktop on 22/01/2026:

### `/`

| &nbsp;                   | SuttaCentral.now | SuttaCentral.net | Performance Gain |
| ------------------------ | ---------------- | ---------------- | ---------------- |
| First Contentful Paint   | 0.2s             | 1.1s             | 82% faster       |
| Largest Contentful Paint | 0.2s             | 1.7s             | 8.5x faster      |
| Total Blocking Time      | 0ms              | 60ms             | 100% reduction   |
| Cumulative Layout Shift  | 0                | 0.031            | 100% reduction   |

### `/dn1/en/sujato`

| &nbsp;                   | SuttaCentral.now | SuttaCentral.net | Performance Gain |
| ------------------------ | ---------------- | ---------------- | ---------------- |
| First Contentful Paint   | 0.4s             | 0.6s             | 33% faster       |
| Largest Contentful Paint | 0.4s             | 2.3s             | 5.8x faster      |
| Total Blocking Time      | 0ms              | 240ms            | 100% reduction   |
| Cumulative Layout Shift  | 0                | 0.608            | 100% reduction   |

### `/search?query=deva`

| &nbsp;                   | SuttaCentral.now | SuttaCentral.net | Performance Gain |
| ------------------------ | ---------------- | ---------------- | ---------------- |
| First Contentful Paint   | 0.3s             | 0.6s             | 50% faster       |
| Largest Contentful Paint | 0.4s             | 1.7s             | 4.3x faster      |
| Total Blocking Time      | 0ms              | 280ms            | 100% reduction   |
| Cumulative Layout Shift  | 0                | 0.003            | 100% reduction   |

## Related Projects

- [SuttaCentral](https://github.com/suttacentral/suttacentral)
- [SuttaCentral Static](https://sr.ht/~benmneb/suttacentral-static)
- [SuttaCentral Redirect](https://sr.ht/~benmneb/suttacentral-redirect)

## License

_Programmed for the purpose of pleasing people pursuing perfection_

Donated to the public domain via [CC0](https://creativecommons.org/publicdomain/zero/1.0/)

Favicon via [thesunshade](https://github.com/thesunshade/citation-helper)

UI icons via [Heroicons](https://heroicons.com) by Tailwind Labs, MIT
