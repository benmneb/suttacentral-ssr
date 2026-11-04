import { waitUntil } from 'cloudflare:workers'
import { SC_API } from '~/constants/urls'

export interface Language {
  uid: string
  name: string
  iso_code: string
  is_root: boolean
  localized: boolean
  localized_percent: number
}

const LANGUAGES_URL = `${SC_API}/languages?all=true`
const MAX_AGE = 60 * 60 * 24

let languages: Promise<Language[]> | undefined
let fetchedAt = 0

async function fetchLanguages(): Promise<Language[]> {
  // Not there in every dev setup, where it just goes uncached
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default
  const cached = await cache?.match(LANGUAGES_URL)
  if (cached) return cached.json()

  const response = await fetch(LANGUAGES_URL)
  if (!response.ok) throw new Error(`${response.status} for ${LANGUAGES_URL}`)
  const data: Language[] = await response.json()
  if (cache) {
    const copy = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${MAX_AGE}`,
      },
    })
    waitUntil(cache.put(LANGUAGES_URL, copy))
  }
  return data
}

/**
 * Every language SuttaCentral has, which every page's search form lists. Kept
 * for an hour per worker instance and per data centre, as it rarely changes
 */
export function getLanguages(): Promise<Language[]> {
  if (!languages || Date.now() - fetchedAt > MAX_AGE * 1000) {
    fetchedAt = Date.now()
    languages = fetchLanguages()
    languages.catch(() => (languages = undefined))
  }
  return languages
}
