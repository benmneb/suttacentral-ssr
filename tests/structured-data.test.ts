/**
 * Every sample page's structured data, meta and Open Graph tags are valid, not just there.
 *
 * JSON-LD is checked against the schema.org vocabulary, pinned to a version so
 * a new release can't fail a build. It's fetched once into `node_modules/.cache`.
 */

import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  fetchPages,
  jsonLdProblems,
  jsonLdShapes,
  listSome,
  metaProblems,
  ogImageOf,
  origin,
  parseJsonLd,
  UNLISTED_PAGES,
} from './lib/site.ts'

const SCHEMA_ORG_VERSION = '30.1'
const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '.cache',
  'schema-org',
  `${SCHEMA_ORG_VERSION}.jsonld`
)

// What a JSON number or boolean can stand for, besides text
const NUMBER_RANGES = [
  'Number',
  'Integer',
  'Float',
  'Text',
  'QuantitativeValue',
  'Distance',
]
const BOOLEAN_RANGES = ['Boolean', 'Text']

type Schema = Awaited<ReturnType<typeof schemaOrg>>

/** The pinned schema.org vocabulary, from the cache or else fetched into it */
async function vocabulary(): Promise<{ '@graph': any[] }> {
  try {
    return JSON.parse(await readFile(CACHE, 'utf8'))
  } catch {
    const url = `https://schema.org/version/${SCHEMA_ORG_VERSION}/schemaorg-current-https.jsonld`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    const json = await response.text()
    await mkdir(dirname(CACHE), { recursive: true })
    await writeFile(CACHE, json)
    return JSON.parse(json)
  }
}

/** The schema.org vocabulary's classes and properties */
async function schemaOrg() {
  const { '@graph': graph } = await vocabulary()
  const name = (node: any): string => node['@id'].replace(/^schema:/, '')
  const names = (value: any): string[] => [value ?? []].flat().map(name)
  const classes = new Map<
    string,
    { supersededBy?: string; parents: string[] }
  >()
  const properties = new Map<
    string,
    { supersededBy?: string; domain: string[]; range: string[] }
  >()
  const dataTypes = new Set<string>()
  for (const node of graph) {
    const types = [node['@type']].flat()
    const supersededBy = names(node['schema:supersededBy'])[0]
    if (types.includes('rdf:Property')) {
      properties.set(name(node), {
        supersededBy,
        domain: names(node['schema:domainIncludes']),
        range: names(node['schema:rangeIncludes']),
      })
    } else if (types.includes('rdfs:Class')) {
      classes.set(name(node), {
        supersededBy,
        parents: names(node['rdfs:subClassOf']),
      })
      if (types.includes('schema:DataType')) dataTypes.add(name(node))
    }
  }

  const ancestorsOf = new Map<string, Set<string>>()
  const ancestors = (type: string): Set<string> => {
    if (!ancestorsOf.has(type)) {
      const all = new Set([type])
      for (const parent of classes.get(type)?.parents ?? []) {
        for (const ancestor of ancestors(parent)) all.add(ancestor)
      }
      ancestorsOf.set(type, all)
    }
    return ancestorsOf.get(type)!
  }
  const isDataType = (type: string) =>
    [...ancestors(type)].some(ancestor => dataTypes.has(ancestor))

  return { classes, properties, ancestors, isDataType }
}

/**
 * What's wrong with a JSON-LD shape (see `jsonLdShapes`) by schema.org
 * @param shape - ie `WebPage.isPartOf:WebSite`
 */
