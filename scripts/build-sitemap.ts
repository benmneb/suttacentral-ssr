/**
 * Writes the sitemaps, as every page is rendered on request and the build has
 * no list of them. Lists each page by the path the site links to, so none
 * redirects:
 *
 * - pages: the site pages, /pitaka pages, chapters, shortcuts, each text's
 *   suttaplex (individual range suttas too), /languages and /edition pages
 * - texts: every translation of every text, in every language
 * - define: every word .net's /api/dictionary_full has an entry for
 *
 * - public/sitemap.xml: the index of the others
 * - public/sitemap-<group>-<n>.xml: up to 40,000 URLs each, under the
 *   protocol's 50,000
 *
 * Writes nothing if a request fails, so a bad day at SC cant leave a sitemap
 * half empty.
 *
 * Run: pnpm build-sitemap
 * After running: review changes then commit.
 */

import { readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteMetaData } from '../src/constants/meta-data.ts'

type MenuNode = { uid: string | null; node_type: string; children?: MenuNode[] }
type Translation = { lang: string; author_uid: string; segmented: boolean }
type Suttaplex = { uid: string; type: string; translations?: Translation[] }

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')
const ORIGIN = siteMetaData.origin
const API = 'https://suttacentral.net/api'
const DICTIONARIES =
  'https://raw.githubusercontent.com/suttacentral/sc-data/main/dictionaries'
const PER_FILE = 40_000
const CONCURRENCY = 8
const RETRIES = 3

let active = 0
const queue: (() => void)[] = []

