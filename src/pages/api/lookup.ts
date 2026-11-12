import type { APIRoute } from 'astro'
import { lookUpCached, lookupError } from '~/utils/lookup-answer'

/**
 * Dictionary lookup API endpoint, one word per request. See `lookUpCached`.
 *
 * @param from - Source language ('pli' or 'lzh')
 * @param to - Target language ('en', 'es', 'zh', 'pt', 'id', 'nl')
 * @param word - Pali word to look up
 * @param text - Run of Chinese characters around the one clicked
 * @param at - Where the clicked one is in `text`, counting characters
 * @param hans - Set when `text` is in simplified characters
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const from = url.searchParams.get('from') ?? ''
  const lookup = {
    from,
    to: url.searchParams.get('to') ?? '',
    query: url.searchParams.get(from === 'lzh' ? 'text' : 'word') ?? '',
    at: Number(url.searchParams.get('at')),
    hans: url.searchParams.has('hans'),
  }
  const status = lookupError(lookup)
  if (status) return new Response('[]', { status })
  return lookUpCached(lookup, url.origin, locals)
}
