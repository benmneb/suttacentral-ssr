import type { AstroCookies } from 'astro'

const SEARCH_LANGUAGES_KEY = 'searchLanguages'
const SEARCH_STARTS_KEY = 'searchStarts'
const VIEW_PREFS_KEY = 'viewPrefs'

export function getSearchLanguages(cookies: AstroCookies): string[] | null {
  const cookieValue = cookies.get(SEARCH_LANGUAGES_KEY)?.json() as
    | string[]
    | undefined
  return cookieValue?.length ? cookieValue : null
}

export function setSearchLanguages(
  cookies: AstroCookies,
  languages: string[]
): void {
  cookies.set(SEARCH_LANGUAGES_KEY, JSON.stringify(languages), {
    path: '/',
    // No maxAge = session cookie (expires when browser closes)
  })
}

/** Where each page seen so far starts, for one search */
export type SearchStarts = {
  /** The first result number */
  starts: number[]
  /** The index of the first suttaplex card */
  cards: number[]
}

function isCountList(list: unknown, min: number): list is number[] {
  return Array.isArray(list) && list.every(n => Number.isInteger(n) && n >= min)
}

export function getSearchStarts(
  cookies: AstroCookies,
  search: string
): SearchStarts | null {
  const cookieValue = cookies.get(SEARCH_STARTS_KEY)?.json() as
    | { search: string; starts: unknown; cards: unknown }
    | undefined
  if (cookieValue?.search !== search) return null
  const { starts, cards } = cookieValue
  return isCountList(starts, 1) &&
    isCountList(cards, 0) &&
    starts.length === cards.length
    ? { starts, cards }
    : null
}

export function setSearchStarts(
  cookies: AstroCookies,
  search: string,
  { starts, cards }: SearchStarts
): void {
  cookies.set(SEARCH_STARTS_KEY, JSON.stringify({ search, starts, cards }), {
    path: '/search',
    sameSite: 'lax',
  })
}

export function getViewPrefs(
  cookies: AstroCookies
): Record<string, boolean | string> {
  const cookieValue = cookies.get(VIEW_PREFS_KEY)?.json() as
    | Record<string, boolean | string>
    | undefined
  return cookieValue ?? {}
}

/** Same lifetime and scope as the text page script gives the cookie */
export function setViewPref(
  cookies: AstroCookies,
  key: string,
  value: boolean | string
): void {
  cookies.set(
    VIEW_PREFS_KEY,
    JSON.stringify({ ...getViewPrefs(cookies), [key]: value }),
    { path: '/', maxAge: 60 * 60 * 24 * 365 * 2, sameSite: 'lax' }
  )
}
