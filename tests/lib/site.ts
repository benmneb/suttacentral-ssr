/**
 * The sample of pages the tests check, each fetched once from the server
 * `setup.ts` starts, and what the tests read from their HTML.
 *
 * Every page is rendered from SuttaCentral's API as it's requested, so the
 * sample is a page or two of each kind and shape of data, not every page.
 * `TEST_PAGES=/mn1/en/sujato,/about` checks just those.
 */

import { siteMetaData } from '../../src/constants/meta-data.ts'
import { SCHEMA_ORG } from '../../src/constants/urls.ts'

export const MISSING_PAGE = '/not-a-page'

// Pages without structured data or Open Graph tags, as they aren't for sharing or indexing
export const UNLISTED_PAGES = ['/search?query=metta', MISSING_PAGE]

export const SAMPLE_PAGES = [
  '/',
  // Texts: segmented, long, range, legacy, vinaya, root Pāli and Chinese, Pāli
  // in another script, and some with markup slips in .net's data
  '/mn1/en/sujato',
  '/mn10/en/sujato',
  '/dn16/en/sujato',
  '/dn33/en/sujato',
  '/an1.1-10/en/sujato',
  '/ds1.1/en/sujato',
  '/dn1/en/bodhi',
  '/dn1/de/sabbamitta',
  '/pli-tv-bu-vb-pj1/en/brahmali',
  '/mn1/pli/ms',
  '/ma1/lzh/sct',
  '/mn1/en/sujato?script=Sinhala',
  '/an1.378-393/en/sujato',
  '/patthana1.8/en/narada',
  '/sn45.33/en/sujato',
  '/t765.63/lzh/sct',
  // Navigation
  '/pitaka/sutta',
  '/pitaka/sutta/middle/mn',
  '/mn',
  '/mn-mulapariyayavagga',
  '/mn1',
  '/an1.1-10',
  // A chapter the API calls a leaf
  '/lzh-mu-bi-vb-pd',
  // Site pages
  '/abbreviations',
  '/abhidhamma-guide-sujato',
  '/about',
  '/acknowledgments',
  '/an-guide-sujato',
  '/an-introduction-bodhi',
  '/discourses-guide-sujato',
  '/dn-guide-sujato',
  '/editions',
  '/edition/mn/en/sujato',
  '/edition/mn/en/sujato/introduction',
  '/general-guide-sujato',
  '/introduction',
  '/languages',
  '/languages/pli',
  '/licensing',
  '/map',
  '/methodology',
  '/mn-guide-sujato',
  '/names',
  '/numbering',
  '/offline',
  '/pali-tipitaka',
  '/pirivena-project',
  '/similes',
  '/sn-guide-sujato',
  '/start',
  '/subjects',
  '/terminology',
  '/vinaya-guide-brahmali',
  '/define/r%C4%81jagaha',
  '/define/dhamma',
  '/define/vejayanta',
  // In another language
  '/?lang=de',
  '/mn1/en/sujato?lang=de',
  '/mn?lang=de',
  '/pitaka/sutta?lang=de',
  '/about?lang=de',
  '/map?lang=de',
  '/define/r%C4%81jagaha?lang=de',
  ...UNLISTED_PAGES,
]

const CONCURRENCY = 4

export type Page = { url: string; status: number; html: string }

/** The server under test, ie `http://127.0.0.1:52341` */
export function origin() {
  const testOrigin = process.env.TEST_ORIGIN
  if (!testOrigin) throw new Error('No TEST_ORIGIN, run these with pnpm test')
  return testOrigin.replace(/\/$/, '')
}

/** The pages to check, `TEST_PAGES`' if it's set */
export function samplePages() {
  return process.env.TEST_PAGES?.split(',') ?? SAMPLE_PAGES
}

let fetched: Promise<Page[]> | undefined

/** Every sample page's status and HTML, fetched once for all the tests */
export function fetchPages() {
  fetched ??= (async () => {
    const queue = [...samplePages()]
    const pages: Page[] = []
    async function next() {
      for (let url; (url = queue.shift()); ) {
        const response = await fetch(`${origin()}${url}`, {
          redirect: 'manual',
        })
        pages.push({
          url,
          status: response.status,
          html: await response.text(),
        })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, next))
    const order = samplePages()
    return pages.sort((a, b) => order.indexOf(a.url) - order.indexOf(b.url))
  })()
  return fetched
}

