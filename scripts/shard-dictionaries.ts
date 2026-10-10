/**
 * Splits each lookup dictionary in `data/` into small shards in `public/data/`,
 * so the lookup endpoint only has to parse the few kilobytes a word needs
 * rather than the whole 21 MB file, which blows the Worker CPU limit.
 *
 * The shards are build output, so they are gitignored. `build` and `dev` run
 * this first, or run it alone with: pnpm shard-dicts
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(__dirname, '..', 'data')
const SHARDS_DIR = join(__dirname, '..', 'public', 'data')

/** A bucket bigger than this gets split by its next character */
const MAX_SHARD_BYTES = 100 * 1024

/** Chinese keys share no useful prefixes, so they get hashed into this many */
const LZH_SHARDS = 64

type Entries = Array<[string, unknown]>

function sizeOf(entries: Entries): number {
  return entries.reduce(
    (sum, [key, value]) => sum + key.length + JSON.stringify(value).length,
    0
  )
}

/**
 * Groups the entries by prefix, starting from one character and splitting any
 * group over the limit by the character after. A key belongs to the longest
 * prefix it starts with, so a split group keeps the keys that are the prefix
 * itself - `sa` stays in `sa` while `saddha` goes on down to `sad`.
 */
function groupByPrefix(entries: Entries, prefix = ''): Map<string, Entries> {
  const groups = new Map<string, Entries>()
  if (prefix && sizeOf(entries) <= MAX_SHARD_BYTES) {
    groups.set(prefix, entries)
    return groups
  }

  const own: Entries = []
  const children = new Map<string, Entries>()
  for (const entry of entries) {
    if (entry[0].length === prefix.length) {
      own.push(entry)
      continue
    }
    const child = entry[0].slice(0, prefix.length + 1)
    if (!children.has(child)) children.set(child, [])
    children.get(child)!.push(entry)
  }

  if (own.length) groups.set(prefix, own)
  for (const [child, childEntries] of children) {
    for (const [p, e] of groupByPrefix(childEntries, child)) groups.set(p, e)
  }
  return groups
}

function groupByCodePoint(entries: Entries): Map<string, Entries> {
  const groups = new Map<string, Entries>()
  for (const entry of entries) {
    const shard = String(entry[0].codePointAt(0)! % LZH_SHARDS)
    if (!groups.has(shard)) groups.set(shard, [])
    groups.get(shard)!.push(entry)
  }
  return groups
}

/**
 * Writes `public/data/<name>/<n>.json` for each shard, plus an `index.json`
 * that says how to find the shard for a key. Shards are numbered rather than
 * named after their prefix as keys differ only by case in places, and macOS
 * filenames dont.
 */
async function shardDictionary(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  const dir = join(SHARDS_DIR, name)
  await mkdir(dir, { recursive: true })

  const entries = Object.entries(data)
  const byCodePoint = name.startsWith('lookup-lzh')
  const groups = byCodePoint
    ? groupByCodePoint(entries)
    : groupByPrefix(entries)

  const prefixes: Record<string, number> = {}
  let largest = 0
  let n = 0
  for (const [key, group] of groups) {
    // A code point group is already named by its number
    const file = byCodePoint ? key : String(n)
    const json = JSON.stringify(Object.fromEntries(group))
    await writeFile(join(dir, `${file}.json`), json)
    largest = Math.max(largest, json.length)
    prefixes[key] = n++
  }

  const index = byCodePoint
    ? { by: 'codePoint', shards: LZH_SHARDS }
    : { by: 'prefix', prefixes }
  await writeFile(join(dir, 'index.json'), JSON.stringify(index))

  console.log(
    `  Sharded ${name} into ${n} files (largest ${Math.round(largest / 1024)} KB)`
  )
}

// Start clean, so a dictionary dropped from data/ doesnt linger as shards
await rm(SHARDS_DIR, { recursive: true, force: true })
for (const file of await readdir(SOURCE_DIR)) {
  if (!file.endsWith('.json')) continue
  const data = JSON.parse(await readFile(join(SOURCE_DIR, file), 'utf8'))
  await shardDictionary(file.replace(/\.json$/, ''), data)
}
