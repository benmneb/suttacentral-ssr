/**
 * Syncs official SC i18n translations from SuttaCentral's static assets.
 * Updates local files in src/i18n/locales/, leaving _scx_ and _machine_ files untouched.
 *
 * Run: pnpm sync-i18n
 * After running: review changes then commit.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales')
const SC_BASE = 'https://suttacentral.net/localization/elements'

/**
 * File base names to sync from SC.
 */
const FILE_BASES = [
  'abbreviations',
  'abhidhamma',
  'about',
  'acknowledgments',
  'an-guide-sujato',
  'an-introduction-bodhi',
  'discourses',
  'dn-guide-sujato',
  'donations',
  'general-guide-sujato',
  // 'home',  // intentionally simplified here
  'interface',
  'introduction',
  'languages',
  'licensing',
  'map',
  'methodology',
  'mn-guide-sujato',
  'names',
  'numbering',
  'pali-tipitaka',
  'pirivena',
  'publication',
  'search',
  'similes',
  'sn-guide-sujato',
  'start',
  'subjects',
  'suttaplex',
  'terminology',
  'viewoption',
  'vinaya',
]

/**
 * Transformations applied to fetched SC data before comparing and writing.
 * These normalize differences that are intentional local modifications,
 * so they don't get treated as real changes worth updating.
 */
const TRANSFORMATIONS: [RegExp, string][] = [
  // Strip suttacentral.net domain from href attributes so internal links still work.
  // Skips <a rel='dct:publisher'> tags (CC attribution links that intentionally reference SC).
  // Negative lookbehind handles rel before href; negative lookahead handles rel after href.
  [
    /(?<!rel=['"]dct:publisher['"][^>]*)href=(['"])https:\/\/suttacentral\.net\/(?![^>]*rel=['"]dct:publisher['"])/g,
    'href=$1/',
  ],
]

function transform(data: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    result[key] = TRANSFORMATIONS.reduce(
      (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
      value
    )
  }
  return result
}

/**
 * Fetches a single translation file from SC.
 * Returns null if the file content type doesn't match.
 * (SC's doesn't return real 404s for missing files)
 */
async function fetchFile(
  filename: string
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${SC_BASE}/${filename}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return null
    return await res.json()
  } catch (err) {
    console.error(`  Error fetching ${filename}: ${err.message}`)
    return null
  }
}

const locales = await readdir(LOCALES_DIR)
const total = FILE_BASES.length * locales.length

console.log(`Syncing i18n from ${SC_BASE}`)
console.log(`Using ${TRANSFORMATIONS.length} transformation(s)`)
console.log(
  `${FILE_BASES.length} file types × ${locales.length} locales = ${total} requests\n`
)

const stats = { updated: 0, created: 0, unchanged: 0, notFound: 0 }

for (const base of FILE_BASES) {
  process.stdout.write(`${base}: `)

  const results = await Promise.all(
    locales.map(async locale => {
      const filename = `${base}_${locale}.json`
      const filepath = join(LOCALES_DIR, locale, filename)
      const raw = await fetchFile(filename)

      if (!raw) {
        stats.notFound++
        return null // silently skip
      }

      const data = transform(raw)

      try {
        const existing = JSON.parse(await readFile(filepath, 'utf-8'))
        if (JSON.stringify(existing) === JSON.stringify(data)) {
          stats.unchanged++
          return null // unchanged, don't log
        }
        await writeFile(filepath, JSON.stringify(data, null, 2) + '\n')
        stats.updated++
        return `${locale}=changed`
      } catch {
        // File doesn't exist locally yet — create it
        await mkdir(join(LOCALES_DIR, locale), { recursive: true })
        await writeFile(filepath, JSON.stringify(data, null, 2) + '\n')
        stats.created++
        return `${locale}=new`
      }
    })
  )

  console.log(results.filter(Boolean).join(', ') || 'all unchanged')
}

console.log(
  `\nUpdated: ${stats.updated} | New: ${stats.created} | Unchanged: ${stats.unchanged} | Not found (skipped): ${stats.notFound}`
)
console.log('\nReview changes: git diff src/i18n')
