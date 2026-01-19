[![SourceHut](https://img.shields.io/badge/-on_SourceHut-212529?logo=sourcehut)](https://git.sr.ht/~benmneb/suttacentral-ssr)
[![Codeberg mirror](<https://img.shields.io/badge/-Codeberg_(mirror)-4793cc.svg?logo=codeberg&logoColor=white>)](https://codeberg.org/benmneb/suttacentral-ssr)
[![GitHub mirror](<https://img.shields.io/badge/-GitHub_(mirror)-010409.svg?logo=github>)](https://github.com/benmneb/suttacentral-ssr)

# [SuttaCentral.now](https://suttacentral.now) [![builds.sr.ht status](https://builds.sr.ht/~benmneb/suttacentral-ssr.svg?search=refs/heads/main)](https://builds.sr.ht/~benmneb/suttacentral-ssr?search=refs/heads/main)

## Another fast and minimal alternative frontend for [SuttaCentral.net](https://suttacentral.net)

This project fetches data from SuttaCentral's public APIs at request time and serves it as static HTML. The only client-side JavaScript is optional: it persists text view settings in local storage and enables text-to-speech via the Web Speech API.

It's like [SuttaCentral.express](https://suttacentral.express), except

- Pages are rendered on the server at request time, so it always has the latest data
- Includes all translations of all texts in all languages
- Internationalisation based on your browsers preferred language
- Fast and powerful "instant search" from the same API .net uses (includes dictionaries)
- Even less client-side javascript
- 1,000% improved developer experience
- Has a real favicon

## License

Donated to the public domain via [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
