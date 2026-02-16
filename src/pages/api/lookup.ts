import type { APIRoute } from 'astro'
import {
  type LookupEntry,
  lookupPali,
  normalizeHanzi,
  serializeMatch,
} from '~/utils/lookup'

const dictFiles = import.meta.glob<{
  default: Record<string, LookupEntry>
}>('~/data/lookup-*.json')

/**
 * DPD (Digital Pali Dictionary) — maps inflected Pali forms to headwords,
 * enabling lookup regardless of target language (e.g. "naṁ" → "ta" in dhp1/en/sujato)
 */
const dpdI2hFiles = import.meta.glob<{
  default: Record<string, string[]>
}>('~/data/dpd-i2h.json')

/** DPD Deconstructor — maps compound Pali words to their components (e.g. "akatañca" → "akataṃ + ca") */
const dpdDeconFiles = import.meta.glob<{
  default: Record<string, string>
}>('~/data/dpd-deconstructor.json')

/**
 * Dictionary lookup API endpoint.
 *
 * Accepts a list of words and a language pair, performs all linguistic
 * processing server-side (DPD inflection mapping, compound decomposition,
 * sandhi resolution), and returns only the matched results. This keeps
 * ~25MB of dictionary data and processing logic off the client.
 *
 * For Pali: tries DPD inflection-to-headword first, then compound
 * decomposition with fuzzy matching. Falls back to the English dictionary
 * for languages with limited coverage (e.g. Indonesian, Dutch).
 *
 * For Chinese: finds all dictionary entries that appear as substrings
 * in the joined text, after normalizing character variants.
 *
 * @param words - Array of words to look up
 * @param from - Source language ('pli' or 'lzh')
 * @param to - Target language ('en', 'es', 'zh', 'pt', 'id', 'nl')
 */
export const POST: APIRoute = async ({ request }) => {
  const { words, from, to } = await request.json()
  const dictPath = `/src/data/lookup-${from}-${to}.json`
  const loader = dictFiles[dictPath]
  if (!loader) return new Response('{}', { status: 404 })

  const dict = (await loader()).default

  if (from === 'lzh') {
    // Chinese: find all dictionary entries that appear as substrings in the text
    const result: Record<string, LookupEntry> = {}
    const text = normalizeHanzi(words.join(''))

    for (let i = 0; i < text.length; i++) {
      for (let len = 1; len <= Math.min(20, text.length - i); len++) {
        const substr = text.substring(i, i + len)
        if (dict[substr] && !result[substr]) result[substr] = dict[substr]
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Pali: DPD lookup with compound decomposition fallback
  const i2hLoader = dpdI2hFiles['/src/data/dpd-i2h.json']
  const deconLoader = dpdDeconFiles['/src/data/dpd-deconstructor.json']
  const dpdI2h = i2hLoader ? (await i2hLoader()).default : null
  const dpdDecon = deconLoader ? (await deconLoader()).default : null

  // Fall back to English dict for languages with limited coverage (e.g. id, nl)
  const enLoader =
    to !== 'en' ? dictFiles['/src/data/lookup-pli-en.json'] : null
  const enDict = enLoader ? (await enLoader()).default : null

  const result: Record<
    string,
    Array<{ base: string; entry?: LookupEntry; meaning?: string }>
  > = {}

  for (const word of words) {
    let matches = lookupPali(word, dict, dpdI2h, dpdDecon)

    if (matches.length === 0 && enDict) {
      matches = lookupPali(word, enDict, dpdI2h, dpdDecon)
    }

    if (matches.length > 0) {
      result[word] = matches.map(serializeMatch)
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
