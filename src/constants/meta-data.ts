import { UMAMI_ORIGIN } from './urls.ts'

export const siteMetaData = {
  title: 'SuttaCentral.now',
  description: 'A fast and minimal alternative frontend for SuttaCentral.net',
  origin: 'https://suttacentral.now',
  source: 'https://sr.ht/~benmneb/suttacentral-ssr',
  mirrors: [
    'https://codeberg.org/benmneb/suttacentral-ssr',
    'https://github.com/benmneb/suttacentral-ssr',
  ],
  analytics: `${UMAMI_ORIGIN}/share/O7XCxmZWdFUE9kVC`,
  accessibility:
    'https://git.sr.ht/~benmneb/suttacentral-ssr/tree/main/item/ACCESSIBILITY.md#accessibility',
  feedback: 'mailto:feedback@suttacentral.now',
  maintainer: { name: 'sankhato', url: 'https://sr.ht/~benmneb' },
}
