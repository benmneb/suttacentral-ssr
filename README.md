[![SourceHut](https://img.shields.io/badge/-on_SourceHut-212529?logo=sourcehut)](https://git.sr.ht/~benmneb/suttacentral-ssr)
[![Codeberg mirror](<https://img.shields.io/badge/-Codeberg_(mirror)-4793cc.svg?logo=codeberg&logoColor=white>)](https://codeberg.org/benmneb/suttacentral-ssr)
[![GitHub mirror](<https://img.shields.io/badge/-GitHub_(mirror)-010409.svg?logo=github>)](https://github.com/benmneb/suttacentral-ssr)

# [SuttaCentral.now](https://suttacentral.now) [![builds.sr.ht status](https://builds.sr.ht/~benmneb/suttacentral-ssr.svg?search=refs/heads/main)](https://builds.sr.ht/~benmneb/suttacentral-ssr?search=refs/heads/main) [![WCAG 2.2: AA target](https://img.shields.io/badge/WCAG_2.2-AA_target-green?style=flat)](ACCESSIBILITY.md)

## A fast and minimal alternative frontend for [SuttaCentral.net](https://suttacentral.net)

This project fetches data from SuttaCentral's public APIs at request time, renders it server-side and serves it as static HTML.

- **The whole library** — All suttas, vinaya, and abhidhamma texts in root languages and every available translation, plus the site pages: guides, essays, dictionaries, editions and the rest
- **Familiar URLs** — Mirrors SuttaCentral.net URL structure. Just change `.net` to `.now`, or use the [browser extension](https://git.sr.ht/~benmneb/suttacentral-redirect) from the [Chrome](https://chromewebstore.google.com/detail/suttacentral-redirect/noaddajdfegpjfgpmbhcbahofgkceaan) or [Firefox](https://addons.mozilla.org/firefox/addon/suttacentral-redirect/) store
- **Optional JavaScript** — Every page and core feature works without it. About 13 KB (gzipped) of client-side JS on a text adds text-to-speech via the Web Speech API and hot keys
- **Valid HTML** — No errors or warnings from the W3C's Nu validator, and schema.org-valid structured data
- **Pretty accessible** — Built and tested to WCAG 2.2 AA, with AAA contrast when more contrast is requested plus support for forced colours and reduced motion. See [ACCESSIBILITY.md](ACCESSIBILITY.md)
- **Legacy supported** — Reads and navigates on Windows 7 from 2009 (Chrome 109), with or without JS. See the [principles](DEVELOPMENT.md#principles)

## Page weight

What a first visit transfers on each site, styles, scripts and fonts included, measured in headless Chrome with an empty cache on 13/11/2026:

| Page                 | SuttaCentral.now | SuttaCentral.net | Lighter by |
| -------------------- | ---------------- | ---------------- | ---------- |
| `/`                  | 38 KB            | 1.66 MB          | 44x        |
| `/mn1/en/sujato`     | 112 KB           | 2.13 MB          | 19x        |
| `/mn1/de/sabbamitta` | 103 KB           | 1.78 MB          | 17x        |
| `/define/dhamma`     | 65 KB            | 2.09 MB          | 32x        |
| `/search?query=deva` | 65 KB            | 1.70 MB          | 26x        |

- **Multiple pages** — After its first page, .net runs as a single-page app, so each further sutta is lighter than on .now, around 23 KB against 41 KB — unless .net needs a font it hasn't loaded yet, up to 20 MB for Chinese. It takes about 110 more suttas to make up the first-page gap, or about 1,200 if one of them has Chinese characters in it
- **In seclusion** — On a mid-range Android with a weak or crowded mobile signal, like rural areas, a remote monastery or retreat centre, or a busy train (emulated as 400 kbps, 400 ms latency and a [mid-tier](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md#benchmarking-cpu-power) CPU), the opening of MN 1 is on screen in 2.1s on .now and 27.7s on .net
- **On desktop** — Largest Contentful Paint is 8x faster on `/` (0.2s vs 1.6s) and 7x faster on `/mn1/en/sujato` (0.3s vs 2.1s). Layout shift is 0 on both (vs 0.015 and 0.522), and blocking time 0ms and 30ms (vs 40ms and 90ms), via [PageSpeed Insights](https://pagespeed.web.dev), 13/11/2026

## Related projects

- [SuttaCentral](https://github.com/suttacentral/suttacentral)
- [SuttaCentral Static](https://sr.ht/~benmneb/suttacentral-static)
- [SuttaCentral Redirect](https://sr.ht/~benmneb/suttacentral-redirect)

## License

_Programmed for the purpose of pleasing people pursuing perfection_

Donated to the public domain via [CC0](https://creativecommons.org/publicdomain/zero/1.0/)

Favicon via [thesunshade](https://github.com/thesunshade/citation-helper)

UI icons via [Heroicons](https://heroicons.com) by Tailwind Labs, MIT