async function fetchJson(url: string): Promise<any> {
  if (active >= CONCURRENCY) await new Promise<void>(go => queue.push(go))
  active++
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`${url}: ${response.status} ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        if (attempt === RETRIES) throw error
        await new Promise(wait => setTimeout(wait, 1000 * 2 ** attempt))
      }
    }
  } finally {
    active--
    queue.shift()?.()
  }
}

/** A menu node with its children, without the empty ones the api gives some, eg g2dhp */
async function fetchMenu(uid: string): Promise<MenuNode> {
  const [node] = await fetchJson(`${API}/menu/${uid}?language=en`)
  return { ...node, children: node.children?.filter((c: MenuNode) => c?.uid) }
}

const hasBranches = (node: MenuNode) =>
  !!node.children?.some(c => c.node_type === 'branch')

// The pātimokkhas are chapters, though they have branches under them
const isChapter = (node: MenuNode) =>
  !hasBranches(node) || node.uid!.endsWith('-pm')

const sitePages = async () => {
  const files = [
    ...(await readdir(join(ROOT, 'src', 'pages'))),
    'languages.astro',
  ]
  return files
    .filter(
      file =>
        file.endsWith('.astro') &&
        !/^[[.]/.test(file) &&
        !/^(404|500|search)/.test(file)
    )
    .map(file => (file === 'index.astro' ? '/' : `/${file.slice(0, -6)}`))
    .sort()
}

const shortcuts: string[] =
  (await fetchJson(`${API}/shortcuts`))[0]?.shortcuts ?? []

/**
 * The /pitaka paths and /uid pages under a menu node, and the uids whose
 * suttaplex holds the texts below it
 */
async function walk(uid: string, path: string) {
  const node = await fetchMenu(uid)
  const pitaka: string[] = []
  const pages: string[] = []
  const suttaplexes: string[] = []

  if (isChapter(node)) {
    pages.push(`/${uid}`)
    suttaplexes.push(uid)
    return { pitaka, pages, suttaplexes }
  }

  pitaka.push(`/pitaka${path}`)
  if (shortcuts.includes(uid)) pages.push(`/${uid}`)
  const children = await Promise.all(
    node.children!.map(child =>
      child.node_type === 'leaf'
        ? { pitaka: [], pages: [], suttaplexes: [child.uid!] }
        : walk(child.uid!, `${path}/${child.uid}`)
    )
  )
  for (const child of children) {
    pitaka.push(...child.pitaka)
    pages.push(...child.pages)
    suttaplexes.push(...child.suttaplexes)
  }
  return { pitaka, pages, suttaplexes }
}

/** The uids in a range sutta, eg an1.1-10 is an1.1 to an1.10, as .net splits them */
function rangeUids(uid: string): string[] {
  const match = /^(.+?)(\d+)-(\d+)$/.exec(uid)
  if (!match || !/^(an|sn|dhp)\d/.test(uid)) return []
  const [, prefix, start, end] = match
  return Array.from(
    { length: Number(end) - Number(start) + 1 },
    (_, i) => `${prefix}${Number(start) + i}`
  )
}

/**
 * Each text's suttaplex page and every translation, individual range suttas
 * included. A pātimokkha has its translations on the branch
 */
function textPaths(items: Suttaplex[]) {
  const pages: string[] = []
  const texts = new Set<string>()
  for (const { uid, type, translations } of items) {
    const singles = type === 'leaf' ? rangeUids(uid) : []
    if (type === 'leaf') pages.push(`/${uid}`, ...singles.map(u => `/${u}`))
    for (const { lang, author_uid, segmented } of translations ?? []) {
      texts.add(`/${uid}/${lang}/${author_uid}`)
      // Only a segmented text can be split into its suttas
      if (segmented) {
        for (const single of singles) {
          texts.add(`/${single}/${lang}/${author_uid}`)
        }
      }
    }
  }
  return { pages, texts: [...texts] }
}

async function languagePaths() {
  const { ancient, modern } = await fetchJson(`${API}/translation_count`)
  return [...ancient, ...modern].map(
    ({ iso_code }: { iso_code: string }) => `/languages/${iso_code}`
  )
}

/** Each web edition and its front matter, by the first web edition of a text, as /edition finds it */
async function editionPaths() {
  const editions: { edition_id: string }[] = await fetchJson(
    `${API}/publication/editions`
  )
  const web = editions.filter(e => e.edition_id.includes('-web_'))
  const details = await Promise.all(
    web.map(e => fetchJson(`${API}/publication/edition/${e.edition_id}`))
  )
  return details.flatMap(({ edition, publication }, i) => {
    const { text_uid, translation_lang_iso, creator_uid } = publication
    const first = web.find(e => e.edition_id.startsWith(`${text_uid}-`))
    if (first !== web[i]) return []
    const book = `/edition/${text_uid}/${translation_lang_iso}/${creator_uid}`
    const matter = (edition?.frontmatter ?? []).map(
      (path: string) => `${book}/${path.split('/').pop()!.replace('.html', '')}`
    )
    return [book, ...matter]
  })
}

/** A dictionary's key as its word: without a homonym's number (eg nāga<sup>1</sup>) or a doubtful entry's ? */
const pageWord = (key: string) =>
  String(key)
    .normalize('NFC')
    .replace(/<sup>\d+<\/sup>/g, '')
    .replace(/\?$/, '')
    .trim()

/** The words .net's dictionary_full has entries for, in the dictionaries it loads */
async function definePaths() {
  const sources = [
    ['simple/en/pli2en_dpd', 'entry'],
    ['simple/en/pli2en_ncped', 'entry'],
    ['complex/en/pli2en_pts', 'word'],
    ['complex/en/pli2en_dppn', 'word'],
    ['complex/en/pli2en_dhammika', 'word'],
  ]
  const words = new Set<string>()
  for (const [file, field] of sources) {
    const entries: any[] = await fetchJson(`${DICTIONARIES}/${file}.json`)
    // NCPED nests some homonyms as entries of their own
    const all = entries.flatMap(e => [e, ...(e.homonyms ?? [])])
    for (const entry of all) {
      const word = entry[field] && pageWord(entry[field])
      if (word) words.add(word)
    }
  }
  const collator = new Intl.Collator('en')
  return [...words].sort(collator.compare).map(word => `/define/${word}`)
}

const roots: { uid: string }[] = await fetchJson(`${API}/tipitaka_menu`)
const menu = await Promise.all(roots.map(({ uid }) => walk(uid, `/${uid}`)))
const suttaplexes = await Promise.all(
  menu
    .flatMap(m => m.suttaplexes)
    .map(uid => fetchJson(`${API}/suttaplex/${uid}?language=en`))
)
const texts = textPaths(suttaplexes.flat())

const groups = {
  pages: [
    ...(await sitePages()),
    ...menu.flatMap(m => m.pitaka),
    ...(await languagePaths()),
    ...(await editionPaths()),
    ...menu.flatMap(m => m.pages),
    ...texts.pages,
  ],
  texts: texts.texts,
  define: await definePaths(),
}

for (const [name, paths] of Object.entries(groups)) {
  if (!paths.length) throw new Error(`No ${name} paths, so nothing written`)
}

const escapeXml = (s: string) =>
  s.replace(
    /[&<>'"]/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&apos;',
        '"': '&quot;',
      })[c]!
  )
const loc = (path: string) =>
  `<loc>${escapeXml(ORIGIN + encodeURI(path))}</loc>`

const files: [string, string[]][] = []
for (const [name, paths] of Object.entries(groups)) {
  const unique = [...new Set(paths)]
  for (let i = 0; i < unique.length; i += PER_FILE) {
    files.push([
      `sitemap-${name}-${i / PER_FILE + 1}.xml`,
      unique.slice(i, i + PER_FILE),
    ])
  }
}

for (const file of await readdir(PUBLIC)) {
  if (/^sitemap.*\.xml$/.test(file)) await unlink(join(PUBLIC, file))
}

const XML = '<?xml version="1.0" encoding="utf-8"?>'
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
await Promise.all([
  ...files.map(([file, paths]) =>
    writeFile(
      join(PUBLIC, file),
      `${XML}\n<urlset ${NS}>\n${paths.map(p => `<url>${loc(p)}</url>`).join('\n')}\n</urlset>\n`
    )
  ),
  writeFile(
    join(PUBLIC, 'sitemap.xml'),
    `${XML}\n<sitemapindex ${NS}>\n${files.map(([file]) => `<sitemap>${loc(`/${file}`)}</sitemap>`).join('\n')}\n</sitemapindex>\n`
  ),
])

for (const [file, paths] of files) {
  console.log(`public/${file}: ${paths.length} URLs`)
}
console.log(
  `${files.reduce((sum, [, paths]) => sum + paths.length, 0)} URLs in all. Review changes, then commit public/sitemap*.xml`
)
