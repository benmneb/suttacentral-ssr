export interface SiteMetaData {
  /** The site's name, used in HTML and JSON+LD */
  title: string
  /** The site's description, used in HTML and JSON+LD */
  description: string
  /** The full URL it is served from, without a trailing slash */
  origin: string
  /** Source control references */
  repository: {
    /** The canonical URL of your repository, linked in the footer */
    source: string
    /** Any mirrors of it, eg on other forges, or an empty array */
    mirrors: string[]
  }
  /** Set to null to disable analytics entirely */
  analytics: {
    /** The analytics provider's script URL */
    src: string
    /**
     * Attributes for its script tag, eg data-website-id. Works with any
     * provider, such as Umami, Plausible, GoatCounter or Fathom.
     */
    attributes?: Record<string, string | boolean>
    /** The public dashboard link shown in the footer, if any */
    shareUrl?: string
  } | null
  /**
   * The repository and Codeberg-compatible API hosting the offline releases.
   * Omit or set to null to hide the offline downloads.
   */
  offline?: {
    /** The repository hosting the offline release assets */
    repo: string
    /** Codeberg-compatible API, used to find the latest release */
    api: string
  } | null
  /** A URL for your accessibility statement, linked in the footer */
  accessibility: string
  /** A mailto: or URL for feedback links, linked in the footer */
  feedback: string
  /** Your name and URL, used in JSON-LD */
  maintainer: { name: string; url: string }
  /** The default Open Graph image path, relative to origin */
  ogImage: string
}

export const siteMetaData: SiteMetaData = {
  title: 'SuttaCentral.now',
  description: 'A fast and minimal alternative frontend for SuttaCentral.net',
  origin: 'https://suttacentral.now',
  repository: {
    source: 'https://sr.ht/~benmneb/suttacentral-ssr',
    mirrors: [
      'https://codeberg.org/benmneb/suttacentral-ssr',
      'https://github.com/benmneb/suttacentral-ssr',
    ],
  },
  analytics: {
    src: 'https://stats.suttacentral.now/script.js',
    attributes: {
      async: true,
      'data-website-id': '1e65129e-1d78-4a78-a6d2-a339152f9a1d',
      'data-domains': 'suttacentral.now,www.suttacentral.now',
      'data-exclude-search': 'true',
      'data-exclude-hash': 'true',
    },
    shareUrl: 'https://stats.suttacentral.now/share/O7XCxmZWdFUE9kVC',
  },
  offline: {
    repo: 'https://codeberg.org/benmneb/suttacentral-static',
    api: 'https://codeberg.org/api/v1/repos/benmneb/suttacentral-static',
  },
  accessibility:
    'https://git.sr.ht/~benmneb/suttacentral-ssr/tree/main/item/ACCESSIBILITY.md#accessibility',
  feedback: 'mailto:feedback@suttacentral.now',
  maintainer: { name: 'sankhato', url: 'https://sr.ht/~benmneb' },
  ogImage: '/og-image2.jpg',
}