function shapeProblems(
  shape: string,
  { classes, properties, ancestors, isDataType }: Schema
) {
  const [, type, property, valueType] = shape.match(/^(.*?)\.(.*):(.*)$/)!
  const typeProblem = (name: string) => {
    if (!classes.has(name)) return `${name} isn't a schema.org type`
    const { supersededBy } = classes.get(name)!
    return supersededBy && `${name} is superseded by ${supersededBy}`
  }
  const types = type.split('|')
  if (!types.every(name => classes.has(name))) {
    return types.map(typeProblem).filter(Boolean)
  }
  const problems = types.map(typeProblem)
  const term = properties.get(property)
  if (!term) {
    problems.push(`${property} isn't a schema.org property`)
    return problems.filter(Boolean)
  }
  if (term.supersededBy) {
    problems.push(`${property} is superseded by ${term.supersededBy}`)
  }
  const domains = new Set(types.flatMap(name => [...ancestors(name)]))
  if (!term.domain.some(domain => domains.has(domain))) {
    problems.push(`${property} isn't a property of ${type}`)
  }
  const inRange = (types: string[]) =>
    term.range.some(range => types.includes(range))
  const fits: Record<string, () => boolean> = {
    string: () => true,
    number: () => inRange(NUMBER_RANGES),
    boolean: () => inRange(BOOLEAN_RANGES),
    node: () => term.range.some(range => range === 'URL' || !isDataType(range)),
  }
  const alternatives = valueType.split('|')
  if (fits[valueType]) {
    if (!fits[valueType]()) {
      problems.push(`${property} takes ${term.range.join(', ')}`)
    }
  } else {
    problems.push(...alternatives.map(typeProblem))
    const known = alternatives.filter(alt => classes.has(alt))
    if (known.length && !known.some(alt => inRange([...ancestors(alt)]))) {
      problems.push(
        `${property} takes ${term.range.join(', ')}, not ${valueType}`
      )
    }
  }
  return problems.filter(Boolean)
}

/** A JPEG or PNG's size and type, ie `1200 630 image/jpeg` */
function imageSize(bytes: Buffer) {
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return `${bytes.readUInt32BE(16)} ${bytes.readUInt32BE(20)} image/png`
  }
  if (bytes.readUInt16BE(0) !== 0xffd8) return 'not a JPEG or PNG'
  for (let at = 2; at + 9 < bytes.length; ) {
    const marker = bytes.readUInt16BE(at)
    // The start of frame markers, bar DHT, JPG and DAC
    if (
      marker >= 0xffc0 &&
      marker <= 0xffcf &&
      ![0xffc4, 0xffc8, 0xffcc].includes(marker)
    ) {
      return `${bytes.readUInt16BE(at + 7)} ${bytes.readUInt16BE(at + 5)} image/jpeg`
    }
    at += 2 + bytes.readUInt16BE(at + 2)
  }
  return 'a JPEG without a size'
}

const schema = await schemaOrg()

describe('Structured data checks', () => {
  it('lists every property of every typed node', () => {
    const shapes = jsonLdShapes({
      '@type': 'WebPage',
      name: 'A',
      isPartOf: { '@type': 'WebSite', '@id': 'https://a.b/#website' },
      author: [{ '@id': 'https://a.b/c' }, { '@type': ['Person'], name: 'B' }],
    })

    assert.deepEqual(
      [...shapes],
      [
        'WebPage.name:string',
        'WebPage.isPartOf:WebSite',
        'WebPage.author:node',
        'WebPage.author:Person',
        'Person.name:string',
      ]
    )
  })

  it('finds made-up types and misplaced properties', () => {
    const problems = (shape: string) => shapeProblems(shape, schema)

    assert.deepEqual(problems('WebPage.isPartOf:WebSite'), [])
    assert.deepEqual(problems('ImageObject.width:number'), [])
    assert.deepEqual(problems('WebPage|Book.isbn:string'), [])
    assert.deepEqual(problems('ListItem.item:node'), [])
    assert.deepEqual(problems('Madeup.name:string'), [
      "Madeup isn't a schema.org type",
    ])
    assert.deepEqual(problems('WebPage.madeUp:string'), [
      "madeUp isn't a schema.org property",
    ])
    assert.deepEqual(problems('Person.isPartOf:WebSite'), [
      "isPartOf isn't a property of Person",
    ])
    assert.deepEqual(problems('WebPage.isPartOf:Person'), [
      'isPartOf takes CreativeWork, URL, not Person',
    ])
    assert.deepEqual(problems('Person.birthDate:number'), [
      'birthDate takes Date',
    ])
  })

  it('finds bad language, meta and Open Graph tags', () => {
    const html = `<!doctype html><html lang=en><head>
      <meta name=viewport content="width=device-width">
      <meta name=description content="A">
      <link rel=canonical href="https://suttacentral.now/m%C4%81">
      <meta property="og:title" content="A">
      <meta property="og:url" content="https://suttacentral.now/mā">
      <meta property="og:type" content="website">
      <meta property="og:image" content="/og-image2.jpg">
      <meta property="book:author" content="B">
      <meta name=twitter:card content=summary_large_image>
      </head><body><p lang=pli>`

    assert.deepEqual(metaProblems(html, '/mā'), [
      'lang: pli',
      'book:author on an og:type website',
      'og:image: /og-image2.jpg',
    ])
    assert.deepEqual(metaProblems('<html><head></head>', '/not-a-page'), [
      'no <html lang>',
      '0 viewport meta tags',
      '0 description meta tags',
    ])
  })
})

