import { env } from 'cloudflare:workers'
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

const indexes = new Map<string, Promise<ShardIndex | null>>()
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

function loadIndex(name: string, origin: string): Promise<ShardIndex | null> {
  if (!indexes.has(name)) {
    const index = fetchJson<ShardIndex>(`/data/${name}/index.json`, origin)
    indexes.set(name, index)
    // A failed fetch shouldnt stick, the next request can try again
    index.then(i => i ?? indexes.delete(name))
  }
  return indexes.get(name)!
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

/**
 * One of the dictionaries split up by `scripts/shard-dictionaries.ts`, which
 * fetches and parses only the shards that keys are looked up in
 */
export function getShardedDict<T>(name: string, origin: string): Dict<T> {
  return {
    async get(key) {
      const index = await loadIndex(name, origin)
      if (!index) return undefined
      const n = shardFor(key, index)
      if (n === null) return undefined
      const shard = await loadShard(name, n, origin)
      if (!shard || !Object.hasOwn(shard, key)) return undefined
      return shard[key] as T
    },
  }
}
