import { AVAILABLE_LOOKUPS } from '~/constants/lookup'
import {
  type LookupEntry,
  lookupLzh,
  lookupPali,
  normalizeHanzi,
  paliLookupKeys,
  serializeMatch,
} from '~/utils/lookup'
import { DICTIONARY_VERSION, getShardedDict } from '~/utils/sharded-dict'

/** Longer than any real word, short enough to bound the work one request does */
const MAX_LENGTH = 100

export type LookupQuery = {
  /** Source language ('pli' or 'lzh') */
  from: string
  /** Target language ('en', 'es', 'zh', 'pt', 'id', 'nl') */
  to: string
  /** A Pali word, or a run of Chinese characters around the one clicked */
  query: string
  /** Where the clicked one is in `query`, counting characters */
  at: number
  /** Set when `query` is in simplified characters */
  hans: boolean
}

/** The status to refuse a lookup with, or null when it can be answered */
export function lookupError({ from, to, query, at }: LookupQuery) {
  // Both end up in an asset path, so only ever the known pairs
  if (!AVAILABLE_LOOKUPS[from]?.includes(to) || !query) return 400
  if (query.length > MAX_LENGTH) return 414
  if (
    from === 'lzh' &&
    !(Number.isInteger(at) && at >= 0 && at < [...query].length)
  ) {
    return 400
  }
  return null
}

/**
 * The JSON answer to a lookup that `lookupError` passed.
 *
 * Performs all linguistic processing server-side (DPD inflection mapping,
 * compound decomposition, sandhi resolution) and returns only the matched
 * results. The dictionaries are sharded, so a lookup parses just the few
 * shards its word touches - parsing whole dictionaries, or every word on a
 * page at once, runs past the Worker CPU limit.
 *
 * For Pali: tries DPD inflection-to-headword first, then compound
 * decomposition with fuzzy matching. Falls back to the English dictionary
 * for languages with limited coverage (e.g. Indonesian, Dutch).
 *
 * For Chinese: finds the dictionary entries in the text that take in the
 * clicked character, after normalizing character variants.
 */
export async function lookUpCached(
  { from, to, query, at, hans }: LookupQuery,
  origin: string,
  locals: App.Locals
): Promise<Response> {
  hans &&= from === 'lzh'

  // Answers are shared by everyone the same data centre serves, so a word
  // anyone has looked up lately needs no shards at all. Keyed on only what
  // decides the answer, plus the dictionaries version so an update to them
  // doesnt serve stale answers
  const cacheKey = new Request(
    `${origin}/api/lookup?${new URLSearchParams({
      from,
      to,
      q: query,
      ...(from === 'lzh' && { at: String(at) }),
      ...(hans && { hans: '1' }),
      v: DICTIONARY_VERSION,
    })}`
  )
  // Not there in every dev setup, where lookups just go uncached
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default
  const cached = await cache?.match(cacheKey)
  if (cached) return cached

  const dict = getShardedDict<LookupEntry>(
    `lookup-${from}-${to}${hans ? '-hans' : ''}`,
    origin
  )
  let result: unknown

  // Fetching shards one at a time as the lookup reaches them costs a round
  // trip each, so start them all together up front
  if (from === 'lzh') {
    await dict.prefetch([...normalizeHanzi(query)].slice(0, at + 1))
    result = await lookupLzh(query, at, dict)
  } else {
    const dpdI2h = getShardedDict<string[]>('dpd-i2h', origin)
    const dpdDecon = getShardedDict<string>('dpd-deconstructor', origin)
    const enDict =
      to !== 'en' ? getShardedDict<LookupEntry>('lookup-pli-en', origin) : null

    const keys = paliLookupKeys(query)
    await Promise.all([
      dict.prefetch(keys.dict),
      dpdI2h.prefetch(keys.dpd),
      dpdDecon.prefetch(keys.dpd),
      enDict?.prefetch(keys.dict),
    ])

    let matches = await lookupPali(query, dict, dpdI2h, dpdDecon)

    // Fall back to English dict for languages with limited coverage (e.g. id, nl)
    if (matches.length === 0 && enDict) {
      matches = await lookupPali(query, enDict, dpdI2h, dpdDecon)
    }

    result = matches.map(serializeMatch)
  }

  const response = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // A month, both in the data centre and the browser. The data centre key
      // has the dictionaries version, so an update is never stale there. The
      // browser's doesnt, but updates are rare, and an old definition for a
      // few weeks after one is harmless
      'Cache-Control': 'public, max-age=2592000',
    },
  })
  if (cache) {
    locals.cfContext?.waitUntil(cache.put(cacheKey, response.clone()))
  }
  return response
}