/** Lists up to `max` items for a failure message, saying how many more there were */
export function listSome(items: string[], max = 50) {
  const shown = items.slice(0, max).map(item => `  ${item}`)
  if (items.length > max) shown.push(`  …and ${items.length - max} more`)
  return shown.join('\n')
}

/** Decodes the few entities the pages put in attributes */
function decodeEntities(str: string) {
  return str
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const JSON_LD = /<script type="?application\/ld\+json"?>([\s\S]*?)<\/script>/g

/** A page's JSON-LD scripts, each parsed, or the error parsing it threw */
export function parseJsonLd(html: string): unknown[] {
  return [...html.matchAll(JSON_LD)].map(([, json]) => {
    try {
      return JSON.parse(json)
    } catch (error) {
      return error
    }
  })
}

const canonicalTags = new Map<string, boolean>()

/** Whether a `lang` value is a BCP 47 tag in its canonical form, ie `pi`, not `pli` or `en-us` */
export function isCanonicalLangTag(tag: string) {
  if (!canonicalTags.has(tag)) {
    let canonical = false
    try {
      canonical = Intl.getCanonicalLocales(tag)[0] === tag
    } catch {}
    canonicalTags.set(tag, canonical)
  }
  return canonicalTags.get(tag)
}

/** What a breadcrumb list lacks of Google's required fields */
function breadcrumbProblems(list: any) {
  const items = [list.itemListElement ?? []].flat()
  return items.flatMap((item, i) => {
    const problems = []
    if (item?.['@type'] !== 'ListItem') {
      problems.push(`breadcrumb ${i + 1} is a ${item?.['@type']}`)
    }
    if (item?.position !== i + 1) {
      problems.push(`breadcrumb ${i + 1} has position ${item?.position}`)
    }
    if (!item?.name) problems.push(`breadcrumb ${i + 1} has no name`)
    if (!item?.item && i < items.length - 1) {
      problems.push(`breadcrumb ${i + 1} has no item`)
    }
    return problems
  })
}

/** What's wrong with a page's JSON-LD: an unparsable script, a relative URL, or missing data */
export function jsonLdProblems(scripts: unknown[]) {
  if (!scripts.length) return ['none']
  const problems: string[] = []
  const walk = (value: unknown, key?: string) => {
    if (Array.isArray(value)) return value.forEach(item => walk(item, key))
    if (value && typeof value === 'object') {
      if ((value as any)['@type'] === 'BreadcrumbList') {
        problems.push(...breadcrumbProblems(value))
      }
      for (const [k, v] of Object.entries(value)) walk(v, k)
      return
    }
    if (typeof value !== 'string' || !key) return
    if (['@id', 'url', 'item'].includes(key) && !/^https?:\/\//.test(value)) {
      problems.push(`relative ${key}: ${value}`)
    }
    if (key === 'inLanguage' && !isCanonicalLangTag(value)) {
      problems.push(`inLanguage: ${value}`)
    }
    // A dictionary can define a word as "undefined"
    if (key !== 'description' && /\b(undefined|NaN)\b|\[object /.test(value)) {
      problems.push(`${key}: ${value}`)
    }
  }
  for (const data of scripts) {
    if (data instanceof Error) {
      problems.push(`unparsable: ${data.message}`)
      continue
    }
    if ((data as any)['@context'] !== SCHEMA_ORG) {
      problems.push(`@context: ${(data as any)['@context']}`)
    }
    walk(data)
  }
  return problems.slice(0, 3)
}

function valueTypeOf(value: unknown) {
  if (value && typeof value === 'object') {
    return [(value as any)['@type'] ?? 'node'].flat().join('|')
  }
  return typeof value
}

/**
 * Each property of each typed node in some JSON-LD, as `Type.property:valueType`, ie
 * `WebPage.isPartOf:WebSite`, where an untyped object's value type is `node`, and a node's several types are joined by `|`
 */
export function jsonLdShapes(data: unknown, shapes = new Set<string>()) {
  if (Array.isArray(data)) {
    for (const item of data) jsonLdShapes(item, shapes)
    return shapes
  }
  if (!data || typeof data !== 'object') return shapes
  const type = [(data as any)['@type'] ?? []].flat().join('|')
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('@')) continue
    for (const item of [value].flat()) {
      if (type) shapes.add(`${type}.${key}:${valueTypeOf(item)}`)
      jsonLdShapes(item, shapes)
    }
  }
  return shapes
}

