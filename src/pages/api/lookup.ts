import type { APIRoute } from 'astro'
import {
  type LookupEntry,
  lookupPali,
  normalizeHanzi,
  serializeMatch,
} from '~/utils/lookup'

const cache = new Map<string, unknown>()

/**
 * Load a JSON file from `public/data/` as a static asset.
 * Dictionary files live outside the worker bundle to stay under
 * Cloudflare's 25 MB worker size limit. Results are cached in
 * memory so each file is only fetched/parsed once per worker instance.
 */
async function loadAsset<T>(
  path: string,
  request: Request,
  runtime: any
): Promise<T | null> {
  if (cache.has(path)) return cache.get(path) as T
  let data: T
  if (import.meta.env.DEV) {
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile(`${process.cwd()}/public${path}`, 'utf-8')
    data = JSON.parse(raw) as T
  } else {
    const res = await runtime.env.ASSETS.fetch(new URL(path, request.url))
    if (!res.ok) return null
    data = (await res.json()) as T
  }
  cache.set(path, data)
  return data
}

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
export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as any).runtime
  const { words, from, to } = await request.json()

  const dict = await loadAsset<Record<string, LookupEntry>>(
    `/data/lookup-${from}-${to}.json`,
    request,
    runtime
  )
  if (!dict) return new Response('{}', { status: 404 })

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
  const dpdI2h = await loadAsset<Record<string, string[]>>(
    '/data/dpd-i2h.json',
    request,
    runtime
  )
  const dpdDecon = await loadAsset<Record<string, string>>(
    '/data/dpd-deconstructor.json',
    request,
    runtime
  )

  // Fall back to English dict for languages with limited coverage (e.g. id, nl)
  const enDict =
    to !== 'en'
      ? await loadAsset<Record<string, LookupEntry>>(
          '/data/lookup-pli-en.json',
          request,
          runtime
        )
      : null

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
