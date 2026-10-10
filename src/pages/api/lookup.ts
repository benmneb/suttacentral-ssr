import type { APIRoute } from 'astro'
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

/**
 * Dictionary lookup API endpoint, one word per request.
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
 * For Chinese: finds all dictionary entries that appear as substrings
 * in the text, after normalizing character variants.
 *
 * @param from - Source language ('pli' or 'lzh')
 * @param to - Target language ('en', 'es', 'zh', 'pt', 'id', 'nl')
 * @param word - Pali word to look up
 * @param text - Run of Chinese characters around the one clicked
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const query = url.searchParams.get(from === 'lzh' ? 'text' : 'word')

  // Both end up in an asset path, so only ever the known pairs
  if (!AVAILABLE_LOOKUPS[from]?.includes(to) || !query) {
    return new Response('[]', { status: 400 })
  }
  if (query.length > MAX_LENGTH) {
    return new Response('[]', { status: 414 })
  }

  // Answers are shared by everyone the same data centre serves, so a word
  // anyone has looked up lately needs no shards at all. Keyed on only what
  // decides the answer, plus the dictionaries version so an update to them
  // doesnt serve stale answers
  const cacheKey = new Request(
    `${url.origin}/api/lookup?${new URLSearchParams({
      from,
      to,
      q: query,
      v: DICTIONARY_VERSION,
    })}`
  )
  // Not there in every dev setup, where lookups just go uncached
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default
  const cached = await cache?.match(cacheKey)
  if (cached) return cached

  const dict = getShardedDict<LookupEntry>(`lookup-${from}-${to}`, url.origin)
  let result: unknown

  // Fetching shards one at a time as the lookup reaches them costs a round
  // trip each, so start them all together up front
  if (from === 'lzh') {
    await dict.prefetch([...normalizeHanzi(query)])
    result = await lookupLzh(query, dict)
  } else {
    const dpdI2h = getShardedDict<string[]>('dpd-i2h', url.origin)
    const dpdDecon = getShardedDict<string>('dpd-deconstructor', url.origin)
    const enDict =
      to !== 'en'
        ? getShardedDict<LookupEntry>('lookup-pli-en', url.origin)
        : null

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
