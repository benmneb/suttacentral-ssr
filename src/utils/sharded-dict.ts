import { env } from 'cloudflare:workers'
import dictionaryIndexes from '~/generated/dictionary-indexes.json'
import type { Dict } from '~/utils/lookup'

type ShardIndex =
  | { by: 'prefix'; prefixes: Record<string, number> }
  | { by: 'codePoint'; shards: number }

type Shard = Record<string, unknown>

/**
 * How many shards to keep parsed per worker instance. Enough to cover the
 * words of several texts, while stopping a long-lived instance from slowly
 * collecting the whole 25 MB of dictionaries back into memory
 */
const MAX_SHARDS = 300

// Written by `scripts/shard-dictionaries.ts`, which `build` and `dev` run first
const indexes = dictionaryIndexes.indexes as Record<string, ShardIndex>

/** A hash of the dictionaries' contents, which changes whenever they do */
export const DICTIONARY_VERSION = dictionaryIndexes.version
// Map keeps insertion order, so the first key is always the least recently used
const shards = new Map<string, Promise<Shard | null>>()

/**
 * Fetch JSON from `public/data/` via the ASSETS binding. Waiting on the fetch
 * costs no CPU time, only parsing does - which is why the files are small.
 *
 * The binding works in dev too (Vite serves `public/`), so there is no
 * separate filesystem path. `node:fs` cannot reach the project directory from
 * inside workerd anyway
 */
async function fetchJson<T>(path: string, origin: string): Promise<T | null> {
  const res = await env.ASSETS.fetch(new URL(path, origin))
  if (!res.ok) return null
  return (await res.json()) as T
}

function loadShard(name: string, n: number, origin: string) {
  const path = `/data/${name}/${n}.json`
  let shard = shards.get(path)
  if (shard) {
    shards.delete(path)
  } else {
    shard = fetchJson<Shard>(path, origin)
    shard.then(s => s ?? shards.delete(path))
  }
  shards.set(path, shard)
  if (shards.size > MAX_SHARDS) shards.delete(shards.keys().next().value!)
  return shard
}

/** Which shard a key lives in, or null when no shard could hold it */
function shardFor(key: string, index: ShardIndex): number | null {
  if (!key) return null
  if (index.by === 'codePoint') return key.codePointAt(0)! % index.shards
  // A key belongs to the longest prefix it starts with
  for (let i = key.length; i > 0; i--) {
    const prefix = key.slice(0, i)
    if (Object.hasOwn(index.prefixes, prefix)) return index.prefixes[prefix]
  }
  return null
}

export type ShardedDict<T> = Dict<T> & {
  /**
   * Fetch every shard that keys starting like these could be in, all at once.
   * A lookup awaits its keys one after another, and in production each fetch
   * of a shard is a round trip of its own - so without this, a word costs
   * several of them back to back.
   */
  prefetch(keys: string[]): Promise<void>
}

/**
 * Lookups never ask for a prefix shorter than this, so its shard (which holds
 * only the keys that are the prefix itself) is not worth prefetching
 */
const MIN_PROBE_LENGTH = 4

/**
 * One of the dictionaries split up by `scripts/shard-dictionaries.ts`, which
 * fetches and parses only the shards that keys are looked up in
 */
export function getShardedDict<T>(
  name: string,
  origin: string
): ShardedDict<T> {
  const index = indexes[name]
  return {
    async get(key) {
      if (!index) return undefined
      const n = shardFor(key, index)
      if (n === null) return undefined
      const shard = await loadShard(name, n, origin)
      if (!shard || !Object.hasOwn(shard, key)) return undefined
      return shard[key] as T
    },

    async prefetch(keys) {
      if (!index) return
      const needed = new Set<number>()
      for (const key of keys) {
        const shortest = Math.min(MIN_PROBE_LENGTH, key.length)
        for (let i = key.length; i >= shortest; i--) {
          const n = shardFor(key.slice(0, i), index)
          if (n !== null) needed.add(n)
        }
      }
      await Promise.all([...needed].map(n => loadShard(name, n, origin)))
    },
  }
}