describe('Every sample page’s structured data', () => {
  const listed = async () =>
    (await fetchPages()).filter(({ url }) => !UNLISTED_PAGES.includes(url))

  it('has JSON-LD with absolute URLs and whole breadcrumbs', async () => {
    const bad = (await listed())
      .map(({ url, html }) => [url, jsonLdProblems(parseJsonLd(html))])
      .filter(([, problems]) => problems.length > 0)
      .map(([url, problems]) => `${url}: ${[problems].flat().join('; ')}`)
    assert.equal(bad.length, 0, `Pages with bad JSON-LD:\n${listSome(bad)}`)
  })

  it('uses schema.org types, with properties where they belong', async () => {
    const firstUrl = new Map<string, string>()
    for (const { url, html } of await listed()) {
      const scripts = parseJsonLd(html).filter(data => !(data instanceof Error))
      for (const shape of jsonLdShapes(scripts)) {
        if (!firstUrl.has(shape)) firstUrl.set(shape, url)
      }
    }
    const bad = [
      ...new Set(
        [...firstUrl].flatMap(([shape, url]) =>
          shapeProblems(shape, schema).map(problem => `${problem} (${url})`)
        )
      ),
    ]
    assert.equal(
      bad.length,
      0,
      `JSON-LD that isn't valid schema.org:\n${listSome(bad)}`
    )
  })

  it('has valid language, meta and Open Graph tags', async () => {
    const bad = (await fetchPages())
      .map(({ url, html }) => [url, metaProblems(html, url)] as const)
      .filter(([, problems]) => problems.length > 0)
      .map(([url, problems]) => `${url}: ${problems.join('; ')}`)
    assert.equal(bad.length, 0, `Pages with bad tags:\n${listSome(bad)}`)
  })

  it('has Open Graph images of the size and type its tags say', async () => {
    const firstUrl = new Map<string, string>()
    for (const { url, html } of await fetchPages()) {
      const tags = ogImageOf(html)
      if (tags && !firstUrl.has(tags)) firstUrl.set(tags, url)
    }
    const bad = []
    for (const [tags, url] of firstUrl) {
      const [src, width, height, type] = tags.split(' ')
      // A relative one is a meta tag problem, reported above
      if (!URL.canParse(src) || !width) continue
      const response = await fetch(`${origin()}${new URL(src).pathname}`)
      const actual = response.ok
        ? imageSize(Buffer.from(await response.arrayBuffer()))
        : 'missing'
      if (actual !== `${width} ${height} ${type}`) {
        bad.push(`${src} is ${actual}, not ${width} ${height} ${type} (${url})`)
      }
    }
    assert.equal(bad.length, 0, `Wrong Open Graph images:\n${listSome(bad)}`)
  })
})
