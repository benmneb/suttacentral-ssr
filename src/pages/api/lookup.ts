import type { APIRoute } from 'astro'
import { AVAILABLE_LOOKUPS } from '~/constants/lookup'
import {
  type LookupEntry,
  lookupLzh,
  lookupPali,
  serializeMatch,
} from '~/utils/lookup'
import { getShardedDict } from '~/utils/sharded-dict'

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
export const GET: APIRoute = async ({ url }) => {
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

  const dict = getShardedDict<LookupEntry>(`lookup-${from}-${to}`, url.origin)
  let result: unknown

  if (from === 'lzh') {
    result = await lookupLzh(query, dict)
  } else {
    const dpdI2h = getShardedDict<string[]>('dpd-i2h', url.origin)
    const dpdDecon = getShardedDict<string>('dpd-deconstructor', url.origin)

    let matches = await lookupPali(query, dict, dpdI2h, dpdDecon)

    // Fall back to English dict for languages with limited coverage (e.g. id, nl)
    if (matches.length === 0 && to !== 'en') {
      const enDict = getShardedDict<LookupEntry>('lookup-pli-en', url.origin)
      matches = await lookupPali(query, enDict, dpdI2h, dpdDecon)
    }

    result = matches.map(serializeMatch)
  }

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // The dictionaries only change with a deploy, so a word clicked twice
      // needn't come back here
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