const ATTR = /([^\s=/>]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

/** A tag's attributes, ie `meta property="og:url" content="…"` -> `{ property: 'og:url', content: '…' }` */
function attributesOf(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(ATTR)].map(match => [
      match[1].toLowerCase(),
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''),
    ])
  )
}

const LANG_ATTR = /\s(?:lang|hreflang)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

const TWITTER_CARDS = ['summary', 'summary_large_image', 'app', 'player']

// ogp.me's object types, and the namespaces only they can have tags in
const OG_TYPES = /^(website|article|book|profile|(music|video)\.[a-z_.]+)$/
const OG_NAMESPACES = ['article', 'book', 'profile', 'music', 'video']
const OG_REQUIRED = ['og:title', 'og:type', 'og:image', 'og:url']
const OG_LOCALE = /^[a-z]{2,3}_[A-Z]{2}$/

/**
 * What's wrong with a page's language tags, meta tags and Open Graph tags
 * @param url - The page's path, ie `/mn1/en/sujato`
 */
export function metaProblems(html: string, url: string) {
  const problems: string[] = []
  const headEnd = html.indexOf('</head>')
  const head = headEnd === -1 ? html : html.slice(0, headEnd)

  if (!/<html\s[^>]*\blang=/.test(html)) problems.push('no <html lang>')
  const langs = new Set(
    [...html.matchAll(LANG_ATTR)].map(match => match[1] ?? match[2] ?? match[3])
  )
  for (const lang of langs) {
    // An empty lang is valid, as "unknown"
    if (lang && lang !== 'x-default' && !isCanonicalLangTag(lang)) {
      problems.push(`lang: ${lang}`)
    }
  }

  const metas = [...head.matchAll(/<meta\s([^>]*)>/g)].map(match =>
    attributesOf(match[1])
  )
  const named = (name: string) => metas.filter(meta => meta.name === name)
  for (const name of ['viewport', 'description', 'twitter:card']) {
    const count = named(name).length
    if (count !== 1) problems.push(`${count} ${name} meta tags`)
  }
  const card = named('twitter:card')[0]?.content
  if (card && !TWITTER_CARDS.includes(card)) {
    problems.push(`twitter:card: ${card}`)
  }

  const og = new Map<string, string[]>()
  for (const { property, content } of metas) {
    if (!property) continue
    if (!og.has(property)) og.set(property, [])
    og.get(property)!.push(content)
  }
  if (og.size || !UNLISTED_PAGES.includes(url)) {
    for (const property of OG_REQUIRED) {
      const count = og.get(property)?.length ?? 0
      if (count !== 1) problems.push(`${count} ${property} tags`)
    }
  }
  const type = og.get('og:type')?.[0]
  if (type && !OG_TYPES.test(type)) problems.push(`og:type: ${type}`)
  for (const property of og.keys()) {
    const namespace = property.split(':')[0]
    if (OG_NAMESPACES.includes(namespace) && !type?.startsWith(namespace)) {
      problems.push(`${property} on an og:type ${type}`)
    }
  }
  for (const locale of [
    ...(og.get('og:locale') ?? []),
    ...(og.get('og:locale:alternate') ?? []),
  ]) {
    if (!OG_LOCALE.test(locale)) problems.push(`og:locale: ${locale}`)
  }
  const ogUrl = og.get('og:url')?.[0]
  const canonical = head.match(
    /<link rel="?canonical"? href="?([^"\s>]*)"?/
  )?.[1]
  // Not the query, ie ?lang=de, which og:url keeps for sharing
  const ogPath = ogUrl?.split('?')[0]
  if (ogPath && canonical && decodeURI(ogPath) !== decodeURI(canonical)) {
    problems.push(`og:url ${ogUrl} isn't the canonical ${canonical}`)
  }
  const image = og.get('og:image')?.[0]
  if (image && !image.startsWith(`${siteMetaData.origin}/`)) {
    problems.push(`og:image: ${image}`)
  }
  return problems.slice(0, 3)
}

/** A page's Open Graph image and what its tags say about it, ie `https://…/og.jpg 1200 630 image/jpeg` */
export function ogImageOf(html: string) {
  const content = (property: string) =>
    html.match(
      new RegExp(`<meta property="?${property}"? content="?([^"\\s>]*)"?`)
    )?.[1] ?? ''
  if (!content('og:image')) return null
  return ['og:image', 'og:image:width', 'og:image:height', 'og:image:type']
    .map(content)
    .join(' ')
}
