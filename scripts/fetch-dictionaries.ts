/**
 * Fetches lookup dictionaries from SuttaCentral API and saves them
 * as compact JSON files for use at SSR render time.
 *
 * Run: pnpm fetch-dicts
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { AVAILABLE_LOOKUPS } from '../src/constants/lookup.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'data')

const DICTIONARIES = Object.entries(AVAILABLE_LOOKUPS).flatMap(([from, tos]) =>
  tos.map(to => ({ from, to }))
)

async function fetchDict(from, to, fallback = false) {
  const url = `https://suttacentral.net/api/dictionaries/lookup?from=${from}&to=${to}&fallback=${fallback}`
  const response = await fetch(url)
  if (!response.ok) {
    console.error(`  Failed: ${response.status} ${response.statusText}`)
    return {}
  }
  const data = await response.json()
  const compact = {}
  for (const entry of data) {
    // minify for that perf
    const obj = { d: entry.definition }
    if (entry.grammar) obj.g = entry.grammar
    if (entry.xr) obj.x = entry.xr
    if (from === 'lzh' && entry.pronunciation) obj.p = entry.pronunciation
    compact[entry.entry] = obj
  }
  return compact
}

async function fetchDictionary({ from, to }) {
  console.log(`Fetching ${from} → ${to} ...`)

  const compact = await fetchDict(from, to)

  // For Chinese, merge fallback dictionary entries
  if (from === 'lzh') {
    console.log(`  Fetching ${from} → ${to} fallback ...`)
    const fallback = await fetchDict(from, to, true)
    let added = 0
    for (const [key, val] of Object.entries(fallback)) {
      if (!(key in compact)) {
        compact[key] = val
        added++
      }
    }
    console.log(`  Merged ${added.toLocaleString()} fallback entries`)
  }

  const filename = `lookup-${from}-${to}.json`
  const filepath = join(DATA_DIR, filename)
  await writeFile(filepath, JSON.stringify(compact))

  const entries = Object.keys(compact).length
  const sizeKB = Math.round(JSON.stringify(compact).length / 1024)
  console.log(
    `  Saved ${filename} (${entries.toLocaleString()} entries, ${sizeKB.toLocaleString()} KB)`
  )
}

await mkdir(DATA_DIR, { recursive: true })

for (const dict of DICTIONARIES) {
  await fetchDictionary(dict)
}

/**
 * DPD (Digital Pali Dictionary) data — maps inflected Pali forms to headwords,
 * enabling lookup of words like "naṁ" → "ta" regardless of target language
 */
const DPD_BASE_URL =
  'https://raw.githubusercontent.com/suttacentral/suttacentral/main/client/elements/lookups/dpd'

async function fetchDPD() {
  for (const name of ['dpd_i2h', 'dpd_deconstructor']) {
    console.log(`Fetching ${name} ...`)
    const response = await fetch(`${DPD_BASE_URL}/${name}.js`)
    if (!response.ok) {
      console.error(`  Failed: ${response.status} ${response.statusText}`)
      continue
    }
    const js = await response.text()

    // The JS files are `export const dpd_i2h = { ... }` — write to temp file
    // and dynamic import to extract the object (avoids fragile string parsing)
    const tempPath = join(DATA_DIR, `_temp_${name}.mjs`)
    await writeFile(tempPath, js)
    try {
      const mod = await import(pathToFileURL(tempPath).href)
      const data = mod[name]

      const jsonName = name.replace(/_/g, '-') + '.json'
      const jsonPath = join(DATA_DIR, jsonName)
      await writeFile(jsonPath, JSON.stringify(data))

      const entries = Object.keys(data).length
      const sizeKB = Math.round(JSON.stringify(data).length / 1024)
      console.log(
        `  Saved ${jsonName} (${entries.toLocaleString()} entries, ${sizeKB.toLocaleString()} KB)`
      )
    } finally {
      await unlink(tempPath)
    }
  }
}

await fetchDPD()

console.log('Done.')
